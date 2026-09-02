import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Modal,
  TouchableWithoutFeedback,
  TextInput,
  Linking,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { secureGet } from "../../../services/secureStorage";
import { useTheme } from "../../../context/ThemeContext";
import { showToast } from "../../../utils/toastService";
import { api } from "../../../services/api";
import { getStudentData } from "../../../services/dataService";
import { resolveIdentity } from "../../../services/identityService";
import { formatDeptName } from "../../../utils/deptFormatter";
import { shareTimetableAsPdf } from "../../../utils/timetablePdfGenerator";

const DEPT_CODE_MAP = {
  "AI & DS": "AIDS",
  "AIDS": "AIDS",
  "Artificial Intelligence & Data Science": "AIDS",
  "B.Tech in Artificial Intelligence & Data Science": "AIDS",
  "CSE": "CSE",
  "AIML": "AIML",
  "IT": "IT",
  "ECE": "ECE",
  "EEE": "EEE",
  "MECH": "MECH",
};


// Normalizers for DB timetable rows: numbered 1 to 7 only (breaks not counted as periods)
const DEFAULT_STAFF_NAME = "—";

const normalizeTimetable = (schedule) => {
  const out = {};
  for (const day of Object.keys(schedule || {})) {
    let academicCounter = 0;
    out[day] = (Array.isArray(schedule[day]) ? schedule[day] : []).map((row) => {
      const isLunch = String(row.subject || "").toLowerCase().includes("lunch");
      const isTea = String(row.subject || "").toLowerCase().includes("tea") || String(row.subject || "").toLowerCase().includes("break");
      const isBreak = row.isBreak || isLunch || isTea;

      if (isBreak) {
        return {
          ...row,
          isBreak: true,
          period: isLunch ? "Lunch Break" : "Tea Break",
          periodIndex: null,
          time: row.time || "—",
          duration: row.duration || "",
          type: "Break",
        };
      }

      academicCounter++;
      const isLab = /lab/i.test(String(row.subject || row.code || ""));
      const rawTeacher = row.teacher || row.faculty;
      const teacher =
        rawTeacher && rawTeacher !== "Faculty" && rawTeacher.trim()
          ? rawTeacher
          : DEFAULT_STAFF_NAME;

      return {
        ...row,
        isBreak: false,
        period: row.period && !row.period.includes("undefined") ? row.period : (isLab ? `Lab (Period ${academicCounter})` : `Period ${academicCounter}`),
        periodIndex: academicCounter,
        periodNumber: academicCounter,
        time: row.time || "—",
        code: row.code || "",
        type: row.type || (isLab ? "Lab" : "Theory"),
        room: row.room || (isLab ? "AI & DS Lab" : "D205"),
        teacher: teacher,
        teacherDetails: row.teacherDetails || null,
      };
    });
  }
  return out;
};

const daysList = [
  { short: "Mon", full: "Monday" },
  { short: "Tue", full: "Tuesday" },
  { short: "Wed", full: "Wednesday" },
  { short: "Thu", full: "Thursday" },
  { short: "Fri", full: "Friday" },
];

export default function FullTimetable({ visible = true, onClose }) {
  const { colors, isDarkMode } = useTheme();
  const styles = getStyles(colors, isDarkMode);

  const getCurrentDay = () => {
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const today = new Date().getDay();
    const currentDayName = dayNames[today];
    if (currentDayName === "Sunday" || currentDayName === "Saturday") return "Monday";
    return currentDayName;
  };

  const getTodayName = () => {
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    return dayNames[new Date().getDay()];
  };

  // Student Profile Data (populated from the database on mount)
  const [studentCohort, setStudentCohort] = useState({
    name: "",
    rollNo: "",
    department: "",
    deptShort: "",
    year: "",
    semester: "",
    section: "",
    advisor: "",
  });

  const [selectedDay, setSelectedDay] = useState(getCurrentDay());
  const [selectedSessionType, setSelectedSessionType] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClass, setSelectedClass] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [timetableData, setTimetableData] = useState({});
  const [loading, setLoading] = useState(false);
  const timetableDataRef = useRef({});
  timetableDataRef.current = timetableData;

  // Load student profile
  useEffect(() => {
    async function loadStudentCohort() {
      try {
        const [student, identity, rawUser] = await Promise.all([
          getStudentData().catch(() => null),
          resolveIdentity().catch(() => null),
          secureGet("userData").catch(() => null),
        ]);
        const dept =
          student?.department ||
          identity?.department ||
          rawUser?.department ||
          "";
        const d = dept.toLowerCase();
        const deptShort =
          d.startsWith("ai") || d.includes("& ds")
            ? "AI & DS"
            : d.includes("computer") || d === "cse"
            ? "CSE"
            : d.includes("aiml") || d.includes("ai&ml")
            ? "AIML"
            : "";
        const year = student?.year || identity?.year || rawUser?.year || "";
        const semester = student?.semester || identity?.semester || rawUser?.semester || "";
        const section = student?.section || student?.class || rawUser?.section || "";

        setStudentCohort({
          name: student?.name || identity?.name || rawUser?.name || "",
          rollNo: student?.rollNo || student?.roll || identity?.rollNo || "",
          department: dept,
          deptShort,
          year: typeof year === "number" ? `${year} Year` : year,
          semester: semester ? `${semester} (Odd)` : "",
          section: section ? (section.includes("Section") ? section : `Section ${section}`) : "",
          advisor: student?.advisor?.name || (typeof student?.advisor === "string" ? student.advisor : "") || "",
        });
      } catch (e) {
        console.log("Error loading student cohort in Timetable:", e);
      }
    }
    loadStudentCohort();
  }, []);

  const fetchTimetable = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    try {
      const res = await api.get("/timetable").catch(() => null);
      const docs = res?.data || [];
      const code = DEPT_CODE_MAP[studentCohort.deptShort] || "AIDS";
      const match =
        docs.find(
          (d) =>
            d.departmentCode === code ||
            (d.departmentCode || "").toLowerCase() === code.toLowerCase() ||
            d.department === studentCohort.department ||
            d.department === studentCohort.deptShort ||
            (d.departmentName && d.departmentName.toLowerCase().includes("intelligence"))
        ) || docs[0];

      if (match?.schedule && Object.keys(match.schedule).length > 0) {
        setTimetableData(normalizeTimetable(match.schedule));
        const matchAdvisor =
          typeof match.advisor === "string"
            ? match.advisor
            : match.advisor?.name || "";
        if (matchAdvisor) {
          setStudentCohort((s) => (s.advisor !== matchAdvisor ? { ...s, advisor: matchAdvisor } : s));
        }
      } else {
        setTimetableData({});
      }
    } catch (err) {
      console.log("Timetable fetch error, showing empty state:", err);
      setTimetableData({});
    } finally {
      setLoading(false);
    }
  }, [studentCohort.deptShort, studentCohort.department]);

  useEffect(() => {
    if (visible) {
      fetchTimetable(Object.keys(timetableDataRef.current).length === 0);
    }
  }, [visible, fetchTimetable]);

  const baseDaySchedule = useMemo(() => timetableData[selectedDay] || [], [timetableData, selectedDay]);

  const filteredSchedule = useMemo(() => {
    return baseDaySchedule.filter((item) => {
      if (selectedSessionType === "Theory" && (item.type !== "Theory" || item.isBreak)) return false;
      if (selectedSessionType === "Labs" && (item.type !== "Lab" || item.isBreak)) return false;
      if (selectedSessionType === "Breaks" && !item.isBreak) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchSub = item.subject?.toLowerCase().includes(q);
        const matchTeach = item.teacher?.toLowerCase().includes(q);
        const matchRoom = item.room?.toLowerCase().includes(q);
        const matchCode = item.code?.toLowerCase().includes(q);
        if (!matchSub && !matchTeach && !matchRoom && !matchCode) return false;
      }
      return true;
    });
  }, [baseDaySchedule, selectedSessionType, searchQuery]);

  const totalLectures = baseDaySchedule.filter((i) => !i.isBreak && i.type === "Theory").length;
  const totalLabs = baseDaySchedule.filter((i) => !i.isBreak && i.type === "Lab").length;
  const totalBreaks = baseDaySchedule.filter((i) => i.isBreak).length;

  const handleClassClick = (item) => {
    if (!item.isBreak) {
      setSelectedClass(item);
      setShowDetailsModal(true);
    }
  };

  const closeDetailsModal = () => {
    setShowDetailsModal(false);
    setTimeout(() => setSelectedClass(null), 300);
  };

  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const handleShareSchedule = async (dayToShare = null) => {
    try {
      setIsGeneratingPdf(true);
      showToast("📄 Generating Official Timetable PDF...", "info");
      await shareTimetableAsPdf({
        timetableData,
        cohort: studentCohort,
        selectedDay: dayToShare, // null = full week PDF
      });
      showToast("✅ Timetable PDF generated & shared!", "success");
    } catch (err) {
      console.log("PDF Share error:", err);
      showToast("Could not generate PDF. Please try again.", "error");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleContactFaculty = (type, value) => {
    if (type === "email") {
      Linking.openURL(`mailto:${value}`).catch(() => showToast(`Email: ${value}`, "info"));
    } else if (type === "phone") {
      Linking.openURL(`tel:${value.replace(/\s+/g, "")}`).catch(() => showToast(`Phone: ${value}`, "info"));
    }
  };

  const handleBookConsultation = () => {
    showToast(`Consultation request sent to ${selectedClass?.teacher}!`, "success");
    closeDetailsModal();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.primaryBackground }]}>
        <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />

        {/* 1. TOP HEADER */}
        <View style={[styles.header, { borderBottomColor: colors.divider }]}>
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={onClose} style={[styles.closeButton, { backgroundColor: colors.cardBackground }]} activeOpacity={0.7}>
              <Icon name="arrow-left" size={22} color={colors.primaryText} />
            </TouchableOpacity>
            <View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={[styles.headerTitle, { color: colors.primaryText }]}>Class Timetable</Text>
                <View style={styles.liveTermBadge}>
                  <Text style={styles.liveTermBadgeText}>{"Odd '25"}</Text>
                </View>
              </View>
              <Text style={[styles.headerSubtitle, { color: colors.secondaryText }]}>
                {studentCohort.deptShort || formatDeptName(studentCohort.department, "code")} · {studentCohort.year} ({studentCohort.section})
              </Text>
            </View>
          </View>

          <View style={styles.headerRightActions}>
            <TouchableOpacity
              style={[
                styles.headerActionBtn,
                {
                  backgroundColor: colors.cardBackground,
                  borderColor: colors.divider,
                },
              ]}
              onPress={() => handleShareSchedule(null)}
              activeOpacity={0.7}
              disabled={isGeneratingPdf}
              accessibilityLabel="Share Timetable PDF"
            >
              {isGeneratingPdf ? (
                <ActivityIndicator size="small" color={colors.primaryAccent} />
              ) : (
                <Icon name="share-variant-outline" size={19} color={colors.primaryText} />
              )}
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* 2. ENROLLED COHORT HERO CARD */}
          <View style={[styles.cohortHeroCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
            <View style={styles.cohortTopRow}>
              <View style={[styles.deptIconBadge, { backgroundColor: colors.primaryAccent + "18" }]}>
                <Icon name="school-outline" size={24} color={colors.primaryAccent} />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={[styles.cohortTitle, { color: colors.primaryText }]} numberOfLines={1}>
                    {formatDeptName(studentCohort.department || studentCohort.deptShort, "compact")}
                  </Text>
                  <View style={styles.enrolledBadge}>
                    <Icon name="check-decagram" size={11} color="#10B981" />
                    <Text style={styles.enrolledBadgeText}>ENROLLED</Text>
                  </View>
                </View>

                <Text style={[styles.cohortSub, { color: colors.secondaryText }]}>
                  {studentCohort.year} · {studentCohort.section} · {studentCohort.semester}
                </Text>
              </View>
            </View>

            <View style={[styles.advisorStrip, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
              <Icon name="account-tie-outline" size={16} color={colors.primaryAccent} />
              <Text style={[styles.advisorText, { color: colors.primaryText, flex: 1 }]} numberOfLines={1}>
                Class Advisor: <Text style={{ fontWeight: "800" }}>{studentCohort.advisor}</Text>
              </Text>
            </View>
          </View>

          {/* 3. DAY SELECTOR TABS (MON - FRI) */}
          <View style={styles.daySelectorRow}>
            {daysList.map((day) => {
              const isSelected = selectedDay === day.full;
              const isToday = getTodayName() === day.full;

              return (
                <TouchableOpacity
                  key={day.full}
                  style={[
                    styles.dayPill,
                    isSelected
                      ? { backgroundColor: colors.primaryAccent, borderColor: colors.primaryAccent }
                      : { backgroundColor: colors.cardBackground, borderColor: colors.divider },
                  ]}
                  onPress={() => setSelectedDay(day.full)}
                  activeOpacity={0.8}
                >
                  {isToday && (
                    <View style={[styles.todayDot, { backgroundColor: isSelected ? "#FFFFFF" : "#10B981" }]} />
                  )}
                  <Text style={[styles.dayPillShort, { color: isSelected ? "#FFFFFF" : colors.primaryText }]}>
                    {day.short}
                  </Text>
                  <Text style={[styles.dayPillFull, { color: isSelected ? "rgba(255,255,255,0.85)" : colors.secondaryText }]}>
                    {day.full.slice(0, 3)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* 4. METRICS STRIP */}
          <View style={[styles.metricsBannerCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
            <View style={styles.metricItem}>
              <Text style={[styles.metricVal, { color: colors.primaryAccent }]}>{filteredSchedule.length}</Text>
              <Text style={[styles.metricLbl, { color: colors.secondaryText }]}>Sessions</Text>
            </View>
            <View style={[styles.metricDivider, { backgroundColor: colors.divider }]} />
            <View style={styles.metricItem}>
              <Text style={[styles.metricVal, { color: "#2563EB" }]}>{totalLectures}</Text>
              <Text style={[styles.metricLbl, { color: colors.secondaryText }]}>Lectures</Text>
            </View>
            <View style={[styles.metricDivider, { backgroundColor: colors.divider }]} />
            <View style={styles.metricItem}>
              <Text style={[styles.metricVal, { color: "#7C3AED" }]}>{totalLabs}</Text>
              <Text style={[styles.metricLbl, { color: colors.secondaryText }]}>Labs</Text>
            </View>
            <View style={[styles.metricDivider, { backgroundColor: colors.divider }]} />
            <View style={styles.metricItem}>
              <Text style={[styles.metricVal, { color: "#F59E0B" }]}>{totalBreaks}</Text>
              <Text style={[styles.metricLbl, { color: colors.secondaryText }]}>Recess</Text>
            </View>
          </View>

          {/* 5. SEARCH & SESSION TYPE FILTER */}
          <View style={styles.filterSection}>
            <View style={[styles.searchBar, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
              <Icon name="magnify" size={18} color={colors.secondaryText} />
              <TextInput
                style={[styles.searchInput, { color: colors.primaryText }]}
                placeholder="Search subject, faculty, or room..."
                placeholderTextColor={colors.disabledText}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery("")}>
                  <Icon name="close-circle" size={16} color={colors.secondaryText} />
                </TouchableOpacity>
              )}
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginTop: 8 }}>
              {["All", "Theory", "Labs", "Breaks"].map((type) => {
                const isSel = selectedSessionType === type;
                return (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.typePill,
                      isSel
                        ? { backgroundColor: colors.primaryAccent, borderColor: colors.primaryAccent }
                        : { backgroundColor: colors.cardBackground, borderColor: colors.divider },
                    ]}
                    onPress={() => setSelectedSessionType(type)}
                  >
                    <Text style={[styles.typePillText, { color: isSel ? "#FFFFFF" : colors.primaryText }]}>
                      {type}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* 6. DAILY SCHEDULE TIMELINE */}
          {loading ? (
            <View style={{ paddingVertical: 40, alignItems: "center" }}>
              <ActivityIndicator size="large" color={colors.primaryAccent} />
              <Text style={{ color: colors.secondaryText, marginTop: 10, fontSize: 12 }}>
                Loading {studentCohort.deptShort} timetable...
              </Text>
            </View>
          ) : filteredSchedule.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
              <Icon name="calendar-blank-outline" size={44} color={colors.disabledText} />
              <Text style={[styles.emptyTitle, { color: colors.primaryText }]}>No Scheduled Sessions</Text>
              <Text style={[styles.emptySub, { color: colors.secondaryText }]}>
                No lectures or labs found matching your filter criteria on {selectedDay}.
              </Text>
            </View>
          ) : (
            <View style={{ gap: 10, marginTop: 10 }}>
              {filteredSchedule.map((item, idx) => {
                if (item.isBreak) {
                  return (
                    <View
                      key={idx}
                      style={[styles.breakCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
                    >
                      <Icon
                        name={item.subject.toLowerCase().includes("lunch") ? "food-fork-drink" : "coffee-outline"}
                        size={20}
                        color="#F59E0B"
                      />
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                          <Text style={[styles.breakTitle, { color: colors.primaryText }]}>{item.subject}</Text>
                          <Text style={[styles.breakDuration, { color: "#F59E0B" }]}>{item.duration}</Text>
                        </View>
                        <Text style={[styles.breakMeta, { color: colors.secondaryText }]}>
                          â° {item.time} Â· ðŸ“ {item.room}
                        </Text>
                      </View>
                    </View>
                  );
                }

                return (
                  <TouchableOpacity
                    key={idx}
                    style={[styles.lectureCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
                    onPress={() => handleClassClick(item)}
                    activeOpacity={0.85}
                  >
                    <View style={[styles.colorStrip, { backgroundColor: item.color || colors.primaryAccent }]} />

                    <View style={{ flex: 1, padding: 12 }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <View style={[styles.periodBadge, { backgroundColor: (item.color || colors.primaryAccent) + "18" }]}>
                            <Text style={[styles.periodBadgeText, { color: item.color || colors.primaryAccent }]}>
                              {item.period}
                            </Text>
                          </View>
                          <Text style={[styles.lectureTime, { color: colors.primaryText }]}>{item.time}</Text>
                        </View>

                        <View style={[styles.typeBadge, { backgroundColor: item.type === "Lab" ? "#7C3AED18" : "#2563EB18" }]}>
                          <Text style={[styles.typeBadgeText, { color: item.type === "Lab" ? "#7C3AED" : "#2563EB" }]}>
                            {item.type === "Lab" ? "Lab" : "Theory"}
                          </Text>
                        </View>
                      </View>

                      <Text style={[styles.subjectName, { color: colors.primaryText }]} numberOfLines={2}>
                        {item.subject}
                      </Text>

                      <View style={styles.lectureFooterRow}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
                          <Icon name="account-outline" size={15} color={colors.primaryAccent} />
                          <Text style={[styles.teacherName, { color: colors.secondaryText }]} numberOfLines={1}>
                            {item.teacher}
                          </Text>
                        </View>

                        <View style={[styles.roomPill, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                          <Icon name="map-marker-outline" size={12} color={colors.primaryAccent} />
                          <Text style={[styles.roomText, { color: colors.primaryText }]}>{item.room}</Text>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Modern Share / Export PDF Card */}
          {!loading && (
            <View style={[styles.shareCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
              <View style={styles.shareCardHeader}>
                <View style={[styles.shareCardIconWrap, { backgroundColor: "#EF444415" }]}>
                  <Icon name="file-pdf-box" size={22} color="#EF4444" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.shareCardTitle, { color: colors.primaryText }]}>Official Schedule PDF</Text>
                  <Text style={[styles.shareCardSub, { color: colors.secondaryText }]}>
                    Generated institutional A4 landscape format with faculty and venue allocations.
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.primaryShareBtn, { backgroundColor: colors.primaryAccent }]}
                onPress={() => handleShareSchedule(null)}
                disabled={isGeneratingPdf}
                activeOpacity={0.85}
              >
                {isGeneratingPdf ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Icon name="download-box-outline" size={19} color="#FFFFFF" />
                    <Text style={styles.primaryShareBtnText}>Export Full Week Timetable</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryShareLink}
                onPress={() => handleShareSchedule(selectedDay)}
                disabled={isGeneratingPdf}
                activeOpacity={0.7}
              >
                <Icon name="share-outline" size={14} color={colors.primaryAccent} />
                <Text style={[styles.secondaryShareLinkText, { color: colors.primaryAccent }]}>
                  Share {selectedDay} schedule only
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>

        {/* 7. CLASS DETAILS MODAL */}
        <Modal visible={showDetailsModal} transparent animationType="fade" onRequestClose={closeDetailsModal}>
          <TouchableWithoutFeedback onPress={closeDetailsModal}>
            <View style={styles.modalBackdrop}>
              <TouchableWithoutFeedback>
                <View style={[styles.modalCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
                  {selectedClass && (
                    <>
                      <View style={styles.modalHeader}>
                        <View style={[styles.modalIconWrap, { backgroundColor: (selectedClass.color || colors.primaryAccent) + "18" }]}>
                          <Icon name="book-open-page-variant" size={24} color={selectedClass.color || colors.primaryAccent} />
                        </View>
                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <Text style={[styles.modalSubjTitle, { color: colors.primaryText }]}>
                            {selectedClass.subject}
                          </Text>
                          <Text style={[styles.modalSubjCode, { color: colors.secondaryText }]}>
                            {selectedClass.code || "Course Core"} Â· {selectedClass.type}
                          </Text>
                        </View>
                        <TouchableOpacity onPress={closeDetailsModal}>
                          <Icon name="close-circle-outline" size={24} color={colors.secondaryText} />
                        </TouchableOpacity>
                      </View>

                      {/* Class Meta Grid */}
                      <View style={[styles.metaGrid, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                        <View style={styles.metaCol}>
                          <Text style={[styles.metaKey, { color: colors.secondaryText }]}>Schedule Time</Text>
                          <Text style={[styles.metaVal, { color: colors.primaryText }]}>{selectedClass.time}</Text>
                        </View>
                        <View style={styles.metaCol}>
                          <Text style={[styles.metaKey, { color: colors.secondaryText }]}>Classroom Venue</Text>
                          <Text style={[styles.metaVal, { color: colors.primaryText }]}>{selectedClass.room}</Text>
                        </View>
                      </View>

                      {/* Faculty Info Card */}
                      <View style={[styles.facultyDetailCard, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                          <View style={[styles.facAvatar, { backgroundColor: selectedClass.color || colors.primaryAccent }]}>
                            <Icon name="account-tie" size={24} color="#FFFFFF" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.facName, { color: colors.primaryText }]}>{selectedClass.teacher || "—"}</Text>
                            <Text style={[styles.facCabin, { color: colors.secondaryText }]}>
                              {selectedClass.teacherDetails?.cabin || selectedClass.teacherDetails?.designation || "—"}
                            </Text>
                          </View>
                        </View>

                        {selectedClass.teacherDetails && (
                          <View style={styles.contactRow}>
                            {selectedClass.teacherDetails.email && (
                              <TouchableOpacity
                                style={[styles.contactBtn, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
                                onPress={() => handleContactFaculty("email", selectedClass.teacherDetails.email)}
                              >
                                <Icon name="email-outline" size={16} color={colors.primaryAccent} />
                                <Text style={[styles.contactBtnText, { color: colors.primaryAccent }]}>Email</Text>
                              </TouchableOpacity>
                            )}

                            {selectedClass.teacherDetails.phone && (
                              <TouchableOpacity
                                style={[styles.contactBtn, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
                                onPress={() => handleContactFaculty("phone", selectedClass.teacherDetails.phone)}
                              >
                                <Icon name="phone-outline" size={16} color="#10B981" />
                                <Text style={[styles.contactBtnText, { color: "#10B981" }]}>Call</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        )}
                      </View>

                      {/* Request Consultation Action */}
                      <TouchableOpacity
                        style={[styles.consultBtn, { backgroundColor: colors.primaryAccent }]}
                        onPress={handleBookConsultation}
                      >
                        <Icon name="calendar-clock" size={18} color="#FFFFFF" />
                        <Text style={styles.consultBtnText}>Request 1-on-1 Cabin Consultation</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      </SafeAreaView>
    </Modal>
  );
}

// ---------------- Styles ----------------
const getStyles = (colors, _isDarkMode) =>
  StyleSheet.create({
    container: { flex: 1 },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
    },
    headerLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    closeButton: {
      width: 38,
      height: 38,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
    },
    headerTitle: {
      fontSize: 17,
      fontWeight: "800",
      letterSpacing: -0.2,
    },
    liveTermBadge: {
      backgroundColor: "#10B98118",
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    liveTermBadgeText: {
      color: "#10B981",
      fontSize: 9.5,
      fontWeight: "900",
    },
    headerSubtitle: {
      fontSize: 11,
      fontWeight: "500",
      marginTop: 1,
    },
    headerRightActions: {
      flexDirection: "row",
      gap: 8,
    },
    headerActionBtn: {
      width: 38,
      height: 38,
      borderRadius: 12,
      borderWidth: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    scrollContent: {
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 40,
    },

    /* Cohort Hero Card */
    cohortHeroCard: {
      borderRadius: 18,
      borderWidth: 1,
      padding: 14,
      marginBottom: 12,
      elevation: 2,
    },
    cohortTopRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    deptIconBadge: {
      width: 42,
      height: 42,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
    },
    cohortTitle: {
      fontSize: 14,
      fontWeight: "800",
      flex: 1,
    },
    enrolledBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      backgroundColor: "#10B98118",
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      marginLeft: 6,
    },
    enrolledBadgeText: {
      color: "#10B981",
      fontSize: 9,
      fontWeight: "900",
    },
    cohortSub: {
      fontSize: 11,
      fontWeight: "500",
      marginTop: 2,
    },
    advisorStrip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      borderRadius: 10,
      borderWidth: 1,
      padding: 8,
      marginTop: 10,
    },
    advisorText: {
      fontSize: 11,
    },

    /* Day Selector Tabs */
    daySelectorRow: {
      flexDirection: "row",
      gap: 6,
      marginBottom: 10,
    },
    dayPill: {
      flex: 1,
      alignItems: "center",
      paddingVertical: 8,
      borderRadius: 12,
      borderWidth: 1,
      position: "relative",
    },
    todayDot: {
      position: "absolute",
      top: 4,
      right: 6,
      width: 5,
      height: 5,
      borderRadius: 2.5,
    },
    dayPillShort: {
      fontSize: 13,
      fontWeight: "800",
    },
    dayPillFull: {
      fontSize: 9.5,
      fontWeight: "600",
      marginTop: 1,
    },

    /* Metrics */
    metricsBannerCard: {
      flexDirection: "row",
      borderRadius: 14,
      borderWidth: 1,
      padding: 10,
      marginBottom: 12,
      justifyContent: "space-around",
    },
    metricItem: {
      alignItems: "center",
    },
    metricVal: {
      fontSize: 14,
      fontWeight: "900",
    },
    metricLbl: {
      fontSize: 9.5,
      fontWeight: "600",
      marginTop: 1,
    },
    metricDivider: {
      width: 1,
      height: "70%",
      alignSelf: "center",
    },

    /* Filter Section */
    filterSection: {
      marginBottom: 10,
    },
    searchBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      borderWidth: 1,
    },
    searchInput: {
      flex: 1,
      fontSize: 12.5,
      padding: 0,
    },
    typePill: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 10,
      borderWidth: 1,
    },
    typePillText: {
      fontSize: 11.5,
      fontWeight: "700",
    },

    /* Timeline Cards */
    breakCard: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 14,
      borderWidth: 1,
      padding: 12,
    },
    breakTitle: {
      fontSize: 13,
      fontWeight: "800",
    },
    breakDuration: {
      fontSize: 11,
      fontWeight: "800",
    },
    breakMeta: {
      fontSize: 11,
      fontWeight: "500",
      marginTop: 2,
    },
    lectureCard: {
      flexDirection: "row",
      borderRadius: 14,
      borderWidth: 1,
      overflow: "hidden",
    },
    colorStrip: {
      width: 5,
    },
    periodBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    periodBadgeText: {
      fontSize: 9.5,
      fontWeight: "900",
    },
    lectureTime: {
      fontSize: 11.5,
      fontWeight: "700",
    },
    typeBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    typeBadgeText: {
      fontSize: 9.5,
      fontWeight: "900",
    },
    subjectName: {
      fontSize: 13.5,
      fontWeight: "800",
      marginTop: 6,
    },
    lectureFooterRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 8,
      paddingTop: 6,
      borderTopWidth: 1,
      borderTopColor: "rgba(150,150,150,0.15)",
    },
    teacherName: {
      fontSize: 11,
      fontWeight: "600",
    },
    roomPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      borderWidth: 1,
    },
    roomText: {
      fontSize: 10.5,
      fontWeight: "700",
    },
    emptyCard: {
      borderRadius: 16,
      borderWidth: 1,
      padding: 30,
      alignItems: "center",
      marginTop: 20,
    },
    emptyTitle: {
      fontSize: 15,
      fontWeight: "800",
      marginTop: 10,
    },
    emptySub: {
      fontSize: 12,
      textAlign: "center",
      marginTop: 4,
    },

    /* Modal Backdrop & Card */
    modalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.75)",
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 18,
    },
    modalCard: {
      width: "100%",
      borderRadius: 22,
      borderWidth: 1,
      padding: 18,
      elevation: 12,
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 12,
    },
    modalIconWrap: {
      width: 42,
      height: 42,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
    },
    modalSubjTitle: {
      fontSize: 14.5,
      fontWeight: "800",
    },
    modalSubjCode: {
      fontSize: 11,
      fontWeight: "500",
      marginTop: 1,
    },
    metaGrid: {
      flexDirection: "row",
      borderRadius: 12,
      borderWidth: 1,
      padding: 10,
      marginBottom: 10,
    },
    metaCol: {
      flex: 1,
    },
    metaKey: {
      fontSize: 10.5,
      fontWeight: "600",
    },
    metaVal: {
      fontSize: 12,
      fontWeight: "800",
      marginTop: 2,
    },
    facultyDetailCard: {
      borderRadius: 14,
      borderWidth: 1,
      padding: 12,
      marginBottom: 12,
    },
    facAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: "center",
      alignItems: "center",
    },
    facName: {
      fontSize: 13,
      fontWeight: "800",
    },
    facCabin: {
      fontSize: 11,
      fontWeight: "500",
      marginTop: 1,
    },
    contactRow: {
      flexDirection: "row",
      gap: 8,
      marginTop: 10,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: "rgba(150,150,150,0.15)",
    },
    contactBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
      paddingVertical: 7,
      borderRadius: 8,
      borderWidth: 1,
    },
    contactBtnText: {
      fontSize: 11.5,
      fontWeight: "700",
    },
    consultBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 12,
      borderRadius: 12,
    },
    consultBtnText: {
      color: "#FFFFFF",
      fontSize: 12.5,
      fontWeight: "800",
    },

    /* Modern Share Card */
    shareCard: {
      marginTop: 18,
      borderRadius: 16,
      borderWidth: 1,
      padding: 16,
      gap: 12,
    },
    shareCardHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    shareCardIconWrap: {
      width: 42,
      height: 42,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    shareCardTitle: {
      fontSize: 14,
      fontWeight: "800",
    },
    shareCardSub: {
      fontSize: 11,
      fontWeight: "500",
      marginTop: 2,
      lineHeight: 15,
    },
    primaryShareBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 13,
      borderRadius: 12,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    primaryShareBtnText: {
      fontSize: 13,
      fontWeight: "800",
      color: "#FFFFFF",
      letterSpacing: 0.2,
    },
    secondaryShareLink: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 6,
    },
    secondaryShareLinkText: {
      fontSize: 11.5,
      fontWeight: "700",
    },
  });

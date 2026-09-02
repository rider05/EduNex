import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Modal,
  Easing,
  RefreshControl,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import QRCode from "react-native-qrcode-svg";
import { useTheme } from "../../context/ThemeContext";
import { showToast } from "../../utils/toastService";

// Data & Services
import { getStudentData, getGradeLevels, getParentNotices, getInstitutions, getAssignments, getStudentAttendanceSummary } from "../../services/dataService";
import { SkeletonScreenLoader } from "../../components/common/SkeletonLoader";
import { formatDeptName } from "../../utils/deptFormatter";
import useRefreshOnForeground from "../../hooks/useRefreshOnForeground";
import { shareStudentIdCardPdf } from "../../utils/pdfGenerator";

// Modals
import FeesModal from "./modals/FeesModal";
import ExamModal from "./modals/ExamModal";
import AttendanceModal from "./modals/AttendanceModal";
import LibraryModal from "./modals/LibraryModal";
import FullTimeTable from "./modals/FullTimeTable";
import LeaveFormModal from "../../components/header/modal/LeaveFormModal";

export default function DashboardScreen() {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [studentData, setStudentData] = useState({});
  const [institution, setInstitution] = useState(null);
  const [notices, setNotices] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [visibleModal, setVisibleModal] = useState(null);

  // Sub-Modals
  const [gradeModalVisible, setGradeModalVisible] = useState(false);
  const [gradeInfoVisible, setGradeInfoVisible] = useState(false);
  const [idCardModalVisible, setIdCardModalVisible] = useState(false);
  const [leaveModalVisible, setLeaveModalVisible] = useState(false);
  const [timetableModalVisible, setTimetableModalVisible] = useState(false);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const loadData = useCallback(async () => {
    try {
      const [data, gradeLevels, noticesRes, instRes, assignRes, attSummary] = await Promise.all([
        getStudentData().catch(() => null),
        getGradeLevels().catch(() => []),
        getParentNotices().catch(() => []),
        getInstitutions().catch(() => []),
        getAssignments().catch(() => []),
        getStudentAttendanceSummary().catch(() => ({ summary: null, records: [] })),
      ]);

      const inst = Array.isArray(instRes) && instRes.length > 0 ? instRes[0] : null;
      if (inst) setInstitution(inst);

      if (data) {
        setStudentData({
          name: data.name || "Student User",
          rollNo: data.rollNo || data.roll || "",
          department: data.department || "",
          semester: data.semester || "",
          grade: data.grade || "",
          cgpa: data.cgpa != null ? String(data.cgpa) : "",
          dueFees: data.fees?.due != null ? `₹ ${Number(data.fees.due).toLocaleString("en-IN")}` : "",
          attendance:
            attSummary?.summary ||
            (attSummary?.records && attSummary.records.length > 0
              ? data.attendance || {}
              : {}),
          nextExam: data.nextExam || {},
          library: data.library || {},
          schedule: data.schedule || [],
          subjects: data.subjects || [],
          gradeLevels: gradeLevels || [],
          bloodGroup: data.bloodGroup || "—",
          batch: data.batch || "—",
          dob: data.dob || data.dateOfBirth || data.birthDate || "—",
        });
      }

      if (Array.isArray(assignRes) && assignRes.length > 0) {
        setAssignments(
          assignRes.slice(0, 5).map((a, i) => ({
            id: a.id || a._id || i,
            title: a.title || a.subject || "Assignment",
            due: a.dueDate || a.due || "",
            color: ["#EC4899", "#F59E0B", "#10B981", "#3B82F6", "#8B5CF6"][i % 5],
            status:
              a.status === "Submitted" || a.status === "submitted"
                ? "submitted"
                : a.status === "in_progress" || a.status === "Working"
                ? "in_progress"
                : "pending",
          }))
        );
      } else {
        setAssignments([]);
      }

      if (Array.isArray(noticesRes)) {
        const validNotices = noticesRes.filter(
          (n) =>
            n &&
            (Boolean(n.title && typeof n.title === "string" && n.title.trim()) ||
              Boolean(n.content && typeof n.content === "string" && n.content.trim()) ||
              Boolean(n.description && typeof n.description === "string" && n.description.trim()))
        );
        setNotices(validNotices.slice(0, 3));
      } else {
        setNotices([]);
      }
    } catch (err) {
      console.log("Error loading student dashboard data:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useRefreshOnForeground(loadData);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const openModal = (type) => setVisibleModal(type);
  const closeModal = () => setVisibleModal(null);

  const animateModal = (setter, visible) => {
    if (visible) {
      setter(true);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => setter(false));
    }
  };

  const handleShareIdCard = async () => {
    try {
      await shareStudentIdCardPdf({ student: studentData });
      showToast("Official Student ID Pass PDF generated!", "success");
    } catch (_err) {
      showToast("Could not generate ID Pass PDF", "error");
    }
  };

  // Attendance string formatter
  const attendanceVal =
    typeof studentData.attendance === "object"
      ? studentData.attendance?.percentage || ""
      : studentData.attendance || "";

  // ── Live attendance analytics (computed, never hardcoded) ──────────────────
  const attObj = typeof studentData.attendance === "object" ? studentData.attendance : {};
  const attPctNum = Number(String(attObj.percentage || attObj || "").replace(/[^0-9.]/g, "")) || 0;
  const attendedCount = Number(attObj.attendedClasses) || 0;
  const totalCount = Number(attObj.totalClasses) || 0;
  const minAttPct =
    Number(String(institution?.minAttendancePercent || "75").replace(/[^0-9.]/g, "")) || 75;
  const minAttFrac = minAttPct / 100;

  let bufferLeaves = 0;
  if (attendedCount > 0 && totalCount > 0) {
    const skippable = Math.floor((attendedCount - minAttFrac * totalCount) / minAttFrac);
    bufferLeaves = skippable > 0 ? skippable : 0;
  }

  const attZone =
    attPctNum >= 85
      ? "Excellent Standing"
      : attPctNum >= minAttPct
      ? "Safe Zone"
      : attPctNum > 0
      ? "At Risk"
      : attObj.status || "";
  const zoneColor = attPctNum > 0 && attPctNum < minAttPct ? "#EF4444" : "#10B981";
  const hasBufferStats = attendedCount > 0 && totalCount > 0;
  const belowThreshold = attPctNum > 0 && attPctNum < minAttPct;
  const hasAttendanceData = attPctNum > 0 || hasBufferStats;

  return (
    <View style={[styles.container, { backgroundColor: colors.primaryBackground }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primaryAccent]}
            tintColor={colors.primaryAccent}
            progressBackgroundColor={colors.cardBackground}
          />
        }
      >
        {isLoading ? (
          <SkeletonScreenLoader showProfile showKPIs listCount={4} />
        ) : (
          <>
            {/* ========================================================================= */}
            {/* 1. STUDENT IDENTITY HERO CARD                                             */}
            {/* ========================================================================= */}
            <View style={[styles.studentProfileCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
              <View style={styles.studentHeaderRow}>
                <View style={[styles.studentAvatar, { backgroundColor: colors.primaryAccent + "20" }]}>
                  <Icon name="school" size={30} color={colors.primaryAccent} />
                </View>

                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.studentGreeting, { color: colors.secondaryText }]}>Welcome back,</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <Text style={[styles.studentName, { color: colors.primaryText }]} numberOfLines={1}>
                      {studentData.name}
                    </Text>
                    {!!studentData.nickname && (
                      <View style={[styles.nicknameHeroBadge, { backgroundColor: "#F59E0B18", borderColor: "#F59E0B44" }]}>
                        <Icon name="tag-outline" size={10} color="#D97706" />
                        <Text style={[styles.nicknameHeroBadgeText, { color: "#D97706" }]}>
                          {studentData.nickname}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.studentMetaRow}>
                    <View style={[styles.rollBadge, { backgroundColor: colors.primaryAccent + "18" }]}>
                      <Text style={[styles.rollBadgeText, { color: colors.primaryAccent }]}>
                        {studentData.rollNo}
                      </Text>
                    </View>
                    <Text style={[styles.studentMetaText, { color: colors.secondaryText }]}>
                      {studentData.semester}
                    </Text>
                  </View>
                </View>

                {/* Digital ID Button */}
                <TouchableOpacity
                  style={[styles.idCardBtn, { backgroundColor: colors.primaryAccent }]}
                  onPress={() => setIdCardModalVisible(true)}
                  activeOpacity={0.85}
                >
                  <Icon name="card-account-details-outline" size={18} color="#fff" />
                  <Text style={styles.idCardBtnText}>ID Card</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* ========================================================================= */}
            {/* 2. ACADEMIC SCOREBOARD & ATTENDANCE SAFE ZONE                             */}
            {/* ========================================================================= */}
            <View style={styles.kpiRow}>
              {/* CGPA */}
              <TouchableOpacity
                style={[styles.kpiBox, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
                activeOpacity={0.8}
                onPress={() => animateModal(setGradeModalVisible, true)}
              >
                <View style={[styles.kpiIconWrap, { backgroundColor: "#3B82F618" }]}>
                  <Icon name="certificate-outline" size={20} color="#3B82F6" />
                </View>
                <Text style={[styles.kpiValue, { color: "#3B82F6" }]}>{studentData.cgpa}</Text>
                <Text style={[styles.kpiLabel, { color: colors.primaryText }]}>Overall CGPA</Text>
                <Text style={[styles.kpiHint, { color: colors.secondaryText }]}>Tap for Grades</Text>
              </TouchableOpacity>

              {/* Grade Scale */}
              <TouchableOpacity
                style={[styles.kpiBox, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
                activeOpacity={0.8}
                onPress={() => animateModal(setGradeInfoVisible, true)}
              >
                <View style={[styles.kpiIconWrap, { backgroundColor: "#10B98118" }]}>
                  <Icon name="star-outline" size={20} color="#10B981" />
                </View>
                <Text style={[styles.kpiValue, { color: "#10B981" }]}>{studentData.grade}</Text>
                <Text style={[styles.kpiLabel, { color: colors.primaryText }]}>Current Grade</Text>
                <Text style={[styles.kpiHint, { color: colors.secondaryText }]}>Grade Scale</Text>
              </TouchableOpacity>

              {/* Attendance */}
              <TouchableOpacity
                style={[styles.kpiBox, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
                activeOpacity={0.8}
                onPress={() => openModal("attendance")}
              >
                <View style={[styles.kpiIconWrap, { backgroundColor: "#8B5CF618" }]}>
                  <Icon name="account-check-outline" size={20} color="#8B5CF6" />
                </View>
                <Text style={[styles.kpiValue, { color: "#8B5CF6" }]}>{hasAttendanceData ? attendanceVal : "—"}</Text>
                <Text style={[styles.kpiLabel, { color: colors.primaryText }]}>Attendance</Text>
                <Text style={[styles.kpiHint, { color: hasAttendanceData ? zoneColor : colors.secondaryText, fontWeight: "700" }]}>
                  {hasAttendanceData ? attZone : "No attendance recorded"}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Attendance Buffer Banner */}
            <View
              style={[
                styles.bufferBanner,
                !hasAttendanceData
                  ? { backgroundColor: colors.primaryBackground, borderColor: colors.divider }
                  : belowThreshold
                  ? { backgroundColor: "#EF444414", borderColor: "#EF444430" }
                  : { backgroundColor: "#10B98114", borderColor: "#10B98130" },
              ]}
            >
              {hasAttendanceData ? (
                belowThreshold ? (
                  <Icon name="alert-circle" size={18} color="#EF4444" />
                ) : (
                  <Icon name="shield-check" size={18} color="#10B981" />
                )
              ) : (
                <Icon name="calendar-blank-outline" size={18} color={colors.secondaryText} />
              )}
              <Text style={[styles.bufferBannerText, { color: colors.primaryText }]}>
                {!hasAttendanceData ? (
                  <>
                    No attendance data is recorded!! Records will appear here once classes are marked
                    against a <Text style={{ fontWeight: "800" }}>{minAttPct}%</Text> requirement.
                  </>
                ) : attPctNum > 0 && !hasBufferStats ? (
                  <>
                    Attendance is{" "}
                    <Text style={{ fontWeight: "800", color: zoneColor }}>{attendanceVal}</Text> · keep attending all
                    classes to stay above the <Text style={{ fontWeight: "800" }}>{minAttPct}%</Text> requirement.
                  </>
                ) : hasBufferStats && belowThreshold ? (
                  <>
                    Attendance is below the{" "}
                    <Text style={{ fontWeight: "800", color: "#EF4444" }}>{minAttPct}%</Text> requirement — attend every
                    class to recover.
                  </>
                ) : (
                  <>
                    Attendance Buffer: You have{" "}
                    <Text style={{ fontWeight: "800", color: "#10B981" }}>{bufferLeaves} buffer leaves</Text> before
                    reaching the <Text style={{ fontWeight: "800" }}>{minAttPct}%</Text> limit.
                  </>
                )}
              </Text>
            </View>

            {/* ========================================================================= */}
            {/* 3. TODAY'S LIVE LECTURE SCHEDULE TRACKER                                  */}
            {/* ========================================================================= */}
            <View style={styles.sectionHeaderRow}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Icon name="clock-outline" size={18} color={colors.primaryAccent} />
                <Text style={[styles.sectionTitle, { color: colors.primaryText }]}>{"Today's Schedule"}</Text>
              </View>
              <TouchableOpacity onPress={() => setTimetableModalVisible(true)}>
                <Text style={[styles.sectionActionText, { color: colors.primaryAccent }]}>Full Timetable →</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.liveClassCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
              onPress={() => setTimetableModalVisible(true)}
              activeOpacity={0.85}
            >
              <View style={styles.liveClassTop}>
                <View style={[styles.liveBadge, { backgroundColor: "#10B98120" }]}>
                  <View style={[styles.liveDot, { backgroundColor: "#10B981" }]} />
                  <Text style={[styles.liveBadgeText, { color: "#10B981" }]}>
                    UPCOMING · {studentData.schedule?.[0]?.time || "—"}
                  </Text>
                </View>
                <View style={[styles.roomPill, { backgroundColor: colors.primaryAccent + "18" }]}>
                  <Text style={[styles.roomPillText, { color: colors.primaryAccent }]}>
                    {studentData.schedule?.[0]?.room ? `Room ${studentData.schedule[0].room}` : "—"}
                  </Text>
                </View>
              </View>

              <Text style={[styles.liveSubjectTitle, { color: colors.primaryText }]}>
                {studentData.schedule?.[0]?.subject || studentData.subjects?.[0]?.name || "No upcoming class"}
              </Text>
              <View style={styles.liveFacultyRow}>
                <Icon name="account-tie-outline" size={16} color={colors.secondaryText} />
                <Text style={[styles.liveFacultyText, { color: colors.secondaryText }]}>
                  {studentData.schedule?.[0]?.faculty || studentData.subjects?.[0]?.faculty || "—"}
                </Text>
              </View>
            </TouchableOpacity>

            {/* ========================================================================= */}
            {/* 4. STUDENT QUICK ACTIONS GRID                                             */}
            {/* ========================================================================= */}
            <View style={[styles.sectionHeaderRow, { marginTop: 18 }]}>
              <Text style={[styles.sectionTitle, { color: colors.primaryText }]}>Student Services & Modules</Text>
            </View>

            <View style={styles.actionGrid}>
              <TouchableOpacity
                style={[styles.actionGridItem, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
                onPress={() => setTimetableModalVisible(true)}
                activeOpacity={0.8}
              >
                <View style={[styles.actionIconWrap, { backgroundColor: "#3B82F618" }]}>
                  <Icon name="calendar-month" size={22} color="#3B82F6" />
                </View>
                <Text style={[styles.actionItemTitle, { color: colors.primaryText }]}>Timetable</Text>
                <Text style={[styles.actionItemSub, { color: colors.secondaryText }]}>Weekly View</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionGridItem, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
                onPress={() => setLeaveModalVisible(true)}
                activeOpacity={0.8}
              >
                <View style={[styles.actionIconWrap, { backgroundColor: "#10B98118" }]}>
                  <Icon name="file-document-edit-outline" size={22} color="#10B981" />
                </View>
                <Text style={[styles.actionItemTitle, { color: colors.primaryText }]}>Apply OD / Leave</Text>
                <Text style={[styles.actionItemSub, { color: colors.secondaryText }]}>Submit to HOD</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionGridItem, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
                onPress={() => openModal("exam")}
                activeOpacity={0.8}
              >
                <View style={[styles.actionIconWrap, { backgroundColor: "#F59E0B18" }]}>
                  <Icon name="calendar-check" size={22} color="#F59E0B" />
                </View>
                <Text style={[styles.actionItemTitle, { color: colors.primaryText }]}>Exams & Halls</Text>
                <Text style={[styles.actionItemSub, { color: colors.secondaryText }]}>
                  {studentData.nextExam?.subject ? "Schedule Active" : "No Exams"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionGridItem, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
                onPress={() => openModal("fees")}
                activeOpacity={0.8}
              >
                <View style={[styles.actionIconWrap, { backgroundColor: "#EF444418" }]}>
                  <Icon name="cash-multiple" size={22} color="#EF4444" />
                </View>
                <Text style={[styles.actionItemTitle, { color: colors.primaryText }]}>Fee Invoices</Text>
                <Text style={[styles.actionItemSub, { color: colors.secondaryText }]}>{studentData.dueFees || "Paid"}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionGridItem, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
                onPress={() => openModal("library")}
                activeOpacity={0.8}
              >
                <View style={[styles.actionIconWrap, { backgroundColor: "#8B5CF618" }]}>
                  <Icon name="book-open-page-variant" size={22} color="#8B5CF6" />
                </View>
                <Text style={[styles.actionItemTitle, { color: colors.primaryText }]}>Library</Text>
                <Text style={[styles.actionItemSub, { color: colors.secondaryText }]}>
                  {studentData.library?.books ? `${studentData.library.books} Issued` : "E-Library"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionGridItem, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
                onPress={() => setIdCardModalVisible(true)}
                activeOpacity={0.8}
              >
                <View style={[styles.actionIconWrap, { backgroundColor: "#EC489918" }]}>
                  <Icon name="badge-account-outline" size={22} color="#EC4899" />
                </View>
                <Text style={[styles.actionItemTitle, { color: colors.primaryText }]}>Digital ID</Text>
                <Text style={[styles.actionItemSub, { color: colors.secondaryText }]}>Smart Pass</Text>
              </TouchableOpacity>
            </View>

            {/* ========================================================================= */}
            {/* 5. CONTINUOUS ASSESSMENT & DEADLINES TRACKER                              */}
            {/* ========================================================================= */}
            <View style={[styles.sectionHeaderRow, { marginTop: 18 }]}>
              <Text style={[styles.sectionTitle, { color: colors.primaryText }]}>Assignments & Deadlines</Text>
            </View>

            <View style={styles.deadlinesList}>
              {assignments.map((item, idx) => (
                <View
                  key={item.id || idx}
                  style={[
                    styles.deadlineItem,
                    {
                      backgroundColor: colors.cardBackground,
                      borderColor: colors.divider,
                      borderLeftColor: item.color,
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.deadlineTitle, { color: colors.primaryText }]}>{item.title}</Text>
                    <Text style={[styles.deadlineDue, { color: colors.secondaryText }]}>📅 {item.due}</Text>
                  </View>
                  <View style={[styles.deadlineBadge, { backgroundColor: item.color + "18" }]}>
                    <Text style={[styles.deadlineBadgeText, { color: item.color }]}>
                      {item.status === "submitted" ? "✓ Done" : item.status === "in_progress" ? "Working" : "Urgent"}
                    </Text>
                  </View>
                </View>
              ))}
              {assignments.length === 0 && (
                <View style={[styles.emptyNoticeBox, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
                  <Icon name="clipboard-check-outline" size={36} color={colors.secondaryText} />
                  <Text style={[styles.emptyNoticeTitle, { color: colors.primaryText }]}>No deadlines</Text>
                  <Text style={[styles.emptyNoticeSub, { color: colors.secondaryText }]}>No upcoming assignments or deadlines.</Text>
                </View>
              )}
            </View>

            {/* ========================================================================= */}
            {/* 6. CAMPUS CIRCULARS & NOTICES FEED                                       */}
            {/* ========================================================================= */}
            <View style={[styles.sectionHeaderRow, { marginTop: 18 }]}>
              <Text style={[styles.sectionTitle, { color: colors.primaryText }]}>Campus Circulars</Text>
            </View>

            {notices.filter((n) => n && (n.title?.trim?.() || n.content?.trim?.() || n.description?.trim?.())).length > 0 ? (
              <View style={styles.noticesList}>
                {notices
                  .filter((n) => n && (n.title?.trim?.() || n.content?.trim?.() || n.description?.trim?.()))
                  .map((n, i) => (
                    <View
                      key={n.id || n._id || i}
                      style={[styles.noticeCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
                    >
                      <View style={styles.noticeTopRow}>
                        <View style={[styles.noticeTag, { backgroundColor: colors.primaryAccent + "18" }]}>
                          <Text style={[styles.noticeTagText, { color: colors.primaryAccent }]}>
                            {n.category || "Notice"}
                          </Text>
                        </View>
                        <Text style={[styles.noticeDate, { color: colors.secondaryText }]}>
                          {n.date || "Today"}
                        </Text>
                      </View>
                      <Text style={[styles.noticeTitle, { color: colors.primaryText }]}>{n.title || "Campus Notice"}</Text>
                      <Text style={[styles.noticeContent, { color: colors.secondaryText }]} numberOfLines={2}>
                        {n.content || n.description || ""}
                      </Text>
                    </View>
                  ))}
              </View>
            ) : (
              <View style={[styles.emptyNoticeBox, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
                <Icon name="bell-sleep-outline" size={36} color={colors.secondaryText} />
                <Text style={[styles.emptyNoticeTitle, { color: colors.primaryText }]}>
                  No new notices came
                </Text>
                <Text style={[styles.emptyNoticeSub, { color: colors.secondaryText }]}>
                  All campus announcements and circulars are up to date.
                </Text>
              </View>
            )}
          </>
        )}

        <View style={{ height: 100 }} />

        {/* Existing Built-In Modals */}
        <FeesModal visible={visibleModal === "fees"} onClose={closeModal} />
        <ExamModal visible={visibleModal === "exam"} onClose={closeModal} />
        <AttendanceModal visible={visibleModal === "attendance"} onClose={closeModal} />
        <LibraryModal visible={visibleModal === "library"} onClose={closeModal} />
        <FullTimeTable visible={timetableModalVisible} onClose={() => setTimetableModalVisible(false)} />
      </ScrollView>

      {/* ========================================================================= */}
      {/* SUB-MODAL 1: SUBJECT GRADES BREAKDOWN                                     */}
      {/* ========================================================================= */}
      <Modal visible={gradeModalVisible} transparent animationType="none" onRequestClose={() => animateModal(setGradeModalVisible, false)}>
        <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
          <View style={[styles.modalBox, { backgroundColor: colors.cardBackground }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Icon name="school-outline" size={22} color={colors.primaryAccent} />
                <Text style={[styles.modalTitle, { color: colors.primaryText }]}>Subject-wise Grades</Text>
              </View>
              <TouchableOpacity onPress={() => animateModal(setGradeModalVisible, false)}>
                <Icon name="close-circle-outline" size={22} color={colors.secondaryText} />
              </TouchableOpacity>
            </View>

            {(() => {
              const validSubjects = (studentData.subjects || []).filter(
                (s) => s && typeof s.name === "string" && s.name.trim().length > 0
              );

              if (validSubjects.length === 0) {
                return (
                  <View style={{ paddingVertical: 20, alignItems: "center" }}>
                    <Text style={{ color: colors.secondaryText, fontSize: 13, fontWeight: "600" }}>
                      No subject records available
                    </Text>
                  </View>
                );
              }

              return validSubjects.map((s, i) => {
                const isLast = i === validSubjects.length - 1;
                return (
                  <View
                    key={s.code || s.name || i}
                    style={[
                      styles.subjectRow,
                      {
                        borderBottomColor: colors.divider,
                        borderBottomWidth: isLast ? 0 : 1,
                      },
                    ]}
                  >
                    <Text style={[styles.subjectName, { color: colors.primaryText }]}>{s.name}</Text>
                    <Text style={[styles.subjectMarks, { color: colors.secondaryText }]}>{s.marks != null ? `${s.marks}%` : "—"}</Text>
                    <Text style={[styles.subjectGrade, { color: colors.primaryAccent }]}>{s.grade || "—"}</Text>
                  </View>
                );
              });
            })()}
          </View>
        </Animated.View>
      </Modal>

      {/* ========================================================================= */}
      {/* SUB-MODAL 2: GRADE LEVELS SCALE                                           */}
      {/* ========================================================================= */}
      <Modal visible={gradeInfoVisible} transparent animationType="none" onRequestClose={() => animateModal(setGradeInfoVisible, false)}>
        <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
          <View style={[styles.modalBox, { backgroundColor: colors.cardBackground }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Icon name="star-circle-outline" size={22} color={colors.primaryAccent} />
                <Text style={[styles.modalTitle, { color: colors.primaryText }]}>Grade Level Scale</Text>
              </View>
              <TouchableOpacity onPress={() => animateModal(setGradeInfoVisible, false)}>
                <Icon name="close-circle-outline" size={22} color={colors.secondaryText} />
              </TouchableOpacity>
            </View>

            {/* Structured Table Column Header */}
            <View
              style={[
                styles.gradeTableHeader,
                { backgroundColor: colors.primaryAccent + "14", borderColor: colors.divider },
              ]}
            >
              <Text style={[styles.gradeColHeader, { color: colors.primaryAccent, flex: 1.1 }]}>GRADE</Text>
              <Text style={[styles.gradeColHeader, { color: colors.primaryAccent, flex: 1.4, textAlign: "center" }]}>MARKS RANGE</Text>
              <Text style={[styles.gradeColHeader, { color: colors.primaryAccent, flex: 1.8, textAlign: "right" }]}>MEANING</Text>
            </View>

            {/* Strictly Valid Non-Empty Grade Items without Trailing Dividers */}
            {(() => {
              const defaultScale = [
                { grade: "O", range: "90 - 100", meaning: "Outstanding" },
                { grade: "A+", range: "80 - 89", meaning: "Excellent" },
                { grade: "A", range: "70 - 79", meaning: "Very Good" },
                { grade: "B+", range: "60 - 69", meaning: "Good" },
                { grade: "B", range: "50 - 59", meaning: "Above Average" },
                { grade: "C", range: "40 - 49", meaning: "Average" },
                { grade: "RA", range: "< 40", meaning: "Reappearance" },
              ];

              const validGrades = (studentData.gradeLevels || []).filter(
                (g) => g && typeof g.grade === "string" && g.grade.trim().length > 0
              );

              const displayList = validGrades.length > 0 ? validGrades : defaultScale;

              return displayList.map((g, i) => {
                const isLast = i === displayList.length - 1;
                const gradeStr = String(g.grade || "").trim();
                const badgeColor =
                  gradeStr === "O"
                    ? "#10B981"
                    : gradeStr === "A+" || gradeStr === "A"
                    ? "#3B82F6"
                    : gradeStr === "B+" || gradeStr === "B"
                    ? "#F59E0B"
                    : "#EF4444";

                return (
                  <View
                    key={g.grade || i}
                    style={[
                      styles.subjectRow,
                      {
                        borderBottomColor: colors.divider,
                        borderBottomWidth: isLast ? 0 : 1,
                        paddingVertical: 9,
                      },
                    ]}
                  >
                    <View style={{ flex: 1.1, flexDirection: "row", alignItems: "center" }}>
                      <View style={[styles.gradeBadgePill, { backgroundColor: badgeColor + "18" }]}>
                        <Text style={[styles.gradeBadgePillText, { color: badgeColor }]}>{gradeStr}</Text>
                      </View>
                    </View>
                    <Text style={[styles.subjectMarks, { color: colors.secondaryText, flex: 1.4 }]}>
                      {g.range || "—"}
                    </Text>
                    <Text style={[styles.subjectGrade, { color: colors.primaryText, flex: 1.8, fontSize: 13 }]}>
                      {g.meaning || "—"}
                    </Text>
                  </View>
                );
              });
            })()}
          </View>
        </Animated.View>
      </Modal>

      {/* ========================================================================= */}
      {/* SUB-MODAL 3: DIGITAL STUDENT ID CARD                                      */}
      {/* ========================================================================= */}
      <Modal visible={idCardModalVisible} transparent animationType="slide" onRequestClose={() => setIdCardModalVisible(false)}>
        <View style={styles.overlay}>
          <View style={[styles.idCardBox, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
            {/* ID Card Top Band */}
            <View style={[styles.idCardBand, { backgroundColor: colors.primaryAccent }]}>
              <View style={styles.idCardBandContent}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.idCardInstitution} numberOfLines={1}>
                    {(institution?.shortName || institution?.name || "EDUNEX AUTONOMOUS CAMPUS").toUpperCase()}
                  </Text>
                  <Text style={styles.idCardType}>STUDENT DIGITAL IDENTITY PASS</Text>
                </View>
                <View style={styles.idCardChip}>
                  <Icon name="integrated-circuit-chip" size={26} color="#FDE047" />
                </View>
              </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.idCardBody}>
              {/* Student Identification Row */}
              <View style={styles.idCardMainRow}>
                <View style={[styles.idCardPhotoCircle, { backgroundColor: colors.primaryAccent + "22", borderColor: colors.primaryAccent }]}>
                  <Icon name="account-school" size={38} color={colors.primaryAccent} />
                </View>
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={[styles.idCardStudentName, { color: colors.primaryText }]}>{studentData.name}</Text>
                  <Text style={[styles.idCardRoll, { color: colors.primaryAccent }]}>REG ID: {studentData.rollNo}</Text>
                  <Text style={[styles.idCardDept, { color: colors.secondaryText }]} numberOfLines={2}>
                    {formatDeptName(studentData.department, "compact")}
                  </Text>
                </View>
              </View>

              {/* Details Matrix 1: DOB & Blood Group */}
              <View style={[styles.idDetailsGrid, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                <View style={styles.idDetailCell}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Icon name="calendar-account" size={13} color={colors.primaryAccent} />
                    <Text style={[styles.idCellLabel, { color: colors.secondaryText }]}>Date of Birth (DOB)</Text>
                  </View>
                  <Text style={[styles.idCellValue, { color: colors.primaryText }]}>{studentData.dob || "—"}</Text>
                </View>
                <View style={[styles.idCellDivider, { backgroundColor: colors.divider }]} />
                <View style={styles.idDetailCell}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Icon name="water-percent" size={13} color="#EF4444" />
                    <Text style={[styles.idCellLabel, { color: colors.secondaryText }]}>Blood Group</Text>
                  </View>
                  <Text style={[styles.idCellValue, { color: "#EF4444" }]}>{studentData.bloodGroup || "—"}</Text>
                </View>
              </View>

              {/* Details Matrix 2: Semester & Academic Batch */}
              <View style={[styles.idDetailsGrid, { backgroundColor: colors.primaryBackground, borderColor: colors.divider, marginTop: 8 }]}>
                <View style={styles.idDetailCell}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Icon name="book-education-outline" size={13} color={colors.primaryAccent} />
                    <Text style={[styles.idCellLabel, { color: colors.secondaryText }]}>Semester</Text>
                  </View>
                  <Text style={[styles.idCellValue, { color: colors.primaryText }]}>{studentData.semester || "—"}</Text>
                </View>
                <View style={[styles.idCellDivider, { backgroundColor: colors.divider }]} />
                <View style={styles.idDetailCell}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Icon name="calendar-check-outline" size={13} color="#10B981" />
                    <Text style={[styles.idCellLabel, { color: colors.secondaryText }]}>Academic Batch</Text>
                  </View>
                  <Text style={[styles.idCellValue, { color: "#10B981" }]}>{studentData.batch || "—"}</Text>
                </View>
              </View>

              {/* Dynamic QR Code */}
              <View style={[styles.qrCodeWrapper, { backgroundColor: "#FFFFFF", borderColor: colors.divider }]}>
                <QRCode
                  value={`EDUNEX:STUDENT|ROLL:${studentData.rollNo || "—"}|NAME:${studentData.name || "—"}|DOB:${studentData.dob || "—"}|BLOOD:${studentData.bloodGroup || "—"}|BATCH:${studentData.batch || "—"}`}
                  size={120}
                  color="#0F172A"
                  backgroundColor="#FFFFFF"
                />
                <Text style={styles.qrCodeSub}>Official Turnstile & Examination QR</Text>
              </View>

              {/* Security Seal */}
              <View style={styles.securitySealRow}>
                <Icon name="shield-check" size={15} color="#10B981" />
                <Text style={[styles.securitySealText, { color: colors.secondaryText }]}>
                  Biometrically Linked · Authorized by University Registrar
                </Text>
              </View>
            </ScrollView>

            {/* Action Buttons */}
            <View style={[styles.idCardActionRow, { borderTopColor: colors.divider }]}>
              <TouchableOpacity
                style={[styles.shareIdBtn, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}
                onPress={handleShareIdCard}
                activeOpacity={0.8}
              >
                <Icon name="share-variant-outline" size={17} color={colors.primaryAccent} />
                <Text style={[styles.shareIdBtnText, { color: colors.primaryAccent }]}>Share Pass</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.closeIdBtn, { backgroundColor: colors.primaryAccent }]}
                onPress={() => setIdCardModalVisible(false)}
                activeOpacity={0.85}
              >
                <Text style={styles.closeIdBtnText}>Close Pass</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* SUB-MODAL 4: COLLEGE LEAVE & GATE PASS APPLICATION SUITE                  */}
      {/* ========================================================================= */}
      <LeaveFormModal visible={leaveModalVisible} onClose={() => setLeaveModalVisible(false)} />
    </View>
  );
}

const getStyles = (colors) =>
  StyleSheet.create({
    container: { flex: 1 },
    scrollView: { flex: 1 },
    contentContainer: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 80 },

    /* Student Profile Hero Card */
    studentProfileCard: {
      borderRadius: 18,
      padding: 16,
      marginBottom: 14,
      borderWidth: 1,
      elevation: 2,
    },
    studentHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    studentAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      justifyContent: "center",
      alignItems: "center",
    },
    studentGreeting: {
      fontSize: 11.5,
      fontWeight: "600",
    },
    studentName: {
      fontSize: 17,
      fontWeight: "900",
      letterSpacing: -0.3,
    },
    nicknameHeroBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: 6,
      borderWidth: 1,
    },
    nicknameHeroBadgeText: {
      fontSize: 10,
      fontWeight: "800",
    },
    studentMetaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: 2,
    },
    rollBadge: {
      paddingVertical: 2,
      paddingHorizontal: 6,
      borderRadius: 5,
    },
    rollBadgeText: {
      fontSize: 10.5,
      fontWeight: "800",
    },
    studentMetaText: {
      fontSize: 11.5,
      fontWeight: "600",
    },
    idCardBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingVertical: 7,
      paddingHorizontal: 10,
      borderRadius: 12,
    },
    idCardBtnText: {
      color: "#fff",
      fontSize: 11.5,
      fontWeight: "800",
    },

    /* Scoreboard KPIs */
    kpiRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 8,
      marginBottom: 10,
    },
    kpiBox: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 12,
      borderRadius: 14,
      borderWidth: 1,
      elevation: 1,
    },
    kpiIconWrap: {
      width: 32,
      height: 32,
      borderRadius: 16,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 4,
    },
    kpiValue: {
      fontSize: 19,
      fontWeight: "900",
      marginBottom: 1,
    },
    kpiLabel: {
      fontSize: 11,
      fontWeight: "700",
    },
    kpiHint: {
      fontSize: 10,
      marginTop: 2,
    },

    /* Attendance Buffer Banner */
    bufferBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 9,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: 1,
      marginBottom: 16,
    },
    bufferBannerText: {
      fontSize: 11.5,
      flex: 1,
      lineHeight: 16,
      fontWeight: "500",
    },

    /* Section Headers */
    sectionHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 10,
    },
    sectionTitle: {
      fontSize: 14.5,
      fontWeight: "800",
      letterSpacing: -0.2,
    },
    sectionActionText: {
      fontSize: 12,
      fontWeight: "800",
    },

    /* Live Class Card */
    liveClassCard: {
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      elevation: 2,
      marginBottom: 12,
    },
    liveClassTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 6,
    },
    liveBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingVertical: 3,
      paddingHorizontal: 7,
      borderRadius: 6,
    },
    liveDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    liveBadgeText: {
      fontSize: 10,
      fontWeight: "800",
    },
    roomPill: {
      paddingVertical: 2,
      paddingHorizontal: 7,
      borderRadius: 6,
    },
    roomPillText: {
      fontSize: 10.5,
      fontWeight: "800",
    },
    liveSubjectTitle: {
      fontSize: 15,
      fontWeight: "800",
      marginBottom: 4,
    },
    liveFacultyRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
    },
    liveFacultyText: {
      fontSize: 12,
      fontWeight: "500",
    },

    /* Action Grid */
    actionGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      gap: 8,
      marginBottom: 12,
    },
    actionGridItem: {
      width: "31.5%",
      borderRadius: 14,
      padding: 12,
      borderWidth: 1,
      alignItems: "center",
      elevation: 1,
    },
    actionIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 6,
    },
    actionItemTitle: {
      fontSize: 11.5,
      fontWeight: "800",
      textAlign: "center",
    },
    actionItemSub: {
      fontSize: 10,
      fontWeight: "500",
      textAlign: "center",
      marginTop: 2,
    },

    /* Deadlines List */
    deadlinesList: {
      gap: 8,
      marginBottom: 12,
    },
    deadlineItem: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderLeftWidth: 5,
      elevation: 1,
    },
    deadlineTitle: {
      fontSize: 13,
      fontWeight: "700",
    },
    deadlineDue: {
      fontSize: 11.5,
      fontWeight: "500",
      marginTop: 2,
    },
    deadlineBadge: {
      paddingVertical: 3,
      paddingHorizontal: 8,
      borderRadius: 6,
      marginLeft: 8,
    },
    deadlineBadgeText: {
      fontSize: 10.5,
      fontWeight: "800",
    },

    /* Notices List */
    noticesList: {
      gap: 8,
    },
    noticeCard: {
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      elevation: 1,
    },
    noticeTopRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 4,
    },
    noticeTag: {
      paddingVertical: 2,
      paddingHorizontal: 6,
      borderRadius: 5,
    },
    noticeTagText: {
      fontSize: 10,
      fontWeight: "800",
    },
    noticeDate: {
      fontSize: 11,
      fontWeight: "500",
    },
    noticeTitle: {
      fontSize: 13.5,
      fontWeight: "700",
      marginBottom: 2,
    },
    noticeContent: {
      fontSize: 11.5,
      lineHeight: 16,
    },
    emptyNoticeBox: {
      borderRadius: 14,
      borderWidth: 1,
      paddingVertical: 22,
      paddingHorizontal: 16,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 10,
    },
    emptyNoticeTitle: {
      fontSize: 14,
      fontWeight: "800",
      marginTop: 8,
    },
    emptyNoticeSub: {
      fontSize: 12,
      textAlign: "center",
      marginTop: 3,
    },
    overlay: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "rgba(0,0,0,0.6)",
      paddingHorizontal: 16,
    },
    modalBox: {
      width: "100%",
      maxHeight: "84%",
      borderRadius: 22,
      padding: 18,
      elevation: 10,
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 14,
    },
    modalTitle: {
      fontSize: 16,
      fontWeight: "800",
    },
    gradeTableHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 7,
      paddingHorizontal: 10,
      borderRadius: 8,
      borderWidth: 1,
      marginBottom: 6,
    },
    gradeColHeader: {
      fontSize: 10.5,
      fontWeight: "800",
      letterSpacing: 0.5,
    },
    gradeBadgePill: {
      paddingHorizontal: 9,
      paddingVertical: 3,
      borderRadius: 10,
      alignSelf: "flex-start",
    },
    gradeBadgePillText: {
      fontSize: 11.5,
      fontWeight: "900",
      textAlign: "center",
    },
    subjectRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 10,
      borderBottomWidth: 1,
    },
    subjectName: {
      flex: 1.5,
      fontSize: 12.5,
      fontWeight: "600",
    },
    subjectMarks: {
      flex: 1,
      fontSize: 12.5,
      textAlign: "center",
      fontWeight: "600",
    },
    subjectGrade: {
      flex: 1,
      fontSize: 13.5,
      textAlign: "right",
      fontWeight: "800",
    },

    /* Digital ID Card Modal */
    idCardBox: {
      width: "100%",
      maxHeight: "88%",
      borderRadius: 22,
      overflow: "hidden",
      borderWidth: 1,
      elevation: 10,
    },
    idCardBand: {
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    idCardBandContent: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    idCardInstitution: {
      color: "#FFFFFF",
      fontSize: 13,
      fontWeight: "900",
      letterSpacing: 0.5,
    },
    idCardType: {
      color: "rgba(255,255,255,0.85)",
      fontSize: 9.5,
      fontWeight: "700",
      letterSpacing: 0.8,
      marginTop: 2,
    },
    idCardChip: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: "rgba(255,255,255,0.18)",
      justifyContent: "center",
      alignItems: "center",
    },
    idCardBody: {
      padding: 16,
    },
    idCardMainRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 12,
    },
    idCardPhotoCircle: {
      width: 58,
      height: 58,
      borderRadius: 29,
      borderWidth: 2,
      justifyContent: "center",
      alignItems: "center",
    },
    idCardStudentName: {
      fontSize: 15.5,
      fontWeight: "900",
      letterSpacing: -0.2,
    },
    idCardRoll: {
      fontSize: 12,
      fontWeight: "800",
      marginTop: 2,
    },
    idCardDept: {
      fontSize: 11,
      fontWeight: "600",
      marginTop: 2,
    },
    idDetailsGrid: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      borderRadius: 12,
      borderWidth: 1,
      paddingVertical: 9,
      paddingHorizontal: 12,
    },
    idDetailCell: {
      flex: 1,
      alignItems: "flex-start",
    },
    idCellDivider: {
      width: 1,
      height: "80%",
      marginHorizontal: 8,
    },
    idCellLabel: {
      fontSize: 10,
      fontWeight: "600",
    },
    idCellValue: {
      fontSize: 12,
      fontWeight: "800",
      marginTop: 3,
    },
    qrCodeWrapper: {
      alignItems: "center",
      justifyContent: "center",
      padding: 12,
      borderRadius: 14,
      borderWidth: 1,
      marginTop: 12,
      alignSelf: "center",
    },
    qrCodeSub: {
      color: "#475569",
      fontSize: 9,
      fontWeight: "700",
      marginTop: 6,
      textAlign: "center",
    },
    securitySealRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
      marginTop: 10,
      marginBottom: 4,
    },
    securitySealText: {
      fontSize: 9.5,
      fontWeight: "600",
    },
    idCardActionRow: {
      flexDirection: "row",
      gap: 10,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderTopWidth: 1,
    },
    shareIdBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
    },
    shareIdBtnText: {
      fontSize: 12.5,
      fontWeight: "800",
    },
    closeIdBtn: {
      flex: 1,
      paddingVertical: 10,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 12,
    },
    closeIdBtnText: {
      color: "#FFFFFF",
      fontSize: 12.5,
      fontWeight: "800",
    },

    /* Apply Leave Modal Form */
    formLabel: {
      fontSize: 12,
      fontWeight: "700",
      marginBottom: 4,
    },
    leaveTypeRow: {
      flexDirection: "row",
      gap: 8,
      marginBottom: 8,
    },
    leaveTypePill: {
      paddingVertical: 6,
      paddingHorizontal: 14,
      borderRadius: 8,
    },
    leaveTypePillText: {
      fontSize: 12,
      fontWeight: "700",
    },
    modalTextInput: {
      borderWidth: 1,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
      fontSize: 13,
      fontWeight: "600",
    },
    textArea: {
      height: 70,
      textAlignVertical: "top",
    },
    submitLeaveBtn: {
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 14,
    },
    submitLeaveBtnText: {
      color: "#fff",
      fontSize: 13,
      fontWeight: "800",
    },
  });
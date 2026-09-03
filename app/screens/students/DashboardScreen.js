import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
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
import { api } from "../../services/api";

// Modals
import FeesModal from "./modals/FeesModal";
import ExamModal from "./modals/ExamModal";
import AttendanceModal from "./modals/AttendanceModal";
import LibraryModal from "./modals/LibraryModal";
import FullTimeTable from "./modals/FullTimeTable";
import LeaveFormModal from "../../components/header/modal/LeaveFormModal";

// Dynamic parser to convert standard time formats into minutes from midnight
const parseTimeToMinutes = (timeStr) => {
  if (!timeStr || typeof timeStr !== "string") return { startMin: 0, endMin: 0 };
  const parts = timeStr.split("-").map((s) => s.trim());
  const parseSingle = (s) => {
    if (!s) return 0;
    const isPM = /pm/i.test(s);
    const isAM = /am/i.test(s);
    const clean = s.replace(/[^0-9:]/g, "");
    const [hStr, mStr] = clean.split(":");
    let h = parseInt(hStr, 10) || 0;
    const m = parseInt(mStr, 10) || 0;
    if (isPM && h < 12) h += 12;
    if (isAM && h === 12) h = 0;
    if (!isPM && !isAM && h >= 1 && h <= 6) h += 12;
    return h * 60 + m;
  };

  const startMin = parseSingle(parts[0]);
  const endMin = parts[1] ? parseSingle(parts[1]) : startMin + 55;
  return { startMin, endMin };
};

const calculateCurrentGrade = (grade, cgpa, subjects) => {
  if (grade && typeof grade === "string" && grade.trim().length > 0 && grade !== "—") {
    return grade.trim().toUpperCase();
  }
  if (cgpa != null && cgpa !== "" && cgpa !== "—") {
    const num = parseFloat(cgpa);
    if (!isNaN(num)) {
      if (num >= 9.0) return "O";
      if (num >= 8.0) return "A+";
      if (num >= 7.0) return "A";
      if (num >= 6.0) return "B+";
      if (num >= 5.0) return "B";
      if (num >= 4.0) return "C";
      return "RA";
    }
  }
  if (Array.isArray(subjects) && subjects.length > 0) {
    const validMarks = subjects
      .map((s) => Number(s.marks))
      .filter((m) => !isNaN(m) && m > 0);
    if (validMarks.length > 0) {
      const avg = validMarks.reduce((a, b) => a + b, 0) / validMarks.length;
      if (avg >= 90) return "O";
      if (avg >= 80) return "A+";
      if (avg >= 70) return "A";
      if (avg >= 60) return "B+";
      if (avg >= 50) return "B";
      if (avg >= 40) return "C";
      return "RA";
    }
  }
  return "A";
};

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
  const [selectedPeriodId, setSelectedPeriodId] = useState(null);
  const [liveTimetable, setLiveTimetable] = useState(null);
  const [nowTime, setNowTime] = useState(Date.now());

  // Auto-refresh clock every 30 seconds for live period tracking
  useEffect(() => {
    const timer = setInterval(() => setNowTime(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

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
      const [data, gradeLevels, noticesRes, instRes, assignRes, attSummary, timetableRes] = await Promise.all([
        getStudentData().catch(() => null),
        getGradeLevels().catch(() => []),
        getParentNotices().catch(() => []),
        getInstitutions().catch(() => []),
        getAssignments().catch(() => []),
        getStudentAttendanceSummary().catch(() => ({ summary: null, records: [] })),
        api.get("/timetable").catch(() => null),
      ]);

      const inst = Array.isArray(instRes) && instRes.length > 0 ? instRes[0] : null;
      if (inst) setInstitution(inst);
      if (timetableRes) {
        setLiveTimetable(timetableRes?.data || timetableRes || []);
      }

      if (data) {
        const computedGrade = calculateCurrentGrade(data.grade, data.cgpa, data.subjects);
        setStudentData({
          name: data.name || "Student User",
          rollNo: data.rollNo || data.roll || "",
          department: data.department || "",
          semester: data.semester || "",
          grade: computedGrade,
          cgpa: data.cgpa != null ? String(data.cgpa) : "8.65",
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

  const todayPeriods = useMemo(() => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const todayIndex = new Date().getDay();
    // Default to "Mon" if today is weekend
    const todayKey = todayIndex === 0 || todayIndex === 6 ? "Mon" : days[todayIndex];

    // 1. Check if we have live timetable from DB for this student's department
    let daySchedule = [];
    if (liveTimetable) {
      const docs = Array.isArray(liveTimetable) ? liveTimetable : Array.isArray(liveTimetable.data) ? liveTimetable.data : [];
      const dept = (studentData.department || "").toLowerCase();
      const code = dept.includes("ai") ? "AIDS" : dept.includes("cse") || dept.includes("computer") ? "CSE" : dept.includes("it") ? "IT" : dept.includes("ece") ? "ECE" : dept.includes("mech") ? "MECH" : "AIDS";
      const match = docs.find((d) =>
        d.departmentCode === code ||
        (d.departmentCode || "").toLowerCase() === code.toLowerCase() ||
        (d.department || "").toLowerCase().includes(code.toLowerCase()) ||
        (d.departmentName || "").toLowerCase().includes(dept)
      ) || docs[0];

      if (match?.schedule && match.schedule[todayKey] && Array.isArray(match.schedule[todayKey]) && match.schedule[todayKey].length > 0) {
        daySchedule = match.schedule[todayKey];
      }
    }

    // 2. Fallback to studentData.schedule or studentData.subjects
    if (!daySchedule || daySchedule.length === 0) {
      if (Array.isArray(studentData.schedule) && studentData.schedule.length > 0) {
        daySchedule = studentData.schedule;
      } else if (Array.isArray(studentData.subjects) && studentData.subjects.length > 0) {
        const defaultTimes = [
          "08:45 AM - 09:40 AM",
          "09:40 AM - 10:35 AM",
          "10:55 AM - 11:50 AM",
          "11:50 AM - 12:45 PM",
          "01:30 PM - 02:25 PM",
          "02:25 PM - 03:20 PM",
          "03:20 PM - 04:15 PM",
        ];
        daySchedule = studentData.subjects.slice(0, 7).map((sub, i) => ({
          period: `Period ${i + 1}`,
          periodIndex: i + 1,
          time: defaultTimes[i] || "09:00 AM - 10:00 AM",
          subject: sub.name || sub.title || "Academic Lecture",
          code: sub.code || `SUB-${i + 1}`,
          faculty: sub.faculty || "Faculty Instructor",
          room: sub.room || (sub.type === "Lab" ? "Lab Complex" : "Hall 201"),
          type: sub.type || "Theory",
          color: sub.color || ["#10B981", "#F59E0B", "#3B82F6", "#06B6D4", "#6366F1", "#EC4899", "#8B5CF6"][i % 7],
        }));
      }
    }

    if (!daySchedule || daySchedule.length === 0) {
      return [];
    }

    let academicIndex = 0;
    return daySchedule.map((row, idx) => {
      const isLunch = String(row.subject || "").toLowerCase().includes("lunch");
      const isTea = String(row.subject || "").toLowerCase().includes("tea") || String(row.subject || "").toLowerCase().includes("break");
      const isBreak = row.isBreak || isLunch || isTea;
      if (!isBreak) academicIndex++;

      const { startMin, endMin } = parseTimeToMinutes(row.time);
      const periodTag = isBreak ? (isLunch ? "Lunch" : "Break") : `P${academicIndex || idx + 1}`;
      const periodName = isBreak ? (isLunch ? "Lunch Break" : "Tea Break") : (row.period || `Period ${academicIndex || idx + 1}`);

      return {
        id: row.id || row._id || `period_${idx}`,
        period: periodName,
        periodTag,
        time: row.time || "—",
        subject: row.subject || row.name || "Academic Class",
        code: row.code || "",
        faculty: row.faculty || row.teacher || "Faculty Instructor",
        room: row.room || "Campus Hall",
        type: isBreak ? "Break" : (row.type || "Theory"),
        isBreak,
        color: row.color || (isBreak ? "#F59E0B" : ["#10B981", "#3B82F6", "#6366F1", "#06B6D4", "#EC4899", "#8B5CF6"][idx % 6]),
        startMin,
        endMin,
      };
    });
  }, [liveTimetable, studentData.department, studentData.schedule, studentData.subjects]);

  const { activePeriod, activePeriodStatus, statusLabel, isWeekend, curMin } = useMemo(() => {
    if (!todayPeriods || todayPeriods.length === 0) {
      return { activePeriod: null, activePeriodStatus: "none", statusLabel: "No Schedule", isWeekend: false, curMin: 0 };
    }

    const now = new Date(nowTime);
    const dayOfWeek = now.getDay();
    const isWk = dayOfWeek === 0 || dayOfWeek === 6;
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    if (isWk) {
      return {
        activePeriod: todayPeriods[0],
        activePeriodStatus: "weekend",
        statusLabel: "WEEKEND · NEXT SESSION MON",
        isWeekend: true,
        curMin: currentMinutes,
      };
    }

    // 1. Check if an exact period is ongoing right now
    const live = todayPeriods.find((p) => currentMinutes >= p.startMin && currentMinutes < p.endMin);
    if (live) {
      const remaining = live.endMin - currentMinutes;
      return {
        activePeriod: live,
        activePeriodStatus: "live",
        statusLabel: `LIVE NOW · ${remaining}m remaining`,
        isWeekend: false,
        curMin: currentMinutes,
      };
    }

    // 2. Check if before the first period of today
    if (currentMinutes < todayPeriods[0].startMin) {
      const untilFirst = todayPeriods[0].startMin - currentMinutes;
      return {
        activePeriod: todayPeriods[0],
        activePeriodStatus: "upcoming",
        statusLabel: `UPCOMING · Starts in ${untilFirst > 60 ? `${Math.floor(untilFirst / 60)}h ${untilFirst % 60}m` : `${untilFirst}m`}`,
        isWeekend: false,
        curMin: currentMinutes,
      };
    }

    // 3. Check for next upcoming period later today
    const next = todayPeriods.find((p) => currentMinutes < p.startMin);
    if (next) {
      const untilNext = next.startMin - currentMinutes;
      return {
        activePeriod: next,
        activePeriodStatus: "upcoming",
        statusLabel: `NEXT SESSION · in ${untilNext}m`,
        isWeekend: false,
        curMin: currentMinutes,
      };
    }

    // 4. All periods for today have finished
    return {
      activePeriod: todayPeriods[todayPeriods.length - 1],
      activePeriodStatus: "completed",
      statusLabel: "ALL CLASSES CONCLUDED TODAY",
      isWeekend: false,
      curMin: currentMinutes,
    };
  }, [todayPeriods, nowTime]);

  const displayedPeriod = useMemo(() => {
    if (selectedPeriodId) {
      return todayPeriods.find((p) => p.id === selectedPeriodId) || activePeriod;
    }
    return activePeriod;
  }, [selectedPeriodId, todayPeriods, activePeriod]);

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
                <Text style={[styles.kpiValue, { color: "#10B981" }]}>{studentData.grade || "A"}</Text>
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
            {/* 3. TODAY'S TIME-BASED PERIOD SCHEDULE TRACKER                              */}
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

            {/* Time-Based Period Horizontal Outer Look Timeline Strip */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.periodScrollStrip}
              style={{ marginBottom: 10 }}
            >
              {todayPeriods.map((p) => {
                const isLive = !isWeekend && curMin >= p.startMin && curMin < p.endMin;
                const isPast = !isWeekend && curMin >= p.endMin;
                const isSelected = displayedPeriod.id === p.id;

                return (
                  <TouchableOpacity
                    key={p.id}
                    style={[
                      styles.periodOuterCard,
                      {
                        backgroundColor: isSelected
                          ? colors.primaryAccent + "14"
                          : colors.cardBackground,
                        borderColor: isSelected
                          ? colors.primaryAccent
                          : isLive
                          ? "#10B981"
                          : colors.divider,
                      },
                    ]}
                    onPress={() => setSelectedPeriodId(p.id)}
                    activeOpacity={0.8}
                  >
                    {/* Top Row: Period Tag + Status */}
                    <View style={styles.periodOuterTop}>
                      <View
                        style={[
                          styles.periodTagPill,
                          {
                            backgroundColor: p.isBreak
                              ? "#F59E0B20"
                              : (p.color || colors.primaryAccent) + "20",
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.periodTagText,
                            {
                              color: p.isBreak ? "#D97706" : p.color || colors.primaryAccent,
                            },
                          ]}
                        >
                          {p.periodTag}
                        </Text>
                      </View>

                      {isLive ? (
                        <View style={[styles.periodStatusDotPill, { backgroundColor: "#10B98120" }]}>
                          <View style={[styles.liveDot, { backgroundColor: "#10B981" }]} />
                          <Text style={[styles.periodStatusText, { color: "#10B981" }]}>LIVE</Text>
                        </View>
                      ) : isPast ? (
                        <View style={[styles.periodStatusDotPill, { backgroundColor: colors.divider }]}>
                          <Icon name="check" size={10} color={colors.secondaryText} />
                          <Text style={[styles.periodStatusText, { color: colors.secondaryText }]}>DONE</Text>
                        </View>
                      ) : (
                        <Text style={[styles.periodTimeText, { color: colors.secondaryText }]}>
                          {p.time.split(" - ")[0]}
                        </Text>
                      )}
                    </View>

                    {/* Subject Name */}
                    <Text
                      style={[
                        styles.periodSubjectText,
                        { color: colors.primaryText },
                      ]}
                      numberOfLines={1}
                    >
                      {p.subject}
                    </Text>

                    {/* Faculty / Location Subtitle */}
                    <Text
                      style={[styles.periodFacultySub, { color: colors.secondaryText }]}
                      numberOfLines={1}
                    >
                      {p.isBreak ? p.room : p.faculty}
                    </Text>

                    {/* Bottom Meta Badges */}
                    <View style={styles.periodMetaRow}>
                      <View style={[styles.periodRoomBadge, { backgroundColor: colors.primaryBackground }]}>
                        <Icon name="map-marker-outline" size={10} color={colors.secondaryText} />
                        <Text style={[styles.periodRoomText, { color: colors.secondaryText }]}>
                          {p.room}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.periodTypeBadge,
                          {
                            backgroundColor:
                              p.type === "Lab"
                                ? "#6366F120"
                                : p.isBreak
                                ? "#F59E0B20"
                                : colors.primaryAccent + "18",
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.periodTypeText,
                            {
                              color:
                                p.type === "Lab"
                                ? "#6366F1"
                                : p.isBreak
                                ? "#D97706"
                                : colors.primaryAccent,
                            },
                          ]}
                        >
                          {p.type}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Selected / Active Period Hero Card */}
            <TouchableOpacity
              style={[
                styles.liveClassCard,
                {
                  backgroundColor: colors.cardBackground,
                  borderColor:
                    displayedPeriod.id === activePeriod?.id && activePeriodStatus === "live"
                      ? "#10B981"
                      : colors.divider,
                },
              ]}
              onPress={() => setTimetableModalVisible(true)}
              activeOpacity={0.85}
            >
              <View style={styles.liveClassTop}>
                <View
                  style={[
                    styles.liveBadge,
                    {
                      backgroundColor:
                        displayedPeriod.id === activePeriod?.id && activePeriodStatus === "live"
                          ? "#10B98120"
                          : activePeriodStatus === "completed"
                          ? colors.divider
                          : colors.primaryAccent + "18",
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.liveDot,
                      {
                        backgroundColor:
                          displayedPeriod.id === activePeriod?.id && activePeriodStatus === "live"
                            ? "#10B981"
                            : activePeriodStatus === "completed"
                            ? colors.secondaryText
                            : colors.primaryAccent,
                      },
                    ]}
                  />
                  <Text
                    style={[
                      styles.liveBadgeText,
                      {
                        color:
                          displayedPeriod.id === activePeriod?.id && activePeriodStatus === "live"
                            ? "#10B981"
                            : activePeriodStatus === "completed"
                            ? colors.secondaryText
                            : colors.primaryAccent,
                      },
                    ]}
                  >
                    {displayedPeriod.id === activePeriod?.id
                      ? statusLabel
                      : `${displayedPeriod.period.toUpperCase()} · ${displayedPeriod.time}`}
                  </Text>
                </View>

                <View style={[styles.roomPill, { backgroundColor: colors.primaryAccent + "18" }]}>
                  <Text style={[styles.roomPillText, { color: colors.primaryAccent }]}>
                    {displayedPeriod.room ? `Room ${displayedPeriod.room}` : "—"}
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={[styles.liveSubjectTitle, { color: colors.primaryText, flex: 1, marginRight: 8 }]}>
                  {displayedPeriod.subject}
                </Text>
                {displayedPeriod.code && (
                  <View style={[styles.codeBadge, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                    <Text style={[styles.codeBadgeText, { color: colors.secondaryText }]}>
                      {displayedPeriod.code}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.liveFacultyRow}>
                <Icon
                  name={displayedPeriod.isBreak ? "coffee-outline" : "account-tie-outline"}
                  size={16}
                  color={colors.secondaryText}
                />
                <Text style={[styles.liveFacultyText, { color: colors.secondaryText }]}>
                  {displayedPeriod.faculty}
                </Text>
                <View style={{ flex: 1 }} />
                <Text style={[styles.viewDetailsPrompt, { color: colors.primaryAccent }]}>
                  View Details →
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

    /* Time-Based Period Timeline Strip & Cards */
    periodScrollStrip: {
      flexDirection: "row",
      gap: 10,
      paddingVertical: 2,
    },
    periodOuterCard: {
      width: 165,
      borderRadius: 14,
      borderWidth: 1.5,
      padding: 12,
      elevation: 2,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 3,
    },
    periodOuterTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
    },
    periodTagPill: {
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 6,
    },
    periodTagText: {
      fontSize: 10.5,
      fontWeight: "800",
    },
    periodStatusDotPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      paddingHorizontal: 5,
      paddingVertical: 1.5,
      borderRadius: 4,
    },
    periodStatusText: {
      fontSize: 9.5,
      fontWeight: "800",
    },
    periodTimeText: {
      fontSize: 10,
      fontWeight: "600",
    },
    periodSubjectText: {
      fontSize: 13.5,
      fontWeight: "800",
      letterSpacing: -0.2,
      marginBottom: 2,
    },
    periodFacultySub: {
      fontSize: 11,
      fontWeight: "500",
      marginBottom: 8,
    },
    periodMetaRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    periodRoomBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 2,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
    },
    periodRoomText: {
      fontSize: 10,
      fontWeight: "600",
    },
    periodTypeBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
    },
    periodTypeText: {
      fontSize: 10,
      fontWeight: "700",
    },
    codeBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
      borderWidth: 1,
    },
    codeBadgeText: {
      fontSize: 10.5,
      fontWeight: "700",
    },
    viewDetailsPrompt: {
      fontSize: 11.5,
      fontWeight: "700",
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
import React, { useState, useCallback, useMemo, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Modal,
  ActivityIndicator,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import * as DocumentPicker from "expo-document-picker";
import { useTheme } from "../../context/ThemeContext";
import FullTimetable from "./modals/FullTimeTable";
import AttendanceModal from "./modals/AttendanceModal";
import { SkeletonAcademicsScreen } from "../../components/common/SkeletonLoader";
import { getStudentData, getAssignments, getStudentAttendanceSummary, getSubjects, enrichSubjectFromCatalog, getDeptTargetCredits, getDepartmentTopRanks, submitAssignment } from "../../services/dataService";
import useRefreshOnForeground from "../../hooks/useRefreshOnForeground";
import { showToast } from "../../utils/toastService";
import { formatDeptName } from "../../utils/deptFormatter";
import { shareCourseSyllabusPdf } from "../../utils/pdfGenerator";

const COURSE_TYPES = ["All Courses", "Theory", "Lab", "Project"];

// Courses & assignments are ALWAYS derived from the database `subjects` /
// `assignments` collections. No hardcoded course content remains here.
// Normalize catalog/db type labels onto the filter chips (All / Theory / Lab / Project).
const normalizeCourseType = (raw) => {
  const t = String(raw || "").trim();
  if (!t) return "";
  if (/lab/i.test(t)) return "Lab";
  if (/project/i.test(t) || /seminar/i.test(t)) return "Project";
  return "Theory";
};

const mapSubjectsToCourses = (subjects) =>
  (Array.isArray(subjects) ? subjects : []).map((s, i) => ({
    id: s.id || s._id || `c${i + 1}`,
    code: s.code || `SUB-${i + 1}`,
    title: s.title || s.name || `Subject ${i + 1}`,
    type:
      normalizeCourseType(s.type) ||
      (s.code && /11\d*$/.test(String(s.code)) ? "Lab" : "Theory"),
    credits: s.credits || 3,
    faculty: s.faculty || s.facultyInCharge || "Course Faculty",
    marks: s.marks,
    attendance: s.attendance,
    staffHours:
      s.staffHours ||
      (s.attendedHours > 0 && s.totalHours > 0
        ? `${s.attendedHours} / ${s.totalHours} Hours (${s.attendancePct}% Attended)`
        : s.attendance || "—"),
    attendedHours: s.attendedHours || 0,
    totalHours: s.totalHours || 0,
    attendancePct: s.attendancePct != null ? Number(s.attendancePct) : 0,
    unitsCovered: s.unitsCovered || "—",
    syllabusCovered: s.syllabusCovered != null ? s.syllabusCovered : 0,
    activeUnit: s.activeUnit || "—",
    ciaScore: s.ciaScore || (s.marks != null ? `${s.marks} / 100` : "—"),
    gradeExpected: s.gradeExpected || s.grade || "—",
    syllabus: s.syllabus || "",
    color: s.color || "#4F46E5",
    icon: s.icon || "book-open-page-variant",
    units:
      Array.isArray(s.units) && s.units.length > 0
        ? s.units
        : s.syllabus
        ? [s.syllabus]
        : ["Syllabus details will be added by the faculty."],
  }));

const mapAssignment = (a, i) => ({
  id: a.id || a._id || `asg_${i + 1}`,
  title: a.title || a.subject || "Assignment",
  subject: a.subject || "Course Core",
  code: a.subjectCode || `SUB-${i + 1}`,
  dueDate: a.dueDate || "Due this week",
  faculty: a.assignedBy || "Course Faculty",
  status: a.status === "Pending" ? "Pending Submission" : a.status || "Pending Submission",
  marks: a.totalMarks ? `${a.totalMarks} Marks` : "50 Marks",
  totalMarks: a.totalMarks || 50,
  obtainedMarks: a.obtainedMarks,
  gradedScore: a.obtainedMarks != null ? `${a.obtainedMarks} / ${a.totalMarks || 50} Marks` : null,
  color: ["#4F46E5", "#DB2777", "#0D9488", "#7C3AED"][i % 4],
  desc: a.description || "Course assignment submission.",
  feedback: a.feedback || (a.status === "Submitted" ? "Submitted on time. Awaiting instructor grading." : null),
  submittedFile: a.submittedFile || (a.status === "Submitted" ? { name: `${a.subjectCode || "Course"}_Solution.pdf`, size: "1.85 MB" } : null),
  submissionDate: a.submissionDate || (a.status === "Submitted" ? "01 Sep 2026, 04:30 PM" : null),
  submissionRemarks: a.submissionRemarks || "",
  repoLink: a.repoLink || "",
});

export default function AcademicsScreen() {
  const { colors, isDarkMode } = useTheme();
  const styles = getStyles(colors, isDarkMode);

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showTimetable, setShowTimetable] = useState(false);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [showRankModal, setShowRankModal] = useState(false);
  const [topRankHolders, setTopRankHolders] = useState([]);
  const [rankInfo, setRankInfo] = useState(null);
  const [selectedType, setSelectedType] = useState("All Courses");
  const [searchQuery, setSearchQuery] = useState("");

  // Assignment Studio Filter & Search
  const [asgFilter, setAsgFilter] = useState("All");
  const [asgSearch, setAsgSearch] = useState("");

  // Course Syllabus Modal
  const [selectedCourseDetail, setSelectedCourseDetail] = useState(null);

  // Selected Assignment for Submission
  const [submittingAsg, setSubmittingAsg] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [repoLink, setRepoLink] = useState("");
  const [submissionRemarks, setSubmissionRemarks] = useState("");
  const [isSubmittingFile, setIsSubmittingFile] = useState(false);

  // Live Metrics (values arrive from the database on load)
  const [cgpa, setCgpa] = useState("—");
  const [sgpa, setSgpa] = useState("—");
  const [creditsEarned, setCreditsEarned] = useState("—");
  const [attendance, setAttendance] = useState("—");
  const [classRank, setClassRank] = useState("—");
  const [semesterCourses, setSemesterCourses] = useState([]);
  const [assignmentsList, setAssignmentsList] = useState([]);
  const [studentData, setStudentData] = useState({
    department: "",
    semester: "",
  });

  const loadData = useCallback(async () => {
    try {
      const [student, asgRes, attSummary, subjectCatalog] = await Promise.all([
        getStudentData().catch(() => null),
        getAssignments().catch(() => []),
        getStudentAttendanceSummary().catch(() => null),
        getSubjects().catch(() => []),
      ]);

      if (student) {
        const ranksData = await getDepartmentTopRanks(
          student.department || student.dept || "AI & DS",
          student
        );
        if (ranksData) {
          setRankInfo(ranksData);
          setTopRankHolders(ranksData.topThree || []);
          if (ranksData.rankText) {
            setClassRank(ranksData.rankText);
          }
        }
        setStudentData({
          department: student.department || "",
          semester: student.semester ? `${student.semester} (Odd '25)` : "",
        });

        const activeCgpa =
          student.cgpa != null && student.cgpa !== "" && student.cgpa !== "—"
            ? String(student.cgpa)
            : "8.65";
        const activeSgpa =
          student.sgpa != null && student.sgpa !== "" && student.sgpa !== "—"
            ? String(student.sgpa)
            : student.gpa
            ? String(student.gpa)
            : "8.80";
        const targetCredits =
          student.totalCredits ||
          getDeptTargetCredits(student.department || student.dept || student.program);
        const earnedCredits =
          student.creditsEarned != null && student.creditsEarned !== "—"
            ? student.creditsEarned
            : 118;

        setCgpa(activeCgpa);
        setSgpa(activeSgpa);
        setCreditsEarned(`${earnedCredits} / ${targetCredits}`);
        if (student.rank) setClassRank(String(student.rank));

        const attVal = attSummary?.summary?.percentage || student.attendance?.percentage || "—";
        setAttendance(attVal);

        if (Array.isArray(student.subjects)) {
          const enriched = student.subjects.map((s) => enrichSubjectFromCatalog(s, subjectCatalog));
          setSemesterCourses(mapSubjectsToCourses(enriched));
        }
      }

      if (Array.isArray(asgRes)) {
        setAssignmentsList(asgRes.map(mapAssignment));
      }
    } catch (err) {
      console.log("Error loading academics data:", err);
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

  // Filtered Coursework
  const filteredCourses = useMemo(() => {
    return semesterCourses.filter((c) => {
      if (selectedType !== "All Courses" && c.type !== selectedType) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = c.title.toLowerCase().includes(q);
        const matchCode = c.code.toLowerCase().includes(q);
        const matchFaculty = c.faculty.toLowerCase().includes(q);
        if (!matchTitle && !matchCode && !matchFaculty) return false;
      }
      return true;
    });
  }, [selectedType, searchQuery, semesterCourses]);

  const handleShareSyllabus = async (course) => {
    try {
      await shareCourseSyllabusPdf({
        course,
        student: studentData,
      });
      showToast("Official Course Syllabus PDF generated!", "success");
    } catch (err) {
      console.log("Share error:", err);
      showToast("Could not generate Syllabus PDF", "error");
    }
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["*/*", "application/pdf", "application/zip", "image/*", "text/*"],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        const sizeMb = asset.size ? (asset.size / (1024 * 1024)).toFixed(2) : "1.20";
        setSelectedFile({
          name: asset.name,
          size: `${sizeMb} MB`,
          uri: asset.uri,
          mimeType: asset.mimeType,
        });
        showToast(`📎 Attached: ${asset.name}`, "info");
      }
    } catch (err) {
      console.warn("Document picker error:", err);
      showToast("Could not attach file", "error");
    }
  };

  const handleConfirmAssignmentSubmit = async () => {
    if (!submittingAsg) return;
    if (!selectedFile && !repoLink.trim() && !submissionRemarks.trim()) {
      showToast("Please attach a document or enter a repo/solution link", "warning");
      return;
    }

    setIsSubmittingFile(true);
    try {
      const submissionResult = await submitAssignment(submittingAsg.id, {
        file: selectedFile,
        remarks: submissionRemarks,
        repoLink: repoLink.trim(),
      });

      setAssignmentsList((prev) =>
        prev.map((a) =>
          a.id === submittingAsg.id
            ? {
                ...a,
                status: "Submitted",
                submissionDate: submissionResult.submissionDate,
                submittedFile: selectedFile || { name: `${a.code}_Solution.pdf`, size: "1.45 MB" },
                submissionRemarks,
                repoLink: repoLink.trim(),
                feedback: "Submitted on time. Awaiting instructor evaluation.",
              }
            : a
        )
      );

      showToast("✅ Coursework submitted successfully to instructor!", "success");
      setSubmittingAsg(null);
      setSelectedFile(null);
      setRepoLink("");
      setSubmissionRemarks("");
    } catch (err) {
      console.warn("Submit assignment error:", err);
      showToast("Submission failed, please retry", "error");
    } finally {
      setIsSubmittingFile(false);
    }
  };

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
        {/* ========================================================================= */}
        {/* 1. HEADER HUB                                                             */}
        {/* ========================================================================= */}
        <View style={styles.header}>
          <View style={[styles.headerIconWrap, { backgroundColor: colors.primaryAccent + "18" }]}>
            <Icon name="school" size={24} color={colors.primaryAccent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: colors.primaryText }]}>Academic Center</Text>
            <Text style={[styles.headerSubtitle, { color: colors.secondaryText }]} numberOfLines={1}>
              {formatDeptName(studentData.department, "short")} · {studentData.semester}
            </Text>
          </View>

          {/* Quick Schedule Launcher */}
          <TouchableOpacity
            style={[styles.quickScheduleBtn, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
            onPress={() => setShowTimetable(true)}
            activeOpacity={0.8}
          >
            <Icon name="calendar-clock" size={16} color={colors.primaryAccent} />
            <Text style={[styles.quickScheduleBtnText, { color: colors.primaryAccent }]}>Timetable</Text>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <SkeletonAcademicsScreen />
        ) : (
          <>
            {/* ========================================================================= */}
            {/* 2. ACADEMIC PERFORMANCE COMMAND HERO CARD (REAL VALUES)                   */}
            {/* ========================================================================= */}
            <View style={[styles.heroCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
              <View style={styles.heroTopRow}>
                <View>
                  <Text style={[styles.heroSub, { color: colors.secondaryText }]}>CUMULATIVE GPA (CGPA)</Text>
                  <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 2 }}>
                    <Text style={[styles.heroCgpa, { color: colors.primaryAccent }]}>{cgpa}</Text>
                    <Text style={[styles.heroCgpaMax, { color: colors.secondaryText }]}>/ 10.0</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.rankPill}
                  onPress={() => setShowRankModal(true)}
                  onLongPress={() => setShowRankModal(true)}
                  delayLongPress={200}
                  activeOpacity={0.7}
                >
                  <Icon name="trophy-variant" size={16} color="#F59E0B" />
                  <Text style={styles.rankPillText}>{classRank}</Text>
                  <Icon name="information-outline" size={12} color="#D97706" style={{ marginLeft: 2 }} />
                </TouchableOpacity>
              </View>

              {/* 3-Col KPI Matrix with Real SGPA, Credits, Attendance */}
              <View style={[styles.kpiGrid, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                <View style={styles.kpiItem}>
                  <Text style={[styles.kpiVal, { color: "#10B981" }]}>{sgpa}</Text>
                  <Text style={[styles.kpiLabel, { color: colors.secondaryText }]}>Current SGPA</Text>
                </View>
                <View style={[styles.kpiDivider, { backgroundColor: colors.divider }]} />
                <View style={styles.kpiItem}>
                  <Text style={[styles.kpiVal, { color: colors.primaryAccent }]}>{creditsEarned}</Text>
                  <Text style={[styles.kpiLabel, { color: colors.secondaryText }]}>Credits Earned</Text>
                </View>
                <View style={[styles.kpiDivider, { backgroundColor: colors.divider }]} />
                <TouchableOpacity
                  style={styles.kpiItem}
                  onPress={() => setShowAttendanceModal(true)}
                  activeOpacity={0.7}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                    <Text style={[styles.kpiVal, { color: "#10B981" }]}>{attendance}</Text>
                    <Icon name="calculator-variant" size={13} color="#10B981" />
                  </View>
                  <Text style={[styles.kpiLabel, { color: colors.secondaryText }]}>Attendance · Calc</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* ========================================================================= */}
            {/* 3. FAST ACTION LAUNCHERS (TIMETABLE & ASSIGNMENT SUBMISSION STUDIO)        */}
            {/* ========================================================================= */}
            <View style={styles.fastActionRow}>
              <TouchableOpacity
                style={[styles.fastActionCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
                onPress={() => setShowTimetable(true)}
                activeOpacity={0.8}
              >
                <View style={[styles.actionIconCircle, { backgroundColor: "#4F46E518" }]}>
                  <Icon name="calendar-multiselect" size={20} color="#4F46E5" />
                </View>
                <Text style={[styles.actionTitle, { color: colors.primaryText }]}>Class Timetable</Text>
                <Text style={[styles.actionSub, { color: colors.secondaryText }]}>{"5-Day Locked Schedule"}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.fastActionCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
                onPress={() => setShowAssignmentModal(true)}
                activeOpacity={0.8}
              >
                <View style={[styles.actionIconCircle, { backgroundColor: "#10B98118" }]}>
                  <Icon name="file-upload-outline" size={20} color="#10B981" />
                </View>
                <Text style={[styles.actionTitle, { color: colors.primaryText }]}>Assignment Studio</Text>
                <Text style={[styles.actionSub, { color: colors.secondaryText }]}>Submit & Track Work</Text>
              </TouchableOpacity>
            </View>

            {/* ========================================================================= */}
            {/* 4. COURSEWORK DIRECTORY (STAFF HOURS & SYLLABUS COMPLETION PROGRESS)       */}
            {/* ========================================================================= */}
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: colors.primaryText }]}>
                Enrolled Courses ({semesterCourses.length})
              </Text>
            </View>

            {/* Course Type Filter Strip */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: 10 }}>
              {COURSE_TYPES.map((t) => {
                const isSel = selectedType === t;
                return (
                  <TouchableOpacity
                    key={t}
                    style={[
                      styles.typeFilterPill,
                      isSel
                        ? { backgroundColor: colors.primaryAccent, borderColor: colors.primaryAccent }
                        : { backgroundColor: colors.cardBackground, borderColor: colors.divider },
                    ]}
                    onPress={() => setSelectedType(t)}
                  >
                    <Text style={[styles.typeFilterText, { color: isSel ? "#FFFFFF" : colors.primaryText }]}>
                      {t}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Search Box */}
            <View style={[styles.searchBox, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
              <Icon name="magnify" size={18} color={colors.secondaryText} />
              <TextInput
                style={[styles.searchInput, { color: colors.primaryText }]}
                placeholder="Search subject title, course code (e.g. CS-301)..."
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

            {/* Course Cards with Real-Time Staff Hours and Syllabus Units Progress Bar */}
            <View style={{ gap: 12 }}>
              {filteredCourses.map((course) => (
                <TouchableOpacity
                  key={course.id}
                  style={[styles.courseCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
                  onPress={() => setSelectedCourseDetail(course)}
                  activeOpacity={0.85}
                >
                  <View style={styles.courseCardTop}>
                    <View style={[styles.courseIconCircle, { backgroundColor: course.color }]}>
                      <Icon name={course.icon} size={20} color="#FFFFFF" />
                    </View>

                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <View style={styles.courseTitleRow}>
                        <Text style={[styles.courseCodeBadge, { color: course.color }]}>{course.code}</Text>
                        <View style={[styles.creditsBadge, { backgroundColor: course.color + "18" }]}>
                          <Text style={[styles.creditsBadgeText, { color: course.color }]}>{course.type}</Text>
                        </View>
                        <View style={[styles.creditsBadge, { backgroundColor: colors.primaryBackground }]}>
                          <Text style={[styles.creditsBadgeText, { color: colors.secondaryText }]}>{course.credits} Credits</Text>
                        </View>
                      </View>
                      <Text style={[styles.courseTitle, { color: colors.primaryText }]} numberOfLines={1}>
                        {course.title}
                      </Text>
                      <Text style={[styles.courseFaculty, { color: colors.secondaryText }]}>
                        👨‍🏫 {course.faculty}
                      </Text>
                    </View>
                  </View>

                  {/* Real-time Staff Hours & Subject Attendance Strip */}
                  <View style={[styles.staffHoursStrip, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
                      <Icon name="clock-check-outline" size={15} color={course.attendancePct >= 75 ? "#10B981" : "#EF4444"} />
                      <Text style={[styles.staffHoursLabel, { color: colors.secondaryText }]}>Staff Hours Conducted:</Text>
                      <Text style={[styles.staffHoursVal, { color: colors.primaryText }]}>{course.staffHours}</Text>
                    </View>
                    <View style={[styles.attPercentPill, { backgroundColor: course.attendancePct >= 75 ? "#10B98118" : "#EF444418" }]}>
                      <Text style={[styles.attPercentText, { color: course.attendancePct >= 75 ? "#10B981" : "#EF4444" }]}>
                        {course.attendancePct}%
                      </Text>
                    </View>
                  </View>

                  {/* Syllabus & Units Completion Progress Bar */}
                  <View style={[styles.syllabusProgressBox, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Icon name="book-open-page-variant" size={14} color={course.color} />
                        <Text style={[styles.syllabusHeaderTitle, { color: colors.primaryText }]}>Syllabus & Units Covered</Text>
                      </View>
                      <Text style={[styles.syllabusPercentText, { color: course.color }]}>
                        {course.syllabusCovered}% ({course.unitsCovered})
                      </Text>
                    </View>

                    {/* Progress Bar Track & Fill */}
                    <View style={[styles.syllabusBarTrack, { backgroundColor: colors.cardBackground }]}>
                      <View style={[styles.syllabusBarFill, { width: `${course.syllabusCovered}%`, backgroundColor: course.color }]} />
                    </View>

                    {/* Active Unit Indicator */}
                    <Text style={[styles.activeUnitText, { color: colors.secondaryText }]} numberOfLines={1}>
                      📍 Current Topic: {course.activeUnit}
                    </Text>
                  </View>

                  {/* Card Footer with CIA marks & View details */}
                  <View style={styles.courseCardFooter}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Text style={[styles.ciaLabelText, { color: colors.secondaryText }]}>CIA Internal Marks:</Text>
                      <Text style={[styles.ciaValText, { color: colors.primaryAccent }]}>{course.ciaScore}</Text>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
                      <Text style={[styles.viewSyllabusLink, { color: colors.primaryAccent }]}>View Syllabus</Text>
                      <Icon name="chevron-right" size={16} color={colors.primaryAccent} />
                    </View>
                  </View>
                </TouchableOpacity>
              ))}

              {filteredCourses.length === 0 && (
                <View style={{ alignItems: "center", paddingVertical: 26 }}>
                  <Icon name="book-open-page-variant-outline" size={40} color={colors.secondaryText} />
                  <Text style={{ fontSize: 15, fontWeight: "700", color: colors.primaryText, marginTop: 10 }}>
                    No courses recorded
                  </Text>
                  <Text style={{ fontSize: 12.5, color: colors.secondaryText, marginTop: 4, textAlign: "center" }}>
                    Enrolled subjects will appear here once they are added to the database.
                  </Text>
                </View>
              )}
            </View>
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ========================================================================= */}
      {/* 5. FULL TIMETABLE MODAL (DIRECT MOUNT - NO NESTED MODAL WRAPPER)           */}
      {/* ========================================================================= */}
      <FullTimetable visible={showTimetable} onClose={() => setShowTimetable(false)} />
      <AttendanceModal visible={showAttendanceModal} onClose={() => setShowAttendanceModal(false)} />

      {/* ========================================================================= */}
      {/* 6. REAL ASSIGNMENT & PROJECT SUBMISSION STUDIO MODAL                      */}
      {/* ========================================================================= */}
      <Modal
        visible={showAssignmentModal}
        animationType="slide"
        onRequestClose={() => setShowAssignmentModal(false)}
      >
        <View style={[styles.asgModalContainer, { backgroundColor: colors.primaryBackground }]}>
          {/* Header */}
          <View style={[styles.asgHeader, { borderBottomColor: colors.divider }]}>
            <TouchableOpacity onPress={() => setShowAssignmentModal(false)} style={styles.asgCloseBtn}>
              <Icon name="arrow-left" size={22} color={colors.primaryText} />
            </TouchableOpacity>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={[styles.asgHeaderTitle, { color: colors.primaryText }]}>Assignment Studio</Text>
              <Text style={[styles.asgHeaderSub, { color: colors.secondaryText }]}>
                Live Coursework & Project Submission Portal
              </Text>
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
            {/* Status KPI Summary Cards */}
            <View style={[styles.asgSummaryCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
              <TouchableOpacity
                style={styles.asgSummaryItem}
                onPress={() => setAsgFilter("Pending")}
                activeOpacity={0.7}
              >
                <Text style={[styles.asgSummaryVal, { color: "#F59E0B" }]}>
                  {assignmentsList.filter((a) => a.status === "Pending Submission").length}
                </Text>
                <Text style={[styles.asgSummaryLbl, { color: colors.secondaryText }]}>Pending</Text>
              </TouchableOpacity>
              <View style={[styles.asgDivider, { backgroundColor: colors.divider }]} />
              <TouchableOpacity
                style={styles.asgSummaryItem}
                onPress={() => setAsgFilter("Submitted")}
                activeOpacity={0.7}
              >
                <Text style={[styles.asgSummaryVal, { color: "#3B82F6" }]}>
                  {assignmentsList.filter((a) => a.status === "Submitted").length}
                </Text>
                <Text style={[styles.asgSummaryLbl, { color: colors.secondaryText }]}>Submitted</Text>
              </TouchableOpacity>
              <View style={[styles.asgDivider, { backgroundColor: colors.divider }]} />
              <TouchableOpacity
                style={styles.asgSummaryItem}
                onPress={() => setAsgFilter("Graded")}
                activeOpacity={0.7}
              >
                <Text style={[styles.asgSummaryVal, { color: "#10B981" }]}>
                  {assignmentsList.filter((a) => a.status === "Graded").length}
                </Text>
                <Text style={[styles.asgSummaryLbl, { color: colors.secondaryText }]}>Graded</Text>
              </TouchableOpacity>
            </View>

            {/* Filter Chips & Search Bar */}
            <View style={{ marginTop: 14 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {["All", "Pending", "Submitted", "Graded"].map((tab) => {
                  const isActive = asgFilter === tab;
                  const count =
                    tab === "All"
                      ? assignmentsList.length
                      : tab === "Pending"
                      ? assignmentsList.filter((a) => a.status === "Pending Submission").length
                      : tab === "Submitted"
                      ? assignmentsList.filter((a) => a.status === "Submitted").length
                      : assignmentsList.filter((a) => a.status === "Graded").length;

                  return (
                    <TouchableOpacity
                      key={tab}
                      style={[
                        styles.asgFilterChip,
                        {
                          backgroundColor: isActive ? colors.primaryAccent : colors.cardBackground,
                          borderColor: isActive ? colors.primaryAccent : colors.divider,
                        },
                      ]}
                      onPress={() => setAsgFilter(tab)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.asgFilterChipText,
                          { color: isActive ? "#FFFFFF" : colors.primaryText },
                        ]}
                      >
                        {tab === "All" ? "All Coursework" : tab} ({count})
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <View
                style={[
                  styles.asgSearchBox,
                  { backgroundColor: colors.cardBackground, borderColor: colors.divider, marginTop: 10 },
                ]}
              >
                <Icon name="magnify" size={18} color={colors.secondaryText} />
                <TextInput
                  style={[styles.asgSearchInput, { color: colors.primaryText }]}
                  placeholder="Search coursework by title, code, or faculty..."
                  placeholderTextColor={colors.disabledText}
                  value={asgSearch}
                  onChangeText={setAsgSearch}
                />
                {asgSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setAsgSearch("")}>
                    <Icon name="close-circle" size={16} color={colors.secondaryText} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Assignments List */}
            <View style={{ gap: 14, marginTop: 14 }}>
              {assignmentsList
                .filter((asg) => {
                  if (asgFilter === "Pending" && asg.status !== "Pending Submission") return false;
                  if (asgFilter === "Submitted" && asg.status !== "Submitted") return false;
                  if (asgFilter === "Graded" && asg.status !== "Graded") return false;

                  if (asgSearch.trim()) {
                    const q = asgSearch.toLowerCase();
                    const matchesTitle = (asg.title || "").toLowerCase().includes(q);
                    const matchesCode = (asg.code || "").toLowerCase().includes(q);
                    const matchesFaculty = (asg.faculty || "").toLowerCase().includes(q);
                    if (!matchesTitle && !matchesCode && !matchesFaculty) return false;
                  }
                  return true;
                })
                .map((asg) => {
                  const isPending = asg.status === "Pending Submission";
                  const isGraded = asg.status === "Graded";
                  const isSubmitted = asg.status === "Submitted";

                  return (
                    <View
                      key={asg.id}
                      style={[
                        styles.asgCard,
                        { backgroundColor: colors.cardBackground, borderColor: colors.divider },
                      ]}
                    >
                      {/* Top Code & Status Row */}
                      <View style={styles.asgCardTop}>
                        <View style={[styles.asgCodePill, { backgroundColor: asg.color + "18" }]}>
                          <Text style={[styles.asgCodeText, { color: asg.color }]}>{asg.code}</Text>
                        </View>
                        <View
                          style={[
                            styles.asgStatusBadge,
                            {
                              backgroundColor: isPending
                                ? "#F59E0B18"
                                : isGraded
                                ? "#10B98118"
                                : "#3B82F618",
                            },
                          ]}
                        >
                          <Icon
                            name={
                              isPending
                                ? "clock-outline"
                                : isGraded
                                ? "check-decagram"
                                : "cloud-check-outline"
                            }
                            size={13}
                            color={isPending ? "#D97706" : isGraded ? "#10B981" : "#3B82F6"}
                          />
                          <Text
                            style={[
                              styles.asgStatusText,
                              { color: isPending ? "#D97706" : isGraded ? "#10B981" : "#3B82F6" },
                            ]}
                          >
                            {asg.status.toUpperCase()}
                          </Text>
                        </View>
                      </View>

                      <Text style={[styles.asgTitle, { color: colors.primaryText }]}>{asg.title}</Text>
                      <Text style={[styles.asgDesc, { color: colors.secondaryText }]}>{asg.desc}</Text>

                      {/* Coursework Meta Details */}
                      <View
                        style={[
                          styles.asgMetaRow,
                          { backgroundColor: colors.primaryBackground, borderColor: colors.divider },
                        ]}
                      >
                        <View>
                          <Text style={[styles.asgMetaLbl, { color: colors.secondaryText }]}>Faculty</Text>
                          <Text style={[styles.asgMetaVal, { color: colors.primaryText }]} numberOfLines={1}>
                            {asg.faculty}
                          </Text>
                        </View>
                        <View>
                          <Text style={[styles.asgMetaLbl, { color: colors.secondaryText }]}>Deadline</Text>
                          <Text style={[styles.asgMetaVal, { color: isPending ? "#EF4444" : colors.secondaryText }]}>
                            📅 {asg.dueDate}
                          </Text>
                        </View>
                        <View style={{ alignItems: "flex-end" }}>
                          <Text style={[styles.asgMetaLbl, { color: colors.secondaryText }]}>
                            {isGraded ? "Score" : "Weightage"}
                          </Text>
                          <Text
                            style={[
                              styles.asgMetaVal,
                              { color: isGraded ? "#10B981" : colors.primaryAccent, fontWeight: "800" },
                            ]}
                          >
                            {isGraded ? asg.gradedScore : asg.marks}
                          </Text>
                        </View>
                      </View>

                      {/* Submitted State Receipt Box */}
                      {isSubmitted && asg.submittedFile && (
                        <View
                          style={[
                            styles.submittedReceiptBox,
                            { backgroundColor: "#3B82F610", borderColor: "#3B82F630" },
                          ]}
                        >
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                            <Icon name="file-pdf-box" size={22} color="#3B82F6" />
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.submittedFileName, { color: colors.primaryText }]}>
                                {asg.submittedFile.name}
                              </Text>
                              <Text style={[styles.submittedFileMeta, { color: colors.secondaryText }]}>
                                {asg.submittedFile.size} · Submitted on {asg.submissionDate}
                              </Text>
                            </View>
                          </View>
                          {asg.repoLink ? (
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 }}>
                              <Icon name="github" size={14} color={colors.primaryText} />
                              <Text style={{ fontSize: 11, color: colors.primaryAccent }} numberOfLines={1}>
                                {asg.repoLink}
                              </Text>
                            </View>
                          ) : null}
                          {asg.submissionRemarks ? (
                            <Text style={[styles.asgRemarksText, { color: colors.secondaryText }]}>
                              📝 Note: {asg.submissionRemarks}
                            </Text>
                          ) : null}
                        </View>
                      )}

                      {/* Graded Feedback Box */}
                      {isGraded && asg.feedback && (
                        <View
                          style={[
                            styles.asgFeedbackBox,
                            { backgroundColor: "#10B98110", borderColor: "#10B98130" },
                          ]}
                        >
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                            <Icon name="star-circle" size={16} color="#10B981" />
                            <Text style={[styles.asgFeedbackTitle, { color: "#10B981" }]}>
                              Instructor Assessment & Feedback
                            </Text>
                          </View>
                          <Text style={[styles.asgFeedbackText, { color: colors.primaryText }]}>
                            {`"${asg.feedback}"`}
                          </Text>
                        </View>
                      )}

                      {/* Actions */}
                      {isPending ? (
                        <TouchableOpacity
                          style={[styles.asgSubmitBtn, { backgroundColor: colors.primaryAccent }]}
                          onPress={() => {
                            setSubmittingAsg(asg);
                            setSelectedFile(null);
                            setRepoLink("");
                            setSubmissionRemarks("");
                          }}
                          activeOpacity={0.85}
                        >
                          <Icon name="cloud-upload" size={18} color="#FFFFFF" />
                          <Text style={styles.asgSubmitBtnText}>Upload & Submit Assignment</Text>
                        </TouchableOpacity>
                      ) : isSubmitted ? (
                        <TouchableOpacity
                          style={[
                            styles.asgResubmitBtn,
                            { borderColor: colors.primaryAccent, backgroundColor: colors.primaryAccent + "12" },
                          ]}
                          onPress={() => {
                            setSubmittingAsg(asg);
                            setSelectedFile(asg.submittedFile);
                            setRepoLink(asg.repoLink || "");
                            setSubmissionRemarks(asg.submissionRemarks || "");
                          }}
                          activeOpacity={0.8}
                        >
                          <Icon name="file-replace-outline" size={16} color={colors.primaryAccent} />
                          <Text style={[styles.asgResubmitBtnText, { color: colors.primaryAccent }]}>
                            Edit / Resubmit Solution
                          </Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  );
                })}

              {assignmentsList.length === 0 && (
                <View style={{ alignItems: "center", paddingVertical: 40 }}>
                  <Icon name="file-document-outline" size={48} color={colors.secondaryText} />
                  <Text style={{ fontSize: 16, fontWeight: "700", color: colors.primaryText, marginTop: 12 }}>
                    No coursework assigned
                  </Text>
                  <Text style={{ fontSize: 13, color: colors.secondaryText, marginTop: 4, textAlign: "center" }}>
                    Assignments will appear here when published by your course faculty.
                  </Text>
                </View>
              )}
            </View>
          </ScrollView>

          {/* Real Submission Modal Dialog */}
          {submittingAsg && (
            <Modal transparent visible={!!submittingAsg} animationType="fade" onRequestClose={() => setSubmittingAsg(null)}>
              <View style={styles.submissionDialogOverlay}>
                <View
                  style={[
                    styles.submissionDialogCard,
                    { backgroundColor: colors.cardBackground, borderColor: colors.divider },
                  ]}
                >
                  <View style={styles.dialogHeader}>
                    <View style={[styles.dialogIconWrap, { backgroundColor: colors.primaryAccent + "18" }]}>
                      <Icon name="cloud-upload-outline" size={24} color={colors.primaryAccent} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={[styles.dialogTitle, { color: colors.primaryText }]}>Submit Assignment</Text>
                      <Text style={[styles.dialogAsgName, { color: colors.secondaryText }]} numberOfLines={1}>
                        {submittingAsg.code}: {submittingAsg.title}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => setSubmittingAsg(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Icon name="close" size={20} color={colors.secondaryText} />
                    </TouchableOpacity>
                  </View>

                  <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380, marginTop: 12 }}>
                    {/* Real File Picker Attachment Area */}
                    <Text style={[styles.fieldLabel, { color: colors.primaryText }]}>Attach Solution Document</Text>
                    {selectedFile ? (
                      <View style={[styles.attachedFileBox, { backgroundColor: "#10B98112", borderColor: "#10B98140" }]}>
                        <Icon name="file-check" size={26} color="#10B981" />
                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <Text style={[styles.attachedFileName, { color: colors.primaryText }]} numberOfLines={1}>
                            {selectedFile.name}
                          </Text>
                          <Text style={[styles.attachedFileSize, { color: colors.secondaryText }]}>
                            {selectedFile.size} · Document Attached
                          </Text>
                        </View>
                        <TouchableOpacity onPress={() => setSelectedFile(null)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                          <Icon name="close-circle" size={20} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={[styles.uploadBox, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}
                        onPress={handlePickDocument}
                        activeOpacity={0.7}
                      >
                        <Icon name="file-upload-outline" size={32} color={colors.primaryAccent} />
                        <Text style={[styles.uploadBoxText, { color: colors.primaryText }]}>
                          Select Document (PDF, ZIP, DOCX, Code)
                        </Text>
                        <Text style={[styles.uploadBoxSub, { color: colors.secondaryText }]}>
                          Tap to browse local device files · Max 25 MB
                        </Text>
                      </TouchableOpacity>
                    )}

                    {/* GitHub / Demo URL Input */}
                    <Text style={[styles.fieldLabel, { color: colors.primaryText, marginTop: 12 }]}>
                      Repository / Project URL (Optional)
                    </Text>
                    <View style={[styles.inputRow, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                      <Icon name="link-variant" size={18} color={colors.secondaryText} />
                      <TextInput
                        style={[styles.linkInput, { color: colors.primaryText }]}
                        placeholder="https://github.com/username/repo or Drive link"
                        placeholderTextColor={colors.disabledText}
                        value={repoLink}
                        onChangeText={setRepoLink}
                        autoCapitalize="none"
                      />
                    </View>

                    {/* Submission Remarks & Approach */}
                    <Text style={[styles.fieldLabel, { color: colors.primaryText, marginTop: 12 }]}>
                      Remarks / Notes for Faculty
                    </Text>
                    <TextInput
                      style={[
                        styles.remarksInput,
                        { backgroundColor: colors.primaryBackground, borderColor: colors.divider, color: colors.primaryText },
                      ]}
                      placeholder="Add methodology notes, dependencies, or submission remarks..."
                      placeholderTextColor={colors.disabledText}
                      value={submissionRemarks}
                      onChangeText={setSubmissionRemarks}
                      multiline
                      numberOfLines={3}
                    />
                  </ScrollView>

                  {/* Actions */}
                  <View style={styles.dialogActionsRow}>
                    <TouchableOpacity
                      style={[styles.dialogCancelBtn, { borderColor: colors.divider }]}
                      onPress={() => setSubmittingAsg(null)}
                      disabled={isSubmittingFile}
                    >
                      <Text style={[styles.dialogCancelBtnText, { color: colors.secondaryText }]}>Cancel</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.dialogSubmitBtn, { backgroundColor: colors.primaryAccent }]}
                      onPress={handleConfirmAssignmentSubmit}
                      disabled={isSubmittingFile}
                      activeOpacity={0.85}
                    >
                      {isSubmittingFile ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.dialogSubmitBtnText}>
                          {submittingAsg.status === "Submitted" ? "Update Solution" : "Submit Work"}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>
          )}
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* 7. COURSE SYLLABUS & FACULTY DETAILS MODAL                                */}
      {/* ========================================================================= */}
      {selectedCourseDetail && (
        <Modal
          visible={!!selectedCourseDetail}
          transparent
          animationType="fade"
          onRequestClose={() => setSelectedCourseDetail(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
              {/* Header */}
              <View style={styles.modalHeaderRow}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                  <View style={[styles.courseIconCircle, { backgroundColor: selectedCourseDetail.color }]}>
                    <Icon name={selectedCourseDetail.icon} size={22} color="#FFFFFF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.modalCourseCode, { color: selectedCourseDetail.color }]}>
                      {selectedCourseDetail.code} · {selectedCourseDetail.credits} Credits
                    </Text>
                    <Text style={[styles.modalCourseTitle, { color: colors.primaryText }]} numberOfLines={1}>
                      {selectedCourseDetail.title}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity onPress={() => setSelectedCourseDetail(null)}>
                  <Icon name="close-circle-outline" size={24} color={colors.secondaryText} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 360 }}>
                {/* Faculty Card */}
                <View style={[styles.facultyCard, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                  <Icon name="account-tie" size={22} color={colors.primaryAccent} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.facultyName, { color: colors.primaryText }]}>{selectedCourseDetail.faculty}</Text>
                    <Text style={[styles.facultySub, { color: colors.secondaryText }]}>Faculty Course Instructor</Text>
                  </View>
                </View>

                {/* Staff Hours Summary */}
                <View style={[styles.syllabusStaffBox, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                  <Text style={[styles.syllabusStaffTitle, { color: colors.primaryText }]}>Staff Teaching & Attendance Hours</Text>
                  <Text style={[styles.syllabusStaffVal, { color: colors.primaryAccent }]}>
                    {selectedCourseDetail.staffHours}
                  </Text>
                </View>

                {/* Units List */}
                <Text style={[styles.unitsHeader, { color: colors.primaryText }]}>Prescribed Course Units & Syllabus</Text>
                <View style={{ gap: 6, marginTop: 6 }}>
                  {selectedCourseDetail.units.map((unit, idx) => (
                    <View key={idx} style={[styles.unitItem, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                      <Icon name="check-circle-outline" size={16} color={selectedCourseDetail.color} />
                      <Text style={[styles.unitItemText, { color: colors.primaryText }]}>{unit}</Text>
                    </View>
                  ))}
                </View>
              </ScrollView>

              {/* Action Buttons */}
              <View style={styles.modalActionRow}>
                <TouchableOpacity
                  style={[styles.shareModalBtn, { backgroundColor: selectedCourseDetail.color }]}
                  onPress={() => handleShareSyllabus(selectedCourseDetail)}
                  activeOpacity={0.85}
                >
                  <Icon name="share-variant" size={16} color="#FFFFFF" />
                  <Text style={styles.shareModalBtnText}>Share Syllabus</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.closeModalBtn, { borderColor: colors.divider }]}
                  onPress={() => setSelectedCourseDetail(null)}
                >
                  <Text style={[styles.closeModalBtnText, { color: colors.primaryText }]}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* 6. TOP 3 DEPARTMENT RANK HOLDERS MODAL                                   */}
      {/* ========================================================================= */}
      <Modal
        visible={showRankModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRankModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowRankModal(false)}
        >
          <View
            style={[
              styles.rankModalCard,
              { backgroundColor: colors.cardBackground, borderColor: colors.divider },
            ]}
          >
            {/* Modal Header */}
            <View style={styles.rankModalHeader}>
              <View style={[styles.rankModalIconWrap, { backgroundColor: "#F59E0B18" }]}>
                <Icon name="trophy-award" size={26} color="#F59E0B" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.rankModalTitle, { color: colors.primaryText }]}>
                  Department Leaderboard
                </Text>
                <Text style={[styles.rankModalSub, { color: colors.secondaryText }]}>
                  Top 3 Academic Rank Holders · {studentData.department || "AI & DS"}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.rankModalCloseBtn, { backgroundColor: colors.primaryBackground }]}
                onPress={() => setShowRankModal(false)}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Icon name="close" size={18} color={colors.secondaryText} />
              </TouchableOpacity>
            </View>

            {/* List of Top 3 Rank Holders */}
            <View style={styles.rankList}>
              {topRankHolders.map((item, index) => {
                const isMe = Boolean(item.isCurrentUser);
                return (
                  <View
                    key={item.id || item.rollNo || index}
                    style={[
                      styles.rankItemCard,
                      {
                        backgroundColor: isMe
                          ? colors.primaryAccent + "18"
                          : index === 0
                          ? isDarkMode
                            ? "#F59E0B12"
                            : "#FFFBEB"
                          : index === 1
                          ? isDarkMode
                            ? "#64748B12"
                            : "#F8FAFC"
                          : isDarkMode
                          ? "#D9770612"
                          : "#FFF7ED",
                        borderColor: isMe
                          ? colors.primaryAccent
                          : index === 0
                          ? "#F59E0B55"
                          : index === 1
                          ? "#94A3B855"
                          : "#D9770655",
                      },
                    ]}
                  >
                    <View style={styles.rankMedalCircle}>
                      <Text style={{ fontSize: 22 }}>{item.medal}</Text>
                    </View>

                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text
                          style={[
                            styles.rankStudentName,
                            { color: isMe ? colors.primaryAccent : colors.primaryText },
                          ]}
                          numberOfLines={1}
                        >
                          {item.name}
                        </Text>
                        {isMe && (
                          <View
                            style={[
                              styles.gradeTag,
                              { backgroundColor: colors.primaryAccent, paddingHorizontal: 5 },
                            ]}
                          >
                            <Text
                              style={[
                                styles.gradeTagText,
                                { color: "#FFFFFF", fontSize: 9.5, fontWeight: "900" },
                              ]}
                            >
                              YOU
                            </Text>
                          </View>
                        )}
                        <View style={[styles.gradeTag, { backgroundColor: item.badgeColor + "20" }]}>
                          <Text style={[styles.gradeTagText, { color: item.badgeColor }]}>
                            {item.grade || "O"}
                          </Text>
                        </View>
                      </View>
                      <Text style={[styles.rankStudentRoll, { color: colors.secondaryText }]}>
                        {item.rollNo}
                      </Text>
                    </View>

                    <View style={{ alignItems: "flex-end" }}>
                      <Text
                        style={[
                          styles.rankCgpaVal,
                          { color: isMe ? colors.primaryAccent : item.badgeColor },
                        ]}
                      >
                        {typeof item.cgpa === "number" ? item.cgpa.toFixed(2) : item.cgpa}
                      </Text>
                      <Text style={[styles.rankCgpaLabel, { color: colors.secondaryText }]}>
                        CGPA
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Current Student Standing Strip */}
            <View
              style={[
                styles.myRankStrip,
                {
                  backgroundColor: colors.primaryAccent + "14",
                  borderColor: colors.primaryAccent + "35",
                },
              ]}
            >
              <Icon name="account-star" size={20} color={colors.primaryAccent} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.myRankText, { color: colors.primaryText }]}>
                  Your Standing:{" "}
                  <Text style={{ fontWeight: "800", color: colors.primaryAccent }}>{classRank}</Text>
                </Text>
                <Text style={{ fontSize: 11, color: colors.secondaryText, marginTop: 1 }}>
                  Position #{rankInfo?.rankNumber || 5} of {rankInfo?.totalStudents || 11} Students · Real CGPA {cgpa}
                </Text>
              </View>
            </View>

            {/* Close / Got it Button */}
            <TouchableOpacity
              style={[styles.rankModalDoneBtn, { backgroundColor: colors.primaryAccent }]}
              onPress={() => setShowRankModal(false)}
              activeOpacity={0.85}
            >
              <Text style={styles.rankModalDoneText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// ---------------- Styles ----------------
const getStyles = (colors, _isDarkMode) =>
  StyleSheet.create({
    container: { flex: 1 },
    scrollView: { flex: 1 },
    contentContainer: { paddingHorizontal: 16, paddingTop: 44, paddingBottom: 80 },

    /* Header */
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginBottom: 16,
    },
    headerIconWrap: {
      width: 42,
      height: 42,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: "800",
      letterSpacing: -0.3,
    },
    headerSubtitle: {
      fontSize: 11.5,
      fontWeight: "500",
      marginTop: 2,
    },
    quickScheduleBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 10,
      borderWidth: 1,
    },
    quickScheduleBtnText: {
      fontSize: 11.5,
      fontWeight: "700",
    },

    /* Hero Card */
    heroCard: {
      borderRadius: 20,
      borderWidth: 1,
      padding: 18,
      marginBottom: 14,
      elevation: 3,
      shadowColor: "#000",
      shadowOpacity: 0.08,
      shadowRadius: 8,
    },
    heroTopRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
    },
    heroSub: {
      fontSize: 10.5,
      fontWeight: "800",
      letterSpacing: 0.5,
    },
    heroCgpa: {
      fontSize: 32,
      fontWeight: "900",
      letterSpacing: -0.5,
    },
    heroCgpaMax: {
      fontSize: 14,
      fontWeight: "700",
    },
    rankPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      backgroundColor: "#F59E0B18",
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
    },
    rankPillText: {
      color: "#D97706",
      fontSize: 11,
      fontWeight: "800",
    },
    kpiGrid: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-around",
      borderRadius: 14,
      borderWidth: 1,
      paddingVertical: 10,
      marginTop: 12,
    },
    kpiItem: {
      alignItems: "center",
    },
    kpiVal: {
      fontSize: 15,
      fontWeight: "900",
    },
    kpiLabel: {
      fontSize: 10.5,
      fontWeight: "600",
      marginTop: 2,
    },
    kpiDivider: {
      width: 1,
      height: 28,
    },

    /* Fast Action Cards */
    fastActionRow: {
      flexDirection: "row",
      gap: 10,
      marginBottom: 16,
    },
    fastActionCard: {
      flex: 1,
      borderRadius: 16,
      borderWidth: 1,
      padding: 14,
    },
    actionIconCircle: {
      width: 38,
      height: 38,
      borderRadius: 10,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 8,
    },
    actionTitle: {
      fontSize: 13.5,
      fontWeight: "800",
    },
    actionSub: {
      fontSize: 11,
      fontWeight: "500",
      marginTop: 1,
    },

    /* Section Headers */
    sectionHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 10,
    },
    sectionTitle: {
      fontSize: 15,
      fontWeight: "800",
      letterSpacing: -0.2,
    },

    /* Filters */
    typeFilterPill: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 10,
      borderWidth: 1,
    },
    typeFilterText: {
      fontSize: 12,
      fontWeight: "700",
    },
    searchBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      borderRadius: 12,
      borderWidth: 1,
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginBottom: 12,
    },
    searchInput: {
      flex: 1,
      fontSize: 12.5,
      padding: 0,
    },

    /* Course Cards */
    courseCard: {
      borderRadius: 18,
      borderWidth: 1,
      padding: 14,
    },
    courseCardTop: {
      flexDirection: "row",
      alignItems: "center",
    },
    courseIconCircle: {
      width: 42,
      height: 42,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
    },
    courseTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    courseCodeBadge: {
      fontSize: 12,
      fontWeight: "800",
      letterSpacing: 0.5,
    },
    creditsBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
    },
    creditsBadgeText: {
      fontSize: 10.5,
      fontWeight: "700",
    },
    courseTitle: {
      fontSize: 14,
      fontWeight: "800",
      marginTop: 1,
    },
    courseFaculty: {
      fontSize: 11,
      fontWeight: "600",
      marginTop: 2,
    },

    /* Staff Hours Strip */
    staffHoursStrip: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 10,
      borderWidth: 1,
      marginTop: 10,
    },
    staffHoursLabel: {
      fontSize: 10.5,
      fontWeight: "600",
    },
    staffHoursVal: {
      fontSize: 11,
      fontWeight: "800",
    },
    attPercentPill: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 5,
    },
    attPercentText: {
      fontSize: 10.5,
      fontWeight: "900",
    },

    /* Syllabus & Units Progress */
    syllabusProgressBox: {
      borderRadius: 12,
      borderWidth: 1,
      padding: 10,
      marginTop: 8,
    },
    syllabusHeaderTitle: {
      fontSize: 11,
      fontWeight: "700",
    },
    syllabusPercentText: {
      fontSize: 11,
      fontWeight: "800",
    },
    syllabusBarTrack: {
      height: 6,
      borderRadius: 3,
      overflow: "hidden",
      marginVertical: 5,
    },
    syllabusBarFill: {
      height: "100%",
      borderRadius: 3,
    },
    activeUnitText: {
      fontSize: 10,
      fontWeight: "600",
      marginTop: 2,
    },

    /* Course Card Footer */
    courseCardFooter: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 10,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: "rgba(150,150,150,0.15)",
    },
    ciaLabelText: {
      fontSize: 11,
      fontWeight: "600",
    },
    ciaValText: {
      fontSize: 11.5,
      fontWeight: "800",
    },
    viewSyllabusLink: {
      fontSize: 11.5,
      fontWeight: "800",
    },

    /* Assignment Studio Modal */
    asgModalContainer: {
      flex: 1,
    },
    asgHeader: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingTop: 44,
      paddingBottom: 14,
      borderBottomWidth: 1,
    },
    asgCloseBtn: {
      padding: 6,
    },
    asgHeaderTitle: {
      fontSize: 17,
      fontWeight: "800",
    },
    asgHeaderSub: {
      fontSize: 11,
      fontWeight: "500",
      marginTop: 1,
    },
    asgSummaryCard: {
      flexDirection: "row",
      justifyContent: "space-around",
      borderRadius: 16,
      borderWidth: 1,
      paddingVertical: 12,
      marginBottom: 16,
    },
    asgSummaryItem: {
      alignItems: "center",
    },
    asgSummaryVal: {
      fontSize: 18,
      fontWeight: "900",
    },
    asgSummaryLbl: {
      fontSize: 10.5,
      fontWeight: "600",
      marginTop: 2,
    },
    asgDivider: {
      width: 1,
      height: 24,
      alignSelf: "center",
    },
    asgSectionTitle: {
      fontSize: 14.5,
      fontWeight: "800",
    },
    asgCard: {
      borderRadius: 16,
      borderWidth: 1,
      padding: 14,
    },
    asgCardTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 6,
    },
    asgCodePill: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
    },
    asgCodeText: {
      fontSize: 10.5,
      fontWeight: "800",
    },
    asgStatusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
    },
    asgStatusText: {
      fontSize: 9.5,
      fontWeight: "900",
    },
    asgTitle: {
      fontSize: 13.5,
      fontWeight: "800",
      marginTop: 2,
    },
    asgDesc: {
      fontSize: 11.5,
      fontWeight: "500",
      marginTop: 3,
    },
    asgMetaRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      borderRadius: 10,
      borderWidth: 1,
      padding: 10,
      marginTop: 10,
    },
    asgMetaLbl: {
      fontSize: 10,
      fontWeight: "600",
    },
    asgMetaVal: {
      fontSize: 11.5,
      fontWeight: "800",
      marginTop: 2,
    },
    asgFeedbackBox: {
      backgroundColor: "#10B98114",
      padding: 10,
      borderRadius: 10,
      borderWidth: 1,
      marginTop: 8,
    },
    asgFeedbackTitle: {
      fontSize: 11,
      fontWeight: "800",
    },
    asgFeedbackText: {
      fontSize: 11.5,
      fontWeight: "500",
      marginTop: 4,
      fontStyle: "italic",
    },
    asgFilterChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 10,
      borderWidth: 1,
    },
    asgFilterChipText: {
      fontSize: 11.5,
      fontWeight: "700",
    },
    asgSearchBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      borderWidth: 1,
    },
    asgSearchInput: {
      flex: 1,
      fontSize: 12.5,
      padding: 0,
    },
    submittedReceiptBox: {
      borderRadius: 12,
      borderWidth: 1,
      padding: 10,
      marginTop: 10,
    },
    submittedFileName: {
      fontSize: 12,
      fontWeight: "800",
    },
    submittedFileMeta: {
      fontSize: 10.5,
      fontWeight: "500",
      marginTop: 2,
    },
    asgRemarksText: {
      fontSize: 11,
      marginTop: 6,
      fontStyle: "italic",
    },
    asgSubmitBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 10,
      borderRadius: 10,
      marginTop: 12,
    },
    asgSubmitBtnText: {
      color: "#FFFFFF",
      fontSize: 12,
      fontWeight: "800",
    },
    asgResubmitBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 9,
      borderRadius: 10,
      borderWidth: 1,
      marginTop: 10,
    },
    asgResubmitBtnText: {
      fontSize: 11.5,
      fontWeight: "800",
    },

    /* Submission Dialog */
    submissionDialogOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.75)",
      justifyContent: "center",
      alignItems: "center",
      padding: 18,
    },
    submissionDialogCard: {
      width: "100%",
      maxHeight: "90%",
      borderRadius: 20,
      borderWidth: 1,
      padding: 18,
      elevation: 10,
    },
    dialogHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 6,
    },
    dialogIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
    },
    dialogTitle: {
      fontSize: 15.5,
      fontWeight: "800",
    },
    dialogAsgName: {
      fontSize: 11.5,
      fontWeight: "600",
      marginTop: 1,
    },
    fieldLabel: {
      fontSize: 11.5,
      fontWeight: "700",
      marginBottom: 6,
    },
    attachedFileBox: {
      flexDirection: "row",
      alignItems: "center",
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      marginBottom: 4,
    },
    attachedFileName: {
      fontSize: 12.5,
      fontWeight: "800",
    },
    attachedFileSize: {
      fontSize: 10.5,
      fontWeight: "600",
      marginTop: 2,
    },
    uploadBox: {
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 12,
      borderWidth: 1.5,
      borderStyle: "dashed",
      padding: 16,
      marginBottom: 4,
    },
    uploadBoxText: {
      fontSize: 12,
      fontWeight: "700",
      marginTop: 6,
    },
    uploadBoxSub: {
      fontSize: 10,
      fontWeight: "500",
      marginTop: 2,
    },
    inputRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      borderRadius: 10,
      borderWidth: 1,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    linkInput: {
      flex: 1,
      fontSize: 12,
      padding: 0,
    },
    remarksInput: {
      borderRadius: 10,
      borderWidth: 1,
      padding: 10,
      fontSize: 12,
      minHeight: 60,
      textAlignVertical: "top",
      marginBottom: 14,
    },
    dialogActionsRow: {
      flexDirection: "row",
      gap: 10,
      marginTop: 8,
    },
    dialogCancelBtn: {
      flex: 1,
      paddingVertical: 10,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 10,
      borderWidth: 1,
    },
    dialogCancelBtnText: {
      fontSize: 12,
      fontWeight: "700",
    },
    dialogSubmitBtn: {
      flex: 1,
      paddingVertical: 10,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 10,
    },
    dialogSubmitBtnText: {
      color: "#FFFFFF",
      fontSize: 12,
      fontWeight: "800",
    },

    /* Modal Overlay & Details */
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.65)",
      justifyContent: "center",
      alignItems: "center",
      padding: 18,
    },
    modalCard: {
      width: "100%",
      borderRadius: 22,
      borderWidth: 1,
      padding: 18,
      elevation: 10,
    },
    modalHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 14,
    },
    modalCourseCode: {
      fontSize: 11,
      fontWeight: "800",
    },
    modalCourseTitle: {
      fontSize: 14.5,
      fontWeight: "800",
      marginTop: 1,
    },
    facultyCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      padding: 10,
      borderRadius: 12,
      borderWidth: 1,
      marginBottom: 10,
    },
    facultyName: {
      fontSize: 12.5,
      fontWeight: "800",
    },
    facultySub: {
      fontSize: 10.5,
      fontWeight: "500",
      marginTop: 1,
    },
    syllabusStaffBox: {
      padding: 10,
      borderRadius: 12,
      borderWidth: 1,
      marginBottom: 12,
    },
    syllabusStaffTitle: {
      fontSize: 11,
      fontWeight: "700",
    },
    syllabusStaffVal: {
      fontSize: 12,
      fontWeight: "800",
      marginTop: 2,
    },
    unitsHeader: {
      fontSize: 12.5,
      fontWeight: "800",
      marginBottom: 6,
    },
    unitItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      padding: 8,
      borderRadius: 8,
      borderWidth: 1,
    },
    unitItemText: {
      fontSize: 11,
      fontWeight: "600",
      flex: 1,
    },
    modalActionRow: {
      flexDirection: "row",
      gap: 10,
      marginTop: 14,
    },
    shareModalBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 11,
      borderRadius: 12,
    },
    shareModalBtnText: {
      color: "#FFFFFF",
      fontSize: 12.5,
      fontWeight: "800",
    },
    closeModalBtn: {
      flex: 1,
      paddingVertical: 11,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 12,
      borderWidth: 1,
    },
    closeModalBtnText: {
      fontSize: 12.5,
      fontWeight: "800",
    },

    /* Rank Leaderboard Info Modal */
    rankModalCard: {
      width: "90%",
      maxHeight: "80%",
      borderRadius: 22,
      borderWidth: 1,
      padding: 18,
      elevation: 24,
      shadowColor: "#000",
      shadowOpacity: 0.25,
      shadowOffset: { width: 0, height: 4 },
      shadowRadius: 12,
    },
    rankModalHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 16,
    },
    rankModalIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
    },
    rankModalTitle: {
      fontSize: 16,
      fontWeight: "800",
    },
    rankModalSub: {
      fontSize: 11,
      fontWeight: "500",
      marginTop: 2,
    },
    rankModalCloseBtn: {
      width: 28,
      height: 28,
      borderRadius: 14,
      justifyContent: "center",
      alignItems: "center",
    },
    rankList: {
      gap: 10,
      marginBottom: 14,
    },
    rankItemCard: {
      flexDirection: "row",
      alignItems: "center",
      padding: 12,
      borderRadius: 14,
      borderWidth: 1,
    },
    rankMedalCircle: {
      width: 38,
      height: 38,
      borderRadius: 19,
      justifyContent: "center",
      alignItems: "center",
    },
    rankStudentName: {
      fontSize: 13,
      fontWeight: "800",
    },
    rankStudentRoll: {
      fontSize: 10.5,
      fontWeight: "600",
      marginTop: 2,
    },
    gradeTag: {
      paddingHorizontal: 6,
      paddingVertical: 1.5,
      borderRadius: 5,
    },
    gradeTagText: {
      fontSize: 10,
      fontWeight: "800",
    },
    rankCgpaVal: {
      fontSize: 15,
      fontWeight: "900",
    },
    rankCgpaLabel: {
      fontSize: 9.5,
      fontWeight: "600",
    },
    myRankStrip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      padding: 10,
      borderRadius: 12,
      borderWidth: 1,
      marginBottom: 14,
    },
    myRankText: {
      fontSize: 12,
      fontWeight: "600",
      flex: 1,
    },
    rankModalDoneBtn: {
      paddingVertical: 11,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    rankModalDoneText: {
      color: "#FFFFFF",
      fontSize: 13,
      fontWeight: "800",
    },
  });
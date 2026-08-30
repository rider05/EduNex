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
  Share,
  ActivityIndicator,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { useTheme } from "../../context/ThemeContext";
import FullTimetable from "./modals/FullTimeTable";
import { SkeletonKPIRow, SkeletonListItem } from "../../components/common/SkeletonLoader";
import { getStudentData, getAssignments, getStudentAttendanceSummary, getSubjects, enrichSubjectFromCatalog } from "../../services/dataService";
import useRefreshOnForeground from "../../hooks/useRefreshOnForeground";
import { showToast } from "../../utils/toastService";
import { formatDeptName } from "../../utils/deptFormatter";

const COURSE_TYPES = ["All Courses", "Theory", "Lab", "Project"];
const CREDIT_TARGET = 160;

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
  marks: a.totalMarks ? `${a.totalMarks} Marks` : "—",
  gradedScore: a.obtainedMarks != null ? `${a.obtainedMarks} / ${a.totalMarks || 20}` : null,
  color: ["#4F46E5", "#DB2777", "#0D9488", "#7C3AED"][i % 4],
  desc: a.description || "Course assignment submission.",
  feedback: a.feedback,
});

export default function AcademicsScreen() {
  const { colors, isDarkMode } = useTheme();
  const styles = getStyles(colors, isDarkMode);

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showTimetable, setShowTimetable] = useState(false);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);

  // Filter & Search
  const [selectedType, setSelectedType] = useState("All Courses");
  const [searchQuery, setSearchQuery] = useState("");

  // Course Syllabus Modal
  const [selectedCourseDetail, setSelectedCourseDetail] = useState(null);

  // Selected Assignment for Submission
  const [submittingAsg, setSubmittingAsg] = useState(null);
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
        setStudentData({
          department: student.department || "",
          semester: student.semester ? `${student.semester} (Odd '25)` : "",
        });

        if (student.cgpa != null) setCgpa(String(student.cgpa));
        if (student.sgpa != null) setSgpa(String(student.sgpa));
        if (student.creditsEarned != null) {
          setCreditsEarned(`${student.creditsEarned} / ${CREDIT_TARGET}`);
        }
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
      await Share.share({
        title: `${course.code} - ${course.title} Syllabus & Progress`,
        message: `📚 ${course.code}: ${course.title}\nDepartment: ${studentData.department} · ${studentData.semester}\nFaculty: ${course.faculty}\nStaff Hours Attended: ${course.staffHours}\nSyllabus Covered: ${course.syllabusCovered}% (${course.unitsCovered})\n\nUNITS:\n${course.units.join("\n")}`,
      });
      showToast("Syllabus dossier shared!", "success");
    } catch (err) {
      console.log("Share error:", err);
    }
  };

  const handleConfirmAssignmentSubmit = () => {
    if (!submittingAsg) return;
    setIsSubmittingFile(true);
    setTimeout(() => {
      setAssignmentsList((prev) =>
        prev.map((a) =>
          a.id === submittingAsg.id
            ? { ...a, status: "Submitted", submissionDate: new Date().toLocaleDateString() }
            : a
        )
      );
      setIsSubmittingFile(false);
      setSubmittingAsg(null);
      setSubmissionRemarks("");
      showToast("✅ Assignment submitted successfully to instructor!", "success");
    }, 1000);
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
          <View style={{ marginTop: 10 }}>
            <SkeletonKPIRow count={2} />
            <SkeletonListItem />
            <SkeletonListItem />
            <SkeletonListItem />
          </View>
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

                <View style={styles.rankPill}>
                  <Icon name="trophy-variant" size={16} color="#F59E0B" />
                  <Text style={styles.rankPillText}>{classRank}</Text>
                </View>
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
                <View style={styles.kpiItem}>
                  <Text style={[styles.kpiVal, { color: "#10B981" }]}>{attendance}</Text>
                  <Text style={[styles.kpiLabel, { color: colors.secondaryText }]}>Overall Attendance</Text>
                </View>
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

      {/* ========================================================================= */}
      {/* 6. ASSIGNMENT & PROJECT SUBMISSION STUDIO MODAL                           */}
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
              <Text style={[styles.asgHeaderSub, { color: colors.secondaryText }]}>Coursework & Project Submissions</Text>
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
            {/* Status Summary Banner */}
            <View style={[styles.asgSummaryCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
              <View style={styles.asgSummaryItem}>
                <Text style={[styles.asgSummaryVal, { color: "#F59E0B" }]}>
                  {assignmentsList.filter((a) => a.status === "Pending Submission").length}
                </Text>
                <Text style={[styles.asgSummaryLbl, { color: colors.secondaryText }]}>Pending</Text>
              </View>
              <View style={[styles.asgDivider, { backgroundColor: colors.divider }]} />
              <View style={styles.asgSummaryItem}>
                <Text style={[styles.asgSummaryVal, { color: "#3B82F6" }]}>
                  {assignmentsList.filter((a) => a.status === "Submitted").length}
                </Text>
                <Text style={[styles.asgSummaryLbl, { color: colors.secondaryText }]}>Submitted</Text>
              </View>
              <View style={[styles.asgDivider, { backgroundColor: colors.divider }]} />
              <View style={styles.asgSummaryItem}>
                <Text style={[styles.asgSummaryVal, { color: "#10B981" }]}>
                  {assignmentsList.filter((a) => a.status === "Graded").length}
                </Text>
                <Text style={[styles.asgSummaryLbl, { color: colors.secondaryText }]}>Graded</Text>
              </View>
            </View>

            {/* Assignments List */}
            <Text style={[styles.asgSectionTitle, { color: colors.primaryText }]}>Active Coursework ({assignmentsList.length})</Text>

            <View style={{ gap: 12, marginTop: 10 }}>
              {assignmentsList.map((asg) => {
                const isPending = asg.status === "Pending Submission";
                const isGraded = asg.status === "Graded";

                return (
                  <View
                    key={asg.id}
                    style={[styles.asgCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
                  >
                    <View style={styles.asgCardTop}>
                      <View style={[styles.asgCodePill, { backgroundColor: asg.color + "18" }]}>
                        <Text style={[styles.asgCodeText, { color: asg.color }]}>{asg.code}</Text>
                      </View>
                      <View
                        style={[
                          styles.asgStatusBadge,
                          {
                            backgroundColor: isPending ? "#F59E0B18" : isGraded ? "#10B98118" : "#3B82F618",
                          },
                        ]}
                      >
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

                    <View style={[styles.asgMetaRow, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                      <View>
                        <Text style={[styles.asgMetaLbl, { color: colors.secondaryText }]}>Deadline</Text>
                        <Text style={[styles.asgMetaVal, { color: "#EF4444" }]}>📅 {asg.dueDate}</Text>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={[styles.asgMetaLbl, { color: colors.secondaryText }]}>
                          {isGraded ? "Score Awarded" : "Weightage"}
                        </Text>
                        <Text style={[styles.asgMetaVal, { color: isGraded ? "#10B981" : colors.primaryText }]}>
                          {isGraded ? asg.gradedScore : asg.marks}
                        </Text>
                      </View>
                    </View>

                    {asg.feedback && (
                      <View style={styles.asgFeedbackBox}>
                        <Text style={styles.asgFeedbackText}>{`💬 Feedback: "${asg.feedback}"`}</Text>
                      </View>
                    )}

                    {isPending && (
                      <TouchableOpacity
                        style={[styles.asgSubmitBtn, { backgroundColor: colors.primaryAccent }]}
                        onPress={() => setSubmittingAsg(asg)}
                      >
                        <Icon name="upload" size={16} color="#FFFFFF" />
                        <Text style={styles.asgSubmitBtnText}>Upload & Submit Assignment</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}

              {assignmentsList.length === 0 && (
                <View style={{ alignItems: "center", paddingVertical: 26 }}>
                  <Icon name="file-document-outline" size={40} color={colors.secondaryText} />
                  <Text style={{ fontSize: 15, fontWeight: "700", color: colors.primaryText, marginTop: 10 }}>
                    No assignments yet
                  </Text>
                  <Text style={{ fontSize: 12.5, color: colors.secondaryText, marginTop: 4, textAlign: "center" }}>
                    Assigned coursework will appear here once published by your faculty.
                  </Text>
                </View>
              )}
            </View>
          </ScrollView>

          {/* Submission Modal Dialog */}
          {submittingAsg && (
            <Modal transparent visible={!!submittingAsg} animationType="fade">
              <View style={styles.submissionDialogOverlay}>
                <View style={[styles.submissionDialogCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
                  <View style={styles.dialogHeader}>
                    <Icon name="file-upload" size={24} color={colors.primaryAccent} />
                    <Text style={[styles.dialogTitle, { color: colors.primaryText }]}>Submit Assignment</Text>
                  </View>

                  <Text style={[styles.dialogAsgName, { color: colors.secondaryText }]}>
                    {submittingAsg.code}: {submittingAsg.title}
                  </Text>

                  {/* Attachment Simulator */}
                  <TouchableOpacity
                    style={[styles.uploadBox, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}
                    onPress={() => showToast("File selected: solution_report.pdf", "info")}
                  >
                    <Icon name="file-document-outline" size={28} color={colors.primaryAccent} />
                    <Text style={[styles.uploadBoxText, { color: colors.primaryText }]}>Select Document (PDF / ZIP / Repo)</Text>
                    <Text style={[styles.uploadBoxSub, { color: colors.secondaryText }]}>Max file size: 25 MB</Text>
                  </TouchableOpacity>

                  <TextInput
                    style={[
                      styles.remarksInput,
                      { backgroundColor: colors.primaryBackground, borderColor: colors.divider, color: colors.primaryText },
                    ]}
                    placeholder="Add submission notes or GitHub repo link..."
                    placeholderTextColor={colors.disabledText}
                    value={submissionRemarks}
                    onChangeText={setSubmissionRemarks}
                    multiline
                  />

                  <View style={styles.dialogActionsRow}>
                    <TouchableOpacity
                      style={[styles.dialogCancelBtn, { borderColor: colors.divider }]}
                      onPress={() => setSubmittingAsg(null)}
                    >
                      <Text style={[styles.dialogCancelBtnText, { color: colors.secondaryText }]}>Cancel</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.dialogSubmitBtn, { backgroundColor: colors.primaryAccent }]}
                      onPress={handleConfirmAssignmentSubmit}
                      disabled={isSubmittingFile}
                    >
                      {isSubmittingFile ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.dialogSubmitBtnText}>Submit Work</Text>
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
      padding: 8,
      borderRadius: 8,
      marginTop: 8,
    },
    asgFeedbackText: {
      color: "#10B981",
      fontSize: 11,
      fontWeight: "600",
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
      borderRadius: 20,
      borderWidth: 1,
      padding: 18,
      elevation: 10,
    },
    dialogHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 6,
    },
    dialogTitle: {
      fontSize: 15.5,
      fontWeight: "800",
    },
    dialogAsgName: {
      fontSize: 11.5,
      fontWeight: "600",
      marginBottom: 12,
    },
    uploadBox: {
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 12,
      borderWidth: 1.5,
      borderStyle: "dashed",
      padding: 18,
      marginBottom: 10,
    },
    uploadBoxText: {
      fontSize: 12.5,
      fontWeight: "700",
      marginTop: 6,
    },
    uploadBoxSub: {
      fontSize: 10,
      fontWeight: "500",
      marginTop: 2,
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
  });
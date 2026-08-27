import React, { useState, useCallback, useMemo } from "react";
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
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { useTheme } from "../../context/ThemeContext";
import FullTimetable from "./modals/FullTimeTable";
import AssessmentsReportsModal from "./modals/AssessmentsReportsModal";
import { SkeletonKPIRow, SkeletonListItem } from "../../components/common/SkeletonLoader";
import { getStudentData } from "../../services/dataService";
import useRefreshOnForeground from "../../hooks/useRefreshOnForeground";
import { showToast } from "../../utils/toastService";

// ---------------- Registered Semester Courses Dataset ----------------
const DEADLINES_DATA = [];

const COURSE_TYPES = ["All Courses", "Theory", "Lab", "Elective", "Project"];

export default function AcademicsScreen() {
  const { colors, isDarkMode } = useTheme();
  const styles = getStyles(colors, isDarkMode);

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showTimetable, setShowTimetable] = useState(false);
  const [showAssessments, setShowAssessments] = useState(false);

  // Filter & Search
  const [selectedType, setSelectedType] = useState("All Courses");
  const [searchQuery, setSearchQuery] = useState("");

  // Course Syllabus Modal
  const [selectedCourseDetail, setSelectedCourseDetail] = useState(null);

  // Live Metrics
  const [cgpa, setCgpa] = useState("");
  const [sgpa] = useState("");
  const [creditsEarned] = useState("");
  const [attendance, setAttendance] = useState("");
  const [classRank] = useState("");
  const [semesterCourses, setSemesterCourses] = useState([]);
  const [studentData, setStudentData] = useState({});

  const loadData = useCallback(async () => {
    try {
      const student = await getStudentData();
      if (student) {
        setStudentData({
          department: student.department || "",
          semester: student.semester || "",
        });
        if (student.attendance?.percentage) {
          setAttendance(student.attendance.percentage);
        }
        if (student.cgpa) {
          setCgpa(String(student.cgpa));
        }
        if (Array.isArray(student.subjects)) {
          setSemesterCourses(student.subjects.map((s, i) => ({
            id: `course_${i + 1}`,
            code: s.code || "",
            title: s.name || "",
            type: s.type || "Theory",
            credits: s.credits || 0,
            faculty: s.faculty || "",
            attendance: s.attendance || "",
            syllabusCovered: s.syllabusCovered || 0,
            ciaScore: s.ciaScore || "",
            gradeExpected: s.gradeExpected || "",
            color: s.color || "#4F46E5",
            icon: s.icon || "book-outline",
            units: s.units || [],
          })));
        }
      }
    } catch (err) {
      console.log("Error loading academics data:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
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
  }, [selectedType, searchQuery]);

  const handleShareSyllabus = async (course) => {
    try {
      await Share.share({
        title: `${course.code} - ${course.title} Syllabus`,
        message: `📚 ${course.code}: ${course.title}\nDepartment: ${studentData.department || "—"} · ${studentData.semester || "—"}\nCredits: ${course.credits}\nFaculty: ${course.faculty}\n\nUNITS:\n${course.units.join("\n")}`,
      });
      showToast("Syllabus shared!", "success");
    } catch (err) {
      console.log("Share error:", err);
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
            <Text style={[styles.headerSubtitle, { color: colors.secondaryText }]}>
              {studentData.department || "Academic Program"} · {studentData.semester || ""}
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
            {/* 2. ACADEMIC PERFORMANCE COMMAND HERO CARD                                */}
            {/* ========================================================================= */}
            <View style={[styles.heroCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
              <View style={styles.heroTopRow}>
                <View>
                  <Text style={[styles.heroSub, { color: colors.secondaryText }]}>CUMULATIVE GRADE POINT AVERAGE</Text>
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

              {/* 3-Col KPI Matrix */}
              <View style={[styles.kpiGrid, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                <View style={styles.kpiItem}>
                  <Text style={[styles.kpiVal, { color: "#10B981" }]}>{sgpa}</Text>
                  <Text style={[styles.kpiLabel, { color: colors.secondaryText }]}>Current SGPA</Text>
                </View>
                <View style={[styles.kpiDivider, { backgroundColor: colors.divider }]} />
                <View style={styles.kpiItem}>
                  <Text style={[styles.kpiVal, { color: colors.primaryText }]}>{creditsEarned}</Text>
                  <Text style={[styles.kpiLabel, { color: colors.secondaryText }]}>Credits Earned</Text>
                </View>
                <View style={[styles.kpiDivider, { backgroundColor: colors.divider }]} />
                <View style={styles.kpiItem}>
                  <Text style={[styles.kpiVal, { color: "#10B981" }]}>{attendance}</Text>
                  <Text style={[styles.kpiLabel, { color: colors.secondaryText }]}>Attendance</Text>
                </View>
              </View>
            </View>

            {/* ========================================================================= */}
            {/* 3. FAST ACTION LAUNCHERS                                                  */}
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
                <Text style={[styles.actionSub, { color: colors.secondaryText }]}>{"Odd '25 Sessions"}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.fastActionCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
                onPress={() => setShowAssessments(true)}
                activeOpacity={0.8}
              >
                <View style={[styles.actionIconCircle, { backgroundColor: "#10B98118" }]}>
                  <Icon name="clipboard-check-outline" size={20} color="#10B981" />
                </View>
                <Text style={[styles.actionTitle, { color: colors.primaryText }]}>CIA & Reports</Text>
                <Text style={[styles.actionSub, { color: colors.secondaryText }]}>Internal Marks</Text>
              </TouchableOpacity>
            </View>

            {/* ========================================================================= */}
            {/* 4. COURSEWORK DIRECTORY                                                   */}
            {/* ========================================================================= */}
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: colors.primaryText }]}>Enrolled Courses ({semesterCourses.length})</Text>
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
                placeholder="Search subject title, course code (e.g. AI8501)..."
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

            {/* Course Cards */}
            <View style={{ gap: 10 }}>
              {filteredCourses.map((course) => (
                <TouchableOpacity
                  key={course.id}
                  style={[styles.courseCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
                  onPress={() => setSelectedCourseDetail(course)}
                  activeOpacity={0.8}
                >
                  <View style={styles.courseCardTop}>
                    <View style={[styles.courseIconCircle, { backgroundColor: course.color }]}>
                      <Icon name={course.icon} size={20} color="#FFFFFF" />
                    </View>

                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <View style={styles.courseTitleRow}>
                        <Text style={[styles.courseCodeBadge, { color: course.color }]}>{course.code}</Text>
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

                  {/* Progress & CIA Score */}
                  <View style={[styles.courseMetricsRow, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                        <Text style={[styles.metricSmallLabel, { color: colors.secondaryText }]}>Syllabus Covered</Text>
                        <Text style={[styles.metricSmallVal, { color: colors.primaryText }]}>{course.syllabusCovered}%</Text>
                      </View>
                      <View style={[styles.miniProgressBarTrack, { backgroundColor: colors.cardBackground }]}>
                        <View style={[styles.miniProgressBarFill, { width: `${course.syllabusCovered}%`, backgroundColor: course.color }]} />
                      </View>
                    </View>

                    <View style={[styles.metricDividerVertical, { backgroundColor: colors.divider }]} />

                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={[styles.metricSmallLabel, { color: colors.secondaryText }]}>CIA Marks</Text>
                      <Text style={[styles.ciaVal, { color: colors.primaryAccent }]}>{course.ciaScore}</Text>
                    </View>
                  </View>

                  {/* Footer Row */}
                  <View style={styles.courseCardFooter}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Icon name="account-check" size={14} color="#10B981" />
                      <Text style={[styles.footerAttendanceText, { color: "#10B981" }]}>
                        {course.attendance} Attendance
                      </Text>
                    </View>

                    <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
                      <Text style={[styles.viewSyllabusText, { color: colors.primaryAccent }]}>Syllabus & Units</Text>
                      <Icon name="chevron-right" size={14} color={colors.primaryAccent} />
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {/* ========================================================================= */}
            {/* 5. CONTINUOUS ASSESSMENT DEADLINES TICKER                                */}
            {/* ========================================================================= */}
            <View style={[styles.sectionHeaderRow, { marginTop: 20 }]}>
              <Text style={[styles.sectionTitle, { color: colors.primaryText }]}>Assignment & Lab Deadlines</Text>
            </View>

            <View style={{ gap: 8 }}>
              {DEADLINES_DATA.map((dl) => (
                <View
                  key={dl.id}
                  style={[styles.deadlineCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
                >
                  <View style={[styles.deadlineStatusIndicator, { backgroundColor: dl.color }]} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[styles.deadlineTitle, { color: colors.primaryText }]}>{dl.title}</Text>
                    <Text style={[styles.deadlineCourse, { color: colors.secondaryText }]}>{dl.course}</Text>
                    <Text style={[styles.deadlineDue, { color: dl.color }]}>{dl.due}</Text>
                  </View>
                  <Icon name="chevron-right" size={18} color={colors.disabledText} />
                </View>
              ))}
            </View>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Full Timetable Modal */}
      <Modal
        visible={showTimetable}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowTimetable(false)}
      >
        <FullTimetable onClose={() => setShowTimetable(false)} />
      </Modal>

      {/* Assessments Modal */}
      <Modal
        visible={showAssessments}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAssessments(false)}
      >
        <AssessmentsReportsModal onClose={() => setShowAssessments(false)} />
      </Modal>

      {/* Course Syllabus Modal */}
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

                {/* Units List */}
                <Text style={[styles.unitsHeader, { color: colors.primaryText }]}>Prescribed Course Units</Text>
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
const getStyles = (colors, isDarkMode) =>
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
      height: 24,
    },

    /* Fast Action Row */
    fastActionRow: {
      flexDirection: "row",
      gap: 10,
      marginBottom: 16,
    },
    fastActionCard: {
      flex: 1,
      borderRadius: 16,
      borderWidth: 1,
      padding: 12,
      elevation: 1,
    },
    actionIconCircle: {
      width: 36,
      height: 36,
      borderRadius: 10,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 8,
    },
    actionTitle: {
      fontSize: 13,
      fontWeight: "800",
    },
    actionSub: {
      fontSize: 10.5,
      fontWeight: "500",
      marginTop: 2,
    },

    /* Section Header */
    sectionHeaderRow: {
      marginBottom: 10,
    },
    sectionTitle: {
      fontSize: 15,
      fontWeight: "800",
    },

    /* Course Filters */
    typeFilterPill: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
      borderWidth: 1,
    },
    typeFilterText: {
      fontSize: 11.5,
      fontWeight: "700",
    },

    /* Search Box */
    searchBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      borderWidth: 1,
      marginBottom: 12,
    },
    searchInput: {
      flex: 1,
      fontSize: 12.5,
      fontWeight: "500",
      padding: 0,
    },

    /* Course Cards */
    courseCard: {
      borderRadius: 16,
      borderWidth: 1,
      padding: 14,
      elevation: 2,
    },
    courseCardTop: {
      flexDirection: "row",
      alignItems: "flex-start",
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
      gap: 6,
      marginBottom: 2,
    },
    courseCodeBadge: {
      fontSize: 11.5,
      fontWeight: "900",
    },
    creditsBadge: {
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: 4,
    },
    creditsBadgeText: {
      fontSize: 9.5,
      fontWeight: "700",
    },
    courseTitle: {
      fontSize: 13.5,
      fontWeight: "800",
    },
    courseFaculty: {
      fontSize: 11,
      fontWeight: "500",
      marginTop: 2,
    },
    courseMetricsRow: {
      flexDirection: "row",
      alignItems: "center",
      padding: 10,
      borderRadius: 10,
      borderWidth: 1,
      marginVertical: 10,
    },
    metricSmallLabel: {
      fontSize: 10,
      fontWeight: "600",
    },
    metricSmallVal: {
      fontSize: 10.5,
      fontWeight: "800",
    },
    miniProgressBarTrack: {
      height: 5,
      borderRadius: 3,
      overflow: "hidden",
      width: "100%",
    },
    miniProgressBarFill: {
      height: "100%",
      borderRadius: 3,
    },
    metricDividerVertical: {
      width: 1,
      height: 24,
      marginHorizontal: 12,
    },
    ciaVal: {
      fontSize: 12.5,
      fontWeight: "900",
    },
    courseCardFooter: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    footerAttendanceText: {
      fontSize: 11,
      fontWeight: "700",
    },
    viewSyllabusText: {
      fontSize: 11.5,
      fontWeight: "700",
    },

    /* Deadlines */
    deadlineCard: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 14,
      borderWidth: 1,
      padding: 12,
    },
    deadlineStatusIndicator: {
      width: 4,
      height: 36,
      borderRadius: 2,
    },
    deadlineTitle: {
      fontSize: 13,
      fontWeight: "800",
    },
    deadlineCourse: {
      fontSize: 11,
      fontWeight: "500",
      marginTop: 1,
    },
    deadlineDue: {
      fontSize: 11,
      fontWeight: "700",
      marginTop: 2,
    },

    /* Syllabus Modal */
    modalOverlay: {
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
    modalHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
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
    },
    facultyCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      padding: 10,
      borderRadius: 12,
      borderWidth: 1,
      marginBottom: 12,
    },
    facultyName: {
      fontSize: 13,
      fontWeight: "800",
    },
    facultySub: {
      fontSize: 10.5,
      fontWeight: "500",
    },
    unitsHeader: {
      fontSize: 13,
      fontWeight: "800",
      marginBottom: 6,
    },
    unitItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      padding: 9,
      borderRadius: 10,
      borderWidth: 1,
    },
    unitItemText: {
      fontSize: 11.5,
      fontWeight: "600",
      flex: 1,
    },
    modalActionRow: {
      flexDirection: "row",
      gap: 8,
      marginTop: 16,
    },
    shareModalBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 12,
      borderRadius: 12,
    },
    shareModalBtnText: {
      color: "#FFFFFF",
      fontSize: 13,
      fontWeight: "800",
    },
    closeModalBtn: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
    },
    closeModalBtnText: {
      fontSize: 13,
      fontWeight: "800",
    },
  });
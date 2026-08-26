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
import { useTheme } from "../../context/ThemeContext";

// Data & Services
import { getStudentData, getGradeLevels, getParentNotices } from "../../services/dataService";
import { SkeletonScreenLoader } from "../../components/common/SkeletonLoader";
import useRefreshOnForeground from "../../hooks/useRefreshOnForeground";

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
  const [notices, setNotices] = useState([]);
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
      const [data, gradeLevels, noticesRes] = await Promise.all([
        getStudentData().catch(() => null),
        getGradeLevels().catch(() => []),
        getParentNotices().catch(() => []),
      ]);

      if (data) {
        setStudentData({
          name: data.name || "Student User",
          rollNo: data.rollNo || data.roll || "25ACSE001",
          department: data.department || "Artificial Intelligence & Data Science",
          semester: data.semester || "Semester V",
          grade: data.grade || "A+",
          cgpa: data.cgpa != null ? String(data.cgpa) : "3.76",
          dueFees: data.fees?.due != null ? `₹ ${Number(data.fees.due).toLocaleString("en-IN")}` : "₹ 0",
          attendance: data.attendance || { percentage: "92.4%", status: "Good Standing" },
          nextExam: data.nextExam || { subject: "Data Structures & Algorithms", date: "Oct 14, 2025" },
          library: data.library || { books: 2, dueIn: "4 Days" },
          subjects: Array.isArray(data.subjects) && data.subjects.length > 0
            ? data.subjects
            : [
                { name: "Data Preprocessing & Vis.", marks: 92, grade: "A+" },
                { name: "Data Structures & Algos", marks: 88, grade: "A" },
                { name: "Computer Networks", marks: 95, grade: "O" },
                { name: "Database Systems (DBMS)", marks: 89, grade: "A" },
                { name: "Design & Analysis of Algos", marks: 91, grade: "A+" },
              ],
          gradeLevels: Array.isArray(gradeLevels) && gradeLevels.length > 0
            ? gradeLevels
            : [
                { grade: "O", range: "91-100", meaning: "Outstanding" },
                { grade: "A+", range: "81-90", meaning: "Excellent" },
                { grade: "A", range: "71-80", meaning: "Very Good" },
                { grade: "B+", range: "61-70", meaning: "Good" },
                { grade: "B", range: "50-60", meaning: "Above Average" },
              ],
        });
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

  // Attendance string formatter
  const attendanceVal =
    typeof studentData.attendance === "object"
      ? studentData.attendance?.percentage || "92.4%"
      : studentData.attendance || "92.4%";

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
                  <Text style={[styles.studentName, { color: colors.primaryText }]} numberOfLines={1}>
                    {studentData.name}
                  </Text>
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
                <Text style={[styles.kpiValue, { color: "#8B5CF6" }]}>{attendanceVal}</Text>
                <Text style={[styles.kpiLabel, { color: colors.primaryText }]}>Attendance</Text>
                <Text style={[styles.kpiHint, { color: "#10B981", fontWeight: "700" }]}>Safe Zone</Text>
              </TouchableOpacity>
            </View>

            {/* Attendance Buffer Banner */}
            <View style={[styles.bufferBanner, { backgroundColor: "#10B98114", borderColor: "#10B98130" }]}>
              <Icon name="shield-check" size={18} color="#10B981" />
              <Text style={[styles.bufferBannerText, { color: colors.primaryText }]}>
                Attendance Buffer: You have <Text style={{ fontWeight: "800", color: "#10B981" }}>4 buffer leaves</Text> before reaching the 75% limit.
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
                  <Text style={[styles.liveBadgeText, { color: "#10B981" }]}>UPCOMING · 09:50 AM</Text>
                </View>
                <View style={[styles.roomPill, { backgroundColor: colors.primaryAccent + "18" }]}>
                  <Text style={[styles.roomPillText, { color: colors.primaryAccent }]}>Room AI-202</Text>
                </View>
              </View>

              <Text style={[styles.liveSubjectTitle, { color: colors.primaryText }]}>
                Data Structures & Algorithms
              </Text>
              <View style={styles.liveFacultyRow}>
                <Icon name="account-tie-outline" size={16} color={colors.secondaryText} />
                <Text style={[styles.liveFacultyText, { color: colors.secondaryText }]}>
                  Ms. Chandra Mohan · Dept of AI & DS
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
              {[
                { title: "Computer Networks Lab Report #4", due: "Due in 2 days", status: "pending", color: "#EF4444" },
                { title: "AI Ethics Case Study & Presentation", due: "Due this Friday", status: "in_progress", color: "#F59E0B" },
                { title: "DBMS SQL Normalization Assignment", due: "Submitted on Oct 10", status: "submitted", color: "#10B981" },
              ].map((item, idx) => (
                <View
                  key={idx}
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

            {(studentData.subjects || []).map((s, i) => (
              <View key={i} style={[styles.subjectRow, { borderBottomColor: colors.divider }]}>
                <Text style={[styles.subjectName, { color: colors.primaryText }]}>{s.name}</Text>
                <Text style={[styles.subjectMarks, { color: colors.secondaryText }]}>{s.marks}%</Text>
                <Text style={[styles.subjectGrade, { color: colors.primaryAccent }]}>{s.grade}</Text>
              </View>
            ))}
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

            {(studentData.gradeLevels || []).map((g, i) => (
              <View key={i} style={[styles.subjectRow, { borderBottomColor: colors.divider }]}>
                <Text style={[styles.subjectName, { color: colors.primaryText }]}>{g.grade}</Text>
                <Text style={[styles.subjectMarks, { color: colors.secondaryText }]}>{g.range}</Text>
                <Text style={[styles.subjectGrade, { color: colors.primaryAccent }]}>{g.meaning}</Text>
              </View>
            ))}
          </View>
        </Animated.View>
      </Modal>

      {/* ========================================================================= */}
      {/* SUB-MODAL 3: DIGITAL STUDENT ID CARD                                      */}
      {/* ========================================================================= */}
      <Modal visible={idCardModalVisible} transparent animationType="slide" onRequestClose={() => setIdCardModalVisible(false)}>
        <View style={styles.overlay}>
          <View style={[styles.idCardBox, { backgroundColor: colors.cardBackground }]}>
            {/* ID Card Top Band */}
            <View style={[styles.idCardBand, { backgroundColor: colors.primaryAccent }]}>
              <Text style={styles.idCardInstitution}>EDUNEX AUTONOMOUS CAMPUS</Text>
              <Text style={styles.idCardType}>STUDENT DIGITAL SMART PASS</Text>
            </View>

            <View style={styles.idCardBody}>
              <View style={styles.idCardMainRow}>
                <View style={[styles.idCardPhotoCircle, { backgroundColor: colors.primaryAccent + "22" }]}>
                  <Icon name="account-school" size={44} color={colors.primaryAccent} />
                </View>
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={[styles.idCardStudentName, { color: colors.primaryText }]}>{studentData.name}</Text>
                  <Text style={[styles.idCardRoll, { color: colors.primaryAccent }]}>ID: {studentData.rollNo}</Text>
                  <Text style={[styles.idCardDept, { color: colors.secondaryText }]}>{studentData.department}</Text>
                </View>
              </View>

              {/* Details Matrix */}
              <View style={[styles.idDetailsGrid, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                <View style={styles.idDetailCell}>
                  <Text style={[styles.idCellLabel, { color: colors.secondaryText }]}>Semester</Text>
                  <Text style={[styles.idCellValue, { color: colors.primaryText }]}>{studentData.semester}</Text>
                </View>
                <View style={styles.idDetailCell}>
                  <Text style={[styles.idCellLabel, { color: colors.secondaryText }]}>Blood Group</Text>
                  <Text style={[styles.idCellValue, { color: colors.primaryText }]}>O +ve</Text>
                </View>
                <View style={styles.idDetailCell}>
                  <Text style={[styles.idCellLabel, { color: colors.secondaryText }]}>Validity</Text>
                  <Text style={[styles.idCellValue, { color: "#10B981" }]}>2024 - 2028</Text>
                </View>
              </View>

              {/* Barcode Mock */}
              <View style={styles.barcodeWrapper}>
                <Icon name="barcode-scan" size={32} color={colors.primaryText} />
                <Text style={[styles.barcodeText, { color: colors.secondaryText }]}>
                  *{studentData.rollNo}*
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.closeIdBtn, { backgroundColor: colors.primaryAccent }]}
              onPress={() => setIdCardModalVisible(false)}
            >
              <Text style={styles.closeIdBtnText}>Close Digital Pass</Text>
            </TouchableOpacity>
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
      borderRadius: 22,
      overflow: "hidden",
      elevation: 10,
    },
    idCardBand: {
      paddingVertical: 12,
      alignItems: "center",
    },
    idCardInstitution: {
      color: "#fff",
      fontSize: 13,
      fontWeight: "900",
      letterSpacing: 0.8,
    },
    idCardType: {
      color: "#ffffffCC",
      fontSize: 10,
      fontWeight: "700",
      letterSpacing: 0.5,
      marginTop: 2,
    },
    idCardBody: {
      padding: 18,
    },
    idCardMainRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 14,
    },
    idCardPhotoCircle: {
      width: 60,
      height: 60,
      borderRadius: 30,
      justifyContent: "center",
      alignItems: "center",
    },
    idCardStudentName: {
      fontSize: 16,
      fontWeight: "900",
    },
    idCardRoll: {
      fontSize: 13,
      fontWeight: "800",
      marginTop: 2,
    },
    idCardDept: {
      fontSize: 12,
      fontWeight: "500",
      marginTop: 2,
    },
    idDetailsGrid: {
      flexDirection: "row",
      justifyContent: "space-between",
      borderRadius: 12,
      borderWidth: 1,
      padding: 10,
      marginBottom: 14,
    },
    idDetailCell: {
      alignItems: "center",
      flex: 1,
    },
    idCellLabel: {
      fontSize: 10.5,
      fontWeight: "600",
    },
    idCellValue: {
      fontSize: 12,
      fontWeight: "800",
      marginTop: 2,
    },
    barcodeWrapper: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 8,
    },
    barcodeText: {
      fontSize: 11,
      letterSpacing: 2,
      fontWeight: "700",
      marginTop: 2,
    },
    closeIdBtn: {
      paddingVertical: 12,
      alignItems: "center",
      marginHorizontal: 18,
      marginBottom: 18,
      borderRadius: 12,
    },
    closeIdBtnText: {
      color: "#fff",
      fontSize: 13,
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
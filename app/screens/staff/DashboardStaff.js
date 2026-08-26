import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Modal,
  Pressable,
  RefreshControl,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { useTheme } from "../../context/ThemeContext";

import AttendanceModal from "./modals/AttendanceModal";
import ReportsModal from "./modals/AssignmentReportModal";
import MessagesModal from "./modals/MessagesModal";
import ScheduleModal from "./modals/ScheduleModal";

import { getFacultyData, getStaffClassName } from "../../services/dataService";
import { api } from "../../services/api";
import { SkeletonScreenLoader } from "../../components/common/SkeletonLoader";
import useRefreshOnForeground from "../../hooks/useRefreshOnForeground";

// Reusable Dashboard Card component defined outside
function StaffDashboardCard({ title, value, iconName, color, onPress, colors }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () =>
    Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true }).start();
  const handlePressOut = () =>
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={onPress}
        style={[styles.card, { backgroundColor: colors.cardBackground, borderLeftColor: color }]}
      >
        <View style={styles.cardContent}>
          <View style={[styles.iconContainer, { backgroundColor: `${color}18` }]}>
            <Icon name={iconName} size={26} color={color} />
          </View>
          <View style={styles.textContainer}>
            <Text style={[styles.cardTitle, { color: colors.secondaryText }]}>{title}</Text>
            <Text style={[styles.cardValue, { color: colors.primaryText }]}>{value}</Text>
          </View>
          <View style={[styles.chevronBadge, { backgroundColor: colors.cardHighlight || "rgba(0,0,0,0.04)" }]}>
            <Icon name="chevron-right" size={20} color={colors.secondaryText} />
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// Smooth InfoPopup component defined outside
function StaffInfoPopup({ visible, title, icon, color, infoList, onClose, colors }) {
  const slideAnim = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, { toValue: 0, tension: 70, friction: 8, useNativeDriver: true }).start();
    } else {
      slideAnim.setValue(40);
    }
  }, [visible, slideAnim]);

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <View style={styles.popupWrapper}>
        <Animated.View
          style={[
            styles.popupContainer,
            {
              backgroundColor: colors.cardBackground,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View style={[styles.popupHeader, { backgroundColor: `${color}18` }]}>
            <Icon name={icon} size={26} color={color} />
            <Text style={[styles.popupTitle, { color }]}>{title}</Text>
          </View>

          <View style={styles.bulletList}>
            {infoList.map((item, index) => (
              <View key={index} style={styles.bulletRow}>
                <Text style={[styles.bulletDot, { color }]}>•</Text>
                <Text style={[styles.bulletText, { color: colors.primaryText }]}>
                  {item}
                </Text>
              </View>
            ))}
          </View>

          <Pressable
            style={[styles.closeButton, { backgroundColor: color }]}
            onPress={onClose}
          >
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

export default function DashboardStaff() {
  const { colors } = useTheme();

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modals
  const [attendanceVisible, setAttendanceVisible] = useState(false);
  const [reportsVisible, setReportsVisible] = useState(false);
  const [messagesVisible, setMessagesVisible] = useState(false);
  const [scheduleVisible, setScheduleVisible] = useState(false);

  // KPI popups
  const [classesPopupVisible, setClassesPopupVisible] = useState(false);
  const [studentsPopupVisible, setStudentsPopupVisible] = useState(false);
  const [staffData, setStaffData] = useState({
    staffName: "",
    department: "",
    className: "",
    todaySchedule: [],
    summary: { classesToday: 0, totalStudents: 0, pendingReports: 0 },
    quickActions: [
      { title: "Mark Attendance", value: "Loading…", iconName: "check-decagram", color: "#2ECC71" },
      { title: "Assignment Reports", value: "…", iconName: "file-document-edit", color: "#E67E22" },
      { title: "Messages", value: "…", iconName: "email-outline", color: "#3498DB" },
      { title: "Schedule", value: "…", iconName: "calendar-clock", color: "#9B59B6" },
    ],
  });

  const loadData = useCallback(async () => {
    try {
      const className = await getStaffClassName();
      const [facultyRes, attendanceRes, assignmentsRes] = await Promise.allSettled([
        getFacultyData(),
        className
          ? api.get("/attendance", { class: className, sort: "-date", limit: 100 })
          : api.get("/attendance", { sort: "-date", limit: 100 }),
        api.get("/assignments", { sort: "-createdAt", limit: 100 }),
      ]);

      const faculty = facultyRes.status === "fulfilled" ? facultyRes.value : null;
      const attendanceDocs =
        attendanceRes.status === "fulfilled" && Array.isArray(attendanceRes.value?.data)
          ? attendanceRes.value.data
          : [];
      const assignmentDocs =
        assignmentsRes.status === "fulfilled" && Array.isArray(assignmentsRes.value?.data)
          ? assignmentsRes.value.data
          : [];

      // Compute quick-action summaries from live data
      const todayStr = new Date().toISOString().slice(0, 10);
      const markedToday = attendanceDocs.some(
        (doc) => String(doc.date || "").slice(0, 10) === todayStr && (!className || (doc.class || doc.classSection) === className)
      );
      const pendingReports = assignmentDocs.filter(
        (a) => !String(a.status || a.submissionStatus || "").match(/graded|completed/i)
      ).length;
      const classLabel = className || "your classes";
      const nextClass = Array.isArray(faculty?.todaySchedule) ? faculty.todaySchedule[0] : null;

      setStaffData((prev) => ({
        ...prev,
        staffName: faculty?.name || prev.staffName,
        department: faculty?.department || prev.department,
        className: className || prev.className,
        todaySchedule: Array.isArray(faculty?.todaySchedule) ? faculty.todaySchedule : [],
        summary: {
          ...prev.summary,
          classesToday: Array.isArray(faculty?.todaySchedule)
            ? faculty.todaySchedule.length
            : prev.summary.classesToday,
          totalStudents:
            Array.isArray(faculty?.summary?.totalStudents) || faculty?.summary?.totalStudents != null
              ? Number(faculty.summary.totalStudents) || prev.summary.totalStudents
              : Array.isArray(faculty?.coursesTaught)
              ? faculty.coursesTaught.reduce((sum, c) => sum + (Number(c.studentsCount) || 0), 0) ||
                prev.summary.totalStudents
              : prev.summary.totalStudents,
          pendingReports:
            attendanceDocs.length > 0 || assignmentDocs.length > 0 ? pendingReports : prev.summary.pendingReports,
        },
        quickActions: prev.quickActions.map((action) => {
          if (action.title === "Mark Attendance") {
            return {
              ...action,
              value: markedToday ? `Marked for today (${classLabel})` : `Pending for 1 class (${classLabel})`,
            };
          }
          if (action.title === "Assignment Reports") {
            return {
              ...action,
              value:
                attendanceDocs.length > 0 || assignmentDocs.length > 0
                  ? `${pendingReports} reports pending`
                  : action.value,
            };
          }
          if (action.title === "Messages") {
            return { ...action, value: "Live from server" };
          }
          if (action.title === "Schedule" && nextClass) {
            return {
              ...action,
              value: `Next: ${nextClass.subject || nextClass.class || "Class"} (${nextClass.time || ""})`,
            };
          }
          return action;
        }),
      }));
    } catch (err) {
      console.log("Error loading staff data:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Refetch live data when the app returns to the foreground
  useRefreshOnForeground(loadData);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleActionPress = (title) => {
    switch (title) {
      case "Mark Attendance":
        setAttendanceVisible(true);
        break;
      case "Assignment Reports":
        setReportsVisible(true);
        break;
      case "Messages":
        setMessagesVisible(true);
        break;
      case "Schedule":
        setScheduleVisible(true);
        break;
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
            colors={[colors.primary]}
            tintColor={colors.primary}
            progressBackgroundColor={colors.cardBackground}
          />
        }
      >
        {isLoading ? (
          <SkeletonScreenLoader showProfile showKPIs listCount={4} />
        ) : (
          <>
            {/* Faculty Profile Banner */}
            <View style={[styles.facultyProfileCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
          <View style={styles.facultyHeaderRow}>
            <View style={[styles.facultyAvatar, { backgroundColor: `${colors.primary}20` }]}>
              <Icon name="account-tie" size={32} color={colors.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={[styles.facultyGreeting, { color: colors.secondaryText }]}>
                Welcome back,
              </Text>
              <Text style={[styles.facultyName, { color: colors.primaryText }]}>
                Prof. {staffData.staffName}
              </Text>
              <Text style={[styles.facultyMeta, { color: colors.disabledText }]}>
                Department of {staffData.department}
              </Text>
            </View>
          </View>
        </View>

        {/* KPI Section */}
        <View style={styles.kpiRow}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setClassesPopupVisible(true)}
            style={[styles.kpiBox, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
          >
            <View style={[styles.kpiIconWrap, { backgroundColor: "rgba(16, 185, 129, 0.15)" }]}>
              <Icon name="book-open-page-variant" size={22} color="#10B981" />
            </View>
            <Text style={[styles.kpiValue, { color: "#10B981" }]}>
              {staffData.summary.classesToday}
            </Text>
            <Text style={[styles.kpiLabel, { color: colors.secondaryText }]}>Classes Today</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setStudentsPopupVisible(true)}
            style={[styles.kpiBox, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
          >
            <View style={[styles.kpiIconWrap, { backgroundColor: "rgba(59, 130, 246, 0.15)" }]}>
              <Icon name="account-group" size={22} color="#3B82F6" />
            </View>
            <Text style={[styles.kpiValue, { color: "#3B82F6" }]}>
              {staffData.summary.totalStudents}
            </Text>
            <Text style={[styles.kpiLabel, { color: colors.secondaryText }]}>Total Students</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Actions */}
        <Text style={[styles.sectionTitle, { color: colors.primaryText }]}>
          Quick Actions & Tools
        </Text>
        {staffData.quickActions.map((action, index) => (
          <StaffDashboardCard
            key={index}
            title={action.title}
            value={action.value}
            iconName={action.iconName}
            color={action.color}
            onPress={() => handleActionPress(action.title)}
            colors={colors}
          />
        ))}
        </>
        )}

        <View style={{ height: 40 }} />

        {/* Popups */}
        <StaffInfoPopup
          visible={classesPopupVisible}
          onClose={() => setClassesPopupVisible(false)}
          title="Today's Teaching Schedule"
          icon="book-open-page-variant"
          color="#10B981"
          infoList={
            (staffData.todaySchedule || []).length > 0
              ? staffData.todaySchedule.map(
                  (s) => `${s.subject || s.class || "Class"} - ${s.time || ""}${s.room ? ` (${s.room})` : ""}`
                )
              : ["No classes scheduled for today"]
          }
          colors={colors}
        />

        <StaffInfoPopup
          visible={studentsPopupVisible}
          onClose={() => setStudentsPopupVisible(false)}
          title="Active Students Roster"
          icon="account-group"
          color="#3B82F6"
          infoList={[
            `Total Registered: ${staffData.summary.totalStudents} Students`,
            ...(staffData.className ? [`Class: ${staffData.className}`] : []),
          ]}
          colors={colors}
        />

        {/* Modals */}
        <AttendanceModal
          visible={attendanceVisible}
          onClose={() => setAttendanceVisible(false)}
          colors={colors}
        />
        <ReportsModal
          visible={reportsVisible}
          onClose={() => setReportsVisible(false)}
          colors={colors}
        />
        <MessagesModal
          visible={messagesVisible}
          onClose={() => setMessagesVisible(false)}
          colors={colors}
        />
        <ScheduleModal
          visible={scheduleVisible}
          onClose={() => setScheduleVisible(false)}
          colors={colors}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  contentContainer: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 80 },
  facultyProfileCard: {
    borderRadius: 20,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  facultyHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  facultyAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    justifyContent: "center",
    alignItems: "center",
  },
  facultyGreeting: { fontSize: 13, fontWeight: "600" },
  facultyName: { fontSize: 20, fontWeight: "800", marginTop: 2 },
  facultyMeta: { fontSize: 13, marginTop: 2, fontWeight: "500" },
  kpiRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
    gap: 12,
  },
  kpiBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  kpiIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },
  kpiValue: { fontSize: 22, fontWeight: "900", marginBottom: 2 },
  kpiLabel: { fontSize: 12, fontWeight: "700" },
  sectionTitle: { fontSize: 18, fontWeight: "800", marginBottom: 14, letterSpacing: -0.3 },
  card: {
    borderRadius: 16,
    marginBottom: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderLeftWidth: 4,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  cardContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconContainer: {
    width: 46,
    height: 46,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  textContainer: { flex: 1 },
  cardTitle: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  cardValue: { fontSize: 15, fontWeight: "800", marginTop: 3 },
  chevronBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  popupWrapper: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  popupContainer: {
    width: "88%",
    borderRadius: 24,
    padding: 22,
    elevation: 10,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  popupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 14,
    marginBottom: 16,
  },
  popupTitle: { fontSize: 17, fontWeight: "800" },
  bulletList: { marginBottom: 20 },
  bulletRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 8 },
  bulletDot: { fontSize: 16, marginRight: 8, marginTop: 1 },
  bulletText: { fontSize: 14, flex: 1, lineHeight: 20, fontWeight: "500" },
  closeButton: {
    alignSelf: "center",
    paddingVertical: 10,
    paddingHorizontal: 32,
    borderRadius: 12,
    elevation: 2,
  },
  closeText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
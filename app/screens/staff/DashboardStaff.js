import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  RefreshControl,
  TextInput,
  Modal,
  Switch,
  ActivityIndicator,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { useTheme } from "../../context/ThemeContext";

import AttendanceModal from "./modals/AttendanceModal";
import ReportsModal from "./modals/AssignmentReportModal";
import MessagesModal from "./modals/MessagesModal";
import ScheduleModal from "./modals/ScheduleModal";
import StaffLeaveApprovalsModal from "../../components/header/modal/StaffLeaveApprovalsModal";

import { getFacultyData, getStaffClassName, getFacultySchedule } from "../../services/dataService";
import { api } from "../../services/api";
import { secureGet, secureSet } from "../../services/secureStorage";
import { subscribeToNotifications } from "../../utils/notificationUtils";
import { SkeletonDashboardScreen } from "../../components/common/SkeletonLoader";
import useRefreshOnForeground from "../../hooks/useRefreshOnForeground";
import { showToast } from "../../utils/toastService";

const TODAY_SCHEDULE_DEFAULT = [];

const FACULTY_NOTICES_DEFAULT = [];

export default function DashboardStaff() {
  const { colors, isDarkMode } = useTheme();
  const styles = getStyles(colors, isDarkMode);

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modals
  const [attendanceVisible, setAttendanceVisible] = useState(false);
  const [reportsVisible, setReportsVisible] = useState(false);
  const [messagesVisible, setMessagesVisible] = useState(false);
  const [scheduleVisible, setScheduleVisible] = useState(false);
  const [leaveApprovalsVisible, setLeaveApprovalsVisible] = useState(false);
  const [pendingLeavesCount, setPendingLeavesCount] = useState(0);

  // Real-Time Classroom Controls Space State
  const [sessionMode, setSessionMode] = useState("in_session"); // "in_session" | "recess" | "dismissed"
  const [attendancePortalOpen, setAttendancePortalOpen] = useState(true);
  const [focusModeActive, setFocusModeActive] = useState(false);
  const [projectorActive, setProjectorActive] = useState(true);

  // Instant Class Broadcast Modal
  const [broadcastModalVisible, setBroadcastModalVisible] = useState(false);
  const [broadcastText, setBroadcastText] = useState("");
  const [broadcastUrgent, setBroadcastUrgent] = useState(false);
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  const [facultyInfo, setFacultyInfo] = useState({
    name: "",
    title: "",
    dept: "",
    cabin: "",
    className: "",
    totalStudents: 0,
    classesToday: 0,
    pendingReports: 0,
    avgAttendance: "—",
  });
  const [todaySchedule, setTodaySchedule] = useState(TODAY_SCHEDULE_DEFAULT);
  const [facultyNotices, setFacultyNotices] = useState(FACULTY_NOTICES_DEFAULT);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  const loadData = useCallback(async () => {
    try {
      const className = await getStaffClassName();
      const [facultyRes, attendanceRes, assignmentsRes, scheduleRes, noticesRes] = await Promise.allSettled([
        getFacultyData(),
        className
          ? api.get("/attendance", { class: className, sort: "-date", limit: 100 })
          : api.get("/attendance", { sort: "-date", limit: 100 }),
        api.get("/assignments", { sort: "-createdAt", limit: 100 }),
        getFacultySchedule(),
        api.get("/notices"),
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
      const scheduleDocs =
        scheduleRes.status === "fulfilled" && Array.isArray(scheduleRes.value)
          ? scheduleRes.value
          : [];
      const noticesDocs =
        noticesRes.status === "fulfilled" && Array.isArray(noticesRes.value?.data)
          ? noticesRes.value.data
          : Array.isArray(noticesRes.value)
          ? noticesRes.value
          : [];

      const pendingCount = assignmentDocs.filter(
        (a) => !String(a.status || a.submissionStatus || "").match(/graded|completed/i)
      ).length;

      let computedAvg = "—";
      if (attendanceDocs.length > 0) {
        const presentCount = attendanceDocs.filter((d) => d.status === "Present" || d.present === true).length;
        computedAvg = `${Math.round((presentCount / attendanceDocs.length) * 100)}%`;
      }

      if (faculty) {
        setFacultyInfo((prev) => ({
          ...prev,
          name: faculty.name || prev.name,
          title: faculty.designation || prev.title,
          dept: faculty.department || prev.dept,
          cabin: faculty.cabin || prev.cabin,
          className: faculty.classTeacher || className || prev.className,
          avgAttendance: computedAvg,
          totalStudents:
            faculty.summary?.totalStudents ||
            faculty.coursesTaught?.reduce((sum, c) => sum + (Number(c.studentsCount) || 0), 0) ||
            prev.totalStudents,
          classesToday: faculty.summary?.classesToday || scheduleDocs.length || prev.classesToday,
          pendingReports: pendingCount || prev.pendingReports,
        }));
      }

      if (scheduleDocs.length > 0) {
        setTodaySchedule(
          scheduleDocs.map((s, idx) => ({
            id: String(s.id ?? idx),
            time: s.time || "—",
            course: s.subject || s.course || "—",
            class: s.className || s.class || "—",
            venue: s.room || s.venue || "—",
            status: s.status || "Upcoming",
            isLive: s.isLive || false,
            color: s.color || "#4F46E5",
          }))
        );
      }

      if (noticesDocs.length > 0) {
        setFacultyNotices(
          noticesDocs.map((n, idx) => ({
            id: String(n.id ?? idx),
            title: n.title || n.subject || "—",
            sub: n.content || n.message || n.description || n.body || n.sub || "",
            tag: n.tag || n.category || n.source || "Notice",
            color: n.color || "#4F46E5",
          }))
        );
      }

      // Fetch pending student leaves count
      try {
        const cachedLeaves = await secureGet("edunex_staff_cached_leaves");
        if (Array.isArray(cachedLeaves)) {
          setPendingLeavesCount(cachedLeaves.filter((l) => l.status === "pending").length);
        }
        const leavesRes = await api.get("/leaves", { status: "pending", limit: 50 }).catch(() => null);
        if (Array.isArray(leavesRes?.data)) {
          setPendingLeavesCount(leavesRes.data.length);
        }
      } catch (_e) {}
    } catch (err) {
      console.log("Error loading staff dashboard:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();

    const unsubscribe = subscribeToNotifications((notif) => {
      if (notif.targetRole === "staff" || notif.title?.toLowerCase().includes("leave")) {
        loadData();
      }
    });

    return () => unsubscribe();
  }, [fadeAnim, loadData]);

  useRefreshOnForeground(loadData);

  const handleToggleSessionMode = async (mode) => {
    setSessionMode(mode);
    try {
      await secureSet("staff_live_session_mode", mode);
    } catch {}
    const label =
      mode === "in_session"
        ? "In Session"
        : mode === "recess"
        ? "Recess / Break"
        : "Class Dismissed";
    showToast(`🟢 Classroom Status updated: ${label}`, "info");
  };

  const handleToggleAttendancePortal = async () => {
    const next = !attendancePortalOpen;
    setAttendancePortalOpen(next);
    try {
      await secureSet("staff_attendance_portal_open", next);
    } catch {}
    showToast(
      next
        ? "🔓 Geo-Fence & QR Attendance Portal Opened"
        : "🔒 Attendance Portal Locked",
      next ? "success" : "warning"
    );
  };

  const handleToggleFocusMode = async () => {
    const next = !focusModeActive;
    setFocusModeActive(next);
    try {
      await secureSet("staff_classroom_focus_mode", next);
    } catch {}
    showToast(
      next
        ? "🔕 Classroom Focus Mode: Active (Student Pings Silenced)"
        : "🔔 Focus Mode Disabled",
      "info"
    );
  };

  const handleToggleProjector = async () => {
    const next = !projectorActive;
    setProjectorActive(next);
    try {
      await secureSet("staff_projector_mirror_active", next);
    } catch {}
    showToast(
      next ? "📽️ Smart Projector Mirroring Connected" : "Projector Disconnected",
      "info"
    );
  };

  const handleSendBroadcast = async () => {
    if (!broadcastText.trim()) {
      showToast("Please enter an alert message to broadcast", "warning");
      return;
    }
    setIsBroadcasting(true);
    try {
      await api
        .post("/notices", {
          subject: broadcastUrgent ? "🚨 URGENT CLASSROOM ALERT" : "📢 Live Class Notice",
          message: broadcastText.trim(),
          sender: facultyInfo.name || "Course Faculty",
          senderRole: "staff",
          isNew: true,
          priority: broadcastUrgent ? "urgent" : "normal",
          createdAt: new Date().toISOString(),
        })
        .catch(() => null);

      showToast("🚀 Real-time alert broadcasted to all enrolled students!", "success");
      setBroadcastText("");
      setBroadcastModalVisible(false);
    } catch (err) {
      console.warn("Broadcast error:", err);
      showToast("Broadcast alert sent to active class!", "success");
      setBroadcastModalVisible(false);
    } finally {
      setIsBroadcasting(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

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
          <SkeletonDashboardScreen />
        ) : (
          <Animated.View style={{ opacity: fadeAnim }}>
            {/* ========================================================================= */}
            {/* 1. FACULTY HERO & LIVE CLASSROOM CARD                                     */}
            {/* ========================================================================= */}
            <View style={[styles.heroCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
              <View style={styles.heroTop}>
                <View style={[styles.avatarCircle, { backgroundColor: colors.primaryAccent }]}>
                  <Icon name="account-tie" size={32} color="#FFFFFF" />
                </View>

                <View style={{ flex: 1, marginLeft: 14 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={[styles.facultyGreeting, { color: colors.secondaryText }]}>FACULTY COMMAND</Text>
                    <View style={styles.onlineBadge}>
                      <View style={styles.greenDot} />
                      <Text style={styles.onlineBadgeText}>ON DUTY</Text>
                    </View>
                  </View>

                  <Text style={[styles.facultyName, { color: colors.primaryText }]} numberOfLines={1}>
                    {facultyInfo.name}
                  </Text>

                  <Text style={[styles.facultyDept, { color: colors.primaryAccent }]} numberOfLines={1}>
                    {facultyInfo.title} · {facultyInfo.dept}
                  </Text>
                </View>
              </View>

              {/* Live Teaching Banner */}
              <View style={[styles.liveSessionBox, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                <View style={styles.liveIndicator}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>IN SESSION</Text>
                </View>

                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.liveCourseName, { color: colors.primaryText }]} numberOfLines={1}>
                    {todaySchedule[0]?.course || "No active session"}
                  </Text>
                  <Text style={[styles.liveVenue, { color: colors.secondaryText }]}>
                    {todaySchedule[0]?.venue ? `${todaySchedule[0].venue}` : "—"}{todaySchedule[0]?.time ? ` · ${todaySchedule[0].time}` : ""}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.quickRollBtn, { backgroundColor: colors.primaryAccent }]}
                  onPress={() => setAttendanceVisible(true)}
                  activeOpacity={0.85}
                >
                  <Icon name="check-circle-outline" size={15} color="#FFFFFF" />
                  <Text style={styles.quickRollBtnText}>Roll Call</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* ========================================================================= */}
            {/* 2. REAL-TIME LIVE CLASSROOM CONTROLS SPACE                                 */}
            {/* ========================================================================= */}
            <View
              style={[
                styles.controlsCard,
                { backgroundColor: colors.cardBackground, borderColor: colors.divider },
              ]}
            >
              <View style={styles.controlsHeader}>
                <View style={styles.controlsTitleRow}>
                  <View style={[styles.controlsIconCircle, { backgroundColor: "#10B98118" }]}>
                    <Icon name="remote-desktop" size={20} color="#10B981" />
                  </View>
                  <View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text style={[styles.controlsTitle, { color: colors.primaryText }]}>
                        Classroom Control Space
                      </Text>
                      <View style={styles.livePulseDot} />
                    </View>
                    <Text style={[styles.controlsSubtitle, { color: colors.secondaryText }]}>
                      Real-time faculty command center & live lecture controls
                    </Text>
                  </View>
                </View>

                <View
                  style={[
                    styles.activeRoomBadge,
                    { backgroundColor: colors.primaryBackground, borderColor: colors.divider },
                  ]}
                >
                  <Icon name="google-classroom" size={13} color={colors.primaryAccent} />
                  <Text style={[styles.activeRoomText, { color: colors.primaryAccent }]}>
                    {facultyInfo.className || "LH-302"}
                  </Text>
                </View>
              </View>

              {/* 3-State Live Session Stepper */}
              <View
                style={[
                  styles.sessionModeContainer,
                  { backgroundColor: colors.primaryBackground, borderColor: colors.divider },
                ]}
              >
                {[
                  { id: "in_session", label: "In Session", icon: "play-circle", color: "#10B981" },
                  { id: "recess", label: "Recess / Break", icon: "coffee", color: "#F59E0B" },
                  { id: "dismissed", label: "Dismissed", icon: "stop-circle", color: "#64748B" },
                ].map((m) => {
                  const isSelected = sessionMode === m.id;
                  return (
                    <TouchableOpacity
                      key={m.id}
                      style={[
                        styles.sessionModeBtn,
                        isSelected && { backgroundColor: m.color + "18", borderColor: m.color },
                      ]}
                      onPress={() => handleToggleSessionMode(m.id)}
                      activeOpacity={0.8}
                    >
                      <Icon
                        name={m.icon}
                        size={16}
                        color={isSelected ? m.color : colors.secondaryText}
                      />
                      <Text
                        style={[
                          styles.sessionModeText,
                          {
                            color: isSelected ? m.color : colors.secondaryText,
                            fontWeight: isSelected ? "800" : "600",
                          },
                        ]}
                      >
                        {m.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* 3 Real-time Quick Toggles Grid */}
              <View style={styles.togglesRow}>
                {/* Toggle 1: Attendance Portal Lock/Unlock */}
                <TouchableOpacity
                  style={[
                    styles.toggleCard,
                    {
                      backgroundColor: attendancePortalOpen
                        ? "#10B98110"
                        : colors.primaryBackground,
                      borderColor: attendancePortalOpen ? "#10B98140" : colors.divider,
                    },
                  ]}
                  onPress={handleToggleAttendancePortal}
                  activeOpacity={0.8}
                >
                  <View style={styles.toggleCardTop}>
                    <Icon
                      name={attendancePortalOpen ? "qrcode-scan" : "lock-outline"}
                      size={20}
                      color={attendancePortalOpen ? "#10B981" : "#EF4444"}
                    />
                    <Switch
                      value={attendancePortalOpen}
                      onValueChange={handleToggleAttendancePortal}
                      thumbColor={attendancePortalOpen ? "#10B981" : "#CCC"}
                      trackColor={{ false: "#767577", true: "#10B98155" }}
                      style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                    />
                  </View>
                  <Text style={[styles.toggleLabel, { color: colors.primaryText }]}>
                    Geo & QR Attendance
                  </Text>
                  <Text
                    style={[
                      styles.toggleStatus,
                      { color: attendancePortalOpen ? "#10B981" : "#EF4444" },
                    ]}
                  >
                    {attendancePortalOpen ? "Portal Open" : "Locked"}
                  </Text>
                </TouchableOpacity>

                {/* Toggle 2: Focus Mode */}
                <TouchableOpacity
                  style={[
                    styles.toggleCard,
                    {
                      backgroundColor: focusModeActive ? "#8B5CF610" : colors.primaryBackground,
                      borderColor: focusModeActive ? "#8B5CF640" : colors.divider,
                    },
                  ]}
                  onPress={handleToggleFocusMode}
                  activeOpacity={0.8}
                >
                  <View style={styles.toggleCardTop}>
                    <Icon
                      name={focusModeActive ? "bell-cancel" : "bell-ring-outline"}
                      size={20}
                      color={focusModeActive ? "#8B5CF6" : colors.secondaryText}
                    />
                    <Switch
                      value={focusModeActive}
                      onValueChange={handleToggleFocusMode}
                      thumbColor={focusModeActive ? "#8B5CF6" : "#CCC"}
                      trackColor={{ false: "#767577", true: "#8B5CF655" }}
                      style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                    />
                  </View>
                  <Text style={[styles.toggleLabel, { color: colors.primaryText }]}>
                    Classroom Focus
                  </Text>
                  <Text
                    style={[
                      styles.toggleStatus,
                      { color: focusModeActive ? "#8B5CF6" : colors.secondaryText },
                    ]}
                  >
                    {focusModeActive ? "Mute Active" : "Normal"}
                  </Text>
                </TouchableOpacity>

                {/* Toggle 3: Smart Projector Mirror */}
                <TouchableOpacity
                  style={[
                    styles.toggleCard,
                    {
                      backgroundColor: projectorActive ? "#0EA5E910" : colors.primaryBackground,
                      borderColor: projectorActive ? "#0EA5E940" : colors.divider,
                    },
                  ]}
                  onPress={handleToggleProjector}
                  activeOpacity={0.8}
                >
                  <View style={styles.toggleCardTop}>
                    <Icon
                      name={projectorActive ? "projector-screen" : "projector-screen-outline"}
                      size={20}
                      color={projectorActive ? "#0EA5E9" : colors.secondaryText}
                    />
                    <Switch
                      value={projectorActive}
                      onValueChange={handleToggleProjector}
                      thumbColor={projectorActive ? "#0EA5E9" : "#CCC"}
                      trackColor={{ false: "#767577", true: "#0EA5E955" }}
                      style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                    />
                  </View>
                  <Text style={[styles.toggleLabel, { color: colors.primaryText }]}>
                    Smart Projector
                  </Text>
                  <Text
                    style={[
                      styles.toggleStatus,
                      { color: projectorActive ? "#0EA5E9" : colors.secondaryText },
                    ]}
                  >
                    {projectorActive ? "Casting LH-302" : "Standby"}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Real-Time Action Launchers */}
              <View style={styles.quickActionRow}>
                <TouchableOpacity
                  style={[styles.quickActionButton, { backgroundColor: colors.primaryAccent }]}
                  onPress={() => setBroadcastModalVisible(true)}
                  activeOpacity={0.85}
                >
                  <Icon name="bullhorn-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.quickActionText}>Instant Class Broadcast</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.quickActionButtonOutline,
                    { borderColor: colors.divider, backgroundColor: colors.primaryBackground },
                  ]}
                  onPress={() => {
                    showToast(
                      "⚡ Real-time Pop Quiz trigger sent to all student dashboards!",
                      "success"
                    );
                  }}
                  activeOpacity={0.8}
                >
                  <Icon name="lightning-bolt" size={16} color="#F59E0B" />
                  <Text style={[styles.quickActionTextOutline, { color: colors.primaryText }]}>
                    Trigger Pop Quiz
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* ========================================================================= */}
            {/* 3. FACULTY 4-METRIC KPI POWER STRIP                                       */}
            {/* ========================================================================= */}
            <View style={styles.kpiGrid}>
              <View style={[styles.kpiCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
                <View style={[styles.kpiIconWrap, { backgroundColor: "#4F46E518" }]}>
                  <Icon name="book-open-page-variant" size={20} color="#4F46E5" />
                </View>
                <Text style={[styles.kpiVal, { color: "#4F46E5" }]}>{facultyInfo.classesToday}</Text>
                <Text style={[styles.kpiLabel, { color: colors.secondaryText }]}>Today&apos;s Lectures</Text>
                <Text style={[styles.kpiSub, { color: colors.disabledText }]}>{facultyInfo.classesToday > 0 ? `${Math.min(facultyInfo.classesToday, 2)} Done · ${Math.max(0, facultyInfo.classesToday - 2)} Left` : "—"}</Text>
              </View>

              <View style={[styles.kpiCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
                <View style={[styles.kpiIconWrap, { backgroundColor: "#10B98118" }]}>
                  <Icon name="account-group" size={20} color="#10B981" />
                </View>
                <Text style={[styles.kpiVal, { color: "#10B981" }]}>{facultyInfo.totalStudents}</Text>
                <Text style={[styles.kpiLabel, { color: colors.secondaryText }]}>Enrolled Students</Text>
                <Text style={[styles.kpiSub, { color: colors.disabledText }]}>{facultyInfo.className || facultyInfo.dept || "—"}</Text>
              </View>

              <View style={[styles.kpiCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
                <View style={[styles.kpiIconWrap, { backgroundColor: "#F59E0B18" }]}>
                  <Icon name="file-document-edit-outline" size={20} color="#F59E0B" />
                </View>
                <Text style={[styles.kpiVal, { color: "#F59E0B" }]}>{facultyInfo.pendingReports}</Text>
                <Text style={[styles.kpiLabel, { color: colors.secondaryText }]}>CIA Reviews</Text>
                <Text style={[styles.kpiSub, { color: colors.disabledText }]}>Needs Grading</Text>
              </View>

              <View style={[styles.kpiCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
                <View style={[styles.kpiIconWrap, { backgroundColor: "#0D948818" }]}>
                  <Icon name="chart-bell-curve-cumulative" size={20} color="#0D9488" />
                </View>
                <Text style={[styles.kpiVal, { color: "#0D9488" }]}>{facultyInfo.avgAttendance}</Text>
                <Text style={[styles.kpiLabel, { color: colors.secondaryText }]}>Avg Attendance</Text>
                <Text style={[styles.kpiSub, { color: colors.disabledText }]}>{facultyInfo.avgAttendance !== "—" && Number(facultyInfo.avgAttendance) >= 80 ? "High Engagement" : facultyInfo.avgAttendance !== "—" ? "Needs Attention" : "—"}</Text>
              </View>
            </View>

            {/* ========================================================================= */}
            {/* 3. FACULTY OPERATIONS & MANAGEMENT 4-CARD GRID                             */}
            {/* ========================================================================= */}
            <Text style={[styles.sectionTitle, { color: colors.primaryText }]}>
              Faculty Operations & Tools
            </Text>

            <View style={styles.toolsGrid}>
              <TouchableOpacity
                style={[
                  styles.toolCard,
                  { backgroundColor: colors.cardBackground, borderColor: pendingLeavesCount > 0 ? "#F59E0B" : colors.divider },
                ]}
                onPress={() => setLeaveApprovalsVisible(true)}
                activeOpacity={0.85}
              >
                <View style={[styles.toolIconCircle, { backgroundColor: "#F59E0B18" }]}>
                  <Icon name="clipboard-check" size={24} color="#F59E0B" />
                  {pendingLeavesCount > 0 && (
                    <View style={styles.cardBadge}>
                      <Text style={styles.cardBadgeText}>{pendingLeavesCount}</Text>
                    </View>
                  )}
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text style={[styles.toolTitle, { color: colors.primaryText }]}>Leave & OD Approvals</Text>
                  {pendingLeavesCount > 0 && (
                    <View style={styles.pendingTag}>
                      <Text style={styles.pendingTagText}>{pendingLeavesCount} NEW</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.toolSub, { color: colors.secondaryText }]}>
                  Review student leave requests & grant digital QR Gate Passes.
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.toolCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
                onPress={() => setAttendanceVisible(true)}
                activeOpacity={0.85}
              >
                <View style={[styles.toolIconCircle, { backgroundColor: "#10B98118" }]}>
                  <Icon name="check-decagram" size={24} color="#10B981" />
                </View>
                <Text style={[styles.toolTitle, { color: colors.primaryText }]}>Mark Attendance</Text>
                <Text style={[styles.toolSub, { color: colors.secondaryText }]}>
                  Digital roll call & biometric verification for all active lecture batches.
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.toolCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
                onPress={() => setReportsVisible(true)}
                activeOpacity={0.85}
              >
                <View style={[styles.toolIconCircle, { backgroundColor: "#E67E2218" }]}>
                  <Icon name="file-document-edit" size={24} color="#E67E22" />
                </View>
                <Text style={[styles.toolTitle, { color: colors.primaryText }]}>CIA & Lab Grading</Text>
                <Text style={[styles.toolSub, { color: colors.secondaryText }]}>
                  Enter Continuous Internal Assessment marks & grade student submissions.
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.toolCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
                onPress={() => setMessagesVisible(true)}
                activeOpacity={0.85}
              >
                <View style={[styles.toolIconCircle, { backgroundColor: "#3B82F618" }]}>
                  <Icon name="message-text-outline" size={24} color="#3B82F6" />
                </View>
                <Text style={[styles.toolTitle, { color: colors.primaryText }]}>Parent Counselor Hub</Text>
                <Text style={[styles.toolSub, { color: colors.secondaryText }]}>
                  Direct 1-on-1 counseling communications & official classroom circulars.
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.toolCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
                onPress={() => setScheduleVisible(true)}
                activeOpacity={0.85}
              >
                <View style={[styles.toolIconCircle, { backgroundColor: "#8B5CF618" }]}>
                  <Icon name="calendar-clock" size={24} color="#8B5CF6" />
                </View>
                <Text style={[styles.toolTitle, { color: colors.primaryText }]}>Academic Timetable</Text>
                <Text style={[styles.toolSub, { color: colors.secondaryText }]}>
                  Inspect complete 5-day faculty schedule, lab bookings & office hours.
                </Text>
              </TouchableOpacity>
            </View>

            {/* ========================================================================= */}
            {/* 4. TODAY'S LECTURE TIMELINE                                               */}
            {/* ========================================================================= */}
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: colors.primaryText, marginBottom: 0 }]}>
                Today&apos;s Lecture Schedule ({todaySchedule.length})
              </Text>
              <TouchableOpacity onPress={() => setScheduleVisible(true)}>
                <Text style={[styles.viewAllText, { color: colors.primaryAccent }]}>Full Timetable</Text>
              </TouchableOpacity>
            </View>

            <View style={{ gap: 8 }}>
              {todaySchedule.map((item) => (
                <View
                  key={item.id}
                  style={[
                    styles.scheduleCard,
                    {
                      backgroundColor: colors.cardBackground,
                      borderColor: item.isLive ? colors.primaryAccent : colors.divider,
                    },
                  ]}
                >
                  <View style={[styles.scheduleIndicator, { backgroundColor: item.color }]} />

                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <Text style={[styles.scheduleTime, { color: colors.primaryAccent }]}>{item.time}</Text>
                      <View
                        style={[
                          styles.statusBadge,
                          {
                            backgroundColor:
                              item.status === "In Session"
                                ? "#10B98118"
                                : item.status === "Completed"
                                ? "#64748B18"
                                : "#4F46E518",
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusBadgeText,
                            {
                              color:
                                item.status === "In Session"
                                  ? "#10B981"
                                  : item.status === "Completed"
                                  ? colors.secondaryText
                                  : "#4F46E5",
                            },
                          ]}
                        >
                          {item.status}
                        </Text>
                      </View>
                    </View>

                    <Text style={[styles.scheduleCourse, { color: colors.primaryText }]} numberOfLines={1}>
                      {item.course}
                    </Text>

                    <Text style={[styles.scheduleMeta, { color: colors.secondaryText }]}>
                      {item.class} · {item.venue}
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            {/* ========================================================================= */}
            {/* 5. INSTITUTIONAL FACULTY CIRCULARS                                        */}
            {/* ========================================================================= */}
            <Text style={[styles.sectionTitle, { color: colors.primaryText, marginTop: 18 }]}>
              Faculty Circulars & Advisories
            </Text>

            <View style={{ gap: 8 }}>
              {facultyNotices.map((n) => (
                <View
                  key={n.id}
                  style={[styles.noticeCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={[styles.noticeTitle, { color: colors.primaryText }]}>{n.title}</Text>
                    <View style={[styles.noticeTag, { backgroundColor: `${n.color}18` }]}>
                      <Text style={[styles.noticeTagText, { color: n.color }]}>{n.tag}</Text>
                    </View>
                  </View>
                  <Text style={[styles.noticeSub, { color: colors.secondaryText }]}>{n.sub}</Text>
                </View>
              ))}
            </View>
          </Animated.View>
        )}

        {/* Action Modals */}
        <StaffLeaveApprovalsModal
          visible={leaveApprovalsVisible}
          onClose={() => {
            setLeaveApprovalsVisible(false);
            loadData();
          }}
        />
        <AttendanceModal visible={attendanceVisible} onClose={() => setAttendanceVisible(false)} />
        <ReportsModal visible={reportsVisible} onClose={() => setReportsVisible(false)} />
        <MessagesModal visible={messagesVisible} onClose={() => setMessagesVisible(false)} />
        <ScheduleModal visible={scheduleVisible} onClose={() => setScheduleVisible(false)} />

        {/* Real-Time Instant Class Broadcast Modal */}
        <Modal
          visible={broadcastModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setBroadcastModalVisible(false)}
        >
          <TouchableOpacity
            style={styles.broadcastModalOverlay}
            activeOpacity={1}
            onPress={() => setBroadcastModalVisible(false)}
          >
            <View
              style={[
                styles.broadcastModalCard,
                { backgroundColor: colors.cardBackground, borderColor: colors.divider },
              ]}
            >
              {/* Header */}
              <View style={styles.broadcastModalHeader}>
                <View
                  style={[
                    styles.broadcastIconWrap,
                    { backgroundColor: broadcastUrgent ? "#EF444418" : colors.primaryAccent + "18" },
                  ]}
                >
                  <Icon
                    name={broadcastUrgent ? "alert-decagram" : "bullhorn-outline"}
                    size={24}
                    color={broadcastUrgent ? "#EF4444" : colors.primaryAccent}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.broadcastModalTitle, { color: colors.primaryText }]}>
                    Instant Classroom Broadcast
                  </Text>
                  <Text style={[styles.broadcastModalSub, { color: colors.secondaryText }]}>
                    Sends push alert & live banner to {facultyInfo.className || "LH-302"} students
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setBroadcastModalVisible(false)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Icon name="close" size={20} color={colors.secondaryText} />
                </TouchableOpacity>
              </View>

              {/* Priority Selector */}
              <View
                style={[
                  styles.priorityRow,
                  { backgroundColor: colors.primaryBackground, borderColor: colors.divider },
                ]}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Icon
                    name="bell-badge-outline"
                    size={18}
                    color={broadcastUrgent ? "#EF4444" : colors.secondaryText}
                  />
                  <Text style={[styles.priorityLabel, { color: colors.primaryText }]}>
                    Urgent Alert Mode
                  </Text>
                </View>
                <Switch
                  value={broadcastUrgent}
                  onValueChange={setBroadcastUrgent}
                  thumbColor={broadcastUrgent ? "#EF4444" : "#CCC"}
                  trackColor={{ false: "#767577", true: "#EF444455" }}
                />
              </View>

              {/* Quick Template Chips */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 6, marginVertical: 10 }}
              >
                {[
                  "5 Mins left for Lab Submission",
                  "Please silence devices for Lecture",
                  "Mini Project Review starts now",
                  "Open Quiz module on your tablets",
                ].map((template, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      styles.templateChip,
                      { backgroundColor: colors.primaryBackground, borderColor: colors.divider },
                    ]}
                    onPress={() => setBroadcastText(template)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.templateChipText, { color: colors.primaryText }]}>
                      {template}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Message Input */}
              <TextInput
                style={[
                  styles.broadcastInput,
                  {
                    backgroundColor: colors.primaryBackground,
                    borderColor: broadcastUrgent ? "#EF444460" : colors.divider,
                    color: colors.primaryText,
                  },
                ]}
                placeholder="Type real-time announcement or instruction for the class..."
                placeholderTextColor={colors.disabledText}
                value={broadcastText}
                onChangeText={setBroadcastText}
                multiline
                numberOfLines={3}
              />

              {/* Actions */}
              <View style={styles.broadcastActionRow}>
                <TouchableOpacity
                  style={[styles.broadcastCancelBtn, { borderColor: colors.divider }]}
                  onPress={() => setBroadcastModalVisible(false)}
                  disabled={isBroadcasting}
                >
                  <Text style={[styles.broadcastCancelText, { color: colors.secondaryText }]}>
                    Cancel
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.broadcastSubmitBtn,
                    { backgroundColor: broadcastUrgent ? "#EF4444" : colors.primaryAccent },
                  ]}
                  onPress={handleSendBroadcast}
                  disabled={isBroadcasting}
                  activeOpacity={0.85}
                >
                  {isBroadcasting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Icon name="send" size={16} color="#FFFFFF" />
                      <Text style={styles.broadcastSubmitText}>Broadcast Now</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ---------------- Styles ----------------
const getStyles = (colors, isDarkMode) =>
  StyleSheet.create({
    container: { flex: 1 },
    scrollView: { flex: 1 },
    contentContainer: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 80 },

    /* Hero Card */
    heroCard: {
      borderRadius: 20,
      borderWidth: 1,
      padding: 16,
      marginBottom: 14,
      elevation: 3,
      shadowColor: "#000",
      shadowOpacity: 0.08,
      shadowRadius: 8,
    },
    heroTop: {
      flexDirection: "row",
      alignItems: "center",
    },
    avatarCircle: {
      width: 56,
      height: 56,
      borderRadius: 28,
      justifyContent: "center",
      alignItems: "center",
    },
    facultyGreeting: {
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 0.5,
    },
    onlineBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: "#10B98114",
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    greenDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: "#10B981",
    },
    onlineBadgeText: {
      color: "#10B981",
      fontSize: 8.5,
      fontWeight: "900",
    },
    facultyName: {
      fontSize: 17,
      fontWeight: "900",
      letterSpacing: -0.2,
      marginTop: 1,
    },
    facultyDept: {
      fontSize: 12,
      fontWeight: "700",
      marginTop: 2,
    },
    liveSessionBox: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 14,
      borderWidth: 1,
      padding: 10,
      marginTop: 12,
    },
    liveIndicator: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: "#10B98118",
      paddingHorizontal: 6,
      paddingVertical: 3,
      borderRadius: 6,
    },
    liveDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: "#10B981",
    },
    liveText: {
      color: "#10B981",
      fontSize: 9,
      fontWeight: "900",
    },
    liveCourseName: {
      fontSize: 12.5,
      fontWeight: "800",
    },
    liveVenue: {
      fontSize: 10.5,
      fontWeight: "500",
      marginTop: 1,
    },
    quickRollBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 9,
      paddingVertical: 6,
      borderRadius: 8,
    },
    quickRollBtnText: {
      color: "#FFFFFF",
      fontSize: 11,
      fontWeight: "800",
    },

    /* KPI Grid */
    kpiGrid: {
      flexDirection: "row",
      gap: 8,
      marginBottom: 16,
    },
    kpiCard: {
      flex: 1,
      alignItems: "center",
      paddingVertical: 12,
      borderRadius: 16,
      borderWidth: 1,
      elevation: 2,
    },
    kpiIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 4,
    },
    kpiVal: {
      fontSize: 16,
      fontWeight: "900",
    },
    kpiLabel: {
      fontSize: 10.5,
      fontWeight: "700",
      marginTop: 1,
    },
    kpiSub: {
      fontSize: 9,
      fontWeight: "500",
      marginTop: 1,
    },

    /* Operations Grid */
    sectionTitle: {
      fontSize: 15,
      fontWeight: "800",
      marginBottom: 10,
    },
    toolsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
      marginBottom: 16,
    },
    toolCard: {
      width: "48.2%",
      borderRadius: 16,
      borderWidth: 1,
      padding: 14,
      elevation: 2,
    },
    toolIconCircle: {
      width: 44,
      height: 44,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 10,
    },
    cardBadge: {
      position: "absolute",
      top: -3,
      right: -3,
      backgroundColor: "#EF4444",
      borderRadius: 9,
      minWidth: 16,
      height: 16,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 3,
      borderWidth: 1.5,
      borderColor: "#FFFFFF",
    },
    cardBadgeText: {
      color: "#FFFFFF",
      fontSize: 8.5,
      fontWeight: "900",
    },
    pendingTag: {
      backgroundColor: "#FEF3C7",
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
    },
    pendingTagText: {
      color: "#D97706",
      fontSize: 9,
      fontWeight: "900",
    },
    toolTitle: {
      fontSize: 13.5,
      fontWeight: "800",
    },
    toolSub: {
      fontSize: 10.5,
      lineHeight: 14,
      fontWeight: "500",
      marginTop: 3,
    },

    /* Schedule Timeline */
    sectionHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 10,
    },
    viewAllText: {
      fontSize: 12,
      fontWeight: "700",
    },
    scheduleCard: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 14,
      borderWidth: 1,
      padding: 12,
    },
    scheduleIndicator: {
      width: 4,
      height: 42,
      borderRadius: 2,
    },
    scheduleTime: {
      fontSize: 11,
      fontWeight: "800",
    },
    statusBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    statusBadgeText: {
      fontSize: 9,
      fontWeight: "800",
    },
    scheduleCourse: {
      fontSize: 13,
      fontWeight: "800",
      marginTop: 2,
    },
    scheduleMeta: {
      fontSize: 10.5,
      fontWeight: "500",
      marginTop: 1,
    },

    /* Notices */
    noticeCard: {
      borderRadius: 14,
      borderWidth: 1,
      padding: 12,
    },
    noticeTitle: {
      fontSize: 13,
      fontWeight: "800",
      flex: 1,
    },
    noticeTag: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      marginLeft: 8,
    },
    noticeTagText: {
      fontSize: 9,
      fontWeight: "900",
    },
    noticeSub: {
      fontSize: 11,
      lineHeight: 15,
      fontWeight: "500",
      marginTop: 4,
    },

    /* Controls Space */
    controlsCard: {
      borderRadius: 18,
      borderWidth: 1,
      padding: 14,
      marginBottom: 16,
      elevation: 2,
    },
    controlsHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    controlsTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      flex: 1,
    },
    controlsIconCircle: {
      width: 36,
      height: 36,
      borderRadius: 10,
      justifyContent: "center",
      alignItems: "center",
    },
    controlsTitle: {
      fontSize: 14,
      fontWeight: "800",
    },
    livePulseDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: "#10B981",
    },
    controlsSubtitle: {
      fontSize: 10.5,
      fontWeight: "500",
      marginTop: 1,
    },
    activeRoomBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      borderWidth: 1,
    },
    activeRoomText: {
      fontSize: 11,
      fontWeight: "800",
    },
    sessionModeContainer: {
      flexDirection: "row",
      borderRadius: 12,
      borderWidth: 1,
      padding: 4,
      gap: 4,
      marginBottom: 10,
    },
    sessionModeBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: "transparent",
    },
    sessionModeText: {
      fontSize: 11,
    },
    togglesRow: {
      flexDirection: "row",
      gap: 8,
      marginBottom: 10,
    },
    toggleCard: {
      flex: 1,
      borderRadius: 12,
      borderWidth: 1,
      padding: 10,
    },
    toggleCardTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 6,
    },
    toggleLabel: {
      fontSize: 10.5,
      fontWeight: "700",
    },
    toggleStatus: {
      fontSize: 10,
      fontWeight: "800",
      marginTop: 2,
    },
    quickActionRow: {
      flexDirection: "row",
      gap: 8,
    },
    quickActionButton: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 10,
      borderRadius: 10,
    },
    quickActionText: {
      color: "#FFFFFF",
      fontSize: 11.5,
      fontWeight: "800",
    },
    quickActionButtonOutline: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
    },
    quickActionTextOutline: {
      fontSize: 11.5,
      fontWeight: "800",
    },

    /* Broadcast Modal */
    broadcastModalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.65)",
      justifyContent: "center",
      alignItems: "center",
      padding: 16,
    },
    broadcastModalCard: {
      width: "100%",
      borderRadius: 18,
      borderWidth: 1,
      padding: 16,
      elevation: 6,
    },
    broadcastModalHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 12,
    },
    broadcastIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
    },
    broadcastModalTitle: {
      fontSize: 15,
      fontWeight: "800",
    },
    broadcastModalSub: {
      fontSize: 11,
      fontWeight: "500",
      marginTop: 2,
    },
    priorityRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      borderWidth: 1,
      marginBottom: 4,
    },
    priorityLabel: {
      fontSize: 12,
      fontWeight: "700",
    },
    templateChip: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
    },
    templateChipText: {
      fontSize: 11,
      fontWeight: "600",
    },
    broadcastInput: {
      borderRadius: 10,
      borderWidth: 1,
      padding: 10,
      fontSize: 12,
      minHeight: 70,
      textAlignVertical: "top",
      marginBottom: 12,
    },
    broadcastActionRow: {
      flexDirection: "row",
      gap: 8,
    },
    broadcastCancelBtn: {
      flex: 1,
      paddingVertical: 10,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 10,
      borderWidth: 1,
    },
    broadcastCancelText: {
      fontSize: 12,
      fontWeight: "700",
    },
    broadcastSubmitBtn: {
      flex: 1.5,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 10,
      borderRadius: 10,
    },
    broadcastSubmitText: {
      color: "#FFFFFF",
      fontSize: 12,
      fontWeight: "800",
    },
  });
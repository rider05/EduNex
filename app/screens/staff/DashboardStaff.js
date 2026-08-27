import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  RefreshControl,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { useTheme } from "../../context/ThemeContext";

import AttendanceModal from "./modals/AttendanceModal";
import ReportsModal from "./modals/AssignmentReportModal";
import MessagesModal from "./modals/MessagesModal";
import ScheduleModal from "./modals/ScheduleModal";

import { getFacultyData, getStaffClassName, getFacultySchedule } from "../../services/dataService";
import { api } from "../../services/api";
import { SkeletonScreenLoader } from "../../components/common/SkeletonLoader";
import useRefreshOnForeground from "../../hooks/useRefreshOnForeground";

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
    } catch (err) {
      console.log("Error loading staff dashboard:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, [fadeAnim, loadData]);

  useRefreshOnForeground(loadData);

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
          <SkeletonScreenLoader showProfile showKPIs listCount={4} />
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
            {/* 2. FACULTY 4-METRIC KPI POWER STRIP                                       */}
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
        <AttendanceModal visible={attendanceVisible} onClose={() => setAttendanceVisible(false)} />
        <ReportsModal visible={reportsVisible} onClose={() => setReportsVisible(false)} />
        <MessagesModal visible={messagesVisible} onClose={() => setMessagesVisible(false)} />
        <ScheduleModal visible={scheduleVisible} onClose={() => setScheduleVisible(false)} />

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
  });
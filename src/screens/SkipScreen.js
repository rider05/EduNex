import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  StatusBar,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { secureSet } from "../services/secureStorage";
import { getNoticesList, getAcademicCalendar, getAdminData, getTimetable } from "../services/dataService";

const PREVIEW_NOTICE_LIMIT = 4;
const PREVIEW_DEPT_LIMIT = 6;
const PREVIEW_TIMETABLE_LIMIT = 3;

function todayWeekday() {
  try {
    return new Date().toLocaleDateString("en-US", { weekday: "long" });
  } catch {
    return "Monday";
  }
}

export default function SkipScreen({ onLogout, setShowModal }) {
  const [refreshing, setRefreshing] = useState(false);
  const [loadingGuestData, setLoadingGuestData] = useState(true);
  const [guestDataError, setGuestDataError] = useState(false);
  const [notices, setNotices] = useState([]);
  const [calendar, setCalendar] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [timetableDay, setTimetableDay] = useState([]);

  const loadGuestData = useCallback(async () => {
    setLoadingGuestData(true);
    const [noticesRes, calendarRes, adminRes, timetableRes] = await Promise.allSettled([
      getNoticesList({ limit: PREVIEW_NOTICE_LIMIT, sort: "-createdAt" }),
      getAcademicCalendar(true),
      getAdminData(),
      getTimetable(),
    ]);

    setNotices(noticesRes.status === "fulfilled" ? (noticesRes.value || []).slice(0, PREVIEW_NOTICE_LIMIT) : []);
    setCalendar(calendarRes.status === "fulfilled" ? calendarRes.value || null : null);
    setDepartments(
      adminRes.status === "fulfilled" && Array.isArray(adminRes.value?.departments)
        ? adminRes.value.departments.slice(0, PREVIEW_DEPT_LIMIT)
        : []
    );

    if (timetableRes.status === "fulfilled" && Array.isArray(timetableRes.value) && timetableRes.value.length > 0) {
      const first = timetableRes.value[0];
      const schedule = first?.schedule || {};
      const day = schedule[todayWeekday()] || schedule.Monday || [];
      setTimetableDay(Array.isArray(day) ? day.slice(0, PREVIEW_TIMETABLE_LIMIT) : []);
    } else {
      setTimetableDay([]);
    }

    const hasAny =
      (noticesRes.status === "fulfilled" && (noticesRes.value || []).length > 0) ||
      (calendarRes.status === "fulfilled" && calendarRes.value) ||
      (adminRes.status === "fulfilled" && Array.isArray(adminRes.value?.departments) && adminRes.value.departments.length > 0) ||
      (timetableRes.status === "fulfilled" && Array.isArray(timetableRes.value) && timetableRes.value.length > 0);
    setGuestDataError(!hasAny);
    setLoadingGuestData(false);
  }, []);

  useEffect(() => {
    loadGuestData();
  }, [loadGuestData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadGuestData();
    setRefreshing(false);
  }, [loadGuestData]);

  const handleGuestSignIn = async () => {
    await secureSet("loggedInUser", "guest");
    await secureSet("userRole", "guest");
    await secureSet("userData", {
      role: "guest",
      id: "guest",
      username: "guest",
      name: "Guest User",
      scope: "read-only",
    });

    setShowModal?.(true);
  };

  const renderNotices = () => {
    if (notices.length === 0) return null;
    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Icon name="bullhorn-outline" size={16} color="#4F46E5" />
          <Text style={styles.sectionTitle}>Latest Announcements</Text>
        </View>
        {notices.map((n, idx) => {
          const sender = n.senderName || n.sender || "";
          const dateText = n.date || (n.createdAt ? String(n.createdAt).split("T")[0] : "");
          return (
            <View key={String(n.id || n._id || idx)} style={styles.noticeItem}>
              <View style={styles.noticeDot} />
              <View style={{ flex: 1 }}>
                <Text style={styles.noticeTitle} numberOfLines={2}>
                  {n.title || n.subject || "Announcement"}
                </Text>
                {(sender || dateText) ? (
                  <Text style={styles.noticeMeta} numberOfLines={1}>
                    {[sender, dateText].filter(Boolean).join(" • ")}
                  </Text>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  const renderCalendar = () => {
    if (!calendar) return null;
    const milestones = Array.isArray(calendar.milestones) ? calendar.milestones.slice(0, 3) : [];
    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Icon name="calendar-month-outline" size={16} color="#0D9488" />
          <Text style={styles.sectionTitle}>Academic Calendar</Text>
        </View>
        {calendar.academicYear ? (
          <Text style={styles.calendarMeta} numberOfLines={1}>
            {[calendar.academicYear, calendar.semester].filter(Boolean).join(" • ")}
          </Text>
        ) : null}
        {milestones.length > 0 ? (
          milestones.map((m, idx) => (
            <View key={`${m.event || "event"}-${idx}`} style={styles.calendarRow}>
              <View style={[styles.calendarIconWrap, m.color ? { backgroundColor: `${m.color}22` } : null]}>
                <Icon name={m.icon || "calendar-check-outline"} size={14} color={m.color || "#0D9488"} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.calendarEvent} numberOfLines={1}>
                  {m.event || ""}
                </Text>
                <Text style={styles.calendarDate}>{m.date || ""}</Text>
              </View>
            </View>
          ))
        ) : calendar.commencementDate ? (
          <View style={styles.calendarRow}>
            <View style={styles.calendarIconWrap}>
              <Icon name="calendar-start" size={14} color="#0D9488" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.calendarEvent} numberOfLines={1}>
                Commencement of Classes
              </Text>
              <Text style={styles.calendarDate}>{calendar.commencementDate}</Text>
            </View>
          </View>
        ) : null}
      </View>
    );
  };

  const renderDepartments = () => {
    if (departments.length === 0) return null;
    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Icon name="school-outline" size={16} color="#8B5CF6" />
          <Text style={styles.sectionTitle}>Departments</Text>
        </View>
        <View style={styles.deptWrap}>
          {departments.map((d, idx) => (
            <View key={String(d.id || d.code || idx)} style={styles.deptChip}>
              <Text style={styles.deptCode} numberOfLines={1}>
                {d.code || d.name || "Dept"}
              </Text>
              <Text style={styles.deptName} numberOfLines={1}>
                {d.name || ""}
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderTimetable = () => {
    if (timetableDay.length === 0) return null;
    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Icon name="clock-outline" size={16} color="#F59E0B" />
          <Text style={styles.sectionTitle}>Today's Timetable Preview</Text>
        </View>
        {timetableDay.map((slot, idx) => (
          <View key={`${slot.subject || "slot"}-${idx}`} style={styles.slotRow}>
            <View style={styles.slotTimeWrap}>
              <Text style={styles.slotTime} numberOfLines={1}>
                {slot.time || "—"}
              </Text>
              {slot.duration ? <Text style={styles.slotDuration}>{slot.duration}</Text> : null}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.slotSubject} numberOfLines={1}>
                {slot.subject || ""}
              </Text>
              <Text style={styles.slotMeta} numberOfLines={1}>
                {[slot.teacher, `Room ${slot.room && slot.room !== "—" ? slot.room : "TBA"}`]
                  .filter(Boolean)
                  .join(" • ")}
              </Text>
            </View>
          </View>
        ))}
      </View>
    );
  };

  const renderPreviewContent = () => {
    if (loadingGuestData) {
      return (
        <View style={styles.previewLoadingWrap}>
          <ActivityIndicator size="small" color="#4F46E5" />
          <Text style={styles.previewLoadingText}>Loading live preview…</Text>
        </View>
      );
    }
    if (guestDataError) {
      return (
        <View style={styles.previewErrorWrap}>
          <Icon name="cloud-alert-outline" size={20} color="#F59E0B" />
          <Text style={styles.previewErrorText}>
            Preview unavailable right now. Pull to refresh or sign in for full access.
          </Text>
        </View>
      );
    }
    return (
      <>
        {renderNotices()}
        {renderCalendar()}
        {renderDepartments()}
        {renderTimetable()}
        <Text style={styles.previewNote}>
          Read-only public preview. Sign in to unlock your personalized dashboard.
        </Text>
      </>
    );
  };

  return (
    <LinearGradient colors={["#0F172A", "#1E1B4B", "#312E81"]} style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#6366F1"]}
            tintColor="#6366F1"
            progressBackgroundColor="#1E1B4B"
          />
        }
      >
        {/* Top Hero Brand Header */}
        <View style={styles.header}>
          <View style={styles.badgeWrap}>
            <View style={styles.badgeDot} />
            <Text style={styles.badgeText}>GUEST PREVIEW MODE</Text>
          </View>
          <Text style={styles.appTitle}>EduNex</Text>
          <Text style={styles.subtitle}>Unified Smart Educational Management</Text>
        </View>

        {/* Main Feature Highlight Card */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardIconWrap}>
              <Icon name="compass-outline" size={24} color="#4F46E5" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.cardTitle}>Welcome to EduNex</Text>
              <Text style={styles.cardSubtitle}>
                Experience a connected ecosystem for Students, Faculty, Parents, and Administrators.
              </Text>
            </View>
          </View>

          {/* Feature Grid */}
          <View style={styles.featuresGrid}>
            <View style={styles.featureBox}>
              <View style={[styles.featureIconWrap, { backgroundColor: "rgba(79, 70, 229, 0.12)" }]}>
                <Icon name="view-dashboard-outline" size={24} color="#4F46E5" />
              </View>
              <Text style={styles.featureTitle}>Student Hub</Text>
              <Text style={styles.featureDesc}>CGPA, Timetables, Fee Portal & Leaves</Text>
            </View>

            <View style={styles.featureBox}>
              <View style={[styles.featureIconWrap, { backgroundColor: "rgba(13, 148, 136, 0.12)" }]}>
                <Icon name="account-tie-outline" size={24} color="#0D9488" />
              </View>
              <Text style={styles.featureTitle}>Faculty Portal</Text>
              <Text style={styles.featureDesc}>Live Attendance, Rosters & Tests</Text>
            </View>

            <View style={styles.featureBox}>
              <View style={[styles.featureIconWrap, { backgroundColor: "rgba(168, 85, 247, 0.12)" }]}>
                <Icon name="account-child-outline" size={24} color="#8B5CF6" />
              </View>
              <Text style={styles.featureTitle}>Parent Desk</Text>
              <Text style={styles.featureDesc}>Ward Progress, Alerts & Gate Passes</Text>
            </View>

            <View style={styles.featureBox}>
              <View style={[styles.featureIconWrap, { backgroundColor: "rgba(239, 68, 68, 0.12)" }]}>
                <Icon name="shield-check-outline" size={24} color="#EF4444" />
              </View>
              <Text style={styles.featureTitle}>Admin Suite</Text>
              <Text style={styles.featureDesc}>User Directory, Analytics & Config</Text>
            </View>
          </View>

          {/* Sign In CTA */}
          <TouchableOpacity style={styles.button} onPress={handleGuestSignIn} activeOpacity={0.85}>
            <LinearGradient
              colors={["#4F46E5", "#6366F1"]}
              style={styles.buttonGradient}
            >
              <Icon name="login" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.buttonText}>Sign In / Switch Account</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Live Preview Card */}
        <View style={styles.previewCard}>
          <View style={styles.previewHeader}>
            <View style={styles.previewHeaderIconWrap}>
              <Icon name="view-list-outline" size={20} color="#0F172A" />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.previewTitle}>Live Preview</Text>
              <Text style={styles.previewSubtitle}>
                Public campus updates you can browse right now
              </Text>
            </View>
          </View>
          {renderPreviewContent()}
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          © 2026 EduNex Systems • Empowering Smart Institutions
        </Text>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight || 24) + 30 : 60,
    paddingBottom: 40,
    alignItems: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: 28,
  },
  badgeWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 6,
    marginBottom: 12,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#34D399",
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  appTitle: {
    fontSize: 40,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 14,
    color: "#CBD5E1",
    marginTop: 4,
    fontWeight: "500",
    textAlign: "center",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    padding: 22,
    width: "100%",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  cardIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#EEF2FF",
    justifyContent: "center",
    alignItems: "center",
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
  },
  cardSubtitle: {
    fontSize: 13,
    color: "#64748B",
    lineHeight: 18,
    marginTop: 2,
  },
  featuresGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 20,
  },
  featureBox: {
    width: "48%",
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  featureIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  featureTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0F172A",
  },
  featureDesc: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
    lineHeight: 15,
  },
  button: {
    borderRadius: 16,
    overflow: "hidden",
    marginTop: 8,
  },
  buttonGradient: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 16,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  previewCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    padding: 22,
    width: "100%",
    marginTop: 18,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  previewHeaderIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#EEF2FF",
    justifyContent: "center",
    alignItems: "center",
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },
  previewSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 1,
  },
  previewLoadingWrap: {
    alignItems: "center",
    paddingVertical: 24,
  },
  previewLoadingText: {
    color: "#64748B",
    fontSize: 12,
    marginTop: 8,
    fontWeight: "600",
  },
  previewErrorWrap: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 20,
    gap: 10,
    paddingHorizontal: 4,
  },
  previewErrorText: {
    color: "#64748B",
    fontSize: 12,
    lineHeight: 17,
    flex: 1,
    fontWeight: "500",
  },
  section: {
    marginBottom: 18,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0F172A",
  },
  noticeItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 8,
    gap: 8,
  },
  noticeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#6366F1",
    marginTop: 6,
  },
  noticeTitle: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#0F172A",
    lineHeight: 17,
  },
  noticeMeta: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },
  calendarMeta: {
    fontSize: 11.5,
    fontWeight: "600",
    color: "#0D9488",
    marginBottom: 8,
  },
  calendarRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 10,
  },
  calendarIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: "rgba(13, 148, 136, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  calendarEvent: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#0F172A",
  },
  calendarDate: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 1,
  },
  deptWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  deptChip: {
    backgroundColor: "#F5F3FF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E4E1FB",
    paddingHorizontal: 12,
    paddingVertical: 8,
    width: "48%",
  },
  deptCode: {
    fontSize: 12,
    fontWeight: "800",
    color: "#4F46E5",
  },
  deptName: {
    fontSize: 10.5,
    color: "#64748B",
    marginTop: 2,
  },
  slotRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFBEB",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FDE68A",
    padding: 12,
    marginBottom: 8,
    gap: 12,
  },
  slotTimeWrap: {
    minWidth: 58,
  },
  slotTime: {
    fontSize: 12.5,
    fontWeight: "800",
    color: "#B45309",
  },
  slotDuration: {
    fontSize: 10.5,
    color: "#D97706",
    marginTop: 1,
  },
  slotSubject: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#0F172A",
  },
  slotMeta: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },
  previewNote: {
    fontSize: 11.5,
    color: "#94A3B8",
    textAlign: "center",
    marginTop: 4,
    lineHeight: 16,
    fontWeight: "500",
  },
  footer: {
    color: "#94A3B8",
    fontSize: 12,
    marginTop: 30,
    textAlign: "center",
    fontWeight: "500",
  },
});
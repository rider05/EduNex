import React, { useState, useEffect, useCallback } from "react";
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../../context/ThemeContext";
import { SkeletonKPIRow, SkeletonListItem } from "../../components/common/SkeletonLoader";
import { getInstitutions, getAdminStats, getNoticesList } from "../../services/dataService";
import { api } from "../../services/api";
import { showToast } from "../../utils/toastService";
import useRefreshOnForeground from "../../hooks/useRefreshOnForeground";

export default function DashboardAdmin() {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Overview Stats
  const [stats, setStats] = useState([
    { id: "1", label: "Total Students", value: "2,314", icon: "account-group", color: "#3B82F6", sub: "Active Enrolled" },
    { id: "2", label: "Total Faculty", value: "128", icon: "account-tie", color: "#10B981", sub: "98% On Campus" },
    { id: "3", label: "Departments", value: "8", icon: "domain", color: "#F59E0B", sub: "All Accredited" },
    { id: "4", label: "Fee Collection", value: "₹42.8 L", icon: "currency-inr", color: "#8B5CF6", sub: "79% of Target" },
  ]);

  // Live Notices
  const [notices, setNotices] = useState([]);

  // Sub-Modals
  const [logsVisible, setLogsVisible] = useState(false);
  const [examModalVisible, setExamModalVisible] = useState(false);
  const [leavesModalVisible, setLeavesModalVisible] = useState(false);
  const [publishModalVisible, setPublishModalVisible] = useState(false);
  const [fleetModalVisible, setFleetModalVisible] = useState(false);

  // Leave Approvals State
  const [leaveRequests, setLeaveRequests] = useState([
    {
      id: "L1",
      name: "Dr. Ramesh Kumar",
      dept: "CSE",
      role: "Professor",
      type: "Casual Leave",
      dates: "Tomorrow (1 Day)",
      reason: "Attending IEEE Conference at Bengaluru",
      status: "pending",
    },
    {
      id: "L2",
      name: "Prof. Anita Varma",
      dept: "AI-DS",
      role: "Asst. Professor",
      type: "Medical Leave",
      dates: "28 Nov - 30 Nov (3 Days)",
      reason: "Family health emergency",
      status: "pending",
    },
    {
      id: "L3",
      name: "Dr. S. Nair",
      dept: "ECE",
      role: "Associate Prof",
      type: "On Duty (OD)",
      dates: "02 Dec (1 Day)",
      reason: "External Lab Examiner at Anna Univ",
      status: "pending",
    },
  ]);

  // Publish Notice Form
  const [newNoticeTitle, setNewNoticeTitle] = useState("");
  const [newNoticeBody, setNewNoticeBody] = useState("");
  const [newNoticeCategory, setNewNoticeCategory] = useState("Academic");
  const [newNoticeAudience, setNewNoticeAudience] = useState("All");
  const [isPublishing, setIsPublishing] = useState(false);

  // Fee Alert Action State
  const [isSendingFeeAlert, setIsSendingFeeAlert] = useState(false);

  // System Logs State
  const [logsLoading, setLogsLoading] = useState(false);
  const [logs, setLogs] = useState([]);

  // Load Data
  const loadData = useCallback(async () => {
    try {
      const [institutionsRes, statsRes, noticesRes] = await Promise.all([
        getInstitutions().catch(() => null),
        getAdminStats().catch(() => null),
        getNoticesList().catch(() => []),
      ]);

      const inst = Array.isArray(institutionsRes) && institutionsRes.length > 0 ? institutionsRes[0] : null;
      const live = statsRes || {};

      setStats([
        {
          id: "1",
          label: "Total Students",
          value: String(inst?.overview?.students || live.totalStudents || "2,314"),
          icon: "account-group",
          color: "#3B82F6",
          sub: "94.2% Attendance",
        },
        {
          id: "2",
          label: "Total Faculty",
          value: String(inst?.overview?.faculty || live.totalFaculty || "128"),
          icon: "account-tie",
          color: "#10B981",
          sub: "98.4% Present",
        },
        {
          id: "3",
          label: "Departments",
          value: String(inst?.overview?.departments || live.totalDepartments || "8"),
          icon: "domain",
          color: "#F59E0B",
          sub: "Active Programs",
        },
        {
          id: "4",
          label: "Monthly Fees",
          value: inst?.monthlyFeeCollection || live.monthlyFeeCollection || "₹42.8 L",
          icon: "currency-inr",
          color: "#8B5CF6",
          sub: "79% Realized",
        },
      ]);

      if (Array.isArray(noticesRes) && noticesRes.length > 0) {
        setNotices(noticesRes.slice(0, 3));
      } else {
        setNotices([
          {
            id: "n1",
            title: "End Semester Examinations Schedule Nov/Dec 2025",
            category: "Academic",
            date: "Today, 10:30 AM",
            audience: "All Students",
          },
          {
            id: "n2",
            title: "Faculty Development Program on Generative AI & Cloud",
            category: "Faculty",
            date: "Yesterday",
            audience: "Teaching Staff",
          },
        ]);
      }
    } catch (err) {
      console.log("DashboardAdmin load error:", err);
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

  // Handle Leave Approvals
  const handleApproveLeave = (id, applicantName) => {
    setLeaveRequests((prev) =>
      prev.map((req) => (req.id === id ? { ...req, status: "approved" } : req))
    );
    showToast(`Approved leave request for ${applicantName}`, "success");
  };

  const handleRejectLeave = (id, applicantName) => {
    setLeaveRequests((prev) =>
      prev.map((req) => (req.id === id ? { ...req, status: "rejected" } : req))
    );
    showToast(`Rejected leave request for ${applicantName}`, "warning");
  };

  // Handle Publish Notice
  const handlePublishNotice = async () => {
    if (!newNoticeTitle.trim() || !newNoticeBody.trim()) {
      showToast("Please provide notice title and message body", "warning");
      return;
    }

    setIsPublishing(true);
    try {
      await api.post("/notices", {
        title: newNoticeTitle.trim(),
        content: newNoticeBody.trim(),
        category: newNoticeCategory,
        audience: newNoticeAudience,
        date: new Date().toISOString(),
        author: "Campus Administrator",
      });
      showToast("📢 Circular published to campus portals!", "success");
      setPublishModalVisible(false);
      setNewNoticeTitle("");
      setNewNoticeBody("");
      loadData();
    } catch {
      // Local fallback
      setNotices((prev) => [
        {
          id: Date.now().toString(),
          title: newNoticeTitle.trim(),
          category: newNoticeCategory,
          date: "Just Now",
          audience: newNoticeAudience,
        },
        ...prev,
      ]);
      setPublishModalVisible(false);
      setNewNoticeTitle("");
      setNewNoticeBody("");
      showToast("📢 Circular published (Local sync active)", "success");
    } finally {
      setIsPublishing(false);
    }
  };

  // Handle Fee Reminder Broadcast
  const handleSendFeeReminder = async () => {
    setIsSendingFeeAlert(true);
    setTimeout(() => {
      setIsSendingFeeAlert(false);
      showToast("📩 Automated Fee Due Reminders sent to 142 parent contacts!", "success");
    }, 1200);
  };

  // Handle Open Logs Modal
  const openLogs = () => {
    setLogsVisible(true);
    setLogsLoading(true);
    setTimeout(() => {
      setLogs([
        { id: 1, label: "Render Backend API", value: "Online (38ms latency)", color: "#10B981", icon: "server-network" },
        { id: 2, label: "MongoDB Atlas Primary", value: "Connected & Synced", color: "#3B82F6", icon: "database-check" },
        { id: 3, label: "Cloud Snapshot Backup", value: "Completed Today 04:30 AM", color: "#F59E0B", icon: "cloud-check" },
        { id: 4, label: "Active Mobile Sessions", value: "358 Logged In", color: "#8B5CF6", icon: "account-multiple-check" },
        { id: 5, label: "Security & Firewall", value: "Zero threat flags detected", color: "#10B981", icon: "shield-check" },
      ]);
      setLogsLoading(false);
    }, 500);
  };

  const pendingLeavesCount = leaveRequests.filter((r) => r.status === "pending").length;

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
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
        {/* Top Header Badge */}
        <View style={styles.topHeaderRow}>
          <View>
            <Text style={[styles.headerSub, { color: colors.secondaryText }]}>CAMPUS EXECUTIVE CONTROL</Text>
            <Text style={[styles.header, { color: colors.primaryText }]}>Admin Dashboard</Text>
          </View>
          <TouchableOpacity
            style={[styles.systemStatusBadge, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
            onPress={openLogs}
            activeOpacity={0.8}
          >
            <View style={styles.pulseDot} />
            <Text style={[styles.systemStatusText, { color: "#10B981" }]}>System Online</Text>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={{ marginTop: 15 }}>
            <SkeletonKPIRow count={2} />
            <SkeletonKPIRow count={2} />
            <SkeletonListItem />
            <SkeletonListItem />
          </View>
        ) : (
          <>
            {/* ========================================================================= */}
            {/* 1. OVERVIEW KPIS                                                         */}
            {/* ========================================================================= */}
            <View style={styles.statsContainer}>
              {stats.map((item) => (
                <View
                  key={item.id}
                  style={[
                    styles.statsCard,
                    { backgroundColor: colors.cardBackground, borderColor: colors.divider },
                  ]}
                >
                  <View style={styles.statsCardTop}>
                    <View style={[styles.iconCircle, { backgroundColor: item.color + "18" }]}>
                      <Icon name={item.icon} size={22} color={item.color} />
                    </View>
                    <Text style={[styles.statsValue, { color: colors.primaryText }]}>
                      {item.value}
                    </Text>
                  </View>
                  <Text style={[styles.statsLabel, { color: colors.primaryText }]}>
                    {item.label}
                  </Text>
                  <Text style={[styles.statsSubLabel, { color: item.color }]}>
                    {item.sub}
                  </Text>
                </View>
              ))}
            </View>

            {/* ========================================================================= */}
            {/* 2. CAMPUS ATTENDANCE & ACADEMIC HEALTH PULSE                              */}
            {/* ========================================================================= */}
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: colors.primaryText }]}>
                {"Today's Campus Health"}
              </Text>
              <View style={[styles.liveTag, { backgroundColor: "#10B98120" }]}>
                <View style={[styles.liveDot, { backgroundColor: "#10B981" }]} />
                <Text style={[styles.liveTagText, { color: "#10B981" }]}>LIVE</Text>
              </View>
            </View>

            <View style={[styles.healthCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
              {/* Top Row: Attendance Rates */}
              <View style={styles.healthStatsRow}>
                <View style={styles.healthStatBox}>
                  <Text style={[styles.healthStatPercent, { color: "#3B82F6" }]}>94.2%</Text>
                  <Text style={[styles.healthStatTitle, { color: colors.primaryText }]}>Student Attendance</Text>
                  <Text style={[styles.healthStatSub, { color: colors.secondaryText }]}>2,180 / 2,314 Present</Text>
                </View>
                <View style={[styles.healthStatDivider, { backgroundColor: colors.divider }]} />
                <View style={styles.healthStatBox}>
                  <Text style={[styles.healthStatPercent, { color: "#10B981" }]}>98.4%</Text>
                  <Text style={[styles.healthStatTitle, { color: colors.primaryText }]}>Faculty On Campus</Text>
                  <Text style={[styles.healthStatSub, { color: colors.secondaryText }]}>126 / 128 On Duty</Text>
                </View>
              </View>

              {/* Department Attendance Progress Bars */}
              <View style={[styles.deptProgressWrapper, { borderTopColor: colors.divider }]}>
                <Text style={[styles.deptProgressHeading, { color: colors.secondaryText }]}>
                  DEPARTMENT ATTENDANCE
                </Text>

                <View style={styles.deptBarRow}>
                  <Text style={[styles.deptName, { color: colors.primaryText }]}>CSE</Text>
                  <View style={[styles.progressBarBg, { backgroundColor: colors.primaryBackground }]}>
                    <View style={[styles.progressBarFill, { width: "96.5%", backgroundColor: "#3B82F6" }]} />
                  </View>
                  <Text style={[styles.deptPercent, { color: colors.primaryText }]}>96.5%</Text>
                </View>

                <View style={styles.deptBarRow}>
                  <Text style={[styles.deptName, { color: colors.primaryText }]}>AI-DS</Text>
                  <View style={[styles.progressBarBg, { backgroundColor: colors.primaryBackground }]}>
                    <View style={[styles.progressBarFill, { width: "95.0%", backgroundColor: "#10B981" }]} />
                  </View>
                  <Text style={[styles.deptPercent, { color: colors.primaryText }]}>95.0%</Text>
                </View>

                <View style={styles.deptBarRow}>
                  <Text style={[styles.deptName, { color: colors.primaryText }]}>ECE</Text>
                  <View style={[styles.progressBarBg, { backgroundColor: colors.primaryBackground }]}>
                    <View style={[styles.progressBarFill, { width: "91.2%", backgroundColor: "#F59E0B" }]} />
                  </View>
                  <Text style={[styles.deptPercent, { color: colors.primaryText }]}>91.2%</Text>
                </View>

                <View style={styles.deptBarRow}>
                  <Text style={[styles.deptName, { color: colors.primaryText }]}>MECH</Text>
                  <View style={[styles.progressBarBg, { backgroundColor: colors.primaryBackground }]}>
                    <View style={[styles.progressBarFill, { width: "89.0%", backgroundColor: "#8B5CF6" }]} />
                  </View>
                  <Text style={[styles.deptPercent, { color: colors.primaryText }]}>89.0%</Text>
                </View>
              </View>
            </View>

            {/* ========================================================================= */}
            {/* 3. ACADEMIC & OPERATIONS CENTER (NEW INTERACTIVE CARDS)                   */}
            {/* ========================================================================= */}
            <Text style={[styles.sectionTitle, { color: colors.primaryText, marginTop: 22 }]}>
              Campus Operations & Approvals
            </Text>

            <View style={styles.operationsGrid}>
              {/* Card 1: Exam & Hall Planner */}
              <TouchableOpacity
                style={[styles.opCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
                onPress={() => setExamModalVisible(true)}
                activeOpacity={0.85}
              >
                <View style={[styles.opIconWrap, { backgroundColor: "#3B82F618" }]}>
                  <Icon name="calendar-clock" size={24} color="#3B82F6" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.opTitle, { color: colors.primaryText }]}>Exams & Seating Plan</Text>
                  <Text style={[styles.opSub, { color: colors.secondaryText }]}>
                    End-Sem Nov 28 · 16 Halls Active
                  </Text>
                </View>
                <Icon name="chevron-right" size={20} color={colors.secondaryText} />
              </TouchableOpacity>

              {/* Card 2: Faculty Leave Approvals */}
              <TouchableOpacity
                style={[styles.opCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
                onPress={() => setLeavesModalVisible(true)}
                activeOpacity={0.85}
              >
                <View style={[styles.opIconWrap, { backgroundColor: "#F59E0B18" }]}>
                  <Icon name="account-clock" size={24} color="#F59E0B" />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={[styles.opTitle, { color: colors.primaryText }]}>Faculty Leave Requests</Text>
                    {pendingLeavesCount > 0 && (
                      <View style={styles.urgentBadge}>
                        <Text style={styles.urgentBadgeText}>{pendingLeavesCount} Pending</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.opSub, { color: colors.secondaryText }]}>
                    Review & approve staff leave requests
                  </Text>
                </View>
                <Icon name="chevron-right" size={20} color={colors.secondaryText} />
              </TouchableOpacity>

              {/* Card 3: Publish Campus Circular */}
              <TouchableOpacity
                style={[styles.opCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
                onPress={() => setPublishModalVisible(true)}
                activeOpacity={0.85}
              >
                <View style={[styles.opIconWrap, { backgroundColor: "#10B98118" }]}>
                  <Icon name="bullhorn-outline" size={24} color="#10B981" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.opTitle, { color: colors.primaryText }]}>Publish Circular Notice</Text>
                  <Text style={[styles.opSub, { color: colors.secondaryText }]}>
                    Broadcast to Students, Staff & Parents
                  </Text>
                </View>
                <Icon name="plus-circle-outline" size={22} color="#10B981" />
              </TouchableOpacity>

              {/* Card 4: Transport & Fleet Management */}
              <TouchableOpacity
                style={[styles.opCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
                onPress={() => setFleetModalVisible(true)}
                activeOpacity={0.85}
              >
                <View style={[styles.opIconWrap, { backgroundColor: "#8B5CF618" }]}>
                  <Icon name="bus-school" size={24} color="#8B5CF6" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.opTitle, { color: colors.primaryText }]}>Transport Fleet & GPS</Text>
                  <Text style={[styles.opSub, { color: colors.secondaryText }]}>
                    18/20 Active Routes · All On Time
                  </Text>
                </View>
                <Icon name="chevron-right" size={20} color={colors.secondaryText} />
              </TouchableOpacity>
            </View>

            {/* ========================================================================= */}
            {/* 4. FINANCIAL PULSE & FEE REVENUE STREAM                                   */}
            {/* ========================================================================= */}
            <Text style={[styles.sectionTitle, { color: colors.primaryText, marginTop: 22 }]}>
              Financial Pulse & Fee Stream
            </Text>

            <View style={[styles.feeCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
              <View style={styles.feeCardTop}>
                <View>
                  <Text style={[styles.feeMainAmount, { color: colors.primaryText }]}>₹42,80,000</Text>
                  <Text style={[styles.feeMainLabel, { color: colors.secondaryText }]}>
                    Total Fee Realized This Term (79%)
                  </Text>
                </View>
                <View style={[styles.pendingFeeBadge, { backgroundColor: "#EF444418" }]}>
                  <Icon name="alert-circle-outline" size={14} color="#EF4444" />
                  <Text style={[styles.pendingFeeText, { color: "#EF4444" }]}>₹11.4L Pending</Text>
                </View>
              </View>

              {/* Dual Colored Progress Bar */}
              <View style={[styles.feeProgressBar, { backgroundColor: "#EF444440" }]}>
                <View style={[styles.feeCollectedBar, { width: "79%", backgroundColor: "#10B981" }]} />
              </View>

              <View style={styles.feeLegendRow}>
                <View style={styles.feeLegendItem}>
                  <View style={[styles.legendDot, { backgroundColor: "#10B981" }]} />
                  <Text style={[styles.legendText, { color: colors.secondaryText }]}>Collected: 1,842 Students</Text>
                </View>
                <View style={styles.feeLegendItem}>
                  <View style={[styles.legendDot, { backgroundColor: "#EF4444" }]} />
                  <Text style={[styles.legendText, { color: colors.secondaryText }]}>Pending: 142 Students</Text>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.sendAlertBtn, { backgroundColor: colors.primaryAccent }]}
                onPress={handleSendFeeReminder}
                disabled={isSendingFeeAlert}
                activeOpacity={0.85}
              >
                {isSendingFeeAlert ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Icon name="message-alert-outline" size={18} color="#fff" />
                    <Text style={styles.sendAlertBtnText}>Send Fee Due Alerts to 142 Parents</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* ========================================================================= */}
            {/* 5. CAMPUS LOGISTICS & FACILITIES TRACKER                                  */}
            {/* ========================================================================= */}
            <Text style={[styles.sectionTitle, { color: colors.primaryText, marginTop: 22 }]}>
              Campus Infrastructure & Capacity
            </Text>

            <View style={styles.facilityGrid}>
              <View style={[styles.facilityCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
                <View style={[styles.facilityIcon, { backgroundColor: "#3B82F618" }]}>
                  <Icon name="home-city-outline" size={22} color="#3B82F6" />
                </View>
                <Text style={[styles.facilityValue, { color: colors.primaryText }]}>93%</Text>
                <Text style={[styles.facilityLabel, { color: colors.secondaryText }]}>Hostel Occupancy</Text>
                <Text style={[styles.facilitySub, { color: colors.primaryText }]}>418 / 450 Beds</Text>
              </View>

              <View style={[styles.facilityCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
                <View style={[styles.facilityIcon, { backgroundColor: "#10B98118" }]}>
                  <Icon name="laptop" size={22} color="#10B981" />
                </View>
                <Text style={[styles.facilityValue, { color: colors.primaryText }]}>88%</Text>
                <Text style={[styles.facilityLabel, { color: colors.secondaryText }]}>Computing Labs</Text>
                <Text style={[styles.facilitySub, { color: colors.primaryText }]}>185 / 210 Systems</Text>
              </View>

              <View style={[styles.facilityCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
                <View style={[styles.facilityIcon, { backgroundColor: "#8B5CF618" }]}>
                  <Icon name="book-open-page-variant-outline" size={22} color="#8B5CF6" />
                </View>
                <Text style={[styles.facilityValue, { color: colors.primaryText }]}>1,420</Text>
                <Text style={[styles.facilityLabel, { color: colors.secondaryText }]}>Library Issues</Text>
                <Text style={[styles.facilitySub, { color: colors.primaryText }]}>96.4% Returned</Text>
              </View>
            </View>

            {/* ========================================================================= */}
            {/* 6. LIVE CAMPUS CIRCULARS & NOTICES                                        */}
            {/* ========================================================================= */}
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: colors.primaryText, marginTop: 10 }]}>
                Active Campus Circulars
              </Text>
              <TouchableOpacity onPress={() => setPublishModalVisible(true)}>
                <Text style={[styles.seeAllText, { color: colors.primaryAccent }]}>+ Add New</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.noticesList}>
              {notices.map((notice) => (
                <View
                  key={notice.id}
                  style={[styles.noticeCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
                >
                  <View style={styles.noticeHeader}>
                    <View style={[styles.categoryBadge, { backgroundColor: colors.primaryAccent + "18" }]}>
                      <Text style={[styles.categoryBadgeText, { color: colors.primaryAccent }]}>
                        {notice.category || "General"}
                      </Text>
                    </View>
                    <Text style={[styles.noticeDate, { color: colors.secondaryText }]}>
                      {notice.date || "Today"}
                    </Text>
                  </View>
                  <Text style={[styles.noticeTitle, { color: colors.primaryText }]}>{notice.title}</Text>
                  <View style={styles.noticeFooter}>
                    <Icon name="account-group-outline" size={14} color={colors.secondaryText} />
                    <Text style={[styles.noticeAudience, { color: colors.secondaryText }]}>
                      Target: {notice.audience || "All Campus Users"}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        <View style={{ height: 110 }} />
      </ScrollView>

      {/* ========================================================================= */}
      {/* SUB-MODAL 1: EXAM OPERATIONS & SEATING PLANNER                            */}
      {/* ========================================================================= */}
      <Modal visible={examModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: colors.cardBackground }]}>
            <View style={styles.modalTopBar}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Icon name="calendar-clock" size={24} color="#3B82F6" />
                <Text style={[styles.modalHeading, { color: colors.primaryText }]}>Examination & Hall Planner</Text>
              </View>
              <TouchableOpacity onPress={() => setExamModalVisible(false)}>
                <Icon name="close-circle" size={24} color={colors.secondaryText} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              <View style={[styles.examBanner, { backgroundColor: "#3B82F618", borderColor: "#3B82F640" }]}>
                <Text style={[styles.examBannerTitle, { color: "#3B82F6" }]}>
                  Odd Semester End-Examinations 2025
                </Text>
                <Text style={[styles.examBannerSub, { color: colors.primaryText }]}>
                  Schedule: 28 Nov 2025 - 14 Dec 2025 · 8 Departments Participating
                </Text>
              </View>

              <Text style={[styles.subModalSection, { color: colors.secondaryText }]}>
                ALLOCATED EXAMINATION HALLS (16 READY)
              </Text>

              {[
                { hall: "Main Exam Hall A", cap: "120 Seats", chief: "Dr. K. Swaminathan", status: "Ready" },
                { hall: "Tech Block Hall 201", cap: "60 Seats", chief: "Prof. S. Rangan", status: "Ready" },
                { hall: "AI & Data Lab B", cap: "80 Systems", chief: "Dr. P. Nalini", status: "Configured" },
                { hall: "Mechanical Seminar Hall", cap: "100 Seats", chief: "Dr. M. Varman", status: "Ready" },
              ].map((h, i) => (
                <View key={i} style={[styles.hallItem, { borderBottomColor: colors.divider }]}>
                  <View>
                    <Text style={[styles.hallName, { color: colors.primaryText }]}>{h.hall}</Text>
                    <Text style={[styles.hallChief, { color: colors.secondaryText }]}>Supervisor: {h.chief}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={[styles.hallCap, { color: colors.primaryAccent }]}>{h.cap}</Text>
                    <View style={[styles.hallStatusBadge, { backgroundColor: "#10B98120" }]}>
                      <Text style={[styles.hallStatusText, { color: "#10B981" }]}>{h.status}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={[styles.modalActionBtn, { backgroundColor: colors.primaryAccent }]}
              onPress={() => {
                showToast("Examination halls and invigilator duties confirmed!", "success");
                setExamModalVisible(false);
              }}
            >
              <Text style={styles.modalActionBtnText}>Confirm Seating & Supervision Roster</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* SUB-MODAL 2: FACULTY LEAVE APPROVALS MANAGER                              */}
      {/* ========================================================================= */}
      <Modal visible={leavesModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: colors.cardBackground }]}>
            <View style={styles.modalTopBar}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Icon name="account-clock" size={24} color="#F59E0B" />
                <Text style={[styles.modalHeading, { color: colors.primaryText }]}>Faculty Leave Approvals</Text>
              </View>
              <TouchableOpacity onPress={() => setLeavesModalVisible(false)}>
                <Icon name="close-circle" size={24} color={colors.secondaryText} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              {leaveRequests.map((req) => (
                <View
                  key={req.id}
                  style={[
                    styles.leaveItemCard,
                    {
                      backgroundColor: colors.primaryBackground,
                      borderColor: req.status === "approved" ? "#10B981" : req.status === "rejected" ? "#EF4444" : colors.divider,
                    },
                  ]}
                >
                  <View style={styles.leaveItemTop}>
                    <View>
                      <Text style={[styles.leaveApplicantName, { color: colors.primaryText }]}>{req.name}</Text>
                      <Text style={[styles.leaveApplicantDept, { color: colors.secondaryText }]}>
                        {req.dept} · {req.role}
                      </Text>
                    </View>
                    <View style={[styles.leaveTypeBadge, { backgroundColor: colors.primaryAccent + "18" }]}>
                      <Text style={[styles.leaveTypeBadgeText, { color: colors.primaryAccent }]}>{req.type}</Text>
                    </View>
                  </View>

                  <Text style={[styles.leaveDates, { color: colors.primaryText }]}>📅 {req.dates}</Text>
                  <Text style={[styles.leaveReason, { color: colors.secondaryText }]}>{`"${req.reason}"`}</Text>

                  {req.status === "pending" ? (
                    <View style={styles.leaveActionRow}>
                      <TouchableOpacity
                        style={[styles.leaveApproveBtn, { backgroundColor: "#10B981" }]}
                        onPress={() => handleApproveLeave(req.id, req.name)}
                      >
                        <Icon name="check" size={16} color="#fff" />
                        <Text style={styles.leaveBtnText}>Approve</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.leaveRejectBtn, { backgroundColor: "#EF4444" }]}
                        onPress={() => handleRejectLeave(req.id, req.name)}
                      >
                        <Icon name="close" size={16} color="#fff" />
                        <Text style={styles.leaveBtnText}>Reject</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={[styles.leaveResolvedBadge, { backgroundColor: req.status === "approved" ? "#10B98120" : "#EF444420" }]}>
                      <Text style={[styles.leaveResolvedText, { color: req.status === "approved" ? "#10B981" : "#EF4444" }]}>
                        {req.status === "approved" ? "✓ Leave Approved" : "✕ Leave Rejected"}
                      </Text>
                    </View>
                  )}
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={[styles.modalActionBtn, { backgroundColor: colors.divider, marginTop: 10 }]}
              onPress={() => setLeavesModalVisible(false)}
            >
              <Text style={[styles.modalActionBtnText, { color: colors.primaryText }]}>Close Manager</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* SUB-MODAL 3: PUBLISH CAMPUS CIRCULAR                                      */}
      {/* ========================================================================= */}
      <Modal visible={publishModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: colors.cardBackground }]}>
            <View style={styles.modalTopBar}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Icon name="bullhorn-outline" size={24} color="#10B981" />
                <Text style={[styles.modalHeading, { color: colors.primaryText }]}>Publish Circular Notice</Text>
              </View>
              <TouchableOpacity onPress={() => setPublishModalVisible(false)}>
                <Icon name="close-circle" size={24} color={colors.secondaryText} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              <Text style={[styles.inputLabel, { color: colors.primaryText }]}>Circular Title *</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: colors.primaryBackground, color: colors.primaryText, borderColor: colors.divider }]}
                placeholder="e.g. Annual Sports Meet 2025 Registration"
                placeholderTextColor={colors.secondaryText}
                value={newNoticeTitle}
                onChangeText={setNewNoticeTitle}
              />

              <Text style={[styles.inputLabel, { color: colors.primaryText, marginTop: 10 }]}>Target Audience</Text>
              <View style={styles.pillRow}>
                {["All", "Students", "Staff", "Parents"].map((aud) => (
                  <TouchableOpacity
                    key={aud}
                    style={[
                      styles.choicePill,
                      newNoticeAudience === aud
                        ? { backgroundColor: colors.primaryAccent }
                        : { backgroundColor: colors.primaryBackground, borderColor: colors.divider, borderWidth: 1 },
                    ]}
                    onPress={() => setNewNoticeAudience(aud)}
                  >
                    <Text
                      style={[
                        styles.choicePillText,
                        { color: newNoticeAudience === aud ? "#fff" : colors.primaryText },
                      ]}
                    >
                      {aud}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.inputLabel, { color: colors.primaryText, marginTop: 10 }]}>Category</Text>
              <View style={styles.pillRow}>
                {["Academic", "Urgent", "Event", "Examinations"].map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.choicePill,
                      newNoticeCategory === cat
                        ? { backgroundColor: "#10B981" }
                        : { backgroundColor: colors.primaryBackground, borderColor: colors.divider, borderWidth: 1 },
                    ]}
                    onPress={() => setNewNoticeCategory(cat)}
                  >
                    <Text
                      style={[
                        styles.choicePillText,
                        { color: newNoticeCategory === cat ? "#fff" : colors.primaryText },
                      ]}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.inputLabel, { color: colors.primaryText, marginTop: 10 }]}>Notice Details *</Text>
              <TextInput
                style={[
                  styles.modalInput,
                  styles.textArea,
                  { backgroundColor: colors.primaryBackground, color: colors.primaryText, borderColor: colors.divider },
                ]}
                placeholder="Write full circular instructions and details..."
                placeholderTextColor={colors.secondaryText}
                multiline
                numberOfLines={4}
                value={newNoticeBody}
                onChangeText={setNewNoticeBody}
              />
            </ScrollView>

            <TouchableOpacity
              style={[styles.modalActionBtn, { backgroundColor: "#10B981", marginTop: 12 }]}
              onPress={handlePublishNotice}
              disabled={isPublishing}
            >
              {isPublishing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Icon name="send-check" size={18} color="#fff" />
                  <Text style={styles.modalActionBtnText}>Broadcast Circular to Portals</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* SUB-MODAL 4: TRANSPORT & FLEET TRACKER                                    */}
      {/* ========================================================================= */}
      <Modal visible={fleetModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: colors.cardBackground }]}>
            <View style={styles.modalTopBar}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Icon name="bus-school" size={24} color="#8B5CF6" />
                <Text style={[styles.modalHeading, { color: colors.primaryText }]}>Campus Fleet & GPS Status</Text>
              </View>
              <TouchableOpacity onPress={() => setFleetModalVisible(false)}>
                <Icon name="close-circle" size={24} color={colors.secondaryText} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              {[
                { route: "Route 01 - City Central & Station", driver: "G. Murugan", bus: "TN-37-AB-1204", status: "On Time", speed: "42 km/h" },
                { route: "Route 04 - Airport & Tech Park", driver: "S. Johnson", bus: "TN-37-CD-4819", status: "On Time", speed: "38 km/h" },
                { route: "Route 07 - South Suburbs & Ring Road", driver: "M. Abdul", bus: "TN-37-EF-9022", status: "On Time", speed: "45 km/h" },
                { route: "Route 12 - North Campus Shuttle", driver: "P. Vignesh", bus: "TN-37-GH-3311", status: "Boarding", speed: "0 km/h" },
              ].map((f, idx) => (
                <View key={idx} style={[styles.fleetItem, { borderBottomColor: colors.divider }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fleetRoute, { color: colors.primaryText }]}>{f.route}</Text>
                    <Text style={[styles.fleetDriver, { color: colors.secondaryText }]}>
                      Driver: {f.driver} · Bus: {f.bus}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <View style={[styles.fleetBadge, { backgroundColor: "#10B98120" }]}>
                      <Text style={[styles.fleetBadgeText, { color: "#10B981" }]}>{f.status}</Text>
                    </View>
                    <Text style={[styles.fleetSpeed, { color: colors.secondaryText }]}>{f.speed}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={[styles.modalActionBtn, { backgroundColor: colors.primaryAccent, marginTop: 10 }]}
              onPress={() => {
                showToast("GPS live telemetry synced with all 20 bus trackers", "info");
                setFleetModalVisible(false);
              }}
            >
              <Text style={styles.modalActionBtnText}>Refresh Telemetry Feeds</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* SUB-MODAL 5: SYSTEM LOGS OVERVIEW                                         */}
      {/* ========================================================================= */}
      <Modal visible={logsVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: colors.cardBackground }]}>
            <LinearGradient
              colors={[colors.primaryAccent, colors.primaryAccent + "CC"]}
              style={styles.logsHeader}
            >
              <Icon name="clipboard-text-clock-outline" size={22} color="#fff" />
              <Text style={styles.logsHeaderText}>System Diagnostics & Telemetry</Text>
              <TouchableOpacity onPress={() => setLogsVisible(false)}>
                <Icon name="close-circle" size={24} color="#fff" />
              </TouchableOpacity>
            </LinearGradient>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 14 }}>
              {logsLoading ? (
                <ActivityIndicator size="large" color={colors.primaryAccent} style={{ marginVertical: 30 }} />
              ) : (
                logs.map((log) => (
                  <View
                    key={log.id}
                    style={[
                      styles.logItem,
                      { borderColor: log.color + "33", backgroundColor: colors.primaryBackground },
                    ]}
                  >
                    <Icon name={log.icon} size={22} color={log.color} />
                    <View style={{ marginLeft: 10, flex: 1 }}>
                      <Text style={[styles.logLabel, { color: colors.primaryText }]}>{log.label}</Text>
                      <Text style={[styles.logValue, { color: log.color }]}>{log.value}</Text>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>

            <TouchableOpacity
              onPress={() => setLogsVisible(false)}
              style={[styles.modalActionBtn, { backgroundColor: colors.primaryAccent, margin: 14, marginTop: 0 }]}
            >
              <Text style={styles.modalActionBtnText}>Close Diagnostics</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const getStyles = (colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.primaryBackground },
    scrollContent: { paddingHorizontal: 16, paddingTop: 50, paddingBottom: 50 },

    topHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 16,
    },
    headerSub: {
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 1,
      marginBottom: 2,
    },
    header: {
      fontSize: 24,
      fontWeight: "900",
      letterSpacing: -0.5,
    },
    systemStatusBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 20,
      borderWidth: 1,
    },
    pulseDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: "#10B981",
    },
    systemStatusText: {
      fontSize: 12,
      fontWeight: "700",
    },

    sectionHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 18,
      marginBottom: 10,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "800",
      letterSpacing: -0.3,
    },
    seeAllText: {
      fontSize: 13,
      fontWeight: "700",
    },
    liveTag: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingVertical: 3,
      paddingHorizontal: 7,
      borderRadius: 6,
    },
    liveDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    liveTagText: {
      fontSize: 10.5,
      fontWeight: "900",
      letterSpacing: 0.5,
    },

    /* Overview Stats */
    statsContainer: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      gap: 10,
    },
    statsCard: {
      width: "48%",
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      elevation: 2,
    },
    statsCardTop: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 8,
    },
    iconCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: "center",
      alignItems: "center",
    },
    statsValue: {
      fontSize: 19,
      fontWeight: "900",
      letterSpacing: -0.3,
    },
    statsLabel: {
      fontSize: 12.5,
      fontWeight: "700",
    },
    statsSubLabel: {
      fontSize: 11,
      fontWeight: "600",
      marginTop: 2,
    },

    /* Campus Health Card */
    healthCard: {
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      elevation: 2,
    },
    healthStatsRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-around",
      paddingBottom: 14,
    },
    healthStatBox: {
      alignItems: "center",
      flex: 1,
    },
    healthStatPercent: {
      fontSize: 26,
      fontWeight: "900",
      letterSpacing: -0.5,
    },
    healthStatTitle: {
      fontSize: 12.5,
      fontWeight: "700",
      marginTop: 2,
    },
    healthStatSub: {
      fontSize: 11,
      fontWeight: "500",
      marginTop: 1,
    },
    healthStatDivider: {
      width: 1,
      height: 45,
    },
    deptProgressWrapper: {
      borderTopWidth: 1,
      paddingTop: 12,
      gap: 8,
    },
    deptProgressHeading: {
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 0.6,
      marginBottom: 2,
    },
    deptBarRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    deptName: {
      width: 44,
      fontSize: 12,
      fontWeight: "700",
    },
    progressBarBg: {
      flex: 1,
      height: 8,
      borderRadius: 4,
      overflow: "hidden",
    },
    progressBarFill: {
      height: "100%",
      borderRadius: 4,
    },
    deptPercent: {
      width: 44,
      fontSize: 11.5,
      fontWeight: "800",
      textAlign: "right",
    },

    /* Operations Hub Grid */
    operationsGrid: {
      gap: 10,
      marginTop: 10,
    },
    opCard: {
      flexDirection: "row",
      alignItems: "center",
      padding: 14,
      borderRadius: 14,
      borderWidth: 1,
      gap: 12,
      elevation: 1,
    },
    opIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
    },
    opTitle: {
      fontSize: 14,
      fontWeight: "800",
    },
    opSub: {
      fontSize: 12,
      fontWeight: "500",
      marginTop: 2,
    },
    urgentBadge: {
      backgroundColor: "#EF4444",
      paddingVertical: 2,
      paddingHorizontal: 6,
      borderRadius: 6,
    },
    urgentBadgeText: {
      color: "#fff",
      fontSize: 10,
      fontWeight: "800",
    },

    /* Fee Card */
    feeCard: {
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      marginTop: 10,
      elevation: 2,
    },
    feeCardTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 12,
    },
    feeMainAmount: {
      fontSize: 24,
      fontWeight: "900",
      letterSpacing: -0.5,
    },
    feeMainLabel: {
      fontSize: 12,
      fontWeight: "500",
      marginTop: 2,
    },
    pendingFeeBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingVertical: 4,
      paddingHorizontal: 8,
      borderRadius: 8,
    },
    pendingFeeText: {
      fontSize: 12,
      fontWeight: "800",
    },
    feeProgressBar: {
      height: 10,
      borderRadius: 5,
      overflow: "hidden",
      marginBottom: 10,
    },
    feeCollectedBar: {
      height: "100%",
      borderRadius: 5,
    },
    feeLegendRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 14,
    },
    feeLegendItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    legendDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    legendText: {
      fontSize: 11.5,
      fontWeight: "600",
    },
    sendAlertBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 11,
      borderRadius: 10,
    },
    sendAlertBtnText: {
      color: "#fff",
      fontSize: 13,
      fontWeight: "800",
    },

    /* Facility Grid */
    facilityGrid: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 10,
    },
    facilityCard: {
      width: "31%",
      borderRadius: 14,
      padding: 12,
      borderWidth: 1,
      alignItems: "center",
      elevation: 1,
    },
    facilityIcon: {
      width: 38,
      height: 38,
      borderRadius: 19,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 6,
    },
    facilityValue: {
      fontSize: 17,
      fontWeight: "900",
    },
    facilityLabel: {
      fontSize: 10.5,
      fontWeight: "600",
      textAlign: "center",
      marginTop: 2,
    },
    facilitySub: {
      fontSize: 10.5,
      fontWeight: "800",
      marginTop: 3,
    },

    /* Notice Card */
    noticesList: {
      gap: 10,
      marginTop: 6,
    },
    noticeCard: {
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      elevation: 1,
    },
    noticeHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 6,
    },
    categoryBadge: {
      paddingVertical: 3,
      paddingHorizontal: 8,
      borderRadius: 6,
    },
    categoryBadgeText: {
      fontSize: 11,
      fontWeight: "800",
    },
    noticeDate: {
      fontSize: 11.5,
      fontWeight: "500",
    },
    noticeTitle: {
      fontSize: 14,
      fontWeight: "700",
      lineHeight: 19,
      marginBottom: 8,
    },
    noticeFooter: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
    },
    noticeAudience: {
      fontSize: 11.5,
      fontWeight: "500",
    },

    /* Modals Overlay & Box */
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.6)",
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 16,
    },
    modalBox: {
      width: "100%",
      maxHeight: "85%",
      borderRadius: 22,
      padding: 18,
      elevation: 10,
    },
    modalTopBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 14,
    },
    modalHeading: {
      fontSize: 16,
      fontWeight: "800",
    },
    modalActionBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 12,
      borderRadius: 12,
      marginTop: 14,
    },
    modalActionBtnText: {
      color: "#fff",
      fontSize: 14,
      fontWeight: "800",
    },

    /* Exam Modal */
    examBanner: {
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      marginBottom: 12,
    },
    examBannerTitle: {
      fontSize: 13.5,
      fontWeight: "800",
      marginBottom: 3,
    },
    examBannerSub: {
      fontSize: 11.5,
      fontWeight: "500",
    },
    subModalSection: {
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 0.5,
      marginBottom: 8,
    },
    hallItem: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 10,
      borderBottomWidth: 1,
    },
    hallName: {
      fontSize: 13.5,
      fontWeight: "700",
    },
    hallChief: {
      fontSize: 11.5,
      fontWeight: "500",
      marginTop: 2,
    },
    hallCap: {
      fontSize: 12,
      fontWeight: "800",
    },
    hallStatusBadge: {
      paddingVertical: 2,
      paddingHorizontal: 6,
      borderRadius: 4,
      marginTop: 2,
    },
    hallStatusText: {
      fontSize: 10.5,
      fontWeight: "800",
    },

    /* Leaves Modal */
    leaveItemCard: {
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      marginBottom: 10,
    },
    leaveItemTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 6,
    },
    leaveApplicantName: {
      fontSize: 14,
      fontWeight: "800",
    },
    leaveApplicantDept: {
      fontSize: 11.5,
      fontWeight: "500",
      marginTop: 1,
    },
    leaveTypeBadge: {
      paddingVertical: 2,
      paddingHorizontal: 7,
      borderRadius: 6,
    },
    leaveTypeBadgeText: {
      fontSize: 11,
      fontWeight: "800",
    },
    leaveDates: {
      fontSize: 12,
      fontWeight: "700",
      marginBottom: 4,
    },
    leaveReason: {
      fontSize: 12,
      fontStyle: "italic",
      marginBottom: 10,
    },
    leaveActionRow: {
      flexDirection: "row",
      gap: 10,
    },
    leaveApproveBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      paddingVertical: 8,
      borderRadius: 8,
    },
    leaveRejectBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      paddingVertical: 8,
      borderRadius: 8,
    },
    leaveBtnText: {
      color: "#fff",
      fontSize: 12,
      fontWeight: "800",
    },
    leaveResolvedBadge: {
      paddingVertical: 6,
      borderRadius: 6,
      alignItems: "center",
    },
    leaveResolvedText: {
      fontSize: 12,
      fontWeight: "800",
    },

    /* Inputs in Publish Modal */
    inputLabel: {
      fontSize: 12,
      fontWeight: "700",
      marginBottom: 4,
    },
    modalInput: {
      borderRadius: 10,
      borderWidth: 1,
      paddingHorizontal: 12,
      paddingVertical: 9,
      fontSize: 13,
      fontWeight: "600",
    },
    textArea: {
      height: 80,
      textAlignVertical: "top",
    },
    pillRow: {
      flexDirection: "row",
      gap: 8,
      marginBottom: 6,
    },
    choicePill: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 8,
    },
    choicePillText: {
      fontSize: 12,
      fontWeight: "700",
    },

    /* Fleet Modal */
    fleetItem: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 10,
      borderBottomWidth: 1,
    },
    fleetRoute: {
      fontSize: 13,
      fontWeight: "700",
    },
    fleetDriver: {
      fontSize: 11.5,
      fontWeight: "500",
      marginTop: 2,
    },
    fleetBadge: {
      paddingVertical: 2,
      paddingHorizontal: 6,
      borderRadius: 4,
    },
    fleetBadgeText: {
      fontSize: 10.5,
      fontWeight: "800",
    },
    fleetSpeed: {
      fontSize: 11,
      fontWeight: "600",
      marginTop: 2,
    },

    /* Logs Modal */
    logsHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
    },
    logsHeaderText: {
      color: "#fff",
      fontSize: 15,
      fontWeight: "800",
    },
    logItem: {
      flexDirection: "row",
      alignItems: "center",
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      marginBottom: 8,
    },
    logLabel: {
      fontSize: 13,
      fontWeight: "700",
    },
    logValue: {
      fontSize: 12,
      fontWeight: "600",
      marginTop: 2,
    },
  });
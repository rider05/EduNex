import React, { useRef, useEffect, useState, useMemo, useCallback } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ScrollView,
  ActivityIndicator,
  FlatList,
  Alert,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import DateTimePicker from "@react-native-community/datetimepicker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import QRCode from "react-native-qrcode-svg";
import { useTheme } from "../../../context/ThemeContext";
import { api } from "../../../services/api";
import { getStudentData } from "../../../services/dataService";
import { resolveIdentity } from "../../../services/identityService";
import { showToast } from "../../../utils/toastService";
import { shareLeaveGatePassPdf } from "../../../utils/pdfGenerator";

// ---------------- Leave Category Theming (Applied STRICTLY to pills & category badges) ----------------
const LEAVE_TYPE_THEMES = {
  "Academic OD": {
    color: "#8B5CF6", // Purple
    bgLight: "#8B5CF618",
    border: "#8B5CF640",
    icon: "school-outline",
    badge: "ACADEMIC ON-DUTY",
  },
  "Medical Leave": {
    color: "#EF4444", // Crimson Red
    bgLight: "#EF444418",
    border: "#EF444440",
    icon: "medical-bag",
    badge: "MEDICAL LEAVE",
  },
  "Personal Leave": {
    color: "#3B82F6", // Royal Blue
    bgLight: "#3B82F618",
    border: "#3B82F640",
    icon: "home-account",
    badge: "CASUAL / PERSONAL",
  },
  "Placement Drive": {
    color: "#10B981", // Emerald Green
    bgLight: "#10B98118",
    border: "#10B98140",
    icon: "briefcase-outline",
    badge: "CAREER / INTERVIEWS",
  },
  "Emergency": {
    color: "#F59E0B", // Amber Orange
    bgLight: "#F59E0B18",
    border: "#F59E0B40",
    icon: "alert-circle-outline",
    badge: "EMERGENCY PASS",
  },
};

const STATUS_CONFIG = {
  pending: {
    label: "PENDING APPROVAL",
    color: "#F59E0B",
    bgLight: "#F59E0B18",
    icon: "clock-alert-outline",
    sub: "Awaiting Staff Advisor Verification",
  },
  approved: {
    label: "APPROVED & ACTIVE",
    color: "#10B981",
    bgLight: "#10B98118",
    icon: "check-decagram",
    sub: "24-Hr Digital Pass Verified",
  },
  rejected: {
    label: "REJECTED",
    color: "#EF4444",
    bgLight: "#EF444418",
    icon: "close-circle-outline",
    sub: "Declined by Department Faculty",
  },
  expired: {
    label: "EXPIRED",
    color: "#64748B",
    bgLight: "#64748B18",
    icon: "history",
    sub: "24-Hr Window Elapsed",
  },
};

const HISTORY_FILTER_TABS = ["All", "Pending", "Approved", "Rejected", "Expired"];

const leaveTypesList = [
  { label: "Academic OD", icon: "school-outline" },
  { label: "Medical Leave", icon: "medical-bag" },
  { label: "Personal Leave", icon: "home-account" },
  { label: "Placement Drive", icon: "briefcase-outline" },
  { label: "Emergency", icon: "alert-circle-outline" },
];

const sessionList = ["Full Day", "Forenoon (FN)", "Afternoon (AN)"];

// ---------------- Helpers ----------------
const formatDate = (value) => {
  if (!value) return "";
  if (typeof value?.toDate === "function") return value.toDate().toDateString();
  if (value instanceof Date) return value.toDateString();
  try {
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d.toDateString();
  } catch {}
  return "";
};

const toJsDate = (v) => {
  if (!v) return new Date();
  if (typeof v?.toDate === "function") return v.toDate();
  try {
    const d = new Date(v);
    if (!isNaN(d.getTime())) return d;
  } catch {}
  return new Date();
};

const calculateDays = (from, to) => {
  const start = toJsDate(from);
  const end = toJsDate(to);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return diffDays > 0 ? diffDays : 1;
};

// Calculate 24h Remaining Validity
const get24HourRemainingText = (expiresAt) => {
  if (!expiresAt) return "24 hrs remaining";
  const exp = new Date(expiresAt).getTime();
  const now = Date.now();
  const diff = exp - now;
  if (diff <= 0) return "Expired";
  const hrs = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${hrs}h ${mins}m remaining`;
};

// ---------------- Main Component ----------------
export default function CollegeLeaveFormModal({ visible, onClose }) {
  const { colors, isDarkMode } = useTheme();
  const slideAnim = useRef(new Animated.Value(350)).current;

  // View Mode: 'form' | 'history'
  const [currentView, setCurrentView] = useState("form");

  // Student DB Profile
  const [studentInfo, setStudentInfo] = useState({
    name: "",
    rollNo: "",
    department: "",
    deptCode: "",
    year: "",
    section: "",
    emergencyContact: "",
    advisor: "",
  });

  // Form fields
  const [leaveType, setLeaveType] = useState("Academic OD");
  const [sessionTiming, setSessionTiming] = useState("Full Day");
  const [reason, setReason] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");

  const [fromDate, setFromDate] = useState(new Date());
  const [toDate, setToDate] = useState(new Date());
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);

  // Active leave & Status Card (Pending / Approved / Rejected / Expired)
  const [existingLeave, setExistingLeave] = useState(null);
  const [remainingTimeText, setRemainingTimeText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // History & Filter
  const [historyRecords, setHistoryRecords] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyFilter, setHistoryFilter] = useState("All");
  const [historySearch, setHistorySearch] = useState("");

  const expiryIntervalRef = useRef(null);

  // Load student data fetched directly from DB
  const loadStudentFromDB = useCallback(async () => {
    try {
      const [dbStudent, identity] = await Promise.all([
        getStudentData().catch(() => null),
        resolveIdentity().catch(() => null),
      ]);

      const name = dbStudent?.name || identity?.name || "";
      const rollNo = dbStudent?.rollNo || dbStudent?.roll || identity?.rollNo || identity?.username || "";
      const department = dbStudent?.department || identity?.department || "";
      const deptCode = department.includes("AI")
        ? "AI & DS"
        : department.includes("Computer") || department.includes("CSE")
        ? "CSE"
        : "";
      const year = dbStudent?.year || identity?.year || "";
      const section = dbStudent?.section || dbStudent?.class || "";
      const phone = dbStudent?.phone || identity?.phone || identity?.parentContact || "";
      const advisor = dbStudent?.advisor?.name || (typeof dbStudent?.advisor === "string" ? dbStudent.advisor : "") || "";

      setStudentInfo({
        name,
        rollNo,
        department,
        deptCode,
        year: typeof year === "number" ? `Year ${year}` : year,
        section: section.includes("Section") ? section : `Section ${section}`,
        emergencyContact: phone,
        advisor,
      });
      setEmergencyContact(phone);
    } catch (err) {
      console.log("Error fetching student profile for leave form:", err);
    }
  }, []);

  // Load Active Leave from LocalStorage / MongoDB (Instant non-blocking)
  const loadActiveLeave = useCallback(async () => {
    try {
      const id = await AsyncStorage.getItem("activeCollegeLeaveId");
      if (!id) {
        setExistingLeave(null);
        return;
      }

      const res = await api.get(`/leaves/${id}`).catch(() => null);
      const data = res?.data;

      if (!data) {
        const cachedRaw = await AsyncStorage.getItem(`cached_leave_${id}`);
        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw);
          setExistingLeave(cached);
          if (cached.status === "approved" && cached.expiresAt) {
            setRemainingTimeText(get24HourRemainingText(cached.expiresAt));
          }
        } else {
          await AsyncStorage.removeItem("activeCollegeLeaveId");
          setExistingLeave(null);
        }
        return;
      }

      const leave = { id: data.id || data._id || id, ...data };
      const now = Date.now();
      const expiresAtMs = leave.expiresAt
        ? new Date(leave.expiresAt).getTime()
        : new Date(leave.createdAt).getTime() + 24 * 60 * 60 * 1000;

      if (leave.status === "approved" && now >= expiresAtMs) {
        await api.patch(`/leaves/${id}`, { status: "expired" }).catch(() => null);
        await AsyncStorage.removeItem("activeCollegeLeaveId");
        setExistingLeave(null);
      } else {
        setExistingLeave(leave);
        if (leave.status === "approved") {
          setRemainingTimeText(get24HourRemainingText(leave.expiresAt || new Date(expiresAtMs).toISOString()));
        }
      }
    } catch (e) {
      console.log("loadActiveLeave error:", e?.message || e);
    }
  }, []);

  // Load Leave History
  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await api.get("/leaves", { type: "college", sort: "-createdAt", limit: 100 }).catch(() => null);
      const arr = Array.isArray(res?.data) ? res.data : [];
      setHistoryRecords(arr);
    } catch (e) {
      console.log("loadHistory err:", e?.message || e);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  // Periodic 24h Expiry Watcher
  const check24HourExpiry = useCallback(async () => {
    if (!existingLeave || existingLeave.status !== "approved") return;
    const now = Date.now();
    const expiresAtMs = existingLeave.expiresAt
      ? new Date(existingLeave.expiresAt).getTime()
      : new Date(existingLeave.createdAt).getTime() + 24 * 60 * 60 * 1000;

    if (now >= expiresAtMs) {
      await api.patch(`/leaves/${existingLeave.id || existingLeave._id}`, { status: "expired" }).catch(() => null);
      await AsyncStorage.removeItem("activeCollegeLeaveId");
      setExistingLeave(null);
      showToast("⏰ Leave pass expired (24h window elapsed)", "info");
      loadHistory();
    } else {
      setRemainingTimeText(get24HourRemainingText(existingLeave.expiresAt || new Date(expiresAtMs).toISOString()));
    }
  }, [existingLeave, loadHistory]);

  useEffect(() => {
    if (visible) {
      loadStudentFromDB();
      loadActiveLeave();
      loadHistory();

      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();

      expiryIntervalRef.current = setInterval(check24HourExpiry, 10000);
    } else {
      Animated.timing(slideAnim, {
        toValue: 350,
        duration: 200,
        useNativeDriver: true,
      }).start();

      if (expiryIntervalRef.current) {
        clearInterval(expiryIntervalRef.current);
        expiryIntervalRef.current = null;
      }
    }

    return () => {
      if (expiryIntervalRef.current) clearInterval(expiryIntervalRef.current);
    };
  }, [visible, loadStudentFromDB, loadActiveLeave, loadHistory, check24HourExpiry, slideAnim]);

  // Submit Leave Request -> Initially "pending" requiring Staff Approval
  const handleSubmit = async () => {
    if (!reason.trim()) {
      Alert.alert("Reason Required", "Please describe the specific reason for your leave / on-duty request.");
      return;
    }

    setSubmitting(true);
    try {
      const leaveId = `CL-${Math.floor(100000 + Math.random() * 900000)}`;
      const now = new Date();

      const payload = {
        leaveId,
        type: "college",
        studentName: studentInfo.name,
        rollNo: studentInfo.rollNo,
        classSection: `${studentInfo.deptCode} - ${studentInfo.section}`,
        dept: studentInfo.deptCode,
        year: studentInfo.year,
        advisor: studentInfo.advisor,
        leaveType,
        sessionTiming,
        reason: reason.trim(),
        emergencyContact: emergencyContact.trim() || studentInfo.emergencyContact,
        fromDate: toJsDate(fromDate).toISOString(),
        toDate: toJsDate(toDate).toISOString(),
        daysCount: calculateDays(fromDate, toDate),
        status: "pending", // Requires Staff Approval!
        appliedAt: now.toISOString(),
        approvalStage: "Faculty Advisor Review",
        createdAt: now.toISOString(),
      };

      let savedDocId = leaveId;
      try {
        const apiRes = await api.post("/leaves", payload);
        if (apiRes?.data?.id || apiRes?.data?._id) {
          savedDocId = apiRes.data.id || apiRes.data._id;
        }
      } catch (apiErr) {
        console.log("REST leave submit sync:", apiErr);
      }

      await AsyncStorage.setItem("activeCollegeLeaveId", savedDocId);
      await AsyncStorage.setItem(`cached_leave_${savedDocId}`, JSON.stringify({ id: savedDocId, ...payload }));

      const activeObj = {
        id: savedDocId,
        ...payload,
        fromDate: toJsDate(fromDate),
        toDate: toJsDate(toDate),
      };

      setExistingLeave(activeObj);
      showToast(`📝 ${leaveType} submitted for Staff Approval!`, "success");
      setReason("");
      loadHistory();
    } catch (e) {
      console.log("submit err:", e);
      Alert.alert("Error", e.message || "Failed to submit leave");
    } finally {
      setSubmitting(false);
    }
  };

  const clearActiveLeave = async () => {
    try {
      if (existingLeave?.id) {
        await api.patch(`/leaves/${existingLeave.id}`, { status: "expired" }).catch(() => null);
      }
      await AsyncStorage.removeItem("activeCollegeLeaveId");
      setExistingLeave(null);
      showToast("Leave request cleared", "info");
      loadHistory();
    } catch (e) {
      console.log("clearActiveLeave err:", e);
    }
  };

  const handleShareGatePass = async (leaveItem) => {
    const item = leaveItem || existingLeave;
    if (!item) return;
    try {
      await shareLeaveGatePassPdf({
        leave: {
          id: item.leaveId || item.id,
          leaveType: item.leaveType,
          startDate: formatDate(item.fromDate),
          endDate: formatDate(item.toDate),
          days: `${item.days || 1} Day(s)`,
          reason: item.reason,
          status: item.status?.toUpperCase() || "APPROVED",
          approvedBy: "Ms. Z. Ananth Angel (Class Tutor)",
        },
        student: {
          name: item.studentName || "Student",
          rollNo: item.rollNo || "—",
          department: item.dept || "Artificial Intelligence & Data Science",
          year: item.year || "III Year",
        },
      });
      showToast("Official Gate Pass PDF generated!", "success");
    } catch (err) {
      console.log("Share error:", err);
      showToast("Could not generate Gate Pass PDF", "error");
    }
  };

  // Filtered History for All 5 Tabs (All, Pending, Approved, Rejected, Expired)
  const filteredHistory = useMemo(() => {
    return historyRecords.filter((rec) => {
      const recStatus = (rec.status || "pending").toLowerCase();
      if (historyFilter !== "All" && recStatus !== historyFilter.toLowerCase()) {
        return false;
      }
      if (historySearch.trim()) {
        const q = historySearch.toLowerCase().trim();
        const matchesId = rec.leaveId?.toLowerCase().includes(q);
        const matchesReason = rec.reason?.toLowerCase().includes(q);
        const matchesType = rec.leaveType?.toLowerCase().includes(q);
        const matchesStatus = rec.status?.toLowerCase().includes(q);
        if (!matchesId && !matchesReason && !matchesType && !matchesStatus) return false;
      }
      return true;
    });
  }, [historyRecords, historyFilter, historySearch]);

  const styles = getStyles(colors, isDarkMode);

  // Status Configuration for Current Existing Leave
  const currentStatusConf = existingLeave
    ? STATUS_CONFIG[existingLeave.status?.toLowerCase()] || STATUS_CONFIG.pending
    : null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlayFull}>
        {/* ========================================================================= */}
        {/* 1. TOP HEADER (Standard Theme - Consistent Header)                        */}
        {/* ========================================================================= */}
        <View style={[styles.fullHeader, { backgroundColor: colors.primaryAccent }]}>
          <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
            <Icon name="arrow-left" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 6 }}>
            <Text style={styles.fullHeaderTitle}>College Leave & OD Form</Text>
            <Text style={styles.fullHeaderSub}>Staff Verification & 24-Hr Gate Pass Hub</Text>
          </View>

          <View style={{ flexDirection: "row", gap: 6 }}>
            <TouchableOpacity
              onPress={() => setCurrentView(currentView === "history" ? "form" : "history")}
              style={[styles.headerBtn, { backgroundColor: "rgba(255,255,255,0.2)" }]}
            >
              <Icon name={currentView === "history" ? "form-select" : "history"} size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* ========================================================================= */}
        {/* 2. BODY CONTENT (FORM OR HISTORY)                                         */}
        {/* ========================================================================= */}
        <Animated.View
          style={[
            styles.cardFull,
            {
              backgroundColor: colors.cardBackground,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {currentView === "history" ? (
            /* ---------------- HISTORY VIEW (WITH APPROVED, REJECTED, PENDING, EXPIRED TABS) ---------------- */
            <View style={{ flex: 1 }}>
              <View style={[styles.historyControlBar, { backgroundColor: colors.cardBackground, borderBottomColor: colors.divider }]}>
                <View style={[styles.historySearchBar, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                  <Icon name="magnify" size={18} color={colors.secondaryText} />
                  <TextInput
                    style={[styles.historySearchInput, { color: colors.primaryText }]}
                    placeholder="Search by Pass ID, category or reason..."
                    placeholderTextColor={colors.disabledText}
                    value={historySearch}
                    onChangeText={setHistorySearch}
                  />
                  {historySearch.length > 0 && (
                    <TouchableOpacity onPress={() => setHistorySearch("")}>
                      <Icon name="close-circle" size={16} color={colors.secondaryText} />
                    </TouchableOpacity>
                  )}
                </View>

                {/* 5 Distinct Filter Tabs */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingTop: 8 }}>
                  {HISTORY_FILTER_TABS.map((tab) => {
                    const isSel = historyFilter === tab;
                    let tabColor = colors.primaryAccent;
                    if (tab === "Pending") tabColor = "#F59E0B";
                    if (tab === "Approved") tabColor = "#10B981";
                    if (tab === "Rejected") tabColor = "#EF4444";
                    if (tab === "Expired") tabColor = "#64748B";

                    return (
                      <TouchableOpacity
                        key={tab}
                        style={[
                          styles.filterTabPill,
                          isSel
                            ? { backgroundColor: tabColor, borderColor: tabColor }
                            : { backgroundColor: colors.primaryBackground, borderColor: colors.divider },
                        ]}
                        onPress={() => setHistoryFilter(tab)}
                      >
                        <Text style={[styles.filterTabPillText, { color: isSel ? "#FFFFFF" : colors.primaryText }]}>
                          {tab}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {historyLoading ? (
                <View style={{ paddingVertical: 40, alignItems: "center" }}>
                  <ActivityIndicator size="large" color={colors.primaryAccent} />
                </View>
              ) : filteredHistory.length === 0 ? (
                <View style={[styles.emptyHistoryBox, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
                  <Icon name="calendar-blank-outline" size={44} color={colors.disabledText} />
                  <Text style={[styles.emptyHistoryTitle, { color: colors.primaryText }]}>No {historyFilter} Records Found</Text>
                  <Text style={[styles.emptyHistorySub, { color: colors.secondaryText }]}>
                    All your {historyFilter.toLowerCase()} leave requests and gate passes will appear here.
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={filteredHistory}
                  keyExtractor={(item) => item.id || item._id || item.leaveId}
                  contentContainerStyle={{ padding: 16, gap: 10 }}
                  renderItem={({ item }) => {
                    const statusKey = (item.status || "pending").toLowerCase();
                    const statusConf = STATUS_CONFIG[statusKey] || STATUS_CONFIG.pending;
                    const itemCategoryTheme = LEAVE_TYPE_THEMES[item.leaveType] || LEAVE_TYPE_THEMES["Academic OD"];

                    return (
                      <View
                        style={[
                          styles.historyCard,
                          { backgroundColor: colors.cardBackground, borderColor: colors.divider },
                        ]}
                      >
                        <View style={styles.historyCardTop}>
                          <View style={styles.historyIdGroup}>
                            <Text style={[styles.historyLeaveId, { color: colors.primaryText }]}>#{item.leaveId}</Text>
                            
                            {/* Explicit Status Badge */}
                            <View style={[styles.historyStatusBadge, { backgroundColor: statusConf.bgLight }]}>
                              <Icon name={statusConf.icon} size={12} color={statusConf.color} style={{ marginRight: 3 }} />
                              <Text style={[styles.historyStatusText, { color: statusConf.color }]}>
                                {statusConf.label}
                              </Text>
                            </View>
                          </View>

                          {/* Specific Category Pill Color Badge */}
                          <View style={[styles.categoryBadgePill, { backgroundColor: itemCategoryTheme.bgLight, borderColor: itemCategoryTheme.border }]}>
                            <Text style={[styles.categoryBadgePillText, { color: itemCategoryTheme.color }]}>
                              {item.leaveType}
                            </Text>
                          </View>
                        </View>

                        <Text style={[styles.historyReason, { color: colors.primaryText }]} numberOfLines={2}>
                          {item.reason || "Academic absence"}
                        </Text>

                        {item.advisorRemark && (
                          <View style={[styles.historyRemarkBox, { backgroundColor: colors.primaryBackground }]}>
                            <Text style={[styles.historyRemarkText, { color: colors.secondaryText }]}>
                              {`👨‍🏫 Staff Note: "${item.advisorRemark}"`}
                            </Text>
                          </View>
                        )}

                        <View style={styles.historyCardBottom}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                            <Icon name="calendar-range" size={13} color={colors.secondaryText} />
                            <Text style={[styles.historyDateRange, { color: colors.secondaryText }]}>
                              {formatDate(item.fromDate)} → {formatDate(item.toDate)}
                            </Text>
                          </View>

                          {statusKey === "approved" && (
                            <TouchableOpacity
                              style={[styles.historyShareMiniBtn, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}
                              onPress={() => handleShareGatePass(item)}
                            >
                              <Icon name="share-variant" size={13} color={colors.primaryAccent} />
                              <Text style={[styles.historyShareMiniText, { color: colors.primaryAccent }]}>Share Pass</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    );
                  }}
                />
              )}
            </View>
          ) : (
            /* ---------------- MAIN FORM VIEW WITH STATUS CARD ---------------- */
            <ScrollView
              contentContainerStyle={styles.formContainer}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* ========================================================================= */}
              {/* 3. ACTIVE LEAVE STATUS CARD (PENDING STAFF APPROVAL / APPROVED / REJECTED) */}
              {/* ========================================================================= */}
              {existingLeave && currentStatusConf && (
                <View style={[styles.activeStatusCard, { backgroundColor: colors.primaryBackground, borderColor: currentStatusConf.color }]}>
                  {/* Status Banner Top */}
                  <View style={styles.activeStatusTop}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
                      <View style={[styles.liveDot, { backgroundColor: currentStatusConf.color }]} />
                      <Text style={[styles.activeStatusHeading, { color: currentStatusConf.color }]}>
                        {currentStatusConf.label}
                      </Text>
                    </View>
                    <Text style={[styles.activeStatusId, { color: colors.primaryText }]}>#{existingLeave.leaveId}</Text>
                  </View>

                  {/* Body Info */}
                  <View style={styles.activeStatusBody}>
                    <View style={{ flex: 1 }}>
                      {/* Pill style category badge */}
                      <View style={{ alignSelf: "flex-start", marginBottom: 4 }}>
                        <View
                          style={[
                            styles.categoryBadgePill,
                            {
                              backgroundColor:
                                (LEAVE_TYPE_THEMES[existingLeave.leaveType] || LEAVE_TYPE_THEMES["Academic OD"]).bgLight,
                              borderColor:
                                (LEAVE_TYPE_THEMES[existingLeave.leaveType] || LEAVE_TYPE_THEMES["Academic OD"]).border,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.categoryBadgePillText,
                              {
                                color:
                                  (LEAVE_TYPE_THEMES[existingLeave.leaveType] || LEAVE_TYPE_THEMES["Academic OD"]).color,
                              },
                            ]}
                          >
                            {existingLeave.leaveType}
                          </Text>
                        </View>
                      </View>

                      <Text style={[styles.activeSessionText, { color: colors.secondaryText }]}>
                        {existingLeave.sessionTiming} · {calculateDays(existingLeave.fromDate, existingLeave.toDate)} Day(s)
                      </Text>

                      {/* Status-Specific Details */}
                      {existingLeave.status === "pending" && (
                        <View style={styles.pendingReviewNotice}>
                          <Icon name="account-clock" size={16} color="#F59E0B" />
                          <Text style={styles.pendingReviewNoticeText}>
                            Forwarded to <Text style={{ fontWeight: "800" }}>{studentInfo.advisor}</Text> for approval.
                          </Text>
                        </View>
                      )}

                      {existingLeave.status === "approved" && (
                        <View style={styles.activeTimerRow}>
                          <Icon name="clock-outline" size={15} color="#10B981" />
                          <Text style={[styles.activeTimerVal, { color: "#10B981" }]}>
                            ⏳ {remainingTimeText || "24 hrs validity"}
                          </Text>
                        </View>
                      )}

                      {existingLeave.status === "rejected" && (
                        <View style={styles.rejectedNotice}>
                          <Icon name="alert-circle-outline" size={15} color="#EF4444" />
                          <Text style={styles.rejectedNoticeText}>
                            Leave application declined by class advisor.
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* QR Code Mini Preview (Shown when approved) */}
                    {existingLeave.status === "approved" && (
                      <View style={[styles.miniQrWrap, { borderColor: "#10B981" }]}>
                        <QRCode
                          value={JSON.stringify({
                            id: existingLeave.leaveId,
                            name: existingLeave.studentName,
                            roll: existingLeave.rollNo,
                            exp: existingLeave.expiresAt,
                            status: "APPROVED_GATE_PASS",
                          })}
                          size={64}
                          color="#0F172A"
                          backgroundColor="#FFFFFF"
                        />
                      </View>
                    )}
                  </View>

                  {/* 3-Step Approval Visual Stepper */}
                  <View style={[styles.stepperWrap, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
                    <View style={styles.stepperItem}>
                      <Icon name="check-circle" size={16} color="#10B981" />
                      <Text style={[styles.stepperText, { color: colors.primaryText }]}>1. Applied</Text>
                    </View>
                    <View style={[styles.stepperLine, { backgroundColor: existingLeave.status !== "pending" ? "#10B981" : "#F59E0B" }]} />
                    <View style={styles.stepperItem}>
                      <Icon
                        name={
                          existingLeave.status === "approved"
                            ? "check-circle"
                            : existingLeave.status === "rejected"
                            ? "close-circle"
                            : "clock-outline"
                        }
                        size={16}
                        color={
                          existingLeave.status === "approved"
                            ? "#10B981"
                            : existingLeave.status === "rejected"
                            ? "#EF4444"
                            : "#F59E0B"
                        }
                      />
                      <Text style={[styles.stepperText, { color: colors.primaryText }]}>2. Staff Review</Text>
                    </View>
                    <View style={[styles.stepperLine, { backgroundColor: existingLeave.status === "approved" ? "#10B981" : colors.divider }]} />
                    <View style={styles.stepperItem}>
                      <Icon
                        name={existingLeave.status === "approved" ? "qrcode-scan" : "lock-outline"}
                        size={16}
                        color={existingLeave.status === "approved" ? "#10B981" : colors.disabledText}
                      />
                      <Text style={[styles.stepperText, { color: existingLeave.status === "approved" ? colors.primaryText : colors.disabledText }]}>
                        3. 24h Pass
                      </Text>
                    </View>
                  </View>

                  {/* Actions */}
                  <View style={styles.activeStatusActionRow}>
                    {existingLeave.status === "approved" && (
                      <TouchableOpacity
                        style={[styles.activeShareBtn, { backgroundColor: "#10B981" }]}
                        onPress={() => handleShareGatePass(existingLeave)}
                        activeOpacity={0.8}
                      >
                        <Icon name="share-variant" size={15} color="#FFFFFF" />
                        <Text style={styles.activeShareBtnText}>Share Gate Pass</Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      style={[styles.activeCancelBtn, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
                      onPress={clearActiveLeave}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.activeCancelBtnText, { color: colors.primaryText }]}>
                        {existingLeave.status === "pending" ? "Withdraw Request" : "Clear Pass"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* ========================================================================= */}
              {/* 4. VERIFIED APPLICANT HERO CARD (Standard Theme)                          */}
              {/* ========================================================================= */}
              <View style={[styles.applicantHeroCard, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                <View style={styles.applicantTopRow}>
                  <View style={[styles.applicantAvatar, { backgroundColor: colors.primaryAccent + "18" }]}>
                    <Icon name="account-check-outline" size={22} color={colors.primaryAccent} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[styles.applicantName, { color: colors.primaryText }]}>{studentInfo.name}</Text>
                    <Text style={[styles.applicantMeta, { color: colors.secondaryText }]}>
                      {studentInfo.rollNo} · {studentInfo.deptCode} ({studentInfo.year})
                    </Text>
                  </View>
                  <View style={[styles.dbVerifiedPill, { backgroundColor: "#10B98118" }]}>
                    <Icon name="check-decagram" size={12} color="#10B981" />
                    <Text style={[styles.dbVerifiedText, { color: "#10B981" }]}>DB VERIFIED</Text>
                  </View>
                </View>
              </View>

              {/* ========================================================================= */}
              {/* 5. DYNAMIC LEAVE CATEGORY PILLS (COLOR ONLY ON THE PILLS THEMSELVES)      */}
              {/* ========================================================================= */}
              <Text style={[styles.sectionLabel, { color: colors.primaryText, marginTop: 14 }]}>
                Select Leave Category
              </Text>
              <View style={styles.categoryGrid}>
                {leaveTypesList.map((t) => {
                  const isSel = leaveType === t.label;
                  const theme = LEAVE_TYPE_THEMES[t.label];

                  return (
                    <TouchableOpacity
                      key={t.label}
                      style={[
                        styles.categoryCard,
                        isSel
                          ? {
                              backgroundColor: theme.bgLight,
                              borderColor: theme.color,
                              borderWidth: 1.8,
                            }
                          : {
                              backgroundColor: colors.primaryBackground,
                              borderColor: colors.divider,
                              borderWidth: 1,
                            },
                      ]}
                      onPress={() => !submitting && setLeaveType(t.label)}
                      activeOpacity={0.8}
                    >
                      <Icon
                        name={t.icon}
                        size={20}
                        color={isSel ? theme.color : colors.secondaryText}
                      />
                      <Text
                        style={[
                          styles.categoryTitle,
                          {
                            color: isSel ? theme.color : colors.primaryText,
                            fontWeight: isSel ? "800" : "600",
                          },
                        ]}
                      >
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* ========================================================================= */}
              {/* 6. LEAVE DURATION & SCHEDULE (Standard Theme)                             */}
              {/* ========================================================================= */}
              <Text style={[styles.sectionLabel, { color: colors.primaryText, marginTop: 16 }]}>
                Leave Duration & Schedule
              </Text>

              <View style={styles.datePickerRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabel, { color: colors.secondaryText }]}>From Date</Text>
                  <TouchableOpacity
                    style={[
                      styles.dateSelectBtn,
                      { backgroundColor: colors.primaryBackground, borderColor: colors.divider },
                    ]}
                    onPress={() => !submitting && setShowFromPicker(true)}
                    activeOpacity={0.8}
                  >
                    <Icon name="calendar-start" size={18} color={colors.primaryAccent} />
                    <Text style={[styles.dateSelectText, { color: colors.primaryText }]}>
                      {formatDate(fromDate)}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabel, { color: colors.secondaryText }]}>To Date</Text>
                  <TouchableOpacity
                    style={[
                      styles.dateSelectBtn,
                      { backgroundColor: colors.primaryBackground, borderColor: colors.divider },
                    ]}
                    onPress={() => !submitting && setShowToPicker(true)}
                    activeOpacity={0.8}
                  >
                    <Icon name="calendar-end" size={18} color={colors.primaryAccent} />
                    <Text style={[styles.dateSelectText, { color: colors.primaryText }]}>
                      {formatDate(toDate)}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Duration Counter Pill */}
              <View style={[styles.durationCounterBadge, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                <Icon name="clock-check-outline" size={16} color={colors.primaryAccent} />
                <Text style={[styles.durationCounterText, { color: colors.primaryText }]}>
                  Duration: <Text style={{ color: colors.primaryAccent, fontWeight: "800" }}>{calculateDays(fromDate, toDate)} Day(s)</Text> · Staff Clearance Required
                </Text>
              </View>

              {/* Session Period */}
              <View style={{ marginTop: 12 }}>
                <Text style={[styles.inputLabel, { color: colors.secondaryText }]}>Session Period</Text>
                <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
                  {sessionList.map((s) => {
                    const isSel = sessionTiming === s;
                    return (
                      <TouchableOpacity
                        key={s}
                        style={[
                          styles.sessionTimingPill,
                          isSel
                            ? { backgroundColor: colors.primaryAccent, borderColor: colors.primaryAccent }
                            : { backgroundColor: colors.primaryBackground, borderColor: colors.divider },
                        ]}
                        onPress={() => setSessionTiming(s)}
                      >
                        <Text style={[styles.miniPillText, { color: isSel ? "#FFFFFF" : colors.primaryText }]}>
                          {s}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Date Pickers */}
              {showFromPicker && (
                <DateTimePicker
                  value={toJsDate(fromDate)}
                  mode="date"
                  onChange={(_e, d) => {
                    setShowFromPicker(false);
                    if (d) setFromDate(d);
                  }}
                />
              )}
              {showToPicker && (
                <DateTimePicker
                  value={toJsDate(toDate)}
                  mode="date"
                  onChange={(_e, d) => {
                    setShowToPicker(false);
                    if (d) setToDate(d);
                  }}
                />
              )}

              {/* Reason Input */}
              <Text style={[styles.sectionLabel, { color: colors.primaryText, marginTop: 16 }]}>
                Reason for Leave / On-Duty
              </Text>
              <TextInput
                style={[
                  styles.textAreaField,
                  { backgroundColor: colors.primaryBackground, borderColor: colors.divider, color: colors.primaryText },
                ]}
                value={reason}
                onChangeText={setReason}
                multiline
                numberOfLines={4}
                placeholder="State specific reason for absence or workshop / symposium title for staff review..."
                placeholderTextColor={colors.disabledText}
                editable={!submitting}
              />

              {/* Emergency Contact */}
              <Text style={[styles.inputLabel, { color: colors.secondaryText, marginTop: 12 }]}>
                Parent / Guardian Emergency Phone
              </Text>
              <TextInput
                style={[
                  styles.inputField,
                  { backgroundColor: colors.primaryBackground, borderColor: colors.divider, color: colors.primaryText },
                ]}
                value={emergencyContact}
                onChangeText={setEmergencyContact}
                placeholder="+91 Phone Number"
                placeholderTextColor={colors.disabledText}
                keyboardType="phone-pad"
                editable={!submitting}
              />

              {/* Submit Button (Forward to Staff Approval) */}
              <View style={styles.formActionRow}>
                <TouchableOpacity
                  style={[styles.submitFormBtn, { backgroundColor: colors.primaryAccent }]}
                  onPress={handleSubmit}
                  disabled={submitting}
                  activeOpacity={0.85}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Icon name="send-clock-outline" size={18} color="#FFFFFF" />
                      <Text style={styles.submitFormBtnText}>Submit for Staff Approval</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              <View style={{ height: 30 }} />
            </ScrollView>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

// ---------------- Styles ----------------
const getStyles = (colors, _isDarkMode) =>
  StyleSheet.create({
    overlayFull: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.8)",
    },
    fullHeader: {
      paddingTop: 44,
      paddingBottom: 14,
      paddingHorizontal: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    headerBtn: {
      padding: 6,
      borderRadius: 10,
    },
    fullHeaderTitle: {
      color: "#FFFFFF",
      fontSize: 17,
      fontWeight: "800",
      letterSpacing: -0.2,
    },
    fullHeaderSub: {
      color: "rgba(255,255,255,0.85)",
      fontSize: 11,
      fontWeight: "600",
    },

    /* Card Full */
    cardFull: {
      flex: 1,
    },
    formContainer: {
      padding: 18,
      paddingBottom: 40,
    },
    sectionLabel: {
      fontSize: 13.5,
      fontWeight: "800",
      marginBottom: 8,
    },
    inputLabel: {
      fontSize: 11,
      fontWeight: "700",
      marginBottom: 4,
    },

    /* Active Leave Status Card inside Screen */
    activeStatusCard: {
      borderRadius: 16,
      borderWidth: 1.5,
      padding: 14,
      marginBottom: 14,
      elevation: 2,
    },
    activeStatusTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
    },
    liveDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    activeStatusHeading: {
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 0.5,
    },
    activeStatusId: {
      fontSize: 12,
      fontWeight: "800",
    },
    activeStatusBody: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 10,
    },
    categoryBadgePill: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      borderWidth: 1,
    },
    categoryBadgePillText: {
      fontSize: 10.5,
      fontWeight: "800",
    },
    activeSessionText: {
      fontSize: 11.5,
      fontWeight: "500",
      marginTop: 2,
    },
    pendingReviewNotice: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      marginTop: 6,
    },
    pendingReviewNoticeText: {
      fontSize: 11,
      color: "#D97706",
      fontWeight: "600",
    },
    rejectedNotice: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      marginTop: 6,
    },
    rejectedNoticeText: {
      fontSize: 11,
      color: "#EF4444",
      fontWeight: "600",
    },
    activeTimerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      marginTop: 6,
    },
    activeTimerVal: {
      fontSize: 12,
      fontWeight: "800",
    },
    miniQrWrap: {
      padding: 6,
      backgroundColor: "#FFFFFF",
      borderRadius: 10,
      borderWidth: 1.5,
    },
    stepperWrap: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderRadius: 10,
      borderWidth: 1,
      paddingHorizontal: 10,
      paddingVertical: 8,
      marginVertical: 8,
    },
    stepperItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    stepperText: {
      fontSize: 10.5,
      fontWeight: "700",
    },
    stepperLine: {
      flex: 1,
      height: 2,
      marginHorizontal: 6,
      borderRadius: 1,
    },
    activeStatusActionRow: {
      flexDirection: "row",
      gap: 8,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: "rgba(150,150,150,0.2)",
    },
    activeShareBtn: {
      flex: 1.2,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
      paddingVertical: 9,
      borderRadius: 10,
    },
    activeShareBtnText: {
      color: "#FFFFFF",
      fontSize: 12,
      fontWeight: "800",
    },
    activeCancelBtn: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 9,
      borderRadius: 10,
      borderWidth: 1,
    },
    activeCancelBtnText: {
      fontSize: 12,
      fontWeight: "700",
    },

    /* Applicant DB Hero Card */
    applicantHeroCard: {
      borderRadius: 14,
      borderWidth: 1,
      padding: 12,
      marginBottom: 10,
    },
    applicantTopRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    applicantAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: "center",
      alignItems: "center",
    },
    applicantName: {
      fontSize: 14,
      fontWeight: "800",
    },
    applicantMeta: {
      fontSize: 11,
      fontWeight: "500",
      marginTop: 2,
    },
    dbVerifiedPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: 6,
    },
    dbVerifiedText: {
      fontSize: 9,
      fontWeight: "800",
    },

    /* Category Grid */
    categoryGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    categoryCard: {
      flexBasis: "48%",
      flexGrow: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 10,
      paddingHorizontal: 10,
      borderRadius: 12,
    },
    categoryTitle: {
      fontSize: 11.5,
      flex: 1,
    },

    /* Dates & Duration */
    datePickerRow: {
      flexDirection: "row",
      gap: 10,
    },
    dateSelectBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderRadius: 10,
      borderWidth: 1,
    },
    dateSelectText: {
      fontSize: 12,
      fontWeight: "700",
    },
    durationCounterBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingVertical: 7,
      paddingHorizontal: 10,
      borderRadius: 10,
      borderWidth: 1,
      marginTop: 8,
    },
    durationCounterText: {
      fontSize: 11.5,
      fontWeight: "600",
    },
    sessionTimingPill: {
      flex: 1,
      alignItems: "center",
      paddingVertical: 7,
      borderRadius: 10,
      borderWidth: 1,
    },
    miniPillText: {
      fontSize: 11,
      fontWeight: "700",
    },

    /* Inputs */
    textAreaField: {
      borderRadius: 12,
      borderWidth: 1,
      padding: 10,
      fontSize: 12.5,
      textAlignVertical: "top",
      minHeight: 75,
    },
    inputField: {
      borderRadius: 10,
      borderWidth: 1,
      paddingHorizontal: 12,
      paddingVertical: 9,
      fontSize: 12.5,
      fontWeight: "600",
    },
    formActionRow: {
      marginTop: 16,
    },
    submitFormBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 13,
      borderRadius: 12,
      elevation: 2,
    },
    submitFormBtnText: {
      color: "#FFFFFF",
      fontSize: 13.5,
      fontWeight: "800",
    },

    /* History Styles */
    historyControlBar: {
      padding: 12,
      borderBottomWidth: 1,
    },
    historySearchBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 10,
      borderWidth: 1,
    },
    historySearchInput: {
      flex: 1,
      fontSize: 12,
      padding: 0,
    },
    filterTabPill: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
    },
    filterTabPillText: {
      fontSize: 11,
      fontWeight: "800",
    },
    emptyHistoryBox: {
      margin: 20,
      borderRadius: 16,
      borderWidth: 1,
      padding: 30,
      alignItems: "center",
    },
    emptyHistoryTitle: {
      fontSize: 14.5,
      fontWeight: "800",
      marginTop: 10,
    },
    emptyHistorySub: {
      fontSize: 11.5,
      textAlign: "center",
      marginTop: 4,
    },
    historyCard: {
      borderRadius: 14,
      borderWidth: 1,
      padding: 12,
    },
    historyCardTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 6,
    },
    historyIdGroup: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    historyLeaveId: {
      fontSize: 12.5,
      fontWeight: "800",
    },
    historyStatusBadge: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    historyStatusText: {
      fontSize: 9,
      fontWeight: "900",
    },
    historyReason: {
      fontSize: 12,
      fontWeight: "600",
      marginBottom: 6,
    },
    historyRemarkBox: {
      padding: 6,
      borderRadius: 6,
      marginBottom: 6,
    },
    historyRemarkText: {
      fontSize: 10.5,
      fontWeight: "500",
      fontStyle: "italic",
    },
    historyCardBottom: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingTop: 6,
      borderTopWidth: 1,
      borderTopColor: "rgba(150,150,150,0.15)",
    },
    historyDateRange: {
      fontSize: 10.5,
      fontWeight: "500",
    },
    historyShareMiniBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      borderWidth: 1,
    },
    historyShareMiniText: {
      fontSize: 10.5,
      fontWeight: "800",
    },
  });

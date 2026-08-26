import React, { useRef, useEffect, useState, useMemo } from "react";
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
  Share,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import DateTimePicker from "@react-native-community/datetimepicker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import QRCode from "react-native-qrcode-svg";
import { useTheme } from "../../../context/ThemeContext";
import { api } from "../../../services/api";
import { showToast } from "../../../utils/toastService";

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

const startOfToday = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
};

const isDateExpired = (value) => {
  const d = toJsDate(value);
  return d < startOfToday();
};

const calculateDays = (from, to) => {
  const start = toJsDate(from);
  const end = toJsDate(to);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return diffDays > 0 ? diffDays : 1;
};

// ---------------- Main Component ----------------
export default function CollegeLeaveFormModal({ visible, onClose }) {
  const { colors, isDarkMode } = useTheme();
  const slideAnim = useRef(new Animated.Value(350)).current;

  // UI mode: 'form' | 'pending' | 'approved' | 'rejected' | 'history'
  const [mode, setMode] = useState("form");

  // Form fields
  const [studentName, setStudentName] = useState("Karthik Raja M");
  const [rollNo, setRollNo] = useState("25ACSE001");
  const [classSection] = useState("AI & DS - A");
  const [dept, setDept] = useState("AI & DS");
  const [year, setYear] = useState("III Year");
  const [leaveType, setLeaveType] = useState("Academic OD");
  const [sessionTiming, setSessionTiming] = useState("Full Day");
  const [reason, setReason] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("+91 98765 43210");

  const [fromDate, setFromDate] = useState(new Date());
  const [toDate, setToDate] = useState(new Date());
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);

  // Active leave
  const [existingLeave, setExistingLeave] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // History & Filter
  const [historyRecords, setHistoryRecords] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyFilter, setHistoryFilter] = useState("All");
  const [historySearch, setHistorySearch] = useState("");

  const activePollRef = useRef(null);
  const expiryIntervalRef = useRef(null);

  const deptList = ["AI & DS", "CSE", "ECE", "EEE", "MECH", "CIVIL", "AIML", "IT"];
  const yearList = ["I Year", "II Year", "III Year", "IV Year"];
  const leaveTypes = [
    { label: "Academic OD", icon: "school-outline", desc: "Workshops & Symposiums" },
    { label: "Medical Leave", icon: "medical-bag", desc: "Illness & Medical Care" },
    { label: "Personal Leave", icon: "home-account", desc: "Family & Travel" },
    { label: "Placement Drive", icon: "briefcase-outline", desc: "Interviews & Coding" },
    { label: "Emergency", icon: "alert-circle-outline", desc: "Urgent Clearance" },
  ];
  const sessionList = ["Full Day", "Forenoon (FN)", "Afternoon (AN)"];

  useEffect(() => {
    if (visible) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
      loadActiveLeave();
      loadHistory();
      checkAndExpireLeaves();
      expiryIntervalRef.current = setInterval(checkAndExpireLeaves, 30 * 1000);
      activePollRef.current = setInterval(loadActiveLeave, 15 * 1000);
    } else {
      Animated.timing(slideAnim, {
        toValue: 350,
        duration: 200,
        useNativeDriver: true,
      }).start();
      stopActivePolling();
      if (expiryIntervalRef.current) {
        clearInterval(expiryIntervalRef.current);
        expiryIntervalRef.current = null;
      }
      setMode("form");
    }

    return () => {
      stopActivePolling();
      if (expiryIntervalRef.current) clearInterval(expiryIntervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Load Active Leave from Storage / MongoDB
  const loadActiveLeave = async () => {
    setLoadingStatus(true);
    try {
      const id = await AsyncStorage.getItem("activeCollegeLeaveId");
      if (!id) {
        setExistingLeave(null);
        setLoadingStatus(false);
        setMode("form");
        return;
      }

      const res = await api.get(`/leaves/${id}`);
      const data = res?.data;

      if (!data) {
        await AsyncStorage.removeItem("activeCollegeLeaveId");
        setExistingLeave(null);
        setMode("form");
        setLoadingStatus(false);
        return;
      }

      const leave = { id: data.id || data._id || id, ...data };
      setExistingLeave(leave);

      if (leave.status === "pending") setMode("pending");
      else if (leave.status === "approved") setMode("approved");
      else if (leave.status === "rejected") setMode("rejected");
      else if (leave.status === "expired") {
        await AsyncStorage.removeItem("activeCollegeLeaveId");
        setMode("history");
      } else {
        setMode("form");
      }

      setLoadingStatus(false);

      if (isDateExpired(leave.toDate) && leave.status !== "expired") {
        try {
          await api.patch(`/leaves/${id}`, {
            status: "expired",
            expiredAt: new Date().toISOString(),
          });
          await AsyncStorage.removeItem("activeCollegeLeaveId");
          setExistingLeave((p) => ({ ...(p || {}), status: "expired" }));
        } catch (e) {
          console.log("error marking leave expired:", e);
        }
      }
    } catch (e) {
      console.log("loadActiveLeave error:", e?.message || e);
      setLoadingStatus(false);
    }
  };

  const stopActivePolling = () => {
    if (activePollRef.current) {
      clearInterval(activePollRef.current);
      activePollRef.current = null;
    }
  };

  // Load Leave History
  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await api.get("/leaves", { type: "college", sort: "-createdAt", limit: 100 });
      const arr = Array.isArray(res?.data) ? res.data : [];
      setHistoryRecords(arr);
    } catch (e) {
      console.log("loadHistory err:", e?.message || e);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Expire Check
  const checkAndExpireLeaves = async () => {
    try {
      const res = await api.get("/leaves", { type: "college", limit: 100 });
      const docs = Array.isArray(res?.data) ? res.data : [];

      for (const d of docs) {
        if (!d || d.status === "expired") continue;
        if (d.toDate && isDateExpired(d.toDate)) {
          try {
            await api.patch(`/leaves/${d.id || d._id}`, {
              status: "expired",
              expiredAt: new Date().toISOString(),
            });
            const activeId = await AsyncStorage.getItem("activeCollegeLeaveId");
            if (activeId === (d.id || d._id)) {
              await AsyncStorage.removeItem("activeCollegeLeaveId");
              if (existingLeave && (existingLeave.id === d.id || existingLeave._id === d._id)) {
                setExistingLeave((prev) => ({
                  ...(prev || {}),
                  status: "expired",
                }));
                setMode("history");
                showToast("Leave pass has expired", "info");
              }
            }
          } catch (e) {
            console.log("error expiring doc:", d.id, e);
          }
        }
      }
      loadHistory();
    } catch (e) {
      console.log("checkAndExpireLeaves err:", e);
    }
  };

  // Submit Leave Request
  const handleSubmit = async () => {
    if (!studentName.trim() || !dept || !reason.trim()) {
      Alert.alert("Required Fields", "Please provide your name, department, and detailed reason for leave.");
      return;
    }

    setSubmitting(true);
    try {
      const leaveId = `CL-${Math.floor(100000 + Math.random() * 900000)}`;
      let savedDocId = leaveId;

      const payload = {
        leaveId,
        type: "college",
        studentName: studentName.trim(),
        rollNo: rollNo.trim(),
        classSection: classSection.trim(),
        dept,
        year,
        leaveType,
        sessionTiming,
        reason: reason.trim(),
        emergencyContact: emergencyContact.trim(),
        fromDate: toJsDate(fromDate).toISOString(),
        toDate: toJsDate(toDate).toISOString(),
        daysCount: calculateDays(fromDate, toDate),
        status: "pending",
        statusTrack: { classStaff: "pending", hod: "pending", principal: "pending" },
        createdAt: new Date().toISOString(),
      };

      try {
        const apiRes = await api.post("/leaves", payload);
        if (apiRes?.data?.id || apiRes?.data?._id) {
          savedDocId = apiRes.data.id || apiRes.data._id;
        }
      } catch (apiErr) {
        console.log("REST leave submit fallback:", apiErr);
      }

      await AsyncStorage.setItem("activeCollegeLeaveId", savedDocId);

      setExistingLeave({
        id: savedDocId,
        ...payload,
        fromDate: toJsDate(fromDate),
        toDate: toJsDate(toDate),
      });

      setMode("pending");
      showToast("📝 Leave request submitted for staff & HOD clearance!", "success");
      setReason("");
    } catch (e) {
      console.log("submit err:", e);
      Alert.alert("Error", e.message || "Failed to submit leave");
    } finally {
      setSubmitting(false);
    }
  };

  const clearActiveLeave = async () => {
    try {
      await AsyncStorage.removeItem("activeCollegeLeaveId");
      setExistingLeave(null);
      setMode("form");
      checkAndExpireLeaves();
    } catch (e) {
      console.log("clearActiveLeave err:", e);
    }
  };

  const handleShareGatePass = async () => {
    if (!existingLeave) return;
    try {
      await Share.share({
        title: `EduNex Digital Gate Pass - ${existingLeave.leaveId}`,
        message: `🛡️ EDUNEX DIGITAL CAMPUS GATE PASS\nPass ID: ${existingLeave.leaveId}\nStudent: ${existingLeave.studentName} (${existingLeave.rollNo})\nDepartment: ${existingLeave.dept} (${existingLeave.year})\nCategory: ${existingLeave.leaveType}\nValid Window: ${formatDate(existingLeave.fromDate)} → ${formatDate(existingLeave.toDate)}\nStatus: AUTHORIZED & VERIFIED BY HOD`,
      });
      showToast("Gate pass shared!", "success");
    } catch (err) {
      console.log("Share error:", err);
    }
  };

  // Filtered History
  const filteredHistory = useMemo(() => {
    return historyRecords.filter((rec) => {
      if (historyFilter !== "All" && rec.status?.toLowerCase() !== historyFilter.toLowerCase()) {
        return false;
      }
      if (historySearch.trim()) {
        const q = historySearch.toLowerCase().trim();
        const matchesId = rec.leaveId?.toLowerCase().includes(q);
        const matchesReason = rec.reason?.toLowerCase().includes(q);
        const matchesType = rec.leaveType?.toLowerCase().includes(q);
        if (!matchesId && !matchesReason && !matchesType) return false;
      }
      return true;
    });
  }, [historyRecords, historyFilter, historySearch]);

  const styles = getStyles(colors, isDarkMode);

  // ---------------- Render Loading ----------------
  if (loadingStatus) {
    return (
      <Modal visible={visible} transparent animationType="fade">
        <View style={styles.centerOverlay}>
          <ActivityIndicator size="large" color={colors.primaryAccent} />
        </View>
      </Modal>
    );
  }

  // ---------------- 1. REJECTED VIEW ----------------
  if (existingLeave && mode === "rejected") {
    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <View style={styles.overlayFull}>
          <View style={[styles.fullHeader, { backgroundColor: "#EF4444" }]}>
            <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
              <Icon name="arrow-left" size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.fullHeaderTitle}>Leave Application Status</Text>
            <TouchableOpacity onPress={() => setMode("history")} style={styles.headerBtn}>
              <Icon name="history" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.centerModalWrap}>
            <View style={[styles.statusCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
              <View style={[styles.statusIconWrap, { backgroundColor: "#EF444418" }]}>
                <Icon name="close-circle-outline" size={54} color="#EF4444" />
              </View>

              <Text style={[styles.statusCardTitle, { color: colors.primaryText }]}>Leave Request Rejected</Text>
              <Text style={[styles.statusCardSub, { color: colors.secondaryText }]}>
                Your application could not be approved by the Department Head.
              </Text>

              <View style={[styles.infoSummaryBox, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: colors.secondaryText }]}>Reference ID</Text>
                  <Text style={[styles.summaryVal, { color: "#EF4444" }]}>{existingLeave.leaveId}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: colors.secondaryText }]}>Requested Dates</Text>
                  <Text style={[styles.summaryVal, { color: colors.primaryText }]}>
                    {formatDate(existingLeave.fromDate)} → {formatDate(existingLeave.toDate)}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: colors.secondaryText }]}>Reason Given</Text>
                  <Text style={[styles.summaryVal, { color: colors.primaryText }]} numberOfLines={2}>
                    {existingLeave.reason || "Personal commitments"}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.primaryActionBtn, { backgroundColor: colors.primaryAccent }]}
                onPress={clearActiveLeave}
                activeOpacity={0.8}
              >
                <Icon name="plus-circle-outline" size={18} color="#FFFFFF" />
                <Text style={styles.primaryActionBtnText}>Apply New Leave Request</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  // ---------------- 2. PENDING VIEW (APPROVAL PIPELINE) ----------------
  if (existingLeave && mode === "pending") {
    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <View style={styles.overlayFull}>
          <View style={[styles.fullHeader, { backgroundColor: colors.primaryAccent }]}>
            <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
              <Icon name="arrow-left" size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.fullHeaderTitle}>Approval Pipeline</Text>
            <TouchableOpacity onPress={() => setMode("history")} style={styles.headerBtn}>
              <Icon name="history" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.centerModalWrap}>
            <View style={[styles.statusCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
              {/* Pulsing Status Icon */}
              <View style={[styles.statusIconWrap, { backgroundColor: "#F59E0B18" }]}>
                <Icon name="clock-time-four-outline" size={50} color="#F59E0B" />
              </View>

              <Text style={[styles.statusCardTitle, { color: colors.primaryText }]}>Clearance in Progress</Text>
              <Text style={[styles.statusCardSub, { color: colors.secondaryText }]}>
                Application ID: <Text style={{ fontWeight: "800", color: colors.primaryText }}>{existingLeave.leaveId}</Text>
              </Text>

              {/* Multi-Tier Stepper */}
              <View style={styles.stepperContainer}>
                {[
                  { key: "classStaff", title: "Class Advisor Clearance", sub: "Academic Attendance Check" },
                  { key: "hod", title: "Department HOD Approval", sub: "Final Leave & OD Endorsement" },
                ].map((tier, idx) => {
                  const st = existingLeave?.statusTrack?.[tier.key] || "pending";
                  const isApproved = st === "approved";
                  const isRejected = st === "rejected";

                  return (
                    <View key={tier.key} style={styles.stepItem}>
                      <View style={styles.stepLeftCol}>
                        <View
                          style={[
                            styles.stepNode,
                            isApproved
                              ? { backgroundColor: "#10B981", borderColor: "#10B981" }
                              : isRejected
                              ? { backgroundColor: "#EF4444", borderColor: "#EF4444" }
                              : { backgroundColor: colors.primaryBackground, borderColor: "#F59E0B" },
                          ]}
                        >
                          <Icon
                            name={isApproved ? "check" : isRejected ? "close" : "clock-outline"}
                            size={14}
                            color={isApproved || isRejected ? "#FFFFFF" : "#F59E0B"}
                          />
                        </View>
                        {idx === 0 && <View style={[styles.stepConnector, { backgroundColor: colors.divider }]} />}
                      </View>

                      <View style={styles.stepContent}>
                        <View style={styles.stepTitleRow}>
                          <Text style={[styles.stepTitle, { color: colors.primaryText }]}>{tier.title}</Text>
                          <View
                            style={[
                              styles.stepBadge,
                              isApproved
                                ? { backgroundColor: "#10B98118" }
                                : isRejected
                                ? { backgroundColor: "#EF444418" }
                                : { backgroundColor: "#F59E0B18" },
                            ]}
                          >
                            <Text
                              style={[
                                styles.stepBadgeText,
                                { color: isApproved ? "#10B981" : isRejected ? "#EF4444" : "#D97706" },
                              ]}
                            >
                              {isApproved ? "APPROVED" : isRejected ? "REJECTED" : "AWAITING"}
                            </Text>
                          </View>
                        </View>
                        <Text style={[styles.stepSub, { color: colors.secondaryText }]}>{tier.sub}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>

              {/* Leave Info Snippet */}
              <View style={[styles.infoSummaryBox, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: colors.secondaryText }]}>Duration</Text>
                  <Text style={[styles.summaryVal, { color: colors.primaryAccent }]}>
                    {calculateDays(existingLeave.fromDate, existingLeave.toDate)} Day(s) ({existingLeave.sessionTiming || "Full Day"})
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: colors.secondaryText }]}>Leave Window</Text>
                  <Text style={[styles.summaryVal, { color: colors.primaryText }]}>
                    {formatDate(existingLeave.fromDate)} → {formatDate(existingLeave.toDate)}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.secondaryActionBtn, { borderColor: colors.divider }]}
                onPress={clearActiveLeave}
                activeOpacity={0.8}
              >
                <Text style={[styles.secondaryActionText, { color: colors.secondaryText }]}>Cancel / Create New Request</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  // ---------------- 3. APPROVED VIEW (DIGITAL GATE PASS) ----------------
  if (existingLeave && mode === "approved") {
    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <View style={styles.overlayFull}>
          <View style={[styles.fullHeader, { backgroundColor: "#10B981" }]}>
            <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
              <Icon name="arrow-left" size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.fullHeaderTitle}>Verified Campus Gate Pass</Text>
            <TouchableOpacity onPress={() => setMode("history")} style={styles.headerBtn}>
              <Icon name="history" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.centerModalWrap}>
            <View style={[styles.gatePassCard, { backgroundColor: colors.cardBackground, borderColor: "#10B98155" }]}>
              {/* Verified Pass Badge */}
              <View style={styles.gatePassHeader}>
                <View style={styles.verifiedPassPill}>
                  <Icon name="shield-check" size={16} color="#10B981" />
                  <Text style={styles.verifiedPassPillText}>AUTHORIZED BY HOD</Text>
                </View>
                <Text style={[styles.gatePassIdText, { color: colors.secondaryText }]}>#{existingLeave.leaveId}</Text>
              </View>

              {/* QR Code Container */}
              <View style={styles.qrContainer}>
                <View style={[styles.qrFrame, { borderColor: "#10B981" }]}>
                  <QRCode
                    value={JSON.stringify({
                      passId: existingLeave.leaveId,
                      name: existingLeave.studentName,
                      roll: existingLeave.rollNo,
                      dept: existingLeave.dept,
                      from: formatDate(existingLeave.fromDate),
                      to: formatDate(existingLeave.toDate),
                      status: "VERIFIED_AUTHORIZED",
                    })}
                    size={160}
                    color="#0F172A"
                    backgroundColor="#FFFFFF"
                  />
                </View>
                <Text style={[styles.qrScanHint, { color: colors.secondaryText }]}>
                  Show QR at Campus Main Gate / Security Desk
                </Text>
              </View>

              {/* Student Identity Grid */}
              <View style={[styles.passInfoGrid, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                <View style={styles.passInfoItem}>
                  <Text style={[styles.passLabel, { color: colors.secondaryText }]}>Student Name</Text>
                  <Text style={[styles.passValue, { color: colors.primaryText }]}>{existingLeave.studentName}</Text>
                </View>
                <View style={styles.passInfoItem}>
                  <Text style={[styles.passLabel, { color: colors.secondaryText }]}>Roll Number</Text>
                  <Text style={[styles.passValue, { color: colors.primaryText }]}>{existingLeave.rollNo}</Text>
                </View>
                <View style={styles.passInfoItem}>
                  <Text style={[styles.passLabel, { color: colors.secondaryText }]}>Department</Text>
                  <Text style={[styles.passValue, { color: colors.primaryText }]}>{existingLeave.dept}</Text>
                </View>
                <View style={styles.passInfoItem}>
                  <Text style={[styles.passLabel, { color: colors.secondaryText }]}>Valid Window</Text>
                  <Text style={[styles.passValue, { color: "#10B981" }]}>
                    {formatDate(existingLeave.fromDate)} → {formatDate(existingLeave.toDate)}
                  </Text>
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.gatePassActionsRow}>
                <TouchableOpacity
                  style={[styles.sharePassBtn, { backgroundColor: "#10B981" }]}
                  onPress={handleShareGatePass}
                  activeOpacity={0.8}
                >
                  <Icon name="share-variant" size={18} color="#FFFFFF" />
                  <Text style={styles.sharePassBtnText}>Share Pass</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.donePassBtn, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}
                  onPress={clearActiveLeave}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.donePassBtnText, { color: colors.primaryText }]}>Finish / Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  // ---------------- 4. HISTORY RECORDS VIEW ----------------
  if (mode === "history") {
    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <View style={styles.overlayFull}>
          <View style={[styles.fullHeader, { backgroundColor: colors.primaryAccent }]}>
            <TouchableOpacity
              onPress={() => setMode(existingLeave ? existingLeave.status : "form")}
              style={styles.headerBtn}
            >
              <Icon name="arrow-left" size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.fullHeaderTitle}>Leave & OD History</Text>
            <TouchableOpacity
              onPress={() => {
                clearActiveLeave();
                setMode("form");
              }}
              style={styles.headerBtn}
            >
              <Icon name="plus-circle" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* History Search & Filter Header */}
          <View style={[styles.historyControlBar, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
            <View style={[styles.historySearchBar, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
              <Icon name="magnify" size={18} color={colors.secondaryText} />
              <TextInput
                style={[styles.historySearchInput, { color: colors.primaryText }]}
                placeholder="Search by Pass ID or reason..."
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

            {/* Filter Pills */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {["All", "Approved", "Pending", "Expired", "Rejected"].map((f) => {
                const isSel = historyFilter === f;
                return (
                  <TouchableOpacity
                    key={f}
                    style={[
                      styles.historyFilterPill,
                      isSel
                        ? { backgroundColor: colors.primaryAccent, borderColor: colors.primaryAccent }
                        : { backgroundColor: colors.primaryBackground, borderColor: colors.divider },
                    ]}
                    onPress={() => setHistoryFilter(f)}
                  >
                    <Text style={[styles.historyFilterText, { color: isSel ? "#FFFFFF" : colors.secondaryText }]}>
                      {f}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* History Records List */}
          <View style={styles.historyListContainer}>
            {historyLoading ? (
              <View style={styles.historyLoadingWrap}>
                <ActivityIndicator size="large" color={colors.primaryAccent} />
                <Text style={[styles.historyLoadingText, { color: colors.secondaryText }]}>Loading records...</Text>
              </View>
            ) : filteredHistory.length === 0 ? (
              <View style={styles.historyEmptyWrap}>
                <Icon name="file-document-outline" size={54} color={colors.disabledText} />
                <Text style={[styles.historyEmptyTitle, { color: colors.primaryText }]}>No Leave Records Found</Text>
                <Text style={[styles.historyEmptySub, { color: colors.secondaryText }]}>
                  {historySearch ? "No results match your search query." : "Tap the + button to create a new leave application."}
                </Text>
              </View>
            ) : (
              <FlatList
                data={filteredHistory}
                keyExtractor={(item) => item.id || item._id || item.leaveId}
                contentContainerStyle={{ padding: 16, gap: 10 }}
                renderItem={({ item }) => {
                  const isApp = item.status === "approved";
                  const isRej = item.status === "rejected";
                  const isExp = item.status === "expired";

                  return (
                    <TouchableOpacity
                      style={[
                        styles.historyCard,
                        { backgroundColor: colors.cardBackground, borderColor: colors.divider },
                      ]}
                      activeOpacity={0.8}
                      onPress={() => {
                        setExistingLeave(item);
                        setMode(item.status || "form");
                      }}
                    >
                      <View style={styles.historyCardTop}>
                        <View style={styles.historyIdGroup}>
                          <Text style={[styles.historyLeaveId, { color: colors.primaryAccent }]}>{item.leaveId}</Text>
                          <View
                            style={[
                              styles.historyStatusBadge,
                              isApp
                                ? { backgroundColor: "#10B98118" }
                                : isRej
                                ? { backgroundColor: "#EF444418" }
                                : isExp
                                ? { backgroundColor: "#64748B18" }
                                : { backgroundColor: "#F59E0B18" },
                            ]}
                          >
                            <Text
                              style={[
                                styles.historyStatusText,
                                {
                                  color: isApp
                                    ? "#10B981"
                                    : isRej
                                    ? "#EF4444"
                                    : isExp
                                    ? "#64748B"
                                    : "#D97706",
                                },
                              ]}
                            >
                              {(item.status || "PENDING").toUpperCase()}
                            </Text>
                          </View>
                        </View>
                        <Text style={[styles.historyTypeTag, { color: colors.secondaryText }]}>
                          {item.leaveType || "Leave"}
                        </Text>
                      </View>

                      <Text style={[styles.historyReason, { color: colors.primaryText }]} numberOfLines={2}>
                        {item.reason || "Academic requirement"}
                      </Text>

                      <View style={styles.historyCardBottom}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                          <Icon name="calendar-range" size={13} color={colors.secondaryText} />
                          <Text style={[styles.historyDateRange, { color: colors.secondaryText }]}>
                            {formatDate(item.fromDate)} → {formatDate(item.toDate)}
                          </Text>
                        </View>
                        <Icon name="chevron-right" size={18} color={colors.disabledText} />
                      </View>
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </View>
        </View>
      </Modal>
    );
  }

  // ---------------- 5. MAIN FORM VIEW ----------------
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlayFull}>
        {/* App Header */}
        <View style={[styles.fullHeader, { backgroundColor: colors.primaryAccent }]}>
          <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
            <Icon name="arrow-left" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <View>
            <Text style={styles.fullHeaderTitle}>College Leave Form</Text>
            <Text style={styles.fullHeaderSub}>Official Gate Pass Application</Text>
          </View>
          <TouchableOpacity onPress={() => setMode("history")} style={styles.headerBtn}>
            <Icon name="history" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Animated Form Sheet */}
        <Animated.View
          style={[
            styles.cardFull,
            {
              backgroundColor: colors.cardBackground,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <ScrollView
            contentContainerStyle={styles.formContainer}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* 1. Leave Category Picker */}
            <Text style={[styles.sectionLabel, { color: colors.primaryText }]}>Select Leave Category</Text>
            <View style={styles.categoryGrid}>
              {leaveTypes.map((t) => {
                const isSel = leaveType === t.label;
                return (
                  <TouchableOpacity
                    key={t.label}
                    style={[
                      styles.categoryCard,
                      isSel
                        ? { backgroundColor: colors.primaryAccent + "18", borderColor: colors.primaryAccent }
                        : { backgroundColor: colors.primaryBackground, borderColor: colors.divider },
                    ]}
                    onPress={() => !submitting && setLeaveType(t.label)}
                    activeOpacity={0.8}
                  >
                    <Icon
                      name={t.icon}
                      size={20}
                      color={isSel ? colors.primaryAccent : colors.secondaryText}
                    />
                    <Text
                      style={[
                        styles.categoryTitle,
                        { color: isSel ? colors.primaryAccent : colors.primaryText },
                      ]}
                    >
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* 2. Student Details Box */}
            <Text style={[styles.sectionLabel, { color: colors.primaryText, marginTop: 14 }]}>
              Applicant Information
            </Text>
            <View style={[styles.fieldRowTwoCol]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.inputLabel, { color: colors.secondaryText }]}>Full Name</Text>
                <TextInput
                  style={[
                    styles.inputField,
                    { backgroundColor: colors.primaryBackground, borderColor: colors.divider, color: colors.primaryText },
                  ]}
                  value={studentName}
                  onChangeText={setStudentName}
                  placeholder="Enter full name"
                  placeholderTextColor={colors.disabledText}
                  editable={!submitting}
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={[styles.inputLabel, { color: colors.secondaryText }]}>Roll Number</Text>
                <TextInput
                  style={[
                    styles.inputField,
                    { backgroundColor: colors.primaryBackground, borderColor: colors.divider, color: colors.primaryText },
                  ]}
                  value={rollNo}
                  onChangeText={setRollNo}
                  placeholder="e.g. 25ACSE001"
                  placeholderTextColor={colors.disabledText}
                  editable={!submitting}
                />
              </View>
            </View>

            {/* Department & Year Pills */}
            <View style={{ marginTop: 10 }}>
              <Text style={[styles.inputLabel, { color: colors.secondaryText }]}>Department</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 4 }}>
                {deptList.map((d) => {
                  const isSel = dept === d;
                  return (
                    <TouchableOpacity
                      key={d}
                      style={[
                        styles.miniPill,
                        isSel
                          ? { backgroundColor: colors.primaryAccent, borderColor: colors.primaryAccent }
                          : { backgroundColor: colors.primaryBackground, borderColor: colors.divider },
                      ]}
                      onPress={() => setDept(d)}
                    >
                      <Text style={[styles.miniPillText, { color: isSel ? "#FFFFFF" : colors.primaryText }]}>
                        {d}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            <View style={{ marginTop: 10 }}>
              <Text style={[styles.inputLabel, { color: colors.secondaryText }]}>Academic Year</Text>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
                {yearList.map((y) => {
                  const isSel = year === y;
                  return (
                    <TouchableOpacity
                      key={y}
                      style={[
                        styles.yearPill,
                        isSel
                          ? { backgroundColor: colors.primaryAccent, borderColor: colors.primaryAccent }
                          : { backgroundColor: colors.primaryBackground, borderColor: colors.divider },
                      ]}
                      onPress={() => setYear(y)}
                    >
                      <Text style={[styles.miniPillText, { color: isSel ? "#FFFFFF" : colors.primaryText }]}>
                        {y}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* 3. Leave Dates & Duration */}
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
            <View style={[styles.durationCounterBadge, { backgroundColor: colors.primaryAccent + "14", borderColor: colors.primaryAccent + "33" }]}>
              <Icon name="clock-check-outline" size={16} color={colors.primaryAccent} />
              <Text style={[styles.durationCounterText, { color: colors.primaryAccent }]}>
                Total Duration: {calculateDays(fromDate, toDate)} Day(s) Requested
              </Text>
            </View>

            {/* Session Type */}
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

            {/* DateTimePickers */}
            {showFromPicker && (
              <DateTimePicker
                value={toJsDate(fromDate)}
                mode="date"
                onChange={(e, d) => {
                  setShowFromPicker(false);
                  if (d) setFromDate(d);
                }}
              />
            )}
            {showToPicker && (
              <DateTimePicker
                value={toJsDate(toDate)}
                mode="date"
                onChange={(e, d) => {
                  setShowToPicker(false);
                  if (d) setToDate(d);
                }}
              />
            )}

            {/* 4. Reason Text Area */}
            <Text style={[styles.sectionLabel, { color: colors.primaryText, marginTop: 16 }]}>
              Reason for Absence
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
              placeholder="State genuine reason for leave / OD details with event name..."
              placeholderTextColor={colors.disabledText}
              editable={!submitting}
            />

            {/* 5. Emergency Contact */}
            <Text style={[styles.inputLabel, { color: colors.secondaryText, marginTop: 12 }]}>
              Parent / Guardian Emergency Contact
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

            {/* 6. Form Action Buttons */}
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
                    <Icon name="send-check-outline" size={18} color="#FFFFFF" />
                    <Text style={styles.submitFormBtnText}>Submit Leave Application</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            <View style={{ height: 30 }} />
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ---------------- Styles ----------------
const getStyles = (colors, isDarkMode) =>
  StyleSheet.create({
    overlayFull: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.8)",
    },
    centerOverlay: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "rgba(0,0,0,0.6)",
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
      color: "rgba(255,255,255,0.8)",
      fontSize: 11.5,
      fontWeight: "500",
    },

    /* Card Bottom Sheet */
    cardFull: {
      flex: 1,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      elevation: 20,
    },
    formContainer: {
      padding: 18,
      paddingBottom: 40,
    },
    sectionLabel: {
      fontSize: 14,
      fontWeight: "800",
      marginBottom: 8,
    },
    inputLabel: {
      fontSize: 11.5,
      fontWeight: "700",
      marginBottom: 4,
    },

    /* Category Grid */
    categoryGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    categoryCard: {
      width: "48.5%",
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: 1,
    },
    categoryTitle: {
      fontSize: 12,
      fontWeight: "800",
    },

    /* Inputs */
    fieldRowTwoCol: {
      flexDirection: "row",
      gap: 10,
    },
    inputField: {
      borderWidth: 1,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 9,
      fontSize: 13,
      fontWeight: "600",
    },
    miniPill: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      borderWidth: 1,
    },
    yearPill: {
      flex: 1,
      alignItems: "center",
      paddingVertical: 7,
      borderRadius: 10,
      borderWidth: 1,
    },
    sessionTimingPill: {
      flex: 1,
      alignItems: "center",
      paddingVertical: 7,
      borderRadius: 10,
      borderWidth: 1,
    },
    miniPillText: {
      fontSize: 11.5,
      fontWeight: "700",
    },

    /* Date Pickers */
    datePickerRow: {
      flexDirection: "row",
      gap: 10,
    },
    dateSelectBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      borderWidth: 1,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    dateSelectText: {
      fontSize: 12,
      fontWeight: "700",
    },
    durationCounterBadge: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 8,
      borderRadius: 10,
      borderWidth: 1,
      marginTop: 10,
    },
    durationCounterText: {
      fontSize: 12,
      fontWeight: "800",
    },
    textAreaField: {
      borderWidth: 1,
      borderRadius: 12,
      padding: 12,
      fontSize: 13,
      fontWeight: "500",
      height: 80,
      textAlignVertical: "top",
    },
    formActionRow: {
      marginTop: 20,
    },
    submitFormBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 14,
      borderRadius: 14,
      elevation: 3,
    },
    submitFormBtnText: {
      color: "#FFFFFF",
      fontSize: 14,
      fontWeight: "800",
    },

    /* Center Modal Wrap (Pending / Approved / Rejected) */
    centerModalWrap: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 18,
    },
    statusCard: {
      width: "100%",
      borderRadius: 22,
      borderWidth: 1,
      padding: 20,
      alignItems: "center",
      elevation: 10,
    },
    statusIconWrap: {
      width: 80,
      height: 80,
      borderRadius: 40,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 12,
    },
    statusCardTitle: {
      fontSize: 18,
      fontWeight: "900",
      letterSpacing: -0.3,
    },
    statusCardSub: {
      fontSize: 12,
      fontWeight: "500",
      textAlign: "center",
      marginTop: 4,
      marginBottom: 16,
    },

    /* Stepper */
    stepperContainer: {
      width: "100%",
      marginBottom: 14,
      paddingHorizontal: 8,
    },
    stepItem: {
      flexDirection: "row",
      alignItems: "flex-start",
    },
    stepLeftCol: {
      alignItems: "center",
      width: 24,
      marginRight: 10,
    },
    stepNode: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      justifyContent: "center",
      alignItems: "center",
    },
    stepConnector: {
      width: 2,
      height: 32,
      marginVertical: 2,
    },
    stepContent: {
      flex: 1,
      paddingBottom: 14,
    },
    stepTitleRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    stepTitle: {
      fontSize: 13,
      fontWeight: "800",
    },
    stepBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    stepBadgeText: {
      fontSize: 9.5,
      fontWeight: "900",
    },
    stepSub: {
      fontSize: 11,
      fontWeight: "500",
      marginTop: 2,
    },

    /* Info Summary Box */
    infoSummaryBox: {
      width: "100%",
      borderRadius: 14,
      borderWidth: 1,
      padding: 12,
      gap: 6,
      marginBottom: 16,
    },
    summaryRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    summaryLabel: {
      fontSize: 11.5,
      fontWeight: "600",
    },
    summaryVal: {
      fontSize: 12,
      fontWeight: "800",
    },
    primaryActionBtn: {
      width: "100%",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 12,
      borderRadius: 12,
    },
    primaryActionBtnText: {
      color: "#FFFFFF",
      fontSize: 13,
      fontWeight: "800",
    },
    secondaryActionBtn: {
      width: "100%",
      alignItems: "center",
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
    },
    secondaryActionText: {
      fontSize: 12,
      fontWeight: "700",
    },

    /* Digital Gate Pass Card */
    gatePassCard: {
      width: "100%",
      borderRadius: 22,
      borderWidth: 1.5,
      padding: 20,
      alignItems: "center",
      elevation: 12,
    },
    gatePassHeader: {
      width: "100%",
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 14,
    },
    verifiedPassPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      backgroundColor: "#10B98118",
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
    },
    verifiedPassPillText: {
      color: "#10B981",
      fontSize: 10,
      fontWeight: "900",
    },
    gatePassIdText: {
      fontSize: 12,
      fontWeight: "800",
    },
    qrContainer: {
      alignItems: "center",
      marginBottom: 14,
    },
    qrFrame: {
      padding: 10,
      borderRadius: 16,
      borderWidth: 2,
      backgroundColor: "#FFFFFF",
    },
    qrScanHint: {
      fontSize: 11,
      fontWeight: "600",
      marginTop: 8,
    },
    passInfoGrid: {
      width: "100%",
      borderRadius: 14,
      borderWidth: 1,
      padding: 12,
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      gap: 8,
      marginBottom: 16,
    },
    passInfoItem: {
      width: "48%",
    },
    passLabel: {
      fontSize: 10.5,
      fontWeight: "600",
    },
    passValue: {
      fontSize: 12,
      fontWeight: "800",
      marginTop: 2,
    },
    gatePassActionsRow: {
      width: "100%",
      flexDirection: "row",
      gap: 10,
    },
    sharePassBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 12,
      borderRadius: 12,
    },
    sharePassBtnText: {
      color: "#FFFFFF",
      fontSize: 13,
      fontWeight: "800",
    },
    donePassBtn: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
    },
    donePassBtnText: {
      fontSize: 13,
      fontWeight: "800",
    },

    /* History View */
    historyControlBar: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderBottomWidth: 1,
      gap: 8,
    },
    historySearchBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      borderWidth: 1,
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    historySearchInput: {
      flex: 1,
      fontSize: 12.5,
      fontWeight: "600",
      padding: 0,
    },
    historyFilterPill: {
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 14,
      borderWidth: 1,
    },
    historyFilterText: {
      fontSize: 11.5,
      fontWeight: "700",
    },
    historyListContainer: {
      flex: 1,
    },
    historyLoadingWrap: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingTop: 60,
    },
    historyLoadingText: {
      fontSize: 12,
      fontWeight: "600",
      marginTop: 8,
    },
    historyEmptyWrap: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingTop: 60,
      paddingHorizontal: 20,
    },
    historyEmptyTitle: {
      fontSize: 16,
      fontWeight: "800",
      marginTop: 8,
    },
    historyEmptySub: {
      fontSize: 12,
      textAlign: "center",
      marginTop: 4,
    },
    historyCard: {
      borderRadius: 16,
      borderWidth: 1,
      padding: 14,
      elevation: 2,
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
      fontSize: 13,
      fontWeight: "800",
    },
    historyStatusBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    historyStatusText: {
      fontSize: 9.5,
      fontWeight: "900",
    },
    historyTypeTag: {
      fontSize: 11,
      fontWeight: "700",
    },
    historyReason: {
      fontSize: 13,
      fontWeight: "600",
      marginBottom: 8,
    },
    historyCardBottom: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      borderTopWidth: 1,
      borderTopColor: "rgba(150,150,150,0.1)",
      paddingTop: 8,
    },
    historyDateRange: {
      fontSize: 11.5,
      fontWeight: "500",
    },
  });

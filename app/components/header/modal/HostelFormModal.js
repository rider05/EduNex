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
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import DateTimePicker from "@react-native-community/datetimepicker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import QRCode from "react-native-qrcode-svg";
import { useTheme } from "../../../context/ThemeContext";
import { api } from "../../../services/api";
import { resolveIdentity } from "../../../services/identityService";
import { getStudentData } from "../../../services/dataService";
import { showToast } from "../../../utils/toastService";
import { shareLeaveGatePassPdf } from "../../../utils/pdfGenerator";

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

const calculateDurationText = (from, to, type, outTime, inTime) => {
  const start = toJsDate(from);
  const end = toJsDate(to);
  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.ceil(Math.abs(diffTime) / (1000 * 60 * 60 * 24)) + 1;

  if (type === "Local Day Outing" || diffDays <= 1) {
    return `Single Day Outing · ${outTime || "06:00 AM"} to ${inTime || "08:30 PM"}`;
  }
  return `${diffDays} Day(s) Leave · In-Time: ${inTime || "08:30 PM"}`;
};

const BLOCK_OPTIONS = [
  { id: "Block A", label: "Block A", sub: "Boys / Main Residency", icon: "home-city" },
  { id: "Block B", label: "Block B", sub: "Girls / Annex Residency", icon: "home-heart" },
];

const OUT_TIME_PRESETS = ["06:00 AM", "07:30 AM", "02:00 PM", "05:00 PM"];
const IN_TIME_PRESETS = ["06:30 PM", "08:30 PM", "09:30 PM", "10:00 PM"];

// ---------------- Component ----------------
export default function HostelFormModal({ visible, onClose }) {
  const { colors, isDarkMode } = useTheme();
  const slideAnim = useRef(new Animated.Value(350)).current;

  // UI mode: 'form' | 'pending' | 'approved' | 'rejected' | 'history'
  const [mode, setMode] = useState("form");

  // Form Fields fetched from DB
  const [studentName, setStudentName] = useState("");
  const [rollNo, setRollNo] = useState("");
  const [hostelBlock, setHostelBlock] = useState("Block A");
  const [roomNumber, setRoomNumber] = useState("");
  const [dept, setDept] = useState("");
  const [year, setYear] = useState("");
  const [leaveType, setLeaveType] = useState("Weekend Home Visit");
  const [destinationCity, setDestinationCity] = useState("");
  const [reason, setReason] = useState("");
  const [parentContact, setParentContact] = useState("");

  // In / Out Timing and Dates
  const [fromDate, setFromDate] = useState(new Date());
  const [toDate, setToDate] = useState(new Date());
  const [outTime, setOutTime] = useState("06:00 AM");
  const [inTime, setInTime] = useState("08:30 PM");

  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);

  // Active Leave
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

  const HOSTEL_TYPE_THEMES = {
    "Weekend Home Visit": { label: "Weekend Home Visit", color: "#3B82F6", bgLight: "#3B82F618", icon: "home-city-outline" },
    "Local Day Outing": { label: "Local Day Outing", color: "#10B981", bgLight: "#10B98118", icon: "shopping-outline" },
    "Night Outing": { label: "Night Outing", color: "#8B5CF6", bgLight: "#8B5CF618", icon: "weather-night" },
    "Medical / Clinic": { label: "Medical / Clinic", color: "#EF4444", bgLight: "#EF444418", icon: "hospital-building" },
    "Emergency Outing": { label: "Emergency Outing", color: "#F59E0B", bgLight: "#F59E0B18", icon: "alert-decagram-outline" },
  };

  const hostelLeaveTypes = [
    { label: "Weekend Home Visit", icon: "home-city-outline", desc: "Home visit for holiday" },
    { label: "Local Day Outing", icon: "shopping-outline", desc: "Return before curfew" },
    { label: "Night Outing", icon: "weather-night", desc: "Overnight permitted stay" },
    { label: "Medical / Clinic", icon: "hospital-building", desc: "Emergency medical visit" },
    { label: "Emergency Outing", icon: "alert-decagram-outline", desc: "Immediate departure" },
  ];

  // Fetch DB data on visible
  useEffect(() => {
    if (visible) {
      (async () => {
        try {
          const [identity, student] = await Promise.all([
            resolveIdentity().catch(() => null),
            getStudentData().catch(() => null),
          ]);

          const name = student?.name || identity?.name || "Karthik Raja M";
          const roll = student?.rollNo || student?.id || identity?.rollNo || identity?.username || "25ACSE001";
          const rawBlock = student?.hostelBlock || student?.hostelDetails?.block || identity?.hostelBlock || "Block A";
          const block = rawBlock.includes("B") ? "Block B" : "Block A";
          const room = student?.roomNo || student?.roomNumber || student?.hostelDetails?.roomNo || identity?.roomNumber || "A-204";
          const department = student?.dept || student?.department || identity?.dept || "CSE";
          const yr = student?.year || identity?.year || "III Year";
          const contact = student?.parent?.phone || student?.emergencyContact || identity?.phone || "+91 98000 10003";
          const defOut = student?.hostelDetails?.defaultOutTime || "06:00 AM";
          const defIn = student?.hostelDetails?.defaultInTime || student?.hostelDetails?.curfewTime || "08:30 PM";

          setStudentName(name);
          setRollNo(roll);
          setHostelBlock(block);
          setRoomNumber(room);
          setDept(department);
          setYear(yr);
          setParentContact(contact);
          setOutTime(defOut);
          setInTime(defIn);
        } catch (_e) {
          console.log("HostelFormModal identity load error:", _e);
        }
      })();

      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 250,
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
      const id = await AsyncStorage.getItem("activeHostelLeaveId");
      if (!id) {
        setExistingLeave(null);
        setLoadingStatus(false);
        setMode("form");
        return;
      }

      const res = await api.get(`/leaves/${id}`);
      const data = res?.data;

      if (!data) {
        await AsyncStorage.removeItem("activeHostelLeaveId");
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
        await AsyncStorage.removeItem("activeHostelLeaveId");
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
          await AsyncStorage.removeItem("activeHostelLeaveId");
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

  // Load History
  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await api.get("/leaves", { type: "hostel", sort: "-createdAt", limit: 100 });
      const arr = Array.isArray(res?.data) ? res.data : [];
      setHistoryRecords(arr);
    } catch (e) {
      console.log("loadHistory err:", e?.message || e);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Periodic Expire Check
  const checkAndExpireLeaves = async () => {
    try {
      const res = await api.get("/leaves", { type: "hostel", limit: 100 });
      const docs = Array.isArray(res?.data) ? res.data : [];

      for (const d of docs) {
        if (!d || d.status === "expired") continue;
        if (d.toDate && isDateExpired(d.toDate)) {
          try {
            await api.patch(`/leaves/${d.id || d._id}`, {
              status: "expired",
              expiredAt: new Date().toISOString(),
            });
            const activeId = await AsyncStorage.getItem("activeHostelLeaveId");
            if (activeId === (d.id || d._id)) {
              await AsyncStorage.removeItem("activeHostelLeaveId");
              if (existingLeave && (existingLeave.id === d.id || existingLeave._id === d._id)) {
                setExistingLeave((prev) => ({
                  ...(prev || {}),
                  status: "expired",
                }));
                setMode("history");
                showToast("Hostel pass has expired", "info");
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

  // Submit Hostel Leave
  const handleSubmit = async () => {
    if (!studentName.trim() || !hostelBlock || !roomNumber.trim() || !reason.trim()) {
      Alert.alert("Required Fields", "Please provide your hostel block, room number, and reason.");
      return;
    }

    setSubmitting(true);
    try {
      const leaveId = `HL-${Math.floor(100000 + Math.random() * 900000)}`;
      let savedDocId = leaveId;

      const payload = {
        leaveId,
        type: "hostel",
        studentName: studentName.trim(),
        rollNo: rollNo.trim(),
        hostelBlock,
        roomNumber: roomNumber.trim(),
        dept,
        year,
        leaveType,
        destinationCity: destinationCity.trim() || "Local Outing",
        reason: reason.trim(),
        parentContact: parentContact.trim(),
        outDate: formatDate(fromDate),
        inDate: formatDate(toDate),
        outTime,
        inTime,
        fromDate: toJsDate(fromDate).toISOString(),
        toDate: toJsDate(toDate).toISOString(),
        durationText: calculateDurationText(fromDate, toDate, leaveType, outTime, inTime),
        status: "pending",
        statusTrack: { residentTutor: "pending", warden: "pending" },
        createdAt: new Date().toISOString(),
      };

      try {
        const apiRes = await api.post("/leaves", payload);
        if (apiRes?.data?.id || apiRes?.data?._id) {
          savedDocId = apiRes.data.id || apiRes.data._id;
        }
      } catch (apiErr) {
        console.log("REST hostel leave submit fallback:", apiErr);
      }

      await AsyncStorage.setItem("activeHostelLeaveId", savedDocId);

      setExistingLeave({
        id: savedDocId,
        ...payload,
        fromDate: toJsDate(fromDate),
        toDate: toJsDate(toDate),
      });

      setMode("pending");
      showToast("🏠 Hostel leave request submitted for Warden review!", "success");
      setReason("");
    } catch (e) {
      console.log("submit err:", e);
      Alert.alert("Error", e.message || "Failed to submit hostel leave");
    } finally {
      setSubmitting(false);
    }
  };

  const clearActiveLeave = async () => {
    try {
      await AsyncStorage.removeItem("activeHostelLeaveId");
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
      await shareLeaveGatePassPdf({
        leave: {
          id: existingLeave.leaveId,
          leaveType: `Hostel Outing (${existingLeave.leaveType || "Outing"})`,
          startDate: formatDate(existingLeave.fromDate),
          endDate: formatDate(existingLeave.toDate),
          days: `${existingLeave.days || 1} Day(s)`,
          reason: `Room ${existingLeave.roomNumber || "—"}, ${existingLeave.hostelBlock || "Hostel Block"}. Out: ${existingLeave.outTime || "06:00 AM"}, In: ${existingLeave.inTime || "08:30 PM"}`,
          status: "APPROVED",
          approvedBy: "Chief Warden / Resident Advisor",
        },
        student: {
          name: existingLeave.studentName || "Resident Student",
          rollNo: existingLeave.rollNo || "—",
          department: "Artificial Intelligence & Data Science",
          year: "III Year",
        },
      });
      showToast("Official Hostel Pass PDF generated!", "success");
    } catch (err) {
      console.log("Share error:", err);
      showToast("Could not generate Hostel Pass PDF", "error");
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
            <Text style={styles.fullHeaderTitle}>Hostel Pass Status</Text>
            <TouchableOpacity onPress={() => setMode("history")} style={styles.headerBtn}>
              <Icon name="history" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.centerModalWrap}>
            <View style={[styles.statusCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
              <View style={[styles.statusIconWrap, { backgroundColor: "#EF444418" }]}>
                <Icon name="close-circle-outline" size={54} color="#EF4444" />
              </View>

              <Text style={[styles.statusCardTitle, { color: colors.primaryText }]}>Outing Request Rejected</Text>
              <Text style={[styles.statusCardSub, { color: colors.secondaryText }]}>
                Your hostel leave request was declined by the Chief Warden.
              </Text>

              <View style={[styles.infoSummaryBox, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: colors.secondaryText }]}>Hostel Room</Text>
                  <Text style={[styles.summaryVal, { color: colors.primaryText }]}>
                    {existingLeave.hostelBlock} ({existingLeave.roomNumber})
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: colors.secondaryText }]}>Reference ID</Text>
                  <Text style={[styles.summaryVal, { color: "#EF4444" }]}>{existingLeave.leaveId}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: colors.secondaryText }]}>Requested Window</Text>
                  <Text style={[styles.summaryVal, { color: colors.primaryText }]}>
                    {formatDate(existingLeave.fromDate)} ({existingLeave.outTime || "06:00 AM"}) → {formatDate(existingLeave.toDate)} ({existingLeave.inTime || "08:30 PM"})
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.primaryActionBtn, { backgroundColor: colors.primaryAccent }]}
                onPress={clearActiveLeave}
                activeOpacity={0.8}
              >
                <Icon name="plus-circle-outline" size={18} color="#FFFFFF" />
                <Text style={styles.primaryActionBtnText}>Apply New Hostel Pass</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  // ---------------- 2. PENDING VIEW (WARDEN REVIEW STEPPER) ----------------
  if (existingLeave && mode === "pending") {
    const approvalTiers = [
      { id: "applied", title: "1. Outing Requested", sub: "Submitted by Student", status: "cleared" },
      { id: "tutor", title: "2. Resident Tutor Review", sub: "Verification of Out/In Timings", status: "pending" },
      { id: "warden", title: "3. Chief Warden Approval", sub: "Gate pass issuance", status: "pending" },
    ];

    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <View style={styles.overlayFull}>
          <View style={[styles.fullHeader, { backgroundColor: "#F59E0B" }]}>
            <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
              <Icon name="arrow-left" size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <View>
              <Text style={styles.fullHeaderTitle}>Awaiting Warden Approval</Text>
              <Text style={styles.fullHeaderSub}>Hostel Gate Clearance #{existingLeave.leaveId}</Text>
            </View>
            <TouchableOpacity onPress={() => setMode("history")} style={styles.headerBtn}>
              <Icon name="history" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.centerModalWrap}>
            <View style={[styles.statusCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
              {/* Stepper */}
              <View style={styles.stepperContainer}>
                {approvalTiers.map((tier, idx) => {
                  const isDone = tier.status === "cleared";
                  return (
                    <View key={tier.id} style={styles.stepRow}>
                      <View style={styles.stepIndicatorCol}>
                        <View
                          style={[
                            styles.stepNode,
                            isDone
                              ? { backgroundColor: "#10B981", borderColor: "#10B981" }
                              : { backgroundColor: colors.primaryBackground, borderColor: "#F59E0B" },
                          ]}
                        >
                          <Icon name={isDone ? "check" : "clock-outline"} size={14} color={isDone ? "#FFFFFF" : "#F59E0B"} />
                        </View>
                        {idx < approvalTiers.length - 1 && (
                          <View style={[styles.stepConnector, { backgroundColor: colors.divider }]} />
                        )}
                      </View>

                      <View style={styles.stepContent}>
                        <View style={styles.stepTitleRow}>
                          <Text style={[styles.stepTitle, { color: colors.primaryText }]}>{tier.title}</Text>
                          <View
                            style={[
                              styles.stepBadge,
                              isDone ? { backgroundColor: "#10B98118" } : { backgroundColor: "#F59E0B18" },
                            ]}
                          >
                            <Text style={[styles.stepBadgeText, { color: isDone ? "#10B981" : "#D97706" }]}>
                              {isDone ? "CLEARED" : "AWAITING"}
                            </Text>
                          </View>
                        </View>
                        <Text style={[styles.stepSub, { color: colors.secondaryText }]}>{tier.sub}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>

              {/* Outing Summary */}
              <View style={[styles.infoSummaryBox, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: colors.secondaryText }]}>Hostel Room</Text>
                  <Text style={[styles.summaryVal, { color: colors.primaryText }]}>
                    {existingLeave.hostelBlock} ({existingLeave.roomNumber})
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: colors.secondaryText }]}>Departure (Out)</Text>
                  <Text style={[styles.summaryVal, { color: colors.primaryText }]}>
                    {formatDate(existingLeave.fromDate)} @ {existingLeave.outTime || "06:00 AM"}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: colors.secondaryText }]}>Return Curfew (In)</Text>
                  <Text style={[styles.summaryVal, { color: "#10B981" }]}>
                    {formatDate(existingLeave.toDate)} @ {existingLeave.inTime || "08:30 PM"}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.secondaryActionBtn, { borderColor: colors.divider }]}
                onPress={clearActiveLeave}
                activeOpacity={0.8}
              >
                <Text style={[styles.secondaryActionText, { color: colors.secondaryText }]}>Cancel / Re-apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  // ---------------- 3. APPROVED VIEW (HOSTEL DIGITAL GATE PASS) ----------------
  if (existingLeave && mode === "approved") {
    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <View style={styles.overlayFull}>
          <View style={[styles.fullHeader, { backgroundColor: "#10B981" }]}>
            <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
              <Icon name="arrow-left" size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.fullHeaderTitle}>Hostel Residence Gate Pass</Text>
            <TouchableOpacity onPress={() => setMode("history")} style={styles.headerBtn}>
              <Icon name="history" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.centerModalWrap}>
            <View style={[styles.gatePassCard, { backgroundColor: colors.cardBackground, borderColor: "#10B98155" }]}>
              {/* Pass Header */}
              <View style={styles.gatePassHeader}>
                <View style={styles.verifiedPassPill}>
                  <Icon name="shield-home" size={16} color="#10B981" />
                  <Text style={styles.verifiedPassPillText}>WARDEN AUTHORIZED</Text>
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
                      block: existingLeave.hostelBlock,
                      room: existingLeave.roomNumber,
                      outSchedule: `${formatDate(existingLeave.fromDate)} @ ${existingLeave.outTime || "06:00 AM"}`,
                      inSchedule: `${formatDate(existingLeave.toDate)} @ ${existingLeave.inTime || "08:30 PM"}`,
                      type: existingLeave.leaveType,
                      status: "VERIFIED_HOSTEL_OUTING",
                    })}
                    size={160}
                    color="#0F172A"
                    backgroundColor="#FFFFFF"
                  />
                </View>
                <Text style={[styles.qrScanHint, { color: colors.secondaryText }]}>
                  Scan QR at Hostel Gate Security Checkpoint
                </Text>
              </View>

              {/* Student Identity Grid */}
              <View style={[styles.passInfoGrid, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                <View style={styles.passInfoItem}>
                  <Text style={[styles.passLabel, { color: colors.secondaryText }]}>Resident</Text>
                  <Text style={[styles.passValue, { color: colors.primaryText }]}>{existingLeave.studentName}</Text>
                </View>
                <View style={styles.passInfoItem}>
                  <Text style={[styles.passLabel, { color: colors.secondaryText }]}>Room No</Text>
                  <Text style={[styles.passValue, { color: colors.primaryText }]}>{existingLeave.roomNumber}</Text>
                </View>
                <View style={styles.passInfoItem}>
                  <Text style={[styles.passLabel, { color: colors.secondaryText }]}>Hostel Block</Text>
                  <Text style={[styles.passValue, { color: colors.primaryText }]} numberOfLines={1}>
                    {existingLeave.hostelBlock}
                  </Text>
                </View>
                <View style={styles.passInfoItem}>
                  <Text style={[styles.passLabel, { color: colors.secondaryText }]}>Curfew In-Time</Text>
                  <Text style={[styles.passValue, { color: "#10B981" }]}>
                    {formatDate(existingLeave.toDate)} @ {existingLeave.inTime || "08:30 PM"}
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
            <Text style={styles.fullHeaderTitle}>Hostel Pass History</Text>
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

          {/* Control Bar */}
          <View style={[styles.historyControlBar, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
            <View style={[styles.historySearchBar, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
              <Icon name="magnify" size={18} color={colors.secondaryText} />
              <TextInput
                style={[styles.historySearchInput, { color: colors.primaryText }]}
                placeholder="Search hostel pass ID or destination..."
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

          {/* History List */}
          <View style={styles.historyListContainer}>
            {historyLoading ? (
              <View style={styles.historyLoadingWrap}>
                <ActivityIndicator size="large" color={colors.primaryAccent} />
              </View>
            ) : filteredHistory.length === 0 ? (
              <View style={styles.historyEmptyWrap}>
                <Icon name="folder-open-outline" size={48} color={colors.disabledText} />
                <Text style={[styles.historyEmptyText, { color: colors.secondaryText }]}>
                  No hostel passes found
                </Text>
              </View>
            ) : (
              <FlatList
                data={filteredHistory}
                keyExtractor={(item) => item.id || item._id || item.leaveId}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 60 }}
                renderItem={({ item }) => {
                  const isApp = item.status === "approved";
                  const isPend = item.status === "pending";
                  const isRej = item.status === "rejected";

                  return (
                    <View style={[styles.historyItemCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
                      <View style={styles.historyItemTop}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.historyItemId, { color: colors.primaryText }]}>
                            {item.leaveId} · {item.leaveType}
                          </Text>
                          <Text style={[styles.historyItemSub, { color: colors.secondaryText }]}>
                            Room {item.roomNumber} ({item.hostelBlock})
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.historyStatusBadge,
                            isApp
                              ? { backgroundColor: "#10B98118" }
                              : isPend
                              ? { backgroundColor: "#F59E0B18" }
                              : isRej
                              ? { backgroundColor: "#EF444418" }
                              : { backgroundColor: "#64748B18" },
                          ]}
                        >
                          <Text
                            style={[
                              styles.historyStatusText,
                              {
                                color: isApp
                                  ? "#10B981"
                                  : isPend
                                  ? "#D97706"
                                  : isRej
                                  ? "#EF4444"
                                  : "#64748B",
                              },
                            ]}
                          >
                            {(item.status || "PENDING").toUpperCase()}
                          </Text>
                        </View>
                      </View>

                      <View style={[styles.historyItemDates, { borderTopColor: colors.divider }]}>
                        <Icon name="calendar-clock" size={14} color={colors.secondaryText} />
                        <Text style={[styles.historyDatesText, { color: colors.secondaryText }]}>
                          Out: {formatDate(item.fromDate)} ({item.outTime || "06:00 AM"}) → In: {formatDate(item.toDate)} ({item.inTime || "08:30 PM"})
                        </Text>
                      </View>
                    </View>
                  );
                }}
              />
            )}
          </View>
        </View>
      </Modal>
    );
  }

  // ---------------- 5. NEW HOSTEL PASS APPLICATION FORM ----------------
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.overlayFull}>
        {/* App Header */}
        <View style={[styles.fullHeader, { backgroundColor: colors.primaryAccent }]}>
          <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
            <Icon name="arrow-left" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <View>
            <Text style={styles.fullHeaderTitle}>Hostel Outing & Leave</Text>
            <Text style={styles.fullHeaderSub}>Campus Residence Gate Pass</Text>
          </View>
          <TouchableOpacity onPress={() => setMode("history")} style={styles.headerBtn}>
            <Icon name="history" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Animated Form Sheet (Even Borders) */}
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
            {/* 1. Outing Category Selector */}
            <Text style={[styles.sectionLabel, { color: colors.primaryText }]}>Select Outing Category</Text>
            <View style={styles.categoryGrid}>
              {hostelLeaveTypes.map((t) => {
                const isSel = leaveType === t.label;
                const theme = HOSTEL_TYPE_THEMES[t.label] || { color: colors.primaryAccent, bgLight: colors.primaryAccent + "18" };

                return (
                  <TouchableOpacity
                    key={t.label}
                    style={[
                      styles.categoryCard,
                      isSel
                        ? { backgroundColor: theme.bgLight, borderColor: theme.color, borderWidth: 1.8 }
                        : { backgroundColor: colors.primaryBackground, borderColor: colors.divider, borderWidth: 1 },
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
                          fontWeight: isSel ? "900" : "600",
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* 2. Hostel Accommodation (Block A or B, Room No) */}
            <Text style={[styles.sectionLabel, { color: colors.primaryText, marginTop: 14 }]}>
              Hostel Accommodation (Fetched from DB)
            </Text>

            <View style={{ marginTop: 4 }}>
              <Text style={[styles.inputLabel, { color: colors.secondaryText }]}>Hostel Block</Text>
              <View style={styles.blockRow}>
                {BLOCK_OPTIONS.map((b) => {
                  const isSel = hostelBlock === b.id;
                  return (
                    <TouchableOpacity
                      key={b.id}
                      style={[
                        styles.blockOptionCard,
                        isSel
                          ? { backgroundColor: colors.primaryAccent + "18", borderColor: colors.primaryAccent, borderWidth: 1.8 }
                          : { backgroundColor: colors.primaryBackground, borderColor: colors.divider, borderWidth: 1 },
                      ]}
                      onPress={() => setHostelBlock(b.id)}
                      activeOpacity={0.8}
                    >
                      <Icon name={b.icon} size={20} color={isSel ? colors.primaryAccent : colors.secondaryText} />
                      <View style={{ flex: 1, marginLeft: 8 }}>
                        <Text style={[styles.blockOptionTitle, { color: isSel ? colors.primaryAccent : colors.primaryText, fontWeight: isSel ? "800" : "600" }]}>
                          {b.label}
                        </Text>
                        <Text style={[styles.blockOptionSub, { color: colors.secondaryText }]}>{b.sub}</Text>
                      </View>
                      {isSel && <Icon name="check-circle" size={16} color={colors.primaryAccent} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={[styles.fieldRowTwoCol, { marginTop: 10 }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.inputLabel, { color: colors.secondaryText }]}>Room Number (DB)</Text>
                <TextInput
                  style={[
                    styles.inputField,
                    { backgroundColor: colors.primaryBackground, borderColor: colors.divider, color: colors.primaryText },
                  ]}
                  value={roomNumber}
                  onChangeText={setRoomNumber}
                  placeholder="e.g. A-204"
                  placeholderTextColor={colors.disabledText}
                  editable={!submitting}
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={[styles.inputLabel, { color: colors.secondaryText }]}>Destination City</Text>
                <TextInput
                  style={[
                    styles.inputField,
                    { backgroundColor: colors.primaryBackground, borderColor: colors.divider, color: colors.primaryText },
                  ]}
                  value={destinationCity}
                  onChangeText={setDestinationCity}
                  placeholder="e.g. Coimbatore / Home"
                  placeholderTextColor={colors.disabledText}
                  editable={!submitting}
                />
              </View>
            </View>

            {/* 3. Applicant Info */}
            <Text style={[styles.sectionLabel, { color: colors.primaryText, marginTop: 14 }]}>
              Resident Details
            </Text>
            <View style={styles.fieldRowTwoCol}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.inputLabel, { color: colors.secondaryText }]}>Resident Name</Text>
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

            {/* 4. Departure & Return Schedule (In/Out Time & Dates) */}
            <Text style={[styles.sectionLabel, { color: colors.primaryText, marginTop: 16 }]}>
              Departure & Return Schedule (In/Out Time & Dates)
            </Text>

            {/* Out Schedule */}
            <View style={[styles.scheduleCard, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
              <View style={styles.scheduleHeaderRow}>
                <Icon name="clock-out" size={16} color="#3B82F6" />
                <Text style={[styles.scheduleHeaderTitle, { color: "#3B82F6" }]}>DEPARTURE (OUT SCHEDULE)</Text>
              </View>

              <View style={styles.datePickerRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabel, { color: colors.secondaryText }]}>Out Date</Text>
                  <TouchableOpacity
                    style={[
                      styles.dateSelectBtn,
                      { backgroundColor: colors.cardBackground, borderColor: colors.divider },
                    ]}
                    onPress={() => !submitting && setShowFromPicker(true)}
                    activeOpacity={0.8}
                  >
                    <Icon name="calendar" size={16} color={colors.primaryAccent} />
                    <Text style={[styles.dateSelectText, { color: colors.primaryText }]}>
                      {formatDate(fromDate)}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabel, { color: colors.secondaryText }]}>Out Time</Text>
                  <TextInput
                    style={[
                      styles.inputField,
                      { backgroundColor: colors.cardBackground, borderColor: colors.divider, color: colors.primaryText, paddingVertical: 7 },
                    ]}
                    value={outTime}
                    onChangeText={setOutTime}
                    placeholder="06:00 AM"
                    placeholderTextColor={colors.disabledText}
                    editable={!submitting}
                  />
                </View>
              </View>

              {/* Out Time Presets */}
              <View style={{ flexDirection: "row", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                {OUT_TIME_PRESETS.map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[
                      styles.miniTimePill,
                      outTime === t
                        ? { backgroundColor: colors.primaryAccent, borderColor: colors.primaryAccent }
                        : { backgroundColor: colors.cardBackground, borderColor: colors.divider },
                    ]}
                    onPress={() => setOutTime(t)}
                  >
                    <Text style={[styles.miniTimePillText, { color: outTime === t ? "#FFFFFF" : colors.secondaryText }]}>
                      {t}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* In Schedule (Return Curfew) */}
            <View style={[styles.scheduleCard, { backgroundColor: colors.primaryBackground, borderColor: colors.divider, marginTop: 10 }]}>
              <View style={styles.scheduleHeaderRow}>
                <Icon name="clock-in" size={16} color="#10B981" />
                <Text style={[styles.scheduleHeaderTitle, { color: "#10B981" }]}>RETURN CURFEW (IN SCHEDULE)</Text>
              </View>

              <View style={styles.datePickerRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabel, { color: colors.secondaryText }]}>In Date</Text>
                  <TouchableOpacity
                    style={[
                      styles.dateSelectBtn,
                      { backgroundColor: colors.cardBackground, borderColor: colors.divider },
                    ]}
                    onPress={() => !submitting && setShowToPicker(true)}
                    activeOpacity={0.8}
                  >
                    <Icon name="calendar-check" size={16} color="#10B981" />
                    <Text style={[styles.dateSelectText, { color: colors.primaryText }]}>
                      {formatDate(toDate)}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabel, { color: colors.secondaryText }]}>Curfew In-Time</Text>
                  <TextInput
                    style={[
                      styles.inputField,
                      { backgroundColor: colors.cardBackground, borderColor: colors.divider, color: colors.primaryText, paddingVertical: 7 },
                    ]}
                    value={inTime}
                    onChangeText={setInTime}
                    placeholder="08:30 PM"
                    placeholderTextColor={colors.disabledText}
                    editable={!submitting}
                  />
                </View>
              </View>

              {/* In Time Presets */}
              <View style={{ flexDirection: "row", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                {IN_TIME_PRESETS.map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[
                      styles.miniTimePill,
                      inTime === t
                        ? { backgroundColor: "#10B981", borderColor: "#10B981" }
                        : { backgroundColor: colors.cardBackground, borderColor: colors.divider },
                    ]}
                    onPress={() => setInTime(t)}
                  >
                    <Text style={[styles.miniTimePillText, { color: inTime === t ? "#FFFFFF" : colors.secondaryText }]}>
                      {t}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Duration Pill */}
            <View style={[styles.durationCounterBadge, { backgroundColor: colors.primaryAccent + "14", borderColor: colors.primaryAccent + "33" }]}>
              <Icon name="clock-fast" size={16} color={colors.primaryAccent} />
              <Text style={[styles.durationCounterText, { color: colors.primaryAccent }]}>
                Permit Window: {calculateDurationText(fromDate, toDate, leaveType, outTime, inTime)}
              </Text>
            </View>

            {/* Pickers */}
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

            {/* 5. Reason */}
            <Text style={[styles.sectionLabel, { color: colors.primaryText, marginTop: 16 }]}>
              Reason & Outing Details
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
              placeholder="State purpose of outing / home travel details..."
              placeholderTextColor={colors.disabledText}
              editable={!submitting}
            />

            {/* Emergency Parent Phone */}
            <Text style={[styles.inputLabel, { color: colors.secondaryText, marginTop: 12 }]}>
              Parent / Guardian Emergency Phone
            </Text>
            <TextInput
              style={[
                styles.inputField,
                { backgroundColor: colors.primaryBackground, borderColor: colors.divider, color: colors.primaryText },
              ]}
              value={parentContact}
              onChangeText={setParentContact}
              placeholder="+91 Emergency Phone"
              placeholderTextColor={colors.disabledText}
              keyboardType="phone-pad"
              editable={!submitting}
            />

            {/* Submit Button */}
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
                    <Icon name="shield-lock-outline" size={18} color="#FFFFFF" />
                    <Text style={styles.submitFormBtnText}>Submit for Warden Approval</Text>
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
const getStyles = (colors, _isDarkMode) =>
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

    /* Card Bottom Sheet (Even Rectangular Borders) */
    cardFull: {
      flex: 1,
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

    /* Block Selection */
    blockRow: {
      flexDirection: "row",
      gap: 10,
      marginVertical: 4,
    },
    blockOptionCard: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      padding: 10,
      borderRadius: 12,
    },
    blockOptionTitle: {
      fontSize: 13,
    },
    blockOptionSub: {
      fontSize: 9.5,
      marginTop: 1,
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

    /* Schedule Card */
    scheduleCard: {
      borderRadius: 14,
      borderWidth: 1,
      padding: 12,
      marginTop: 4,
    },
    scheduleHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginBottom: 8,
    },
    scheduleHeaderTitle: {
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 0.5,
    },
    datePickerRow: {
      flexDirection: "row",
      gap: 10,
    },
    dateSelectBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 10,
      paddingVertical: 9,
      borderRadius: 10,
      borderWidth: 1,
    },
    dateSelectText: {
      fontSize: 12,
      fontWeight: "700",
    },
    miniTimePill: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      borderWidth: 1,
    },
    miniTimePillText: {
      fontSize: 10.5,
      fontWeight: "700",
    },
    durationCounterBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      borderWidth: 1,
      marginTop: 10,
    },
    durationCounterText: {
      fontSize: 12,
      fontWeight: "700",
    },
    textAreaField: {
      borderWidth: 1,
      borderRadius: 12,
      padding: 12,
      fontSize: 13,
      textAlignVertical: "top",
      minHeight: 80,
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
      fontSize: 15,
      fontWeight: "800",
    },

    /* Pending / Rejected Centered Wraps */
    centerModalWrap: {
      flex: 1,
      padding: 16,
      justifyContent: "center",
    },
    statusCard: {
      borderRadius: 20,
      borderWidth: 1,
      padding: 18,
      elevation: 8,
    },
    statusIconWrap: {
      width: 80,
      height: 80,
      borderRadius: 40,
      justifyContent: "center",
      alignItems: "center",
      alignSelf: "center",
      marginBottom: 12,
    },
    statusCardTitle: {
      fontSize: 18,
      fontWeight: "800",
      textAlign: "center",
    },
    statusCardSub: {
      fontSize: 12,
      textAlign: "center",
      marginTop: 4,
      marginBottom: 16,
    },
    stepperContainer: {
      marginVertical: 12,
    },
    stepRow: {
      flexDirection: "row",
      minHeight: 46,
    },
    stepIndicatorCol: {
      width: 28,
      alignItems: "center",
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
      flex: 1,
      marginVertical: 2,
    },
    stepContent: {
      flex: 1,
      marginLeft: 10,
      paddingBottom: 8,
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
      marginTop: 1,
    },
    infoSummaryBox: {
      borderRadius: 12,
      borderWidth: 1,
      padding: 12,
      marginVertical: 12,
      gap: 6,
    },
    summaryRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    summaryLabel: {
      fontSize: 12,
      fontWeight: "600",
    },
    summaryVal: {
      fontSize: 12.5,
      fontWeight: "800",
    },
    primaryActionBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 12,
      borderRadius: 12,
      marginTop: 6,
    },
    primaryActionBtnText: {
      color: "#FFFFFF",
      fontSize: 14,
      fontWeight: "800",
    },
    secondaryActionBtn: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
      marginTop: 6,
    },
    secondaryActionText: {
      fontSize: 12.5,
      fontWeight: "700",
    },

    /* Approved Gate Pass */
    gatePassCard: {
      borderRadius: 22,
      borderWidth: 1.5,
      padding: 18,
      elevation: 10,
    },
    gatePassHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    verifiedPassPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: "#10B98118",
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
    },
    verifiedPassPillText: {
      color: "#10B981",
      fontSize: 10.5,
      fontWeight: "900",
    },
    gatePassIdText: {
      fontSize: 12,
      fontWeight: "700",
    },
    qrContainer: {
      alignItems: "center",
      marginVertical: 10,
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
      flexDirection: "row",
      flexWrap: "wrap",
      borderRadius: 14,
      borderWidth: 1,
      padding: 10,
      marginVertical: 10,
    },
    passInfoItem: {
      flexBasis: "50%",
      padding: 4,
    },
    passLabel: {
      fontSize: 10,
      fontWeight: "600",
    },
    passValue: {
      fontSize: 12,
      fontWeight: "800",
      marginTop: 1,
    },
    gatePassActionsRow: {
      flexDirection: "row",
      gap: 10,
      marginTop: 6,
    },
    sharePassBtn: {
      flex: 1.4,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 12,
      borderRadius: 12,
    },
    sharePassBtnText: {
      color: "#FFFFFF",
      fontSize: 13.5,
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
      fontWeight: "700",
    },

    /* History View */
    historyControlBar: {
      padding: 12,
      borderBottomWidth: 1,
    },
    historySearchBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      borderRadius: 10,
      borderWidth: 1,
      paddingHorizontal: 10,
      paddingVertical: 6,
      marginBottom: 8,
    },
    historySearchInput: {
      flex: 1,
      fontSize: 12,
      padding: 0,
    },
    historyFilterPill: {
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 8,
      borderWidth: 1,
    },
    historyFilterText: {
      fontSize: 11,
      fontWeight: "700",
    },
    historyListContainer: {
      flex: 1,
    },
    historyLoadingWrap: {
      paddingTop: 40,
      alignItems: "center",
    },
    historyEmptyWrap: {
      paddingTop: 60,
      alignItems: "center",
      gap: 8,
    },
    historyEmptyText: {
      fontSize: 13,
      fontWeight: "600",
    },
    historyItemCard: {
      borderRadius: 14,
      borderWidth: 1,
      padding: 12,
    },
    historyItemTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
    },
    historyItemId: {
      fontSize: 13,
      fontWeight: "800",
    },
    historyItemSub: {
      fontSize: 11,
      marginTop: 2,
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
    historyItemDates: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: 8,
      paddingTop: 6,
      borderTopWidth: 1,
    },
    historyDatesText: {
      fontSize: 11,
      fontWeight: "600",
    },
  });
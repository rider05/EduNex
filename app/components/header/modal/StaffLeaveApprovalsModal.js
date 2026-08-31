import React, { useRef, useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Animated,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TextInput,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../../../context/ThemeContext";
import { showToast } from "../../../utils/toastService";
import { api } from "../../../services/api";
import { resolveIdentity } from "../../../services/identityService";
import { secureGet, secureSet } from "../../../services/secureStorage";
import { sendTargetedNotification } from "../../../utils/notificationUtils";
import { shareLeaveGatePassPdf } from "../../../utils/pdfGenerator";

const TABS = ["Pending Review", "Approved", "Declined", "All Requests"];

export default function StaffLeaveApprovalsModal({ visible, onClose }) {
  const { colors, isDarkMode } = useTheme();
  const styles = getStyles(colors, isDarkMode);

  const scaleAnim = useRef(new Animated.Value(0.88)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const [activeTab, setActiveTab] = useState("Pending Review");
  const [searchQuery, setSearchQuery] = useState("");
  const [leaves, setLeaves] = useState([]);
  const leavesRef = useRef(leaves);
  leavesRef.current = leaves;

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState(null);
  const [staffProfile, setStaffProfile] = useState({
    name: "Ms. Z. Ananth Angel",
    staffId: "STF001",
    role: "Class Tutor",
  });

  const areStaffLeavesEqual = (a, b) => {
    if (!a || !b || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      const idA = a[i].id || a[i]._id || a[i].leaveId;
      const idB = b[i].id || b[i]._id || b[i].leaveId;
      if (idA !== idB || a[i].status !== b[i].status) {
        return false;
      }
    }
    return true;
  };

  const fetchLeaves = useCallback(async () => {
    try {
      // 1. Instant Cache Load
      if (leavesRef.current.length === 0) {
        const cached = await secureGet("edunex_staff_cached_leaves");
        if (Array.isArray(cached) && cached.length > 0) {
          setLeaves(cached);
        }
      }

      // 2. Fetch staff identity
      const identity = await resolveIdentity();
      if (identity?.staff?.name || identity?.user?.name) {
        setStaffProfile({
          name: identity?.staff?.name || identity?.user?.profile?.name || "Ms. Z. Ananth Angel",
          staffId: identity?.staffId || "STF001",
          role: identity?.staff?.designation || "Class Tutor",
        });
      }

      // 3. Live API Fetch
      const res = await api.get("/leaves", { sort: "-createdAt", limit: 100 }).catch(() => null);
      const items = res?.data || res || [];
      if (Array.isArray(items) && items.length > 0) {
        if (!areStaffLeavesEqual(leavesRef.current, items)) {
          setLeaves(items);
          await secureSet("edunex_staff_cached_leaves", items);
        }
      } else if (leavesRef.current.length === 0) {
        // Sample default if empty
        const defaultSample = [
          {
            id: "CL-882190",
            leaveId: "CL-882190",
            type: "college",
            studentName: "Velu",
            rollNo: "STU-2024-AIDS01",
            classSection: "AIDS - A",
            dept: "AI & DS",
            year: "III Year",
            leaveType: "Academic OD",
            reason: "Presenting research paper on Explainable Neural Networks at IEEE International Conference.",
            emergencyContact: "+91 98000 10001",
            fromDate: new Date().toISOString(),
            toDate: new Date(Date.now() + 86400000 * 2).toISOString(),
            daysCount: 2,
            status: "pending",
            appliedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          },
        ];
        setLeaves(defaultSample);
        await secureSet("edunex_staff_cached_leaves", defaultSample);
      }
    } catch (err) {
      console.warn("fetchLeaves error:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      fetchLeaves();
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, friction: 7, tension: 70, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      scaleAnim.setValue(0.88);
      fadeAnim.setValue(0);
    }
  }, [visible, fetchLeaves, fadeAnim, scaleAnim]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchLeaves();
    setRefreshing(false);
  }, [fetchLeaves]);

  // Handle Approve Decision
  const handleApprove = async (leaveItem) => {
    const id = leaveItem.id || leaveItem._id;
    setProcessingId(id);
    try {
      const staffName = staffProfile.name;
      const patchData = {
        status: "approved",
        approvedBy: staffName,
        approvedAt: new Date().toISOString(),
        approvalRemarks: "Approved by Faculty Tutor. Official gate pass issued.",
      };

      // 1. Update live API
      await api.patch(`/leaves/${id}`, patchData).catch(() => null);

      // 2. Update local state
      const updatedList = leaves.map((item) => {
        if (item.id === id || item._id === id) {
          return { ...item, ...patchData };
        }
        return item;
      });
      setLeaves(updatedList);
      await secureSet("edunex_staff_cached_leaves", updatedList);

      // 3. PUSH NOTIFICATION TO THE APPLIED STUDENT!
      const startDateStr = new Date(leaveItem.fromDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
      const endDateStr = new Date(leaveItem.toDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
      const durationStr = leaveItem.daysCount ? `${leaveItem.daysCount} Day(s)` : `${startDateStr} - ${endDateStr}`;

      await sendTargetedNotification({
        targetRole: "student",
        targetRollNo: leaveItem.rollNo,
        title: "✅ Leave Request Approved!",
        message: `Your ${leaveItem.leaveType} (${durationStr}) was APPROVED by ${staffName}! Digital Gate Pass is now active.`,
        type: "success",
        metadata: {
          leaveId: leaveItem.leaveId || id,
          status: "approved",
          approvedBy: staffName,
        },
      });

      showToast(`✅ Approved leave for ${leaveItem.studentName || leaveItem.rollNo}`, "success");
    } catch (err) {
      console.warn("handleApprove err:", err);
      showToast("Could not process approval", "error");
    } finally {
      setProcessingId(null);
    }
  };

  // Handle Reject Decision
  const handleReject = async (leaveItem) => {
    Alert.alert(
      "Confirm Rejection",
      `Are you sure you want to decline ${leaveItem.studentName || leaveItem.rollNo}'s leave request?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Decline Leave",
          style: "destructive",
          onPress: async () => {
            const id = leaveItem.id || leaveItem._id;
            setProcessingId(id);
            try {
              const staffName = staffProfile.name;
              const patchData = {
                status: "rejected",
                rejectedBy: staffName,
                rejectedAt: new Date().toISOString(),
                rejectionReason: "Declined due to ongoing academic schedule / critical attendance.",
              };

              await api.patch(`/leaves/${id}`, patchData).catch(() => null);

              const updatedList = leaves.map((item) => {
                if (item.id === id || item._id === id) {
                  return { ...item, ...patchData };
                }
                return item;
              });
              setLeaves(updatedList);
              await secureSet("edunex_staff_cached_leaves", updatedList);

              // PUSH NOTIFICATION TO THE APPLIED STUDENT!
              await sendTargetedNotification({
                targetRole: "student",
                targetRollNo: leaveItem.rollNo,
                title: "❌ Leave Request Declined",
                message: `Your ${leaveItem.leaveType} request was declined by ${staffName}. Please consult your tutor.`,
                type: "warning",
                metadata: {
                  leaveId: leaveItem.leaveId || id,
                  status: "rejected",
                  rejectedBy: staffName,
                },
              });

              showToast(`Declined leave request for ${leaveItem.studentName || leaveItem.rollNo}`, "warning");
            } catch (err) {
              console.warn("handleReject err:", err);
              showToast("Could not decline leave", "error");
            } finally {
              setProcessingId(null);
            }
          },
        },
      ]
    );
  };

  // Share Gate Pass PDF
  const handleSharePdf = async (item) => {
    try {
      await shareLeaveGatePassPdf({
        leave: {
          id: item.leaveId || item.id,
          leaveType: item.leaveType,
          startDate: new Date(item.fromDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
          endDate: new Date(item.toDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
          days: `${item.daysCount || 1} Day(s)`,
          reason: item.reason,
          status: item.status?.toUpperCase() || "APPROVED",
          approvedBy: item.approvedBy || staffProfile.name,
        },
        student: {
          name: item.studentName || "Student",
          rollNo: item.rollNo || "—",
          department: item.dept || "Artificial Intelligence & Data Science",
          year: item.year || "III Year",
        },
      });
      showToast("Official Pass PDF Generated!", "success");
    } catch (err) {
      console.warn("Share PDF error:", err);
      showToast("Could not generate pass PDF", "error");
    }
  };

  // Filtered list
  const filteredLeaves = useMemo(() => {
    let list = leaves;
    if (activeTab === "Pending Review") {
      list = list.filter((l) => l.status === "pending");
    } else if (activeTab === "Approved") {
      list = list.filter((l) => l.status === "approved");
    } else if (activeTab === "Declined") {
      list = list.filter((l) => l.status === "rejected" || l.status === "declined");
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (l) =>
          (l.studentName && l.studentName.toLowerCase().includes(q)) ||
          (l.rollNo && l.rollNo.toLowerCase().includes(q)) ||
          (l.leaveType && l.leaveType.toLowerCase().includes(q)) ||
          (l.leaveId && l.leaveId.toLowerCase().includes(q)) ||
          (l.reason && l.reason.toLowerCase().includes(q))
      );
    }
    return list;
  }, [leaves, activeTab, searchQuery]);

  const pendingCount = useMemo(() => {
    return leaves.filter((l) => l.status === "pending").length;
  }, [leaves]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <Animated.View
          style={[
            styles.modalContainer,
            {
              backgroundColor: colors.cardBackground,
              borderColor: colors.divider,
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* LinearGradient Header matching HeaderStaff */}
          <LinearGradient
            colors={colors.primaryGradient || ["#0D9488", "#059669"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.modalHeader}
          >
            <View style={styles.headerLeft}>
              <View style={styles.headerIconBox}>
                <Icon name="clipboard-check-outline" size={24} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.titleBadgeRow}>
                  <Text style={styles.modalTitle}>Student Leave Approvals</Text>
                  {pendingCount > 0 && (
                    <View style={[styles.pendingPill, { backgroundColor: colors.warning || "#F59E0B" }]}>
                      <Text style={styles.pendingPillText}>{pendingCount} PENDING</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.modalSub}>
                  Review & grant permission for Academic OD, Medical & Emergency Leaves
                </Text>
              </View>
            </View>

            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
              <Icon name="close" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </LinearGradient>

          {/* Search Bar */}
          <View
            style={[
              styles.searchBarContainer,
              { backgroundColor: colors.primaryBackground, borderColor: colors.divider },
            ]}
          >
            <Icon name="magnify" size={20} color={colors.secondaryText} style={{ marginRight: 8 }} />
            <TextInput
              placeholder="Search by student name, roll number, or reason..."
              placeholderTextColor={colors.disabledText}
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={[styles.searchInput, { color: colors.primaryText }]}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <Icon name="close-circle" size={18} color={colors.secondaryText} />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Filter Tabs */}
          <View style={styles.tabsRow}>
            {TABS.map((tab) => {
              const isSel = activeTab === tab;
              const count =
                tab === "Pending Review"
                  ? pendingCount
                  : tab === "Approved"
                  ? leaves.filter((l) => l.status === "approved").length
                  : tab === "Declined"
                  ? leaves.filter((l) => l.status === "rejected" || l.status === "declined").length
                  : leaves.length;

              return (
                <TouchableOpacity
                  key={tab}
                  style={[
                    styles.tabItem,
                    {
                      backgroundColor: isSel
                        ? colors.secondaryAccent || colors.primaryAccent || "#0D9488"
                        : colors.primaryBackground,
                      borderColor: isSel ? "transparent" : colors.divider,
                    },
                  ]}
                  onPress={() => setActiveTab(tab)}
                  activeOpacity={0.75}
                >
                  <Text
                    style={[
                      styles.tabItemText,
                      {
                        color: isSel ? "#FFFFFF" : colors.secondaryText,
                        fontWeight: isSel ? "700" : "600",
                      },
                    ]}
                  >
                    {tab} ({count})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Request List */}
          <ScrollView
            style={styles.contentScroll}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[colors.secondaryAccent || colors.primaryAccent || "#0D9488"]}
                tintColor={colors.secondaryAccent || colors.primaryAccent}
              />
            }
          >
            {isLoading ? (
              <View style={styles.centerLoading}>
                <ActivityIndicator size="large" color={colors.secondaryAccent || colors.primaryAccent || "#0D9488"} />
                <Text style={[styles.loadingText, { color: colors.secondaryText }]}>Syncing student leave requests...</Text>
              </View>
            ) : filteredLeaves.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Icon name="check-all" size={54} color={colors.success || "#10B981"} />
                <Text style={[styles.emptyTitle, { color: colors.primaryText }]}>All Caught Up!</Text>
                <Text style={[styles.emptySub, { color: colors.secondaryText }]}>
                  {activeTab === "Pending Review"
                    ? "No pending student leave requests requiring your review."
                    : `No ${activeTab.toLowerCase()} requests found.`}
                </Text>
              </View>
            ) : (
              filteredLeaves.map((item, idx) => {
                const isPending = item.status === "pending";
                const isApproved = item.status === "approved";
                const isRejected = item.status === "rejected" || item.status === "declined";
                const isItemProcessing = processingId === (item.id || item._id);

                const startDate = new Date(item.fromDate).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                });
                const endDate = new Date(item.toDate).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                });

                return (
                  <View
                    key={item.id || item._id || String(idx)}
                    style={[
                      styles.leaveCard,
                      {
                        backgroundColor: colors.cardBackground,
                        borderColor: isPending ? colors.warning || "#F59E0B" : colors.divider,
                      },
                    ]}
                  >
                    {/* Card Top Strip */}
                    <View style={styles.cardHeader}>
                      <View style={styles.studentMeta}>
                        <View
                          style={[
                            styles.avatarCircle,
                            {
                              backgroundColor: isPending
                                ? colors.warning || "#F59E0B"
                                : isApproved
                                ? colors.success || "#10B981"
                                : colors.danger || "#EF4444",
                            },
                          ]}
                        >
                          <Text style={styles.avatarInitials}>
                            {(item.studentName || "S").charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.studentNameText, { color: colors.primaryText }]}>
                            {item.studentName || "Student"}
                          </Text>
                          <Text style={[styles.studentRollText, { color: colors.secondaryText }]}>
                            {item.rollNo || "—"} · {item.classSection || item.dept || "AI & DS"}
                          </Text>
                        </View>
                      </View>

                      {/* Status Tag */}
                      <View
                        style={[
                          styles.statusBadge,
                          {
                            backgroundColor: isApproved
                              ? colors.successBg || "#D1FAE5"
                              : isRejected
                              ? colors.dangerBg || "#FEE2E2"
                              : colors.warningBg || "#FEF3C7",
                          },
                        ]}
                      >
                        <Icon
                          name={isApproved ? "check-circle" : isRejected ? "close-circle" : "clock-outline"}
                          size={13}
                          color={
                            isApproved
                              ? colors.successText || "#059669"
                              : isRejected
                              ? colors.dangerText || "#DC2626"
                              : colors.warningText || "#D97706"
                          }
                          style={{ marginRight: 4 }}
                        />
                        <Text
                          style={[
                            styles.statusBadgeText,
                            {
                              color: isApproved
                                ? colors.successText || "#059669"
                                : isRejected
                                ? colors.dangerText || "#DC2626"
                                : colors.warningText || "#D97706",
                            },
                          ]}
                        >
                          {item.status?.toUpperCase() || "PENDING"}
                        </Text>
                      </View>
                    </View>

                    {/* Details Box */}
                    <View
                      style={[
                        styles.detailsBox,
                        {
                          backgroundColor: colors.primaryBackground,
                          borderColor: colors.divider,
                        },
                      ]}
                    >
                      <View style={[styles.detailRow, { borderBottomColor: colors.divider }]}>
                        <View style={styles.detailItem}>
                          <Text style={[styles.detailLabel, { color: colors.secondaryText }]}>LEAVE TYPE</Text>
                          <Text style={[styles.detailValueBold, { color: colors.primaryText }]}>
                            {item.leaveType || "Academic OD"}
                          </Text>
                        </View>
                        <View style={styles.detailItem}>
                          <Text style={[styles.detailLabel, { color: colors.secondaryText }]}>DURATION</Text>
                          <Text style={[styles.detailValueBold, { color: colors.primaryText }]}>
                            {item.durationLabel || (item.daysCount === 0.5 ? "Half Day" : item.daysCount ? `${item.daysCount} Day(s)` : "1 Day")}
                          </Text>
                        </View>
                        <View style={styles.detailItem}>
                          <Text style={[styles.detailLabel, { color: colors.secondaryText }]}>DATE WINDOW</Text>
                          <Text style={[styles.detailValue, { color: colors.primaryText }]}>
                            {startDate === endDate ? startDate : `${startDate} → ${endDate}`}
                          </Text>
                        </View>
                      </View>

                      {/* Reason Description */}
                      <View style={styles.reasonSection}>
                        <Text style={[styles.reasonLabel, { color: colors.secondaryText }]}>REASON SPECIFIED BY STUDENT:</Text>
                        <Text style={[styles.reasonText, { color: colors.primaryText }]}>
                          &ldquo;{item.reason || "No reason provided."}&rdquo;
                        </Text>
                      </View>

                      {/* Emergency Contact & Applied At */}
                      <View style={styles.metaRow}>
                        <Text style={[styles.metaText, { color: colors.disabledText }]}>
                          📞 Parent/Emergency: {item.emergencyContact || "—"}
                        </Text>
                        <Text style={[styles.metaText, { color: colors.disabledText }]}>
                          ID: #{item.leaveId || item.id}
                        </Text>
                      </View>

                      {/* Staff Decision Trail */}
                      {isApproved && item.approvedBy && (
                        <View style={[styles.approvalTrailBox, { backgroundColor: colors.successBg || "#ECFDF5" }]}>
                          <Icon name="shield-check" size={14} color={colors.successText || "#059669"} style={{ marginRight: 5 }} />
                          <Text style={[styles.approvalTrailText, { color: colors.successText || "#059669" }]}>
                            Approved by {item.approvedBy} at{" "}
                            {item.approvedAt
                              ? new Date(item.approvedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                              : "Recently"}
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Actions Bar */}
                    <View style={styles.cardActionsRow}>
                      {isPending ? (
                        <>
                          <TouchableOpacity
                            style={[
                              styles.actionBtn,
                              styles.rejectBtn,
                              { backgroundColor: colors.dangerBg || "#FEE2E2", borderColor: colors.danger || "#EF4444" },
                            ]}
                            onPress={() => handleReject(item)}
                            disabled={isItemProcessing}
                            activeOpacity={0.8}
                          >
                            <Icon name="close" size={16} color={colors.dangerText || "#DC2626"} style={{ marginRight: 4 }} />
                            <Text style={[styles.rejectBtnText, { color: colors.dangerText || "#DC2626" }]}>Decline</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[
                              styles.actionBtn,
                              styles.approveBtn,
                              { backgroundColor: colors.secondaryAccent || colors.primaryAccent || "#0D9488" },
                            ]}
                            onPress={() => handleApprove(item)}
                            disabled={isItemProcessing}
                            activeOpacity={0.8}
                          >
                            {isItemProcessing ? (
                              <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                              <>
                                <Icon name="check-bold" size={16} color="#FFFFFF" style={{ marginRight: 5 }} />
                                <Text style={styles.approveBtnText}>Approve & Grant Pass</Text>
                              </>
                            )}
                          </TouchableOpacity>
                        </>
                      ) : (
                        <View style={styles.processedActionsRow}>
                          <TouchableOpacity
                            style={[
                              styles.viewPassBtn,
                              {
                                backgroundColor: colors.primaryBackground,
                                borderColor: colors.secondaryAccent || colors.primaryAccent || "#0D9488",
                              },
                            ]}
                            onPress={() => handleSharePdf(item)}
                            activeOpacity={0.8}
                          >
                            <Icon
                              name="file-pdf-box"
                              size={16}
                              color={colors.secondaryAccent || colors.primaryAccent || "#0D9488"}
                              style={{ marginRight: 5 }}
                            />
                            <Text
                              style={[
                                styles.viewPassBtnText,
                                { color: colors.secondaryAccent || colors.primaryAccent || "#0D9488" },
                              ]}
                            >
                              Export Official Gate Pass PDF
                            </Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>

          {/* Footer Bar */}
          <View style={[styles.modalFooter, { backgroundColor: colors.cardBackground, borderTopColor: colors.divider }]}>
            <Text style={[styles.footerNote, { color: colors.secondaryText }]}>
              💡 Approved leaves automatically dispatch real-time push alerts to student & generate QR Gate Passes.
            </Text>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ---------------- Styles ----------------
const getStyles = (colors, _isDarkMode) =>
  StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.72)",
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 24,
    },
    modalContainer: {
      width: "100%",
      maxWidth: 650,
      maxHeight: "92%",
      borderRadius: 22,
      overflow: "hidden",
      elevation: 20,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.25,
      shadowRadius: 20,
      borderWidth: 1,
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 18,
      paddingVertical: 16,
    },
    headerLeft: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
      marginRight: 10,
    },
    headerIconBox: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: "rgba(255, 255, 255, 0.2)",
      justifyContent: "center",
      alignItems: "center",
      marginRight: 12,
    },
    titleBadgeRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 2,
    },
    modalTitle: {
      color: "#FFFFFF",
      fontSize: 17,
      fontWeight: "800",
      letterSpacing: 0.2,
    },
    pendingPill: {
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 6,
    },
    pendingPillText: {
      color: "#FFFFFF",
      fontSize: 9.5,
      fontWeight: "900",
      letterSpacing: 0.4,
    },
    modalSub: {
      color: "rgba(255, 255, 255, 0.85)",
      fontSize: 11.5,
      fontWeight: "500",
    },
    closeBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: "rgba(255, 255, 255, 0.2)",
      justifyContent: "center",
      alignItems: "center",
    },
    searchBarContainer: {
      flexDirection: "row",
      alignItems: "center",
      marginHorizontal: 16,
      marginTop: 14,
      marginBottom: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      borderWidth: 1,
    },
    searchInput: {
      flex: 1,
      fontSize: 13,
      paddingVertical: 2,
    },
    tabsRow: {
      flexDirection: "row",
      paddingHorizontal: 16,
      marginBottom: 10,
      gap: 6,
      flexWrap: "wrap",
    },
    tabItem: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 10,
      borderWidth: 1,
    },
    tabItemText: {
      fontSize: 12,
    },
    contentScroll: {
      paddingHorizontal: 16,
      maxHeight: 460,
    },
    centerLoading: {
      paddingVertical: 50,
      alignItems: "center",
      justifyContent: "center",
    },
    loadingText: {
      marginTop: 12,
      fontSize: 13,
      fontWeight: "500",
    },
    emptyContainer: {
      paddingVertical: 50,
      alignItems: "center",
      justifyContent: "center",
    },
    emptyTitle: {
      fontSize: 17,
      fontWeight: "700",
      marginTop: 10,
    },
    emptySub: {
      fontSize: 13,
      textAlign: "center",
      marginTop: 4,
      maxWidth: 320,
    },
    leaveCard: {
      borderRadius: 16,
      padding: 14,
      marginBottom: 14,
      borderWidth: 1,
    },
    cardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    studentMeta: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
      marginRight: 8,
    },
    avatarCircle: {
      width: 38,
      height: 38,
      borderRadius: 19,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 10,
    },
    avatarInitials: {
      color: "#FFFFFF",
      fontSize: 16,
      fontWeight: "800",
    },
    studentNameText: {
      fontSize: 14.5,
      fontWeight: "700",
    },
    studentRollText: {
      fontSize: 11.5,
      fontWeight: "500",
      marginTop: 1,
    },
    statusBadge: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
    },
    statusBadgeText: {
      fontSize: 10.5,
      fontWeight: "800",
      letterSpacing: 0.4,
    },
    detailsBox: {
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      marginBottom: 12,
    },
    detailRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingBottom: 10,
      borderBottomWidth: 1,
      marginBottom: 10,
    },
    detailItem: {
      flex: 1,
    },
    detailLabel: {
      fontSize: 10,
      fontWeight: "700",
      marginBottom: 2,
    },
    detailValueBold: {
      fontSize: 13,
      fontWeight: "700",
    },
    detailValue: {
      fontSize: 12,
      fontWeight: "500",
    },
    reasonSection: {
      marginBottom: 8,
    },
    reasonLabel: {
      fontSize: 10,
      fontWeight: "700",
      marginBottom: 3,
    },
    reasonText: {
      fontSize: 12.5,
      lineHeight: 18,
      fontStyle: "italic",
    },
    metaRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 4,
    },
    metaText: {
      fontSize: 10.5,
    },
    approvalTrailBox: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: 6,
      marginTop: 8,
    },
    approvalTrailText: {
      fontSize: 11,
      fontWeight: "600",
    },
    cardActionsRow: {
      flexDirection: "row",
      gap: 10,
    },
    actionBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 10,
      flex: 1,
    },
    rejectBtn: {
      borderWidth: 1,
    },
    rejectBtnText: {
      fontSize: 13,
      fontWeight: "700",
    },
    approveBtn: {},
    approveBtnText: {
      color: "#FFFFFF",
      fontSize: 13,
      fontWeight: "700",
    },
    processedActionsRow: {
      flex: 1,
    },
    viewPassBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 9,
      paddingHorizontal: 14,
      borderRadius: 10,
      borderWidth: 1,
    },
    viewPassBtnText: {
      fontSize: 12,
      fontWeight: "700",
    },
    modalFooter: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderTopWidth: 1,
    },
    footerNote: {
      fontSize: 11,
      textAlign: "center",
      lineHeight: 15,
    },
  });
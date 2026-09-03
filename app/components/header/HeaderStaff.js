import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
  StatusBar,
  ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { useTheme } from "../../context/ThemeContext";

// Modals
import AssignmentModal from "./modal/AssignmentModal";
import ClassTestModal from "./modal/ClassTestModal";
import CommunityModal from "./modal/CommunityModal";
import ClassGroupMsgModal from "./modal/ClassGroupMsgModal";
import StaffLeaveApprovalsModal from "./modal/StaffLeaveApprovalsModal";
import NotificationModal from "./modal/NotificationModal";
import ChatModal from "./modal/ChatModal";
import { showToast } from "../../utils/toastService";
import { resolveIdentity } from "../../services/identityService";
import { api } from "../../services/api";
import { secureGet } from "../../services/secureStorage";
import { subscribeToNotifications, onNavigateToNotification, getUserNotifications } from "../../utils/notificationUtils";
import { onRouteChange } from "../../services/navigationEvents";

export default function HeaderStaff() {
  const { colors, isDarkMode } = useTheme();
  const styles = getStyles(colors, isDarkMode);

  const [isExpanded, setIsExpanded] = useState(false);
  const [activeModal, setActiveModal] = useState(null);
  const [userLabel, setUserLabel] = useState("");
  const [staffName, setStaffName] = useState("");
  const [pendingLeavesCount, setPendingLeavesCount] = useState(0);
  const [unreadNotifsCount, setUnreadNotifsCount] = useState(0);

  const bottomExpand = useRef(new Animated.Value(0)).current;

  const fetchPendingLeaves = useCallback(async () => {
    try {
      const cached = await secureGet("edunex_staff_cached_leaves");
      if (Array.isArray(cached)) {
        setPendingLeavesCount(cached.filter((l) => l.status === "pending").length);
      }
      const res = await api.get("/leaves", { status: "pending", limit: 50 }).catch(() => null);
      if (Array.isArray(res?.data)) {
        setPendingLeavesCount(res.data.length);
      }
    } catch (_e) {}
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const id = await resolveIdentity();
      const userIdentifier = id?.staff?.id || id?.id || id?.username || "";

      const [storedNotifs, apiRes] = await Promise.allSettled([
        getUserNotifications("staff", userIdentifier),
        api.get("/notices", { limit: 10, sort: "-createdAt" }),
      ]);

      const directList = storedNotifs.status === "fulfilled" && Array.isArray(storedNotifs.value) ? storedNotifs.value : [];
      const noticeDocs = apiRes.status === "fulfilled" && Array.isArray(apiRes.value?.data) ? apiRes.value.data : [];

      const validNotices = noticeDocs
        .filter((n) => {
          if (!n) return false;
          const hasTitle = Boolean((n.subject || n.title || n.sender || "").trim());
          const hasText = Boolean((n.message || n.text || n.body || "").trim());
          return hasText || (hasTitle && (n.subject || n.title || "").trim() !== "Campus Notice");
        })
        .map((n, idx) => ({
          id: n.id || n._id || `notice_${idx}`,
          title: (n.subject || n.title || n.sender || "Campus Notice").trim(),
          text: (n.message || n.text || n.body || "").trim(),
          isNew: n.isNew,
        }));

      const validStored = directList
        .filter((n) => {
          if (!n) return false;
          const hasTitle = Boolean((n.title || "").trim());
          const hasText = Boolean((n.message || n.text || "").trim());
          return hasTitle || hasText;
        })
        .map((n) => ({
          id: n.id,
          title: (n.title || "").trim(),
          text: (n.message || "").trim(),
          isNew: n.isNew,
          read: n.read,
        }));

      const dismissedIds = new Set((await secureGet("edunex_dismissed_notif_ids")) || []);
      const activeList = [...validStored, ...validNotices].filter((n) => !dismissedIds.has(String(n.id)));
      const unreadCount = activeList.filter((n) => n.isNew !== false && !n.read).length;

      setUnreadNotifsCount(unreadCount);
    } catch (_e) {
      setUnreadNotifsCount(0);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const id = await resolveIdentity();
        const realName = id?.staff?.name || id?.name || id?.fullName || id?.username || "";
        if (realName) setStaffName(realName);
        if (id?.staff?.name) {
          const parts = [id.staff.name];
          if (id.staff.designation) parts.push(id.staff.designation);
          setUserLabel(parts.join(" · "));
        }
      } catch (_e) { /* silent */ }
    })();

    fetchPendingLeaves();
    fetchNotifications();

    const unsubscribe = subscribeToNotifications((notif) => {
      if (notif.targetRole === "staff" || notif.title?.toLowerCase().includes("leave")) {
        fetchPendingLeaves();
      }
      fetchNotifications();
    });

    const unsubNav = onNavigateToNotification(({ target }) => {
      if (target === "staff_leave" || target === "leave") {
        setActiveModal("staff_leave");
      } else if (
        target === "assignment" ||
        target === "test" ||
        target === "community" ||
        target === "groupMsg" ||
        target === "chat" ||
        target === "notify" ||
        target === "notification"
      ) {
        setActiveModal(target);
      }
    });

    const unsubRoute = onRouteChange(() => {
      Animated.timing(bottomExpand, {
        toValue: 0,
        duration: 180,
        useNativeDriver: false,
      }).start();
      setIsExpanded(false);
    });

    return () => {
      unsubscribe();
      unsubNav();
      unsubRoute();
    };
  }, [fetchPendingLeaves, fetchNotifications, bottomExpand]);

  const handleMenuPress = () => {
    Animated.spring(bottomExpand, {
      toValue: isExpanded ? 0 : 86,
      friction: 7,
      useNativeDriver: false,
    }).start();
    setIsExpanded(!isExpanded);
  };

  const handleIconPress = (modalType) => {
    Animated.timing(bottomExpand, {
      toValue: 0,
      duration: 180,
      useNativeDriver: false,
    }).start();
    setIsExpanded(false);
    setActiveModal(modalType);
  };

  const closeModal = () => {
    setActiveModal(null);
    fetchPendingLeaves();
    fetchNotifications();
  };

  return (
    <View style={styles.headerContainer}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      <LinearGradient
        colors={colors.primaryGradient || ["#0D9488", "#059669"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientHeader}
      >
        {/* Header Top Row */}
        <View style={styles.headerContent}>
          <View style={styles.brandingSection}>
            <TouchableOpacity
              onPress={() => showToast(`👋 Welcome, ${staffName || "Faculty Member"}!`, "info")}
              activeOpacity={0.8}
              style={styles.titleRow}
            >
              <Text style={styles.appIconName}>EduNex</Text>
              <View style={styles.roleBadge}>
                <View style={styles.onlineDot} />
                <Text style={styles.roleBadgeText}>FACULTY PORTAL</Text>
              </View>
            </TouchableOpacity>

            <Text style={styles.title}>Faculty Command & Teaching Hub</Text>
            <Text style={styles.subtitle}>{userLabel || ""}</Text>
          </View>

          {/* Right Action Icons (Essential 3 Priority Actions + Drawer Menu) */}
          <View style={styles.iconGroup}>
            {/* 1. Student Leaves Approvals Icon */}
            <TouchableOpacity
              onPress={() => handleIconPress("leaveApprovals")}
              style={styles.actionBtn}
              activeOpacity={0.7}
            >
              <Icon name="clipboard-check-outline" size={21} color="#FFFFFF" />
              {pendingLeavesCount > 0 && (
                <View style={styles.badgePill}>
                  <Text style={styles.badgePillText}>{pendingLeavesCount}</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* 2. Notifications Icon */}
            <TouchableOpacity
              onPress={() => handleIconPress("notify")}
              style={styles.actionBtn}
              activeOpacity={0.7}
            >
              <Icon name="bell-outline" size={21} color="#FFFFFF" />
              {unreadNotifsCount > 0 && (
                <View style={[styles.badgePill, { backgroundColor: "#EF4444" }]}>
                  <Text style={styles.badgePillText}>{unreadNotifsCount}</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* 3. Direct Messaging (Chat) */}
            <TouchableOpacity
              onPress={() => handleIconPress("chat")}
              style={styles.actionBtn}
              activeOpacity={0.7}
            >
              <Icon name="chat-processing-outline" size={21} color="#FFFFFF" />
            </TouchableOpacity>

            {/* 4. Expandable Drawer Menu */}
            <TouchableOpacity style={styles.menuIcon} onPress={handleMenuPress} activeOpacity={0.8}>
              <Icon name={isExpanded ? "chevron-up" : "dots-vertical"} size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Expandable Quick Drawer (Contains All Faculty Tools Neatly) */}
        <Animated.View style={[styles.expandArea, { height: bottomExpand }]}>
          {isExpanded && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.quickActionsScroll}
            >
              <TouchableOpacity
                style={styles.quickActionItem}
                onPress={() => handleIconPress("broadcast")}
                activeOpacity={0.8}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: "#0284C7" }]}>
                  <Icon name="message-broadcast" size={19} color="#FFFFFF" />
                </View>
                <Text style={styles.quickActionLabel}>Broadcast</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickActionItem}
                onPress={() => handleIconPress("assignment")}
                activeOpacity={0.8}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: "#8B5CF6" }]}>
                  <Icon name="file-document-edit-outline" size={19} color="#FFFFFF" />
                </View>
                <Text style={styles.quickActionLabel}>Coursework</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickActionItem}
                onPress={() => handleIconPress("classtest")}
                activeOpacity={0.8}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: "#E67E22" }]}>
                  <Icon name="clipboard-text-clock" size={19} color="#FFFFFF" />
                </View>
                <Text style={styles.quickActionLabel}>CIA Reports</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickActionItem}
                onPress={() => handleIconPress("community")}
                activeOpacity={0.8}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: "#0D9488" }]}>
                  <Icon name="account-group-outline" size={19} color="#FFFFFF" />
                </View>
                <Text style={styles.quickActionLabel}>Community</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickActionItem}
                onPress={() => handleIconPress("leaveApprovals")}
                activeOpacity={0.8}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: "#F59E0B" }]}>
                  <Icon name="clipboard-check" size={19} color="#FFFFFF" />
                  {pendingLeavesCount > 0 && (
                    <View style={styles.drawerBadge}>
                      <Text style={styles.drawerBadgeText}>{pendingLeavesCount}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.quickActionLabel}>Leaves</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickActionItem}
                onPress={() => handleIconPress("notify")}
                activeOpacity={0.8}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: "#EF4444" }]}>
                  <Icon name="bell-ring-outline" size={19} color="#FFFFFF" />
                  {unreadNotifsCount > 0 && (
                    <View style={styles.drawerBadge}>
                      <Text style={styles.drawerBadgeText}>{unreadNotifsCount}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.quickActionLabel}>Notices</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickActionItem}
                onPress={() => handleIconPress("chat")}
                activeOpacity={0.8}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: "#4F46E5" }]}>
                  <Icon name="chat-outline" size={19} color="#FFFFFF" />
                </View>
                <Text style={styles.quickActionLabel}>DMs</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </Animated.View>
      </LinearGradient>

      {/* Header Modals */}
      <StaffLeaveApprovalsModal visible={activeModal === "leaveApprovals" || activeModal === "staff_leave"} onClose={closeModal} />
      <NotificationModal visible={activeModal === "notify" || activeModal === "notification"} onClose={closeModal} />
      <ChatModal visible={activeModal === "chat"} onClose={closeModal} userRole="staff" />
      <ClassTestModal visible={activeModal === "classtest" || activeModal === "test"} onClose={closeModal} />
      <ClassGroupMsgModal visible={activeModal === "broadcast" || activeModal === "groupMsg"} onClose={closeModal} />
      <CommunityModal visible={activeModal === "community"} onClose={closeModal} />
      <AssignmentModal visible={activeModal === "assignment"} onClose={closeModal} />
    </View>
  );
}

// ---------------- Styles ----------------
const getStyles = (colors, isDarkMode) =>
  StyleSheet.create({
    headerContainer: {
      overflow: "hidden",
      backgroundColor: "transparent",
      zIndex: 100,
    },
    gradientHeader: {
      paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight || 24) + 8 : 48,
      paddingBottom: 14,
      paddingHorizontal: 16,
      borderBottomLeftRadius: 22,
      borderBottomRightRadius: 22,
      elevation: 6,
      shadowColor: "#000",
      shadowOpacity: 0.15,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
    },
    headerContent: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    brandingSection: {
      flex: 1,
      marginRight: 10,
    },
    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 3,
    },
    appIconName: {
      color: "#FFFFFF",
      fontSize: 21,
      fontWeight: "900",
      letterSpacing: -0.3,
    },
    roleBadge: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "rgba(255, 255, 255, 0.2)",
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 10,
      gap: 5,
    },
    onlineDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: "#10B981",
    },
    roleBadgeText: {
      color: "#FFFFFF",
      fontSize: 9,
      fontWeight: "900",
      letterSpacing: 0.5,
    },
    title: {
      color: "#FFFFFF",
      fontSize: 13.5,
      fontWeight: "800",
    },
    subtitle: {
      color: "rgba(255, 255, 255, 0.85)",
      fontSize: 11,
      fontWeight: "500",
      marginTop: 1,
    },
    iconGroup: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    actionBtn: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: "rgba(255, 255, 255, 0.18)",
      justifyContent: "center",
      alignItems: "center",
    },
    menuIcon: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: "rgba(255, 255, 255, 0.18)",
      justifyContent: "center",
      alignItems: "center",
    },
    expandArea: {
      overflow: "hidden",
      marginTop: 4,
    },
    quickActionsScroll: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      paddingHorizontal: 4,
      paddingTop: 10,
      paddingBottom: 4,
      borderTopWidth: 1,
      borderTopColor: "rgba(255, 255, 255, 0.2)",
    },
    quickActionsRow: {
      flexDirection: "row",
      justifyContent: "space-around",
      alignItems: "center",
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: "rgba(255, 255, 255, 0.2)",
    },
    quickActionItem: {
      alignItems: "center",
      minWidth: 54,
    },
    quickActionIcon: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: "rgba(255, 255, 255, 0.2)",
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 4,
    },
    quickActionLabel: {
      color: "#FFFFFF",
      fontSize: 10.5,
      fontWeight: "700",
    },
    badgePill: {
      position: "absolute",
      top: -4,
      right: -4,
      backgroundColor: "#EF4444",
      borderRadius: 10,
      minWidth: 18,
      height: 18,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 4,
      borderWidth: 1.5,
      borderColor: "#FFFFFF",
    },
    badgePillText: {
      color: "#FFFFFF",
      fontSize: 9,
      fontWeight: "900",
    },
    drawerBadge: {
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
    drawerBadgeText: {
      color: "#FFFFFF",
      fontSize: 8.5,
      fontWeight: "900",
    },
  });
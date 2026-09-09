import React, { useRef, useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Animated,
  ScrollView,
  PanResponder,
  Dimensions,
  TouchableOpacity,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { useTheme } from "../../../context/ThemeContext";
import { api } from "../../../services/api";
import { resolveIdentity } from "../../../services/identityService";
import { secureGet, secureSet } from "../../../services/secureStorage";
import {
  getUserNotifications,
  subscribeToNotifications,
  handleNotificationAction,
  notifySubscribers,
  isNotificationForUser,
} from "../../../utils/notificationUtils";

const { height } = Dimensions.get("window");

function SkeletonNoticeCard({ isDarkMode }) {
  const shimmerAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, { toValue: 0.85, duration: 750, useNativeDriver: true }),
        Animated.timing(shimmerAnim, { toValue: 0.3, duration: 750, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [shimmerAnim]);

  const baseBg = isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(100,116,139,0.12)";

  return (
    <View style={skeletonStyles.cardItem}>
      <Animated.View style={[skeletonStyles.iconBox, { backgroundColor: baseBg, opacity: shimmerAnim }]} />
      <View style={skeletonStyles.textSection}>
        <Animated.View style={[skeletonStyles.titleBar, { backgroundColor: baseBg, opacity: shimmerAnim }]} />
        <Animated.View style={[skeletonStyles.textBar, { backgroundColor: baseBg, opacity: shimmerAnim }]} />
      </View>
    </View>
  );
}

const skeletonStyles = StyleSheet.create({
  cardItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  iconBox: {
    width: 45,
    height: 45,
    borderRadius: 12,
    marginRight: 12,
  },
  textSection: { flex: 1 },
  titleBar: { width: "60%", height: 15, borderRadius: 4, marginBottom: 8 },
  textBar: { width: "90%", height: 12, borderRadius: 4 },
});

export default function NotificationModal({ visible, onClose }) {
  const { colors, isDarkMode } = useTheme();
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const translateY = useRef(new Animated.Value(height)).current;
  const dragDy = useRef(0);

  const loadAllNotifications = async () => {
    try {
      setIsLoading(true);
      const role = (await secureGet("userRole")) || "student";
      const identity = await resolveIdentity();
      const student = identity?.student || {};
      const staff = identity?.staff || {};
      const user = identity?.user || {};

      const userContext = {
        role,
        rollNo: student?.rollNo || user?.profile?.rollNo || user?.rollNo || identity?.rollNo || "",
        studentId: student?.id || user?.id || identity?.id || "",
        staffId: staff?.id || identity?.staffId || "",
        username: identity?.username || user?.username || "",
        id: identity?.id || user?.id || staff?.id || "",
        department: student?.department || staff?.department || student?.class || user?.profile?.department || "",
        year: student?.year || user?.profile?.year || "",
        section: student?.section || user?.profile?.section || "",
      };

      const userIdentifier =
        userContext.rollNo ||
        userContext.staffId ||
        userContext.username ||
        userContext.id ||
        "";

      const [storedNotifs, apiRes] = await Promise.allSettled([
        getUserNotifications(role, userIdentifier, userContext),
        api.get("/notices", { limit: 30, sort: "-createdAt" }),
      ]);

      const directList = storedNotifs.status === "fulfilled" && Array.isArray(storedNotifs.value) ? storedNotifs.value : [];
      const noticeDocs = apiRes.status === "fulfilled" && Array.isArray(apiRes.value?.data) ? apiRes.value.data : [];

      const formattedNotices = noticeDocs
        .filter((n) => {
          if (!n) return false;
          // Strict user isolation check
          if (!isNotificationForUser(n, userContext)) return false;

          const hasTitle = Boolean((n.subject || n.title || n.sender || "").trim());
          const hasText = Boolean((n.message || n.text || n.body || "").trim());
          return hasText || (hasTitle && (n.subject || n.title || "").trim() !== "Campus Notice");
        })
        .map((n, idx) => ({
          id: n.id || n._id || `notice_${idx}`,
          icon: n.senderRole === "admin" ? "shield-alert-outline" : "bell-ring-outline",
          color: n.isNew ? "#4F46E5" : "#64748B",
          title: (n.subject || n.title || n.sender || "Campus Notice").trim(),
          text: (n.message || n.text || n.body || "").trim(),
          createdAt: n.createdAt || n.date || new Date().toISOString(),
          isNew: n.isNew,
          targetRole: n.targetRole || n.audience,
          targetRollNo: n.targetRollNo || n.targetStudentId,
        }))
        .filter((n) => n.text.length > 0 || (n.title.length > 0 && n.title !== "Campus Notice"));

      const formattedStored = directList
        .filter((n) => {
          if (!n) return false;
          if (!isNotificationForUser(n, userContext)) return false;

          const hasTitle = Boolean((n.title || "").trim());
          const hasText = Boolean((n.message || n.text || "").trim());
          return hasTitle || hasText;
        })
        .map((n) => ({
          id: n.id,
          icon:
            n.metadata?.type === "chat" || (n.title || "").toLowerCase().includes("message") || (n.title || "").toLowerCase().includes("tutor")
              ? "chat-processing-outline"
              : n.type === "success"
              ? "check-decagram"
              : n.type === "warning"
              ? "alert-circle"
              : n.type === "error"
              ? "close-circle"
              : "clipboard-text-clock",
          color:
            n.metadata?.type === "chat" || (n.title || "").toLowerCase().includes("message")
              ? "#059669"
              : n.type === "success"
              ? "#10B981"
              : n.type === "warning"
              ? "#EF4444"
              : n.type === "error"
              ? "#DC2626"
              : "#4F46E5",
          title: (n.title || "").trim(),
          text: (n.message || n.text || "").trim(),
          createdAt: n.createdAt,
          isNew: n.isNew,
          metadata: n.metadata || n.data || {},
          data: n.data || n.metadata || {},
        }))
        .filter((n) => n.title.length > 0 || n.text.length > 0);

      const dismissedIds = new Set((await secureGet("edunex_dismissed_notif_ids")) || []);
      const combined = [...formattedStored, ...formattedNotices]
        .filter((n) => !dismissedIds.has(String(n.id)))
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

      setNotifications(combined);
    } catch (e) {
      console.log("Notices load error:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      loadAllNotifications();
    }
  }, [visible]);

  useEffect(() => {
    const unsubscribe = subscribeToNotifications(() => {
      if (visible) {
        loadAllNotifications();
      }
    });
    return () => unsubscribe();
  }, [visible]);

  // animate open/close on visibility change
  useEffect(() => {
    Animated.timing(translateY, {
      toValue: visible ? 0 : height,
      duration: visible ? 350 : 250,
      useNativeDriver: true,
    }).start();
  }, [visible, translateY]);

  const triggerDismiss = () => {
    Animated.timing(translateY, {
      toValue: height,
      duration: 220,
      useNativeDriver: true,
    }).start(() => {
      dragDy.current = 0;
      onClose?.();
    });
  };

  const handleDismissNotification = async (notifId, e) => {
    e?.stopPropagation?.();
    setNotifications((prev) => prev.filter((n) => String(n.id) !== String(notifId)));
    try {
      const dismissed = (await secureGet("edunex_dismissed_notif_ids")) || [];
      const updated = [...new Set([...dismissed, String(notifId)])];
      await secureSet("edunex_dismissed_notif_ids", updated);
      notifySubscribers({ type: "dismiss", notifId });
    } catch (err) {
      console.warn("Dismiss notification error:", err);
    }
  };

  const handleClearAllNotifications = async () => {
    const allIds = notifications.map((n) => String(n.id));
    setNotifications([]);
    try {
      const dismissed = (await secureGet("edunex_dismissed_notif_ids")) || [];
      const updated = [...new Set([...dismissed, ...allIds])];
      await secureSet("edunex_dismissed_notif_ids", updated);
      notifySubscribers({ type: "clear_all" });
    } catch (err) {
      console.warn("Clear all notifications error:", err);
    }
  };

  const scrollOffsetRef = useRef(0);

  const handlePan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => {
        // Activate pull-down drag when user moves downwards
        return g.dy > 4 && Math.abs(g.dx) < Math.abs(g.dy);
      },
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) {
          dragDy.current = g.dy;
          translateY.setValue(g.dy);
        }
      },
      onPanResponderRelease: (_, g) => {
        if (dragDy.current > 75 || g.vy > 0.5) {
          triggerDismiss();
        } else {
          // Snap back up smoothly
          Animated.spring(translateY, {
            toValue: 0,
            tension: 60,
            friction: 9,
            useNativeDriver: true,
          }).start(() => {
            dragDy.current = 0;
          });
        }
      },
    })
  ).current;

  const styles = getStyles(colors, isDarkMode);

  const [selectedNotice, setSelectedNotice] = useState(null);

  const handleCardTap = (note) => {
    const title = (note.title || "").toLowerCase();
    const text = (note.text || note.message || "").toLowerCase();
    const meta = note.metadata || note.data || {};
    const notifType = (meta.type || note.type || "").toLowerCase();

    const isActionable =
      title.includes("leave") ||
      title.includes("gate pass") ||
      title.includes("on-duty") ||
      title.includes("od ") ||
      title.includes(" od") ||
      title.includes("hostel") ||
      title.includes("outing") ||
      title.includes("fee") ||
      title.includes("invoice") ||
      title.includes("dues") ||
      title.includes("assignment") ||
      title.includes("class test") ||
      title.includes("exam") ||
      title.includes("bus") ||
      title.includes("chat") ||
      title.includes("message") ||
      title.includes("tutor") ||
      title.includes("faculty") ||
      notifType === "leave" ||
      notifType === "hostel" ||
      notifType === "fees" ||
      notifType === "assignment" ||
      notifType === "test" ||
      notifType === "exam" ||
      notifType === "bus" ||
      notifType === "chat";

    if (isActionable) {
      onClose?.();
      setTimeout(() => {
        handleNotificationAction(note);
      }, 150);
    } else {
      setSelectedNotice(note);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        {/* Backdrop Tap to Close */}
        <TouchableOpacity
          style={StyleSheet.absoluteFillObject}
          activeOpacity={1}
          onPress={onClose}
        />

        <Animated.View style={[styles.bottomSheet, { transform: [{ translateY }] }]}>
          {/* Draggable Header & Pull Handle Area */}
          <View {...handlePan.panHandlers} style={styles.dragTriggerArea}>
            <View style={styles.handleWrapper}>
              <View style={styles.handle} />
              <View style={styles.pullHintRow}>
                <Icon name="chevron-down" size={14} color={isDarkMode ? "#888" : "#999"} />
                <Text style={styles.pullHintText}>Pull down to close</Text>
              </View>
            </View>

            {/* Header Banner */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <Icon name="bell-ring-outline" size={22} color="#FFF" />
                <Text style={styles.headerTitle}>Notifications & Circulars</Text>
              </View>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={triggerDismiss}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Icon name="close" size={18} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Sub Toolbar: Count & Clear All */}
          {notifications.length > 0 && (
            <View style={styles.toolbarRow}>
              <Text style={[styles.toolbarCount, { color: isDarkMode ? "#94A3B8" : "#64748B" }]}>
                {notifications.length} {notifications.length === 1 ? "Notice" : "Notices & Alerts"}
              </Text>
              <TouchableOpacity
                style={styles.clearAllBtn}
                onPress={handleClearAllNotifications}
                activeOpacity={0.7}
              >
                <Icon name="notification-clear-all" size={16} color={colors.primaryAccent || "#3B82F6"} />
                <Text style={[styles.clearAllText, { color: colors.primaryAccent || "#3B82F6" }]}>
                  Clear All
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* List (scrollable with overscroll pull-down detection) */}
          <ScrollView
            contentContainerStyle={styles.scrollContainer}
            showsVerticalScrollIndicator={false}
            bounces={true}
            scrollEventThrottle={16}
            onScroll={(e) => {
              scrollOffsetRef.current = e.nativeEvent.contentOffset.y;
            }}
            onScrollEndDrag={(e) => {
              if (
                e.nativeEvent.contentOffset.y < -30 ||
                (e.nativeEvent.velocity && e.nativeEvent.velocity.y < -0.3)
              ) {
                triggerDismiss();
              }
            }}
          >
            {isLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <SkeletonNoticeCard key={i} isDarkMode={isDarkMode} />
                ))
              : notifications.length > 0
                ? notifications.map((note) => (
                    <TouchableOpacity
                      key={note.id}
                      style={styles.cardItem}
                      activeOpacity={0.7}
                      onPress={() => handleCardTap(note)}
                    >
                      <View style={[styles.iconContainer, { backgroundColor: (note.color || "#4F46E5") + "22" }]}>
                        <Icon name={note.icon || "bell-outline"} size={24} color={note.color || "#4F46E5"} />
                      </View>
                      <View style={styles.textSection}>
                        <Text style={[styles.cardTitle, { color: isDarkMode ? "#FFF" : "#000" }]}>
                          {note.title}
                        </Text>
                        <Text style={[styles.cardText, { color: isDarkMode ? "#D3D3D3" : "#555" }]} numberOfLines={2}>
                          {note.text}
                        </Text>
                        {note.createdAt && (
                          <Text style={[styles.cardDate, { color: isDarkMode ? "#777" : "#999" }]}>
                            {new Date(note.createdAt).toLocaleDateString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </Text>
                        )}
                      </View>
                      <TouchableOpacity
                        style={[
                          styles.dismissCardBtn,
                          { backgroundColor: isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)" },
                        ]}
                        onPress={(e) => handleDismissNotification(note.id, e)}
                        activeOpacity={0.6}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Icon name="close" size={15} color={isDarkMode ? "#AAA" : "#666"} />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  ))
                : (
                  <View style={styles.emptyState}>
                    <Icon name="bell-off-outline" size={48} color={isDarkMode ? "#555" : "#CCC"} />
                    <Text style={[styles.emptyText, { color: isDarkMode ? "#888" : "#999" }]}>
                      No notifications
                    </Text>
                    <Text style={[styles.emptySubText, { color: isDarkMode ? "#666" : "#AAA" }]}>
                      You are all caught up!
                    </Text>
                  </View>
                )
            }
          </ScrollView>
        </Animated.View>

        {/* Detailed Circular / Notice Inspection Modal */}
        {selectedNotice && (
          <Modal visible={Boolean(selectedNotice)} transparent animationType="fade" onRequestClose={() => setSelectedNotice(null)}>
            <View style={styles.detailOverlay}>
              <View style={[styles.detailCard, { backgroundColor: isDarkMode ? "#1E1B4B" : "#FFFFFF" }]}>
                <View style={styles.detailHeader}>
                  <View style={[styles.iconContainer, { backgroundColor: (selectedNotice.color || "#4F46E5") + "25" }]}>
                    <Icon name={selectedNotice.icon || "bullhorn-outline"} size={26} color={selectedNotice.color || "#4F46E5"} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.detailTitle, { color: isDarkMode ? "#FFFFFF" : "#0F172A" }]}>
                      {selectedNotice.title}
                    </Text>
                    <Text style={[styles.detailDate, { color: isDarkMode ? "#94A3B8" : "#64748B" }]}>
                      {selectedNotice.createdAt ? new Date(selectedNotice.createdAt).toLocaleString() : "Official Campus Bulletin"}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setSelectedNotice(null)} style={styles.detailCloseBtn}>
                    <Icon name="close" size={20} color={isDarkMode ? "#CBD5E1" : "#475569"} />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.detailBody} showsVerticalScrollIndicator={false}>
                  <Text style={[styles.detailMessage, { color: isDarkMode ? "#E2E8F0" : "#334155" }]}>
                    {selectedNotice.text || selectedNotice.message || "No further details provided."}
                  </Text>
                </ScrollView>

                <View style={styles.detailActions}>
                  <TouchableOpacity
                    style={[styles.detailDismissBtn, { backgroundColor: isDarkMode ? "#312E81" : "#EEF2FF" }]}
                    onPress={() => {
                      handleDismissNotification(selectedNotice.id);
                      setSelectedNotice(null);
                    }}
                  >
                    <Icon name="check-circle-outline" size={16} color="#4F46E5" />
                    <Text style={[styles.detailDismissText, { color: "#4F46E5" }]}>Dismiss Notice</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.detailDoneBtn, { backgroundColor: "#4F46E5" }]}
                    onPress={() => setSelectedNotice(null)}
                  >
                    <Text style={styles.detailDoneText}>Close</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        )}
      </View>
    </Modal>
  );
}

const getStyles = (colors, isDarkMode) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.45)",
      justifyContent: "flex-end",
    },
    bottomSheet: {
      backgroundColor: isDarkMode ? "rgba(25,25,35,0.98)" : "#FFFFFFFB",
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingTop: 8,
      paddingBottom: 20,
      elevation: 24,
      shadowColor: "#000",
      shadowOpacity: 0.28,
      shadowOffset: { width: 0, height: -4 },
      shadowRadius: 10,
      borderTopWidth: 1,
      borderColor: isDarkMode ? "#333" : "#E6E6E6",
      height: Math.round(height * 0.75), // Exactly 3/4th of the screen
    },
    dragTriggerArea: {
      paddingBottom: 4,
    },
    handleWrapper: {
      alignItems: "center",
      paddingTop: 10,
      paddingBottom: 6,
    },
    handle: {
      width: 50,
      height: 5,
      borderRadius: 3,
      backgroundColor: isDarkMode ? "#666" : "#CBD5E1",
    },
    pullHintRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      marginTop: 4,
    },
    pullHintText: {
      fontSize: 11,
      fontWeight: "500",
      color: isDarkMode ? "#888" : "#94A3B8",
      letterSpacing: 0.2,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: colors.primary,
      marginTop: 8,
      marginHorizontal: 16,
      borderRadius: 14,
      paddingVertical: 12,
      paddingHorizontal: 16,
    },
    headerLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    closeBtn: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: "rgba(255,255,255,0.2)",
      justifyContent: "center",
      alignItems: "center",
    },
    headerTitle: {
      color: "#FFF",
      fontSize: 16,
      fontWeight: "bold",
    },
    toolbarRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingTop: 10,
      paddingBottom: 2,
    },
    toolbarCount: {
      fontSize: 12,
      fontWeight: "600",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    clearAllBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingVertical: 4,
      paddingHorizontal: 8,
      borderRadius: 8,
    },
    clearAllText: {
      fontSize: 12,
      fontWeight: "700",
    },
    scrollContainer: {
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 20,
    },
    cardItem: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: isDarkMode ? "#2E2E3F" : "#F8FAFC",
      borderRadius: 14,
      padding: 12,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: isDarkMode ? "#3A3A4F" : "#E2E8F0",
      elevation: 2,
    },
    iconContainer: {
      width: 44,
      height: 44,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 10,
    },
    textSection: {
      flex: 1,
      marginRight: 6,
    },
    cardTitle: {
      fontSize: 14,
      fontWeight: "bold",
      marginBottom: 3,
    },
    cardText: {
      fontSize: 12,
      lineHeight: 16,
    },
    cardDate: {
      fontSize: 10,
      marginTop: 3,
      fontWeight: "500",
    },
    dismissCardBtn: {
      width: 26,
      height: 26,
      borderRadius: 13,
      justifyContent: "center",
      alignItems: "center",
      marginLeft: 4,
    },
    emptyState: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 60,
    },
    emptyText: {
      fontSize: 15,
      fontWeight: "700",
      marginTop: 12,
    },
    emptySubText: {
      fontSize: 12,
      marginTop: 4,
    },
    /* Detail View Modal Styles */
    detailOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.6)",
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 20,
    },
    detailCard: {
      width: "100%",
      maxHeight: "80%",
      borderRadius: 22,
      padding: 20,
      elevation: 20,
      shadowColor: "#000",
      shadowOpacity: 0.25,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
    },
    detailHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 16,
    },
    detailTitle: {
      fontSize: 16,
      fontWeight: "800",
      letterSpacing: -0.2,
    },
    detailDate: {
      fontSize: 11,
      marginTop: 2,
      fontWeight: "500",
    },
    detailCloseBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: "rgba(100,116,139,0.12)",
      justifyContent: "center",
      alignItems: "center",
      marginLeft: 8,
    },
    detailBody: {
      maxHeight: 260,
      marginBottom: 20,
    },
    detailMessage: {
      fontSize: 13.5,
      lineHeight: 22,
      fontWeight: "400",
    },
    detailActions: {
      flexDirection: "row",
      gap: 10,
      justifyContent: "flex-end",
    },
    detailDismissBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 12,
    },
    detailDismissText: {
      fontSize: 12.5,
      fontWeight: "700",
    },
    detailDoneBtn: {
      paddingVertical: 10,
      paddingHorizontal: 20,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
    },
    detailDoneText: {
      color: "#FFFFFF",
      fontSize: 13,
      fontWeight: "800",
    },
  });
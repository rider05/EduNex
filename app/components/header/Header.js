import React, { useState, useRef, useEffect } from "react";
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

import LeaveFormModal from "./modal/LeaveFormModal";
import HostelFormModal from "./modal/HostelFormModal";
import NotificationModal from "./modal/NotificationModal";
import ChatModal from "./modal/ChatModal";
import BusTrackerModal from "./modal/BusTrackerModal";
import MessMenuModal from "./modal/MessMenuModal";
import { showToast } from "../../utils/toastService";
import { resolveIdentity } from "../../services/identityService";
import { onNavigateToNotification } from "../../utils/notificationUtils";
import { onRouteChange } from "../../services/navigationEvents";

export default function Header() {
  const { colors, isDarkMode } = useTheme();
  const styles = getStyles(colors, isDarkMode);

  const [isExpanded, setIsExpanded] = useState(false);
  const [activeModal, setActiveModal] = useState(null); // leave | hostel | notify | chat | bus | mess
  const [userLabel, setUserLabel] = useState("");
  const [studentName, setStudentName] = useState("");

  const bottomExpand = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    (async () => {
      try {
        const id = await resolveIdentity();
        const name = id?.student?.name || id?.name || id?.fullName || id?.username || "";
        if (name) setStudentName(name);
        if (id?.student?.name) {
          const parts = [id.student.name];
          if (id.student.course || id.student.department) parts.push(id.student.course || id.student.department);
          if (id.student.year) parts.push(`Year ${id.student.year}`);
          setUserLabel(parts.join(" · "));
        }
      } catch (_e) { /* silent */ }
    })();

    const unsubRoute = onRouteChange(() => {
      Animated.timing(bottomExpand, {
        toValue: 0,
        duration: 180,
        useNativeDriver: false,
      }).start();
      setIsExpanded(false);
    });

    const unsub = onNavigateToNotification(({ target }) => {
      if (
        target === "leave" ||
        target === "hostel" ||
        target === "chat" ||
        target === "bus" ||
        target === "mess" ||
        target === "notify"
      ) {
        setActiveModal(target);
      }
    });

    return () => {
      unsub();
      unsubRoute();
    };
  }, [bottomExpand]);

  const handleAppIconPress = () => showToast(`👋 Welcome, ${studentName || "Student"}!`, "info");

  const handleMenuPress = () => {
    Animated.spring(bottomExpand, {
      toValue: isExpanded ? 0 : 86,
      friction: 7,
      useNativeDriver: false,
    }).start();
    setIsExpanded(!isExpanded);
  };

  const handleOpenModal = (modalKey) => {
    Animated.timing(bottomExpand, {
      toValue: 0,
      duration: 180,
      useNativeDriver: false,
    }).start();
    setIsExpanded(false);
    setActiveModal(modalKey);
  };

  const closeModal = () => {
    setActiveModal(null);
  };

  return (
    <View style={styles.headerContainer}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      <LinearGradient
        colors={colors.primaryGradient || ["#4338CA", "#6366F1"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientHeader}
      >
        {/* Top Bar with Branding & Actions */}
        <View style={styles.headerContent}>
          <View style={styles.brandingSection}>
            <TouchableOpacity onPress={handleAppIconPress} activeOpacity={0.8} style={styles.titleRow}>
              <Text style={styles.appIconName}>EduNex</Text>
              <View style={styles.roleBadge}>
                <View style={styles.onlineDot} />
                <Text style={styles.roleBadgeText}>STUDENT PORTAL</Text>
              </View>
            </TouchableOpacity>

            <Text style={styles.title}>Student Command Center</Text>
            <Text style={styles.subtitle}>{userLabel || ""}</Text>
          </View>

          {/* Right Action Icons */}
          <View style={styles.iconGroup}>
            <TouchableOpacity
              onPress={() => handleOpenModal("notify")}
              activeOpacity={0.7}
              style={styles.actionBtn}
            >
              <Icon name="bell-outline" size={22} color="#FFFFFF" />
              <View style={styles.notificationDot} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => handleOpenModal("chat")}
              activeOpacity={0.7}
            >
              <Icon name="message-text-lock-outline" size={22} color="#FFFFFF" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuIcon} onPress={handleMenuPress} activeOpacity={0.8}>
              <Icon name={isExpanded ? "chevron-up" : "dots-vertical"} size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Expandable Quick Actions Tray */}
        <Animated.View style={[styles.expandArea, { height: bottomExpand }]}>
          {isExpanded && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.quickActionsScroll}
            >
              <TouchableOpacity
                style={styles.quickActionItem}
                onPress={() => handleOpenModal("leave")}
                activeOpacity={0.8}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: "#10B981" }]}>
                  <Icon name="file-document-edit-outline" size={19} color="#FFFFFF" />
                </View>
                <Text style={styles.quickActionLabel}>Leave / OD</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickActionItem}
                onPress={() => handleOpenModal("hostel")}
                activeOpacity={0.8}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: "#F59E0B" }]}>
                  <Icon name="home-export-outline" size={19} color="#FFFFFF" />
                </View>
                <Text style={styles.quickActionLabel}>Gate Pass</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickActionItem}
                onPress={() => handleOpenModal("bus")}
                activeOpacity={0.8}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: "#0EA5E9" }]}>
                  <Icon name="bus-clock" size={19} color="#FFFFFF" />
                </View>
                <Text style={styles.quickActionLabel}>Bus Tracker</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickActionItem}
                onPress={() => handleOpenModal("mess")}
                activeOpacity={0.8}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: "#F43F5E" }]}>
                  <Icon name="silverware-fork-knife" size={19} color="#FFFFFF" />
                </View>
                <Text style={styles.quickActionLabel}>Mess Menu</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickActionItem}
                onPress={() => handleOpenModal("notify")}
                activeOpacity={0.8}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: "#EF4444" }]}>
                  <Icon name="bell-ring-outline" size={19} color="#FFFFFF" />
                </View>
                <Text style={styles.quickActionLabel}>Notices</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickActionItem}
                onPress={() => handleOpenModal("chat")}
                activeOpacity={0.8}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: "#8B5CF6" }]}>
                  <Icon name="message-text-lock-outline" size={19} color="#FFFFFF" />
                </View>
                <Text style={styles.quickActionLabel}>Campus DMs</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </Animated.View>
      </LinearGradient>

      {/* Student Modals */}
      <LeaveFormModal visible={activeModal === "leave"} onClose={closeModal} />
      <HostelFormModal visible={activeModal === "hostel"} onClose={closeModal} />
      <BusTrackerModal visible={activeModal === "bus"} onClose={closeModal} />
      <MessMenuModal visible={activeModal === "mess"} onClose={closeModal} />
      <NotificationModal visible={activeModal === "notify"} onClose={closeModal} />
      <ChatModal visible={activeModal === "chat"} onClose={closeModal} userRole="student" />
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
      marginRight: 8,
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
      width: 36,
      height: 36,
      borderRadius: 11,
      backgroundColor: "rgba(255, 255, 255, 0.18)",
      justifyContent: "center",
      alignItems: "center",
      position: "relative",
    },
    notificationDot: {
      position: "absolute",
      top: 6,
      right: 7,
      width: 7,
      height: 7,
      borderRadius: 3.5,
      backgroundColor: "#EF4444",
      borderWidth: 1,
      borderColor: "#FFFFFF",
    },
    menuIcon: {
      width: 36,
      height: 36,
      borderRadius: 11,
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
      paddingHorizontal: 6,
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
      minWidth: 56,
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
  });
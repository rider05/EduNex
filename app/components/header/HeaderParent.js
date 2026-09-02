import React, { useState, useRef, useEffect } from "react";
import {
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
  Animated,
  StatusBar,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { useTheme } from "../../context/ThemeContext";

import AssignmentModal from "./pmodal/AssignmentModal";
import FeedbackModal from "./pmodal/FeedbackModal";
import EntryExitModal from "./pmodal/EntryExitModal";
import ChatModal from "./modal/ChatModal";
import { getParentData } from "../../services/dataService";
import { showToast } from "../../utils/toastService";
import { onNavigateToNotification } from "../../utils/notificationUtils";

export default function HeaderParent() {
  const { colors, isDarkMode } = useTheme();
  const styles = getStyles(colors, isDarkMode);

  const [isExpanded, setIsExpanded] = useState(false);
  const [activeModal, setActiveModal] = useState(null);
  const [parentName, setParentName] = useState("");
  const [wardDept, setWardDept] = useState("");
  const [wardName, setWardName] = useState("");
  const [rollNo, setRollNo] = useState("");

  const bottomExpand = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    getParentData().then((data) => {
      if (data?.name || data?.parentName) {
        setParentName(data.name || data.parentName);
      }
      if (data?.ward) {
        setWardDept(data.ward.dept || "");
        setWardName(data.ward.name || "");
        setRollNo(data.ward.rollNo || "");
      }
    }).catch(() => {});

    const unsub = onNavigateToNotification(({ target }) => {
      if (target === "chat" || target === "assignment" || target === "feedback" || target === "entryexit") {
        setActiveModal(target);
      }
    });

    return () => unsub();
  }, []);

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
        {/* Top Header Row */}
        <View style={styles.headerContent}>
          <View style={styles.brandingSection}>
            <TouchableOpacity
              onPress={() => showToast(`👋 Welcome, ${parentName || (wardName ? `Parent of ${wardName}` : "Parent")}!`, "info")}
              activeOpacity={0.8}
              style={styles.titleRow}
            >
              <Text style={styles.appIconName}>EduNex</Text>
              <View style={styles.roleBadge}>
                <View style={styles.onlineDot} />
                <Text style={styles.roleBadgeText}>PARENT PORTAL</Text>
              </View>
            </TouchableOpacity>

            <Text style={styles.title}>Ward Supervision & Welfare Hub</Text>
            <Text style={styles.subtitle}>{wardDept ? `${wardDept} · ${wardName} (${rollNo})` : ""}</Text>
          </View>

          {/* Right Action Icons */}
          <View style={styles.iconGroup}>
            <TouchableOpacity
              onPress={() => handleIconPress("entryexit")}
              style={styles.actionBtn}
              activeOpacity={0.7}
            >
              <Icon name="door-open" size={22} color="#FFFFFF" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleIconPress("assignment")}
              style={styles.actionBtn}
              activeOpacity={0.7}
            >
              <Icon name="calendar-clock" size={22} color="#FFFFFF" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuIcon} onPress={handleMenuPress} activeOpacity={0.8}>
              <Icon name={isExpanded ? "chevron-up" : "dots-vertical"} size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Expandable Quick Drawer */}
        <Animated.View style={[styles.expandArea, { height: bottomExpand }]}>
          {isExpanded && (
            <View style={styles.quickActionsRow}>
              <TouchableOpacity
                style={styles.quickActionItem}
                onPress={() => handleIconPress("assignment")}
                activeOpacity={0.8}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: "#8B5CF6" }]}>
                  <Icon name="calendar-text-outline" size={19} color="#FFFFFF" />
                </View>
                <Text style={styles.quickActionLabel}>Exam Portions</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickActionItem}
                onPress={() => handleIconPress("chat")}
                activeOpacity={0.8}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: "#4F46E5" }]}>
                  <Icon name="chat-outline" size={19} color="#FFFFFF" />
                </View>
                <Text style={styles.quickActionLabel}>Tutor DM</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickActionItem}
                onPress={() => handleIconPress("feedback")}
                activeOpacity={0.8}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: "#F59E0B" }]}>
                  <Icon name="message-draw" size={19} color="#FFFFFF" />
                </View>
                <Text style={styles.quickActionLabel}>Feedback Query</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickActionItem}
                onPress={() => handleIconPress("entryexit")}
                activeOpacity={0.8}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: "#10B981" }]}>
                  <Icon name="shield-account-outline" size={19} color="#FFFFFF" />
                </View>
                <Text style={styles.quickActionLabel}>Gate Pass Log</Text>
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>
      </LinearGradient>

      {/* Header Modals */}
      <AssignmentModal visible={activeModal === "assignment"} onClose={closeModal} />
      <FeedbackModal visible={activeModal === "feedback"} onClose={closeModal} />
      <EntryExitModal visible={activeModal === "entryexit"} onClose={closeModal} />
      <ChatModal visible={activeModal === "chat"} onClose={closeModal} userRole="parent" />
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
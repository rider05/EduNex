import React, { useState, useRef } from "react";
import {
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
  StatusBar,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { useTheme } from "../../context/ThemeContext";

import LeaveFormModal from "./modal/LeaveFormModal";
import HostelFormModal from "./modal/HostelFormModal";
import NotificationModal from "./modal/NotificationModal";
import ChatModal from "./modal/ChatModal";

export default function Header() {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeModal, setActiveModal] = useState(null); // leave | hostel | notify | chat

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const bottomExpand = useRef(new Animated.Value(0)).current;

  const showToast = (message) => {
    setToastMessage(message);
    setToastVisible(true);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setTimeout(() => {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => setToastVisible(false));
      }, 1500);
    });
  };

  const handleAppIconPress = () => showToast("👋 Welcome to EduNex Student Portal!");

  const handleMenuPress = () => {
    Animated.spring(bottomExpand, {
      toValue: isExpanded ? 0 : 80,
      friction: 7,
      useNativeDriver: false,
    }).start();
    setIsExpanded(!isExpanded);
  };

  const handleIconPress = (type) => {
    showToast(`${type} opened`);
    Animated.timing(bottomExpand, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
    setIsExpanded(false);

    if (type === "Leave Form") setActiveModal("leave");
    else if (type === "Hostel Admission") setActiveModal("hostel");
    else if (type === "Notifications") setActiveModal("notify");
    else if (type === "Messages") setActiveModal("chat");
  };

  const closeModal = () => {
    setActiveModal(null);
  };

  return (
    <View style={styles.headerContainer}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      <LinearGradient colors={colors.primaryGradient || ["#4338CA", "#6366F1"]} style={styles.gradientHeader}>
        {/* Top bar with Branding & Actions */}
        <View style={styles.headerContent}>
          <View style={styles.brandingSection}>
            <TouchableOpacity onPress={handleAppIconPress} activeOpacity={0.8} style={styles.titleRow}>
              <Text style={styles.appIconName}>EduNex</Text>
              <View style={styles.roleBadge}>
                <View style={styles.onlineDot} />
                <Text style={styles.roleBadgeText}>STUDENT</Text>
              </View>
            </TouchableOpacity>

            <Text style={styles.title}>Student Portal</Text>
            <Text style={styles.subtitle}>Empowering Campus, Simplifying Success</Text>
          </View>

          {/* Right Action Icons */}
          <View style={styles.iconGroup}>
            <TouchableOpacity
              onPress={() => handleIconPress("Notifications")}
              activeOpacity={0.7}
              style={styles.actionBtn}
            >
              <Icon name="bell-outline" size={24} color="#FFFFFF" />
              <View style={styles.notificationDot} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => handleIconPress("Messages")}
              activeOpacity={0.7}
            >
              <Icon name="message-text-outline" size={24} color="#FFFFFF" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuIcon} onPress={handleMenuPress} activeOpacity={0.8}>
              <Icon name={isExpanded ? "chevron-up" : "dots-vertical"} size={26} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Expandable Quick Actions Tray */}
        <Animated.View style={[styles.expandArea, { height: bottomExpand }]}>
          {isExpanded && (
            <View style={styles.quickActionsRow}>
              <TouchableOpacity
                style={styles.quickActionItem}
                onPress={() => handleIconPress("Leave Form")}
                activeOpacity={0.8}
              >
                <View style={styles.quickActionIcon}>
                  <Icon name="file-document-edit-outline" size={22} color="#FFFFFF" />
                </View>
                <Text style={styles.quickActionLabel}>Leave</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickActionItem}
                onPress={() => handleIconPress("Hostel Admission")}
                activeOpacity={0.8}
              >
                <View style={styles.quickActionIcon}>
                  <Icon name="home-plus-outline" size={22} color="#FFFFFF" />
                </View>
                <Text style={styles.quickActionLabel}>Hostel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickActionItem}
                onPress={() => handleIconPress("Messages")}
                activeOpacity={0.8}
              >
                <View style={styles.quickActionIcon}>
                  <Icon name="chat-processing-outline" size={22} color="#FFFFFF" />
                </View>
                <Text style={styles.quickActionLabel}>Campus Chat</Text>
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>
      </LinearGradient>

      {/* Modals */}
      <LeaveFormModal visible={activeModal === "leave"} onClose={closeModal} />
      <HostelFormModal visible={activeModal === "hostel"} onClose={closeModal} />
      <NotificationModal visible={activeModal === "notify"} onClose={closeModal} />
      <ChatModal visible={activeModal === "chat"} onClose={closeModal} />

      {/* Toast Notification */}
      {toastVisible && (
        <Animated.View style={[styles.toastContainer, { opacity: fadeAnim }]}>
          <Icon name="information" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
          <Text style={styles.toastText}>{toastMessage}</Text>
        </Animated.View>
      )}
    </View>
  );
}

const getStyles = (colors) =>
  StyleSheet.create({
    headerContainer: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 1000,
      elevation: 8,
      shadowColor: "#000",
      shadowOpacity: 0.25,
      shadowOffset: { width: 0, height: 4 },
      shadowRadius: 10,
    },
    gradientHeader: {
      borderBottomLeftRadius: 30,
      borderBottomRightRadius: 30,
      paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight || 24) + 12 : 52,
      paddingBottom: 16,
      paddingHorizontal: 20,
    },
    headerContent: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
    },
    brandingSection: {
      flex: 1,
    },
    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginBottom: 2,
    },
    appIconName: {
      color: "#FFFFFF",
      fontSize: 28,
      fontWeight: "900",
      letterSpacing: -0.5,
    },
    roleBadge: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "rgba(255, 255, 255, 0.2)",
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 12,
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
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 0.8,
    },
    title: {
      color: "#FFFFFF",
      fontSize: 16,
      fontWeight: "700",
      marginTop: 2,
    },
    subtitle: {
      color: "rgba(255, 255, 255, 0.8)",
      fontSize: 12,
      marginTop: 2,
      fontWeight: "500",
    },
    iconGroup: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 4,
    },
    actionBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: "rgba(255, 255, 255, 0.15)",
      justifyContent: "center",
      alignItems: "center",
      position: "relative",
    },
    notificationDot: {
      position: "absolute",
      top: 9,
      right: 9,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: "#EF4444",
      borderWidth: 1.5,
      borderColor: "#FFFFFF",
    },
    menuIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: "rgba(255, 255, 255, 0.15)",
      justifyContent: "center",
      alignItems: "center",
    },
    expandArea: {
      overflow: "hidden",
      width: "100%",
    },
    quickActionsRow: {
      flexDirection: "row",
      justifyContent: "space-around",
      alignItems: "center",
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: "rgba(255, 255, 255, 0.15)",
      marginTop: 12,
    },
    quickActionItem: {
      alignItems: "center",
      gap: 6,
    },
    quickActionIcon: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: "rgba(255, 255, 255, 0.2)",
      justifyContent: "center",
      alignItems: "center",
    },
    quickActionLabel: {
      color: "#FFFFFF",
      fontSize: 11,
      fontWeight: "700",
    },
    toastContainer: {
      position: "absolute",
      top: Platform.OS === "android" ? (StatusBar.currentHeight || 24) + 120 : 130,
      alignSelf: "center",
      zIndex: 9999,
      backgroundColor: "rgba(15, 23, 42, 0.92)",
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 25,
      flexDirection: "row",
      alignItems: "center",
      shadowColor: "#000",
      shadowOpacity: 0.2,
      shadowRadius: 6,
      elevation: 10,
    },
    toastText: {
      color: "#FFFFFF",
      fontSize: 13,
      fontWeight: "600",
    },
  });
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

// Modals
import AssignmentModal from "./modal/AssignmentModal";
import ClassTestModal from "./modal/ClassTestModal";
import CommunityModal from "./modal/CommunityModal";
import ClassGroupMsgModal from "./modal/ClassGroupMsgModal";

export default function HeaderStaff() {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);

  // Modal States
  const [assignmentVisible, setAssignmentVisible] = useState(false);
  const [classTestVisible, setClassTestVisible] = useState(false);
  const [communityVisible, setCommunityVisible] = useState(false);
  const [classGroupMsgVisible, setClassGroupMsgVisible] = useState(false);

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

  const handleAppIconPress = () => showToast("👋 Welcome, Faculty / Staff!");
  const handleMenuPress = () => {
    Animated.spring(bottomExpand, {
      toValue: isExpanded ? 0 : 80,
      friction: 7,
      useNativeDriver: false,
    }).start();
    setIsExpanded(!isExpanded);
  };

  const handleIconPress = (type) => {
    Animated.timing(bottomExpand, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
    setIsExpanded(false);

    switch (type) {
      case "Assignment":
        showToast("Opening Assignment Summary...");
        setAssignmentVisible(true);
        break;
      case "Class Test":
        showToast("Opening Class Test Summary...");
        setClassTestVisible(true);
        break;
      case "Community":
        showToast("Opening Community Announcements...");
        setCommunityVisible(true);
        break;
    }
  };

  return (
    <View style={styles.headerContainer}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      <LinearGradient colors={colors.primaryGradient || ["#4338CA", "#6366F1"]} style={styles.gradientHeader}>
        {/* Header Content */}
        <View style={styles.headerContent}>
          <View style={styles.brandingSection}>
            <TouchableOpacity onPress={handleAppIconPress} activeOpacity={0.8} style={styles.titleRow}>
              <Text style={styles.appIconName}>EduNex</Text>
              <View style={[styles.roleBadge, { backgroundColor: "rgba(13, 148, 136, 0.25)" }]}>
                <View style={[styles.onlineDot, { backgroundColor: "#14B8A6" }]} />
                <Text style={styles.roleBadgeText}>FACULTY PORTAL</Text>
              </View>
            </TouchableOpacity>

            <Text style={styles.title}>Faculty & Staff Hub</Text>
            <Text style={styles.subtitle}>Empowering Teaching Excellence</Text>
          </View>

          {/* Right Action Icons */}
          <View style={styles.iconGroup}>
            <TouchableOpacity
              onPress={() => {
                showToast("Opening Class Group Messages...");
                setClassGroupMsgVisible(true);
              }}
              style={styles.actionBtn}
              activeOpacity={0.7}
            >
              <Icon name="message-text-outline" size={24} color="#FFFFFF" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuIcon} onPress={handleMenuPress} activeOpacity={0.8}>
              <Icon name={isExpanded ? "chevron-up" : "dots-vertical"} size={26} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Expandable Quick Actions */}
        <Animated.View style={[styles.expandArea, { height: bottomExpand }]}>
          {isExpanded && (
            <View style={styles.quickActionsRow}>
              <TouchableOpacity
                style={styles.quickActionItem}
                onPress={() => handleIconPress("Assignment")}
                activeOpacity={0.8}
              >
                <View style={styles.quickActionIcon}>
                  <Icon name="file-document-edit-outline" size={22} color="#FFFFFF" />
                </View>
                <Text style={styles.quickActionLabel}>Assignments</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickActionItem}
                onPress={() => handleIconPress("Class Test")}
                activeOpacity={0.8}
              >
                <View style={styles.quickActionIcon}>
                  <Icon name="clipboard-text-outline" size={22} color="#FFFFFF" />
                </View>
                <Text style={styles.quickActionLabel}>Class Tests</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickActionItem}
                onPress={() => handleIconPress("Community")}
                activeOpacity={0.8}
              >
                <View style={styles.quickActionIcon}>
                  <Icon name="account-group-outline" size={22} color="#FFFFFF" />
                </View>
                <Text style={styles.quickActionLabel}>Community</Text>
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>
      </LinearGradient>

      {/* Modals */}
      <AssignmentModal
        visible={assignmentVisible}
        onClose={() => setAssignmentVisible(false)}
        colors={colors}
      />

      <ClassTestModal
        visible={classTestVisible}
        onClose={() => setClassTestVisible(false)}
        colors={colors}
      />

      <CommunityModal
        visible={communityVisible}
        onClose={() => setCommunityVisible(false)}
        colors={colors}
      />

      <ClassGroupMsgModal
        visible={classGroupMsgVisible}
        onClose={() => setClassGroupMsgVisible(false)}
        colors={colors}
      />

      {/* Toast */}
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
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 12,
      gap: 5,
    },
    onlineDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
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
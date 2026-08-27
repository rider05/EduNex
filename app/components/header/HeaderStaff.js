import React, { useState, useRef, useEffect } from "react";
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
import { showToast } from "../../utils/toastService";
import { resolveIdentity } from "../../services/identityService";

export default function HeaderStaff() {
  const { colors, isDarkMode } = useTheme();
  const styles = getStyles(colors, isDarkMode);

  const [isExpanded, setIsExpanded] = useState(false);
  const [activeModal, setActiveModal] = useState(null);
  const [userLabel, setUserLabel] = useState("");

  const bottomExpand = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    (async () => {
      try {
        const id = await resolveIdentity();
        if (id?.staff?.name) {
          const parts = [id.staff.name];
          if (id.staff.designation) parts.push(id.staff.designation);
          setUserLabel(parts.join(" · "));
        }
      } catch (e) { /* silent */ }
    })();
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
        colors={colors.primaryGradient || ["#0D9488", "#059669"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientHeader}
      >
        {/* Header Top Row */}
        <View style={styles.headerContent}>
          <View style={styles.brandingSection}>
            <TouchableOpacity
              onPress={() => showToast("👋 Welcome, Professor!", "info")}
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

          {/* Right Action Icons */}
          <View style={styles.iconGroup}>
            <TouchableOpacity
              onPress={() => handleIconPress("broadcast")}
              style={styles.actionBtn}
              activeOpacity={0.7}
            >
              <Icon name="bullhorn-outline" size={22} color="#FFFFFF" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleIconPress("community")}
              style={styles.actionBtn}
              activeOpacity={0.7}
            >
              <Icon name="account-group-outline" size={22} color="#FFFFFF" />
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
                onPress={() => handleIconPress("classtest")}
                activeOpacity={0.8}
              >
                <View style={styles.quickActionIcon}>
                  <Icon name="clipboard-text-clock" size={20} color="#FFFFFF" />
                </View>
                <Text style={styles.quickActionLabel}>CIA Reports</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickActionItem}
                onPress={() => handleIconPress("broadcast")}
                activeOpacity={0.8}
              >
                <View style={styles.quickActionIcon}>
                  <Icon name="message-broadcast" size={20} color="#FFFFFF" />
                </View>
                <Text style={styles.quickActionLabel}>Broadcast</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickActionItem}
                onPress={() => handleIconPress("community")}
                activeOpacity={0.8}
              >
                <View style={styles.quickActionIcon}>
                  <Icon name="domain" size={20} color="#FFFFFF" />
                </View>
                <Text style={styles.quickActionLabel}>Dept Forum</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickActionItem}
                onPress={() => handleIconPress("assignment")}
                activeOpacity={0.8}
              >
                <View style={styles.quickActionIcon}>
                  <Icon name="file-document-edit-outline" size={20} color="#FFFFFF" />
                </View>
                <Text style={styles.quickActionLabel}>Assignments</Text>
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>
      </LinearGradient>

      {/* Header Modals */}
      <ClassTestModal visible={activeModal === "classtest"} onClose={closeModal} />
      <ClassGroupMsgModal visible={activeModal === "broadcast"} onClose={closeModal} />
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
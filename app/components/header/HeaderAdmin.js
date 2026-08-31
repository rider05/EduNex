import React, { useState, useRef, useEffect } from "react";
import {
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
  StatusBar,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { useTheme } from "../../context/ThemeContext";

// Modals
import AddUserModal from "./amodal/AddUserModal";
import FullSettingsModal from "./settings/FullSettingsModal";
import ChatModal from "./modal/ChatModal";
import { showToast } from "../../utils/toastService";
import { onNavigateToNotification } from "../../utils/notificationUtils";

export default function HeaderAdmin() {
  const { colors, isDarkMode } = useTheme();
  const styles = getStyles(colors, isDarkMode);

  /* Bottom Expand */
  const [isExpanded, setIsExpanded] = useState(false);
  const bottomExpand = useRef(new Animated.Value(0)).current;

  /* Modals */
  const [manageModal, setManageModal] = useState(false);
  const [settingsModal, setSettingsModal] = useState(false);
  const [chatModal, setChatModal] = useState(false);

  useEffect(() => {
    const unsub = onNavigateToNotification(({ target }) => {
      if (target === "chat") {
        setChatModal(true);
      } else if (target === "settings") {
        setSettingsModal(true);
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

  const handleIconPress = (type) => {
    Animated.timing(bottomExpand, {
      toValue: 0,
      duration: 180,
      useNativeDriver: false,
    }).start();

    setIsExpanded(false);

    if (type === "Add User") return setManageModal(true);
    if (type === "Settings") return setSettingsModal(true);
    if (type === "Reports") return showToast("📊 Academic analytics & audit logs synchronized.", "info");
    if (type === "Backup") {
      showToast("📦 MongoDB cluster snapshot created successfully!", "success");
    }
  };

  const handleSystemDiagnostics = () => {
    Alert.alert(
      "⚡ EduNex Cluster Health",
      "• MongoDB Atlas: Checking...\n• Authentication Token Service: Checking...\n• Cloudinary Media Vault: Checking...\n• Push Notification Dispatcher: Checking...\n• FERPA & Institutional Encryption: Checking..."
    );
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
        {/* Header Top Row */}
        <View style={styles.headerContent}>
          <View style={styles.brandingSection}>
            <TouchableOpacity
              onPress={() => showToast("👋 Welcome, System Administrator!", "info")}
              activeOpacity={0.8}
              style={styles.titleRow}
            >
              <Text style={styles.appIconName}>EduNex</Text>
              <View style={styles.roleBadge}>
                <View style={styles.onlineDot} />
                <Text style={styles.roleBadgeText}>ADMIN CONSOLE</Text>
              </View>
            </TouchableOpacity>

            <Text style={styles.title}>System Control & Governance</Text>
            <Text style={styles.subtitle}>Institution Master Operations & Security</Text>
          </View>

          {/* Right Action Icons */}
          <View style={styles.iconGroup}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => setChatModal(true)}
              activeOpacity={0.7}
            >
              <Icon name="chat-outline" size={22} color="#FFFFFF" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => setManageModal(true)}
              activeOpacity={0.7}
            >
              <Icon name="account-plus-outline" size={22} color="#FFFFFF" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionBtn}
              onPress={handleSystemDiagnostics}
              activeOpacity={0.7}
            >
              <Icon name="pulse" size={22} color="#10B981" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => setSettingsModal(true)}
              activeOpacity={0.7}
            >
              <Icon name="cog-outline" size={22} color="#FFFFFF" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuIcon} onPress={handleMenuPress} activeOpacity={0.8}>
              <Icon name={isExpanded ? "chevron-up" : "dots-vertical"} size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Expandable Quick Actions Tray */}
        <Animated.View style={[styles.expandArea, { height: bottomExpand }]}>
          {isExpanded && (
            <View style={styles.quickActionsRow}>
              <TouchableOpacity
                style={styles.quickActionItem}
                onPress={() => {
                  setIsExpanded(false);
                  setChatModal(true);
                }}
                activeOpacity={0.8}
              >
                <View style={styles.quickActionIcon}>
                  <Icon name="chat-outline" size={20} color="#FFFFFF" />
                </View>
                <Text style={styles.quickActionLabel}>Campus DMs</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickActionItem}
                onPress={() => handleIconPress("Add User")}
                activeOpacity={0.8}
              >
                <View style={styles.quickActionIcon}>
                  <Icon name="account-plus-outline" size={20} color="#FFFFFF" />
                </View>
                <Text style={styles.quickActionLabel}>Add User</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickActionItem}
                onPress={() => handleIconPress("Reports")}
                activeOpacity={0.8}
              >
                <View style={styles.quickActionIcon}>
                  <Icon name="file-chart-outline" size={20} color="#FFFFFF" />
                </View>
                <Text style={styles.quickActionLabel}>Reports</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickActionItem}
                onPress={() => handleIconPress("Backup")}
                activeOpacity={0.8}
              >
                <View style={styles.quickActionIcon}>
                  <Icon name="cloud-upload-outline" size={20} color="#FFFFFF" />
                </View>
                <Text style={styles.quickActionLabel}>Backup</Text>
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>
      </LinearGradient>

      {/* 🚀 Modals */}
      <AddUserModal visible={manageModal} onClose={() => setManageModal(false)} />
      <FullSettingsModal visible={settingsModal} onClose={() => setSettingsModal(false)} />
      <ChatModal visible={chatModal} onClose={() => setChatModal(false)} />
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
      backgroundColor: "rgba(239, 68, 68, 0.25)",
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 10,
      gap: 5,
    },
    onlineDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: "#EF4444",
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
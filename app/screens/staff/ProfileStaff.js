import React, { useState, useEffect, useCallback } from "react";
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Modal,
  Pressable,
  RefreshControl,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { useTheme } from "../../context/ThemeContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { showToast } from "../../utils/toastService";
import { SkeletonProfileCard, SkeletonListItem } from "../../components/common/SkeletonLoader";
import useRefreshOnForeground from "../../hooks/useRefreshOnForeground";
import { getFacultyData } from "../../services/dataService";
import { clearAuthSession } from "../../services/api";

const DEFAULT_STAFF_DATA = {
  name: "",
  id: "",
  department: "",
  email: "",
  phone: "",
  designation: "",
  address: "",
};

export default function ProfileStaff({ onLogout }) {
  const { colors, isDarkMode, toggleTheme } = useTheme();
  const styles = getStyles(colors);

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [logoutVisible, setLogoutVisible] = useState(false);
  const [staffData, setStaffData] = useState(DEFAULT_STAFF_DATA);

  const loadPreferences = useCallback(async () => {
    try {
      const savedPref = await AsyncStorage.getItem("staffNotifications");
      if (savedPref !== null) {
        setNotifications(JSON.parse(savedPref));
      }

      const faculty = await getFacultyData();
      if (faculty) {
        setStaffData({
          name: faculty.name || "",
          id: faculty.staffId || faculty.id || "",
          department: faculty.department || "",
          email: faculty.email || "",
          phone: faculty.phone || faculty.mobile || "",
          designation: faculty.designation || faculty.role || "",
          address: faculty.address || "",
        });
      }
    } catch (error) {
      console.log("Error loading staff profile data:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load saved notification preference
  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  // Refresh profile data when the app returns to the foreground
  useRefreshOnForeground(loadPreferences);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadPreferences();
    setTimeout(() => {
      setRefreshing(false);
    }, 600);
  }, [loadPreferences]);

  // Toggle and store preference
  const toggleNotifications = async () => {
    const newValue = !notifications;
    setNotifications(newValue);
    try {
      await AsyncStorage.setItem("staffNotifications", JSON.stringify(newValue));
      showToast(
        newValue ? "Notifications enabled successfully." : "Notifications disabled.",
        newValue ? "success" : "warning"
      );
    } catch (error) {
      console.log("Error saving staff notification preference:", error);
      showToast("Failed to update notification settings.", "error");
    }
  };

  // Logout handler
  const handleLogout = async () => {
    try {
      await clearAuthSession();
      showToast("You have been logged out.", "warning");
      if (onLogout) onLogout();
    } catch (error) {
      console.error("Logout error:", error);
      showToast("Something went wrong while logging out.", "error");
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 150 }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={[colors.primary]}
          tintColor={colors.primary}
          progressBackgroundColor={colors.cardBackground}
        />
      }
    >
      {isLoading ? (
        <View style={{ marginTop: 10 }}>
          <SkeletonProfileCard />
          <SkeletonListItem />
          <SkeletonListItem />
        </View>
      ) : (
        <>
          {/* Profile Header Card */}
          <View style={[styles.profileHeader, { backgroundColor: colors.cardBackground }]}>
            <Icon name="account-tie" size={90} color={colors.primaryAccent} />
            <Text style={styles.name}>{staffData.name}</Text>
            <Text style={styles.designation}>{staffData.designation}</Text>
            <View style={styles.divider} />
            <Text style={styles.department}>{staffData.department}</Text>
            <Text style={styles.staffId}>Staff ID: {staffData.id}</Text>
          </View>

          {/* Contact Information */}
          <Text style={styles.sectionTitle}>Contact Information</Text>
          <View style={styles.infoCard}>
            <InfoRow icon="email-outline" text={staffData.email} color={colors.primaryAccent} />
            <InfoRow icon="phone-outline" text={staffData.phone} color={colors.primaryAccent} />
            <InfoRow icon="map-marker-outline" text={staffData.address} color={colors.primaryAccent} />
          </View>

          {/* Preferences */}
          <Text style={styles.sectionTitle}>App Preferences</Text>
          <View style={styles.settingsCard}>
            <SettingsRow
              icon="bell-outline"
              label="Notifications"
              value={notifications}
              onValueChange={toggleNotifications}
              colors={colors}
            />
            <SettingsRow
              icon="theme-light-dark"
              label="Dark Mode"
              value={isDarkMode}
              onValueChange={toggleTheme}
              colors={colors}
            />
          </View>

          {/* Logout Button */}
          <TouchableOpacity
            style={[styles.logoutBtn, { backgroundColor: "#E74C3C" }]}
            onPress={() => setLogoutVisible(true)}
          >
            <Icon name="logout" size={20} color="#fff" />
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>
        </>
      )}

      {/* Bottom Spacing */}
      <View style={{ height: 80 }} />

      {/* 🚪 Logout Confirmation Bottom Popup */}
      <Modal visible={logoutVisible} transparent animationType="slide">
        <View style={styles.bottomOverlay}>
          <View style={[styles.bottomSheet, { backgroundColor: colors.cardBackground }]}>
            <Icon name="alert-circle-outline" size={50} color="#E74C3C" />
            <Text style={[styles.popupTitle, { color: colors.primaryText }]}>
              Confirm Logout
            </Text>
            <Text style={[styles.popupMessage, { color: colors.secondaryText }]}>
              Are you sure you want to log out of your account?
            </Text>

            <View style={styles.popupButtons}>
              <Pressable
                onPress={() => setLogoutVisible(false)}
                style={[styles.cancelBtn, { backgroundColor: colors.primaryAccent }]}
              >
                <Text style={styles.popupBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setLogoutVisible(false);
                  handleLogout();
                }}
                style={[styles.logoutConfirmBtn, { backgroundColor: "#E74C3C" }]}
              >
                <Text style={styles.popupBtnText}>Logout</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

// ✅ Reusable Components
const InfoRow = ({ icon, text, color }) => (
  <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
    <Icon name={icon} size={20} color={color} />
    <Text style={{ fontSize: 15, marginLeft: 10, color: "#555" }}>{text}</Text>
  </View>
);

const SettingsRow = ({ icon, label, value, onValueChange, colors }) => (
  <View style={stylesSetting(colors).settingsRow}>
    <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
      <Icon name={icon} size={20} color={colors.primaryText} />
      <Text style={[stylesSetting(colors).settingsLabel, { color: colors.primaryText }]}>
        {label}
      </Text>
    </View>
    <Switch
      value={value}
      onValueChange={onValueChange}
      trackColor={{ false: colors.disabledText, true: colors.primaryAccent }}
      thumbColor={colors.cardBackground}
    />
  </View>
);

const getStyles = (colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.primaryBackground,
      paddingHorizontal: 20,
      paddingTop: 80,
    },
    profileHeader: {
      alignItems: "center",
      borderRadius: 18,
      padding: 25,
      marginBottom: 25,
      borderTopWidth: 4,
      borderTopColor: colors.primaryAccent,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 4,
    },
    name: { fontSize: 22, fontWeight: "800", color: colors.primaryText, marginTop: 10 },
    designation: { fontSize: 16, color: colors.secondaryText, marginBottom: 4 },
    department: { fontSize: 15, color: colors.secondaryText },
    staffId: { fontSize: 13, color: colors.disabledText, marginTop: 5 },
    divider: {
      width: "60%",
      height: 1,
      backgroundColor: colors.primaryAccent + "40",
      marginVertical: 8,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.primaryText,
      marginBottom: 10,
    },
    infoCard: {
      backgroundColor: colors.cardBackground,
      borderRadius: 12,
      padding: 15,
      marginBottom: 20,
      elevation: 2,
    },
    settingsCard: {
      backgroundColor: colors.cardBackground,
      borderRadius: 12,
      padding: 15,
      marginBottom: 25,
      elevation: 2,
    },
    logoutBtn: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      paddingVertical: 14,
      borderRadius: 12,
      elevation: 3,
      marginBottom: 40,
    },
    logoutText: { color: "#fff", fontSize: 16, fontWeight: "700", marginLeft: 8 },
    bottomOverlay: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: "rgba(0,0,0,0.5)",
    },
    bottomSheet: {
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 25,
      alignItems: "center",
      elevation: 10,
    },
    popupTitle: { fontSize: 20, fontWeight: "800", marginTop: 8 },
    popupMessage: {
      fontSize: 15,
      textAlign: "center",
      marginVertical: 10,
      lineHeight: 22,
      paddingHorizontal: 10,
    },
    popupButtons: {
      flexDirection: "row",
      justifyContent: "space-between",
      width: "100%",
      marginTop: 15,
      gap: 10,
    },
    cancelBtn: {
      flex: 1,
      alignItems: "center",
      paddingVertical: 10,
      borderRadius: 10,
    },
    logoutConfirmBtn: {
      flex: 1,
      alignItems: "center",
      paddingVertical: 10,
      borderRadius: 10,
    },
    popupBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  });

const stylesSetting = (colors) =>
  StyleSheet.create({
    settingsRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 15,
    },
    settingsLabel: { flex: 1, fontSize: 16, marginLeft: 10 },
  });
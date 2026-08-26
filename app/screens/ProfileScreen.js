import React, { useState } from "react";
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Switch,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { useTheme } from "../context/ThemeContext"; // your theme context
import Toast from "react-native-toast-message"; // for toast messages

const USER_DATA = {
  name: "Jane Doe",
  id: "S2025043",
  email: "jane.doe@campus.edu",
  phone: "+91 98765 43210",
  program: "B.Sc. Computer Science",
  address: "123 University Quarters, Cityville",
};

const getProfileStyles = (colors) =>
  StyleSheet.create({
    outerContainer: { flex: 1, backgroundColor: colors.primaryBackground },
    scrollContent: { paddingHorizontal: 15, paddingVertical: 20 },
    headerTitle: {
      fontSize: 28,
      fontWeight: "800",
      color: colors.primaryAccent,
      marginBottom: 25,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.primaryText,
      marginBottom: 10,
      marginTop: 20,
    },
    profileCard: {
      backgroundColor: colors.cardBackground,
      borderRadius: 12,
      padding: 20,
      alignItems: "center",
      marginBottom: 15,
      borderTopWidth: 5,
      borderTopColor: colors.primaryAccent,
      shadowColor: colors.primaryText,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 5,
      elevation: 6,
    },
    avatarPlaceholder: { marginBottom: 10 },
    userName: {
      fontSize: 24,
      fontWeight: "900",
      color: colors.primaryText,
      marginTop: 5,
    },
    userProgram: {
      fontSize: 16,
      color: colors.secondaryText,
      marginTop: 2,
    },
    userId: {
      fontSize: 14,
      color: colors.disabledText,
      marginBottom: 15,
    },
    editButton: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.primaryAccent,
      paddingVertical: 8,
      paddingHorizontal: 15,
      borderRadius: 8,
    },
    editButtonText: {
      color: colors.cardBackground,
      fontWeight: "600",
      marginLeft: 8,
      fontSize: 15,
    },
    infoCard: {
      backgroundColor: colors.cardBackground,
      borderRadius: 12,
      paddingHorizontal: 15,
      paddingVertical: 10,
      shadowColor: colors.primaryText,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2,
    },
    infoRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    infoIcon: { marginRight: 15 },
    infoTextContainer: {
      flex: 1,
      flexDirection: "column",
      justifyContent: "center",
    },
    infoLabel: { fontSize: 12, color: colors.disabledText, marginBottom: 2 },
    infoValue: {
      fontSize: 16,
      color: colors.primaryText,
      fontWeight: "500",
    },
    settingsCard: {
      backgroundColor: colors.cardBackground,
      borderRadius: 12,
      paddingHorizontal: 15,
      paddingVertical: 10,
      shadowColor: colors.primaryText,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2,
    },
    settingsRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
      justifyContent: "space-between",
    },
    settingsIcon: {
      marginRight: 15,
      color: colors.primaryText,
    },
    settingsLabel: {
      flex: 1,
      fontSize: 16,
      color: colors.primaryText,
      fontWeight: "500",
    },
    linkRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 12,
    },
    linkText: {
      fontSize: 16,
      color: colors.link,
      fontWeight: "500",
    },
    logoutButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.logoutButtonBg || "#E53935",
      paddingVertical: 15,
      borderRadius: 10,
      marginTop: 30,
      shadowColor: colors.logoutButtonBg || "#E53935",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.5,
      shadowRadius: 5,
      elevation: 6,
    },
    logoutButtonText: {
      color: colors.cardBackground,
      fontSize: 18,
      fontWeight: "bold",
      marginLeft: 10,
    },
  });

export default function ProfileScreen() {
  const [isNotificationsEnabled, setIsNotificationsEnabled] = useState(false);
  const { colors, isDarkMode, toggleTheme } = useTheme();
  const styles = getProfileStyles(colors);

  // Toggle notifications preference
  const toggleNotifications = () => {
    const nextState = !isNotificationsEnabled;
    setIsNotificationsEnabled(nextState);
    Toast.show({
      type: nextState ? "success" : "info",
      text1: nextState ? "Notifications Enabled" : "Notifications Disabled",
      text2: nextState
        ? "You will receive real-time campus updates & reminders."
        : "In-app notifications have been muted.",
      position: "bottom",
    });
  };

  const handleEditProfile = () => {
    // your navigation or logic
    console.log("Navigate to edit profile");
  };

  const handleLogout = () => {
    // logout logic
    console.log("User logged out");
  };

  return (
    <ScrollView style={styles.outerContainer} contentContainerStyle={styles.scrollContent}>
      <Text style={styles.headerTitle}>My Profile & Settings</Text>

      {/* Profile Info */}
      <View style={styles.profileCard}>
        <Icon name="account-circle" size={80} color={colors.avatarPlaceholder || "#888"} />
        <Text style={styles.userName}>{USER_DATA.name}</Text>
        <Text style={styles.userProgram}>{USER_DATA.program}</Text>
        <Text style={styles.userId}>ID: {USER_DATA.id}</Text>
        <TouchableOpacity style={styles.editButton} onPress={handleEditProfile}>
          <Icon name="pencil" size={18} color={colors.cardBackground} />
          <Text style={styles.editButtonText}>Edit Details</Text>
        </TouchableOpacity>
      </View>

      {/* Contact Info */}
      <Text style={styles.sectionTitle}>Contact Information</Text>
      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <Icon name="email-outline" size={20} color={colors.emailIcon || "#3366FF"} style={styles.infoIcon} />
          <View style={styles.infoTextContainer}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{USER_DATA.email}</Text>
          </View>
        </View>
        <View style={styles.infoRow}>
          <Icon name="phone-outline" size={20} color={colors.phoneIcon || "#2ECC71"} style={styles.infoIcon} />
          <View style={styles.infoTextContainer}>
            <Text style={styles.infoLabel}>Phone</Text>
            <Text style={styles.infoValue}>{USER_DATA.phone}</Text>
          </View>
        </View>
        <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
          <Icon name="map-marker-outline" size={20} color={colors.addressIcon || "#F39C12"} style={styles.infoIcon} />
          <View style={styles.infoTextContainer}>
            <Text style={styles.infoLabel}>Address</Text>
            <Text style={styles.infoValue}>{USER_DATA.address}</Text>
          </View>
        </View>
      </View>

      {/* App Preferences */}
      <Text style={styles.sectionTitle}>App Preferences</Text>
      <View style={styles.settingsCard}>
        <View style={styles.settingsRow}>
          <Icon name="bell-outline" size={20} style={styles.settingsIcon} />
          <Text style={styles.settingsLabel}>Notifications</Text>
          <Switch
            trackColor={{ false: colors.disabledText, true: colors.activeSwitchTrack || "#3366FF" }}
            thumbColor={isNotificationsEnabled ? colors.cardBackground : colors.divider}
            onValueChange={toggleNotifications}
            value={isNotificationsEnabled}
          />
        </View>
        <View style={styles.settingsRow}>
          <Icon name="theme-light-dark" size={20} style={styles.settingsIcon} />
          <Text style={styles.settingsLabel}>Dark Mode</Text>
          <Switch
            trackColor={{ false: colors.disabledText, true: colors.activeSwitchTrack || "#3366FF" }}
            thumbColor={isDarkMode ? colors.cardBackground : colors.divider}
            onValueChange={toggleTheme}
            value={isDarkMode}
          />
        </View>
        <TouchableOpacity style={styles.linkRow} onPress={() => console.log("Change password")}>
          <Icon name="lock-outline" size={20} style={styles.settingsIcon} />
          <Text style={styles.linkText}>Change Password</Text>
        </TouchableOpacity>
      </View>

      {/* Logout Button */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Icon name="logout" size={20} color={colors.cardBackground} />
        <Text style={styles.logoutButtonText}>Log Out</Text>
      </TouchableOpacity>
      
      <View style={{ height: 90 }} />
    </ScrollView>
  );
}
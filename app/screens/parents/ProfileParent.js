import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Pressable,
  Switch,
  RefreshControl,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "../../context/ThemeContext";
import { showToast } from "../../utils/toastService";
import { SkeletonProfileCard, SkeletonListItem } from "../../components/common/SkeletonLoader";
import { clearAuthSession } from "../../services/api";
import { getParentData } from "../../services/dataService";
import useRefreshOnForeground from "../../hooks/useRefreshOnForeground";

const DEFAULT_PARENT_DATA = {
  name: "",
  relation: "",
  phone: "",
  email: "",
  address: "",
  ward: {
    name: "",
    class: "",
    attendance: "",
    feeStatus: "",
    rollNo: "",
    dob: "",
    bloodGroup: "",
    guardianContact: "",
    address: "",
  },
};

export default function ProfileParent({ onLogout }) {
  const { colors, isDarkMode, toggleTheme } = useTheme();
  const styles = getStyles(colors);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [logoutVisible, setLogoutVisible] = useState(false);
  const [studentModalVisible, setStudentModalVisible] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [parentData, setParentData] = useState(DEFAULT_PARENT_DATA);

  const loadPreferences = useCallback(async () => {
    try {
      const savedPref = await AsyncStorage.getItem("parentNotifications");
      if (savedPref !== null) {
        setNotifications(JSON.parse(savedPref));
      }

      // Live parent + ward data (REST with local sync fallback)
      let next = { ...DEFAULT_PARENT_DATA, ward: { ...DEFAULT_PARENT_DATA.ward } };
      try {
        const storedUserRaw = await AsyncStorage.getItem("userData");
        const storedUser = storedUserRaw ? JSON.parse(storedUserRaw) : null;
        if (storedUser) {
          next = {
            ...next,
            name: storedUser.profile?.name || storedUser.name || storedUser.username || next.name,
            email: storedUser.email || next.email,
            phone: storedUser.mobile || storedUser.phone || next.phone,
          };
        }

        const data = await getParentData();
        if (data) {
          const ward = data.ward || {};
          const parentDoc = data;
          next = {
            ...next,
            name: parentDoc.name || next.name,
            email: parentDoc.email || next.email,
            phone: parentDoc.mobile || parentDoc.phone || next.phone,
            address: parentDoc.address || next.address,
            relation:
              ward.rollNo || ward.roll
                ? `Parent of ${ward.name || "ward"} (${ward.rollNo || ward.roll})`
                : parentDoc.relation || next.relation,
            ward: {
              ...next.ward,
              name: ward.name || next.ward.name,
              class: [ward.department, ward.year, ward.section].filter(Boolean).join(" - ") || next.ward.class,
              attendance: ward.attendance?.percentage || (ward.attendance ? String(ward.attendance) : "") || next.ward.attendance,
              feeStatus:
                ward.fees?.due != null
                  ? `Due ₹${Number(ward.fees.due).toLocaleString("en-IN")}`
                  : next.ward.feeStatus,
              rollNo: ward.roll || ward.rollNo || next.ward.rollNo,
              dob: ward.dob || next.ward.dob,
              bloodGroup: ward.bloodGroup || next.ward.bloodGroup,
              guardianContact: ward.parent?.phone || next.ward.guardianContact,
              address: ward.parent?.address || ward.address || next.ward.address,
            },
          };
        }
      } catch (apiErr) {
        console.warn("ProfileParent live load error:", apiErr?.message || apiErr);
      }
      setParentData(next);
    } catch (error) {
      console.log("Error loading parent notification preference:", error);
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
      await AsyncStorage.setItem("parentNotifications", JSON.stringify(newValue));
      showToast(
        newValue ? "Notifications enabled successfully." : "Notifications disabled.",
        newValue ? "success" : "warning"
      );
    } catch (error) {
      console.log("Error saving parent notification preference:", error);
    }
  };

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
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
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
          <>
            <SkeletonProfileCard />
            <SkeletonListItem />
            <SkeletonListItem />
          </>
        ) : (
          <>
            {/* Parent Info */}
            <View style={styles.profileCard}>
              <View style={styles.avatarCircle}>
                <Icon name="account-tie" size={60} color="#FFF" />
              </View>
              <Text style={styles.parentName}>{parentData.name}</Text>
              <Text style={styles.relation}>{parentData.relation}</Text>
            </View>

            {/* Contact Info */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Contact Information</Text>
              <View style={styles.infoRow}>
                <Icon name="email-outline" size={22} color={colors.primaryAccent} />
                <Text style={styles.infoText}>{parentData.email}</Text>
              </View>
              <View style={styles.infoRow}>
                <Icon name="phone-outline" size={22} color={colors.primaryAccent} />
                <Text style={styles.infoText}>{parentData.phone}</Text>
              </View>
              <View style={styles.infoRow}>
                <Icon name="map-marker-outline" size={22} color={colors.primaryAccent} />
                <Text style={styles.infoText}>{parentData.address}</Text>
              </View>
            </View>

            {/* Ward Info */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Ward Information</Text>

              <View style={styles.wardRow}>
                <Text style={styles.wardLabel}>Name</Text>
                <Text style={styles.wardValue}>{parentData.ward.name}</Text>
              </View>
              <View style={styles.wardRow}>
                <Text style={styles.wardLabel}>Class</Text>
                <Text style={styles.wardValue}>{parentData.ward.class}</Text>
              </View>
              <View style={styles.wardRow}>
                <Text style={styles.wardLabel}>Attendance</Text>
                <Text style={[styles.wardValue, { color: colors.successText }]}>
                  {parentData.ward.attendance}
                </Text>
              </View>
              <View style={styles.wardRow}>
                <Text style={styles.wardLabel}>Fee Status</Text>
                <Text style={[styles.wardValue, { color: colors.warningText }]}>
                  {parentData.ward.feeStatus}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.viewDetailsBtn}
                activeOpacity={0.8}
                onPress={() => setStudentModalVisible(true)}
              >
                <Text style={styles.viewDetailsText}>View Complete Ward Details</Text>
                <Icon name="chevron-right" size={20} color={colors.primaryAccent} />
              </TouchableOpacity>
            </View>

            {/* Settings & Preferences */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Preferences & System</Text>

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Enable Notifications</Text>
                <Switch
                  value={notifications}
                  onValueChange={toggleNotifications}
                  trackColor={{ false: colors.border, true: colors.primaryAccent }}
                  thumbColor={notifications ? colors.surface : colors.surface}
                />
              </View>

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Dark Mode</Text>
                <Switch
                  value={isDarkMode}
                  onValueChange={toggleTheme}
                  trackColor={{ false: colors.border, true: colors.primaryAccent }}
                  thumbColor={isDarkMode ? colors.surface : colors.surface}
                />
              </View>

              <TouchableOpacity
                style={styles.logoutBtn}
                activeOpacity={0.8}
                onPress={() => setLogoutVisible(true)}
              >
                <Icon name="logout" size={20} color={colors.error} />
                <Text style={styles.logoutText}>Logout</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>

      {/* Student Details Modal */}
      <Modal visible={studentModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.primaryText }]}>
                Student Profile
              </Text>
              <Pressable onPress={() => setStudentModalVisible(false)}>
                <Icon name="close" size={26} color={colors.secondaryText} />
              </Pressable>
            </View>

            <ScrollView style={{ width: "100%", marginTop: 10 }}>
              {Object.entries(parentData.ward).map(([key, value]) => (
                <View style={styles.studentRow} key={key}>
                  <Text style={styles.studentLabel}>
                    {key.charAt(0).toUpperCase() + key.slice(1)}:
                  </Text>
                  <Text
                    style={[
                      styles.studentValue,
                      key === "attendance"
                        ? { color: colors.successText }
                        : key === "feeStatus"
                        ? { color: colors.warningText }
                        : {},
                    ]}
                  >
                    {value}
                  </Text>
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity
              onPress={() => setStudentModalVisible(false)}
              style={[styles.closeModalBtn, { backgroundColor: colors.primaryAccent }]}
            >
              <Text style={styles.closeModalText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Logout Modal */}
      <Modal visible={logoutVisible} transparent animationType="slide">
        <View style={styles.bottomOverlay}>
          <View style={[styles.bottomSheet, { backgroundColor: colors.cardBackground }]}>
            <Icon name="alert-circle-outline" size={55} color="#E74C3C" />
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
    </>
  );
}

const getStyles = (colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.primaryBackground },
    contentContainer: { padding: 20, paddingBottom: 60 },
    header: { fontSize: 26, fontWeight: "800", color: colors.primaryText, marginBottom: 25 },
    profileCard: {
      backgroundColor: colors.cardBackground,
      borderRadius: 16,
      padding: 25,
      alignItems: "center",
      elevation: 6,
      marginBottom: 25,
    },
    avatarCircle: {
      width: 90, height: 90, borderRadius: 45,
      backgroundColor: colors.primaryAccent,
      justifyContent: "center", alignItems: "center", marginBottom: 15,
    },
    parentName: { fontSize: 22, fontWeight: "800", color: colors.primaryText },
    relation: { fontSize: 15, color: colors.secondaryText, textAlign: "center", marginTop: 5 },
    sectionCard: {
      backgroundColor: colors.cardBackground,
      borderRadius: 16,
      padding: 18,
      marginBottom: 20,
      elevation: 3,
    },
    sectionTitle: { fontSize: 18, fontWeight: "700", color: colors.primaryAccent, marginBottom: 15 },
    infoRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
    infoText: { fontSize: 15, color: colors.primaryText, marginLeft: 10, flexShrink: 1 },
    wardRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
    wardLabel: { fontSize: 15, color: colors.secondaryText, fontWeight: "600" },
    wardValue: { fontSize: 15, color: colors.primaryText, fontWeight: "700" },
    prefRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
      paddingVertical: 10,
    },
    prefLabel: { fontSize: 16, fontWeight: "500", marginLeft: 10 },
    viewDetailsBtn: {
      marginTop: 20,
      backgroundColor: colors.primaryAccent,
      paddingVertical: 12,
      borderRadius: 10,
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
    },
    viewDetailsText: { color: "#FFF", fontSize: 15, fontWeight: "600", marginRight: 5 },
    logoutButton: {
      marginTop: 30,
      backgroundColor: "#E74C3C",
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      borderRadius: 12,
      paddingVertical: 14,
    },
    logoutText: { color: "#FFF", fontSize: 17, fontWeight: "bold", marginLeft: 8 },
    centerOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 25,
    },
    centerCard: {
      width: "100%",
      maxHeight: "80%",
      borderRadius: 20,
      padding: 20,
      elevation: 10,
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 10,
    },
    modalTitle: { fontSize: 20, fontWeight: "800" },
    studentRow: { flexDirection: "row", justifyContent: "space-between", marginVertical: 6 },
    studentLabel: { fontSize: 15, color: colors.secondaryText, fontWeight: "600" },
    studentValue: {
      fontSize: 15,
      color: colors.primaryText,
      fontWeight: "700",
      textAlign: "right",
      flexShrink: 1,
    },
    closeModalBtn: {
      marginTop: 20,
      width: "100%",
      paddingVertical: 12,
      borderRadius: 10,
      alignItems: "center",
    },
    closeModalText: { color: "#fff", fontWeight: "700", fontSize: 16 },
    bottomOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
    bottomSheet: { borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: 25, alignItems: "center" },
    popupTitle: { fontSize: 20, fontWeight: "800", marginTop: 8 },
    popupMessage: { fontSize: 15, textAlign: "center", marginVertical: 10, lineHeight: 22 },
    popupButtons: { flexDirection: "row", justifyContent: "space-between", width: "100%", marginTop: 20, gap: 10 },
    cancelBtn: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 10 },
    logoutConfirmBtn: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 10 },
    popupBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  });
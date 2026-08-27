import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Switch,
  RefreshControl,
  Share,
  Animated,
  Alert,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "../../context/ThemeContext";
import { showToast } from "../../utils/toastService";
import { SkeletonProfileCard, SkeletonListItem } from "../../components/common/SkeletonLoader";
import { clearAuthSession } from "../../services/api";
import { getParentData } from "../../services/dataService";
import useRefreshOnForeground from "../../hooks/useRefreshOnForeground";

const DEFAULT_PARENT_DATA = {};

export default function ProfileParent({ onLogout }) {
  const { colors, isDarkMode, toggleTheme } = useTheme();
  const styles = getStyles(colors, isDarkMode);

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [logoutVisible, setLogoutVisible] = useState(false);
  const [wardModalVisible, setWardModalVisible] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [parentData, setParentData] = useState(DEFAULT_PARENT_DATA);

  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardTranslateY = useRef(new Animated.Value(14)).current;

  const loadPreferences = useCallback(async () => {
    try {
      const savedPref = await AsyncStorage.getItem("parentNotifications");
      if (savedPref !== null) {
        setNotifications(JSON.parse(savedPref));
      }

      const storedUserRaw = await AsyncStorage.getItem("userData");
      const storedUser = storedUserRaw ? JSON.parse(storedUserRaw) : null;

      const data = await getParentData();
      if (data || storedUser) {
        setParentData((prev) => ({
          ...prev,
          name: storedUser?.profile?.name || storedUser?.name || data?.name || prev.name,
          email: storedUser?.email || data?.email || prev.email,
          phone: storedUser?.mobile || data?.mobile || data?.phone || prev.phone,
          address: data?.address || prev.address,
          ward: {
            ...(prev.ward || {}),
            ...(data?.ward || {}),
            name: data?.ward?.name || prev?.ward?.name,
            rollNo: data?.ward?.rollNo || data?.ward?.roll || prev?.ward?.rollNo,
            regNo: data?.ward?.regNo || prev?.ward?.regNo || "",
            class: data?.ward?.class || prev?.ward?.class || "",
            advisor: data?.ward?.advisor || data?.overview?.advisorName || prev?.ward?.advisor || "",
            hostel: data?.ward?.hostel || prev?.ward?.hostel || "—",
            bloodGroup: data?.ward?.bloodGroup || prev?.ward?.bloodGroup || "—",
            attendance: data?.ward?.attendancePct || data?.ward?.attendance?.percentage || prev?.ward?.attendance,
            cgpa: data?.ward?.cgpa ? `${data.ward.cgpa} / 10.0` : prev?.ward?.cgpa,
            feeStatus:
              data?.overview?.feesDue
                ? `Due ${data.overview.feesDue}`
                : prev?.ward?.feeStatus || "Paid",
          },
        }));
      }
    } catch (error) {
      console.log("Error loading parent profile:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPreferences();

    Animated.parallel([
      Animated.timing(cardOpacity, { toValue: 1, duration: 280, useNativeDriver: true }),
      Animated.timing(cardTranslateY, { toValue: 0, duration: 280, useNativeDriver: true }),
    ]).start();
  }, [cardOpacity, cardTranslateY, loadPreferences]);

  useRefreshOnForeground(loadPreferences);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadPreferences();
    setRefreshing(false);
  }, [loadPreferences]);

  const toggleNotifications = async () => {
    const newValue = !notifications;
    setNotifications(newValue);
    try {
      await AsyncStorage.setItem("parentNotifications", JSON.stringify(newValue));
      showToast(
        newValue ? "🔔 Push Notifications Enabled" : "🔕 Notifications Muted",
        newValue ? "success" : "warning"
      );
    } catch (error) {
      console.log("Error saving parent notification preference:", error);
    }
  };

  const handleLogout = async () => {
    try {
      setLogoutVisible(false);
      await clearAuthSession();
      showToast("Logged out successfully.", "info");
      if (onLogout) onLogout();
    } catch (error) {
      console.error("Logout error:", error);
      showToast("Something went wrong while logging out.", "error");
    }
  };

  const handleShareGuardianDossier = async () => {
    try {
      await Share.share({
        title: `Guardian Profile - ${parentData.name}`,
        message: `🛡️ EDUNEX GUARDIAN DOSSIER\nGuardian: ${parentData.name} (${parentData.relation})\nGuardian ID: ${parentData.guardianId || parentData.parentId || parentData.id}\nContact: ${parentData.phone}\nWard: ${parentData.ward.name} (${parentData.ward.rollNo})\nProgram: ${parentData.ward.class}\nStatus: VERIFIED & ACTIVE`,
      });
      showToast("Guardian profile shared!", "success");
    } catch (err) {
      console.log("Share error:", err);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.primaryBackground }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primaryAccent]}
            tintColor={colors.primaryAccent}
            progressBackgroundColor={colors.cardBackground}
          />
        }
      >
        {/* ========================================================================= */}
        {/* 1. HEADER                                                                 */}
        {/* ========================================================================= */}
        <View style={styles.header}>
          <View style={[styles.headerIconWrap, { backgroundColor: colors.primaryAccent + "18" }]}>
            <Icon name="shield-account-outline" size={24} color={colors.primaryAccent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: colors.primaryText }]}>Guardian Profile</Text>
            <Text style={[styles.headerSubtitle, { color: colors.secondaryText }]}>
              Parent Credentials, Ward Dossier & Preferences
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.shareBtnPill, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
            onPress={handleShareGuardianDossier}
            activeOpacity={0.8}
          >
            <Icon name="share-variant-outline" size={16} color={colors.primaryAccent} />
            <Text style={[styles.shareBtnPillText, { color: colors.primaryAccent }]}>Share</Text>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={{ marginTop: 10 }}>
            <SkeletonProfileCard />
            <SkeletonListItem />
            <SkeletonListItem />
          </View>
        ) : (
          <>
            {/* ========================================================================= */}
            {/* 2. GUARDIAN IDENTITY HERO CARD                                            */}
            {/* ========================================================================= */}
            <Animated.View
              style={[
                styles.guardianHeroCard,
                {
                  backgroundColor: colors.cardBackground,
                  borderColor: colors.divider,
                  opacity: cardOpacity,
                  transform: [{ translateY: cardTranslateY }],
                },
              ]}
            >
              <View style={styles.heroTop}>
                <View style={[styles.avatarCircle, { backgroundColor: colors.primaryAccent }]}>
                  <Icon name="account-tie" size={34} color="#FFFFFF" />
                </View>

                <View style={{ flex: 1, marginLeft: 14 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={[styles.parentName, { color: colors.primaryText }]} numberOfLines={1}>
                      {parentData.name}
                    </Text>
                    <View style={styles.verifiedBadge}>
                      <Icon name="check-decagram" size={12} color="#10B981" />
                      <Text style={styles.verifiedBadgeText}>VERIFIED</Text>
                    </View>
                  </View>

                  <Text style={[styles.relationText, { color: colors.primaryAccent }]}>
                    {parentData.relation}
                  </Text>
                  <Text style={[styles.guardianIdText, { color: colors.secondaryText }]}>
                    ID: {parentData.guardianId || parentData.parentId || parentData.id} · {parentData.occupation}
                  </Text>
                </View>
              </View>

              {/* Linked Ward Quick Tile */}
              <TouchableOpacity
                style={[styles.linkedWardBox, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}
                onPress={() => setWardModalVisible(true)}
                activeOpacity={0.8}
              >
                <View style={[styles.miniWardIconCircle, { backgroundColor: "#4F46E518" }]}>
                  <Icon name="school" size={18} color="#4F46E5" />
                </View>

                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.linkedWardLabel, { color: colors.secondaryText }]}>LINKED STUDENT WARD</Text>
                  <Text style={[styles.linkedWardName, { color: colors.primaryText }]}>
                    {parentData.ward.name} ({parentData.ward.rollNo})
                  </Text>
                  <Text style={[styles.linkedWardClass, { color: colors.disabledText }]}>
                    {parentData.ward.class}
                  </Text>
                </View>

                <Icon name="chevron-right" size={20} color={colors.disabledText} />
              </TouchableOpacity>
            </Animated.View>

            {/* ========================================================================= */}
            {/* 3. CONTACT INFORMATION                                                    */}
            {/* ========================================================================= */}
            <View style={[styles.sectionCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
              <View style={styles.sectionHeader}>
                <Icon name="card-text-outline" size={20} color={colors.primaryAccent} />
                <Text style={[styles.sectionTitle, { color: colors.primaryText }]}>Contact Information</Text>
              </View>

              <View style={styles.dataGrid}>
                <DataRow icon="phone-outline" label="Primary Mobile" value={parentData.phone} colors={colors} />
                <DataRow icon="email-outline" label="Email Address" value={parentData.email} colors={colors} />
                <DataRow icon="briefcase-outline" label="Occupation" value={parentData.occupation} colors={colors} />
                <DataRow icon="map-marker-outline" label="Residential Address" value={parentData.address} colors={colors} />
              </View>
            </View>

            {/* ========================================================================= */}
            {/* 4. SECONDARY GUARDIAN & ADVISOR DETAILS                                   */}
            {/* ========================================================================= */}
            <View style={[styles.sectionCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
              <View style={styles.sectionHeader}>
                <Icon name="account-group-outline" size={20} color={colors.primaryAccent} />
                <Text style={[styles.sectionTitle, { color: colors.primaryText }]}>Family & Mentorship Contacts</Text>
              </View>

              <View style={styles.dataGrid}>
                <DataRow icon="account-heart-outline" label="Secondary Guardian" value={parentData.secondaryGuardian} colors={colors} />
                <DataRow icon="phone-outline" label="Secondary Contact" value={parentData.secondaryPhone} colors={colors} />
                <DataRow icon="account-tie-outline" label="Ward Class Counselor" value={parentData.ward.advisor} colors={colors} />
              </View>
            </View>

            {/* ========================================================================= */}
            {/* 5. APP SETTINGS & SECURITY                                                */}
            {/* ========================================================================= */}
            <View style={[styles.sectionCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
              <View style={styles.sectionHeader}>
                <Icon name="cog-outline" size={20} color={colors.primaryAccent} />
                <Text style={[styles.sectionTitle, { color: colors.primaryText }]}>App Settings & Security</Text>
              </View>

              <View style={styles.dataGrid}>
                <PrefRow
                  icon="bell-ring-outline"
                  label="Push Notifications"
                  value={notifications}
                  onToggle={toggleNotifications}
                  colors={colors}
                />
                <PrefRow
                  icon="theme-light-dark"
                  label="Dark Theme Mode"
                  value={isDarkMode}
                  onToggle={toggleTheme}
                  colors={colors}
                />

                <TouchableOpacity
                  style={styles.securityActionRow}
                  onPress={() =>
                    Alert.alert(
                      "🔒 Privacy & E2EE Status",
                      "Parent-Faculty direct communications are end-to-end encrypted under EduNex institutional privacy standards."
                    )
                  }
                  activeOpacity={0.8}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <Icon name="shield-lock-outline" size={20} color="#10B981" />
                    <Text style={[styles.securityActionText, { color: "#10B981" }]}>
                      Academic Privacy Active
                    </Text>
                  </View>
                  <Icon name="check-circle" size={18} color="#10B981" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Logout Button */}
            <TouchableOpacity
              style={styles.logoutBtn}
              onPress={() => setLogoutVisible(true)}
              activeOpacity={0.85}
            >
              <Icon name="logout-variant" size={18} color="#EF4444" />
              <Text style={styles.logoutBtnText}>Log Out of Parent Portal</Text>
            </TouchableOpacity>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ========================================================================= */}
      {/* 6. COMPLETE WARD DETAILS MODAL                                            */}
      {/* ========================================================================= */}
      <Modal visible={wardModalVisible} transparent animationType="fade" onRequestClose={() => setWardModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
            <View style={styles.modalHeaderRow}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={[styles.miniWardIconCircle, { backgroundColor: colors.primaryAccent + "18" }]}>
                  <Icon name="school" size={22} color={colors.primaryAccent} />
                </View>
                <View>
                  <Text style={[styles.modalTitle, { color: colors.primaryText }]}>Ward Academic Dossier</Text>
                  <Text style={[styles.modalSub, { color: colors.secondaryText }]}>{parentData.ward.rollNo}</Text>
                </View>
              </View>

              <TouchableOpacity onPress={() => setWardModalVisible(false)}>
                <Icon name="close-circle-outline" size={24} color={colors.secondaryText} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 360 }}>
              <View style={[styles.wardModalGrid, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                <DataRow icon="account-outline" label="Full Name" value={parentData.ward.name} colors={colors} />
                <DataRow icon="identifier" label="Roll Number" value={parentData.ward.rollNo} colors={colors} />
                <DataRow icon="card-account-details-outline" label="University Reg. No." value={parentData.ward.regNo} colors={colors} />
                <DataRow icon="domain" label="Academic Program" value={parentData.ward.class} colors={colors} />
                <DataRow icon="calendar-check" label="Aggregate Attendance" value={parentData.ward.attendance} colors={colors} />
                <DataRow icon="trophy-outline" label="Cumulative GPA" value={parentData.ward.cgpa} colors={colors} />
                <DataRow icon="cash-multiple" label="Fee Status" value={parentData.ward.feeStatus} colors={colors} />
                <DataRow icon="water-outline" label="Blood Group" value={parentData.ward.bloodGroup} colors={colors} />
                <DataRow icon="home-city-outline" label="Residence" value={parentData.ward.hostel} colors={colors} />
              </View>
            </ScrollView>

            <TouchableOpacity
              style={[styles.closeModalBtn, { backgroundColor: colors.primaryAccent }]}
              onPress={() => setWardModalVisible(false)}
            >
              <Text style={styles.closeModalBtnText}>Close Dossier</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* LOGOUT CONFIRMATION MODAL */}
      <Modal visible={logoutVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.logoutCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
            <Icon name="alert-circle-outline" size={44} color="#EF4444" />
            <Text style={[styles.logoutTitle, { color: colors.primaryText }]}>Confirm Log Out?</Text>
            <Text style={[styles.logoutSub, { color: colors.secondaryText }]}>
              You will need to sign in again to monitor your ward&apos;s academic performance and fee invoices.
            </Text>

            <View style={styles.logoutActionRow}>
              <TouchableOpacity
                style={[styles.cancelLogoutBtn, { borderColor: colors.divider }]}
                onPress={() => setLogoutVisible(false)}
              >
                <Text style={[styles.cancelLogoutText, { color: colors.primaryText }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmLogoutBtn}
                onPress={handleLogout}
              >
                <Text style={styles.confirmLogoutText}>Log Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ---------------- Sub-Components ----------------
function DataRow({ icon, label, value, colors }) {
  return (
    <View style={[stylesSub.dataRow, { borderBottomColor: colors.divider }]}>
      <View style={stylesSub.dataIconWrap}>
        <Icon name={icon} size={17} color={colors.primaryAccent} />
      </View>
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={[stylesSub.dataLabel, { color: colors.secondaryText }]}>{label}</Text>
        <Text style={[stylesSub.dataValue, { color: colors.primaryText }]}>{value || "—"}</Text>
      </View>
    </View>
  );
}

function PrefRow({ icon, label, value, onToggle, colors }) {
  return (
    <View style={[stylesSub.dataRow, { borderBottomColor: colors.divider, justifyContent: "space-between" }]}>
      <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
        <View style={stylesSub.dataIconWrap}>
          <Icon name={icon} size={17} color={colors.primaryAccent} />
        </View>
        <Text style={[stylesSub.prefLabel, { color: colors.primaryText, marginLeft: 10 }]}>{label}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        thumbColor={value ? colors.primaryAccent : "#94A3B8"}
        trackColor={{ false: "#CBD5E1", true: colors.primaryAccent + "55" }}
      />
    </View>
  );
}

const stylesSub = StyleSheet.create({
  dataRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  dataIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: "rgba(100,100,100,0.06)",
    justifyContent: "center",
    alignItems: "center",
  },
  dataLabel: {
    fontSize: 11,
    fontWeight: "600",
  },
  dataValue: {
    fontSize: 13,
    fontWeight: "700",
    marginTop: 1,
  },
  prefLabel: {
    fontSize: 13,
    fontWeight: "700",
  },
});

// ---------------- Styles ----------------
const getStyles = (colors, isDarkMode) =>
  StyleSheet.create({
    container: { flex: 1 },
    scrollView: { flex: 1 },
    contentContainer: { paddingHorizontal: 16, paddingTop: 44, paddingBottom: 80 },

    /* Header */
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginBottom: 16,
    },
    headerIconWrap: {
      width: 42,
      height: 42,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: "800",
      letterSpacing: -0.3,
    },
    headerSubtitle: {
      fontSize: 11.5,
      fontWeight: "500",
      marginTop: 2,
    },
    shareBtnPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 10,
      borderWidth: 1,
    },
    shareBtnPillText: {
      fontSize: 11.5,
      fontWeight: "700",
    },

    /* Guardian Hero Card */
    guardianHeroCard: {
      borderRadius: 20,
      borderWidth: 1,
      padding: 16,
      marginBottom: 14,
      elevation: 3,
      shadowColor: "#000",
      shadowOpacity: 0.08,
      shadowRadius: 8,
    },
    heroTop: {
      flexDirection: "row",
      alignItems: "center",
    },
    avatarCircle: {
      width: 58,
      height: 58,
      borderRadius: 29,
      justifyContent: "center",
      alignItems: "center",
    },
    parentName: {
      fontSize: 16.5,
      fontWeight: "900",
      letterSpacing: -0.2,
      flex: 1,
    },
    verifiedBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      backgroundColor: "#10B98114",
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    verifiedBadgeText: {
      color: "#10B981",
      fontSize: 9,
      fontWeight: "900",
    },
    relationText: {
      fontSize: 12,
      fontWeight: "700",
      marginTop: 2,
    },
    guardianIdText: {
      fontSize: 11,
      fontWeight: "500",
      marginTop: 2,
    },
    linkedWardBox: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 14,
      borderWidth: 1,
      padding: 10,
      marginTop: 14,
    },
    miniWardIconCircle: {
      width: 36,
      height: 36,
      borderRadius: 10,
      justifyContent: "center",
      alignItems: "center",
    },
    linkedWardLabel: {
      fontSize: 9.5,
      fontWeight: "800",
      letterSpacing: 0.5,
    },
    linkedWardName: {
      fontSize: 13,
      fontWeight: "800",
      marginTop: 1,
    },
    linkedWardClass: {
      fontSize: 10.5,
      fontWeight: "500",
    },

    /* Section Cards */
    sectionCard: {
      borderRadius: 18,
      borderWidth: 1,
      padding: 14,
      marginBottom: 12,
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 10,
    },
    sectionTitle: {
      fontSize: 13.5,
      fontWeight: "800",
    },
    dataGrid: {
      gap: 2,
    },
    securityActionRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 12,
    },
    securityActionText: {
      fontSize: 13,
      fontWeight: "700",
    },
    logoutBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: "#EF444414",
      paddingVertical: 14,
      borderRadius: 14,
      marginTop: 8,
    },
    logoutBtnText: {
      color: "#EF4444",
      fontSize: 13.5,
      fontWeight: "800",
    },

    /* Modals */
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.75)",
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 18,
    },
    modalCard: {
      width: "100%",
      borderRadius: 22,
      borderWidth: 1,
      padding: 18,
      elevation: 12,
    },
    modalHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 14,
    },
    modalTitle: {
      fontSize: 15,
      fontWeight: "800",
    },
    modalSub: {
      fontSize: 11,
      fontWeight: "500",
    },
    wardModalGrid: {
      borderRadius: 14,
      borderWidth: 1,
      padding: 12,
      gap: 2,
      marginBottom: 14,
    },
    closeModalBtn: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 12,
      borderRadius: 12,
    },
    closeModalBtnText: {
      color: "#FFFFFF",
      fontSize: 13,
      fontWeight: "800",
    },

    /* Logout Dialog */
    logoutCard: {
      width: "100%",
      borderRadius: 22,
      borderWidth: 1,
      padding: 22,
      alignItems: "center",
    },
    logoutTitle: {
      fontSize: 17,
      fontWeight: "800",
      marginTop: 10,
    },
    logoutSub: {
      fontSize: 12,
      textAlign: "center",
      marginTop: 6,
      lineHeight: 16,
    },
    logoutActionRow: {
      flexDirection: "row",
      gap: 10,
      marginTop: 18,
      width: "100%",
    },
    cancelLogoutBtn: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
    },
    cancelLogoutText: {
      fontSize: 13,
      fontWeight: "800",
    },
    confirmLogoutBtn: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: "#EF4444",
    },
    confirmLogoutText: {
      color: "#FFFFFF",
      fontSize: 13,
      fontWeight: "800",
    },
  });
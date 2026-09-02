import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Modal,
  RefreshControl,
  Share,
  Animated,
  Alert,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { useTheme } from "../../context/ThemeContext";
import { secureGet, secureSet } from "../../services/secureStorage";
import { showToast } from "../../utils/toastService";
import { SkeletonProfileScreen } from "../../components/common/SkeletonLoader";
import useRefreshOnForeground from "../../hooks/useRefreshOnForeground";
import { getFacultyData } from "../../services/dataService";
import { clearAuthSession } from "../../services/api";
import FeedbackBugModal from "../../components/FeedbackBugModal";

const DEFAULT_STAFF_DATA = {};

export default function ProfileStaff({ onLogout }) {
  const { colors, isDarkMode, toggleTheme } = useTheme();
  const styles = getStyles(colors, isDarkMode);

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [logoutVisible, setLogoutVisible] = useState(false);
  const [bugModalVisible, setBugModalVisible] = useState(false);
  const [staffData, setStaffData] = useState(DEFAULT_STAFF_DATA);

  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardTranslateY = useRef(new Animated.Value(14)).current;

  const loadPreferences = useCallback(async () => {
    try {
      const savedPref = await secureGet("staffNotifications");
      if (savedPref !== null) {
        setNotifications(Boolean(savedPref));
      }

      const storedUser = await secureGet("userData");

      const faculty = await getFacultyData();
      if (faculty || storedUser) {
        setStaffData((prev) => ({
          ...prev,
          name: storedUser?.profile?.name || storedUser?.name || faculty?.name || prev.name,
          staffId: faculty?.staffId || faculty?.id || prev.staffId,
          department: faculty?.department || prev.department,
          email: storedUser?.email || faculty?.email || prev.email,
          phone: storedUser?.mobile || faculty?.phone || faculty?.mobile || prev.phone,
          designation: faculty?.designation || faculty?.role || prev.designation,
          address: faculty?.address || prev.address,
          experience: faculty?.experience || prev.experience,
          publications: faculty?.publications || prev.publications,
          grants: faculty?.grants || prev.grants,
          qualification: faculty?.qualification || prev.qualification,
          cabin: faculty?.cabin || prev.cabin,
          consultation: faculty?.consultation || prev.consultation,
          portfolios: faculty?.portfolios || prev.portfolios,
          aicteId: faculty?.aicteId || prev.aicteId,
          specialization: faculty?.specialization || prev.specialization,
        }));
      }
    } catch (error) {
      console.log("Error loading staff profile:", error);
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
      await secureSet("staffNotifications", newValue);
      showToast(
        newValue ? "🔔 Push Notifications Enabled" : "🔕 Notifications Muted",
        newValue ? "success" : "warning"
      );
    } catch (error) {
      console.log("Error saving staff notification preference:", error);
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

  const handleShareFacultyDossier = async () => {
    try {
      await Share.share({
        title: `Faculty Profile - ${staffData.name}`,
        message: `🎓 EDUNEX FACULTY PROFILE\nProfessor: ${staffData.name}\nDesignation: ${staffData.designation}\nDepartment: ${staffData.department}\nEmployee ID: ${staffData.staffId} · AICTE: ${staffData.aicteId}\nQualifications: ${staffData.qualification}\nOffice Cabin: ${staffData.cabin}\nEmail: ${staffData.email}`,
      });
      showToast("Faculty profile shared!", "success");
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
            <Icon name="badge-account-horizontal-outline" size={24} color={colors.primaryAccent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: colors.primaryText }]}>Faculty Profile</Text>
            <Text style={[styles.headerSubtitle, { color: colors.secondaryText }]}>
              Academic Credentials, Research Portfolios & Security
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.shareBtnPill, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
            onPress={handleShareFacultyDossier}
            activeOpacity={0.8}
          >
            <Icon name="share-variant-outline" size={16} color={colors.primaryAccent} />
            <Text style={[styles.shareBtnPillText, { color: colors.primaryAccent }]}>Share</Text>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <SkeletonProfileScreen />
        ) : (
          <>
            {/* ========================================================================= */}
            {/* 2. FACULTY HERO & DIGITAL SMART BADGE CARD                                */}
            {/* ========================================================================= */}
            <Animated.View
              style={[
                styles.facultyHeroCard,
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
                  <Icon name="account-tie" size={36} color="#FFFFFF" />
                </View>

                <View style={{ flex: 1, marginLeft: 14 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={[styles.facultyName, { color: colors.primaryText }]} numberOfLines={1}>
                      {staffData.name}
                    </Text>
                    <View style={styles.verifiedBadge}>
                      <Icon name="check-decagram" size={12} color="#10B981" />
                      <Text style={styles.verifiedBadgeText}>ACCREDITED</Text>
                    </View>
                  </View>

                  <Text style={[styles.designationText, { color: colors.primaryAccent }]}>
                    {staffData.designation}
                  </Text>
                  <Text style={[styles.deptText, { color: colors.secondaryText }]}>
                    {staffData.department}
                  </Text>
                  <Text style={[styles.staffIdText, { color: colors.disabledText }]}>
                    ID: {staffData.staffId} · AICTE: {staffData.aicteId}
                  </Text>
                </View>
              </View>

              {/* Research & Experience KPI Strip */}
              <View style={[styles.researchStrip, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                <View style={styles.researchItem}>
                  <Text style={[styles.researchVal, { color: colors.primaryText }]}>{staffData.experience}</Text>
                  <Text style={[styles.researchLabel, { color: colors.secondaryText }]}>Experience</Text>
                </View>
                <View style={styles.researchItem}>
                  <Text style={[styles.researchVal, { color: "#4F46E5" }]}>{staffData.publications}</Text>
                  <Text style={[styles.researchLabel, { color: colors.secondaryText }]}>Publications</Text>
                </View>
                <View style={styles.researchItem}>
                  <Text style={[styles.researchVal, { color: "#10B981" }]}>{staffData.grants}</Text>
                  <Text style={[styles.researchLabel, { color: colors.secondaryText }]}>Grants</Text>
                </View>
              </View>
            </Animated.View>

            {/* ========================================================================= */}
            {/* 3. ACADEMIC CREDENTIALS & CABIN CONSULTATION                              */}
            {/* ========================================================================= */}
            <View style={[styles.sectionCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
              <View style={styles.sectionHeader}>
                <Icon name="school-outline" size={20} color={colors.primaryAccent} />
                <Text style={[styles.sectionTitle, { color: colors.primaryText }]}>Academic & Office Credentials</Text>
              </View>

              <View style={styles.dataGrid}>
                <DataRow icon="certificate-outline" label="Highest Qualification" value={staffData.qualification} colors={colors} />
                <DataRow icon="domain" label="Office Cabin" value={staffData.cabin} colors={colors} />
                <DataRow icon="clock-outline" label="Student Consultation" value={staffData.consultation} colors={colors} />
                <DataRow icon="briefcase-check-outline" label="Institutional Roles" value={staffData.portfolios} colors={colors} />
              </View>
            </View>

            {/* ========================================================================= */}
            {/* 4. CONTACT & RESIDENTIAL INFORMATION                                      */}
            {/* ========================================================================= */}
            <View style={[styles.sectionCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
              <View style={styles.sectionHeader}>
                <Icon name="card-text-outline" size={20} color={colors.primaryAccent} />
                <Text style={[styles.sectionTitle, { color: colors.primaryText }]}>Contact Information</Text>
              </View>

              <View style={styles.dataGrid}>
                <DataRow icon="phone-outline" label="Direct Mobile" value={staffData.phone} colors={colors} />
                <DataRow icon="email-outline" label="Institutional Email" value={staffData.email} colors={colors} />
                <DataRow icon="map-marker-outline" label="Campus Residence" value={staffData.address} colors={colors} />
              </View>
            </View>

            {/* ========================================================================= */}
            {/* 5. APP SETTINGS & SECURITY                                                */}
            {/* ========================================================================= */}
            <View style={[styles.sectionCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
              <View style={styles.sectionHeader}>
                <Icon name="cog-outline" size={20} color={colors.primaryAccent} />
                <Text style={[styles.sectionTitle, { color: colors.primaryText }]}>Preferences & Privacy</Text>
              </View>

              <View style={styles.dataGrid}>
                <PrefRow
                  icon="bell-ring-outline"
                  label="Classroom & CIA Notifications"
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
                      "🔒 Academic Security Active",
                      "Faculty-student records and evaluations are end-to-end encrypted under EduNex zero-knowledge institutional privacy standards."
                    )
                  }
                  activeOpacity={0.8}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <Icon name="shield-lock-outline" size={20} color="#10B981" />
                    <Text style={[styles.securityActionText, { color: "#10B981" }]}>
                      Faculty E2EE Security Active
                    </Text>
                  </View>
                  <Icon name="check-circle" size={18} color="#10B981" />
                </TouchableOpacity>

                {/* Bug & Developer Feedback Report */}
                <TouchableOpacity
                  style={[styles.securityActionRow, { borderTopWidth: 1, borderTopColor: colors.divider }]}
                  onPress={() => setBugModalVisible(true)}
                  activeOpacity={0.8}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <Icon name="bug-outline" size={20} color="#EF4444" />
                    <Text style={[styles.securityActionText, { color: "#EF4444" }]}>
                      Report a Bug / Developer Feedback
                    </Text>
                  </View>
                  <Icon name="chevron-right" size={20} color={colors.disabledText} />
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
              <Text style={styles.logoutBtnText}>Log Out of Faculty Portal</Text>
            </TouchableOpacity>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Developer Feedback Modal */}
      <FeedbackBugModal
        visible={bugModalVisible}
        onClose={() => setBugModalVisible(false)}
        initialScreen="Faculty Portal Profile"
      />

      {/* LOGOUT CONFIRMATION MODAL */}
      <Modal visible={logoutVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.logoutCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
            <Icon name="alert-circle-outline" size={44} color="#EF4444" />
            <Text style={[styles.logoutTitle, { color: colors.primaryText }]}>Confirm Log Out?</Text>
            <Text style={[styles.logoutSub, { color: colors.secondaryText }]}>
              You will need to sign in again to record student attendance and submit CIA internal evaluations.
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
    fontSize: 12.5,
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

    /* Faculty Hero Card */
    facultyHeroCard: {
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
    facultyName: {
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
    designationText: {
      fontSize: 12,
      fontWeight: "700",
      marginTop: 2,
    },
    deptText: {
      fontSize: 11.5,
      fontWeight: "600",
      marginTop: 1,
    },
    staffIdText: {
      fontSize: 10.5,
      fontWeight: "500",
      marginTop: 2,
    },
    researchStrip: {
      flexDirection: "row",
      borderRadius: 12,
      borderWidth: 1,
      padding: 10,
      marginTop: 14,
      justifyContent: "space-around",
    },
    researchItem: {
      alignItems: "center",
    },
    researchVal: {
      fontSize: 12.5,
      fontWeight: "800",
    },
    researchLabel: {
      fontSize: 10,
      fontWeight: "600",
      marginTop: 1,
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

    /* Logout Dialog */
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.75)",
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 18,
    },
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
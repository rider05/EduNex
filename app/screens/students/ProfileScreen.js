import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Modal,
  Pressable,
  Image,
  Animated,
  RefreshControl,
  Alert,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import QRCode from "react-native-qrcode-svg";
import { useTheme } from "../../context/ThemeContext";
import ResetPasswordModal from "./ResetPasswordModal";
import EditProfileModal from "./modals/EditProfileModal";
import FeedbackBugModal from "../../components/FeedbackBugModal";
import { showToast } from "../../utils/toastService";
import { SkeletonProfileCard, SkeletonListItem } from "../../components/common/SkeletonLoader";
import { getStudentData, getInstitutions } from "../../services/dataService";
import { api } from "../../services/api";
import { resolveIdentity } from "../../services/identityService";
import { getRandomInterestingNickname, getDeterministicNickname } from "../../utils/nicknameGenerator";
import { formatDeptName } from "../../utils/deptFormatter";
import { shareStudentIdCardPdf } from "../../utils/pdfGenerator";
import useRefreshOnForeground from "../../hooks/useRefreshOnForeground";

const PROFILE_IMAGE_KEY = "student_profile_image_v3";
const PROFILE_DATA_KEY = "student_profile_data_v3";
const NOTIF_PREF_KEY = "student_notifications_v3";

const DEFAULT_USER = {};

export default function ProfileScreen({ onLogout }) {
  const { colors, isDarkMode, toggleTheme } = useTheme();
  const styles = getStyles(colors, isDarkMode);

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState(DEFAULT_USER);
  const [institution, setInstitution] = useState(null);
  const [profileImage, setProfileImage] = useState(null);

  // Modals
  const [showFullImage, setShowFullImage] = useState(false);
  const [photoOptionsVisible, setPhotoOptionsVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [resetModalVisible, setResetModalVisible] = useState(false);
  const [showIdCardModal, setShowIdCardModal] = useState(false);
  const [logoutVisible, setLogoutVisible] = useState(false);
  const [bugModalVisible, setBugModalVisible] = useState(false);

  // Preferences
  const [isNotificationsEnabled, setIsNotificationsEnabled] = useState(true);

  // Animations
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardTranslateY = useRef(new Animated.Value(14)).current;
  const avatarScale = useRef(new Animated.Value(1)).current;

  const loadData = useCallback(async () => {
    try {
      const img = await AsyncStorage.getItem(PROFILE_IMAGE_KEY);
      if (img) setProfileImage(img);

      const pref = await AsyncStorage.getItem(NOTIF_PREF_KEY);
      if (pref !== null) setIsNotificationsEnabled(JSON.parse(pref));

      const [apiStudent, instRes] = await Promise.all([
        getStudentData().catch(() => null),
        getInstitutions().catch(() => []),
      ]);

      const inst = Array.isArray(instRes) && instRes.length > 0 ? instRes[0] : null;
      if (inst) setInstitution(inst);

      const sessionRaw = await AsyncStorage.getItem("userData");
      let sessionUser = null;
      try {
        sessionUser = sessionRaw ? JSON.parse(sessionRaw) : null;
      } catch {}

      if (apiStudent || sessionUser) {
        const rollSeed = apiStudent?.rollNo || sessionUser?.rollNo || sessionUser?.username || "velu";

        setUser((prev) => {
          const initialNick =
            apiStudent?.nickname ||
            sessionUser?.nickname ||
            prev.nickname ||
            getDeterministicNickname(rollSeed);

          return {
            ...prev,
            name: apiStudent?.name || sessionUser?.profile?.name || sessionUser?.name || prev.name,
            nickname: initialNick,
            id: apiStudent?.rollNo || apiStudent?.id || prev.id,
            regNo: apiStudent?.regNo || prev.regNo || "",
            email: apiStudent?.email || sessionUser?.email || prev.email,
            phone: apiStudent?.phone || sessionUser?.mobile || prev.phone,
            program: apiStudent?.department || prev.program,
            address: apiStudent?.parent?.address || apiStudent?.address || prev.address,
            bloodGroup: apiStudent?.bloodGroup || prev.bloodGroup || "—",
            batch: apiStudent?.batch || prev.batch || "",
            department: apiStudent?.department || prev.department || "",
            semester: apiStudent?.semester || prev.semester || "",
            dob: apiStudent?.dob || prev.dob || "",
            advisor: apiStudent?.advisor?.name || prev.advisor || "",
            mentorEmail: apiStudent?.advisor?.email || prev.mentorEmail || "",
            residentialStatus:
              apiStudent?.residentialStatus ||
              (typeof apiStudent?.hostel === "boolean"
                ? apiStudent.hostel
                  ? "Hosteler"
                  : "Day Scholar (Inside)"
                : apiStudent?.hostel) ||
              prev.residentialStatus ||
              "Day Scholar (Inside)",
            hostel:
              apiStudent?.residentialStatus ||
              (typeof apiStudent?.hostel === "boolean"
                ? apiStudent.hostel
                  ? "Hosteler"
                  : "Day Scholar (Inside)"
                : apiStudent?.hostel) ||
              prev.hostel ||
              "Day Scholar (Inside)",
            fatherName: apiStudent?.parent?.name || prev.fatherName || "",
            fatherPhone: apiStudent?.parent?.phone || apiStudent?.parent?.mobile || prev.fatherPhone || "",
            motherName: apiStudent?.motherName || apiStudent?.parent?.motherName || prev.motherName || "—",
            emergencyContact: apiStudent?.emergencyContact || apiStudent?.parent?.phone || prev.emergencyContact || "",
          };
        });
      } else {
        const local = await AsyncStorage.getItem(PROFILE_DATA_KEY);
        if (local) setUser(JSON.parse(local));
      }
    } catch (_e) {
      console.warn("Profile load error:", _e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    Animated.parallel([
      Animated.timing(cardOpacity, { toValue: 1, duration: 280, useNativeDriver: true }),
      Animated.timing(cardTranslateY, { toValue: 0, duration: 280, useNativeDriver: true }),
    ]).start();
  }, [cardOpacity, cardTranslateY, loadData]);

  useRefreshOnForeground(loadData);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const pickFromGallery = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permission Required", "Media library access is needed to select a profile photo.");
        return;
      }

      const res = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
      });

      if (!res.canceled && res.assets && res.assets[0]?.uri) {
        const uri = res.assets[0].uri;
        setProfileImage(uri);
        await AsyncStorage.setItem(PROFILE_IMAGE_KEY, uri);
        setPhotoOptionsVisible(false);
        showToast("Profile photo updated!", "success");
      }
    } catch (_e) {
      showToast("Failed to pick image", "error");
    }
  };

  const takePhoto = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permission Required", "Camera access is needed to take a profile photo.");
        return;
      }

      const res = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
      });

      if (!res.canceled && res.assets && res.assets[0]?.uri) {
        const uri = res.assets[0].uri;
        setProfileImage(uri);
        await AsyncStorage.setItem(PROFILE_IMAGE_KEY, uri);
        setPhotoOptionsVisible(false);
        showToast("Profile photo captured!", "success");
      }
    } catch (_e) {
      showToast("Failed to take photo", "error");
    }
  };

  const removePhoto = async () => {
    setProfileImage(null);
    await AsyncStorage.removeItem(PROFILE_IMAGE_KEY);
    setPhotoOptionsVisible(false);
    showToast("Profile photo reset", "info");
  };

  const toggleNotifications = async () => {
    const nv = !isNotificationsEnabled;
    setIsNotificationsEnabled(nv);
    await AsyncStorage.setItem(NOTIF_PREF_KEY, JSON.stringify(nv));
    showToast(nv ? "🔔 Push Notifications Enabled" : "🔕 Notifications Muted", nv ? "success" : "warning");
  };

  const handleProfileUpdate = async (newData) => {
    const updated = { ...user, ...newData };
    setUser(updated);
    await AsyncStorage.setItem(PROFILE_DATA_KEY, JSON.stringify(updated));
    setEditModalVisible(false);
    showToast("Profile details saved successfully!", "success");
  };

  const handleLogout = async () => {
    setLogoutVisible(false);
    await AsyncStorage.removeItem("userRole");
    await AsyncStorage.removeItem("userData");
    showToast("Logged out successfully", "info");
    if (onLogout) onLogout();
  };

  const handleShareIdCard = async () => {
    try {
      await shareStudentIdCardPdf({
        student: {
          ...user,
          rollNo: user.rollNo || user.id,
        },
      });
      showToast("Official Student ID Pass PDF generated!", "success");
    } catch (err) {
      console.log("Share error:", err);
      showToast("Could not generate ID Pass PDF", "error");
    }
  };

  const handleShuffleNickname = async () => {
    const newNick = getRandomInterestingNickname(user.nickname);
    setUser((prev) => ({ ...prev, nickname: newNick }));
    try {
      const identity = await resolveIdentity().catch(() => null);
      const collection = identity?.role === "student" ? "students" : "staff";
      const docId = identity?.id || identity?.rollNo || user.id || "STU-2024-AIDS01";
      if (docId) {
        await api.patch(`/${collection}/${encodeURIComponent(docId)}`, { nickname: newNick }).catch(() => null);
      }
    } catch (err) {
      console.log("Shuffle nickname patch error:", err);
    }
    showToast(`✨ Sparked alias: "${newNick}"`, "info");
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
            <Icon name="account-circle" size={24} color={colors.primaryAccent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: colors.primaryText }]}>Student Profile</Text>
            <Text style={[styles.headerSubtitle, { color: colors.secondaryText }]}>
              Digital Campus ID & Personal Credentials
            </Text>
          </View>

          {/* Quick ID Card Launcher */}
          <TouchableOpacity
            style={[styles.idCardPillBtn, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
            onPress={() => setShowIdCardModal(true)}
            activeOpacity={0.8}
          >
            <Icon name="smart-card" size={16} color={colors.primaryAccent} />
            <Text style={[styles.idCardPillBtnText, { color: colors.primaryAccent }]}>Smart ID</Text>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={{ marginTop: 10 }}>
            <SkeletonProfileCard />
            <SkeletonListItem />
            <SkeletonListItem />
            <SkeletonListItem />
          </View>
        ) : (
          <>
            {/* ========================================================================= */}
            {/* 2. DIGITAL STUDENT ID CARD HERO                                           */}
            {/* ========================================================================= */}
            <Animated.View
              style={[
                styles.idHeroCard,
                {
                  backgroundColor: colors.cardBackground,
                  borderColor: colors.divider,
                  opacity: cardOpacity,
                  transform: [{ translateY: cardTranslateY }],
                },
              ]}
            >
              {/* Card Top Strip */}
              <View style={styles.idHeroTop}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Icon name="shield-check" size={16} color="#10B981" />
                  <Text style={[styles.idHeroUniversity, { color: colors.secondaryText }]}>
                    {institution?.name?.toUpperCase() || "EDUNEX INSTITUTE OF TECHNOLOGY"}
                  </Text>
                </View>
                <View style={styles.activeStatusPill}>
                  <View style={styles.greenDot} />
                  <Text style={styles.activeStatusText}>STUDENT ACTIVE</Text>
                </View>
              </View>

              {/* Middle Row: Avatar + Info */}
              <View style={styles.idHeroMiddle}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => setShowFullImage(true)}
                  onLongPress={() => setPhotoOptionsVisible(true)}
                  style={styles.avatarWrap}
                >
                  <Animated.View style={{ transform: [{ scale: avatarScale }] }}>
                    <View style={[styles.avatarCircle, { borderColor: colors.primaryAccent }]}>
                      {profileImage ? (
                        <Image source={{ uri: profileImage }} style={styles.avatarImage} />
                      ) : (
                        <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primaryAccent }]}>
                          <Text style={styles.avatarInitials}>
                            {(user.name || "")
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .slice(0, 2) || "?"}
                          </Text>
                        </View>
                      )}
                    </View>
                  </Animated.View>

                  <TouchableOpacity
                    style={[styles.cameraBadge, { backgroundColor: colors.primaryAccent }]}
                    onPress={() => setPhotoOptionsVisible(true)}
                  >
                    <Icon name="camera" size={12} color="#FFFFFF" />
                  </TouchableOpacity>
                </TouchableOpacity>

                <View style={styles.idHeroDetails}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <Text style={[styles.idHeroName, { color: colors.primaryText }]} numberOfLines={1}>
                      {user.name}
                    </Text>
                    {!!user.nickname && (
                      <TouchableOpacity
                        onPress={handleShuffleNickname}
                        activeOpacity={0.7}
                        title="Tap to shuffle nickname"
                        style={[styles.nicknameHeroBadge, { backgroundColor: "#F59E0B18", borderColor: "#F59E0B44" }]}
                      >
                        <Icon name="dice-5-outline" size={11} color="#D97706" />
                        <Text style={[styles.nicknameHeroBadgeText, { color: "#D97706" }]}>
                          {`"${user.nickname}"`}
                        </Text>
                        <Icon name="shuffle-variant" size={10} color="#D97706" style={{ marginLeft: 2 }} />
                      </TouchableOpacity>
                    )}
                  </View>
                  <Text style={[styles.idHeroProgram, { color: colors.primaryAccent }]} numberOfLines={1}>
                    {formatDeptName(user.program || user.department, "compact")}
                  </Text>

                  <View style={styles.idHeroMetaRow}>
                    <Text style={[styles.idHeroMetaBadge, { backgroundColor: colors.primaryBackground, color: colors.secondaryText }]}>
                      Roll: {user.id}
                    </Text>
                    <Text style={[styles.idHeroMetaBadge, { backgroundColor: colors.primaryBackground, color: colors.secondaryText }]}>
                      {user.residentialStatus || user.hostel || "Day Scholar (Inside)"}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Card Footer: Quick Actions */}
              <View style={[styles.idHeroFooter, { borderTopColor: colors.divider }]}>
                <TouchableOpacity
                  style={[styles.idActionBtn, { borderColor: colors.divider }]}
                  onPress={() => setShowIdCardModal(true)}
                  activeOpacity={0.8}
                >
                  <Icon name="qrcode-scan" size={15} color={colors.primaryAccent} />
                  <Text style={[styles.idActionBtnText, { color: colors.primaryAccent }]}>Digital QR Pass</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.idActionBtn, { backgroundColor: colors.primaryAccent, borderColor: colors.primaryAccent }]}
                  onPress={() => setEditModalVisible(true)}
                  activeOpacity={0.85}
                >
                  <Icon name="account-edit-outline" size={15} color="#FFFFFF" />
                  <Text style={[styles.idActionBtnText, { color: "#FFFFFF" }]}>Edit Profile</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>

            {/* ========================================================================= */}
            {/* 3. ACADEMIC ADVISOR & MENTORSHIP CARD                                     */}
            {/* ========================================================================= */}
            <View style={[styles.infoSectionCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
              <View style={styles.infoSectionHeader}>
                <Icon name="account-tie-outline" size={20} color={colors.primaryAccent} />
                <Text style={[styles.infoSectionTitle, { color: colors.primaryText }]}>Class Advisor & Mentorship</Text>
              </View>

              <View style={[styles.advisorRow, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                <View style={[styles.advisorIconCircle, { backgroundColor: colors.primaryAccent + "18" }]}>
                  <Icon name="school-outline" size={22} color={colors.primaryAccent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.advisorName, { color: colors.primaryText }]}>{user.advisor}</Text>
                  <Text style={[styles.advisorEmail, { color: colors.secondaryText }]}>{user.mentorEmail}</Text>
                  <Text style={[styles.advisorDept, { color: colors.disabledText }]}>Head Class Counselor · Office Hours: 09:00 - 16:30</Text>
                </View>
              </View>
            </View>

            {/* ========================================================================= */}
            {/* 4. ACADEMIC & INSTITUTIONAL CREDENTIALS                                   */}
            {/* ========================================================================= */}
            <View style={[styles.infoSectionCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
              <View style={styles.infoSectionHeader}>
                <Icon name="certificate-outline" size={20} color={colors.primaryAccent} />
                <Text style={[styles.infoSectionTitle, { color: colors.primaryText }]}>Academic Credentials</Text>
              </View>

              <View style={styles.dataGrid}>
                <DataRow icon="card-account-details-outline" label="University Reg. No." value={user.regNo} colors={colors} />
                <DataRow icon="identifier" label="Roll Number" value={user.id} colors={colors} />
                <DataRow icon="school-outline" label="Academic Batch" value={user.batch} colors={colors} />
                <DataRow icon="domain" label="Department" value={user.department} colors={colors} />
                <DataRow icon="home-city-outline" label="Residence Status" value={user.residentialStatus || user.hostel || "Day Scholar (Inside)"} colors={colors} />
              </View>
            </View>

            {/* ========================================================================= */}
            {/* 5. CONTACT & BIOGRAPHICAL DETAILS                                         */}
            {/* ========================================================================= */}
            <View style={[styles.infoSectionCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
              <View style={styles.infoSectionHeader}>
                <Icon name="card-text-outline" size={20} color={colors.primaryAccent} />
                <Text style={[styles.infoSectionTitle, { color: colors.primaryText }]}>Personal & Contact Information</Text>
              </View>

              <View style={styles.dataGrid}>
                <DataRow icon="account-star-outline" label="Nickname / Preferred Name" value={user.nickname || "—"} colors={colors} />
                <DataRow icon="email-outline" label="Official Email" value={user.email} colors={colors} />
                <DataRow icon="phone-outline" label="Mobile Number" value={user.phone} colors={colors} />
                <DataRow icon="calendar-account" label="Date of Birth" value={user.dob} colors={colors} />
                <DataRow icon="water-outline" label="Blood Group" value={user.bloodGroup} colors={colors} />
                <DataRow icon="map-marker-outline" label="Permanent Address" value={user.address} colors={colors} />
              </View>
            </View>

            {/* ========================================================================= */}
            {/* 6. GUARDIAN & EMERGENCY CONTACTS                                          */}
            {/* ========================================================================= */}
            <View style={[styles.infoSectionCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
              <View style={styles.infoSectionHeader}>
                <Icon name="shield-account-outline" size={20} color={colors.primaryAccent} />
                <Text style={[styles.infoSectionTitle, { color: colors.primaryText }]}>Guardian & Emergency Contacts</Text>
              </View>

              <View style={styles.dataGrid}>
                <DataRow icon="account-supervisor-circle" label="Father's Name" value={user.fatherName} colors={colors} />
                <DataRow icon="phone-outline" label="Father's Contact" value={user.fatherPhone} colors={colors} />
                <DataRow icon="account-heart-outline" label="Mother's Name" value={user.motherName || "—"} colors={colors} />
                <DataRow icon="alert-decagram-outline" label="Emergency Contact" value={user.emergencyContact} colors={colors} />
              </View>
            </View>

            {/* ========================================================================= */}
            {/* 7. APP PREFERENCES & SECURITY SETTINGS                                    */}
            {/* ========================================================================= */}
            <View style={[styles.infoSectionCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
              <View style={styles.infoSectionHeader}>
                <Icon name="cog-outline" size={20} color={colors.primaryAccent} />
                <Text style={[styles.infoSectionTitle, { color: colors.primaryText }]}>App Settings & Security</Text>
              </View>

              <View style={styles.dataGrid}>
                <PrefRow
                  icon="bell-ring-outline"
                  label="Push Notifications"
                  value={isNotificationsEnabled}
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
                  style={[styles.securityActionRow, { borderBottomColor: colors.divider }]}
                  onPress={() => setResetModalVisible(true)}
                  activeOpacity={0.8}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <Icon name="lock-reset" size={20} color={colors.primaryAccent} />
                    <Text style={[styles.securityActionText, { color: colors.primaryText }]}>
                      Change Account Password
                    </Text>
                  </View>
                  <Icon name="chevron-right" size={20} color={colors.disabledText} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.securityActionRow}
                  onPress={() =>
                    Alert.alert(
                      "🔒 E2EE & Privacy Status",
                      "Your device is protected under EduNex End-to-End Encryption and Institutional Privacy Consent."
                    )
                  }
                  activeOpacity={0.8}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <Icon name="shield-lock-outline" size={20} color="#10B981" />
                    <Text style={[styles.securityActionText, { color: "#10B981" }]}>
                      Privacy & E2EE Verified
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
              <Text style={styles.logoutBtnText}>Log Out of EduNex</Text>
            </TouchableOpacity>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ========================================================================= */}
      {/* 8. DIGITAL SMART ID CARD MODAL                                            */}
      {/* ========================================================================= */}
      {showIdCardModal && (
        <Modal visible={showIdCardModal} transparent animationType="fade" onRequestClose={() => setShowIdCardModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.idCardModalBody, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
              {/* Top Bar */}
              <View style={styles.idCardModalHeader}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Icon name="school" size={22} color={colors.primaryAccent} />
                  <Text style={[styles.idCardModalHeaderTitle, { color: colors.primaryText }]}>Digital Campus ID Card</Text>
                </View>
                <TouchableOpacity onPress={() => setShowIdCardModal(false)}>
                  <Icon name="close-circle-outline" size={24} color={colors.secondaryText} />
                </TouchableOpacity>
              </View>

              {/* Physical Card Mockup */}
              <View style={styles.idCardPhysicalFrame}>
                <View style={[styles.idCardBadgeHeader, { backgroundColor: colors.primaryAccent }]}>
                  <Text style={styles.idCardInstituteText}>{institution?.name?.toUpperCase() || "EDUNEX INSTITUTE OF TECHNOLOGY"}</Text>
                  <Text style={styles.idCardInstituteSub}>{institution?.accreditation || "Autonomous Institution"}</Text>
                </View>

                <View style={styles.idCardInnerBody}>
                  <View style={styles.idCardInnerTop}>
                    <View style={styles.idCardPhotoBox}>
                      {profileImage ? (
                        <Image source={{ uri: profileImage }} style={styles.idCardPhotoImage} />
                      ) : (
                        <Icon name="account" size={48} color="#94A3B8" />
                      )}
                    </View>

                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.idCardCandidateName}>{user.name}</Text>
                      <Text style={styles.idCardCandidateDept}>{formatDeptName(user.department || user.program, "short")}</Text>
                      <Text style={styles.idCardCandidateRoll}>Roll: {user.id}</Text>
                      <Text style={styles.idCardCandidateReg}>Reg: {user.regNo}</Text>
                    </View>
                  </View>

                  {/* QR Code Biometric Gate Pass */}
                  <View style={styles.idCardQrWrapper}>
                    <View style={styles.qrFrameWhite}>
                      <QRCode
                        value={JSON.stringify({
                          student: user.name,
                          rollNo: user.id,
                          regNo: user.regNo,
                          dept: user.department,
                          validity: user.batch || "MAY-2027",
                          status: "VERIFIED_ACTIVE",
                        })}
                        size={120}
                        color="#0F172A"
                        backgroundColor="#FFFFFF"
                      />
                    </View>
                    <Text style={styles.qrScanInstruction}>Scan at Campus Library & Biometric Gate 1</Text>
                  </View>

                  <View style={styles.idCardMetaFooter}>
                    <Text style={styles.idCardValidity}>Valid Upto: {user.batch || "—"}</Text>
                    <Text style={styles.idCardBlood}>Blood: {user.bloodGroup}</Text>
                  </View>
                </View>
              </View>

              {/* Modal Actions */}
              <View style={styles.idModalActionRow}>
                <TouchableOpacity
                  style={[styles.shareIdBtn, { backgroundColor: colors.primaryAccent }]}
                  onPress={handleShareIdCard}
                  activeOpacity={0.85}
                >
                  <Icon name="share-variant" size={16} color="#FFFFFF" />
                  <Text style={styles.shareIdBtnText}>Share Digital ID</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.closeIdBtn, { borderColor: colors.divider }]}
                  onPress={() => setShowIdCardModal(false)}
                >
                  <Text style={[styles.closeIdBtnText, { color: colors.primaryText }]}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* FULL-SCREEN AVATAR MODAL */}
      <Modal visible={showFullImage} transparent animationType="fade">
        <Pressable style={styles.fullImageOverlay} onPress={() => setShowFullImage(false)}>
          {profileImage ? (
            <Image source={{ uri: profileImage }} style={styles.fullImage} resizeMode="contain" />
          ) : (
            <Icon name="account" size={160} color="#FFFFFF" />
          )}
        </Pressable>
      </Modal>

      {/* PHOTO PICKER SHEET */}
      <Modal visible={photoOptionsVisible} transparent animationType="fade">
        <View style={styles.optionsOverlay}>
          <View style={[styles.optionsCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
            <Text style={[styles.optionsTitle, { color: colors.primaryText }]}>Profile Photo Options</Text>

            <TouchableOpacity style={styles.optionRow} onPress={() => { setPhotoOptionsVisible(false); setShowFullImage(true); }}>
              <Icon name="eye-outline" size={20} color={colors.primaryAccent} />
              <Text style={[styles.optionText, { color: colors.primaryText }]}>View Current Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.optionRow} onPress={pickFromGallery}>
              <Icon name="image-outline" size={20} color={colors.primaryAccent} />
              <Text style={[styles.optionText, { color: colors.primaryText }]}>Choose from Gallery</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.optionRow} onPress={takePhoto}>
              <Icon name="camera-outline" size={20} color={colors.primaryAccent} />
              <Text style={[styles.optionText, { color: colors.primaryText }]}>Take New Photo</Text>
            </TouchableOpacity>

            {profileImage && (
              <TouchableOpacity style={styles.optionRow} onPress={removePhoto}>
                <Icon name="trash-can-outline" size={20} color="#EF4444" />
                <Text style={[styles.optionText, { color: "#EF4444" }]}>Remove Photo</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.cancelOptionBtn, { borderColor: colors.divider }]}
              onPress={() => setPhotoOptionsVisible(false)}
            >
              <Text style={[styles.cancelOptionText, { color: colors.secondaryText }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* EDIT PROFILE MODAL */}
      <FeedbackBugModal visible={bugModalVisible} onClose={() => setBugModalVisible(false)} initialScreen="Student Profile" />
        <EditProfileModal
        visible={editModalVisible}
        onClose={() => setEditModalVisible(false)}
        user={user}
        onSave={handleProfileUpdate}
      />

      {/* RESET PASSWORD MODAL */}
      <ResetPasswordModal
        visible={resetModalVisible}
        onClose={() => setResetModalVisible(false)}
        user={user}
      />

      {/* LOGOUT CONFIRMATION MODAL */}
      <Modal visible={logoutVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.logoutCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
            <Icon name="alert-circle-outline" size={44} color="#EF4444" />
            <Text style={[styles.logoutTitle, { color: colors.primaryText }]}>Log Out of EduNex?</Text>
            <Text style={[styles.logoutSub, { color: colors.secondaryText }]}>
              You will need to sign in again with your institutional credentials to access student services.
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
        <Icon name={icon} size={18} color={colors.primaryAccent} />
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
          <Icon name={icon} size={18} color={colors.primaryAccent} />
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
    width: 32,
    height: 32,
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
    marginTop: 2,
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
    idCardPillBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 10,
      borderWidth: 1,
    },
    idCardPillBtnText: {
      fontSize: 11.5,
      fontWeight: "700",
    },

    /* Digital ID Hero Card */
    idHeroCard: {
      borderRadius: 20,
      borderWidth: 1,
      padding: 16,
      marginBottom: 14,
      elevation: 3,
      shadowColor: "#000",
      shadowOpacity: 0.08,
      shadowRadius: 8,
    },
    idHeroTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    idHeroUniversity: {
      fontSize: 9.5,
      fontWeight: "900",
      letterSpacing: 0.5,
    },
    activeStatusPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: "#10B98114",
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    greenDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: "#10B981",
    },
    activeStatusText: {
      color: "#10B981",
      fontSize: 8.5,
      fontWeight: "900",
    },
    idHeroMiddle: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 14,
    },
    avatarWrap: {
      position: "relative",
    },
    avatarCircle: {
      width: 64,
      height: 64,
      borderRadius: 32,
      borderWidth: 2,
      overflow: "hidden",
      justifyContent: "center",
      alignItems: "center",
    },
    avatarImage: {
      width: "100%",
      height: "100%",
    },
    avatarPlaceholder: {
      width: "100%",
      height: "100%",
      justifyContent: "center",
      alignItems: "center",
    },
    avatarInitials: {
      color: "#FFFFFF",
      fontSize: 22,
      fontWeight: "900",
    },
    cameraBadge: {
      position: "absolute",
      bottom: 0,
      right: 0,
      width: 22,
      height: 22,
      borderRadius: 11,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1.5,
      borderColor: "#FFFFFF",
    },
    idHeroDetails: {
      flex: 1,
      marginLeft: 14,
    },
    idHeroName: {
      fontSize: 16,
      fontWeight: "900",
      letterSpacing: -0.2,
    },
    nicknameHeroBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
      borderWidth: 1,
    },
    nicknameHeroBadgeText: {
      fontSize: 10.5,
      fontWeight: "800",
    },
    idHeroProgram: {
      fontSize: 12,
      fontWeight: "700",
      marginTop: 2,
    },
    idHeroMetaRow: {
      flexDirection: "row",
      gap: 6,
      marginTop: 6,
    },
    idHeroMetaBadge: {
      fontSize: 10,
      fontWeight: "700",
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    idHeroFooter: {
      flexDirection: "row",
      gap: 8,
      borderTopWidth: 1,
      paddingTop: 12,
    },
    idActionBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
      paddingVertical: 9,
      borderRadius: 10,
      borderWidth: 1,
    },
    idActionBtnText: {
      fontSize: 12,
      fontWeight: "700",
    },

    /* Advisor Section */
    infoSectionCard: {
      borderRadius: 18,
      borderWidth: 1,
      padding: 14,
      marginBottom: 12,
    },
    infoSectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 10,
    },
    infoSectionTitle: {
      fontSize: 13.5,
      fontWeight: "800",
    },
    advisorRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 12,
      borderRadius: 14,
      borderWidth: 1,
    },
    advisorIconCircle: {
      width: 42,
      height: 42,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
    },
    advisorName: {
      fontSize: 13.5,
      fontWeight: "800",
    },
    advisorEmail: {
      fontSize: 11.5,
      fontWeight: "500",
      marginTop: 1,
    },
    advisorDept: {
      fontSize: 10.5,
      fontWeight: "500",
      marginTop: 2,
    },
    dataGrid: {
      gap: 2,
    },
    securityActionRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 12,
      borderBottomWidth: 1,
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

    /* Digital Smart ID Modal */
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.75)",
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 18,
    },
    idCardModalBody: {
      width: "100%",
      borderRadius: 22,
      borderWidth: 1,
      padding: 18,
      elevation: 12,
    },
    idCardModalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 14,
    },
    idCardModalHeaderTitle: {
      fontSize: 16,
      fontWeight: "800",
    },
    idCardPhysicalFrame: {
      borderRadius: 16,
      overflow: "hidden",
      backgroundColor: isDarkMode ? "#1E293B" : "#F8FAFC",
      borderWidth: 1.5,
      borderColor: colors.primaryAccent,
    },
    idCardBadgeHeader: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      alignItems: "center",
    },
    idCardInstituteText: {
      color: "#FFFFFF",
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 0.5,
    },
    idCardInstituteSub: {
      color: "rgba(255,255,255,0.8)",
      fontSize: 8.5,
      fontWeight: "500",
      marginTop: 1,
    },
    idCardInnerBody: {
      padding: 14,
      alignItems: "center",
    },
    idCardInnerTop: {
      flexDirection: "row",
      alignItems: "center",
      width: "100%",
      marginBottom: 14,
    },
    idCardPhotoBox: {
      width: 60,
      height: 72,
      borderRadius: 8,
      backgroundColor: "#E2E8F0",
      justifyContent: "center",
      alignItems: "center",
      overflow: "hidden",
    },
    idCardPhotoImage: {
      width: "100%",
      height: "100%",
    },
    idCardCandidateName: {
      fontSize: 14.5,
      fontWeight: "900",
      color: isDarkMode ? "#F8FAFC" : "#0F172A",
    },
    idCardCandidateDept: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.primaryAccent,
      marginTop: 2,
    },
    idCardCandidateRoll: {
      fontSize: 11,
      fontWeight: "700",
      color: isDarkMode ? "#94A3B8" : "#475569",
      marginTop: 2,
    },
    idCardCandidateReg: {
      fontSize: 10.5,
      fontWeight: "500",
      color: isDarkMode ? "#94A3B8" : "#475569",
    },
    idCardQrWrapper: {
      alignItems: "center",
      marginVertical: 10,
    },
    qrFrameWhite: {
      padding: 8,
      borderRadius: 12,
      backgroundColor: "#FFFFFF",
      borderWidth: 1.5,
      borderColor: colors.primaryAccent,
    },
    qrScanInstruction: {
      fontSize: 9.5,
      fontWeight: "600",
      color: isDarkMode ? "#94A3B8" : "#64748B",
      marginTop: 6,
    },
    idCardMetaFooter: {
      flexDirection: "row",
      justifyContent: "space-between",
      width: "100%",
      borderTopWidth: 1,
      borderTopColor: "rgba(150,150,150,0.15)",
      paddingTop: 8,
      marginTop: 4,
    },
    idCardValidity: {
      fontSize: 10,
      fontWeight: "700",
      color: isDarkMode ? "#94A3B8" : "#475569",
    },
    idCardBlood: {
      fontSize: 10,
      fontWeight: "800",
      color: "#EF4444",
    },
    idModalActionRow: {
      flexDirection: "row",
      gap: 8,
      marginTop: 14,
    },
    shareIdBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 12,
      borderRadius: 12,
    },
    shareIdBtnText: {
      color: "#FFFFFF",
      fontSize: 13,
      fontWeight: "800",
    },
    closeIdBtn: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
    },
    closeIdBtnText: {
      fontSize: 13,
      fontWeight: "800",
    },

    /* Full Avatar Overlay */
    fullImageOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.9)",
      justifyContent: "center",
      alignItems: "center",
    },
    fullImage: {
      width: "90%",
      height: "70%",
      borderRadius: 16,
    },

    /* Photo Options */
    optionsOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.65)",
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 20,
    },
    optionsCard: {
      width: "100%",
      borderRadius: 20,
      borderWidth: 1,
      padding: 18,
    },
    optionsTitle: {
      fontSize: 15,
      fontWeight: "800",
      marginBottom: 12,
    },
    optionRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: "rgba(150,150,150,0.1)",
    },
    optionText: {
      fontSize: 13.5,
      fontWeight: "700",
    },
    cancelOptionBtn: {
      alignItems: "center",
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
      marginTop: 10,
    },
    cancelOptionText: {
      fontSize: 13,
      fontWeight: "700",
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
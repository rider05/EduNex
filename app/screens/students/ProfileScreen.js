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
  TextInput,
  Animated,
  Platform,
  KeyboardAvoidingView,
  RefreshControl,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import QRCode from "react-native-qrcode-svg";
import { useTheme } from "../../context/ThemeContext";
import ResetPasswordModal from "./ResetPasswordModal";
import { showToast } from "../../utils/toastService";
import { SkeletonProfileCard, SkeletonListItem } from "../../components/common/SkeletonLoader";
import { getStudentData } from "../../services/dataService";
import useRefreshOnForeground from "../../hooks/useRefreshOnForeground";

const PROFILE_IMAGE_KEY = "student_profile_image_v2";
const PROFILE_DATA_KEY = "student_profile_data_v2";
const NOTIF_PREF_KEY = "student_notifications_v2";

const DEFAULT_USER = {
  name: "",
  id: "",
  email: "",
  phone: "",
  program: "",
  address: "",
};

export default function ProfileScreen({ onLogout }) {
  const { colors, isDarkMode, toggleTheme } = useTheme();
  const styles = getStyles(colors);

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState(DEFAULT_USER);
  const [profileImage, setProfileImage] = useState(null);
  const [showFullImage, setShowFullImage] = useState(false);
  const [photoOptionsVisible, setPhotoOptionsVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [resetModalVisible, setResetModalVisible] = useState(false);

  const [logoutVisible, setLogoutVisible] = useState(false);
  const [isNotificationsEnabled, setIsNotificationsEnabled] = useState(false);
  const [showQr, setShowQr] = useState(false);

  const avatarScale = useRef(new Animated.Value(1)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardTranslateY = useRef(new Animated.Value(12)).current;
  const qrScale = useRef(new Animated.Value(0.9)).current;

  const loadData = useCallback(async () => {
    try {
      const img = await AsyncStorage.getItem(PROFILE_IMAGE_KEY);
      if (img) setProfileImage(img);

      const pref = await AsyncStorage.getItem(NOTIF_PREF_KEY);
      if (pref !== null) setIsNotificationsEnabled(JSON.parse(pref));

      const apiStudent = await getStudentData();
      const sessionRaw = await AsyncStorage.getItem("userData");
      let sessionUser = null;
      try {
        sessionUser = sessionRaw ? JSON.parse(sessionRaw) : null;
      } catch {}
      if (apiStudent || sessionUser) {
        setUser({
          name: apiStudent?.name || sessionUser?.profile?.name || sessionUser?.name || "",
          id: apiStudent?.rollNo || apiStudent?.id || "",
          email: apiStudent?.email || sessionUser?.email || "",
          phone: apiStudent?.phone || sessionUser?.mobile || "",
          program: apiStudent?.department || "",
          address: apiStudent?.parent?.address || apiStudent?.address || "",
        });
      } else {
        const data = await AsyncStorage.getItem(PROFILE_DATA_KEY);
        if (data) setUser(JSON.parse(data));
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
      Animated.timing(cardOpacity, { toValue: 1, duration: 260, useNativeDriver: true }),
      Animated.timing(cardTranslateY, { toValue: 0, duration: 260, useNativeDriver: true }),
    ]).start();
  }, [cardOpacity, cardTranslateY, loadData]);

  // Refresh profile data when the app returns to the foreground
  useRefreshOnForeground(loadData);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setTimeout(() => {
      setRefreshing(false);
    }, 600);
  }, [loadData]);

  const pressIn = () =>
    Animated.spring(avatarScale, { toValue: 0.95, useNativeDriver: true }).start();

  const pressOut = () =>
    Animated.spring(avatarScale, { toValue: 1, useNativeDriver: true }).start();

  const pickFromGallery = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return alert("Gallery permission required");

      const res = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
      });

      if (!res.canceled) {
        const uri = res.assets[0].uri;
        setProfileImage(uri);
        await AsyncStorage.setItem(PROFILE_IMAGE_KEY, uri);
        setPhotoOptionsVisible(false);
        showToast("Profile photo updated", "success");
      }
    } catch (_e) {
      showToast("Failed to pick image", "error");
    }
  };

  const takePhoto = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return alert("Camera permission required");

      const res = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
      });

      if (!res.canceled) {
        const uri = res.assets[0].uri;
        setProfileImage(uri);
        await AsyncStorage.setItem(PROFILE_IMAGE_KEY, uri);
        setPhotoOptionsVisible(false);
        showToast("Profile photo updated", "success");
      }
    } catch (_e) {
      showToast("Failed to take photo", "error");
    }
  };

  const removePhoto = async () => {
    setProfileImage(null);
    await AsyncStorage.removeItem(PROFILE_IMAGE_KEY);
    setPhotoOptionsVisible(false);
    showToast("Profile photo removed", "warning");
  };

  const toggleNotifications = async () => {
    const nv = !isNotificationsEnabled;
    setIsNotificationsEnabled(nv);
    await AsyncStorage.setItem(NOTIF_PREF_KEY, JSON.stringify(nv));
    showToast(nv ? "Notifications Enabled" : "Notifications Disabled", nv ? "success" : "warning");
  };

  const handleProfileUpdate = async (newData) => {
    const updated = { ...user, ...newData };
    setUser(updated);
    await AsyncStorage.setItem(PROFILE_DATA_KEY, JSON.stringify(updated));
    showToast("Profile updated", "success");
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem("userRole");
    await AsyncStorage.removeItem("userData");
    if (onLogout) onLogout();
  };

  const openQr = () => {
    qrScale.setValue(0.85);
    setShowQr(true);
    Animated.spring(qrScale, { toValue: 1, friction: 6, useNativeDriver: true }).start();
  };

  const closeQr = () => {
    Animated.timing(qrScale, {
      toValue: 0.85,
      duration: 120,
      useNativeDriver: true,
    }).start(() => setShowQr(false));
  };

  return (
    <>
      {/* ─────────────────────────────────────────────── */}
      {/* PROFILE CONTENT */}
      {/* ─────────────────────────────────────────────── */}

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
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
        <Text style={styles.pageHeader}>My Profile & Settings</Text>

        {isLoading ? (
          <View style={{ marginTop: 10 }}>
            <SkeletonProfileCard />
            <SkeletonListItem />
            <SkeletonListItem />
            <SkeletonListItem />
          </View>
        ) : (
          <>
            {/* PROFILE CARD */}
            <Animated.View
              style={[
                styles.profileCard,
                { opacity: cardOpacity, transform: [{ translateY: cardTranslateY }] },
              ]}
            >
          <Animated.View style={{ transform: [{ scale: avatarScale }] }}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => setShowFullImage(true)}
              onLongPress={() => setPhotoOptionsVisible(true)}
              onPressIn={pressIn}
              onPressOut={pressOut}
            >
              <View style={styles.avatarCircle}>
                {profileImage ? (
                  <Image source={{ uri: profileImage }} style={styles.avatarImage} />
                ) : (
                  <Icon name="account" size={48} color="#fff" />
                )}

                <TouchableOpacity style={styles.qrBadge} onPress={openQr}>
                  <Icon name="qrcode-scan" size={12} color="#fff" />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Animated.View>

          <View style={styles.detailsArea}>
            <Text style={styles.nameText}>{user.name}</Text>
            <Text style={styles.programText}>{user.program}</Text>
            <Text style={styles.idText}>ID: {user.id}</Text>

            <TouchableOpacity style={styles.editBtn} onPress={() => setEditModalVisible(true)}>
              <Icon name="pencil" size={16} color="#fff" />
              <Text style={styles.editBtnText}>Edit Profile</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        <Text style={styles.sectionHeader}>Contact Information</Text>
        <View style={styles.card}>
          <ContactRow icon="email-outline" label="Email" value={user.email} colors={colors} />
          <ContactRow icon="phone-outline" label="Phone" value={user.phone} colors={colors} />
          <ContactRow icon="map-marker-outline" label="Address" value={user.address} colors={colors} />
        </View>

        <Text style={styles.sectionHeader}>App Preferences</Text>
        <View style={styles.card}>
          <PrefRow icon="bell-outline" label="Notifications" value={isNotificationsEnabled} onToggle={toggleNotifications} colors={colors} />
          <PrefRow icon="theme-light-dark" label="Dark Mode" value={isDarkMode} onToggle={toggleTheme} colors={colors} />

          <TouchableOpacity style={styles.rowTouch} onPress={() => setResetModalVisible(true)}>
            <Icon name="lock-outline" size={20} color={colors.primaryAccent} />
            <Text style={[styles.rowLabel, { color: colors.primaryAccent }]}>Change Password</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={() => setLogoutVisible(true)}>
          <Icon name="logout" size={18} color="#fff" />
          <Text style={styles.logoutBtnText}>Log Out</Text>
        </TouchableOpacity>
        </>
        )}

        <View style={{ height: 90 }} />
      </ScrollView>

      {/* FULL IMAGE */}
      <Modal visible={showFullImage} transparent animationType="fade">
        <Pressable style={styles.fullImageOverlay} onPress={() => setShowFullImage(false)}>
          {profileImage ? (
            <Image source={{ uri: profileImage }} style={styles.fullImage} />
          ) : (
            <Icon name="account" size={160} color="#fff" />
          )}
        </Pressable>
      </Modal>

      {/* QR MODAL */}
      <Modal visible={showQr} transparent>
        <Pressable style={styles.qrFullScreen} onPress={closeQr}>
          <Animated.View style={{ transform: [{ scale: qrScale }] }}>
            <View style={styles.qrCard}>
              <QRCode value="https://www.instagram.com/geek_kid_offc" size={220} color={colors.primaryText} backgroundColor="transparent" />
            </View>
          </Animated.View>
        </Pressable>
      </Modal>

      {/* PHOTO OPTIONS */}
      <Modal visible={photoOptionsVisible} transparent animationType="fade">
        <View style={styles.optionsOverlay}>
          <View style={[styles.optionsCard, { backgroundColor: colors.cardBackground }]}>
            <Pressable style={styles.optionRow} onPress={() => setShowFullImage(true)}>
              <Icon name="eye-outline" size={22} color={colors.primaryAccent} />
              <Text style={styles.optionText}>View Photo</Text>
            </Pressable>

            <Pressable style={styles.optionRow} onPress={pickFromGallery}>
              <Icon name="image-outline" size={22} color={colors.primaryAccent} />
              <Text style={styles.optionText}>Choose from Gallery</Text>
            </Pressable>

            <Pressable style={styles.optionRow} onPress={takePhoto}>
              <Icon name="camera-outline" size={22} color={colors.primaryAccent} />
              <Text style={styles.optionText}>Take Photo</Text>
            </Pressable>

            {profileImage && (
              <Pressable style={styles.optionRow} onPress={removePhoto}>
                <Icon name="delete-outline" size={22} color="#E74C3C" />
                <Text style={[styles.optionText, { color: "#E74C3C" }]}>Remove Photo</Text>
              </Pressable>
            )}

            <Pressable style={[styles.optionRow, styles.cancelOption]} onPress={() => setPhotoOptionsVisible(false)}>
              <Text style={[styles.optionText, { color: colors.primaryAccent, fontWeight: "700" }]}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* EDIT PROFILE (UPDATED UI) */}
      <EditProfileModal
        visible={editModalVisible}
        onClose={() => setEditModalVisible(false)}
        user={user}
        onSave={handleProfileUpdate}
        colors={colors}
      />

      {/* RESET PASSWORD */}
      <ResetPasswordModal visible={resetModalVisible} onClose={() => setResetModalVisible(false)} />

      {/* LOGOUT BOTTOM SHEET */}
      <Modal visible={logoutVisible} transparent animationType="slide">
        <View style={styles.bottomOverlay}>
          <View style={[styles.bottomSheet, { backgroundColor: colors.cardBackground }]}>
            <Icon name="alert-circle-outline" size={50} color="#E74C3C" />
            <Text style={[styles.popupTitle, { color: colors.primaryText }]}>Confirm Logout</Text>
            <Text style={[styles.popupMessage, { color: colors.secondaryText }]}>
              Are you sure you want to log out of your account?
            </Text>

            <View style={styles.popupButtons}>
              <Pressable onPress={() => setLogoutVisible(false)} style={[styles.cancelBtn, { backgroundColor: colors.primaryAccent }]}>
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

/* ─────────────────────────────────────────────────────────── */
/* CONTACT ROW + PREF ROW */
/* ─────────────────────────────────────────────────────────── */

const ContactRow = ({ icon, label, value, colors }) => (
  <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
    <Icon name={icon} size={20} color={colors.primaryAccent} />
    <View style={{ marginLeft: 12, flex: 1 }}>
      <Text style={{ fontSize: 13, color: colors.secondaryText }}>{label}</Text>
      <Text style={{ fontSize: 15, fontWeight: "600", color: colors.primaryText }}>{value}</Text>
    </View>
  </View>
);

const PrefRow = ({ icon, label, value, onToggle, colors }) => (
  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <Icon name={icon} size={20} color={colors.primaryAccent} />
      <Text style={{ marginLeft: 10, fontSize: 16, color: colors.primaryText }}>{label}</Text>
    </View>

    <Switch
      value={value}
      onValueChange={onToggle}
      thumbColor={colors.cardBackground}
      trackColor={{ false: colors.divider, true: colors.primaryAccent }}
    />
  </View>
);

/* ─────────────────────────────────────────────────────────── */
/* UPDATED EDIT PROFILE MODAL (WITH NEW INPUT STYLE) */
/* ─────────────────────────────────────────────────────────── */

function EditProfileModal({ visible, onClose, user, onSave, colors }) {
  const styles = editModalStyles(colors);

  const [name, setName] = useState(user.name || "");
  const [program, setProgram] = useState(user.program || "");
  const [email, setEmail] = useState(user.email || "");
  const [phone, setPhone] = useState(user.phone || "");
  const [address, setAddress] = useState(user.address || "");

  useEffect(() => {
    setName(user.name || "");
    setProgram(user.program || "");
    setEmail(user.email || "");
    setPhone(user.phone || "");
    setAddress(user.address || "");
  }, [user, visible]);

  const handleSave = () => {
    onSave({ name, program, email, phone, address });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.container}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
          <Text style={[styles.title, { color: colors.primaryText }]}>Edit Profile</Text>

          <ScrollView style={{ width: "100%", marginTop: 8 }}>
            <EditField icon="account" value={name} onChange={setName} placeholder="Full name" colors={colors} />
            <EditField icon="school-outline" value={program} onChange={setProgram} placeholder="Program" colors={colors} />
            <EditField icon="email-outline" value={email} onChange={setEmail} placeholder="Email" keyboardType="email-address" colors={colors} />
            <EditField icon="phone-outline" value={phone} onChange={setPhone} placeholder="Phone" keyboardType="phone-pad" colors={colors} />
            <EditField icon="map-marker-outline" value={address} onChange={setAddress} placeholder="Address" multiline colors={colors} />
          </ScrollView>

          <View style={styles.buttonsRow}>
            <Pressable onPress={onClose} style={[styles.btn, { backgroundColor: "#999" }]}>
              <Text style={styles.btnText}>Cancel</Text>
            </Pressable>

            <Pressable onPress={handleSave} style={[styles.btn, { backgroundColor: colors.primaryAccent }]}>
              <Text style={styles.btnText}>Save</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* UPDATED INPUT FIELD (LIKE YOUR SCREENSHOT) */
const EditField = ({ icon, value, onChange, placeholder, colors, multiline, keyboardType }) => (
  <View
    style={{
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.divider,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: multiline ? 12 : 10,
      marginBottom: 14,
      backgroundColor: colors.primaryBackground,
      elevation: 1,
    }}
  >
    <Icon name={icon} size={22} color={colors.primaryAccent} style={{ marginRight: 12 }} />

    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={colors.secondaryText}
      style={{
        flex: 1,
        color: colors.primaryText,
        fontSize: 15,
        paddingVertical: 2,
        minHeight: multiline ? 60 : 24,
      }}
      multiline={multiline}
      keyboardType={keyboardType}
    />
  </View>
);

/* ─────────────────────────────────────────────────────────── */
/* STYLES */
/* ─────────────────────────────────────────────────────────── */

const getStyles = (colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.primaryBackground },
    contentContainer: { padding: 20, paddingTop: Platform.OS === "android" ? 70 : 50 },
    pageHeader: { fontSize: 24, fontWeight: "800", marginBottom: 18, color: colors.primaryText },
    profileCard: {
      flexDirection: "row",
      backgroundColor: colors.cardBackground,
      padding: 14,
      borderRadius: 14,
      elevation: 6,
      marginBottom: 18,
      alignItems: "center",
      borderLeftWidth: 4,
      borderLeftColor: colors.primaryAccent,
    },
    avatarCircle: {
      width: 96,
      height: 96,
      borderRadius: 60,
      backgroundColor: colors.primaryAccent,
      justifyContent: "center",
      alignItems: "center",
      position: "relative",
    },
    avatarImage: { width: "100%", height: "100%", borderRadius: 60 },
    qrBadge: {
      position: "absolute",
      bottom: -5,
      right: -5,
      backgroundColor: "#000",
      padding: 5,
      borderRadius: 30,
      borderWidth: 3,
      borderColor: colors.cardBackground,
    },
    detailsArea: { marginLeft: 16, flex: 1 },
    nameText: { fontSize: 20, fontWeight: "800", color: colors.primaryText },
    programText: { fontSize: 14, color: colors.secondaryText, marginTop: 3 },
    idText: { fontSize: 13, color: colors.disabledText, marginTop: 4 },
    editBtn: {
      marginTop: 10,
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.primaryAccent,
      paddingVertical: 8,
      paddingHorizontal: 14,
      width: 120,
      borderRadius: 8,
    },
    editBtnText: { color: "#fff", marginLeft: 8, fontWeight: "700" },
    sectionHeader: { fontSize: 18, fontWeight: "700", color: colors.primaryText, marginBottom: 8 },
    card: { backgroundColor: colors.cardBackground, padding: 14, borderRadius: 12, elevation: 3, marginBottom: 18 },
    rowTouch: { flexDirection: "row", alignItems: "center", paddingVertical: 10 },
    rowLabel: { marginLeft: 12, fontSize: 16 },
    logoutBtn: { backgroundColor: "#E74C3C", paddingVertical: 14, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center" },
    logoutBtnText: { color: "#fff", marginLeft: 10, fontWeight: "700" },
    fullImageOverlay: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.9)" },
    fullImage: { width: "92%", height: "80%", resizeMode: "contain", borderRadius: 10 },
    qrFullScreen: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.9)" },
    qrCard: { backgroundColor: "transparent", padding: 10, alignItems: "center" },
    optionsOverlay: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.45)" },
    optionsCard: { width: "86%", padding: 14, borderRadius: 12, elevation: 6 },
    optionRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12 },
    optionText: { marginLeft: 12, fontSize: 16, color: colors.primaryText },
    cancelOption: { justifyContent: "center" },
    bottomOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" },
    bottomSheet: { padding: 22, borderTopLeftRadius: 20, borderTopRightRadius: 20, alignItems: "center" },
    popupTitle: { fontSize: 20, fontWeight: "800", marginTop: 12 },
    popupMessage: { fontSize: 15, marginTop: 6, textAlign: "center" },
    popupButtons: { flexDirection: "row", width: "100%", marginTop: 22, gap: 12 },
    cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: "center" },
    logoutConfirmBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: "center" },
    popupBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  });

const editModalStyles = (colors) =>
  StyleSheet.create({
    container: { flex: 1, justifyContent: "center" },
    backdrop: { position: "absolute", backgroundColor: "rgba(0,0,0,0.45)", top: 0, bottom: 0, left: 0, right: 0 },
    card: { marginHorizontal: 16, borderRadius: 12, padding: 16, elevation: 10, width: "94%", alignSelf: "center" },
    title: { fontSize: 18, fontWeight: "800", textAlign: "center", marginBottom: 10 },
    buttonsRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 16 },
    btn: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: "center", marginHorizontal: 6 },
    btnText: { color: "#fff", fontWeight: "800" },
  });
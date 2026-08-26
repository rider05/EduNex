// ResetPasswordModal.js
import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  Animated,
  Dimensions,
  Easing,
  StyleSheet,
  StatusBar,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../../context/ThemeContext"; // <- same theme you use in ProfileScreen

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

export default function ResetPasswordModal({ visible, onClose, onReset }) {
  // Use the same useTheme shape as ProfileScreen
  const { colors = {}, isDarkMode } = useTheme() || {};

  // Local form state
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // toast
  const [toastMsg, setToastMsg] = useState("");
  const [toastVisible, setToastVisible] = useState(false);

  // animation
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  // Animation on visible change
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 350,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: SCREEN_HEIGHT, duration: 300, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, fadeAnim, slideAnim]);

  const showToast = (message) => {
    setToastMsg(message);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2000);
  };

  const handleReset = () => {
    if (!email || !newPassword || !confirmPassword) return showToast("Please fill all fields!");
    if (newPassword !== confirmPassword) return showToast("Passwords do not match!");
    showToast("Password reset successful!");
    setTimeout(() => {
      onReset?.();
      // clear form after success
      clearForm();
      onClose?.();
    }, 1200);
  };

  // Clear form values
  const clearForm = () => {
    setEmail("");
    setNewPassword("");
    setConfirmPassword("");
    setShowPassword(false);
  };

  // Back to Home: clear values and close modal
  const handleBackToHome = () => {
    clearForm();
    onClose?.();
  };

  // gradient same as login: kept as requested
  const gradientColors = ["#2D4EFF", "#6C63FF", "#8A79FF"];

  // Use theme colors for card internals (only inside card)
  const cardBg = colors.cardBackground ?? (isDarkMode ? "#1C1C1E" : "#FFFFFF");
  const textColor = colors.primaryText ?? (isDarkMode ? "#FFFFFF" : "#111827");
  const subTextColor = colors.secondaryText ?? (isDarkMode ? "#AAAAAA" : "#555555");
  const inputBg = colors.inputBackground ?? (isDarkMode ? "#2B2B2E" : "#F5F6FA");
  const borderColor = colors.divider ?? (isDarkMode ? "#333" : "#E6E6E6");
  const placeholderColor = colors.placeholder ?? (isDarkMode ? "#888888" : "#777777");
  const iconColor = colors.iconColor ?? (isDarkMode ? "#CCCCCC" : "#555555");

  return (
    <Modal visible={visible} transparent={false} animationType="none">
      <StatusBar
        barStyle={isDarkMode ? "light-content" : "dark-content"}
        backgroundColor={gradientColors[0]}
      />

      <Animated.View
        style={[
          styles.overlay,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {/* gradient background (same as login) */}
        <LinearGradient colors={gradientColors} style={styles.gradientBackground}>
          <View style={styles.centeredContainer}>
            <View style={[styles.card, { backgroundColor: cardBg, borderColor, borderWidth: 1 }]}>
              <Text style={[styles.title, { color: isDarkMode ? "#fff" : "#2D4EFF" }]}>Reset Password</Text>
              <Text style={[styles.subtitle, { color: subTextColor }]}>Enter your email and new password below</Text>

              {/* Email */}
              <View style={[styles.inputGroup, { backgroundColor: inputBg, borderColor }]}>
                <Icon name="email-outline" size={22} color={iconColor} />
                <TextInput
                  style={[styles.input, { color: textColor }]}
                  placeholder="Email Address"
                  placeholderTextColor={placeholderColor}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>

              {/* New Password */}
              <View style={[styles.inputGroup, { backgroundColor: inputBg, borderColor }]}>
                <Icon name="lock-outline" size={22} color={iconColor} />
                <TextInput
                  style={[styles.input, { color: textColor }]}
                  placeholder="New Password"
                  placeholderTextColor={placeholderColor}
                  secureTextEntry={!showPassword}
                  value={newPassword}
                  onChangeText={setNewPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword((s) => !s)}>
                  <Icon name={showPassword ? "eye-off" : "eye"} size={22} color={iconColor} />
                </TouchableOpacity>
              </View>

              {/* Confirm Password */}
              <View style={[styles.inputGroup, { backgroundColor: inputBg, borderColor }]}>
                <Icon name="lock-check-outline" size={22} color={iconColor} />
                <TextInput
                  style={[styles.input, { color: textColor }]}
                  placeholder="Confirm Password"
                  placeholderTextColor={placeholderColor}
                  secureTextEntry={!showPassword}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                />
              </View>

              {/* Reset Button */}
              <TouchableOpacity style={[styles.primaryButton, { backgroundColor: "#2D4EFF" }]} onPress={handleReset}>
                <Text style={styles.buttonText}>RESET PASSWORD</Text>
              </TouchableOpacity>

              {/* Back to Home - clears values then closes */}
              <TouchableOpacity onPress={handleBackToHome}>
                <Text style={[styles.backText, { color: isDarkMode ? "#BBBBBB" : "#333333" }]}>Back to Home</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* toast */}
          {toastVisible && (
            <View style={[styles.toast, { backgroundColor: isDarkMode ? "#444" : "#000" }]}>
              <Text style={styles.toastText}>{toastMsg}</Text>
            </View>
          )}
        </LinearGradient>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, width: "100%", height: "100%" },
  gradientBackground: { flex: 1, justifyContent: "center", alignItems: "center" },
  centeredContainer: { width: "100%", alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
  card: {
    width: SCREEN_WIDTH * 0.9,
    borderRadius: 25,
    padding: 25,
    alignItems: "center",
    elevation: 8,
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
  },
  title: { fontSize: 26, fontWeight: "700", marginBottom: 5 },
  subtitle: { fontSize: 14, marginBottom: 20, textAlign: "center" },
  inputGroup: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 15,
    paddingHorizontal: 12,
    marginVertical: 8,
    width: "100%",
    height: 50,
  },
  input: { flex: 1, fontSize: 16, marginLeft: 8 },
  primaryButton: { paddingVertical: 14, borderRadius: 15, marginTop: 15, width: "100%", alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  backText: { marginTop: 15, fontSize: 14, textDecorationLine: "underline" },
  toast: { position: "absolute", bottom: 40, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 25 },
  toastText: { color: "#fff", fontWeight: "600", fontSize: 14 },
});
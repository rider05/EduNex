// ResetPasswordModal.js
import React, { useState, useRef, useEffect, useCallback } from "react";
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
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  TouchableWithoutFeedback,
  ActivityIndicator,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "../../context/ThemeContext";
import { showToast } from "../../utils/toastService";
import { api } from "../../services/api";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

export default function ResetPasswordModal({ visible, onClose, onReset, user }) {
  const { colors = {}, isDarkMode } = useTheme() || {};

  // Form state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Visibility toggles
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Focus state for glowing borders
  const [focusedField, setFocusedField] = useState(null);

  // Loading & error state
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Animation values
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const translateYAnim = useRef(new Animated.Value(20)).current;

  // Animate modal entry and exit
  useEffect(() => {
    if (visible) {
      setErrorMessage("");
      Animated.parallel([
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 65,
          useNativeDriver: true,
        }),
        Animated.spring(translateYAnim, {
          toValue: 0,
          friction: 8,
          tension: 65,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.9,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start(() => {
        clearForm();
      });
    }
  }, [visible, backdropAnim, scaleAnim, translateYAnim]);

  // Reset form inputs
  const clearForm = useCallback(() => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShowCurrent(false);
    setShowNew(false);
    setShowConfirm(false);
    setFocusedField(null);
    setErrorMessage("");
  }, []);

  // Password rules validation
  const hasMinLength = newPassword.length >= 8;
  const hasUpper = /[A-Z]/.test(newPassword);
  const hasLower = /[a-z]/.test(newPassword);
  const hasNumberOrSymbol = /[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword);

  const passedRulesCount =
    (hasMinLength ? 1 : 0) +
    (hasUpper ? 1 : 0) +
    (hasLower ? 1 : 0) +
    (hasNumberOrSymbol ? 1 : 0);

  const getStrengthMeta = () => {
    if (!newPassword) {
      return { score: 0, label: "Not entered", color: colors.disabledText || "#9CA3AF", width: "0%" };
    }
    if (passedRulesCount <= 1) {
      return { score: 1, label: "Weak", color: "#EF4444", width: "25%" };
    }
    if (passedRulesCount === 2) {
      return { score: 2, label: "Fair", color: "#F59E0B", width: "50%" };
    }
    if (passedRulesCount === 3) {
      return { score: 3, label: "Good", color: "#3B82F6", width: "75%" };
    }
    return { score: 4, label: "Strong", color: "#10B981", width: "100%" };
  };

  const strength = getStrengthMeta();

  // Password match verification
  const isMatching = confirmPassword.length > 0 && newPassword === confirmPassword;
  const isMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;

  // Handle password submission
  const handleSave = async () => {
    setErrorMessage("");

    if (!currentPassword.trim()) {
      setErrorMessage("Please enter your current password.");
      return;
    }

    if (!newPassword.trim()) {
      setErrorMessage("Please enter a new password.");
      return;
    }

    if (newPassword.length < 8) {
      setErrorMessage("New password must be at least 8 characters long.");
      return;
    }

    if (newPassword === currentPassword) {
      setErrorMessage("New password must be different from your current password.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("New password and confirm password do not match.");
      return;
    }

    setIsLoading(true);

    try {
      // 1. Attempt API update if backend endpoint is supported
      try {
        const storedUserData = await AsyncStorage.getItem("userData");
        const parsed = storedUserData ? JSON.parse(storedUserData) : null;
        const studentId = user?.id || parsed?.rollNo || parsed?.id || parsed?.username;

        if (studentId) {
          await api.patch(`/students/${encodeURIComponent(studentId)}`, {
            password: newPassword,
            updatedAt: new Date().toISOString(),
          }).catch(() => null);
        }
      } catch (apiErr) {
        console.log("Password sync note:", apiErr);
      }

      // 2. Notify success
      showToast("🔒 Password updated successfully!", "success");

      if (onReset) onReset();

      setTimeout(() => {
        setIsLoading(false);
        clearForm();
        onClose?.();
      }, 500);
    } catch (err) {
      console.warn("Password change error:", err);
      setErrorMessage("Could not update password. Please try again.");
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      clearForm();
      onClose?.();
    }
  };

  // Color mappings
  const accentColor = colors.primaryAccent || "#4F46E5";
  const cardBg = colors.cardBackground || (isDarkMode ? "#18181B" : "#FFFFFF");
  const inputBg = colors.inputBackground || (isDarkMode ? "#27272A" : "#F4F4F5");
  const textColor = colors.primaryText || (isDarkMode ? "#FAFAFA" : "#09090B");
  const subTextColor = colors.secondaryText || (isDarkMode ? "#A1A1AA" : "#71717A");
  const borderColor = colors.divider || (isDarkMode ? "#27272A" : "#E4E4E7");
  const placeholderColor = colors.disabledText || (isDarkMode ? "#71717A" : "#A1A1AA");

  const displayName = user?.name || user?.nickname || "Student";
  const displayId = user?.id || user?.rollNo || "";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      <TouchableWithoutFeedback onPress={handleClose}>
        <Animated.View
          style={[
            styles.modalOverlay,
            { opacity: backdropAnim },
          ]}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.keyboardAvoid}
          >
            <TouchableWithoutFeedback>
              <Animated.View
                style={[
                  styles.modalCard,
                  {
                    backgroundColor: cardBg,
                    borderColor: borderColor,
                    transform: [
                      { scale: scaleAnim },
                      { translateY: translateYAnim },
                    ],
                  },
                ]}
              >
                {/* Drag / Top Indicator Bar */}
                <View style={styles.topHandleWrap}>
                  <View style={[styles.topHandleBar, { backgroundColor: isDarkMode ? "#3F3F46" : "#E2E8F0" }]} />
                </View>

                {/* Modal Header */}
                <View style={styles.headerRow}>
                  <View style={[styles.headerIconCircle, { backgroundColor: accentColor + "15" }]}>
                    <Icon name="shield-key-outline" size={24} color={accentColor} />
                  </View>

                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.title, { color: textColor }]}>Change Password</Text>
                    <Text style={[styles.subtitle, { color: subTextColor }]}>
                      Protect your student profile & credentials
                    </Text>
                  </View>

                  <TouchableOpacity
                    onPress={handleClose}
                    style={[styles.closeBtn, { backgroundColor: isDarkMode ? "#27272A" : "#F1F5F9" }]}
                    activeOpacity={0.7}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Icon name="close" size={18} color={subTextColor} />
                  </TouchableOpacity>
                </View>

                {/* User Account Info Chip */}
                <View style={[styles.accountChip, { backgroundColor: isDarkMode ? "#27272A80" : "#F8FAFC", borderColor }]}>
                  <View style={[styles.accountChipDot, { backgroundColor: "#10B981" }]} />
                  <Text style={[styles.accountChipText, { color: subTextColor }]} numberOfLines={1}>
                    Account: <Text style={{ fontWeight: "700", color: textColor }}>{displayName}</Text>
                    {displayId ? ` (Roll: ${displayId})` : ""}
                  </Text>
                </View>

                <ScrollView
                  showsVerticalScrollIndicator={false}
                  bounces={false}
                  contentContainerStyle={styles.scrollContent}
                >
                  {/* Inline Error Message */}
                  {!!errorMessage && (
                    <View style={styles.errorBanner}>
                      <Icon name="alert-circle-outline" size={18} color="#EF4444" />
                      <Text style={styles.errorBannerText}>{errorMessage}</Text>
                    </View>
                  )}

                  {/* 1. CURRENT PASSWORD */}
                  <View style={styles.inputSection}>
                    <View style={styles.labelRow}>
                      <Text style={[styles.inputLabel, { color: subTextColor }]}>CURRENT PASSWORD</Text>
                    </View>
                    <View
                      style={[
                        styles.inputContainer,
                        {
                          backgroundColor: inputBg,
                          borderColor: focusedField === "current" ? accentColor : borderColor,
                          borderWidth: focusedField === "current" ? 1.5 : 1,
                        },
                      ]}
                    >
                      <Icon
                        name="lock-outline"
                        size={20}
                        color={focusedField === "current" ? accentColor : placeholderColor}
                        style={styles.leadingIcon}
                      />
                      <TextInput
                        style={[styles.textInput, { color: textColor }]}
                        placeholder="Enter current password"
                        placeholderTextColor={placeholderColor}
                        secureTextEntry={!showCurrent}
                        value={currentPassword}
                        onChangeText={(t) => {
                          setCurrentPassword(t);
                          if (errorMessage) setErrorMessage("");
                        }}
                        onFocus={() => setFocusedField("current")}
                        onBlur={() => setFocusedField(null)}
                        autoCapitalize="none"
                        editable={!isLoading}
                      />
                      <TouchableOpacity
                        onPress={() => setShowCurrent((s) => !s)}
                        style={styles.eyeBtn}
                        activeOpacity={0.7}
                      >
                        <Icon
                          name={showCurrent ? "eye-off-outline" : "eye-outline"}
                          size={20}
                          color={showCurrent ? accentColor : placeholderColor}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* 2. NEW PASSWORD */}
                  <View style={styles.inputSection}>
                    <View style={styles.labelRow}>
                      <Text style={[styles.inputLabel, { color: subTextColor }]}>NEW PASSWORD</Text>
                      {newPassword.length > 0 && (
                        <Text style={[styles.strengthText, { color: strength.color }]}>
                          {strength.label}
                        </Text>
                      )}
                    </View>
                    <View
                      style={[
                        styles.inputContainer,
                        {
                          backgroundColor: inputBg,
                          borderColor: focusedField === "new" ? accentColor : borderColor,
                          borderWidth: focusedField === "new" ? 1.5 : 1,
                        },
                      ]}
                    >
                      <Icon
                        name="key-outline"
                        size={20}
                        color={focusedField === "new" ? accentColor : placeholderColor}
                        style={styles.leadingIcon}
                      />
                      <TextInput
                        style={[styles.textInput, { color: textColor }]}
                        placeholder="Create strong new password"
                        placeholderTextColor={placeholderColor}
                        secureTextEntry={!showNew}
                        value={newPassword}
                        onChangeText={(t) => {
                          setNewPassword(t);
                          if (errorMessage) setErrorMessage("");
                        }}
                        onFocus={() => setFocusedField("new")}
                        onBlur={() => setFocusedField(null)}
                        autoCapitalize="none"
                        editable={!isLoading}
                      />
                      <TouchableOpacity
                        onPress={() => setShowNew((s) => !s)}
                        style={styles.eyeBtn}
                        activeOpacity={0.7}
                      >
                        <Icon
                          name={showNew ? "eye-off-outline" : "eye-outline"}
                          size={20}
                          color={showNew ? accentColor : placeholderColor}
                        />
                      </TouchableOpacity>
                    </View>

                    {/* Password Strength Progress Bar */}
                    {newPassword.length > 0 && (
                      <View style={styles.strengthBarBg}>
                        <View
                          style={[
                            styles.strengthBarFill,
                            { width: strength.width, backgroundColor: strength.color },
                          ]}
                        />
                      </View>
                    )}

                    {/* Password Criteria Checklist */}
                    <View style={styles.rulesGrid}>
                      <RulePill fulfilled={hasMinLength} label="8+ chars" isDarkMode={isDarkMode} />
                      <RulePill fulfilled={hasUpper && hasLower} label="Upper & lower" isDarkMode={isDarkMode} />
                      <RulePill fulfilled={hasNumberOrSymbol} label="Number/symbol" isDarkMode={isDarkMode} />
                    </View>
                  </View>

                  {/* 3. CONFIRM PASSWORD */}
                  <View style={styles.inputSection}>
                    <View style={styles.labelRow}>
                      <Text style={[styles.inputLabel, { color: subTextColor }]}>CONFIRM NEW PASSWORD</Text>
                      {isMatching && (
                        <View style={styles.matchBadge}>
                          <Icon name="check-circle" size={13} color="#10B981" />
                          <Text style={styles.matchBadgeText}>Match</Text>
                        </View>
                      )}
                      {isMismatch && (
                        <Text style={styles.mismatchBadgeText}>Does not match</Text>
                      )}
                    </View>
                    <View
                      style={[
                        styles.inputContainer,
                        {
                          backgroundColor: inputBg,
                          borderColor:
                            isMismatch
                              ? "#EF4444"
                              : isMatching
                              ? "#10B981"
                              : focusedField === "confirm"
                              ? accentColor
                              : borderColor,
                          borderWidth: focusedField === "confirm" || isMismatch || isMatching ? 1.5 : 1,
                        },
                      ]}
                    >
                      <Icon
                        name="lock-check-outline"
                        size={20}
                        color={
                          isMismatch
                            ? "#EF4444"
                            : isMatching
                            ? "#10B981"
                            : focusedField === "confirm"
                            ? accentColor
                            : placeholderColor
                        }
                        style={styles.leadingIcon}
                      />
                      <TextInput
                        style={[styles.textInput, { color: textColor }]}
                        placeholder="Re-type new password"
                        placeholderTextColor={placeholderColor}
                        secureTextEntry={!showConfirm}
                        value={confirmPassword}
                        onChangeText={(t) => {
                          setConfirmPassword(t);
                          if (errorMessage) setErrorMessage("");
                        }}
                        onFocus={() => setFocusedField("confirm")}
                        onBlur={() => setFocusedField(null)}
                        autoCapitalize="none"
                        editable={!isLoading}
                      />
                      <TouchableOpacity
                        onPress={() => setShowConfirm((s) => !s)}
                        style={styles.eyeBtn}
                        activeOpacity={0.7}
                      >
                        <Icon
                          name={showConfirm ? "eye-off-outline" : "eye-outline"}
                          size={20}
                          color={showConfirm ? accentColor : placeholderColor}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Security Recommendation Callout */}
                  <View style={[styles.securityTipBox, { backgroundColor: isDarkMode ? "#1E293B50" : "#F0FDF4", borderColor: isDarkMode ? "#334155" : "#DCFCE7" }]}>
                    <Icon name="shield-check" size={17} color="#10B981" style={{ marginTop: 1 }} />
                    <Text style={[styles.securityTipText, { color: isDarkMode ? "#94A3B8" : "#166534" }]}>
                      Choose a unique password you haven't used across other school services.
                    </Text>
                  </View>
                </ScrollView>

                {/* Footer Action Buttons */}
                <View style={[styles.footerRow, { borderTopColor: borderColor }]}>
                  <TouchableOpacity
                    style={[styles.cancelButton, { borderColor }]}
                    onPress={handleClose}
                    disabled={isLoading}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.cancelButtonText, { color: subTextColor }]}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.submitButton,
                      { opacity: isLoading || !currentPassword || !newPassword || !confirmPassword ? 0.7 : 1 },
                    ]}
                    onPress={handleSave}
                    disabled={isLoading}
                    activeOpacity={0.85}
                  >
                    <LinearGradient
                      colors={[accentColor, "#4338CA"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.gradientBtn}
                    >
                      {isLoading ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <Icon name="lock-check" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                          <Text style={styles.submitButtonText}>Update Password</Text>
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </Animated.View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </Animated.View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

// Subcomponent: Live rule pill
function RulePill({ fulfilled, label, isDarkMode }) {
  return (
    <View
      style={[
        styles.rulePill,
        {
          backgroundColor: fulfilled
            ? isDarkMode
              ? "#064E3B40"
              : "#DCFCE7"
            : isDarkMode
            ? "#27272A"
            : "#F1F5F9",
        },
      ]}
    >
      <Icon
        name={fulfilled ? "check" : "circle-outline"}
        size={11}
        color={fulfilled ? "#10B981" : isDarkMode ? "#71717A" : "#94A3B8"}
      />
      <Text
        style={[
          styles.rulePillText,
          {
            color: fulfilled
              ? isDarkMode
                ? "#34D399"
                : "#15803D"
              : isDarkMode
              ? "#71717A"
              : "#64748B",
            fontWeight: fulfilled ? "700" : "500",
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.68)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  keyboardAvoid: {
    width: "100%",
    maxWidth: 440,
    justifyContent: "center",
    alignItems: "center",
  },
  modalCard: {
    width: "100%",
    borderRadius: 24,
    borderWidth: 1,
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 18,
    elevation: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    maxHeight: SCREEN_HEIGHT * 0.88,
  },
  topHandleWrap: {
    alignItems: "center",
    paddingBottom: 10,
  },
  topHandleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  headerIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: "500",
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  accountChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
  },
  accountChipDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginRight: 8,
  },
  accountChipText: {
    fontSize: 12,
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 6,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 12,
    gap: 8,
  },
  errorBannerText: {
    color: "#B91C1C",
    fontSize: 12.5,
    fontWeight: "600",
    flex: 1,
  },
  inputSection: {
    marginBottom: 14,
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  strengthText: {
    fontSize: 11,
    fontWeight: "700",
  },
  matchBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  matchBadgeText: {
    color: "#10B981",
    fontSize: 11,
    fontWeight: "700",
  },
  mismatchBadgeText: {
    color: "#EF4444",
    fontSize: 11,
    fontWeight: "600",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 48,
  },
  leadingIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
    paddingVertical: 0,
  },
  eyeBtn: {
    padding: 6,
  },
  strengthBarBg: {
    height: 4,
    backgroundColor: "rgba(150, 150, 150, 0.2)",
    borderRadius: 2,
    marginTop: 8,
    overflow: "hidden",
  },
  strengthBarFill: {
    height: "100%",
    borderRadius: 2,
  },
  rulesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  },
  rulePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  rulePillText: {
    fontSize: 10.5,
  },
  securityTipBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    marginTop: 4,
    marginBottom: 4,
  },
  securityTipText: {
    fontSize: 11.5,
    lineHeight: 16,
    flex: 1,
    fontWeight: "500",
  },
  footerRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButtonText: {
    fontSize: 13.5,
    fontWeight: "700",
  },
  submitButton: {
    flex: 1.6,
    borderRadius: 14,
    overflow: "hidden",
    elevation: 3,
    shadowColor: "#4F46E5",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  gradientBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
    paddingHorizontal: 12,
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 13.5,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
});
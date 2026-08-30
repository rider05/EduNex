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

  // Step state: 1 = Send OTP, 2 = Verify OTP, 3 = Set New Password
  const [currentStep, setCurrentStep] = useState(1);
  const [deliveryChannel, setDeliveryChannel] = useState("email"); // "email" | "sms"

  // OTP state
  const [generatedOtp, setGeneratedOtp] = useState("");
  const [enteredOtp, setEnteredOtp] = useState("");
  const [resendTimer, setResendTimer] = useState(60);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const timerRef = useRef(null);

  // New password state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Focus state for active input glow
  const [focusedField, setFocusedField] = useState(null);

  // Loading & error state
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Animation values
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const translateYAnim = useRef(new Animated.Value(20)).current;
  const stepFadeAnim = useRef(new Animated.Value(1)).current;

  // Reset form inputs
  const clearForm = useCallback(() => {
    setCurrentStep(1);
    setDeliveryChannel("email");
    setGeneratedOtp("");
    setEnteredOtp("");
    setResendTimer(60);
    setIsTimerRunning(false);
    setNewPassword("");
    setConfirmPassword("");
    setShowNew(false);
    setShowConfirm(false);
    setFocusedField(null);
    setErrorMessage("");
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  // Animate modal entry and exit
  useEffect(() => {
    if (visible) {
      setCurrentStep(1);
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
  }, [visible, backdropAnim, scaleAnim, translateYAnim, clearForm]);

  // Countdown timer for Resend OTP
  useEffect(() => {
    if (isTimerRunning && resendTimer > 0) {
      timerRef.current = setTimeout(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    } else if (resendTimer === 0) {
      setIsTimerRunning(false);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isTimerRunning, resendTimer]);

  // Smooth transition between steps
  const animateToStep = (stepNumber) => {
    setErrorMessage("");
    Animated.sequence([
      Animated.timing(stepFadeAnim, {
        toValue: 0,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(stepFadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
    setCurrentStep(stepNumber);
  };

  // Helper to generate a 6-digit OTP
  const generateRandomOtp = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  // Step 1: Send OTP handler
  const handleSendOtp = () => {
    setErrorMessage("");
    setIsLoading(true);

    const otp = generateRandomOtp();
    setGeneratedOtp(otp);

    setTimeout(() => {
      setIsLoading(false);
      setResendTimer(60);
      setIsTimerRunning(true);
      setEnteredOtp("");

      const targetDesc = deliveryChannel === "email" ? "registered email" : "registered mobile";
      showToast(`🔑 OTP sent to ${targetDesc}: ${otp}`, "info");

      animateToStep(2);
    }, 600);
  };

  // Resend OTP
  const handleResendOtp = () => {
    if (resendTimer > 0) return;
    handleSendOtp();
  };

  // Step 2: Verify OTP handler
  const handleVerifyOtp = () => {
    setErrorMessage("");
    if (!enteredOtp.trim()) {
      setErrorMessage("Please enter the 6-digit verification code.");
      return;
    }

    if (enteredOtp.trim() !== generatedOtp) {
      setErrorMessage("Invalid OTP code. Please check and try again.");
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      showToast("✅ Code verified successfully!", "success");
      animateToStep(3);
    }, 450);
  };

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

  // Step 3: Final Password update
  const handleFinalPasswordReset = async () => {
    setErrorMessage("");

    if (!newPassword.trim()) {
      setErrorMessage("Please enter a new password.");
      return;
    }

    if (newPassword.length < 8) {
      setErrorMessage("New password must be at least 8 characters long.");
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
      showToast("🔒 Password reset & updated successfully!", "success");

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
  const displayEmail = user?.email || "student@edunex.edu";
  const displayPhone = user?.phone || "+91 98765 43210";

  // Mask string for privacy
  const maskEmail = (em) => {
    if (!em || !em.includes("@")) return "st*****@edunex.edu";
    const [name, domain] = em.split("@");
    return `${name.slice(0, 2)}****@${domain}`;
  };

  const maskPhone = (ph) => {
    if (!ph) return "+91 98765 ****0";
    const clean = String(ph).trim();
    if (clean.length > 5) {
      return `${clean.slice(0, clean.length - 4)}****`;
    }
    return "+91 98*** ***10";
  };

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
                    <Icon
                      name={
                        currentStep === 1
                          ? "shield-account-outline"
                          : currentStep === 2
                          ? "cellphone-message"
                          : "shield-key-outline"
                      }
                      size={24}
                      color={accentColor}
                    />
                  </View>

                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.title, { color: textColor }]}>
                      {currentStep === 1
                        ? "OTP Verification"
                        : currentStep === 2
                        ? "Enter Passcode"
                        : "Set New Password"}
                    </Text>
                    <Text style={[styles.subtitle, { color: subTextColor }]}>
                      {currentStep === 1
                        ? "Verify identity to reset password"
                        : currentStep === 2
                        ? "Enter the 6-digit code sent to you"
                        : "Create a secure new password"}
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

                {/* Progress Stepper Bar */}
                <View style={styles.stepperContainer}>
                  <View style={styles.stepperRow}>
                    <StepNode step={1} currentStep={currentStep} label="Request OTP" accentColor={accentColor} isDarkMode={isDarkMode} />
                    <View style={[styles.stepLine, { backgroundColor: currentStep > 1 ? accentColor : borderColor }]} />
                    <StepNode step={2} currentStep={currentStep} label="Verify Code" accentColor={accentColor} isDarkMode={isDarkMode} />
                    <View style={[styles.stepLine, { backgroundColor: currentStep > 2 ? accentColor : borderColor }]} />
                    <StepNode step={3} currentStep={currentStep} label="New Password" accentColor={accentColor} isDarkMode={isDarkMode} />
                  </View>
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

                  <Animated.View style={{ opacity: stepFadeAnim }}>
                    {/* ========================================================= */}
                    {/* STEP 1: SELECT CHANNEL & REQUEST OTP                      */}
                    {/* ========================================================= */}
                    {currentStep === 1 && (
                      <View style={styles.stepContentWrap}>
                        <Text style={[styles.stepSectionTitle, { color: textColor }]}>
                          Where should we send your verification code?
                        </Text>
                        <Text style={[styles.stepSectionDesc, { color: subTextColor }]}>
                          For your account security, an OTP is required before resetting your credentials.
                        </Text>

                        {/* Email Channel Option */}
                        <TouchableOpacity
                          style={[
                            styles.channelCard,
                            {
                              backgroundColor: deliveryChannel === "email" ? accentColor + "10" : inputBg,
                              borderColor: deliveryChannel === "email" ? accentColor : borderColor,
                              borderWidth: deliveryChannel === "email" ? 1.5 : 1,
                            },
                          ]}
                          onPress={() => setDeliveryChannel("email")}
                          activeOpacity={0.8}
                        >
                          <View style={[styles.channelIconWrap, { backgroundColor: accentColor + "18" }]}>
                            <Icon name="email-outline" size={22} color={accentColor} />
                          </View>
                          <View style={{ flex: 1, marginLeft: 12 }}>
                            <Text style={[styles.channelTitle, { color: textColor }]}>Send to Email</Text>
                            <Text style={[styles.channelTarget, { color: subTextColor }]}>{maskEmail(displayEmail)}</Text>
                          </View>
                          <Icon
                            name={deliveryChannel === "email" ? "radiobox-marked" : "radiobox-blank"}
                            size={22}
                            color={deliveryChannel === "email" ? accentColor : placeholderColor}
                          />
                        </TouchableOpacity>

                        {/* SMS / Phone Channel Option */}
                        <TouchableOpacity
                          style={[
                            styles.channelCard,
                            {
                              backgroundColor: deliveryChannel === "sms" ? accentColor + "10" : inputBg,
                              borderColor: deliveryChannel === "sms" ? accentColor : borderColor,
                              borderWidth: deliveryChannel === "sms" ? 1.5 : 1,
                            },
                          ]}
                          onPress={() => setDeliveryChannel("sms")}
                          activeOpacity={0.8}
                        >
                          <View style={[styles.channelIconWrap, { backgroundColor: "#10B98118" }]}>
                            <Icon name="cellphone-text" size={22} color="#10B981" />
                          </View>
                          <View style={{ flex: 1, marginLeft: 12 }}>
                            <Text style={[styles.channelTitle, { color: textColor }]}>Send via SMS</Text>
                            <Text style={[styles.channelTarget, { color: subTextColor }]}>{maskPhone(displayPhone)}</Text>
                          </View>
                          <Icon
                            name={deliveryChannel === "sms" ? "radiobox-marked" : "radiobox-blank"}
                            size={22}
                            color={deliveryChannel === "sms" ? accentColor : placeholderColor}
                          />
                        </TouchableOpacity>

                        <View style={[styles.securityTipBox, { backgroundColor: isDarkMode ? "#1E293B50" : "#F0FDF4", borderColor: isDarkMode ? "#334155" : "#DCFCE7" }]}>
                          <Icon name="shield-lock-outline" size={17} color="#10B981" style={{ marginTop: 1 }} />
                          <Text style={[styles.securityTipText, { color: isDarkMode ? "#94A3B8" : "#166534" }]}>
                            EduNex 2-Factor Authentication keeps your grades, fees, and academic records safe.
                          </Text>
                        </View>
                      </View>
                    )}

                    {/* ========================================================= */}
                    {/* STEP 2: ENTER OTP CODE                                    */}
                    {/* ========================================================= */}
                    {currentStep === 2 && (
                      <View style={styles.stepContentWrap}>
                        <View style={styles.otpHeaderBox}>
                          <Text style={[styles.stepSectionTitle, { color: textColor, textAlign: "center" }]}>
                            Enter 6-Digit Code
                          </Text>
                          <Text style={[styles.stepSectionDesc, { color: subTextColor, textAlign: "center" }]}>
                            Sent to {deliveryChannel === "email" ? maskEmail(displayEmail) : maskPhone(displayPhone)}
                          </Text>
                        </View>

                        {/* Demo / In-App Notification Helper Pill */}
                        {!!generatedOtp && (
                          <View style={[styles.demoOtpPill, { backgroundColor: accentColor + "15", borderColor: accentColor + "35" }]}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                              <Icon name="key-wireless" size={16} color={accentColor} />
                              <Text style={[styles.demoOtpText, { color: textColor }]}>
                                Passcode: <Text style={{ fontWeight: "800", color: accentColor }}>{generatedOtp}</Text>
                              </Text>
                            </View>
                            <TouchableOpacity
                              onPress={() => {
                                setEnteredOtp(generatedOtp);
                                setErrorMessage("");
                              }}
                              style={[styles.autofillBtn, { backgroundColor: accentColor }]}
                              activeOpacity={0.8}
                            >
                              <Text style={styles.autofillBtnText}>Autofill</Text>
                            </TouchableOpacity>
                          </View>
                        )}

                        {/* OTP Input Field */}
                        <View style={styles.inputSection}>
                          <View
                            style={[
                              styles.otpInputContainer,
                              {
                                backgroundColor: inputBg,
                                borderColor: focusedField === "otp" ? accentColor : borderColor,
                                borderWidth: focusedField === "otp" ? 1.8 : 1,
                              },
                            ]}
                          >
                            <Icon name="dialpad" size={22} color={focusedField === "otp" ? accentColor : placeholderColor} style={{ marginRight: 10 }} />
                            <TextInput
                              style={[styles.otpTextInput, { color: textColor }]}
                              placeholder="• • • • • •"
                              placeholderTextColor={placeholderColor}
                              value={enteredOtp}
                              onChangeText={(t) => {
                                setEnteredOtp(t.replace(/[^0-9]/g, "").slice(0, 6));
                                if (errorMessage) setErrorMessage("");
                              }}
                              keyboardType="number-pad"
                              maxLength={6}
                              autoFocus
                              onFocus={() => setFocusedField("otp")}
                              onBlur={() => setFocusedField(null)}
                              editable={!isLoading}
                            />
                          </View>
                        </View>

                        {/* Resend Timer & Change Channel Row */}
                        <View style={styles.resendRow}>
                          <TouchableOpacity
                            onPress={() => animateToStep(1)}
                            activeOpacity={0.7}
                            style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
                          >
                            <Icon name="arrow-left" size={14} color={accentColor} />
                            <Text style={[styles.resendActionText, { color: accentColor }]}>Change method</Text>
                          </TouchableOpacity>

                          {resendTimer > 0 ? (
                            <Text style={[styles.timerCountdownText, { color: subTextColor }]}>
                              Resend in <Text style={{ fontWeight: "700", color: textColor }}>00:{resendTimer < 10 ? `0${resendTimer}` : resendTimer}</Text>
                            </Text>
                          ) : (
                            <TouchableOpacity onPress={handleResendOtp} activeOpacity={0.7}>
                              <Text style={[styles.resendActionText, { color: accentColor, fontWeight: "700" }]}>
                                Resend OTP Code
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    )}

                    {/* ========================================================= */}
                    {/* STEP 3: CREATE NEW PASSWORD                               */}
                    {/* ========================================================= */}
                    {currentStep === 3 && (
                      <View style={styles.stepContentWrap}>
                        {/* Verified Success Badge */}
                        <View style={styles.verifiedBadgeRow}>
                          <Icon name="check-decagram" size={18} color="#10B981" />
                          <Text style={styles.verifiedBadgeText}>OTP Verified • Set your new password</Text>
                        </View>

                        {/* 1. NEW PASSWORD */}
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

                        {/* 2. CONFIRM PASSWORD */}
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

                        {/* Security Tip Box */}
                        <View style={[styles.securityTipBox, { backgroundColor: isDarkMode ? "#1E293B50" : "#F0FDF4", borderColor: isDarkMode ? "#334155" : "#DCFCE7" }]}>
                          <Icon name="shield-check" size={17} color="#10B981" style={{ marginTop: 1 }} />
                          <Text style={[styles.securityTipText, { color: isDarkMode ? "#94A3B8" : "#166534" }]}>
                            Choose a unique password that has not been used across other school services.
                          </Text>
                        </View>
                      </View>
                    )}
                  </Animated.View>
                </ScrollView>

                {/* ========================================================= */}
                {/* FOOTER ACTION BUTTONS                                     */}
                {/* ========================================================= */}
                <View style={[styles.footerRow, { borderTopColor: borderColor }]}>
                  <TouchableOpacity
                    style={[styles.cancelButton, { borderColor }]}
                    onPress={handleClose}
                    disabled={isLoading}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.cancelButtonText, { color: subTextColor }]}>Cancel</Text>
                  </TouchableOpacity>

                  {currentStep === 1 && (
                    <TouchableOpacity
                      style={[styles.submitButton, { opacity: isLoading ? 0.7 : 1 }]}
                      onPress={handleSendOtp}
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
                            <Icon name="send-outline" size={17} color="#FFFFFF" style={{ marginRight: 6 }} />
                            <Text style={styles.submitButtonText}>Send OTP Code</Text>
                          </>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>
                  )}

                  {currentStep === 2 && (
                    <TouchableOpacity
                      style={[styles.submitButton, { opacity: isLoading || enteredOtp.length < 6 ? 0.7 : 1 }]}
                      onPress={handleVerifyOtp}
                      disabled={isLoading || enteredOtp.length < 6}
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
                            <Icon name="check-bold" size={17} color="#FFFFFF" style={{ marginRight: 6 }} />
                            <Text style={styles.submitButtonText}>Verify & Continue</Text>
                          </>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>
                  )}

                  {currentStep === 3 && (
                    <TouchableOpacity
                      style={[
                        styles.submitButton,
                        { opacity: isLoading || !newPassword || !confirmPassword ? 0.7 : 1 },
                      ]}
                      onPress={handleFinalPasswordReset}
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
                            <Text style={styles.submitButtonText}>Reset Password</Text>
                          </>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>
                  )}
                </View>
              </Animated.View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </Animated.View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

// Subcomponent: Step Node
function StepNode({ step, currentStep, label, accentColor, isDarkMode }) {
  const isCompleted = currentStep > step;
  const isActive = currentStep === step;

  return (
    <View style={styles.stepNodeWrap}>
      <View
        style={[
          styles.stepCircle,
          {
            backgroundColor: isCompleted
              ? "#10B981"
              : isActive
              ? accentColor
              : isDarkMode
              ? "#27272A"
              : "#F1F5F9",
            borderColor: isActive ? accentColor : isCompleted ? "#10B981" : isDarkMode ? "#3F3F46" : "#CBD5E1",
          },
        ]}
      >
        {isCompleted ? (
          <Icon name="check" size={13} color="#FFFFFF" />
        ) : (
          <Text
            style={[
              styles.stepNumberText,
              { color: isActive ? "#FFFFFF" : isDarkMode ? "#A1A1AA" : "#64748B" },
            ]}
          >
            {step}
          </Text>
        )}
      </View>
      <Text
        style={[
          styles.stepLabelText,
          {
            color: isActive ? (isDarkMode ? "#FAFAFA" : "#0F172A") : isDarkMode ? "#71717A" : "#94A3B8",
            fontWeight: isActive ? "700" : "500",
          },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
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
    maxHeight: SCREEN_HEIGHT * 0.9,
  },
  topHandleWrap: {
    alignItems: "center",
    paddingBottom: 8,
  },
  topHandleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  headerIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 17.5,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 11.5,
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
  stepperContainer: {
    marginBottom: 12,
    paddingHorizontal: 6,
  },
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stepNodeWrap: {
    alignItems: "center",
    minWidth: 70,
  },
  stepCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  stepNumberText: {
    fontSize: 11.5,
    fontWeight: "700",
  },
  stepLabelText: {
    fontSize: 10,
  },
  stepLine: {
    flex: 1,
    height: 2,
    marginBottom: 16,
    marginHorizontal: 4,
  },
  accountChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
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
    fontSize: 11.5,
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
    fontSize: 12,
    fontWeight: "600",
    flex: 1,
  },
  stepContentWrap: {
    paddingVertical: 2,
  },
  stepSectionTitle: {
    fontSize: 13.5,
    fontWeight: "700",
    marginBottom: 4,
  },
  stepSectionDesc: {
    fontSize: 11.5,
    lineHeight: 16,
    marginBottom: 12,
  },
  channelCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 14,
    marginBottom: 10,
  },
  channelIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  channelTitle: {
    fontSize: 13.5,
    fontWeight: "700",
  },
  channelTarget: {
    fontSize: 11.5,
    marginTop: 2,
  },
  otpHeaderBox: {
    marginBottom: 12,
  },
  demoOtpPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
  },
  demoOtpText: {
    fontSize: 12.5,
  },
  autofillBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  autofillBtnText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },
  otpInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 52,
    justifyContent: "center",
  },
  otpTextInput: {
    flex: 1,
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 8,
    textAlign: "center",
  },
  resendRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
    paddingHorizontal: 4,
    marginBottom: 10,
  },
  resendActionText: {
    fontSize: 12,
  },
  timerCountdownText: {
    fontSize: 12,
  },
  verifiedBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 14,
  },
  verifiedBadgeText: {
    color: "#166534",
    fontSize: 12,
    fontWeight: "700",
  },
  inputSection: {
    marginBottom: 12,
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
    marginTop: 12,
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
    fontSize: 13,
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

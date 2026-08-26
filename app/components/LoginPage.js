// LoginPage.js (FULL — fixed & ready)
import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Animated,
  Dimensions,
  Easing,
  StatusBar,
  Platform,
  KeyboardAvoidingView,
  Keyboard,
  ScrollView,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { LinearGradient } from "expo-linear-gradient";
import * as NavigationBar from "expo-navigation-bar";
import * as Device from "expo-device";
import { api, setAuthSession } from "../services/api";
import { syncAfterLogin } from "../services/dataService";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const ROLE_OPTIONS = [
  { key: "stud", label: "Student", icon: "school" },
  { key: "staff", label: "Faculty", icon: "account-tie" },
  { key: "parent", label: "Parent", icon: "account-child" },
  { key: "admin", label: "Admin", icon: "shield-check" },
];

const TOAST_BG = {
  success: "#059669",
  warning: "#D97706",
  error: "#DC2626",
};

const TOAST_ICON = {
  success: "check-circle",
  warning: "alert-circle",
  error: "close-circle",
};

const TOAST_TITLE = {
  success: "Success",
  warning: "Notice",
  error: "Authentication Failed",
};

function LoginToast({ toastState }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [anim]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.toast,
        {
          opacity: anim,
          transform: [
            {
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [-28, 0],
              }),
            },
          ],
          backgroundColor: TOAST_BG[toastState.type] || TOAST_BG.info,
        },
      ]}
    >
      <Icon
        name={TOAST_ICON[toastState.type] || "information"}
        size={24}
        color="#FFFFFF"
        style={styles.toastIcon}
      />
      <View style={styles.toastTextWrap}>
        <Text style={styles.toastTitle}>
          {TOAST_TITLE[toastState.type] || "Notice"}
        </Text>
        <Text style={styles.toastText}>{toastState.msg}</Text>
      </View>
    </Animated.View>
  );
}

export default function CardLoginModal({ visible, onClose, onSkip }) {
  const [isLogin, setIsLogin] = useState(true);

  // Login fields
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Signup fields
  const [name, setName] = useState("");
  const [signupUsername, setSignupUsername] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [role, setRole] = useState("stud");
  const [signupPassword, setSignupPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Loading animation state
  const [isLoading, setIsLoading] = useState(false);
  const [loadingTitle, setLoadingTitle] = useState("");
  const [loadingSubtitle, setLoadingSubtitle] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  // Animations + toast state
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const fadeLoadingAnim = useRef(new Animated.Value(0)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const successScaleAnim = useRef(new Animated.Value(0.2)).current;

  const toastTimerRef = useRef(null);
  const [toastState, setToastState] = useState(null);

  const scrollRef = useRef(null);

  // refs
  const passwordRef = useRef(null);
  const emailRef = useRef(null);
  const signupPasswordRef = useRef(null);
  const confirmPasswordRef = useRef(null);
  const signupUsernameRef = useRef(null);
  const mobileRef = useRef(null);

  useEffect(() => {
    try {
      StatusBar.setBackgroundColor("#312E81");
      StatusBar.setBarStyle("light-content");
      if (Platform.OS === "android") {
        NavigationBar.setBackgroundColorAsync("#1E1B4B");
        NavigationBar.setButtonStyleAsync("light");
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!visible) {
      setUsername("");
      setPassword("");
      setName("");
      setSignupUsername("");
      setEmail("");
      setMobile("");
      setSignupPassword("");
      setConfirmPassword("");
      setShowLoginPassword(false);
      setShowSignupPassword(false);
      setShowConfirmPassword(false);
      setIsLoading(false);
      setIsSuccess(false);
    }
  }, [visible]);

  // Loading screen continuous loops
  useEffect(() => {
    if (isLoading) {
      Animated.timing(fadeLoadingAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }).start();

      const spinLoop = Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );

      const pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 700,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 700,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );

      spinLoop.start();
      pulseLoop.start();

      return () => {
        spinLoop.stop();
        pulseLoop.stop();
      };
    } else {
      Animated.timing(fadeLoadingAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
      spinAnim.setValue(0);
      pulseAnim.setValue(1);
    }
  }, [isLoading, fadeLoadingAnim, spinAnim, pulseAnim]);

  const showToastMsg = useCallback((msg, type = "success") => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setToastState({ msg, type, key: Date.now() });
    toastTimerRef.current = setTimeout(() => setToastState(null), 3200);
  }, []);

  useEffect(
    () => () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    },
    []
  );

  // Google sign-in placeholder (Firebase auth retired — REST backend only)
  const handleGoogleLogin = () => {
    Keyboard.dismiss();
    showToastMsg("Google sign-in is unavailable. Please use username/password.", "warning");
  };

  const handlePhoneLogin = async () => {
    Keyboard.dismiss();
    if (Platform.OS === "web" || !Device?.isDevice) {
      showToastMsg(
        "Phone sign-in requires a native build. Use Email/Google or continue as Guest.",
        "warning"
      );
      return;
    }
    showToastMsg("Phone auth ready for native runtime", "warning");
  };

  // LOGIN (REST API /auth/login)
  const handleLogin = async () => {
    Keyboard.dismiss();
    if (!username || !password) {
      showToastMsg("Please enter username and password", "error");
      return;
    }

    setIsLoading(true);
    setIsSuccess(false);
    setLoadingTitle("Authenticating...");
    setLoadingSubtitle("Verifying your credentials with EduNex server...");

    try {
      const identifier = username.trim();

      const loginResult = await api.post("/auth/login", {
        identifier,
        password,
      });

      if (loginResult && loginResult.token && loginResult.data) {
        const user = loginResult.data;
        await setAuthSession(loginResult.token, user);
        // Pull this user's live records from MongoDB into the local sync cache
        syncAfterLogin().catch((e) => console.warn("syncAfterLogin err:", e));

        setIsSuccess(true);
        setLoadingTitle("Access Granted");
        setLoadingSubtitle(`Welcome back to EduNex!`);
        Animated.spring(successScaleAnim, { toValue: 1, friction: 5, useNativeDriver: true }).start();

        setTimeout(() => {
          setIsLoading(false);
          if (onClose) onClose();
        }, 850);
      } else {
        setIsLoading(false);
        showToastMsg(
          loginResult?.error || loginResult?.message || "Invalid username or password. Please try again.",
          "error"
        );
      }
    } catch (err) {
      console.log("handleLogin err:", err);
      setIsLoading(false);
      const rawError =
        err?.data?.error ||
        err?.data?.message ||
        err?.message ||
        "Invalid username or password. Please check your credentials.";
      const displayError =
        rawError.toLowerCase().includes("invalid credentials") || rawError.toLowerCase().includes("unauthorized")
          ? "Invalid username or password. Please check your credentials and try again."
          : rawError;
      showToastMsg(displayError, "error");
    }
  };

  // SIGNUP (REST API /auth/register)
  const handleSignup = async () => {
    Keyboard.dismiss();
    showToastMsg("Self-registration is disabled. Contact your admin to create an account.", "warning");
  };

  const switchForm = () => {
    Keyboard.dismiss();
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 0.95, duration: 180, useNativeDriver: true }),
    ]).start(() => {
      setIsLogin(!isLogin);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    });
  };

  const handleFocus = (index) => {
    scrollRef.current?.scrollTo({ y: index * 60, animated: true });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <LinearGradient colors={["#0F172A", "#1E1B4B", "#312E81"]} style={styles.overlay}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}
        >
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.centeredContainer}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Animated.View style={[styles.card, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
              {/* Brand Logo & Header */}
              <View style={styles.brandContainer}>
                <View style={styles.brandIconWrap}>
                  <Icon name="school-outline" size={32} color="#FFFFFF" />
                </View>
                <Text style={styles.brandTitle}>EduNex</Text>
                <Text style={styles.brandSubtitle}>Campus Management Ecosystem</Text>
              </View>

              {/* Form Mode Switcher Tab */}
              <View style={styles.tabContainer}>
                <TouchableOpacity
                  style={[styles.tabButton, isLogin && styles.tabButtonActive]}
                  onPress={() => isLogin || switchForm()}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.tabText, isLogin && styles.tabTextActive]}>Sign In</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  disabled
                  style={[styles.tabButton, { opacity: 0.4 }]}
                  activeOpacity={1}
                >
                  <Text style={[styles.tabText, { color: "#94A3B8" }]}>Register</Text>
                </TouchableOpacity>
              </View>

              {isLogin ? (
                <>
                  <View style={styles.inputGroup}>
                    <Icon name="account-outline" size={20} color="#64748B" style={styles.icon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Username / Roll Number"
                      value={username}
                      placeholderTextColor="#94A3B8"
                      onChangeText={setUsername}
                      onFocus={() => handleFocus(1)}
                      autoCapitalize="none"
                      returnKeyType="next"
                      blurOnSubmit={false}
                      onSubmitEditing={() => passwordRef.current?.focus()}
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Icon name="lock-outline" size={20} color="#64748B" style={styles.icon} />
                    <TextInput
                      ref={passwordRef}
                      style={styles.input}
                      placeholder="Password"
                      placeholderTextColor="#94A3B8"
                      secureTextEntry={!showLoginPassword}
                      value={password}
                      onChangeText={setPassword}
                      onFocus={() => handleFocus(2)}
                      returnKeyType="done"
                      onSubmitEditing={handleLogin}
                    />
                    <TouchableOpacity onPress={() => setShowLoginPassword(!showLoginPassword)}>
                      <Icon name={showLoginPassword ? "eye-off" : "eye"} size={20} color="#64748B" />
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity style={styles.primaryButton} onPress={handleLogin} activeOpacity={0.85}>
                    <Text style={styles.buttonText}>SIGN IN</Text>
                  </TouchableOpacity>

                  <View style={styles.separatorContainer}>
                    <View style={styles.line} />
                    <Text style={styles.separatorText}>or continue with</Text>
                    <View style={styles.line} />
                  </View>

                  <View style={styles.socialButtonsRow}>
                    <TouchableOpacity
                      style={[styles.socialButton, { backgroundColor: "#EA4335" }]}
                      onPress={handleGoogleLogin}
                      activeOpacity={0.85}
                    >
                      <Icon name="google" size={18} color="#FFFFFF" />
                      <Text style={styles.socialText}>Google</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.socialButton, { backgroundColor: "#10B981" }]}
                      onPress={handlePhoneLogin}
                      activeOpacity={0.85}
                    >
                      <Icon name="phone" size={18} color="#FFFFFF" />
                      <Text style={styles.socialText}>Phone</Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    style={styles.skipBtn}
                    onPress={() => {
                      showToastMsg("Continuing as Guest", "info");
                      setTimeout(() => {
                        if (onSkip) onSkip();
                        if (onClose) onClose();
                      }, 500);
                    }}
                  >
                    <Text style={styles.skipText}>Explore as Guest</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={styles.roleHeaderLabel}>Select Account Role</Text>
                  <View style={styles.roleChipsRow}>
                    {ROLE_OPTIONS.map((item) => {
                      const active = role === item.key;
                      return (
                        <TouchableOpacity
                          key={item.key}
                          style={[styles.roleChip, active && styles.roleChipActive]}
                          onPress={() => setRole(item.key)}
                          activeOpacity={0.8}
                        >
                          <Icon
                            name={item.icon}
                            size={16}
                            color={active ? "#FFFFFF" : "#64748B"}
                            style={{ marginRight: 4 }}
                          />
                          <Text style={[styles.roleChipText, active && styles.roleChipTextActive]}>
                            {item.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <View style={styles.inputGroup}>
                    <Icon name="account-outline" size={20} color="#64748B" style={styles.icon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Full Name"
                      value={name}
                      placeholderTextColor="#94A3B8"
                      onChangeText={setName}
                      onFocus={() => handleFocus(1)}
                      returnKeyType="next"
                      blurOnSubmit={false}
                      onSubmitEditing={() => signupUsernameRef.current?.focus()}
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Icon name="card-account-details-outline" size={20} color="#64748B" style={styles.icon} />
                    <TextInput
                      ref={signupUsernameRef}
                      style={styles.input}
                      placeholder="Username / ID"
                      value={signupUsername}
                      placeholderTextColor="#94A3B8"
                      onChangeText={setSignupUsername}
                      onFocus={() => handleFocus(2)}
                      autoCapitalize="none"
                      returnKeyType="next"
                      blurOnSubmit={false}
                      onSubmitEditing={() => emailRef.current?.focus()}
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Icon name="email-outline" size={20} color="#64748B" style={styles.icon} />
                    <TextInput
                      ref={emailRef}
                      style={styles.input}
                      placeholder="Email Address"
                      keyboardType="email-address"
                      value={email}
                      placeholderTextColor="#94A3B8"
                      onChangeText={setEmail}
                      autoCapitalize="none"
                      onFocus={() => handleFocus(3)}
                      returnKeyType="next"
                      blurOnSubmit={false}
                      onSubmitEditing={() => mobileRef.current?.focus()}
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Icon name="phone-outline" size={20} color="#64748B" style={styles.icon} />
                    <TextInput
                      ref={mobileRef}
                      style={styles.input}
                      placeholder="Mobile Number"
                      value={mobile}
                      placeholderTextColor="#94A3B8"
                      keyboardType="phone-pad"
                      onChangeText={setMobile}
                      onFocus={() => handleFocus(4)}
                      returnKeyType="next"
                      blurOnSubmit={false}
                      onSubmitEditing={() => signupPasswordRef.current?.focus()}
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Icon name="lock-outline" size={20} color="#64748B" style={styles.icon} />
                    <TextInput
                      ref={signupPasswordRef}
                      style={styles.input}
                      placeholder="Password"
                      placeholderTextColor="#94A3B8"
                      secureTextEntry={!showSignupPassword}
                      value={signupPassword}
                      onChangeText={setSignupPassword}
                      onFocus={() => handleFocus(5)}
                      returnKeyType="next"
                      blurOnSubmit={false}
                      onSubmitEditing={() => confirmPasswordRef.current?.focus()}
                    />
                    <TouchableOpacity onPress={() => setShowSignupPassword(!showSignupPassword)}>
                      <Icon name={showSignupPassword ? "eye-off" : "eye"} size={20} color="#64748B" />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.inputGroup}>
                    <Icon name="lock-check-outline" size={20} color="#64748B" style={styles.icon} />
                    <TextInput
                      ref={confirmPasswordRef}
                      style={styles.input}
                      placeholder="Confirm Password"
                      secureTextEntry={!showConfirmPassword}
                      value={confirmPassword}
                      placeholderTextColor="#94A3B8"
                      onChangeText={setConfirmPassword}
                      onFocus={() => handleFocus(6)}
                      returnKeyType="done"
                      onSubmitEditing={handleSignup}
                    />
                    <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                      <Icon name={showConfirmPassword ? "eye-off" : "eye"} size={20} color="#64748B" />
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity style={styles.primaryButton} onPress={handleSignup} activeOpacity={0.85}>
                    <Text style={styles.buttonText}>CREATE ACCOUNT</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.skipBtn}
                    onPress={() => {
                      showToastMsg("Continuing as Guest", "info");
                      setTimeout(() => {
                        if (onSkip) onSkip();
                        if (onClose) onClose();
                      }, 500);
                    }}
                  >
                    <Text style={styles.skipText}>Skip for now</Text>
                  </TouchableOpacity>
                </>
              )}
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Fullscreen Loading Screen Animation Overlay */}
        {isLoading && (
          <Animated.View
            style={[
              styles.loadingOverlay,
              {
                opacity: fadeLoadingAnim,
              },
            ]}
          >
            <LinearGradient
              colors={["#0F172AF0", "#1E1B4BF6", "#312E81FA"]}
              style={styles.loadingGradient}
            >
              <View style={styles.loadingCard}>
                {/* Glowing Rings & Central Emblem */}
                <View style={styles.animIconContainer}>
                  {/* Pulsing Outer Glow Ring */}
                  <Animated.View
                    style={[
                      styles.pulseRing,
                      {
                        transform: [{ scale: pulseAnim }],
                        opacity: pulseAnim.interpolate({
                          inputRange: [1, 1.15],
                          outputRange: [0.6, 0.15],
                        }),
                      },
                    ]}
                  />

                  {/* Rotating Orbit Spinner Ring */}
                  {!isSuccess && (
                    <Animated.View
                      style={[
                        styles.spinnerOrbitRing,
                        {
                          transform: [
                            {
                              rotate: spinAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: ["0deg", "360deg"],
                              }),
                            },
                          ],
                        },
                      ]}
                    >
                      <View style={styles.spinnerOrbitDot} />
                    </Animated.View>
                  )}

                  {/* Center Emblem Icon */}
                  <Animated.View
                    style={[
                      styles.centerEmblem,
                      isSuccess
                        ? {
                            backgroundColor: "#10B981",
                            transform: [{ scale: successScaleAnim }],
                          }
                        : {
                            backgroundColor: "#4F46E5",
                          },
                    ]}
                  >
                    <Icon
                      name={
                        isSuccess
                          ? "check-bold"
                          : isLogin
                          ? "shield-lock"
                          : "account-check"
                      }
                      size={34}
                      color="#FFFFFF"
                    />
                  </Animated.View>
                </View>

                {/* Dynamic Title & Subtitle */}
                <Text style={styles.loadingTitleText}>
                  {loadingTitle || (isLogin ? "Signing In..." : "Creating Account...")}
                </Text>
                <Text style={styles.loadingSubtitleText}>
                  {loadingSubtitle || "Securely connecting to EduNex Campus Cloud..."}
                </Text>

                {/* Status Indicator / Progress Bar */}
                {!isSuccess ? (
                  <View style={styles.loadingProgressTrack}>
                    <Animated.View
                      style={[
                        styles.loadingProgressBar,
                        {
                          transform: [
                            {
                              scaleX: pulseAnim.interpolate({
                                inputRange: [1, 1.15],
                                outputRange: [0.35, 1],
                              }),
                            },
                          ],
                        },
                      ]}
                    />
                  </View>
                ) : (
                  <View style={styles.successPill}>
                    <Icon name="check-circle" size={16} color="#34D399" style={{ marginRight: 6 }} />
                    <Text style={styles.successPillText}>Authentication Confirmed</Text>
                  </View>
                )}
              </View>
            </LinearGradient>
          </Animated.View>
        )}

        {/* Floating Top Banner Toast Notification */}
        {toastState && <LoginToast key={toastState.key} toastState={toastState} />}
      </LinearGradient>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1 },
  centeredContainer: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 40,
  },
  card: {
    width: SCREEN_WIDTH > 420 ? 380 : SCREEN_WIDTH * 0.92,
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    padding: 24,
    elevation: 12,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  brandContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  brandIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#4F46E5",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
    elevation: 4,
    shadowColor: "#4F46E5",
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: -0.5,
  },
  brandSubtitle: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 2,
    fontWeight: "500",
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: 14,
    padding: 4,
    marginBottom: 18,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 10,
  },
  tabButtonActive: {
    backgroundColor: "#FFFFFF",
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748B",
  },
  tabTextActive: {
    color: "#4F46E5",
    fontWeight: "800",
  },
  roleHeaderLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  roleChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  roleChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  roleChipActive: {
    backgroundColor: "#4F46E5",
    borderColor: "#4F46E5",
  },
  roleChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
  },
  roleChipTextActive: {
    color: "#FFFFFF",
  },
  inputGroup: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    paddingHorizontal: 14,
    marginVertical: 6,
    backgroundColor: "#F8FAFC",
    height: 48,
  },
  icon: { marginRight: 10 },
  input: {
    flex: 1,
    fontSize: 14,
    color: "#0F172A",
    fontWeight: "500",
  },
  primaryButton: {
    backgroundColor: "#4F46E5",
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 14,
    alignItems: "center",
    elevation: 3,
    shadowColor: "#4F46E5",
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 15,
    letterSpacing: 0.5,
  },
  separatorContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 14,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: "#E2E8F0",
  },
  separatorText: {
    marginHorizontal: 10,
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "600",
  },
  socialButtonsRow: {
    flexDirection: "row",
    gap: 10,
  },
  socialButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    paddingVertical: 10,
    gap: 8,
  },
  socialText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 13,
  },
  skipBtn: {
    marginTop: 16,
    alignItems: "center",
  },
  skipText: {
    color: "#64748B",
    fontSize: 13,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  toast: {
    position: "absolute",
    top: Platform.OS === "ios" ? 54 : (StatusBar.currentHeight || 24) + 12,
    left: 18,
    right: 18,
    zIndex: 999999,
    elevation: 40,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.25)",
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  toastIcon: {
    marginRight: 12,
  },
  toastTextWrap: {
    flex: 1,
  },
  toastTitle: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 13.5,
    marginBottom: 2,
    letterSpacing: 0.2,
  },
  toastText: {
    color: "rgba(255, 255, 255, 0.95)",
    fontWeight: "600",
    fontSize: 12.5,
    lineHeight: 17,
  },
  /* Loading Screen Overlay Styles */
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    elevation: 25,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingGradient: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  loadingCard: {
    width: SCREEN_WIDTH > 420 ? 340 : SCREEN_WIDTH * 0.86,
    backgroundColor: "rgba(15, 23, 42, 0.85)",
    borderRadius: 24,
    paddingVertical: 36,
    paddingHorizontal: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.35)",
    elevation: 16,
    shadowColor: "#4F46E5",
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
  },
  animIconContainer: {
    width: 100,
    height: 100,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  pulseRing: {
    position: "absolute",
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    borderColor: "#818CF8",
  },
  spinnerOrbitRing: {
    position: "absolute",
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2.5,
    borderColor: "transparent",
    borderTopColor: "#6366F1",
    borderRightColor: "#818CF8",
  },
  spinnerOrbitDot: {
    position: "absolute",
    top: 2,
    right: 14,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#A5B4FC",
  },
  centerEmblem: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    elevation: 8,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  loadingTitleText: {
    fontSize: 20,
    fontWeight: "800",
    color: "#FFFFFF",
    textAlign: "center",
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  loadingSubtitleText: {
    fontSize: 13,
    color: "#94A3B8",
    textAlign: "center",
    fontWeight: "500",
    lineHeight: 18,
    marginBottom: 20,
    paddingHorizontal: 12,
  },
  loadingProgressTrack: {
    width: 140,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    overflow: "hidden",
  },
  loadingProgressBar: {
    width: "100%",
    height: "100%",
    backgroundColor: "#6366F1",
    borderRadius: 2,
  },
  successPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(16, 185, 129, 0.18)",
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.4)",
  },
  successPillText: {
    color: "#34D399",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});
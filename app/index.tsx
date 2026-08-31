import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  View,
  ActivityIndicator,
  Text,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { secureGet, secureSet } from "./services/secureStorage";
import * as NavigationBar from "expo-navigation-bar";

import { ThemeProvider, useTheme } from "./context/ThemeContext";
import { ToastProvider, useAppToast } from "./utils/AnimatedToast";
import { setToastRef } from "./utils/toastService";
import { onUnauthorized, clearAuthSession } from "./services/api";
import { startRealtimeWatcher } from "./services/realtimeNotificationService";

// Headers
import Header from "./components/header/Header";
import HeaderAdmin from "./components/header/HeaderAdmin";
import HeaderStaff from "./components/header/HeaderStaff";
import HeaderParent from "./components/header/HeaderParent";

// Navigators
import AppNavigator from "./components/nav/AppNavigator";
import AppNavigatorAdmin from "./components/nav/AppNavigatorAdmin";
import AppNavigatorStaff from "./components/nav/AppNavigatorStaff";
import AppNavigatorParent from "./components/nav/AppNavigatorParent";

// Screens
import SkipScreen from "./screens/SkipScreen";
import CardLoginModal from "./components/LoginPage";

function IndexCore() {
  const { colors } = useTheme();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [checkingRole, setCheckingRole] = useState(true);
  const [userRole, setUserRole] = useState("guest");
  const toast = useAppToast();

  // Set toast reference
  useEffect(() => {
    setToastRef(toast);
  }, [toast]);

  // Navigation bar color
  useEffect(() => {
    if (Platform.OS === "android") {
      try {
        NavigationBar.setBackgroundColorAsync(colors.primaryDark || "#3730A3").catch(() => {});
        NavigationBar.setButtonStyleAsync("light").catch(() => {});
      } catch {
        // Suppress on edge-to-edge Android
      }
    }
  }, [colors]);

  // Role Loader
  useEffect(() => {
    let mounted = true;

    const loadRole = async () => {
      try {
        setCheckingRole(true);

        const storedRole = await secureGet("userRole");

        const valid =
          storedRole &&
          ["admin", "staff", "parent", "student", "guest"].includes(storedRole)
            ? storedRole
            : "guest";

        if (!mounted) return;

        setUserRole(valid);
        setShowLoginModal(valid === "guest");
      } finally {
        if (mounted) setCheckingRole(false);
      }
    };

    loadRole();

    const unsubscribeAuth = onUnauthorized(() => {
      if (mounted) {
        setUserRole("guest");
        setShowLoginModal(true);
        toast.showToast("Session expired. Please log in.", "error");
      }
    });

    return () => {
      mounted = false;
      unsubscribeAuth();
    };
  }, [toast]);

  // Activate Real-Time Notification Watcher for Live Background Alerts
  useEffect(() => {
    if (userRole && userRole !== "guest") {
      const stopWatcher = startRealtimeWatcher(4000);
      return () => {
        if (stopWatcher) stopWatcher();
      };
    }
  }, [userRole]);

  // MAP BACKEND ROLES TO APP NAVIGATOR
  const mapRole = (r?: string | null) => {
    if (!r) return "guest";
    const v = r.toLowerCase();
    if (v === "stud" || v === "student") return "student";
    if (v === "staff" || v === "faculty") return "staff";
    if (v === "parent") return "parent";
    if (v === "admin") return "admin";
    return "guest";
  };

  // Auth Login Callback
  const handleLoginSuccess = async () => {
    try {
      const user = await secureGet("userData");
      let extractedRole: string | null = null;

      if (user) {
        extractedRole = user?.role || user?.data?.role || user?.user?.role || null;
      }

      if (!extractedRole) {
        extractedRole = await secureGet("userRole");
      }

      const mapped = mapRole(extractedRole);
      await secureSet("userRole", mapped);
      setUserRole(mapped);
      setShowLoginModal(mapped === "guest");
      toast.showToast(`Welcome, ${mapped}!`, "success");
    } catch (err) {
      console.log("login callback error:", err);
      setUserRole("guest");
      setShowLoginModal(true);
    }
  };

  // Skip
  const handleSkip = async () => {
    await secureSet("userRole", "guest");
    setUserRole("guest");
    setShowLoginModal(false);
    toast.showToast("Continuing as Guest", "info");
  };

  // Logout
  const handleLogout = async () => {
    await clearAuthSession();

    setUserRole("guest");
    setShowLoginModal(true);

    toast.showToast("Logged Out Successfully", "info");
  };

  // Render Navigator
  const renderNavigator = () => {
    const shared = { userRole, onLogout: handleLogout };

    switch (userRole) {
      case "admin":
        return <AppNavigatorAdmin {...shared} />;
      case "staff":
        return <AppNavigatorStaff {...shared} />;
      case "parent":
        return <AppNavigatorParent {...shared} />;
      case "student":
        return <AppNavigator {...shared} />;
      default:
        return null;
    }
  };

  // Render Header
  const renderHeader = () => {
    switch (userRole) {
      case "admin":
        return <HeaderAdmin {...({ onLogout: handleLogout } as any)} />;
      case "staff":
        return <HeaderStaff {...({ onLogout: handleLogout } as any)} />;
      case "parent":
        return <HeaderParent {...({ onLogout: handleLogout } as any)} />;
      case "student":
        return <Header {...({ onLogout: handleLogout } as any)} />;
      default:
        return null;
    }
  };

  // Loader screen
  if (checkingRole) {
    return (
      <SafeAreaView style={[styles.loader, { backgroundColor: colors.primaryBackground }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.primary }]}>Loading EduNex...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.primaryBackground }]} edges={["left", "right"]}>
      {/* ALWAYS show login modal when needed */}
      {showLoginModal && (
        <CardLoginModal
          visible={showLoginModal}
          onClose={async () => {
            await handleLoginSuccess();
            setShowLoginModal(false);
          }}
          onSkip={handleSkip}
        />
      )}

      {/* Guest screen */}
      {!showLoginModal && userRole === "guest" && (
        <SkipScreen onLogout={handleLogout} setShowModal={setShowLoginModal} />
      )}

      {/* Logged-in UI */}
      {!showLoginModal && userRole !== "guest" && (
        <View style={styles.mainWrapper}>
          <View style={styles.header}>{renderHeader()}</View>
          <View style={styles.content}>{renderNavigator()}</View>
        </View>
      )}
    </SafeAreaView>
  );
}

// Root Wrapper
export default function Index() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <IndexCore />
      </ToastProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  mainWrapper: { flex: 1, position: "relative" },
  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  header: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 100 },
  content: { flex: 1, marginTop: 140 },
});
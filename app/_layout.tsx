import React, { useEffect } from "react";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { LogBox } from "react-native";
import { startRealtimeWatcher } from "./services/realtimeNotificationService";
import GlobalCallOverlay from "./components/common/GlobalCallOverlay";

// Ignore known development warnings in Expo Go
LogBox.ignoreLogs([
  "expo-notifications: Android Push notifications",
  "`setBackgroundColorAsync` is not supported with edge-to-edge enabled",
  "setBackgroundColorAsync",
]);

if (__DEV__) {
  const originalConsoleError = console.error;
  console.error = (...args) => {
    if (
      typeof args[0] === "string" &&
      args[0].includes("expo-notifications: Android Push notifications")
    ) {
      return;
    }
    originalConsoleError(...args);
  };

  const originalConsoleWarn = console.warn;
  console.warn = (...args) => {
    if (
      typeof args[0] === "string" &&
      (args[0].includes("setBackgroundColorAsync") ||
        args[0].includes("expo-notifications: Android Push notifications"))
    ) {
      return;
    }
    originalConsoleWarn(...args);
  };
}

export default function RootLayout() {
  useEffect(() => {
    // Start continuous real-time signaling & notification watcher globally (1.5s fast polling)
    const stopWatcher = startRealtimeWatcher(1500);
    return () => {
      if (stopWatcher) stopWatcher();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }} />
      <GlobalCallOverlay />
    </SafeAreaProvider>
  );
}

import React, { useEffect, useState } from "react";
import { Platform } from "react-native";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as Notifications from "../src/utils/safeNotifications";
import * as NavigationBar from "expo-navigation-bar";
import { startRealtimeWatcher, setupPushNotificationPermissions } from "../src/services/realtimeNotificationService";
import { startOfflineSyncWatcher } from "../src/services/offlineSyncService";
import { BASE_URL } from "../src/services/api";
import { notifyChatSubscribers } from "../src/services/chatService";
import { handleNotificationAction } from "../src/utils/notificationUtils";
import { checkAppUpdate } from "../src/services/updateService";
import GlobalCallOverlay from "../src/components/common/GlobalCallOverlay";
import AppUpdateModal from "../src/components/common/AppUpdateModal";
import { installConsoleSanitizer, checkDeviceIntegrity } from "../src/utils/deviceSecurity";
import { showToast } from "../src/utils/toastService";

// Initialize global logger sanitizer on load
installConsoleSanitizer();

export default function RootLayout() {
  const [updateInfo, setUpdateInfo] = useState<any>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  useEffect(() => {
    // Check root / jailbreak integrity on launch
    checkDeviceIntegrity().then((result) => {
      if (result.isCompromised) {
        showToast("⚠️ Security Warning: Device is rooted/jailbroken.", "warning");
      }
    });
    // 0. System Navigation Bar Configuration (Android Immersive Mode)
    if (Platform.OS === "android") {
      try {
        (NavigationBar as any)?.setVisibilityAsync?.("hidden")?.catch?.(() => {});
        (NavigationBar as any)?.setBehaviorAsync?.("inset-swipe")?.catch?.(() => {});
      } catch (err) {
        console.warn("NavigationBar setup error:", err);
      }
    }

    // 1. Setup push permissions and background call channels
    setupPushNotificationPermissions();

    // 2. Start continuous real-time signaling & notification watcher globally (1.5s fast polling)
    const stopWatcher = startRealtimeWatcher(1500);

    // 3. Start persistent Offline Mutation Cloud Synchronization Watcher
    const stopOfflineSync = startOfflineSyncWatcher(BASE_URL, 15000);

    // 3. In-App Version & Update Checker
    async function performUpdateCheck() {
      try {
        const res = await checkAppUpdate();
        if (res?.updateAvailable) {
          setUpdateInfo(res);
          setShowUpdateModal(true);
        }
      } catch (err) {
        console.warn("[RootLayout] Update check error:", err);
      }
    }
    performUpdateCheck();
    const updateCheckTimer = setInterval(performUpdateCheck, 120000); // Periodic check every 2 mins

    // 4. Listen for background & lockscreen notification taps / Answer / Decline actions
    const responseSub = Notifications.addNotificationResponseReceivedListener((response: any) => {
      try {
        const content = response.notification?.request?.content;
        const data = (content?.data as any) || {};
        const actionId = response.actionIdentifier;

        if (data?.type === "incoming_call") {
          if (actionId === "decline") {
            notifyChatSubscribers({
              type: "call_signal",
              signalType: "call_decline",
              ...data,
            });
          } else {
            notifyChatSubscribers({
              type: "call_signal",
              signalType: "call_invite",
              autoAnswer: actionId === "answer",
              ...data,
            });
          }
        } else {
          // Forward general notification taps directly to modal navigation
          const notifPayload = {
            title: content?.title || data?.title || "",
            message: content?.body || data?.message || data?.text || "",
            metadata: data,
            data: data,
            ...data,
          };
          handleNotificationAction(notifPayload);
        }
      } catch (err) {
        console.warn("Notification response error:", err);
      }
    });

    return () => {
      responseSub.remove();
      clearInterval(updateCheckTimer);
      if (stopWatcher) stopWatcher();
      if (stopOfflineSync) stopOfflineSync();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }} />
      <GlobalCallOverlay />
      <AppUpdateModal
        visible={showUpdateModal}
        updateInfo={updateInfo}
        onClose={() => setShowUpdateModal(false)}
      />
    </SafeAreaProvider>
  );
}

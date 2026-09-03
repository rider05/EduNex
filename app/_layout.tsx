import React, { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as Notifications from "expo-notifications";
import { startRealtimeWatcher, setupPushNotificationPermissions } from "./services/realtimeNotificationService";
import { notifyChatSubscribers } from "./services/chatService";
import { checkAppUpdate } from "./services/updateService";
import GlobalCallOverlay from "./components/common/GlobalCallOverlay";
import AppUpdateModal from "./components/common/AppUpdateModal";

export default function RootLayout() {
  const [updateInfo, setUpdateInfo] = useState<any>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  useEffect(() => {
    // 1. Setup push permissions and background call channels
    setupPushNotificationPermissions();

    // 2. Start continuous real-time signaling & notification watcher globally (1.5s fast polling)
    const stopWatcher = startRealtimeWatcher(1500);

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
    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      try {
        const data = response.notification?.request?.content?.data;
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
        }
      } catch (err) {
        console.warn("Notification response error:", err);
      }
    });

    return () => {
      responseSub.remove();
      clearInterval(updateCheckTimer);
      if (stopWatcher) stopWatcher();
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

import React, { useEffect } from "react";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as Notifications from "expo-notifications";
import { startRealtimeWatcher, setupPushNotificationPermissions } from "./services/realtimeNotificationService";
import { notifyChatSubscribers } from "./services/chatService";
import GlobalCallOverlay from "./components/common/GlobalCallOverlay";

export default function RootLayout() {
  useEffect(() => {
    // 1. Setup push permissions and background call channels
    setupPushNotificationPermissions();

    // 2. Start continuous real-time signaling & notification watcher globally (1.5s fast polling)
    const stopWatcher = startRealtimeWatcher(1500);

    // 3. Listen for background & lockscreen notification taps / Answer / Decline actions
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

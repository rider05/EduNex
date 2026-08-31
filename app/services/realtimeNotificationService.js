import { AppState, Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Haptics from "expo-haptics";
import { api } from "./api";
import { resolveIdentity } from "./identityService";
import { secureGet, secureSet } from "./secureStorage";
import { showToast } from "../utils/toastService";
import { saveUserNotification, handleNotificationAction } from "../utils/notificationUtils";

// Configure expo-notifications presentation behavior in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    priority: Notifications.AndroidNotificationPriority.HIGH,
  }),
});

let watcherInterval = null;
let isWatcherActive = false;
let isPolling = false;

// In-memory state tracking to detect diffs/deltas
let lastKnownLeaves = new Map(); // id -> status
let lastKnownNotices = new Set(); // set of notice IDs
let initializedState = false;

/**
 * Request native notification permissions
 */
export async function setupPushNotificationPermissions() {
  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("edunex_alerts", {
        name: "EduNex Campus & Leave Alerts",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#4F46E5",
        sound: "default",
        enableVibrate: true,
        showBadge: true,
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    return finalStatus === "granted";
  } catch (err) {
    console.warn("setupPushNotificationPermissions error:", err);
    return false;
  }
}

/**
 * Dispatch a native heads-up push notification banner with sound and haptics
 */
export async function triggerRealtimeNotification({
  title,
  body,
  type = "info", // "info" | "success" | "warning" | "error"
  data = {},
}) {
  try {
    // 0. Ensure notification channel is ready
    await setupPushNotificationPermissions();

    // Suppress self-notifications on sender's device unless forcePopup is requested
    if (data?.senderId && !data?.forcePopup) {
      try {
        const id = await resolveIdentity();
        const currentUserId = id?.student?.rollNo || id?.staffId || id?.id || id?.username;
        if (currentUserId && String(data.senderId).toLowerCase() === String(currentUserId).toLowerCase()) {
          // Outgoing message sent by this user -> Do not self-notify
          return;
        }
      } catch (_e) {}
    }

    // 1. Physical Haptic feedback
    try {
      if (type === "success") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if (type === "warning" || type === "error") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } else {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    } catch (_hapticErr) {
      // Haptics fallback
    }

    // 2. Native System Push Notification (works across devices/screens)
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: "default",
          badge: 1,
          channelId: "edunex_alerts",
        },
        trigger: null, // deliver immediately
      });
    } catch (_schedErr) {
      console.warn("scheduleNotificationAsync fallback:", _schedErr);
    }

    // 3. In-App Animated Toast Banner
    showToast(`${title}: ${body}`, type);
  } catch (err) {
    console.warn("triggerRealtimeNotification error:", err);
  }
}

/**
 * Real-time poll cycle executing delta checks
 */
async function performRealtimeCheck() {
  if (isPolling) return;
  isPolling = true;

  try {
    const role = await secureGet("userRole");
    if (!role || role === "guest") {
      isPolling = false;
      return;
    }

    const identity = await resolveIdentity();
    const studentRoll =
      identity?.student?.rollNo ||
      identity?.user?.profile?.rollNo ||
      identity?.user?.rollNo ||
      "";

    // 1. Fetch live leaves and notices from backend
    const [leavesRes, noticesRes] = await Promise.allSettled([
      api.get("/leaves", { limit: 50, sort: "-createdAt" }),
      api.get("/notices", { limit: 20, sort: "-createdAt" }),
    ]);

    const liveLeaves =
      leavesRes.status === "fulfilled" && Array.isArray(leavesRes.value?.data)
        ? leavesRes.value.data
        : Array.isArray(leavesRes.value)
        ? leavesRes.value
        : [];

    const liveNotices =
      noticesRes.status === "fulfilled" && Array.isArray(noticesRes.value?.data)
        ? noticesRes.value.data
        : Array.isArray(noticesRes.value)
        ? noticesRes.value
        : [];

    // First cycle initialization to prevent spamming on cold start
    if (!initializedState) {
      liveLeaves.forEach((l) => {
        const id = l.id || l._id || l.leaveId;
        if (id) lastKnownLeaves.set(id, l.status || "pending");
      });
      liveNotices.forEach((n) => {
        const id = n.id || n._id;
        if (id) lastKnownNotices.add(id);
      });
      initializedState = true;
      isPolling = false;
      return;
    }

    // =========================================================================
    // A. STAFF ROLE REALTIME CHECKS
    // =========================================================================
    if (role === "staff" || role === "faculty" || role === "admin") {
      for (const leave of liveLeaves) {
        const id = leave.id || leave._id || leave.leaveId;
        if (!id) continue;

        const prevStatus = lastKnownLeaves.get(id);

        // New student leave request submitted!
        if (prevStatus === undefined && leave.status === "pending") {
          lastKnownLeaves.set(id, leave.status);

          const studentName = leave.studentName || leave.rollNo || "A Student";
          const leaveType = leave.leaveType || "Leave Request";
          const daysStr = leave.daysCount ? `${leave.daysCount} Day(s)` : "Leave";

          const notifTitle = "📝 New Leave Request Submitted";
          const notifBody = `${studentName} applied for ${leaveType} (${daysStr}). Tap to review & approve.`;

          await triggerRealtimeNotification({
            title: notifTitle,
            body: notifBody,
            type: "info",
            data: { leaveId: id, role: "staff", targetScreen: "StaffLeaveApprovals" },
          });

          await saveUserNotification("staff", null, {
            id: `rt_notif_${id}_${Date.now()}`,
            title: notifTitle,
            message: notifBody,
            type: "info",
            targetRole: "staff",
            createdAt: new Date().toISOString(),
            isNew: true,
          });
        } else {
          lastKnownLeaves.set(id, leave.status || "pending");
        }
      }
    }

    // =========================================================================
    // B. STUDENT ROLE REALTIME CHECKS
    // =========================================================================
    if (role === "student" || role === "stud") {
      const activeLeaveId = await secureGet("activeCollegeLeaveId");

      for (const leave of liveLeaves) {
        const id = leave.id || leave._id || leave.leaveId;
        if (!id) continue;

        const isAppliedByThisStudent =
          (leave.rollNo && studentRoll && leave.rollNo.toLowerCase() === studentRoll.toLowerCase()) ||
          id === activeLeaveId;

        if (isAppliedByThisStudent) {
          const prevStatus = lastKnownLeaves.get(id);
          const currentStatus = (leave.status || "pending").toLowerCase();

          // Detected status change from pending -> approved or rejected!
          if (prevStatus && prevStatus !== currentStatus && prevStatus === "pending") {
            lastKnownLeaves.set(id, currentStatus);

            const staffApprover = leave.approvedBy || leave.rejectedBy || "Faculty Advisor";
            const leaveType = leave.leaveType || "Leave Request";

            if (currentStatus === "approved") {
              const notifTitle = "✅ Leave Request Approved!";
              const notifBody = `Your ${leaveType} was APPROVED by ${staffApprover}! Digital Gate Pass is now active.`;

              // Update local encrypted storage
              await secureSet("activeCollegeLeaveId", id);
              await secureSet(`cached_leave_${id}`, leave);

              await triggerRealtimeNotification({
                title: notifTitle,
                body: notifBody,
                type: "success",
                data: { leaveId: id, status: "approved", rollNo: studentRoll },
              });

              await saveUserNotification("student", studentRoll, {
                id: `rt_notif_appr_${id}_${Date.now()}`,
                title: notifTitle,
                message: notifBody,
                type: "success",
                targetRole: "student",
                targetRollNo: studentRoll,
                createdAt: new Date().toISOString(),
                isNew: true,
              });
            } else if (currentStatus === "rejected" || currentStatus === "declined") {
              const notifTitle = "❌ Leave Request Declined";
              const notifBody = `Your ${leaveType} was declined by ${staffApprover}. Reason: ${leave.rejectionReason || "Academic schedule"}`;

              await triggerRealtimeNotification({
                title: notifTitle,
                body: notifBody,
                type: "warning",
                data: { leaveId: id, status: "rejected", rollNo: studentRoll },
              });

              await saveUserNotification("student", studentRoll, {
                id: `rt_notif_decl_${id}_${Date.now()}`,
                title: notifTitle,
                message: notifBody,
                type: "warning",
                targetRole: "student",
                targetRollNo: studentRoll,
                createdAt: new Date().toISOString(),
                isNew: true,
              });
            }
          } else {
            lastKnownLeaves.set(id, currentStatus);
          }
        } else {
          lastKnownLeaves.set(id, leave.status || "pending");
        }
      }
    }

    // =========================================================================
    // C. BROADCAST CIRCULARS & NOTICES REALTIME CHECKS
    // =========================================================================
    for (const notice of liveNotices) {
      const id = notice.id || notice._id;
      if (!id) continue;

      if (!lastKnownNotices.has(id)) {
        lastKnownNotices.add(id);

        const noticeTitle = notice.title || notice.subject || "📢 Campus Notice";
        const noticeBody = notice.content || notice.message || notice.text || "New announcement published.";

        await triggerRealtimeNotification({
          title: noticeTitle,
          body: noticeBody,
          type: "info",
          data: { noticeId: id },
        });
      }
    }
  } catch (err) {
    console.warn("performRealtimeCheck error:", err);
  } finally {
    isPolling = false;
  }
}

/**
 * Start Real-time Notification Background Watcher
 */
export function startRealtimeWatcher(intervalMs = 12000) {
  if (isWatcherActive) return;
  isWatcherActive = true;

  setupPushNotificationPermissions();

  // Run immediate first check
  performRealtimeCheck();

  // Periodic polling watcher (4 seconds)
  watcherInterval = setInterval(() => {
    performRealtimeCheck();
  }, intervalMs);

  // Notification click listener (opens corresponding modal on click)
  const notifResponseSub = Notifications.addNotificationResponseReceivedListener((response) => {
    try {
      const content = response?.notification?.request?.content;
      const data = content?.data || {};
      const title = content?.title || "";
      const message = content?.body || "";
      handleNotificationAction({ title, message, ...data });
    } catch (e) {
      console.warn("Notification click navigation error:", e);
    }
  });

  // AppState listener: re-check immediately when user returns to foreground
  const appStateSub = AppState.addEventListener("change", (nextState) => {
    if (nextState === "active") {
      performRealtimeCheck();
    }
  });

  return () => {
    stopRealtimeWatcher();
    appStateSub.remove();
    notifResponseSub.remove();
  };
}

/**
 * Stop Real-time Notification Watcher
 */
export function stopRealtimeWatcher() {
  if (watcherInterval) {
    clearInterval(watcherInterval);
    watcherInterval = null;
  }
  isWatcherActive = false;
}

export default {
  setupPushNotificationPermissions,
  triggerRealtimeNotification,
  startRealtimeWatcher,
  stopRealtimeWatcher,
};

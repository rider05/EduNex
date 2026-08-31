// utils/notificationUtils.js
import * as Notifications from "expo-notifications";
import * as Haptics from "expo-haptics";
import { secureGet, secureSet } from "../services/secureStorage";
import { showToast } from "./toastService";
import Toast from "react-native-toast-message";

// Real-time notification event emitter
const notifListeners = new Set();

export function subscribeToNotifications(callback) {
  notifListeners.add(callback);
  return () => notifListeners.delete(callback);
}

function notifySubscribers(notif) {
  notifListeners.forEach((cb) => {
    try {
      cb(notif);
    } catch (e) {
      console.warn("Notification listener error:", e);
    }
  });
}

function getStorageKey(role, userIdentifier) {
  if (userIdentifier) {
    return `edunex_notifs_${role || "all"}_${String(userIdentifier).toLowerCase().trim()}`;
  }
  return `edunex_notifs_${role || "all"}`;
}

/**
 * Retrieve stored targeted notifications for a user/role
 */
export async function getUserNotifications(role, userIdentifier) {
  try {
    const key = getStorageKey(role, userIdentifier);
    const list = await secureGet(key);
    const globalList = await secureGet("edunex_notifs_broadcast");

    const merged = [
      ...(Array.isArray(list) ? list : []),
      ...(Array.isArray(globalList) ? globalList : []),
    ];

    // Sort by timestamp desc
    return merged.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  } catch (err) {
    console.warn("getUserNotifications error:", err);
    return [];
  }
}

/**
 * Save notification record in encrypted secure storage
 */
export async function saveUserNotification(role, userIdentifier, notifObj) {
  try {
    const key = getStorageKey(role, userIdentifier);
    const current = (await secureGet(key)) || [];
    const list = Array.isArray(current) ? current : [];
    const updated = [notifObj, ...list.filter((n) => n.id !== notifObj.id)].slice(0, 50); // keep 50 recent
    await secureSet(key, updated);
    return updated;
  } catch (err) {
    console.warn("saveUserNotification error:", err);
    return [];
  }
}

/**
 * Mark notification as read
 */
export async function markNotificationRead(role, userIdentifier, notifId) {
  try {
    const key = getStorageKey(role, userIdentifier);
    const current = (await secureGet(key)) || [];
    if (Array.isArray(current)) {
      const updated = current.map((n) => (n.id === notifId ? { ...n, isRead: true, isNew: false } : n));
      await secureSet(key, updated);
      return updated;
    }
  } catch (err) {
    console.warn("markNotificationRead error:", err);
  }
  return [];
}

/**
 * Send a targeted notification to a specific role and/or specific student/staff
 */
export async function sendTargetedNotification({
  targetRole, // 'staff' | 'student' | 'parent' | 'admin' | 'all'
  targetRollNo, // Optional: specific student rollNo or staff ID
  title,
  message,
  type = "info", // 'info' | 'success' | 'warning' | 'error'
  metadata = {},
}) {
  try {
    const notif = {
      id: `notif_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      title,
      message,
      type,
      targetRole: targetRole || "all",
      targetRollNo: targetRollNo || null,
      metadata,
      createdAt: new Date().toISOString(),
      isRead: false,
      isNew: true,
    };

    // 1. Persist to secure storage for target
    await saveUserNotification(targetRole, targetRollNo, notif);

    // 2. Also save to role-level store if targeted to a specific rollNo
    if (targetRollNo && targetRole) {
      await saveUserNotification(targetRole, null, notif);
    }

    // 3. Check currently logged in user role & preference
    const activeRole = await secureGet("userRole");
    const activeUser = await secureGet("userData");
    const activeRoll = activeUser?.profile?.rollNo || activeUser?.rollNo || activeUser?.username || "";

    const matchesRole = !targetRole || targetRole === "all" || targetRole === activeRole;
    const matchesUser = !targetRollNo || String(activeRoll).toLowerCase().trim() === String(targetRollNo).toLowerCase().trim();

    if (matchesRole && matchesUser) {
      // 1. Deliver native system heads-up notification with sound & badge
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title,
            body: message,
            data: metadata,
            sound: "default",
            badge: 1,
            channelId: "edunex_alerts",
          },
          trigger: null,
        }).catch(() => {});
      } catch (_notifErr) {}

      // 2. Physical Haptic feedback
      try {
        if (type === "success") {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        } else if (type === "warning" || type === "error") {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        } else {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        }
      } catch (_hapticErr) {}

      // 3. Deliver in-app banner immediately
      showToast(message ? `${title}: ${message}` : title, type);
      Toast.show({
        type: type === "error" ? "error" : type === "warning" ? "error" : "success",
        text1: title,
        text2: message,
        position: "top",
        visibilityTime: 4000,
      });
    }

    // 4. Notify live app subscribers
    notifySubscribers(notif);
    return true;
  } catch (err) {
    console.warn("sendTargetedNotification error:", err);
    return false;
  }
}

/**
 * Legacy support for sendRoleBasedNotification
 */
export const sendRoleBasedNotification = async (title, message, type = "info") => {
  const role = await secureGet("userRole");
  return sendTargetedNotification({
    targetRole: role || "all",
    title,
    message,
    type,
  });
};

export default {
  getUserNotifications,
  saveUserNotification,
  markNotificationRead,
  sendTargetedNotification,
  sendRoleBasedNotification,
  subscribeToNotifications,
};
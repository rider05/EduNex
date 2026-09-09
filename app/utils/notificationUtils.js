// utils/notificationUtils.js
import * as Notifications from "./safeNotifications";
import * as Haptics from "expo-haptics";
import { secureGet, secureSet } from "../services/secureStorage";
import { showToast } from "./toastService";
import Toast from "react-native-toast-message";

// Real-time notification event emitter
const notifListeners = new Set();
const navigationListeners = new Set();

export function subscribeToNotifications(callback) {
  notifListeners.add(callback);
  return () => notifListeners.delete(callback);
}

export function onNavigateToNotification(callback) {
  navigationListeners.add(callback);
  return () => navigationListeners.delete(callback);
}

export function handleNotificationAction(notifData) {
  if (!notifData) return;
  const title = (notifData.title || notifData.subject || "").toLowerCase();
  const text = (notifData.message || notifData.text || "").toLowerCase();
  const meta = notifData.metadata || notifData.data || {};
  const notifType = (meta.type || notifData.type || "").toLowerCase();

  let targetModal = "notice_detail";

  if (
    title.includes("leave") ||
    title.includes("gate pass") ||
    title.includes("on-duty") ||
    title.includes("od ") ||
    title.includes(" od") ||
    text.includes("leave request") ||
    text.includes("gate pass") ||
    meta.leaveId
  ) {
    if (meta.targetRole === "staff" || notifData.targetRole === "staff") {
      targetModal = "staff_leave";
    } else if (meta.targetRole === "parent" || notifData.targetRole === "parent") {
      targetModal = "entryexit";
    } else {
      targetModal = "leave";
    }
  } else if (
    title.includes("hostel") ||
    title.includes("outing") ||
    text.includes("hostel pass") ||
    text.includes("hostel warden") ||
    notifType === "hostel"
  ) {
    targetModal = "hostel";
  } else if (
    title.includes("fee") ||
    title.includes("invoice") ||
    title.includes("dues") ||
    title.includes("payment") ||
    text.includes("fee due") ||
    text.includes("tuition fee") ||
    text.includes("receipt") ||
    notifType === "fees"
  ) {
    targetModal = "fees";
  } else if (
    title.includes("assignment") ||
    text.includes("assignment") ||
    title.includes("homework") ||
    notifType === "assignment"
  ) {
    targetModal = "assignment";
  } else if (
    title.includes("class test") ||
    title.includes("quiz") ||
    notifType === "test"
  ) {
    targetModal = "test";
  } else if (
    title.includes("exam") ||
    title.includes("cia") ||
    title.includes("assessment") ||
    text.includes("exam timetable") ||
    text.includes("cia exam") ||
    notifType === "exam"
  ) {
    targetModal = "exam";
  } else if (
    title.includes("bus") ||
    title.includes("transport") ||
    text.includes("bus location") ||
    text.includes("boarding point") ||
    notifType === "bus"
  ) {
    targetModal = "bus";
  } else if (
    title.includes("mess") ||
    title.includes("canteen") ||
    title.includes("menu") ||
    notifType === "mess"
  ) {
    targetModal = "mess";
  } else if (
    title.includes("library") ||
    title.includes("book") ||
    text.includes("library due") ||
    notifType === "library"
  ) {
    targetModal = "library";
  } else if (
    title.includes("attendance") ||
    text.includes("shortage") ||
    text.includes("present") ||
    text.includes("absent") ||
    notifType === "attendance"
  ) {
    targetModal = "attendance";
  } else if (
    title.includes("timetable") ||
    title.includes("schedule") ||
    text.includes("period") ||
    notifType === "timetable"
  ) {
    targetModal = "timetable";
  } else if (
    notifType === "chat" ||
    title.includes("chat") ||
    title.includes("message") ||
    title.includes("tutor") ||
    title.includes("faculty") ||
    title.includes("doubt") ||
    title.includes("dm") ||
    title.includes("broadcast")
  ) {
    targetModal = "chat";
  }

  navigationListeners.forEach((cb) => {
    try {
      cb({ target: targetModal, notifData });
    } catch (e) {
      console.warn("Navigation listener error:", e);
    }
  });
}

export function notifySubscribers(notif = {}) {
  notifListeners.forEach((cb) => {
    try {
      cb(notif);
    } catch (e) {
      console.warn("Notification listener error:", e);
    }
  });
}

/**
 * Check if a notice or notification is targeted to the given user context.
 * If targetRollNo / targetStudentId is specified, ONLY that student matches.
 * Other students will never receive or see this notification.
 */
export function isNotificationForUser(notif, userContext = {}) {
  if (!notif) return false;

  const {
    role = "student",
    rollNo = "",
    studentId = "",
    username = "",
    id = "",
    department = "",
    year = "",
    section = "",
  } = userContext;

  // Normalized user identifiers for the currently active user
  const userIdentifiers = [rollNo, studentId, username, id]
    .filter(Boolean)
    .map((s) => String(s).trim().toLowerCase());

  // 1. SPECIFIC STUDENT / USER TARGET (Strict Isolation)
  const notifTargetUser = (
    notif.targetRollNo ||
    notif.targetStudentId ||
    notif.targetRoll ||
    notif.rollNo ||
    notif.studentId ||
    notif.recipientId ||
    notif.targetUserId ||
    notif.studentRollNo ||
    notif.metadata?.targetRollNo ||
    notif.metadata?.targetStudentId ||
    notif.metadata?.recipientId ||
    ""
  ).toString().trim().toLowerCase();

  if (notifTargetUser && notifTargetUser !== "all" && notifTargetUser !== "broadcast" && notifTargetUser !== "everyone") {
    // If targeted to a specific student/user, ONLY that exact user matches!
    const matchesUser = userIdentifiers.some((uId) => uId === notifTargetUser);
    if (!matchesUser) {
      return false; // Do NOT show or push to other students
    }
  }

  // 2. TARGET ROLE / AUDIENCE CHECK
  const targetRole = (
    notif.targetRole ||
    notif.audience ||
    notif.role ||
    notif.senderRole === "admin" ? notif.targetRole : "" ||
    notif.metadata?.targetRole ||
    ""
  ).toString().trim().toLowerCase();

  if (targetRole && targetRole !== "all" && targetRole !== "everyone" && targetRole !== "campus" && targetRole !== "broadcast") {
    const currentRole = String(role).trim().toLowerCase();
    const isRoleMatch =
      currentRole === targetRole ||
      (currentRole === "stud" && targetRole === "student") ||
      (currentRole === "student" && targetRole === "stud") ||
      (currentRole === "faculty" && targetRole === "staff") ||
      (currentRole === "staff" && targetRole === "faculty") ||
      currentRole === "admin"; // Admins can audit all

    if (!isRoleMatch) {
      return false;
    }
  }

  // 3. TARGET DEPARTMENT CHECK (Optional filter)
  const targetDept = (
    notif.targetDepartment ||
    notif.department ||
    notif.dept ||
    notif.metadata?.targetDepartment ||
    ""
  ).toString().trim().toLowerCase();

  if (targetDept && targetDept !== "all" && targetDept !== "all departments" && department) {
    const currentDept = String(department).trim().toLowerCase();
    const matchesDept = currentDept.includes(targetDept) || targetDept.includes(currentDept);
    if (!matchesDept) {
      return false;
    }
  }

  // 4. TARGET YEAR CHECK (Optional filter)
  const targetYr = (
    notif.targetYear ||
    notif.year ||
    notif.metadata?.targetYear ||
    ""
  ).toString().trim().toLowerCase();

  if (targetYr && targetYr !== "all" && year) {
    const currentYr = String(year).trim().toLowerCase();
    const matchesYear = currentYr.includes(targetYr) || targetYr.includes(currentYr);
    if (!matchesYear) {
      return false;
    }
  }

  // 5. TARGET SECTION / CLASS CHECK (Optional filter)
  const targetSec = (
    notif.targetSection ||
    notif.section ||
    notif.class ||
    notif.batch ||
    notif.metadata?.targetSection ||
    ""
  ).toString().trim().toLowerCase();

  if (targetSec && targetSec !== "all" && section) {
    const currentSec = String(section).trim().toLowerCase();
    const matchesSection = currentSec.includes(targetSec) || targetSec.includes(currentSec);
    if (!matchesSection) {
      return false;
    }
  }

  return true;
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
export async function getUserNotifications(role, userIdentifier, userContext = null) {
  try {
    const key = getStorageKey(role, userIdentifier);
    const list = await secureGet(key);
    const globalList = await secureGet("edunex_notifs_broadcast");

    const merged = [
      ...(Array.isArray(list) ? list : []),
      ...(Array.isArray(globalList) ? globalList : []),
    ];

    // Filter out notifications targeted to other students
    const effectiveContext = userContext || {
      role: role || "student",
      rollNo: userIdentifier || "",
      studentId: userIdentifier || "",
      username: userIdentifier || "",
    };

    const filtered = merged.filter((n) => isNotificationForUser(n, effectiveContext));

    // Sort by timestamp desc
    return filtered.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
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

    // 1. Persist strictly to secure storage for the targeted recipient only
    if (targetRollNo) {
      await saveUserNotification(targetRole || "student", targetRollNo, notif);
    } else {
      // Broadcast to all users in this role
      await saveUserNotification(targetRole || "all", null, notif);
    }

    // 2. Check currently logged in user role & roll number
    const activeRole = await secureGet("userRole");
    const activeUser = await secureGet("userData");
    const activeRoll =
      activeUser?.profile?.rollNo ||
      activeUser?.rollNo ||
      activeUser?.username ||
      activeUser?.student?.rollNo ||
      "";

    const userContext = {
      role: activeRole,
      rollNo: activeRoll,
      username: activeUser?.username || "",
      studentId: activeUser?.student?.id || activeUser?.id || "",
    };

    const isForCurrentUser = isNotificationForUser(notif, userContext);

    if (isForCurrentUser) {
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

      // 4. Notify live app subscribers
      notifySubscribers(notif);
    }

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
  isNotificationForUser,
};
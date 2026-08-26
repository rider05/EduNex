// utils/notificationUtils.js
import AsyncStorage from "@react-native-async-storage/async-storage";
import { showToast } from "./toastService";
import Toast from "react-native-toast-message";

/**
 * Send an in-app notification if both global and user-level notifications are enabled
 */
export const sendRoleBasedNotification = async (title, message, type = "info") => {
  try {
    const role = await AsyncStorage.getItem("userRole");

    // 🔹 Role → Preference Key Mapping
    const roleKeys = {
      admin: "notificationsEnabled", // from SystemSettingsAdmin
      student: "student_notifications_v2", // from ProfileScreen
      staff: "staffNotifications",   // from ProfileStaff
      parent: "parentNotifications", // from ProfileParent
    };

    const prefKey = role ? roleKeys[role] : null;
    let isAllowed = true;

    // 1️⃣ Check Admin Global Notifications (from SystemSettingsAdmin)
    const adminSettings = await AsyncStorage.getItem("adminSettings");
    if (adminSettings) {
      try {
        const parsed = JSON.parse(adminSettings);
        if (parsed.notifications === false) {
          console.log("🔕 Global notifications disabled by admin.");
          return false;
        }
      } catch (_e) {
        // silent fallback
      }
    }

    // 2️⃣ Check Personal Role Preference
    if (prefKey) {
      const storedPref = await AsyncStorage.getItem(prefKey);
      if (storedPref !== null) {
        try {
          isAllowed = JSON.parse(storedPref);
        } catch (_e) {
          isAllowed = true;
        }
      }
    }

    // 3️⃣ Block Notification if Disabled
    if (!isAllowed) {
      console.log(`🔕 Notifications disabled for ${role}.`);
      return false;
    }

    // 4️⃣ Deliver via Unified In-App Toast & Alert system
    showToast(message ? `${title}: ${message}` : title, type);
    Toast.show({
      type: type === "error" ? "error" : type === "warning" ? "error" : "success",
      text1: title,
      text2: message,
      position: "top",
      visibilityTime: 3500,
    });

    console.log("✅ In-app notification delivered successfully!");
    return true;
  } catch (err) {
    console.warn("❌ Notification error:", err);
    return false;
  }
};

export default {
  sendRoleBasedNotification,
};
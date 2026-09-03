import { Linking } from "react-native";
import Constants from "expo-constants";
import { api } from "./api";
import { secureGet, secureSet } from "./secureStorage";

export const CURRENT_APP_VERSION =
  Constants.expoConfig?.version ||
  Constants.manifest?.version ||
  "1.0.0";

const DISMISSED_UPDATE_KEY = "edunex_dismissed_update_version";

/**
 * Compare two semver strings (e.g. "1.1.0" vs "1.0.0")
 * Returns:
 *   1 if v1 > v2
 *  -1 if v1 < v2
 *   0 if v1 === v2
 */
export function compareVersions(v1 = "1.0.0", v2 = "1.0.0") {
  const p1 = String(v1).replace(/[^0-9.]/g, "").split(".").map((n) => parseInt(n, 10) || 0);
  const p2 = String(v2).replace(/[^0-9.]/g, "").split(".").map((n) => parseInt(n, 10) || 0);
  const len = Math.max(p1.length, p2.length);

  for (let i = 0; i < len; i++) {
    const num1 = p1[i] || 0;
    const num2 = p2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

/**
 * Check backend for new app version releases
 */
export async function checkAppUpdate(ignoreDismissed = false) {
  try {
    const res = await api.get("/appUpdates", { limit: 5, sort: "-versionCode" }, { bypassCache: true });
    const updates = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : res?.docs || [];

    if (!updates || updates.length === 0) {
      return { updateAvailable: false, currentVersion: CURRENT_APP_VERSION };
    }

    // Pick latest active release
    const latest = updates.find((u) => u.isActive !== false) || updates[0];
    if (!latest || !latest.version) {
      return { updateAvailable: false, currentVersion: CURRENT_APP_VERSION };
    }

    const isNewer = compareVersions(latest.version, CURRENT_APP_VERSION) > 0;
    if (!isNewer) {
      return { updateAvailable: false, currentVersion: CURRENT_APP_VERSION, latestVersion: latest.version };
    }

    // Check if user previously dismissed this version (unless forceUpdate is true)
    const isForceUpdate = Boolean(
      latest.forceUpdate ||
      (latest.minSupportedVersion && compareVersions(CURRENT_APP_VERSION, latest.minSupportedVersion) < 0)
    );

    if (!ignoreDismissed && !isForceUpdate) {
      const dismissedVer = await secureGet(DISMISSED_UPDATE_KEY);
      if (dismissedVer === latest.version) {
        return { updateAvailable: false, dismissed: true, currentVersion: CURRENT_APP_VERSION, latestVersion: latest.version };
      }
    }

    return {
      updateAvailable: true,
      forceUpdate: isForceUpdate,
      currentVersion: CURRENT_APP_VERSION,
      latestVersion: latest.version,
      title: latest.title || `New Update v${latest.version} Available! 🚀`,
      releaseNotes: latest.releaseNotes || "• Performance enhancements & bug fixes",
      downloadUrl: latest.downloadUrl || latest.apkUrl || "https://github.com/rider05/EduNex/releases/latest",
      apkUrl: latest.apkUrl || latest.downloadUrl,
      releaseDate: latest.releaseDate || new Date().toISOString().slice(0, 10),
      fileSize: latest.fileSize || "38 MB",
    };
  } catch (err) {
    console.warn("[updateService] Update check failed:", err.message);
    return { updateAvailable: false, error: err.message, currentVersion: CURRENT_APP_VERSION };
  }
}

/**
 * Dismiss an update version for subsequent app launches
 */
export async function dismissUpdate(version) {
  try {
    if (version) {
      await secureSet(DISMISSED_UPDATE_KEY, String(version));
    }
  } catch (err) {
    console.warn("Failed to save dismissed update version:", err);
  }
}

/**
 * Open the download / update URL
 */
export async function openUpdateUrl(url) {
  const target = url || "https://github.com/rider05/EduNex/releases/latest";
  try {
    const supported = await Linking.canOpenURL(target);
    if (supported) {
      await Linking.openURL(target);
    } else {
      await Linking.openURL("https://github.com/rider05/EduNex/releases/latest");
    }
  } catch (err) {
    console.warn("Error opening update URL:", err);
  }
}

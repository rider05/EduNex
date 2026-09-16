import { Platform } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";

// Check if running in Expo Go (Store Client)
let inExpoGo = false;
try {
  const { isRunningInExpoGo } = require("expo");
  inExpoGo = typeof isRunningInExpoGo === "function" ? isRunningInExpoGo() : false;
} catch {
  inExpoGo = Constants?.executionEnvironment === ExecutionEnvironment.StoreClient;
}

const isExpoGoAndroid = Platform.OS === "android" && inExpoGo;

let NativeNotifications = null;

if (!isExpoGoAndroid) {
  try {
    NativeNotifications = require("expo-notifications");
  } catch (err) {
    console.warn("Could not load native expo-notifications:", err?.message);
  }
}

// Fallback no-op implementations for Expo Go on Android
const fallbackNotifications = {
  AndroidImportance: {
    NONE: 0,
    MIN: 1,
    LOW: 2,
    DEFAULT: 3,
    HIGH: 4,
    MAX: 5,
  },
  AndroidNotificationPriority: {
    MIN: "min",
    LOW: "low",
    DEFAULT: "default",
    HIGH: "high",
    MAX: "max",
  },
  AndroidNotificationVisibility: {
    UNKNOWN: 0,
    PUBLIC: 1,
    PRIVATE: 0,
    SECRET: -1,
  },
  setNotificationHandler: (_handler) => {},
  setNotificationChannelAsync: async (_channelId, _channel) => null,
  setNotificationCategoryAsync: async (_categoryId, _actions, _options) => null,
  getPermissionsAsync: async () => ({ status: "granted", granted: true, canAskAgain: true, expires: "never" }),
  requestPermissionsAsync: async () => ({ status: "granted", granted: true, canAskAgain: true, expires: "never" }),
  scheduleNotificationAsync: async (_request) => "mock-notification-id",
  cancelScheduledNotificationAsync: async (_identifier) => {},
  cancelAllScheduledNotificationsAsync: async () => {},
  dismissNotificationAsync: async (_identifier) => {},
  dismissAllNotificationsAsync: async () => {},
  getBadgeCountAsync: async () => 0,
  setBadgeCountAsync: async (_badgeCount) => true,
  addNotificationResponseReceivedListener: (_listener) => ({
    remove: () => {},
  }),
  addNotificationReceivedListener: (_listener) => ({
    remove: () => {},
  }),
  useLastNotificationResponse: () => null,
};

const SafeNotifications = NativeNotifications || fallbackNotifications;

export const AndroidImportance = SafeNotifications.AndroidImportance || fallbackNotifications.AndroidImportance;
export const AndroidNotificationPriority = SafeNotifications.AndroidNotificationPriority || fallbackNotifications.AndroidNotificationPriority;
export const AndroidNotificationVisibility = SafeNotifications.AndroidNotificationVisibility || fallbackNotifications.AndroidNotificationVisibility;

export const setNotificationHandler = (handler) => SafeNotifications.setNotificationHandler ? SafeNotifications.setNotificationHandler(handler) : undefined;
export const setNotificationChannelAsync = async (channelId, channel) => SafeNotifications.setNotificationChannelAsync ? SafeNotifications.setNotificationChannelAsync(channelId, channel) : null;
export const setNotificationCategoryAsync = async (categoryId, actions, options) => SafeNotifications.setNotificationCategoryAsync ? SafeNotifications.setNotificationCategoryAsync(categoryId, actions, options) : null;
export const getPermissionsAsync = async () => SafeNotifications.getPermissionsAsync ? SafeNotifications.getPermissionsAsync() : fallbackNotifications.getPermissionsAsync();
export const requestPermissionsAsync = async () => SafeNotifications.requestPermissionsAsync ? SafeNotifications.requestPermissionsAsync() : fallbackNotifications.requestPermissionsAsync();
export const scheduleNotificationAsync = async (request) => SafeNotifications.scheduleNotificationAsync ? SafeNotifications.scheduleNotificationAsync(request) : fallbackNotifications.scheduleNotificationAsync(request);
export const cancelScheduledNotificationAsync = async (id) => SafeNotifications.cancelScheduledNotificationAsync ? SafeNotifications.cancelScheduledNotificationAsync(id) : undefined;
export const cancelAllScheduledNotificationsAsync = async () => SafeNotifications.cancelAllScheduledNotificationsAsync ? SafeNotifications.cancelAllScheduledNotificationsAsync() : undefined;
export const dismissNotificationAsync = async (id) => SafeNotifications.dismissNotificationAsync ? SafeNotifications.dismissNotificationAsync(id) : undefined;
export const dismissAllNotificationsAsync = async () => SafeNotifications.dismissAllNotificationsAsync ? SafeNotifications.dismissAllNotificationsAsync() : undefined;
export const getBadgeCountAsync = async () => SafeNotifications.getBadgeCountAsync ? SafeNotifications.getBadgeCountAsync() : 0;
export const setBadgeCountAsync = async (count) => SafeNotifications.setBadgeCountAsync ? SafeNotifications.setBadgeCountAsync(count) : true;
export const addNotificationResponseReceivedListener = (listener) => SafeNotifications.addNotificationResponseReceivedListener ? SafeNotifications.addNotificationResponseReceivedListener(listener) : fallbackNotifications.addNotificationResponseReceivedListener(listener);
export const addNotificationReceivedListener = (listener) => SafeNotifications.addNotificationReceivedListener ? SafeNotifications.addNotificationReceivedListener(listener) : fallbackNotifications.addNotificationReceivedListener(listener);
export const useLastNotificationResponse = SafeNotifications.useLastNotificationResponse || fallbackNotifications.useLastNotificationResponse;

export default SafeNotifications;

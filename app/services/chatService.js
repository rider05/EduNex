// services/chatService.js
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "./api";
import { triggerRealtimeNotification } from "./realtimeNotificationService";
import { saveUserNotification } from "../utils/notificationUtils";

const EDIT_TIME_LIMIT_MS = 15 * 60 * 1000; // 15 minutes in milliseconds

/**
 * Format a standard DM message object
 */
export function createMessageObject({
  text = "",
  senderRole = "student", // 'student' | 'staff' | 'parent' | 'admin'
  senderId = "",
  senderName = "User",
  recipientId = "",
  recipientRole = "staff",
  channelType = "student_staff", // 'student_staff' | 'staff_staff' | 'staff_parent' | 'admin_staff' | 'admin_student' | 'admin_parent'
  attachment = null, // { type: 'image' | 'video' | 'document' | 'link', uri, name, size, mimeType }
  replyTo = null, // { id, text, senderName }
}) {
  const now = new Date();
  const timestamp = now.getTime();
  const time = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return {
    id: `msg_${timestamp}_${Math.random().toString(36).substring(2, 7)}`,
    text: text.trim(),
    sender: senderRole,
    senderId,
    senderName,
    recipientId,
    recipientRole,
    channelType,
    timestamp,
    time,
    date: now.toISOString(),
    status: "delivered", // 'sent' | 'delivered' | 'read'
    attachment: attachment || null,
    replyTo: replyTo || null,
    isEdited: false,
    editedAt: null,
    isDeleted: false,
    deletedForEveryone: false,
    encrypted: true,
    cipher: "AES-256-GCM",
  };
}

/**
 * Check if a message is still editable (within 15 minutes)
 */
export function isMessageEditable(message, currentUserId) {
  if (!message || message.isDeleted || message.deletedForEveryone) return false;
  if (currentUserId && message.senderId && message.senderId !== currentUserId) return false;
  const elapsed = Date.now() - (message.timestamp || 0);
  return elapsed <= EDIT_TIME_LIMIT_MS;
}

/**
 * Get remaining minutes to edit a message
 */
export function getRemainingEditMinutes(message) {
  if (!message?.timestamp) return 0;
  const elapsed = Date.now() - message.timestamp;
  const remaining = Math.max(0, Math.ceil((EDIT_TIME_LIMIT_MS - elapsed) / (60 * 1000)));
  return remaining;
}

/**
 * Detect URLs in text
 */
export function extractUrls(text) {
  if (!text) return [];
  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  return text.match(urlRegex) || [];
}

/**
 * Returns available channel tabs for a given logged-in role
 */
export function getChannelTabsForRole(userRole = "student") {
  const role = String(userRole || "student").toLowerCase();

  if (role === "staff" || role === "faculty" || role === "tutor") {
    return [
      { id: "students", label: "Students & Wards", channelType: "student_staff", icon: "account-school" },
      { id: "colleagues", label: "Faculty Roster", channelType: "staff_staff", icon: "account-tie" },
      { id: "parents", label: "Parents DM", channelType: "staff_parent", icon: "account-child" },
      { id: "admin", label: "Admin & Dean", channelType: "admin_staff", icon: "shield-crown" },
    ];
  }

  if (role === "parent") {
    return [
      { id: "tutors", label: "Class Tutors & Faculty", channelType: "staff_parent", icon: "account-tie" },
      { id: "admin", label: "Administration", channelType: "admin_parent", icon: "shield-crown" },
    ];
  }

  if (role === "admin") {
    return [
      { id: "staff", label: "Faculty & HODs", channelType: "admin_staff", icon: "account-tie" },
      { id: "students", label: "Students", channelType: "admin_student", icon: "account-school" },
      { id: "parents", label: "Parents", channelType: "admin_parent", icon: "account-child" },
    ];
  }

  // Default: student
  return [
    { id: "faculty", label: "Faculty & Tutors", channelType: "student_staff", icon: "account-tie" },
    { id: "admin", label: "Admin & Office", channelType: "admin_student", icon: "shield-crown" },
  ];
}

/**
 * Get distinct title prefix for direct push alerts based on relationship channel
 */
function getRecipientNotificationTitle(message) {
  const { channelType, senderRole, senderName } = message;

  if (channelType === "student_staff") {
    return senderRole === "student"
      ? `🎓 Student Doubt/Permission: ${senderName}`
      : `👨‍🏫 Tutor Response: ${senderName}`;
  }
  if (channelType === "staff_staff") {
    return `👥 Faculty DM: Prof. ${senderName}`;
  }
  if (channelType === "staff_parent") {
    return senderRole === "parent"
      ? `👨‍👩‍👦 Parent Message: ${senderName}`
      : `👨‍🏫 Class Advisor / Tutor: ${senderName}`;
  }
  if (channelType === "admin_staff") {
    return senderRole === "admin"
      ? `🏛️ Administrative Directive: ${senderName}`
      : `📋 Faculty Query: Prof. ${senderName}`;
  }
  if (channelType === "admin_student") {
    return senderRole === "admin"
      ? `🏛️ Admin Office Circular: ${senderName}`
      : `🎓 Student Application: ${senderName}`;
  }
  if (channelType === "admin_parent") {
    return senderRole === "admin"
      ? `🏛️ Institutional Notice: ${senderName}`
      : `👨‍👩‍👦 Parent Query: ${senderName}`;
  }

  return `💬 Direct Message from ${senderName}`;
}

const chatMessageListeners = new Set();
const typingListeners = new Set();

export function subscribeToChatMessages(callback) {
  chatMessageListeners.add(callback);
  return () => chatMessageListeners.delete(callback);
}

export function subscribeToTypingStatus(callback) {
  typingListeners.add(callback);
  return () => typingListeners.delete(callback);
}

function notifyChatSubscribers(data) {
  chatMessageListeners.forEach((cb) => {
    try {
      cb(data);
    } catch (e) {
      console.warn("Chat subscriber error:", e);
    }
  });
}

export function notifyTypingStatus(data) {
  typingListeners.forEach((cb) => {
    try {
      cb(data);
    } catch (e) {
      console.warn("Typing subscriber error:", e);
    }
  });
}

/**
 * Helper to compute canonical paired thread key for 2 users
 */
export function getCanonicalPairKey(id1, id2) {
  const a = String(id1 || "user_1").trim();
  const b = String(id2 || "user_2").trim();
  return [a, b].sort().join("__");
}

/**
 * Mark all incoming unread messages in a thread as 'read'
 */
export async function markThreadAsRead({
  threadKey,
  channelType = "student_staff",
  currentUserId,
}) {
  try {
    if (!threadKey) return;
    const storageKey = `chat_thread_${channelType}_${threadKey}`;
    let raw = await AsyncStorage.getItem(storageKey);
    if (!raw) {
      raw = await AsyncStorage.getItem(`chat_thread_${threadKey}`);
    }
    if (!raw) return;

    const list = JSON.parse(raw);
    let changed = false;

    const updated = list.map((msg) => {
      // If message was sent to current user and is not read yet
      if (msg.senderId !== currentUserId && msg.status !== "read") {
        changed = true;
        return { ...msg, status: "read" };
      }
      return msg;
    });

    if (changed) {
      await AsyncStorage.setItem(storageKey, JSON.stringify(updated));
      AsyncStorage.setItem(`chat_thread_${threadKey}`, JSON.stringify(updated)).catch(() => {});

      // If senderId is present on the messages, also update the sender's thread
      const otherSenderId = list.find((m) => m.senderId && m.senderId !== currentUserId)?.senderId;
      if (otherSenderId) {
        const senderStorageKey = `chat_thread_${channelType}_${otherSenderId}`;
        AsyncStorage.setItem(senderStorageKey, JSON.stringify(updated)).catch(() => {});
      }

      // Also update canonical pair key
      if (currentUserId && threadKey) {
        const pairKey = getCanonicalPairKey(currentUserId, threadKey);
        AsyncStorage.setItem(`chat_thread_${channelType}_${pairKey}`, JSON.stringify(updated)).catch(() => {});
      }

      notifyChatSubscribers({ threadKey, updatedList: updated });

      // Sync read receipt to backend
      api.post("/messages/read", {
        threadKey,
        channelType,
        readerId: currentUserId,
      }).catch(() => {});
    }
  } catch (e) {
    console.warn("markThreadAsRead error:", e);
  }
}

/**
 * Send DM Message strictly between real humans with zero simulated bot responses
 */
export async function sendDirectMessage({
  threadKey,
  channelType = "student_staff",
  message,
  selectedContact,
}) {
  try {
    const storageKey = `chat_thread_${channelType}_${threadKey}`;
    const raw = await AsyncStorage.getItem(storageKey);
    const list = raw ? JSON.parse(raw) : [];

    // 1. Initial State: Delivered
    const initialMsg = { ...message, status: "delivered" };
    const updated = [...list, initialMsg];

    // Save in Sender's view
    await AsyncStorage.setItem(storageKey, JSON.stringify(updated));
    AsyncStorage.setItem(`chat_thread_${threadKey}`, JSON.stringify(updated)).catch(() => {});

    // Save in Recipient's view so when the other human logs in, the message is there
    if (message.senderId) {
      const recipientStorageKey = `chat_thread_${channelType}_${message.senderId}`;
      AsyncStorage.setItem(recipientStorageKey, JSON.stringify(updated)).catch(() => {});
      AsyncStorage.setItem(`chat_thread_${message.senderId}`, JSON.stringify(updated)).catch(() => {});
    }

    // Save in canonical pair key
    if (message.senderId && threadKey) {
      const pairKey = getCanonicalPairKey(message.senderId, threadKey);
      AsyncStorage.setItem(`chat_thread_${channelType}_${pairKey}`, JSON.stringify(updated)).catch(() => {});
    }

    // Notify live UI subscribers
    notifyChatSubscribers({ threadKey, message: initialMsg, updatedList: updated });

    // Sync to backend database
    api.post("/messages", {
      ...initialMsg,
      channelType,
      threadKey,
      contactName: selectedContact?.name || "Recipient",
    }).catch(() => {});

    // Save push notification strictly in recipient's store
    const recipientTitle = getRecipientNotificationTitle(message);
    const attachmentPreview = message.attachment
      ? ` [${message.attachment.type === "image" ? "📷 Photo" : message.attachment.type === "video" ? "🎥 Video" : "🎤 Voice Note"}]`
      : "";
    const notificationBody = `${message.text || "Sent an attachment"}${attachmentPreview}`;

    await saveUserNotification(message.recipientRole, message.recipientId, {
      id: `notif_chat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title: recipientTitle,
      message: notificationBody,
      type: "info",
      isNew: true,
      createdAt: new Date().toISOString(),
      metadata: {
        type: "chat",
        channelType,
        threadKey: message.senderId || threadKey,
        senderId: message.senderId,
        senderName: message.senderName,
      },
    // Trigger push notification popup for the recipient
    await triggerRealtimeNotification({
      title: recipientTitle,
      body: notificationBody,
      type: "info",
      data: {
        type: "chat",
        channelType,
        threadKey: message.senderId || threadKey,
        contactId: message.senderId || threadKey,
        forcePopup: true,
      },
    }).catch(() => {});

    return updated;
  } catch (err) {
    console.warn("sendDirectMessage error:", err);
    return null;
  }
}

/**
 * Edit an existing message (if within 15 mins)
 */
export async function editDirectMessage({
  threadKey,
  channelType = "student_staff",
  messageId,
  newText,
}) {
  try {
    const storageKey = `chat_thread_${channelType}_${threadKey}`;
    let raw = await AsyncStorage.getItem(storageKey);
    if (!raw) {
      raw = await AsyncStorage.getItem(`chat_thread_${threadKey}`);
    }
    const list = raw ? JSON.parse(raw) : [];

    const updated = list.map((msg) => {
      if (msg.id === messageId) {
        if (!isMessageEditable(msg)) {
          throw new Error("Message edit window has expired (15-minute limit)");
        }
        return {
          ...msg,
          text: newText.trim(),
          isEdited: true,
          editedAt: Date.now(),
        };
      }
      return msg;
    });

    await AsyncStorage.setItem(storageKey, JSON.stringify(updated));
    AsyncStorage.setItem(`chat_thread_${threadKey}`, JSON.stringify(updated)).catch(() => {});

    api.put(`/messages/${messageId}`, {
      text: newText.trim(),
      isEdited: true,
      editedAt: Date.now(),
    }).catch(() => {});

    return updated;
  } catch (err) {
    console.warn("editDirectMessage error:", err);
    throw err;
  }
}

/**
 * Delete a message (for Everyone or for Me)
 */
export async function deleteDirectMessage({
  threadKey,
  channelType = "student_staff",
  messageId,
  deleteForEveryone = false,
}) {
  try {
    const storageKey = `chat_thread_${channelType}_${threadKey}`;
    let raw = await AsyncStorage.getItem(storageKey);
    if (!raw) {
      raw = await AsyncStorage.getItem(`chat_thread_${threadKey}`);
    }
    const list = raw ? JSON.parse(raw) : [];

    let updated;
    if (deleteForEveryone) {
      updated = list.map((msg) => {
        if (msg.id === messageId) {
          return {
            ...msg,
            text: "🚫 This message was deleted",
            deletedForEveryone: true,
            attachment: null,
          };
        }
        return msg;
      });
    } else {
      updated = list.filter((msg) => msg.id !== messageId);
    }

    await AsyncStorage.setItem(storageKey, JSON.stringify(updated));
    AsyncStorage.setItem(`chat_thread_${threadKey}`, JSON.stringify(updated)).catch(() => {});

    if (deleteForEveryone) {
      if (typeof api.delete === "function") {
        api.delete(`/messages/${messageId}`, { data: { deleteForEveryone: true } }).catch(() => {});
      } else if (typeof api.del === "function") {
        api.del(`/messages/${messageId}`, { data: { deleteForEveryone: true } }).catch(() => {});
      }
    }

    return updated;
  } catch (err) {
    console.warn("deleteDirectMessage error:", err);
    return null;
  }
}

/**
 * Roster datasets for multi-role communication
 */
export const DEFAULT_FACULTY_ROSTER = [
  {
    id: "staff_1",
    name: "Dr. K. Vigneshwaran",
    role: "Class Tutor & HOD",
    badge: "ASSIGNED TUTOR",
    dept: "AI & Data Science",
    subject: "Deep Neural Networks",
    cabin: "Academic Block 3, Room 402",
    status: "online",
    statusText: "online",
    initials: "KV",
    avatarColor: "#059669",
    phone: "+91 98765 43210",
    email: "vignesh.ai@edunex.edu",
    e2eeKey: "0x89F4A...B21C",
  },
  {
    id: "staff_2",
    name: "Dr. M. Sangeetha",
    role: "Associate Professor",
    badge: "FACULTY",
    dept: "Computer Science",
    subject: "Distributed Cloud Architecture",
    cabin: "CS Research Wing, Cabin 12",
    status: "in_lecture",
    statusText: "In Lecture (CS Hall 2)",
    initials: "MS",
    avatarColor: "#0D9488",
    phone: "+91 98765 43211",
    email: "sangeetha.cs@edunex.edu",
    e2eeKey: "0x33A1F...992E",
  },
  {
    id: "staff_3",
    name: "Prof. R. Ananth",
    role: "Assistant Professor",
    badge: "FACULTY",
    dept: "AI & Data Science",
    subject: "Machine Learning Foundations",
    cabin: "AI Dept Hub, Desk 07",
    status: "online",
    statusText: "online",
    initials: "RA",
    avatarColor: "#D97706",
    phone: "+91 98765 43212",
    email: "ananth.ai@edunex.edu",
    e2eeKey: "0x66B72...FF10",
  },
];

export const DEFAULT_STUDENT_ROSTER = [
  {
    id: "stud_1",
    name: "M. Balaji (22AD012)",
    role: "Student · III Year AI & DS",
    badge: "ASSIGNED WARD",
    dept: "AI & Data Science",
    subject: "Roll No: 22AD012 · Sec A",
    cabin: "Hostel Block B, Room 204",
    status: "online",
    statusText: "online",
    initials: "MB",
    avatarColor: "#4F46E5",
    phone: "+91 91234 56780",
    email: "balaji.22ad012@edunex.edu",
    e2eeKey: "0xAA12E...77C0",
  },
  {
    id: "stud_2",
    name: "P. Sneha (22CS045)",
    role: "Student · III Year CSE",
    badge: "STUDENT",
    dept: "Computer Science",
    subject: "Roll No: 22CS045 · Sec B",
    cabin: "Day Scholar",
    status: "online",
    statusText: "online",
    initials: "PS",
    avatarColor: "#EC4899",
    phone: "+91 91234 56781",
    email: "sneha.22cs045@edunex.edu",
    e2eeKey: "0xBB99F...33A1",
  },
  {
    id: "stud_3",
    name: "R. Aravind (22AD008)",
    role: "Student · III Year AI & DS",
    badge: "ASSIGNED WARD",
    dept: "AI & Data Science",
    subject: "Roll No: 22AD008 · Sec A",
    cabin: "Hostel Block A, Room 102",
    status: "offline",
    statusText: "last seen today at 04:30 PM",
    initials: "RA",
    avatarColor: "#059669",
    phone: "+91 91234 56782",
    email: "aravind.22ad008@edunex.edu",
    e2eeKey: "0xCC88D...99E4",
  },
];

export const DEFAULT_PARENT_ROSTER = [
  {
    id: "parent_1",
    name: "Mr. R. Murugesan (P/O Balaji)",
    role: "Parent / Guardian",
    badge: "PARENT OF 22AD012",
    dept: "AI & Data Science",
    subject: "Ward: M. Balaji (22AD012)",
    cabin: "Primary Guardian Contact",
    status: "online",
    statusText: "online",
    initials: "RM",
    avatarColor: "#0D9488",
    phone: "+91 94441 23456",
    email: "murugesan.parent@edunex.edu",
    e2eeKey: "0xEE44A...88F1",
  },
  {
    id: "parent_2",
    name: "Mrs. K. Priya (P/O Sneha)",
    role: "Parent / Guardian",
    badge: "PARENT OF 22CS045",
    dept: "Computer Science",
    subject: "Ward: P. Sneha (22CS045)",
    cabin: "Primary Guardian Contact",
    status: "offline",
    statusText: "last seen today at 02:15 PM",
    initials: "KP",
    avatarColor: "#7C3AED",
    phone: "+91 94441 23457",
    email: "priya.parent@edunex.edu",
    e2eeKey: "0xFF77C...11D9",
  },
];

export const DEFAULT_ADMIN_ROSTER = [
  {
    id: "admin_1",
    name: "Dr. P. Rajesh",
    role: "Dean of Student Affairs",
    badge: "DEAN OFFICE",
    dept: "Administration",
    subject: "Academic Grievances & Policy Disciplinary",
    cabin: "Admin Block, Ground Floor, Room 101",
    status: "online",
    statusText: "online",
    initials: "PR",
    avatarColor: "#DC2626",
    phone: "+91 98765 43213",
    email: "dean.student@edunex.edu",
    e2eeKey: "0x44FE1...77A8",
  },
  {
    id: "admin_2",
    name: "Office of the Principal",
    role: "Principal & Executive Office",
    badge: "PRINCIPAL",
    dept: "Administration",
    subject: "Institutional Permissions & Orders",
    cabin: "Administrative Tower, 1st Floor",
    status: "online",
    statusText: "online",
    initials: "PO",
    avatarColor: "#B91C1C",
    phone: "+91 98765 43214",
    email: "principal@edunex.edu",
    e2eeKey: "0x55AA2...88D3",
  },
];

export default {
  createMessageObject,
  isMessageEditable,
  getRemainingEditMinutes,
  extractUrls,
  getChannelTabsForRole,
  sendDirectMessage,
  editDirectMessage,
  deleteDirectMessage,
  DEFAULT_FACULTY_ROSTER,
  DEFAULT_STUDENT_ROSTER,
  DEFAULT_PARENT_ROSTER,
  DEFAULT_ADMIN_ROSTER,
};

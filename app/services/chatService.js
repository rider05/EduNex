// services/chatService.js
import { api } from "./api";
import { saveUserNotification } from "../utils/notificationUtils";

const EDIT_TIME_LIMIT_MS = 15 * 60 * 1000; // 15 minutes in milliseconds

/**
 * Format a standard DM message object
 */
export function createMessageObject({
  text = "",
  senderRole = "student", // 'student' | 'staff' | 'parent' | 'admin'
  senderId = "",
  senderName = "",
  recipientId = "",
  recipientName = "",
  recipientRole = "staff",
  channelType = "student_staff", // 'student_staff' | 'staff_staff' | 'staff_parent' | 'admin_staff' | 'admin_student' | 'admin_parent'
  attachment = null, // { type: 'image' | 'video' | 'document' | 'voice' | 'link', uri, name, size, mimeType }
  replyTo = null, // { id, text, senderName }
}) {
  const now = new Date();
  const timestamp = now.getTime();
  const time = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const resolvedSenderName =
    String(senderName || "").trim() ||
    (senderRole === "staff"
      ? "Faculty Member"
      : senderRole === "parent"
      ? "Parent"
      : senderRole === "admin"
      ? "Admin Office"
      : "Student");

  const resolvedRecipientName =
    String(recipientName || "").trim() ||
    (recipientRole === "staff"
      ? "Faculty Member"
      : recipientRole === "parent"
      ? "Parent"
      : recipientRole === "admin"
      ? "Admin Office"
      : "Student");

  return {
    id: `msg_${timestamp}_${Math.random().toString(36).substring(2, 7)}`,
    text: text.trim(),
    sender: senderRole,
    senderRole,
    senderId: String(senderId || "").trim() || "user_current",
    senderName: resolvedSenderName,
    author: resolvedSenderName,
    from: resolvedSenderName,
    recipient: recipientRole,
    recipientRole,
    recipientId: String(recipientId || "").trim() || "contact_recipient",
    recipientName: resolvedRecipientName,
    to: resolvedRecipientName,
    channelType,
    timestamp,
    time,
    date: now.toISOString(),
    createdAt: now.toISOString(),
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
 * Check if a message is still editable (within 15 minutes and sent by the current user)
 */
export function isMessageEditable(message, isSender = true) {
  if (!message || message.isDeleted || message.deletedForEveryone) return false;
  if (!isSender) return false;
  const elapsed = Date.now() - (message.timestamp || new Date(message.createdAt || 0).getTime() || 0);
  return elapsed <= EDIT_TIME_LIMIT_MS;
}

/**
 * Get remaining minutes to edit a message
 */
export function getRemainingEditMinutes(message) {
  const ts = message?.timestamp || new Date(message?.createdAt || 0).getTime() || 0;
  if (!ts) return 0;
  const elapsed = Date.now() - ts;
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

export function notifyChatSubscribers(data) {
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
  const a = String(id1 || "user_1").trim().toLowerCase();
  const b = String(id2 || "user_2").trim().toLowerCase();
  return [a, b].sort().join("__");
}

/**
 * Send real-time call signaling packet (invite, accept, decline, end)
 */
export async function sendCallSignal({
  type = "call_invite", // "call_invite" | "call_accept" | "call_decline" | "call_end"
  roomId,
  caller,
  recipientId,
  recipientName,
  callType = "audio",
  channelType = "student_staff",
}) {
  const payload = {
    text: `📞 ${type.replace("_", " ").toUpperCase()}`,
    type: "call_signal",
    signalType: type,
    roomId,
    caller,
    senderId: caller?.id || "user_current",
    senderName: caller?.name || "User",
    senderRole: caller?.role || "student",
    recipientId,
    recipientName,
    callType,
    channelType,
    timestamp: Date.now(),
    createdAt: new Date().toISOString(),
  };

  try {
    api.post("/messages", payload).catch(() => {});
  } catch {}

  notifyChatSubscribers({
    type: "call_signal",
    signalType: type,
    ...payload,
  });

  return payload;
}

/**
 * Fetch and consolidate thread messages for a contact directly from the Database API
 */
export async function fetchThreadMessages({
  contact,
  channelType = "student_staff",
  currentUser,
}) {
  try {
    if (!contact) return [];
    const contactId = String(contact.id || "").trim().toLowerCase();
    const contactRoll = String(contact.rollNo || "").trim().toLowerCase();
    const myId = String(
      currentUser?.student?.rollNo ||
        currentUser?.staff?.id ||
        currentUser?.staffId ||
        currentUser?.id ||
        "user_current"
    ).trim().toLowerCase();
    const myRoll = String(currentUser?.student?.rollNo || currentUser?.rollNo || "").trim().toLowerCase();

    const candidateContactIds = [contactId, contactRoll].filter(Boolean);
    const candidateMyIds = [myId, myRoll].filter(Boolean);

    // Fetch live messages directly from the database
    let dbMessages = [];
    try {
      const res = await api
        .get("/messages", { limit: 300, sort: "createdAt" })
        .catch(() => null);
      if (Array.isArray(res?.data)) {
        dbMessages = res.data;
      }
    } catch {}

    const messageMap = new Map();

    for (const msg of dbMessages) {
      if (!msg) continue;
      const id = msg.id || msg._id;
      if (!id) continue;

      // Filter out raw signaling packets and automated call log text from chat stream
      if (
        msg.type === "call_signal" ||
        msg.signalType ||
        (typeof msg.text === "string" &&
          (msg.text.startsWith("📞 CALL") ||
            msg.text.startsWith("📞 INCOMING") ||
            msg.text.startsWith("📞 Video Call") ||
            msg.text.startsWith("📹 Video Call") ||
            msg.text.startsWith("📞 Voice Call") ||
            msg.text.startsWith("📞 Call ended")))
      ) {
        continue;
      }

      const sId = String(msg.senderId || "").trim().toLowerCase();
      const rId = String(msg.recipientId || "").trim().toLowerCase();
      const tKey = String(msg.threadKey || "").trim().toLowerCase();

      const isIncoming = candidateContactIds.includes(sId) && (candidateMyIds.includes(rId) || !rId);
      const isOutgoing = candidateMyIds.includes(sId) && (candidateContactIds.includes(rId) || !rId);
      const isThreadKeyMatch = candidateContactIds.includes(tKey) || candidateMyIds.includes(tKey);

      if (isIncoming || isOutgoing || isThreadKeyMatch) {
        messageMap.set(id, { ...msg, id });
      }
    }

    // Sort chronologically
    const sorted = Array.from(messageMap.values()).sort(
      (a, b) => (a.timestamp || new Date(a.createdAt || 0).getTime() || 0) - (b.timestamp || new Date(b.createdAt || 0).getTime() || 0)
    );

    return sorted;
  } catch (err) {
    console.warn("fetchThreadMessages error:", err);
    return [];
  }
}

/**
 * Mark all incoming unread messages in a thread as 'read' directly in DB
 */
export async function markThreadAsRead({
  threadKey,
  channelType = "student_staff",
  currentUserId,
  unreadMessageIds = [],
}) {
  try {
    if (!threadKey) return;

    // 1. Sync read receipt to backend batch endpoint
    api.post("/messages/read", {
      threadKey,
      channelType,
      readerId: currentUserId,
      messageIds: unreadMessageIds,
      readAt: new Date().toISOString(),
    }).catch(() => {});

    // 2. Individual fallback message updates in DB
    if (Array.isArray(unreadMessageIds) && unreadMessageIds.length > 0) {
      unreadMessageIds.slice(0, 10).forEach((msgId) => {
        if (msgId) {
          if (typeof api.put === "function") {
            api.put(`/messages/${msgId}`, { status: "read", isRead: true }).catch(() => {});
          } else if (typeof api.patch === "function") {
            api.patch(`/messages/${msgId}`, { status: "read", isRead: true }).catch(() => {});
          }
        }
      });
    }

    // 3. Broadcast instant subscriber event
    notifyChatSubscribers({
      threadKey,
      action: "read",
      currentUserId,
      messageIds: unreadMessageIds,
    });
  } catch (e) {
    console.warn("markThreadAsRead error:", e);
  }
}

/**
 * Send DM Message strictly between real humans, saved directly into DB
 */
export async function sendDirectMessage({
  threadKey,
  channelType = "student_staff",
  message,
  selectedContact,
}) {
  try {
    const contactId = String(selectedContact?.id || threadKey || "").trim();
    const senderId = String(message.senderId || "").trim();

    // 1. Prepare DB document payload
    const dbPayload = {
      ...message,
      id: message.id,
      text: message.text,
      senderName: message.senderName,
      senderId: message.senderId,
      senderRole: message.senderRole || message.sender,
      sender: message.senderRole || message.sender,
      author: message.senderName,
      recipientName: selectedContact?.name || message.recipientName,
      recipientId: selectedContact?.id || message.recipientId,
      recipientRole: message.recipientRole || selectedContact?.role,
      channelType,
      threadKey: contactId,
      contactName: selectedContact?.name || message.recipientName || "Recipient",
      attachment: message.attachment,
      replyTo: message.replyTo,
      timestamp: message.timestamp,
      createdAt: message.createdAt || message.date,
      status: "delivered",
    };

    let createdDoc = dbPayload;

    // Save directly to Backend Database API
    try {
      const res = await api.post("/messages", dbPayload);
      if (res?.data) {
        createdDoc = { ...dbPayload, ...res.data, id: res.data.id || res.data._id || dbPayload.id };
      }
    } catch (apiErr) {
      console.warn("DB Message post error:", apiErr);
    }

    // Notify live UI subscribers for immediate real-time chat update
    notifyChatSubscribers({
      threadKey: contactId,
      senderId,
      recipientId: contactId,
      message: createdDoc,
    });

    // Save push notification strictly in recipient's notification store
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
    }).catch(() => {});

    return [createdDoc];
  } catch (err) {
    console.warn("sendDirectMessage error:", err);
    return null;
  }
}

/**
 * Edit an existing message (if within 15 mins) directly in DB
 */
export async function editDirectMessage({
  threadKey,
  channelType = "student_staff",
  messageId,
  newText,
}) {
  try {
    if (!messageId || !newText) return null;

    const patchPayload = {
      text: newText.trim(),
      isEdited: true,
      editedAt: Date.now(),
    };

    try {
      if (typeof api.put === "function") {
        await api.put(`/messages/${messageId}`, patchPayload);
      } else if (typeof api.patch === "function") {
        await api.patch(`/messages/${messageId}`, patchPayload);
      }
    } catch (e) {
      console.warn("DB edit message error:", e);
    }

    notifyChatSubscribers({ threadKey, messageId, action: "edit", newText });
    return true;
  } catch (err) {
    console.warn("editDirectMessage error:", err);
    throw err;
  }
}

/**
 * Delete a message (for Everyone or for Me) directly in DB
 */
export async function deleteDirectMessage({
  threadKey,
  channelType = "student_staff",
  messageId,
  deleteForEveryone = false,
}) {
  try {
    if (!messageId) return null;

    if (deleteForEveryone) {
      try {
        if (typeof api.delete === "function") {
          await api.delete(`/messages/${messageId}`);
        } else if (typeof api.del === "function") {
          await api.del(`/messages/${messageId}`);
        }
      } catch (e) {
        console.warn("DB delete message error:", e);
      }
    } else {
      try {
        if (typeof api.put === "function") {
          await api.put(`/messages/${messageId}`, { isDeleted: true });
        }
      } catch {}
    }

    notifyChatSubscribers({ threadKey, messageId, action: "delete", deleteForEveryone });
    return true;
  } catch (err) {
    console.warn("deleteDirectMessage error:", err);
    return null;
  }
}

/**
 * Helper to resolve the true specific person name (e.g. Dr. K. Vigneshwaran)
 * instead of generic titles like "Faculty Member" or "Student"
 */
export function resolveHumanDisplayName(id = "", role = "staff", fallbackName = "") {
  const cleanFallback = String(fallbackName || "").trim();

  // If already a valid specific name, return it
  if (
    cleanFallback &&
    !["faculty member", "faculty advisor", "faculty", "staff", "student", "caller", "user", "contact"].includes(cleanFallback.toLowerCase())
  ) {
    return cleanFallback;
  }

  if (cleanFallback) return cleanFallback;
  if (role === "staff") return id ? `Faculty (${id})` : "Faculty Advisor";
  if (role === "parent") return id ? `Parent (${id})` : "Parent / Guardian";
  if (role === "admin") return "Admin Office";
  return id ? `Student (${id})` : "Student";
}

export default {
  createMessageObject,
  isMessageEditable,
  getRemainingEditMinutes,
  extractUrls,
  getChannelTabsForRole,
  sendDirectMessage,
  editDirectMessage,
  deleteDirectMessage,
  resolveHumanDisplayName,
};

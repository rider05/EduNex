import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  Animated,
  Linking,
  ScrollView,
  Image,
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as Haptics from "expo-haptics";
import { useTheme } from "../../../context/ThemeContext";
import { api } from "../../../services/api";
import { showToast } from "../../../utils/toastService";
import { resolveIdentity } from "../../../services/identityService";
import {
  createMessageObject,
  isMessageEditable,
  getRemainingEditMinutes,
  extractUrls,
  getChannelTabsForRole,
  sendDirectMessage,
  editDirectMessage,
  deleteDirectMessage,
  markThreadAsRead,
  notifyTypingStatus,
  subscribeToChatMessages,
  subscribeToTypingStatus,
  DEFAULT_FACULTY_ROSTER,
  DEFAULT_STUDENT_ROSTER,
  DEFAULT_PARENT_ROSTER,
  DEFAULT_ADMIN_ROSTER,
} from "../../../services/chatService";
import { onNavigateToNotification } from "../../../utils/notificationUtils";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

const QUICK_PROMPTS = [
  "Good morning Professor, had a quick question regarding the assignment.",
  "Sir, could you please review my lab submission?",
  "Requesting a 10-minute cabin meeting today if convenient.",
  "Thank you for the guidance!",
];

export default function ChatModal({ visible, onClose }) {
  const { colors, isDarkMode } = useTheme();
  const slideAnim = useRef(new Animated.Value(100)).current;
  const flatListRef = useRef(null);
  const lastTapRef = useRef(0);

  // User identity
  const [currentUser, setCurrentUser] = useState(null);

  // Channel Tabs based on logged-in role
  const [selectedChannelTab, setSelectedChannelTab] = useState(null);

  // Screen View: 'directory' | 'chat'
  const [currentView, setCurrentView] = useState("directory");
  const [selectedStaff, setSelectedStaff] = useState(null);

  // Search & Department Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [deptFilter, setDeptFilter] = useState("All");

  // Contacts dataset
  const [contacts, setContacts] = useState(DEFAULT_FACULTY_ROSTER);

  // Chat message state keyed by contact id
  const [threads, setThreads] = useState({});
  const [newMsg, setNewMsg] = useState("");
  const [showStaffInfo, setShowStaffInfo] = useState(false);

  // Real-time Live Typing Presence State
  const [typingState, setTypingState] = useState(null);
  const dot1Opacity = useRef(new Animated.Value(0.3)).current;
  const dot2Opacity = useRef(new Animated.Value(0.3)).current;
  const dot3Opacity = useRef(new Animated.Value(0.3)).current;

  // In-Chat Search State
  const [inChatSearch, setInChatSearch] = useState(false);
  const [inChatSearchQuery, setInChatSearchQuery] = useState("");

  // Voice Note Recording & Playback State
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordingTimer, setRecordingTimer] = useState(0);
  const [activeVoiceNotePlaying, setActiveVoiceNotePlaying] = useState(null);
  const recordingIntervalRef = useRef(null);

  // Audio / Video Calling State
  const [isCalling, setIsCalling] = useState(false);
  const [callType, setCallType] = useState("audio");
  const [callTimer, setCallTimer] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);
  const callIntervalRef = useRef(null);

  // Message Interaction State (Long Press Action Sheet)
  const [actionMessage, setActionMessage] = useState(null);
  const [showActionSheet, setShowActionSheet] = useState(false);

  // Editing State
  const [editingMessage, setEditingMessage] = useState(null);

  // Replying Quote State
  const [replyingTo, setReplyingTo] = useState(null);

  // Attachment Sheet & Lightbox State
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState(null);
  const [lightboxImage, setLightboxImage] = useState(null);

  // Privacy E2EE Modal State
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  // Dynamic available channel tabs for current role
  const channelTabs = useMemo(() => {
    return getChannelTabsForRole(currentUser?.role || "student");
  }, [currentUser]);

  // Set default active tab
  useEffect(() => {
    if (channelTabs.length > 0 && !selectedChannelTab) {
      setSelectedChannelTab(channelTabs[0]);
    }
  }, [channelTabs, selectedChannelTab]);

  // 1. Initialize User Identity
  useEffect(() => {
    async function loadIdentity() {
      try {
        const id = await resolveIdentity();
        setCurrentUser(id);
      } catch (e) {
        console.log("Identity load err:", e);
      }
    }
    if (visible) {
      loadIdentity();
    }
  }, [visible]);

  // 2. Load Contacts based on Selected Channel Tab
  useEffect(() => {
    async function loadContactsForChannel() {
      if (!selectedChannelTab) return;
      const ch = selectedChannelTab.channelType;

      if (ch === "student_staff") {
        if (currentUser?.role === "staff") {
          // Staff viewing students
          try {
            const res = await api.get("/students").catch(() => null);
            if (Array.isArray(res?.data) && res.data.length > 0) {
              const mapped = res.data.map((s, idx) => ({
                id: s._id || s.id || `stud_${idx}`,
                name: `${s.name || "Student"} (${s.rollNo || s.roll || "22AD001"})`,
                role: `Student · ${s.department || "Engineering"}`,
                badge: idx === 0 ? "ASSIGNED WARD" : "STUDENT",
                dept: s.department || "AI & DS",
                subject: `Roll No: ${s.rollNo || "22AD001"} · Sec ${s.section || "A"}`,
                cabin: s.hostel ? `Hostel ${s.hostel}` : "Day Scholar",
                status: idx % 2 === 0 ? "online" : "offline",
                statusText: idx % 2 === 0 ? "online" : "offline",
                initials: (s.name || "S").slice(0, 2).toUpperCase(),
                avatarColor: idx % 2 === 0 ? "#4F46E5" : "#0D9488",
                phone: s.phone || "+91 91234 56780",
                email: s.email || "student@edunex.edu",
                e2eeKey: `0x${Math.random().toString(16).substring(2, 8).toUpperCase()}...A1`,
              }));
              setContacts(mapped);
              return;
            }
          } catch {}
          setContacts(DEFAULT_STUDENT_ROSTER);
        } else {
          // Student viewing staff / tutors
          try {
            const staffRes = await api.get("/staff").catch(() => null);
            if (Array.isArray(staffRes?.data) && staffRes.data.length > 0) {
              const mapped = staffRes.data.map((s, idx) => ({
                id: s._id || s.id || `staff_${idx}`,
                name: s.name || "Faculty Member",
                role: s.designation || s.role || "Professor",
                badge: idx === 0 ? "ASSIGNED TUTOR" : "FACULTY",
                dept: s.department || s.dept || "General",
                subject: s.subject || s.specialization || "Engineering",
                cabin: s.cabin || s.room || "Academic Block",
                status: idx % 2 === 0 ? "online" : "in_lecture",
                statusText: idx % 2 === 0 ? "online" : "In Lecture",
                initials: (s.name || "F").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase(),
                avatarColor: idx % 3 === 0 ? "#059669" : idx % 3 === 1 ? "#0D9488" : "#D97706",
                phone: s.phone || "+91 98765 43210",
                email: s.email || "faculty@edunex.edu",
                e2eeKey: `0x${Math.random().toString(16).substring(2, 8).toUpperCase()}...B2`,
              }));
              setContacts(mapped);
              return;
            }
          } catch {}
          setContacts(DEFAULT_FACULTY_ROSTER);
        }
      } else if (ch === "staff_staff") {
        setContacts(DEFAULT_FACULTY_ROSTER);
      } else if (ch === "staff_parent" || ch === "admin_parent") {
        setContacts(DEFAULT_PARENT_ROSTER);
      } else if (ch === "admin_staff" || ch === "admin_student") {
        if (currentUser?.role === "admin") {
          setContacts(ch === "admin_staff" ? DEFAULT_FACULTY_ROSTER : DEFAULT_STUDENT_ROSTER);
        } else {
          setContacts(DEFAULT_ADMIN_ROSTER);
        }
      } else {
        setContacts(DEFAULT_FACULTY_ROSTER);
      }
    }
    if (visible && selectedChannelTab) {
      loadContactsForChannel();
    }
  }, [visible, selectedChannelTab, currentUser]);

  // Modal Slide Animation
  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: visible ? 0 : 100,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [visible, slideAnim]);

  // Auto-scroll on Keyboard
  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", () => {
      flatListRef.current?.scrollToEnd({ animated: true });
    });
    return () => showSub.remove();
  }, []);

  // Listen to incoming live messages & auto-scroll
  useEffect(() => {
    const unsub = subscribeToChatMessages(({ threadKey, updatedList }) => {
      setThreads((prev) => ({
        ...prev,
        [threadKey]: updatedList,
      }));
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    });
    return () => unsub();
  }, []);

  // Fetch messages from Storage / API for selected contact in channel
  const syncStaffMessages = useCallback(async (contactId) => {
    try {
      const channel = selectedChannelTab?.channelType || "student_staff";
      const storageKey = `chat_thread_${channel}_${contactId}`;
      let raw = await AsyncStorage.getItem(storageKey);
      if (!raw) {
        raw = await AsyncStorage.getItem(`chat_thread_${contactId}`);
      }
      if (raw) {
        setThreads((prev) => ({ ...prev, [contactId]: JSON.parse(raw) }));
      } else if (contactId === "staff_1") {
        // Preload default greeting for assigned tutor
        const starterMsgs = [
          createMessageObject({
            text: "Welcome to the AI & Data Science tutoring channel. Reach out for lab doubts, research guidance, and leave permissions.",
            senderRole: "staff",
            senderId: "staff_1",
            senderName: "Dr. K. Vigneshwaran",
            recipientId: currentUser?.student?.rollNo || "user_current",
            recipientRole: "student",
            channelType: "student_staff",
          }),
        ];
        setThreads((prev) => ({ ...prev, [contactId]: starterMsgs }));
        AsyncStorage.setItem(storageKey, JSON.stringify(starterMsgs)).catch(() => {});
      }

      const res = await api.get("/messages", { contactId, channelType: channel, limit: 40, sort: "createdAt" }).catch(() => null);
      if (Array.isArray(res?.data) && res.data.length > 0) {
        setThreads((prev) => ({
          ...prev,
          [contactId]: res.data,
        }));
        AsyncStorage.setItem(storageKey, JSON.stringify(res.data)).catch(() => {});
      }
    } catch (e) {
      console.log("Chat fetch err:", e?.message || e);
    }
  }, [selectedChannelTab, currentUser]);

  // Open Individual Chat
  const handleSelectStaff = useCallback((contact) => {
    setSelectedStaff(contact);
    setCurrentView("chat");
    setEditingMessage(null);
    setReplyingTo(null);
    setPendingAttachment(null);
    syncStaffMessages(contact.id);

    const myId = currentUser?.student?.rollNo || currentUser?.staffId || currentUser?.id || "user_current";
    const channel = selectedChannelTab?.channelType || "student_staff";
    markThreadAsRead({ threadKey: contact.id, channelType: channel, currentUserId: myId });
  }, [syncStaffMessages, currentUser, selectedChannelTab]);

  // Auto-sync active conversation every 3.5 seconds
  useEffect(() => {
    if (visible && currentView === "chat" && selectedStaff?.id) {
      const interval = setInterval(() => {
        syncStaffMessages(selectedStaff.id);
      }, 3500);
      return () => clearInterval(interval);
    }
  }, [visible, currentView, selectedStaff, syncStaffMessages]);

  // Listen to navigation notification clicks (e.g. clicking a chat push alert)
  useEffect(() => {
    const unsub = onNavigateToNotification(({ target, notifData }) => {
      if (target === "chat") {
        const contactId = notifData?.threadKey || notifData?.contactId || notifData?.metadata?.threadKey;
        if (contactId && contacts && contacts.length > 0) {
          const found = contacts.find((c) => c.id === contactId);
          if (found) {
            handleSelectStaff(found);
          }
        }
      }
    });
    return () => unsub();
  }, [contacts, handleSelectStaff]);

  // Back to Directory
  const handleBackToDirectory = () => {
    setCurrentView("directory");
    setSelectedStaff(null);
    setShowStaffInfo(false);
    setShowPrivacyModal(false);
    setEditingMessage(null);
    setReplyingTo(null);
    setPendingAttachment(null);
  };

  // ---------------- MEDIA ATTACHMENTS ----------------
  const handlePickImage = async (useCamera = false) => {
    setShowAttachmentMenu(false);
    try {
      let result;
      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== "granted") {
          showToast("Camera permission required", "warning");
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.8,
          allowsEditing: true,
        });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
          showToast("Photo library permission required", "warning");
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.All,
          quality: 0.8,
          allowsEditing: false,
        });
      }

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const isVideo = asset.type === "video";
        setPendingAttachment({
          type: isVideo ? "video" : "image",
          uri: asset.uri,
          name: asset.fileName || (isVideo ? "Video_Attachment.mp4" : "Photo_Attachment.jpg"),
          size: asset.fileSize ? `${Math.round(asset.fileSize / 1024)} KB` : "1.2 MB",
          mimeType: asset.mimeType || (isVideo ? "video/mp4" : "image/jpeg"),
          duration: asset.duration,
        });
        showToast(isVideo ? "🎥 Video attached" : "📷 Photo attached", "info");
      }
    } catch (err) {
      console.log("Pick image error:", err);
      showToast("Could not attach media", "error");
    }
  };

  const handlePickDocument = async () => {
    setShowAttachmentMenu(false);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "image/*", "text/*"],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const doc = result.assets[0];
        setPendingAttachment({
          type: "document",
          uri: doc.uri,
          name: doc.name || "Academic_Document.pdf",
          size: doc.size ? `${Math.round(doc.size / 1024)} KB` : "450 KB",
          mimeType: doc.mimeType || "application/pdf",
        });
        showToast("📄 Document attached", "info");
      }
    } catch (err) {
      console.log("Pick document error:", err);
      showToast("Could not attach document", "error");
    }
  };

  // Resolve clear human sender identity for DB & storage
  const resolveSenderDetails = useCallback(() => {
    const role = currentUser?.role || "student";
    let name = "";
    let id = "";

    if (role === "student") {
      const studentName = currentUser?.student?.name || currentUser?.name || currentUser?.profile?.name || currentUser?.username;
      const rollNo = currentUser?.student?.rollNo || currentUser?.rollNo || currentUser?.username;
      name = studentName ? `${studentName}${rollNo ? ` (${rollNo})` : ""}` : (rollNo ? `Student (${rollNo})` : "Student");
      id = rollNo || currentUser?.student?._id || currentUser?.id || "stud_current";
    } else if (role === "staff") {
      name = currentUser?.staff?.name || currentUser?.name || currentUser?.profile?.name || "Faculty Member";
      id = currentUser?.staff?.id || currentUser?.staff?._id || currentUser?.staffId || currentUser?.id || "staff_current";
    } else if (role === "parent") {
      name = currentUser?.parent?.name || currentUser?.name || currentUser?.profile?.name || "Parent";
      id = currentUser?.parent?.id || currentUser?.parent?._id || currentUser?.id || "parent_current";
    } else if (role === "admin") {
      name = currentUser?.admin?.name || currentUser?.name || currentUser?.profile?.name || "Admin Office";
      id = currentUser?.admin?.id || currentUser?.admin?._id || currentUser?.id || "admin_current";
    } else {
      name = currentUser?.name || currentUser?.profile?.name || currentUser?.username || "User";
      id = currentUser?.id || currentUser?.username || "user_current";
    }

    return { senderName: name, senderId: id, senderRole: role };
  }, [currentUser]);

  // ---------------- SEND OR SAVE MESSAGE ----------------
  const handleSendOrSave = async () => {
    const textTrimmed = newMsg.trim();
    if (!textTrimmed && !pendingAttachment) return;
    if (!selectedStaff) return;

    const channelType = selectedChannelTab?.channelType || "student_staff";

    // A. If in Edit Mode
    if (editingMessage) {
      try {
        const updatedList = await editDirectMessage({
          threadKey: selectedStaff.id,
          channelType,
          messageId: editingMessage.id,
          newText: textTrimmed,
        });
        if (updatedList) {
          setThreads((prev) => ({ ...prev, [selectedStaff.id]: updatedList }));
        }
        setEditingMessage(null);
        setNewMsg("");
        showToast("✓ Message edited", "success");
      } catch (err) {
        showToast(err.message || "Failed to edit message", "warning");
      }
      return;
    }

    // B. Send New Message
    const { senderName, senderId, senderRole } = resolveSenderDetails();

    // Determine recipient role based on channel
    let recipientRole = "staff";
    if (channelType === "student_staff") {
      recipientRole = senderRole === "student" ? "staff" : "student";
    } else if (channelType === "staff_staff") {
      recipientRole = "staff";
    } else if (channelType === "staff_parent") {
      recipientRole = senderRole === "staff" ? "parent" : "staff";
    } else if (channelType === "admin_staff") {
      recipientRole = senderRole === "admin" ? "staff" : "admin";
    } else if (channelType === "admin_student") {
      recipientRole = senderRole === "admin" ? "student" : "admin";
    } else if (channelType === "admin_parent") {
      recipientRole = senderRole === "admin" ? "parent" : "admin";
    }

    const msgObj = createMessageObject({
      text: textTrimmed,
      senderRole,
      senderId,
      senderName,
      recipientId: selectedStaff.id,
      recipientName: selectedStaff.name,
      recipientRole,
      channelType,
      attachment: pendingAttachment,
      replyTo: replyingTo
        ? { id: replyingTo.id, text: replyingTo.text, senderName: replyingTo.senderName }
        : null,
    });

    const updated = await sendDirectMessage({
      threadKey: selectedStaff.id,
      channelType,
      message: msgObj,
      selectedContact: selectedStaff,
    });

    if (updated) {
      setThreads((prev) => ({ ...prev, [selectedStaff.id]: updated }));
    }

    setNewMsg("");
    setPendingAttachment(null);
    setReplyingTo(null);

    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  // ---------------- MESSAGE ACTIONS & REACTIONS ----------------
  const handleLongPressMessage = (msg) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    setActionMessage(msg);
    setShowActionSheet(true);
  };

  const handleToggleReaction = async (emoji) => {
    if (!actionMessage || !selectedStaff) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setShowActionSheet(false);

    const channelType = selectedChannelTab?.channelType || "student_staff";
    const threadList = threads[selectedStaff.id] || [];
    const updated = threadList.map((m) => {
      if (m.id === actionMessage.id) {
        const currentReaction = m.reaction === emoji ? null : emoji;
        return { ...m, reaction: currentReaction };
      }
      return m;
    });

    setThreads((prev) => ({ ...prev, [selectedStaff.id]: updated }));
    try {
      await AsyncStorage.setItem(`chat_thread_${channelType}_${selectedStaff.id}`, JSON.stringify(updated));
    } catch {}
  };

  const handleCopyMessage = () => {
    if (!actionMessage) return;
    setShowActionSheet(false);
    showToast("📋 Message copied", "success");
  };

  const handleStartEdit = () => {
    if (!actionMessage) return;
    setShowActionSheet(false);
    if (!isMessageEditable(actionMessage)) {
      showToast("⚠️ Edit window expired (15 mins limit)", "warning");
      return;
    }
    setEditingMessage(actionMessage);
    setNewMsg(actionMessage.text || "");
    setReplyingTo(null);
  };

  const handleCancelEdit = () => {
    setEditingMessage(null);
    setNewMsg("");
  };

  const handleStartReply = () => {
    if (!actionMessage) return;
    setShowActionSheet(false);
    setReplyingTo(actionMessage);
    setEditingMessage(null);
  };

  const handleDeleteMessage = async (forEveryone = false) => {
    if (!actionMessage || !selectedStaff) return;
    setShowActionSheet(false);

    const channelType = selectedChannelTab?.channelType || "student_staff";
    const updated = await deleteDirectMessage({
      threadKey: selectedStaff.id,
      channelType,
      messageId: actionMessage.id,
      deleteForEveryone: forEveryone,
    });

    if (updated) {
      setThreads((prev) => ({ ...prev, [selectedStaff.id]: updated }));
    }
    showToast(forEveryone ? "🗑️ Deleted for everyone" : "🗑️ Deleted for me", "info");
  };

  // Listen to typing status events (from other human)
  useEffect(() => {
    const unsub = subscribeToTypingStatus((data) => {
      const myId = currentUser?.student?.rollNo || currentUser?.staffId || currentUser?.id || "user_current";
      if (
        selectedStaff &&
        data.senderId !== myId &&
        (data.threadKey === selectedStaff.id || data.senderId === selectedStaff.id)
      ) {
        setTypingState(data);
      }
    });
    return () => unsub();
  }, [selectedStaff, currentUser]);

  // Handle typing input with live broadcast
  const handleTypingChange = (text) => {
    setNewMsg(text);
    if (selectedStaff) {
      const myId = currentUser?.student?.rollNo || currentUser?.staffId || currentUser?.id || "user_current";
      const myName = currentUser?.student?.name || currentUser?.staff?.name || currentUser?.name || "User";
      notifyTypingStatus({
        threadKey: selectedStaff.id,
        senderId: myId,
        isTyping: text.trim().length > 0,
        name: myName,
      });
    }
  };

  // Pulsing animation for typing indicator
  useEffect(() => {
    if (typingState?.isTyping) {
      const anim = Animated.loop(
        Animated.stagger(200, [
          Animated.sequence([
            Animated.timing(dot1Opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
            Animated.timing(dot1Opacity, { toValue: 0.3, duration: 300, useNativeDriver: true }),
          ]),
          Animated.sequence([
            Animated.timing(dot2Opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
            Animated.timing(dot2Opacity, { toValue: 0.3, duration: 300, useNativeDriver: true }),
          ]),
          Animated.sequence([
            Animated.timing(dot3Opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
            Animated.timing(dot3Opacity, { toValue: 0.3, duration: 300, useNativeDriver: true }),
          ]),
        ])
      );
      anim.start();
      return () => anim.stop();
    }
  }, [typingState?.isTyping, dot1Opacity, dot2Opacity, dot3Opacity]);

  // Voice Recording Simulation
  const handleStartVoiceRecording = () => {
    setIsRecordingVoice(true);
    setRecordingTimer(0);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } catch {}
    recordingIntervalRef.current = setInterval(() => {
      setRecordingTimer((prev) => prev + 1);
    }, 1000);
  };

  const handleCancelVoiceRecording = () => {
    if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    setIsRecordingVoice(false);
    setRecordingTimer(0);
    showToast("🗑️ Voice recording discarded", "info");
  };

  const handleSendVoiceNote = async () => {
    if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    const dur = Math.max(1, recordingTimer);
    setIsRecordingVoice(false);
    setRecordingTimer(0);

    if (!selectedStaff) return;
    const channelType = selectedChannelTab?.channelType || "student_staff";
    const { senderName, senderId, senderRole } = resolveSenderDetails();

    const msgObj = createMessageObject({
      text: `🎤 Voice message (0:0${dur > 9 ? dur : "0" + dur})`,
      senderRole,
      senderId,
      senderName,
      recipientId: selectedStaff.id,
      recipientName: selectedStaff.name,
      recipientRole: selectedStaff.role || "staff",
      channelType,
      attachment: {
        type: "voice",
        name: `Voice_${Date.now()}.m4a`,
        size: `${Math.round(dur * 16)} KB`,
        duration: dur,
      },
    });

    await sendDirectMessage({
      threadKey: selectedStaff.id,
      channelType,
      message: msgObj,
      selectedContact: selectedStaff,
    });
  };

  const handleToggleVoicePlay = (msgId) => {
    if (activeVoiceNotePlaying === msgId) {
      setActiveVoiceNotePlaying(null);
    } else {
      setActiveVoiceNotePlaying(msgId);
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
      setTimeout(() => {
        setActiveVoiceNotePlaying(null);
      }, 3500);
    }
  };

  // Calling Simulation
  const handleStartCall = (type = "audio") => {
    setCallType(type);
    setIsCalling(true);
    setCallTimer(0);
    setIsMuted(false);
    setIsSpeaker(false);
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}

    setTimeout(() => {
      callIntervalRef.current = setInterval(() => {
        setCallTimer((prev) => prev + 1);
      }, 1000);
    }, 2000);
  };

  const handleEndCall = () => {
    if (callIntervalRef.current) clearInterval(callIntervalRef.current);
    setIsCalling(false);
    setCallTimer(0);
    showToast("📞 Call ended", "info");
  };

  const formatCallTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m < 10 ? "0" : ""}${m}:${s < 10 ? "0" : ""}${s}`;
  };

  // Double Tap to React ❤️
  const handleDoubleTapMessage = async (msg) => {
    if (!msg || !selectedStaff) return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    const channelType = selectedChannelTab?.channelType || "student_staff";
    const threadList = threads[selectedStaff.id] || [];
    const updated = threadList.map((m) => {
      if (m.id === msg.id) {
        return { ...m, reaction: m.reaction === "❤️" ? null : "❤️" };
      }
      return m;
    });
    setThreads((prev) => ({ ...prev, [selectedStaff.id]: updated }));
    AsyncStorage.setItem(`chat_thread_${channelType}_${selectedStaff.id}`, JSON.stringify(updated)).catch(() => {});
  };

  // ---------------- DIRECTORY FILTER ----------------
  const departments = useMemo(() => {
    const set = new Set(["All"]);
    contacts.forEach((c) => c.dept && set.add(c.dept));
    return Array.from(set);
  }, [contacts]);

  const filteredStaffList = useMemo(() => {
    return contacts.filter((contact) => {
      const matchesSearch =
        contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (contact.subject && contact.subject.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (contact.dept && contact.dept.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (contact.badge && contact.badge.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesDept = deptFilter === "All" || contact.dept === deptFilter;
      return matchesSearch && matchesDept;
    });
  }, [contacts, searchQuery, deptFilter]);

  const currentMessages = useMemo(() => {
    if (!selectedStaff) return [];
    const all = threads[selectedStaff.id] || [];
    if (!inChatSearchQuery.trim()) return all;
    return all.filter((m) =>
      (m.text || "").toLowerCase().includes(inChatSearchQuery.toLowerCase())
    );
  }, [threads, selectedStaff, inChatSearchQuery]);

  const handleCallStaff = () => {
    handleStartCall("audio");
  };

  const handleVideoCallStaff = () => {
    handleStartCall("video");
  };

  const handleEmailStaff = () => {
    if (!selectedStaff?.email) return;
    Linking.openURL(`mailto:${selectedStaff.email}?subject=Academic%20Inquiry`).catch(() => {
      showToast(`Cannot open mail client for ${selectedStaff.email}`, "error");
    });
  };

  const styles = getStyles(colors, isDarkMode);

  // ---------------- Render Message Bubble ----------------
  const renderMessageBubble = ({ item }) => {
    if (!item) return null;
    const isMe = item?.sender === (currentUser?.role || "student");
    const isDeleted = Boolean(item?.deletedForEveryone);
    const urls = extractUrls(item?.text || "");

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => {
          const now = Date.now();
          if (now - lastTapRef.current < 300) {
            handleDoubleTapMessage(item);
          }
          lastTapRef.current = now;
        }}
        onLongPress={() => handleLongPressMessage(item)}
        style={[
          styles.msgRow,
          isMe ? styles.msgRowRight : styles.msgRowLeft,
        ]}
      >
        {!isMe && (
          <View style={[styles.avatarBeside, { backgroundColor: selectedStaff?.avatarColor || "#059669" }]}>
            <Text style={styles.avatarBesideText}>{selectedStaff?.initials || "F"}</Text>
          </View>
        )}

        <View
          style={[
            styles.bubbleContainer,
            isMe ? styles.bubbleMe : styles.bubbleOther,
            {
              backgroundColor: isMe
                ? isDarkMode
                  ? "#005C4B"
                  : "#E7FFDB"
                : isDarkMode
                ? "#202C33"
                : "#FFFFFF",
              borderColor: isMe
                ? isDarkMode
                  ? "#005C4B"
                  : "#D3F4C5"
                : isDarkMode
                ? "#2A3942"
                : "#E2E8F0",
            },
          ]}
        >
          {/* Quoted Reply Preview */}
          {item.replyTo && (
            <View
              style={[
                styles.replyQuoteBox,
                {
                  backgroundColor: isMe
                    ? isDarkMode
                      ? "#025143"
                      : "#D8F3C7"
                    : isDarkMode
                    ? "#182229"
                    : "#F1F5F9",
                  borderLeftColor: isMe ? "#10B981" : "#4F46E5",
                },
              ]}
            >
              <Text
                style={[
                  styles.replyQuoteSender,
                  { color: isMe ? "#059669" : "#4F46E5" },
                ]}
              >
                {item.replyTo.senderName || "User"}
              </Text>
              <Text
                style={[
                  styles.replyQuoteText,
                  { color: isDarkMode ? "#E9EDEF" : "#334155" },
                ]}
                numberOfLines={1}
              >
                {item.replyTo.text || "Attachment"}
              </Text>
            </View>
          )}

          {/* Deleted Message Placeholder */}
          {isDeleted ? (
            <View style={styles.deletedRow}>
              <Icon name="cancel" size={14} color={isDarkMode ? "#8696A0" : "#64748B"} />
              <Text
                style={[
                  styles.deletedText,
                  { color: isDarkMode ? "#8696A0" : "#64748B" },
                ]}
              >
                This message was deleted
              </Text>
            </View>
          ) : (
            <>
              {/* Media & Voice Attachments */}
              {item.attachment && (
                <View style={styles.attachmentWrapper}>
                  {item.attachment.type === "image" && (
                    <TouchableOpacity
                      onPress={() => setLightboxImage(item.attachment.uri)}
                      activeOpacity={0.9}
                      style={styles.imagePreviewWrap}
                    >
                      <Image source={{ uri: item.attachment.uri }} style={styles.bubbleImage} resizeMode="cover" />
                      <View style={styles.imageOverlayBadge}>
                        <Icon name="image" size={12} color="#FFF" />
                        <Text style={styles.imageOverlayText}>Photo</Text>
                      </View>
                    </TouchableOpacity>
                  )}

                  {item.attachment.type === "video" && (
                    <View
                      style={[
                        styles.docPreviewCard,
                        {
                          backgroundColor: isMe
                            ? isDarkMode
                              ? "#025143"
                              : "#D8F3C7"
                            : isDarkMode
                            ? "#182229"
                            : "#F8FAFC",
                        },
                      ]}
                    >
                      <View style={[styles.docIconBox, { backgroundColor: "#EF4444" }]}>
                        <Icon name="play-circle" size={22} color="#FFF" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.docName,
                            { color: isDarkMode ? "#E9EDEF" : "#111B21" },
                          ]}
                          numberOfLines={1}
                        >
                          {item.attachment.name}
                        </Text>
                        <Text style={styles.docMeta}>
                          Video · {item.attachment.size}
                        </Text>
                      </View>
                    </View>
                  )}

                  {item.attachment.type === "document" && (
                    <View
                      style={[
                        styles.docPreviewCard,
                        {
                          backgroundColor: isMe
                            ? isDarkMode
                              ? "#025143"
                              : "#D8F3C7"
                            : isDarkMode
                            ? "#182229"
                            : "#F8FAFC",
                        },
                      ]}
                    >
                      <View style={[styles.docIconBox, { backgroundColor: "#7F66FF" }]}>
                        <Icon name="file-pdf-box" size={22} color="#FFF" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.docName,
                            { color: isDarkMode ? "#E9EDEF" : "#111B21" },
                          ]}
                          numberOfLines={1}
                        >
                          {item.attachment.name}
                        </Text>
                        <Text style={styles.docMeta}>
                          Document · {item.attachment.size}
                        </Text>
                      </View>
                    </View>
                  )}

                  {item.attachment.type === "voice" && (
                    <View style={styles.voiceNoteWrap}>
                      <TouchableOpacity
                        style={[styles.voicePlayBtn, { backgroundColor: isMe ? "#00A884" : "#0284C7" }]}
                        onPress={() => handleToggleVoicePlay(item.id)}
                      >
                        <Icon
                          name={activeVoiceNotePlaying === item.id ? "pause" : "play"}
                          size={20}
                          color="#FFFFFF"
                        />
                      </TouchableOpacity>
                      <View style={styles.voiceWaveContainer}>
                        {[4, 10, 16, 8, 20, 14, 22, 12, 18, 8, 14, 6].map((h, wi) => (
                          <View
                            key={wi}
                            style={[
                              styles.voiceWaveBar,
                              {
                                height: activeVoiceNotePlaying === item.id ? h * 1.2 : h,
                                backgroundColor: isMe ? "#00A884" : "#0284C7",
                              },
                            ]}
                          />
                        ))}
                      </View>
                      <Text style={[styles.voiceDurationText, { color: isDarkMode ? "#8696A0" : "#64748B" }]}>
                        0:0{item.attachment.duration || 4}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* Text Message Content */}
              {Boolean(item.text) && (
                <Text
                  style={[
                    styles.messageText,
                    { color: isDarkMode ? "#E9EDEF" : "#111B21" },
                  ]}
                >
                  {item.text}
                </Text>
              )}

              {/* URLs Cards */}
              {urls.length > 0 && (
                <View style={styles.urlCardList}>
                  {urls.map((u, i) => (
                    <TouchableOpacity
                      key={i}
                      style={[
                        styles.linkCard,
                        {
                          backgroundColor: isMe
                            ? isDarkMode
                              ? "#025143"
                              : "#D8F3C7"
                            : isDarkMode
                            ? "#182229"
                            : "#F1F5F9",
                        },
                      ]}
                      onPress={() => Linking.openURL(u).catch(() => showToast("Could not open link", "error"))}
                    >
                      <Icon name="link-variant" size={15} color="#059669" />
                      <Text style={styles.linkCardText} numberOfLines={1}>
                        {u}
                      </Text>
                      <Icon name="open-in-new" size={13} color="#059669" />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </>
          )}

          {/* Bubble Meta Footer (Time, Edited tag, Double Check) */}
          <View style={styles.bubbleMetaRow}>
            {item?.isEdited && !isDeleted && (
              <Text style={[styles.editedTag, { color: isDarkMode ? "#8696A0" : "#64748B" }]}>
                edited
              </Text>
            )}
            <Text style={[styles.timestampText, { color: isDarkMode ? "#8696A0" : "#64748B" }]}>
              {item?.time || ""}
            </Text>
            {isMe && !isDeleted && (
              <Icon
                name={item?.status === "sent" ? "check" : "check-all"}
                size={14}
                color={item?.status === "read" ? "#53BDEB" : isDarkMode ? "#8696A0" : "#64748B"}
                style={{ marginLeft: 3 }}
              />
            )}
          </View>

          {/* Reaction Emoji Badge */}
          {item.reaction && (
            <View style={styles.reactionBadge}>
              <Text style={styles.reactionBadgeText}>{item.reaction}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <Animated.View style={[styles.container, { transform: [{ translateY: slideAnim }] }]}>
        {/* ========================================================================= */}
        {/* VIEW 1: WHATSAPP-STYLE MULTI-ROLE DIRECTORY & CHATS LIST                 */}
        {/* ========================================================================= */}
        {currentView === "directory" && (
          <View style={{ flex: 1, backgroundColor: isDarkMode ? "#111B21" : "#FFFFFF" }}>
            {/* Top Bar */}
            <View style={[styles.waHeader, { backgroundColor: isDarkMode ? "#1F2C34" : "#008069" }]}>
              <View style={styles.waHeaderRow}>
                <TouchableOpacity onPress={onClose} style={styles.iconBtn}>
                  <Icon name="arrow-left" size={24} color="#FFFFFF" />
                </TouchableOpacity>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.waHeaderTitle}>EduNex Direct Channels</Text>
                  <Text style={styles.waHeaderSub}>
                    {currentUser?.role ? `${currentUser.role.toUpperCase()} MESSAGING` : "END-TO-END ENCRYPTED"}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setShowPrivacyModal(true)}
                  style={styles.iconBtn}
                >
                  <Icon name="shield-check" size={22} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Dynamic Role Channels Selector Bar */}
            {channelTabs.length > 1 && (
              <View style={[styles.channelTabsContainer, { backgroundColor: isDarkMode ? "#182229" : "#F0F2F5" }]}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8, paddingHorizontal: 12, paddingVertical: 8 }}
                >
                  {channelTabs.map((tab) => {
                    const isSelected = selectedChannelTab?.id === tab.id;
                    return (
                      <TouchableOpacity
                        key={tab.id}
                        style={[
                          styles.channelTabChip,
                          isSelected
                            ? { backgroundColor: isDarkMode ? "#00A884" : "#008069", elevation: 2 }
                            : { backgroundColor: isDarkMode ? "#202C33" : "#FFFFFF" },
                        ]}
                        onPress={() => {
                          setSelectedChannelTab(tab);
                          setSearchQuery("");
                          setDeptFilter("All");
                        }}
                        activeOpacity={0.8}
                      >
                        <Icon
                          name={tab.icon || "chat"}
                          size={16}
                          color={isSelected ? "#FFFFFF" : isDarkMode ? "#8696A0" : "#54656F"}
                        />
                        <Text
                          style={[
                            styles.channelTabChipText,
                            { color: isSelected ? "#FFFFFF" : isDarkMode ? "#E9EDEF" : "#111B21" },
                          ]}
                        >
                          {tab.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* WhatsApp Search Bar */}
            <View style={[styles.waSearchContainer, { backgroundColor: isDarkMode ? "#111B21" : "#FFFFFF" }]}>
              <View style={[styles.waSearchBox, { backgroundColor: isDarkMode ? "#1F2C34" : "#F0F2F5" }]}>
                <Icon name="magnify" size={20} color={isDarkMode ? "#8696A0" : "#54656F"} />
                <TextInput
                  style={[styles.waSearchInput, { color: isDarkMode ? "#E9EDEF" : "#111B21" }]}
                  placeholder={`Search ${selectedChannelTab?.label || "contacts"}...`}
                  placeholderTextColor={isDarkMode ? "#8696A0" : "#54656F"}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {Boolean(searchQuery) && (
                  <TouchableOpacity onPress={() => setSearchQuery("")}>
                    <Icon name="close-circle" size={18} color={isDarkMode ? "#8696A0" : "#54656F"} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* WhatsApp Filters (All, AI & DS, CSE, etc.) */}
            <View style={{ paddingVertical: 6 }}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
              >
                {departments.map((d) => {
                  const isSel = deptFilter === d;
                  return (
                    <TouchableOpacity
                      key={d}
                      style={[
                        styles.waFilterChip,
                        isSel
                          ? { backgroundColor: isDarkMode ? "#00A884" : "#008069" }
                          : { backgroundColor: isDarkMode ? "#1F2C34" : "#F0F2F5" },
                      ]}
                      onPress={() => setDeptFilter(d)}
                    >
                      <Text
                        style={[
                          styles.waFilterChipText,
                          { color: isSel ? "#FFFFFF" : isDarkMode ? "#8696A0" : "#54656F" },
                        ]}
                      >
                        {d}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* WhatsApp Contact Chat List */}
            <FlatList
              data={filteredStaffList}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingBottom: 60 }}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                if (!item) return null;
                const threadMsgs = (item?.id && Array.isArray(threads[item.id])) ? threads[item.id].filter(Boolean) : [];
                const lastMsg = threadMsgs.length > 0 ? threadMsgs[threadMsgs.length - 1] : null;
                const isOnline = item?.status === "online";

                return (
                  <TouchableOpacity
                    style={[styles.waChatItem, { borderBottomColor: isDarkMode ? "#1F2C34" : "#E2E8F0" }]}
                    activeOpacity={0.7}
                    onPress={() => handleSelectStaff(item)}
                  >
                    {/* Big Avatar with Status Badge */}
                    <View style={styles.waAvatarContainer}>
                      <View style={[styles.waAvatar, { backgroundColor: item.avatarColor }]}>
                        <Text style={styles.waAvatarText}>{item.initials}</Text>
                      </View>
                      {isOnline && <View style={styles.waOnlineDot} />}
                    </View>

                    {/* Chat Item Details */}
                    <View style={styles.waChatDetails}>
                      <View style={styles.waChatTopRow}>
                        <View style={{ flexDirection: "row", alignItems: "center", flex: 1, marginRight: 6 }}>
                          <Text
                            style={[styles.waContactName, { color: isDarkMode ? "#E9EDEF" : "#111B21" }]}
                            numberOfLines={1}
                          >
                            {item.name}
                          </Text>
                          {item.badge && (
                            <View style={[styles.roleBadgePill, { backgroundColor: isDarkMode ? "#064E3B" : "#ECFDF5" }]}>
                              <Text style={[styles.roleBadgePillText, { color: isDarkMode ? "#34D399" : "#059669" }]}>
                                {item.badge}
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text style={[styles.waLastTime, { color: isDarkMode ? "#8696A0" : "#667781" }]}>
                          {lastMsg ? lastMsg.time : isOnline ? "Online" : "Direct"}
                        </Text>
                      </View>

                      <View style={styles.waChatBottomRow}>
                        <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                          {Boolean(lastMsg?.sender) && Boolean(currentUser?.role) && lastMsg.sender === currentUser.role && (
                            <Icon
                              name="check-all"
                              size={14}
                              color={lastMsg?.status === "read" ? "#53BDEB" : "#8696A0"}
                              style={{ marginRight: 4 }}
                            />
                          )}
                          <Text
                            style={[
                              styles.waLastSnippet,
                              { color: isDarkMode ? "#8696A0" : "#667781" },
                            ]}
                            numberOfLines={1}
                          >
                            {lastMsg ? lastMsg.text || `[${lastMsg.attachment?.type || "media"}]` : `${item.role || "Contact"} · ${item.subject || item.dept || ""}`}
                          </Text>
                        </View>

                        {/* Department Tag */}
                        {item.dept && (
                          <View style={[styles.waDeptBadge, { backgroundColor: isDarkMode ? "#1F2C34" : "#E2E8F0" }]}>
                            <Text style={[styles.waDeptBadgeText, { color: isDarkMode ? "#8696A0" : "#475569" }]}>
                              {item.dept}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        )}

        {/* ========================================================================= */}
        {/* VIEW 2: WHATSAPP 1-ON-1 CHAT ROOM                                        */}
        {/* ========================================================================= */}
        {currentView === "chat" && selectedStaff && (
          <View style={{ flex: 1, backgroundColor: isDarkMode ? "#0B141A" : "#ECE5DD" }}>
            {/* WhatsApp Chat App Bar */}
            <View style={[styles.waHeader, { backgroundColor: isDarkMode ? "#1F2C34" : "#008069" }]}>
              <View style={styles.waHeaderRow}>
                <TouchableOpacity onPress={handleBackToDirectory} style={styles.iconBtn}>
                  <Icon name="arrow-left" size={24} color="#FFFFFF" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.waHeaderProfile}
                  onPress={() => setShowStaffInfo(!showStaffInfo)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.waSmallAvatar, { backgroundColor: selectedStaff.avatarColor }]}>
                    <Text style={styles.waSmallAvatarText}>{selectedStaff.initials}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={styles.waHeaderName} numberOfLines={1}>
                      {selectedStaff.name}
                    </Text>
                    <Text
                      style={[
                        styles.waHeaderStatus,
                        typingState?.isTyping && { color: "#34D399", fontWeight: "700" },
                      ]}
                      numberOfLines={1}
                    >
                      {typingState?.isTyping
                        ? "typing..."
                        : selectedStaff?.status === "online"
                        ? "online"
                        : selectedStaff?.statusText || "active"}
                    </Text>
                  </View>
                </TouchableOpacity>

                <View style={styles.waHeaderActions}>
                  <TouchableOpacity onPress={() => setInChatSearch(!inChatSearch)} style={styles.waActionIcon}>
                    <Icon name="magnify" size={21} color="#FFFFFF" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleVideoCallStaff} style={styles.waActionIcon}>
                    <Icon name="video-outline" size={22} color="#FFFFFF" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleCallStaff} style={styles.waActionIcon}>
                    <Icon name="phone" size={20} color="#FFFFFF" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setShowPrivacyModal(true)} style={styles.waActionIcon}>
                    <Icon name="shield-lock-outline" size={20} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* In-Chat Message Search Bar */}
            {inChatSearch && (
              <View style={[styles.inChatSearchContainer, { backgroundColor: isDarkMode ? "#1F2C34" : "#F0F2F5" }]}>
                <Icon name="magnify" size={18} color={isDarkMode ? "#8696A0" : "#54656F"} />
                <TextInput
                  style={[styles.inChatSearchInput, { color: isDarkMode ? "#E9EDEF" : "#111B21" }]}
                  placeholder="Search in chat..."
                  placeholderTextColor={isDarkMode ? "#8696A0" : "#54656F"}
                  value={inChatSearchQuery}
                  onChangeText={setInChatSearchQuery}
                  autoFocus
                />
                <TouchableOpacity onPress={() => { setInChatSearch(false); setInChatSearchQuery(""); }}>
                  <Icon name="close-circle" size={18} color={isDarkMode ? "#8696A0" : "#54656F"} />
                </TouchableOpacity>
              </View>
            )}

            {/* Cabin & Subject Card */}
            {showStaffInfo && (
              <View style={[styles.waInfoCard, { backgroundColor: isDarkMode ? "#1F2C34" : "#FFFFFF" }]}>
                <View style={styles.waInfoRow}>
                  <Icon name="map-marker-radius" size={16} color="#00A884" />
                  <Text style={[styles.waInfoText, { color: isDarkMode ? "#E9EDEF" : "#111B21" }]}>
                    {selectedStaff.cabin}
                  </Text>
                </View>
                <View style={styles.waInfoRow}>
                  <Icon name="book-education-outline" size={16} color="#00A884" />
                  <Text style={[styles.waInfoText, { color: isDarkMode ? "#E9EDEF" : "#111B21" }]}>
                    Course: {selectedStaff.subject}
                  </Text>
                </View>
                <TouchableOpacity style={styles.waInfoRow} onPress={handleEmailStaff}>
                  <Icon name="email-outline" size={16} color="#00A884" />
                  <Text style={[styles.waInfoText, { color: isDarkMode ? "#E9EDEF" : "#111B21" }]}>
                    Email: {selectedStaff.email}
                  </Text>
                </TouchableOpacity>
                <View style={styles.waInfoRow}>
                  <Icon name="shield-key-outline" size={16} color="#10B981" />
                  <Text style={[styles.waInfoText, { color: "#10B981", fontWeight: "700" }]}>
                    E2EE Session: {selectedStaff.e2eeKey}
                  </Text>
                </View>
              </View>
            )}

            {/* Message List + Keyboard Avoid */}
            <KeyboardAvoidingView
              style={{ flex: 1 }}
              behavior={Platform.OS === "ios" ? "padding" : undefined}
              keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
            >
              <FlatList
                ref={flatListRef}
                data={currentMessages}
                renderItem={renderMessageBubble}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 14 }}
                showsVerticalScrollIndicator={false}
                ListHeaderComponent={
                  <View style={styles.headerNoticeWrap}>
                    {/* Date Pill */}
                    <View style={[styles.datePill, { backgroundColor: isDarkMode ? "#182229" : "#FFFFFF" }]}>
                      <Text style={[styles.datePillText, { color: isDarkMode ? "#8696A0" : "#54656F" }]}>
                        TODAY
                      </Text>
                    </View>

                    {/* Encryption Notice */}
                    <TouchableOpacity
                      style={[styles.e2eeYellowCard, { backgroundColor: isDarkMode ? "#182229" : "#FEF9C3" }]}
                      onPress={() => setShowPrivacyModal(true)}
                      activeOpacity={0.85}
                    >
                      <Icon name="lock" size={13} color={isDarkMode ? "#FBBF24" : "#854D0E"} />
                      <Text style={[styles.e2eeYellowText, { color: isDarkMode ? "#FDE68A" : "#713F12" }]}>
                        Messages are end-to-end encrypted. No one outside of this chat can read them.
                      </Text>
                    </TouchableOpacity>
                  </View>
                }
                ListFooterComponent={
                  typingState?.isTyping ? (
                    <View style={[styles.msgRow, styles.msgRowLeft, { alignItems: "center", marginTop: 4 }]}>
                      <View style={[styles.avatarBeside, { backgroundColor: selectedStaff?.avatarColor || "#059669" }]}>
                        <Text style={styles.avatarBesideText}>{selectedStaff?.initials || "F"}</Text>
                      </View>
                      <View
                        style={[
                          styles.bubbleContainer,
                          styles.bubbleOther,
                          {
                            backgroundColor: isDarkMode ? "#202C33" : "#FFFFFF",
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 8,
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                          },
                        ]}
                      >
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                          <Animated.View style={[styles.typingDot, { opacity: dot1Opacity }]} />
                          <Animated.View style={[styles.typingDot, { opacity: dot2Opacity }]} />
                          <Animated.View style={[styles.typingDot, { opacity: dot3Opacity }]} />
                        </View>
                        <Text style={{ fontSize: 12, fontStyle: "italic", color: isDarkMode ? "#8696A0" : "#64748B" }}>
                          typing...
                        </Text>
                      </View>
                    </View>
                  ) : null
                }
                onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
              />

              {/* Quick Template Prompt Chips */}
              <View style={[styles.quickChipsBar, { backgroundColor: isDarkMode ? "#111B21" : "#F0F2F5" }]}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {QUICK_PROMPTS.map((prompt, i) => (
                    <TouchableOpacity
                      key={i}
                      style={[styles.quickPromptChip, { backgroundColor: isDarkMode ? "#1F2C34" : "#FFFFFF" }]}
                      onPress={() => setNewMsg(prompt)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.quickPromptText, { color: isDarkMode ? "#E9EDEF" : "#111B21" }]}>
                        {prompt}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Replying Quote Bar */}
              {replyingTo && (
                <View style={[styles.activeReplyBar, { backgroundColor: isDarkMode ? "#1F2C34" : "#FFFFFF" }]}>
                  <View style={styles.replyBarAccent} />
                  <View style={{ flex: 1, paddingLeft: 8 }}>
                    <Text style={styles.replyBarSender}>
                      {replyingTo.senderName || "User"}
                    </Text>
                    <Text style={[styles.replyBarText, { color: isDarkMode ? "#8696A0" : "#54656F" }]} numberOfLines={1}>
                      {replyingTo.text || "Attachment"}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setReplyingTo(null)} style={{ padding: 4 }}>
                    <Icon name="close" size={18} color={isDarkMode ? "#8696A0" : "#54656F"} />
                  </TouchableOpacity>
                </View>
              )}

              {/* Active Edit Bar (15 Mins Window) */}
              {editingMessage && (
                <View style={[styles.activeEditBar, { backgroundColor: isDarkMode ? "#1F2C34" : "#FEF3C7" }]}>
                  <Icon name="pencil" size={16} color="#D97706" />
                  <Text style={[styles.activeEditText, { color: isDarkMode ? "#FDE68A" : "#92400E" }]}>
                    Editing message ({getRemainingEditMinutes(editingMessage)}m edit window left)
                  </Text>
                  <TouchableOpacity onPress={handleCancelEdit} style={{ padding: 4 }}>
                    <Icon name="close" size={18} color="#D97706" />
                  </TouchableOpacity>
                </View>
              )}

              {/* Pending Attachment Preview Bar */}
              {pendingAttachment && (
                <View style={[styles.pendingMediaBar, { backgroundColor: isDarkMode ? "#1F2C34" : "#FFFFFF" }]}>
                  <Icon
                    name={
                      pendingAttachment.type === "image"
                        ? "image"
                        : pendingAttachment.type === "video"
                        ? "video"
                        : "file-document"
                    }
                    size={22}
                    color="#00A884"
                  />
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={[styles.pendingMediaName, { color: isDarkMode ? "#E9EDEF" : "#111B21" }]} numberOfLines={1}>
                      {pendingAttachment.name}
                    </Text>
                    <Text style={styles.pendingMediaMeta}>
                      {pendingAttachment.size}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setPendingAttachment(null)} style={{ padding: 4 }}>
                    <Icon name="close-circle" size={20} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              )}

              {/* WhatsApp Floating Input Capsule + Voice Recording Mode */}
              {isRecordingVoice ? (
                <View style={styles.waInputRow}>
                  <View style={[styles.voiceRecordingCapsule, { backgroundColor: isDarkMode ? "#2A3942" : "#FFFFFF" }]}>
                    <TouchableOpacity onPress={handleCancelVoiceRecording} style={{ padding: 6 }}>
                      <Icon name="trash-can-outline" size={22} color="#EF4444" />
                    </TouchableOpacity>
                    <View style={styles.recordingRedDot} />
                    <Text style={[styles.recordingTimerText, { color: isDarkMode ? "#E9EDEF" : "#111B21" }]}>
                      0:0{recordingTimer > 9 ? recordingTimer : "0" + recordingTimer}
                    </Text>
                    <View style={styles.recordingWaveSample}>
                      {[8, 14, 22, 10, 18, 24, 12, 16, 20, 8].map((h, i) => (
                        <View key={i} style={[styles.recordingWaveBar, { height: h }]} />
                      ))}
                    </View>
                  </View>
                  <TouchableOpacity
                    style={[styles.waSendFab, { backgroundColor: "#10B981" }]}
                    onPress={handleSendVoiceNote}
                  >
                    <Icon name="send" size={20} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.waInputRow}>
                  {/* Left Capsule */}
                  <View style={[styles.waInputCapsule, { backgroundColor: isDarkMode ? "#2A3942" : "#FFFFFF" }]}>
                    <TouchableOpacity
                      style={styles.capsuleIconBtn}
                      onPress={() => setNewMsg((prev) => prev + "😊")}
                    >
                      <Icon name="emoticon-happy-outline" size={22} color={isDarkMode ? "#8696A0" : "#54656F"} />
                    </TouchableOpacity>

                    <TextInput
                      style={[styles.waTextInput, { color: isDarkMode ? "#E9EDEF" : "#111B21" }]}
                      placeholder={editingMessage ? "Edit message..." : "Message"}
                      placeholderTextColor={isDarkMode ? "#8696A0" : "#54656F"}
                      value={newMsg}
                      onChangeText={handleTypingChange}
                      multiline
                      onFocus={() => {
                        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
                      }}
                    />

                    {/* Paperclip Attachment */}
                    <TouchableOpacity
                      style={styles.capsuleIconBtn}
                      onPress={() => setShowAttachmentMenu(true)}
                    >
                      <Icon name="paperclip" size={22} color={isDarkMode ? "#8696A0" : "#54656F"} />
                    </TouchableOpacity>

                    {/* Camera Icon (if not typing) */}
                    {!Boolean(newMsg.trim()) && !pendingAttachment && (
                      <TouchableOpacity
                        style={styles.capsuleIconBtn}
                        onPress={() => handlePickImage(true)}
                      >
                        <Icon name="camera" size={22} color={isDarkMode ? "#8696A0" : "#54656F"} />
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Right Floating FAB (Send or Mic) */}
                  <TouchableOpacity
                    style={[
                      styles.waSendFab,
                      { backgroundColor: isDarkMode ? "#00A884" : "#008069" },
                    ]}
                    onPress={newMsg.trim() || pendingAttachment || editingMessage ? handleSendOrSave : handleStartVoiceRecording}
                    activeOpacity={0.8}
                  >
                    <Icon
                      name={
                        editingMessage
                          ? "check"
                          : newMsg.trim() || pendingAttachment
                          ? "send"
                          : "microphone"
                      }
                      size={20}
                      color="#FFFFFF"
                    />
                  </TouchableOpacity>
                </View>
              )}
            </KeyboardAvoidingView>
          </View>
        )}

        {/* ========================================================================= */}
        {/* MODAL 1: WHATSAPP LONG PRESS ACTIONS & QUICK EMOJI REACTION               */}
        {/* ========================================================================= */}
        <Modal visible={showActionSheet} transparent animationType="fade" onRequestClose={() => setShowActionSheet(false)}>
          <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={() => setShowActionSheet(false)}>
            <View style={[styles.waActionModalCard, { backgroundColor: isDarkMode ? "#1F2C34" : "#FFFFFF" }]}>
              {/* Quick Reactions Capsule */}
              <View style={[styles.reactionCapsule, { backgroundColor: isDarkMode ? "#2A3942" : "#F0F2F5" }]}>
                {QUICK_REACTIONS.map((emoji) => (
                  <TouchableOpacity
                    key={emoji}
                    style={styles.reactionBtn}
                    onPress={() => handleToggleReaction(emoji)}
                  >
                    <Text style={styles.reactionEmojiText}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.actionDivider} />

              {/* Reply */}
              <TouchableOpacity style={styles.actionSheetRow} onPress={handleStartReply}>
                <Icon name="reply" size={22} color="#00A884" />
                <Text style={[styles.actionSheetRowText, { color: isDarkMode ? "#E9EDEF" : "#111B21" }]}>
                  Reply
                </Text>
              </TouchableOpacity>

              {/* Copy */}
              <TouchableOpacity style={styles.actionSheetRow} onPress={handleCopyMessage}>
                <Icon name="content-copy" size={20} color={isDarkMode ? "#8696A0" : "#54656F"} />
                <Text style={[styles.actionSheetRowText, { color: isDarkMode ? "#E9EDEF" : "#111B21" }]}>
                  Copy
                </Text>
              </TouchableOpacity>

              {/* Edit Message (If <= 15m) */}
              {actionMessage && isMessageEditable(actionMessage) && (
                <TouchableOpacity style={styles.actionSheetRow} onPress={handleStartEdit}>
                  <Icon name="pencil" size={20} color="#F59E0B" />
                  <Text style={[styles.actionSheetRowText, { color: isDarkMode ? "#E9EDEF" : "#111B21" }]}>
                    Edit Message ({getRemainingEditMinutes(actionMessage)}m left)
                  </Text>
                </TouchableOpacity>
              )}

              {/* Delete for Everyone */}
              {actionMessage && actionMessage.sender === (currentUser?.role === "staff" ? "staff" : "student") && !actionMessage.deletedForEveryone && (
                <TouchableOpacity style={styles.actionSheetRow} onPress={() => handleDeleteMessage(true)}>
                  <Icon name="delete-sweep" size={20} color="#DC2626" />
                  <Text style={[styles.actionSheetRowText, { color: "#DC2626" }]}>
                    Delete for everyone
                  </Text>
                </TouchableOpacity>
              )}

              {/* Delete for Me */}
              <TouchableOpacity style={styles.actionSheetRow} onPress={() => handleDeleteMessage(false)}>
                <Icon name="delete-outline" size={20} color="#EF4444" />
                <Text style={[styles.actionSheetRowText, { color: "#EF4444" }]}>
                  Delete for me
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* ========================================================================= */}
        {/* MODAL 2: WHATSAPP 6-GRID ATTACHMENT SHEET                                 */}
        {/* ========================================================================= */}
        <Modal visible={showAttachmentMenu} transparent animationType="slide" onRequestClose={() => setShowAttachmentMenu(false)}>
          <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={() => setShowAttachmentMenu(false)}>
            <View style={[styles.waAttachSheetCard, { backgroundColor: isDarkMode ? "#1F2C34" : "#FFFFFF" }]}>
              <Text style={[styles.waAttachTitle, { color: isDarkMode ? "#E9EDEF" : "#111B21" }]}>
                Share Content
              </Text>

              <View style={styles.waAttachGrid}>
                {/* Document */}
                <TouchableOpacity style={styles.waAttachItem} onPress={handlePickDocument}>
                  <View style={[styles.waAttachCircle, { backgroundColor: "#7F66FF" }]}>
                    <Icon name="file-document" size={24} color="#FFF" />
                  </View>
                  <Text style={[styles.waAttachLabel, { color: isDarkMode ? "#E9EDEF" : "#111B21" }]}>Document</Text>
                </TouchableOpacity>

                {/* Camera */}
                <TouchableOpacity style={styles.waAttachItem} onPress={() => handlePickImage(true)}>
                  <View style={[styles.waAttachCircle, { backgroundColor: "#D3396D" }]}>
                    <Icon name="camera" size={24} color="#FFF" />
                  </View>
                  <Text style={[styles.waAttachLabel, { color: isDarkMode ? "#E9EDEF" : "#111B21" }]}>Camera</Text>
                </TouchableOpacity>

                {/* Gallery */}
                <TouchableOpacity style={styles.waAttachItem} onPress={() => handlePickImage(false)}>
                  <View style={[styles.waAttachCircle, { backgroundColor: "#AC44CF" }]}>
                    <Icon name="image-multiple" size={24} color="#FFF" />
                  </View>
                  <Text style={[styles.waAttachLabel, { color: isDarkMode ? "#E9EDEF" : "#111B21" }]}>Gallery</Text>
                </TouchableOpacity>

                {/* Audio */}
                <TouchableOpacity style={styles.waAttachItem} onPress={() => showToast("🎙️ Voice memo ready", "info")}>
                  <View style={[styles.waAttachCircle, { backgroundColor: "#E78125" }]}>
                    <Icon name="headphones" size={24} color="#FFF" />
                  </View>
                  <Text style={[styles.waAttachLabel, { color: isDarkMode ? "#E9EDEF" : "#111B21" }]}>Audio</Text>
                </TouchableOpacity>

                {/* Location */}
                <TouchableOpacity style={styles.waAttachItem} onPress={() => showToast("📍 Campus Location attached", "info")}>
                  <View style={[styles.waAttachCircle, { backgroundColor: "#009688" }]}>
                    <Icon name="map-marker" size={24} color="#FFF" />
                  </View>
                  <Text style={[styles.waAttachLabel, { color: isDarkMode ? "#E9EDEF" : "#111B21" }]}>Location</Text>
                </TouchableOpacity>

                {/* Contact */}
                <TouchableOpacity style={styles.waAttachItem} onPress={() => showToast("👤 Contact shared", "info")}>
                  <View style={[styles.waAttachCircle, { backgroundColor: "#008069" }]}>
                    <Icon name="account" size={24} color="#FFF" />
                  </View>
                  <Text style={[styles.waAttachLabel, { color: isDarkMode ? "#E9EDEF" : "#111B21" }]}>Contact</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* ========================================================================= */}
        {/* MODAL 3: FULLSCREEN LIGHTBOX IMAGE VIEWER                                */}
        {/* ========================================================================= */}
        <Modal visible={Boolean(lightboxImage)} transparent animationType="fade" onRequestClose={() => setLightboxImage(null)}>
          <View style={styles.lightboxBackdrop}>
            <TouchableOpacity style={styles.lightboxCloseBtn} onPress={() => setLightboxImage(null)}>
              <Icon name="close" size={26} color="#FFFFFF" />
            </TouchableOpacity>
            {lightboxImage && (
              <Image source={{ uri: lightboxImage }} style={styles.lightboxImg} resizeMode="contain" />
            )}
          </View>
        </Modal>

        {/* ========================================================================= */}
        {/* MODAL 4: PRIVACY & E2EE MODAL                                             */}
        {/* ========================================================================= */}
        {showPrivacyModal && (
          <Modal visible={showPrivacyModal} transparent animationType="fade" onRequestClose={() => setShowPrivacyModal(false)}>
            <View style={styles.sheetBackdrop}>
              <View style={[styles.privacyBox, { backgroundColor: isDarkMode ? "#1F2C34" : "#FFFFFF" }]}>
                <View style={styles.privacyBoxHeader}>
                  <Icon name="shield-lock" size={26} color="#00A884" />
                  <Text style={[styles.privacyBoxTitle, { color: isDarkMode ? "#E9EDEF" : "#111B21" }]}>
                    End-to-End Encryption
                  </Text>
                </View>
                <Text style={[styles.privacyBoxBody, { color: isDarkMode ? "#8696A0" : "#54656F" }]}>
                  Messages and calls are end-to-end encrypted. No one outside of this chat, not even EduNex, can read or listen to them. Messages may be edited within the first 15 minutes of sending.
                </Text>
                <TouchableOpacity
                  style={[styles.privacyBoxBtn, { backgroundColor: isDarkMode ? "#00A884" : "#008069" }]}
                  onPress={() => setShowPrivacyModal(false)}
                >
                  <Text style={styles.privacyBoxBtnText}>OK</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        )}
        {/* ========================================================================= */}
        {/* MODAL 5: WHATSAPP AUDIO / VIDEO CALLING SCREEN                            */}
        {/* ========================================================================= */}
        {isCalling && (
          <Modal visible={isCalling} animationType="slide" transparent={false} onRequestClose={handleEndCall}>
            <LinearGradient
              colors={callType === "video" ? ["#0F172A", "#1E293B", "#0F172A"] : ["#064E3B", "#022C22", "#064E3B"]}
              style={styles.callScreenContainer}
            >
              <View style={styles.callHeader}>
                <Icon name="shield-lock-outline" size={16} color="rgba(255,255,255,0.7)" />
                <Text style={styles.callEncryptedText}>End-to-end encrypted {callType === "video" ? "Video Call" : "Voice Call"}</Text>
              </View>

              <View style={styles.callProfileCenter}>
                <View style={[styles.callAvatarLarge, { backgroundColor: selectedStaff?.avatarColor || "#059669" }]}>
                  <Text style={styles.callAvatarLargeText}>{selectedStaff?.initials || "F"}</Text>
                </View>
                <Text style={styles.callContactName}>{selectedStaff?.name || "Faculty"}</Text>
                <Text style={styles.callStatusText}>
                  {callTimer > 0 ? formatCallTime(callTimer) : "Ringing..."}
                </Text>
              </View>

              {/* Call Control Buttons */}
              <View style={styles.callControlsRow}>
                <TouchableOpacity
                  style={[styles.callBtnCircle, isMuted && { backgroundColor: "rgba(255,255,255,0.3)" }]}
                  onPress={() => setIsMuted(!isMuted)}
                >
                  <Icon name={isMuted ? "microphone-off" : "microphone"} size={26} color="#FFFFFF" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.callBtnCircle, isSpeaker && { backgroundColor: "rgba(255,255,255,0.3)" }]}
                  onPress={() => setIsSpeaker(!isSpeaker)}
                >
                  <Icon name={isSpeaker ? "volume-high" : "volume-medium"} size={26} color="#FFFFFF" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.callEndBtnCircle} onPress={handleEndCall}>
                  <Icon name="phone-hangup" size={28} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </Modal>
        )}
      </Animated.View>
    </Modal>
  );
}

// ---------------- WHATSAPP STYLES ----------------
const getStyles = (colors, isDarkMode) =>
  StyleSheet.create({
    container: { flex: 1 },

    /* WhatsApp Header */
    waHeader: {
      paddingHorizontal: 16,
      paddingTop: Platform.OS === "ios" ? 52 : 36,
      paddingBottom: 12,
      elevation: 4,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 3,
    },
    waHeaderRow: { flexDirection: "row", alignItems: "center" },
    iconBtn: { padding: 4 },
    waHeaderTitle: { fontSize: 18, fontWeight: "800", color: "#FFFFFF" },
    waHeaderSub: { fontSize: 11, color: "rgba(255,255,255,0.85)", marginTop: 1 },
    waHeaderProfile: { flex: 1, flexDirection: "row", alignItems: "center", marginLeft: 6 },
    waSmallAvatar: { width: 38, height: 38, borderRadius: 19, justifyContent: "center", alignItems: "center" },
    waSmallAvatarText: { fontSize: 13, fontWeight: "800", color: "#FFFFFF" },
    waHeaderName: { fontSize: 15, fontWeight: "700", color: "#FFFFFF" },
    waHeaderStatus: { fontSize: 11, color: "rgba(255,255,255,0.85)" },
    waHeaderActions: { flexDirection: "row", gap: 12 },
    waActionIcon: { padding: 4 },

    /* Dynamic Channel Tabs */
    channelTabsContainer: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(0,0,0,0.06)" },
    channelTabChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 16,
    },
    channelTabChipText: { fontSize: 12, fontWeight: "700" },
    roleBadgePill: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
      marginLeft: 6,
    },
    roleBadgePillText: { fontSize: 9.5, fontWeight: "800", textTransform: "uppercase" },

    /* Directory Search & Filters */
    waSearchContainer: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 4 },
    waSearchBox: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 10,
      gap: 8,
    },
    waSearchInput: { flex: 1, fontSize: 14, padding: 0 },
    waFilterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16 },
    waFilterChipText: { fontSize: 12, fontWeight: "600" },

    /* In-Chat Search Bar */
    inChatSearchContainer: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 14,
      paddingVertical: 8,
      gap: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: "#E2E8F0",
    },
    inChatSearchInput: { flex: 1, fontSize: 14, padding: 0 },

    /* WhatsApp Chat List Item */
    waChatItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    waAvatarContainer: { position: "relative", marginRight: 14 },
    waAvatar: { width: 50, height: 50, borderRadius: 25, justifyContent: "center", alignItems: "center" },
    waAvatarText: { fontSize: 17, fontWeight: "800", color: "#FFFFFF" },
    waOnlineDot: {
      position: "absolute",
      bottom: 1,
      right: 1,
      width: 13,
      height: 13,
      borderRadius: 6.5,
      backgroundColor: "#10B981",
      borderWidth: 2,
      borderColor: "#FFFFFF",
    },
    waChatDetails: { flex: 1 },
    waChatTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    waContactName: { fontSize: 15.5, fontWeight: "700", flex: 1, marginRight: 6 },
    waLastTime: { fontSize: 11, fontWeight: "500" },
    waChatBottomRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 },
    waLastSnippet: { fontSize: 13, flex: 1 },
    waDeptBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginLeft: 6 },
    waDeptBadgeText: { fontSize: 10, fontWeight: "700" },

    /* Chat Room Info Dropdown */
    waInfoCard: { padding: 12, marginHorizontal: 12, marginTop: 8, borderRadius: 12, gap: 6, elevation: 2 },
    waInfoRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    waInfoText: { fontSize: 12, fontWeight: "600" },

    /* Header Notice Wrap */
    headerNoticeWrap: { alignItems: "center", marginBottom: 12 },
    datePill: {
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 8,
      marginBottom: 8,
      elevation: 1,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 1,
    },
    datePillText: { fontSize: 11, fontWeight: "700" },
    e2eeYellowCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      maxWidth: "90%",
      elevation: 1,
    },
    e2eeYellowText: { fontSize: 10.5, lineHeight: 14, textAlign: "center", flex: 1 },

    /* Message Bubbles */
    msgRow: { flexDirection: "row", marginBottom: 6, alignItems: "flex-end" },
    msgRowRight: { justifyContent: "flex-end" },
    msgRowLeft: { justifyContent: "flex-start" },
    avatarBeside: { width: 26, height: 26, borderRadius: 13, justifyContent: "center", alignItems: "center", marginRight: 4, marginBottom: 2 },
    avatarBesideText: { fontSize: 9.5, fontWeight: "800", color: "#FFFFFF" },

    bubbleContainer: {
      maxWidth: SCREEN_WIDTH * 0.78,
      paddingHorizontal: 10,
      paddingTop: 6,
      paddingBottom: 6,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      elevation: 1,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 1,
    },
    bubbleMe: { borderBottomRightRadius: 2 },
    bubbleOther: { borderBottomLeftRadius: 2 },
    messageText: { fontSize: 14, lineHeight: 19 },

    replyQuoteBox: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      borderLeftWidth: 3.5,
      marginBottom: 6,
    },
    replyQuoteSender: { fontSize: 11, fontWeight: "800" },
    replyQuoteText: { fontSize: 11.5, marginTop: 1 },

    deletedRow: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 2 },
    deletedText: { fontSize: 12.5, fontStyle: "italic" },

    bubbleMetaRow: {
      flexDirection: "row",
      justifyContent: "flex-end",
      alignItems: "center",
      marginTop: 2,
      marginLeft: 14,
    },
    editedTag: { fontSize: 9.5, fontStyle: "italic", marginRight: 3 },
    timestampText: { fontSize: 10 },

    reactionBadge: {
      position: "absolute",
      bottom: -8,
      left: 10,
      backgroundColor: "#FFFFFF",
      borderRadius: 10,
      paddingHorizontal: 4,
      paddingVertical: 1,
      elevation: 2,
      borderWidth: 1,
      borderColor: "#E2E8F0",
    },
    reactionBadgeText: { fontSize: 12 },

    /* Typing Dots */
    typingDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: "#00A884",
    },

    /* Voice Note Bubble Player */
    voiceNoteWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 4,
      paddingHorizontal: 2,
      minWidth: 180,
    },
    voicePlayBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: "center",
      alignItems: "center",
    },
    voiceWaveContainer: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      height: 24,
    },
    voiceWaveBar: {
      width: 3,
      borderRadius: 1.5,
    },
    voiceDurationText: {
      fontSize: 11,
      fontWeight: "700",
      marginLeft: 4,
    },

    /* Voice Recording Capsule */
    voiceRecordingCapsule: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 24,
      paddingHorizontal: 12,
      paddingVertical: 6,
      minHeight: 46,
      gap: 10,
      elevation: 2,
    },
    recordingRedDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: "#EF4444",
    },
    recordingTimerText: {
      fontSize: 14,
      fontWeight: "800",
    },
    recordingWaveSample: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      height: 26,
    },
    recordingWaveBar: {
      width: 3,
      borderRadius: 1.5,
      backgroundColor: "#EF4444",
    },

    /* Attachments in Bubbles */
    attachmentWrapper: { marginBottom: 4 },
    imagePreviewWrap: { borderRadius: 10, overflow: "hidden", position: "relative" },
    bubbleImage: { width: 220, height: 150, borderRadius: 10 },
    imageOverlayBadge: {
      position: "absolute",
      bottom: 6,
      left: 6,
      backgroundColor: "rgba(0,0,0,0.6)",
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
    },
    imageOverlayText: { fontSize: 9, color: "#FFF", fontWeight: "700" },

    docPreviewCard: { flexDirection: "row", alignItems: "center", gap: 8, padding: 8, borderRadius: 8 },
    docIconBox: { width: 36, height: 36, borderRadius: 8, justifyContent: "center", alignItems: "center" },
    docName: { fontSize: 12, fontWeight: "700" },
    docMeta: { fontSize: 10, color: "#8696A0" },

    urlCardList: { marginTop: 4, gap: 4 },
    linkCard: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    linkCardText: { fontSize: 11.5, textDecorationLine: "underline", color: "#00A884", flex: 1 },

    /* Bars above Input */
    quickChipsBar: { paddingHorizontal: 12, paddingVertical: 6 },
    quickPromptChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, elevation: 1 },
    quickPromptText: { fontSize: 11, fontWeight: "600" },

    activeReplyBar: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: "#E2E8F0",
    },
    replyBarAccent: { width: 4, height: 28, borderRadius: 2, backgroundColor: "#00A884" },
    replyBarSender: { fontSize: 11, fontWeight: "800", color: "#00A884" },
    replyBarText: { fontSize: 11.5 },

    activeEditBar: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6 },
    activeEditText: { fontSize: 11.5, fontWeight: "700", flex: 1 },

    pendingMediaBar: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: "#E2E8F0",
    },
    pendingMediaName: { fontSize: 12, fontWeight: "700" },
    pendingMediaMeta: { fontSize: 10, color: "#8696A0" },

    /* WhatsApp Floating Input Capsule + Send Button */
    waInputRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      paddingHorizontal: 8,
      paddingBottom: Platform.OS === "ios" ? 18 : 10,
      paddingTop: 4,
      gap: 6,
    },
    waInputCapsule: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 24,
      paddingHorizontal: 8,
      paddingVertical: 2,
      minHeight: 46,
      elevation: 2,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
    },
    capsuleIconBtn: { padding: 6 },
    waTextInput: {
      flex: 1,
      fontSize: 14.5,
      paddingVertical: 8,
      paddingHorizontal: 6,
      maxHeight: 100,
    },
    waSendFab: {
      width: 46,
      height: 46,
      borderRadius: 23,
      justifyContent: "center",
      alignItems: "center",
      elevation: 3,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 3,
    },

    /* Action Sheets & Popups */
    sheetBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    waActionModalCard: {
      padding: 18,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      gap: 8,
    },
    reactionCapsule: {
      flexDirection: "row",
      justifyContent: "space-around",
      paddingVertical: 8,
      borderRadius: 24,
      marginBottom: 6,
    },
    reactionBtn: { padding: 4 },
    reactionEmojiText: { fontSize: 24 },
    actionDivider: { height: StyleSheet.hairlineWidth, backgroundColor: "#8696A044", marginVertical: 4 },
    actionSheetRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 10 },
    actionSheetRowText: { fontSize: 14.5, fontWeight: "600" },

    /* WhatsApp 6-Grid Attachment Sheet */
    waAttachSheetCard: {
      padding: 20,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
    },
    waAttachTitle: { fontSize: 15, fontWeight: "800", marginBottom: 18, textAlign: "center" },
    waAttachGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-around", rowGap: 16 },
    waAttachItem: { width: "30%", alignItems: "center", gap: 6 },
    waAttachCircle: {
      width: 54,
      height: 54,
      borderRadius: 27,
      justifyContent: "center",
      alignItems: "center",
      elevation: 3,
    },
    waAttachLabel: { fontSize: 12, fontWeight: "600" },

    /* Lightbox */
    lightboxBackdrop: { flex: 1, backgroundColor: "#000000", justifyContent: "center", alignItems: "center" },
    lightboxCloseBtn: { position: "absolute", top: 44, right: 16, zIndex: 10, padding: 8 },
    lightboxImg: { width: SCREEN_WIDTH, height: "80%" },

    /* Privacy Card */
    privacyBox: { width: "86%", alignSelf: "center", padding: 20, borderRadius: 16, gap: 12, marginBottom: "auto", marginTop: "auto" },
    privacyBoxHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
    privacyBoxTitle: { fontSize: 16, fontWeight: "800" },
    privacyBoxBody: { fontSize: 13, lineHeight: 19 },
    privacyBoxBtn: { paddingVertical: 10, borderRadius: 10, alignItems: "center" },
    privacyBoxBtnText: { fontSize: 14, fontWeight: "800", color: "#FFFFFF" },

    /* Audio / Video Calling Full-Screen */
    callScreenContainer: {
      flex: 1,
      justifyContent: "space-between",
      paddingVertical: 54,
      paddingHorizontal: 24,
      alignItems: "center",
    },
    callHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: "rgba(0,0,0,0.3)",
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 14,
    },
    callEncryptedText: {
      color: "rgba(255,255,255,0.8)",
      fontSize: 12,
      fontWeight: "600",
    },
    callProfileCenter: {
      alignItems: "center",
      gap: 12,
    },
    callAvatarLarge: {
      width: 110,
      height: 110,
      borderRadius: 55,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 3,
      borderColor: "rgba(255,255,255,0.4)",
      elevation: 6,
    },
    callAvatarLargeText: {
      fontSize: 42,
      fontWeight: "800",
      color: "#FFFFFF",
    },
    callContactName: {
      fontSize: 22,
      fontWeight: "800",
      color: "#FFFFFF",
    },
    callStatusText: {
      fontSize: 15,
      color: "rgba(255,255,255,0.75)",
      fontWeight: "600",
    },
    callControlsRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 24,
      backgroundColor: "rgba(0,0,0,0.35)",
      paddingHorizontal: 24,
      paddingVertical: 14,
      borderRadius: 36,
    },
    callBtnCircle: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: "rgba(255,255,255,0.15)",
      justifyContent: "center",
      alignItems: "center",
    },
    callEndBtnCircle: {
      width: 58,
      height: 58,
      borderRadius: 29,
      backgroundColor: "#EF4444",
      justifyContent: "center",
      alignItems: "center",
      elevation: 4,
    },
  });
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
  sendDirectMessage,
  editDirectMessage,
  deleteDirectMessage,
} from "../../../services/chatService";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

const QUICK_PROMPTS = [
  "Good morning Professor, had a quick question regarding the assignment.",
  "Sir, could you please review my lab submission?",
  "Requesting a 10-minute cabin meeting today if convenient.",
  "Thank you for the guidance!",
];

const DEFAULT_STAFF = [
  {
    id: "staff_1",
    name: "Dr. K. Vigneshwaran",
    role: "Professor & HOD",
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
  {
    id: "staff_4",
    name: "Dr. P. Rajesh",
    role: "Dean of Student Affairs",
    dept: "Administration",
    subject: "Academic Grievances & Policy",
    cabin: "Admin Block, Ground Floor",
    status: "offline",
    statusText: "last seen today at 05:00 PM",
    initials: "PR",
    avatarColor: "#DC2626",
    phone: "+91 98765 43213",
    email: "dean.student@edunex.edu",
    e2eeKey: "0x44FE1...77A8",
  },
];

export default function ChatModal({ visible, onClose }) {
  const { colors, isDarkMode } = useTheme();
  const slideAnim = useRef(new Animated.Value(100)).current;
  const flatListRef = useRef(null);

  // User identity
  const [currentUser, setCurrentUser] = useState(null);

  // Screen View: 'directory' | 'chat'
  const [currentView, setCurrentView] = useState("directory");
  const [selectedStaff, setSelectedStaff] = useState(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [deptFilter, setDeptFilter] = useState("All");

  // Contacts dataset
  const [contacts, setContacts] = useState(DEFAULT_STAFF);

  // Chat message state keyed by staff id
  const [threads, setThreads] = useState({});
  const [newMsg, setNewMsg] = useState("");
  const [showStaffInfo, setShowStaffInfo] = useState(false);

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

  // 1. Initialize Threads from Storage / Default Roster
  useEffect(() => {
    async function loadAllThreads() {
      try {
        const id = await resolveIdentity();
        setCurrentUser(id);

        const staffRes = await api.get("/staff").catch(() => null);
        if (Array.isArray(staffRes?.data) && staffRes.data.length > 0) {
          const mapped = staffRes.data.map((s, idx) => ({
            id: s._id || s.id || `staff_api_${idx}`,
            name: s.name || "Faculty Member",
            role: s.designation || s.role || "Professor",
            dept: s.department || s.dept || "General",
            subject: s.subject || s.specialization || "Engineering",
            cabin: s.cabin || s.room || "Academic Wing",
            status: idx % 2 === 0 ? "online" : "in_lecture",
            statusText: idx % 2 === 0 ? "online" : "In Lecture",
            initials: (s.name || "F").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase(),
            avatarColor: idx % 3 === 0 ? "#059669" : idx % 3 === 1 ? "#0D9488" : "#D97706",
            phone: s.phone || "+91 98765 43210",
            email: s.email || "faculty@edunex.edu",
            e2eeKey: `0x${Math.random().toString(16).substring(2, 8).toUpperCase()}...B2`,
          }));
          setContacts(mapped);
        }
      } catch (e) {
        console.log("Staff fetch err:", e?.message || e);
      }

      const loaded = {};
      for (const staff of DEFAULT_STAFF) {
        try {
          const raw = await AsyncStorage.getItem(`chat_thread_${staff.id}`);
          if (raw) {
            loaded[staff.id] = JSON.parse(raw);
          }
        } catch {}
      }
      setThreads(loaded);
    }
    if (visible) {
      loadAllThreads();
    }
  }, [visible]);

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

  // Fetch messages from REST API for selected staff
  const syncStaffMessages = useCallback(async (staffId) => {
    try {
      const storageKey = `chat_thread_${staffId}`;
      const raw = await AsyncStorage.getItem(storageKey);
      if (raw) {
        setThreads((prev) => ({ ...prev, [staffId]: JSON.parse(raw) }));
      }
      const res = await api.get("/messages", { staffId, limit: 40, sort: "createdAt" }).catch(() => null);
      if (Array.isArray(res?.data) && res.data.length > 0) {
        setThreads((prev) => ({
          ...prev,
          [staffId]: res.data,
        }));
        AsyncStorage.setItem(storageKey, JSON.stringify(res.data)).catch(() => {});
      }
    } catch (e) {
      console.log("Chat fetch err:", e?.message || e);
    }
  }, []);

  // Open Individual Staff Chat
  const handleSelectStaff = (staff) => {
    setSelectedStaff(staff);
    setCurrentView("chat");
    setEditingMessage(null);
    setReplyingTo(null);
    setPendingAttachment(null);
    syncStaffMessages(staff.id);
  };

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

  // ---------------- SEND OR SAVE MESSAGE ----------------
  const handleSendOrSave = async () => {
    const textTrimmed = newMsg.trim();
    if (!textTrimmed && !pendingAttachment) return;
    if (!selectedStaff) return;

    // A. If in Edit Mode
    if (editingMessage) {
      try {
        const updatedList = await editDirectMessage({
          threadKey: selectedStaff.id,
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
    const role = currentUser?.role === "staff" ? "staff" : "student";
    const senderName =
      currentUser?.student?.name ||
      currentUser?.staff?.name ||
      currentUser?.profile?.name ||
      currentUser?.name ||
      (role === "staff" ? "Faculty" : "Student");

    const senderId =
      currentUser?.student?.rollNo ||
      currentUser?.staffId ||
      currentUser?.id ||
      currentUser?.username ||
      "user_current";

    const msgObj = createMessageObject({
      text: textTrimmed,
      senderRole: role,
      senderId,
      senderName,
      recipientId: selectedStaff.id,
      recipientRole: role === "staff" ? "student" : "staff",
      attachment: pendingAttachment,
      replyTo: replyingTo
        ? { id: replyingTo.id, text: replyingTo.text, senderName: replyingTo.senderName }
        : null,
    });

    const updated = await sendDirectMessage({
      threadKey: selectedStaff.id,
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
      await AsyncStorage.setItem(`chat_thread_${selectedStaff.id}`, JSON.stringify(updated));
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

    const updated = await deleteDirectMessage({
      threadKey: selectedStaff.id,
      messageId: actionMessage.id,
      deleteForEveryone: forEveryone,
    });

    if (updated) {
      setThreads((prev) => ({ ...prev, [selectedStaff.id]: updated }));
    }
    showToast(forEveryone ? "🗑️ Deleted for everyone" : "🗑️ Deleted for me", "info");
  };

  // ---------------- DIRECTORY FILTER ----------------
  const departments = useMemo(() => {
    const set = new Set(["All"]);
    contacts.forEach((c) => c.dept && set.add(c.dept));
    return Array.from(set);
  }, [contacts]);

  const filteredStaffList = useMemo(() => {
    return contacts.filter((staff) => {
      const matchesSearch =
        staff.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        staff.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        staff.dept.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDept = deptFilter === "All" || staff.dept === deptFilter;
      return matchesSearch && matchesDept;
    });
  }, [contacts, searchQuery, deptFilter]);

  const currentMessages = useMemo(() => {
    if (!selectedStaff) return [];
    return threads[selectedStaff.id] || [];
  }, [threads, selectedStaff]);

  const handleCallStaff = () => {
    if (!selectedStaff?.phone) return;
    Linking.openURL(`tel:${selectedStaff.phone}`).catch(() => {
      showToast(`Cannot make call to ${selectedStaff.phone}`, "error");
    });
  };

  const handleEmailStaff = () => {
    if (!selectedStaff?.email) return;
    Linking.openURL(`mailto:${selectedStaff.email}?subject=Academic%20Inquiry%20from%20Student`).catch(() => {
      showToast(`Cannot open mail client for ${selectedStaff.email}`, "error");
    });
  };

  const styles = getStyles(colors, isDarkMode);

  // ---------------- Render Message Bubble ----------------
  const renderMessageBubble = ({ item }) => {
    const isMe = item.sender === (currentUser?.role === "staff" ? "staff" : "student");
    const isDeleted = item.deletedForEveryone;
    const urls = extractUrls(item.text);

    return (
      <TouchableOpacity
        activeOpacity={0.9}
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
              {/* Media Attachments */}
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
            {item.isEdited && !isDeleted && (
              <Text style={[styles.editedTag, { color: isDarkMode ? "#8696A0" : "#64748B" }]}>
                edited
              </Text>
            )}
            <Text style={[styles.timestampText, { color: isDarkMode ? "#8696A0" : "#64748B" }]}>
              {item.time}
            </Text>
            {isMe && !isDeleted && (
              <Icon
                name="check-all"
                size={14}
                color={item.status === "read" ? "#53BDEB" : isDarkMode ? "#8696A0" : "#64748B"}
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
        {/* VIEW 1: WHATSAPP-STYLE DIRECTORY & CHATS LIST                             */}
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
                  <Text style={styles.waHeaderTitle}>Faculty Chats</Text>
                  <Text style={styles.waHeaderSub}>End-to-End Encrypted</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setShowPrivacyModal(true)}
                  style={styles.iconBtn}
                >
                  <Icon name="shield-check" size={22} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>

            {/* WhatsApp Search Bar */}
            <View style={[styles.waSearchContainer, { backgroundColor: isDarkMode ? "#111B21" : "#FFFFFF" }]}>
              <View style={[styles.waSearchBox, { backgroundColor: isDarkMode ? "#1F2C34" : "#F0F2F5" }]}>
                <Icon name="magnify" size={20} color={isDarkMode ? "#8696A0" : "#54656F"} />
                <TextInput
                  style={[styles.waSearchInput, { color: isDarkMode ? "#E9EDEF" : "#111B21" }]}
                  placeholder="Search faculty or subject..."
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

            {/* WhatsApp Filters (All, AI & DS, CSE, Mentors) */}
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
                const threadMsgs = threads[item.id] || [];
                const lastMsg = threadMsgs.length > 0 ? threadMsgs[threadMsgs.length - 1] : null;
                const isOnline = item.status === "online";

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
                        <Text
                          style={[styles.waContactName, { color: isDarkMode ? "#E9EDEF" : "#111B21" }]}
                          numberOfLines={1}
                        >
                          {item.name}
                        </Text>
                        <Text style={[styles.waLastTime, { color: isDarkMode ? "#8696A0" : "#667781" }]}>
                          {lastMsg ? lastMsg.time : isOnline ? "Online" : "Faculty"}
                        </Text>
                      </View>

                      <View style={styles.waChatBottomRow}>
                        <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                          {lastMsg?.sender === "student" && (
                            <Icon
                              name="check-all"
                              size={14}
                              color={lastMsg.status === "read" ? "#53BDEB" : "#8696A0"}
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
                            {lastMsg ? lastMsg.text || `[${lastMsg.attachment?.type}]` : `${item.role} · ${item.subject}`}
                          </Text>
                        </View>

                        {/* Unread Pill or Dept Tag */}
                        <View style={[styles.waDeptBadge, { backgroundColor: isDarkMode ? "#1F2C34" : "#E2E8F0" }]}>
                          <Text style={[styles.waDeptBadgeText, { color: isDarkMode ? "#8696A0" : "#475569" }]}>
                            {item.dept}
                          </Text>
                        </View>
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
                    <Text style={styles.waHeaderStatus} numberOfLines={1}>
                      {selectedStaff.status === "online" ? "online" : selectedStaff.statusText}
                    </Text>
                  </View>
                </TouchableOpacity>

                <View style={styles.waHeaderActions}>
                  <TouchableOpacity onPress={handleCallStaff} style={styles.waActionIcon}>
                    <Icon name="phone" size={20} color="#FFFFFF" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleEmailStaff} style={styles.waActionIcon}>
                    <Icon name="email-outline" size={20} color="#FFFFFF" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setShowPrivacyModal(true)} style={styles.waActionIcon}>
                    <Icon name="shield-lock-outline" size={20} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

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

              {/* WhatsApp Floating Input Capsule + Floating Send FAB */}
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
                    onChangeText={setNewMsg}
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
                  onPress={handleSendOrSave}
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
  });
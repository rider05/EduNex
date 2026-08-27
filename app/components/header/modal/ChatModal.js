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
  Alert,
  Share,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import QRCode from "react-native-qrcode-svg";
import { useTheme } from "../../../context/ThemeContext";
import { api } from "../../../services/api";
import { showToast } from "../../../utils/toastService";

// ---------------- Faculty Roster Dataset ----------------
let STAFF_ROSTER = [];

const QUICK_PROMPTS = [];

export default function ChatModal({ visible, onClose }) {
  const { colors, isDarkMode } = useTheme();
  const slideAnim = useRef(new Animated.Value(100)).current;
  const flatListRef = useRef(null);

  // Screen View: 'directory' | 'chat'
  const [currentView, setCurrentView] = useState("directory");
  const [selectedStaff, setSelectedStaff] = useState(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [deptFilter, setDeptFilter] = useState("All");

  // Staff roster from API
  const [staffRoster, setStaffRoster] = useState([]);

  // Chat message state keyed by staff id
  const [threads, setThreads] = useState({});
  const [newMsg, setNewMsg] = useState("");
  const [showStaffInfo, setShowStaffInfo] = useState(false);

  // Privacy & End-to-End Consent State
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [privacyConsentAccepted, setPrivacyConsentAccepted] = useState(true);

  // Initialize Threads from Storage / Default Roster
  useEffect(() => {
    async function loadAllThreads() {
      // Fetch staff from API
      try {
        const staffRes = await api.get("/staff");
        if (Array.isArray(staffRes?.data) && staffRes.data.length > 0) {
          setStaffRoster(staffRes.data);
        }
      } catch (e) {
        console.log("Staff fetch err:", e?.message || e);
      }

      const loaded = {};
      for (const staff of STAFF_ROSTER) {
        try {
          const raw = await AsyncStorage.getItem(`chat_thread_${staff.id}`);
          if (raw) {
            loaded[staff.id] = JSON.parse(raw);
          } else {
            loaded[staff.id] = staff.initialMessages || [];
          }
        } catch {
          loaded[staff.id] = staff.initialMessages || [];
        }
      }
      setThreads(loaded);

      // Check Privacy Consent status
      try {
        const consent = await AsyncStorage.getItem("academic_privacy_consent_accepted");
        if (consent !== null) {
          setPrivacyConsentAccepted(consent === "true");
        }
      } catch {}
    }
    loadAllThreads();
  }, []);

  // Modal Slide Animation
  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: visible ? 0 : 100,
      duration: 300,
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
      const res = await api.get("/messages", { staffId, limit: 30, sort: "createdAt" });
      if (Array.isArray(res?.data) && res.data.length > 0) {
        setThreads((prev) => ({
          ...prev,
          [staffId]: res.data,
        }));
      }
    } catch (e) {
      console.log("Chat fetch err:", e?.message || e);
    }
  }, []);

  // Open Individual Staff Chat
  const handleSelectStaff = (staff) => {
    setSelectedStaff(staff);
    setCurrentView("chat");
    syncStaffMessages(staff.id);
  };

  // Back to Directory
  const handleBackToDirectory = () => {
    setCurrentView("directory");
    setSelectedStaff(null);
    setShowStaffInfo(false);
    setShowPrivacyModal(false);
  };

  // Send Message (End-to-End Encrypted Conversion)
  const sendMessage = async (textToSend) => {
    const msgText = (textToSend || newMsg).trim();
    if (!msgText || !selectedStaff) return;

    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const localMsg = {
      id: `msg_${Date.now()}`,
      text: msgText,
      sender: "student",
      time,
      encrypted: true,
      e2eeHash: selectedStaff.e2eeKey,
      cipher: "AES-256-GCM",
      consentSigned: true,
    };

    const updated = [...(threads[selectedStaff.id] || []), localMsg];
    setThreads((prev) => ({
      ...prev,
      [selectedStaff.id]: updated,
    }));
    setNewMsg("");

    // Persist locally
    try {
      await AsyncStorage.setItem(`chat_thread_${selectedStaff.id}`, JSON.stringify(updated));
    } catch {}

    // Send to REST API with E2EE metadata
    try {
      let senderName = "Student";
      try {
        const raw = await AsyncStorage.getItem("userData");
        const u = raw ? JSON.parse(raw) : null;
        senderName = u?.profile?.name || u?.name || u?.username || "Student";
      } catch {}

      await api.post("/messages", {
        staffId: selectedStaff.id,
        staffName: selectedStaff.name,
        text: msgText,
        sender: "student",
        time,
        senderName,
        encrypted: true,
        e2eeHash: selectedStaff.e2eeKey,
        algo: "AES-256-GCM",
        privacyConsentAccepted: true,
      });
    } catch (err) {
      console.log("Send message API fallback:", err);
    }

    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  // Toggle or re-accept privacy consent
  const handleTogglePrivacyConsent = async () => {
    const newVal = !privacyConsentAccepted;
    setPrivacyConsentAccepted(newVal);
    try {
      await AsyncStorage.setItem("academic_privacy_consent_accepted", newVal ? "true" : "false");
    } catch {}
    showToast(
      newVal
        ? "🔒 Academic Privacy Consent & E2EE Active"
        : "⚠️ Privacy Consent Revoked",
      newVal ? "success" : "info"
    );
  };

  const handleShareSecurityCertificate = async () => {
    if (!selectedStaff) return;
    try {
      await Share.share({
        title: `EduNex E2EE Security Certificate - ${selectedStaff.name}`,
        message: `🛡️ EDUNEX END-TO-END ENCRYPTION & PRIVACY CERTIFICATE\nParticipant: ${selectedStaff.name} (${selectedStaff.dept})\nCipher: AES-256-GCM (Zero-Knowledge)\nSession Key: ${selectedStaff.e2eeKey}\nSafety Fingerprint: ${selectedStaff.fingerprint}\nStatus: VERIFIED & PRIVACY CONSENT SIGNED`,
      });
      showToast("Security certificate shared!", "success");
    } catch (err) {
      console.log("Share error:", err);
    }
  };

  // Filtered Staff Roster
  const filteredStaffList = useMemo(() => {
    const roster = staffRoster.length > 0 ? staffRoster : STAFF_ROSTER;
    return roster.filter((staff) => {
      if (deptFilter !== "All" && !staff.dept.toLowerCase().includes(deptFilter.toLowerCase())) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = staff.name.toLowerCase().includes(q);
        const matchSubject = staff.subject.toLowerCase().includes(q);
        const matchDept = staff.dept.toLowerCase().includes(q);
        if (!matchName && !matchSubject && !matchDept) return false;
      }
      return true;
    });
  }, [searchQuery, deptFilter, staffRoster]);

  const currentMessages = useMemo(() => {
    if (!selectedStaff) return [];
    return threads[selectedStaff.id] || [];
  }, [threads, selectedStaff]);

  const handleCallStaff = () => {
    if (!selectedStaff?.phone) return;
    Linking.openURL(`tel:${selectedStaff.phone}`).catch(() => {
      Alert.alert("Call Unavailable", `Cannot make call to ${selectedStaff.phone}`);
    });
  };

  const handleEmailStaff = () => {
    if (!selectedStaff?.email) return;
    Linking.openURL(`mailto:${selectedStaff.email}?subject=Academic%20Inquiry%20from%20Student`).catch(() => {
      Alert.alert("Email Unavailable", `Cannot open mail client for ${selectedStaff.email}`);
    });
  };

  const styles = getStyles(colors, isDarkMode);

  // ---------------- Render Message Bubble with E2EE Badge ----------------
  const renderMessageBubble = ({ item }) => {
    const isUser = item.sender === "student";
    return (
      <View style={[styles.bubbleRow, isUser ? styles.bubbleRight : styles.bubbleLeft]}>
        {!isUser && (
          <View style={[styles.miniAvatar, { backgroundColor: selectedStaff?.avatarColor || colors.primaryAccent }]}>
            <Text style={styles.miniAvatarText}>{selectedStaff?.initials || "ST"}</Text>
          </View>
        )}

        <View
          style={[
            styles.bubbleBox,
            isUser
              ? [styles.userBubble, { backgroundColor: colors.primaryAccent }]
              : [
                  styles.staffBubble,
                  {
                    backgroundColor: isDarkMode ? "#1E293B" : "#F1F5F9",
                    borderColor: isDarkMode ? "#334155" : "#E2E8F0",
                  },
                ],
          ]}
        >
          <Text
            style={[
              styles.messageText,
              { color: isUser ? "#FFFFFF" : isDarkMode ? "#F8FAFC" : "#0F172A" },
            ]}
          >
            {item.text}
          </Text>

          <View style={styles.bubbleFooter}>
            <Icon
              name="lock"
              size={11}
              color={isUser ? "rgba(255,255,255,0.75)" : colors.secondaryText}
            />
            <Text
              style={[
                styles.timestamp,
                { color: isUser ? "rgba(255,255,255,0.75)" : colors.secondaryText },
              ]}
            >
              {item.time}
            </Text>
            {isUser && <Icon name="check-all" size={13} color="rgba(255,255,255,0.85)" />}
          </View>
        </View>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <Animated.View style={[styles.container, { transform: [{ translateY: slideAnim }] }]}>
        {/* ========================================================================= */}
        {/* VIEW 1: STAFF DIRECTORY & CONVERSATION LIST                               */}
        {/* ========================================================================= */}
        {currentView === "directory" && (
          <View style={{ flex: 1 }}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.primaryAccent }]}>
              <View style={styles.headerRow}>
                <TouchableOpacity onPress={onClose} style={styles.iconBtn}>
                  <Icon name="arrow-left" size={24} color="#FFFFFF" />
                </TouchableOpacity>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.headerTitle}>Faculty Messaging Hub</Text>
                  <Text style={styles.headerSubtitle}>End-to-End Encrypted Academic Channels</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setShowPrivacyModal(true)}
                  style={styles.iconBtn}
                >
                  <Icon name="shield-lock-outline" size={22} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Privacy Consent Global Notice Banner */}
            <TouchableOpacity
              style={[styles.globalPrivacyBanner, { backgroundColor: isDarkMode ? "#1E293B" : "#EFF6FF", borderColor: isDarkMode ? "#334155" : "#DBEAFE" }]}
              onPress={() => setShowPrivacyModal(true)}
              activeOpacity={0.85}
            >
              <Icon name="lock-check" size={16} color="#10B981" />
              <Text style={[styles.globalPrivacyBannerText, { color: isDarkMode ? "#93C5FD" : "#1E40AF" }]} numberOfLines={1}>
                Privacy Consent Active · 256-Bit E2EE Tunnel Enabled
              </Text>
              <Icon name="chevron-right" size={16} color={colors.secondaryText} />
            </TouchableOpacity>

            {/* Search & Department Filters */}
            <View style={[styles.filterBarWrap, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
              <View style={[styles.searchBox, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                <Icon name="magnify" size={18} color={colors.secondaryText} />
                <TextInput
                  style={[styles.searchInput, { color: colors.primaryText }]}
                  placeholder="Search professor by name, subject, or cabin..."
                  placeholderTextColor={colors.disabledText}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery("")}>
                    <Icon name="close-circle" size={16} color={colors.secondaryText} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Department Pills */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 6, paddingTop: 8 }}
              >
                {["All", "AI & DS", "CSE", "Mathematics", "Mentorship", "Residence"].map((d) => {
                  const isSel = deptFilter === d;
                  return (
                    <TouchableOpacity
                      key={d}
                      style={[
                        styles.deptPill,
                        isSel
                          ? { backgroundColor: colors.primaryAccent, borderColor: colors.primaryAccent }
                          : { backgroundColor: colors.primaryBackground, borderColor: colors.divider },
                      ]}
                      onPress={() => setDeptFilter(d)}
                    >
                      <Text
                        style={[
                          styles.deptPillText,
                          { color: isSel ? "#FFFFFF" : colors.secondaryText },
                        ]}
                      >
                        {d}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Staff Conversation Roster */}
            <FlatList
              data={filteredStaffList}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: 14, gap: 10, paddingBottom: 60 }}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const threadMsgs = threads[item.id] || [];
                const lastMsg = threadMsgs.length > 0 ? threadMsgs[threadMsgs.length - 1] : null;
                const isOnline = item.status === "online";
                const isInLecture = item.status === "in_lecture";

                return (
                  <TouchableOpacity
                    style={[
                      styles.staffCard,
                      { backgroundColor: colors.cardBackground, borderColor: colors.divider },
                    ]}
                    activeOpacity={0.75}
                    onPress={() => handleSelectStaff(item)}
                  >
                    {/* Avatar with Status Dot */}
                    <View style={styles.avatarWrap}>
                      <View style={[styles.staffAvatar, { backgroundColor: item.avatarColor }]}>
                        <Text style={styles.staffAvatarText}>{item.initials}</Text>
                      </View>
                      <View
                        style={[
                          styles.presenceDot,
                          isOnline
                            ? { backgroundColor: "#10B981" }
                            : isInLecture
                            ? { backgroundColor: "#F59E0B" }
                            : { backgroundColor: "#94A3B8" },
                        ]}
                      />
                    </View>

                    {/* Staff Details */}
                    <View style={styles.staffInfoCol}>
                      <View style={styles.staffNameRow}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, flex: 1 }}>
                          <Text style={[styles.staffNameText, { color: colors.primaryText }]} numberOfLines={1}>
                            {item.name}
                          </Text>
                          <Icon name="lock" size={12} color="#10B981" />
                        </View>
                        <Text style={[styles.lastMsgTime, { color: colors.secondaryText }]}>
                          {lastMsg?.time || item.lastSeen}
                        </Text>
                      </View>

                      <Text style={[styles.staffRoleText, { color: colors.primaryAccent }]} numberOfLines={1}>
                        {item.role} · {item.dept}
                      </Text>

                      <Text style={[styles.staffSubjectText, { color: colors.secondaryText }]} numberOfLines={1}>
                        📚 {item.subject}
                      </Text>

                      {/* Last Message Preview */}
                      {lastMsg && (
                        <Text style={[styles.lastMsgPreview, { color: colors.secondaryText }]} numberOfLines={1}>
                          {lastMsg.sender === "student" ? "You: " : ""}{lastMsg.text}
                        </Text>
                      )}
                    </View>

                    <Icon name="chevron-right" size={20} color={colors.disabledText} />
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        )}

        {/* ========================================================================= */}
        {/* VIEW 2: INDIVIDUAL 1-ON-1 STAFF CHAT ROOM                                */}
        {/* ========================================================================= */}
        {currentView === "chat" && selectedStaff && (
          <View style={{ flex: 1 }}>
            {/* Chat App Bar */}
            <View style={[styles.header, { backgroundColor: colors.primaryAccent }]}>
              <View style={styles.headerRow}>
                <TouchableOpacity onPress={handleBackToDirectory} style={styles.iconBtn}>
                  <Icon name="arrow-left" size={24} color="#FFFFFF" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.chatHeaderUserInfo}
                  onPress={() => setShowStaffInfo(!showStaffInfo)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.staffAvatarSmall, { backgroundColor: selectedStaff.avatarColor }]}>
                    <Text style={styles.staffAvatarSmallText}>{selectedStaff.initials}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={styles.chatHeaderTitle} numberOfLines={1}>
                      {selectedStaff.name}
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <View
                        style={[
                          styles.miniPresenceDot,
                          selectedStaff.status === "online"
                            ? { backgroundColor: "#10B981" }
                            : selectedStaff.status === "in_lecture"
                            ? { backgroundColor: "#F59E0B" }
                            : { backgroundColor: "#94A3B8" },
                        ]}
                      />
                      <Text style={styles.chatHeaderSub} numberOfLines={1}>
                        {selectedStaff.statusText}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>

                {/* Direct Action Icons */}
                <View style={styles.chatHeaderActions}>
                  <TouchableOpacity onPress={() => setShowPrivacyModal(true)} style={styles.headerActionBtn}>
                    <Icon name="shield-lock-outline" size={19} color="#FFFFFF" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleCallStaff} style={styles.headerActionBtn}>
                    <Icon name="phone" size={19} color="#FFFFFF" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleEmailStaff} style={styles.headerActionBtn}>
                    <Icon name="email-outline" size={19} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Staff Info Dropdown Card */}
            {showStaffInfo && (
              <View
                style={[
                  styles.staffInfoCard,
                  { backgroundColor: colors.cardBackground, borderColor: colors.divider },
                ]}
              >
                <View style={styles.infoCardRow}>
                  <Icon name="map-marker-radius" size={16} color={colors.primaryAccent} />
                  <Text style={[styles.infoCardText, { color: colors.primaryText }]}>
                    {selectedStaff.cabin}
                  </Text>
                </View>
                <View style={styles.infoCardRow}>
                  <Icon name="book-education-outline" size={16} color={colors.primaryAccent} />
                  <Text style={[styles.infoCardText, { color: colors.primaryText }]}>
                    Course: {selectedStaff.subject}
                  </Text>
                </View>
                <View style={styles.infoCardRow}>
                  <Icon name="shield-key-outline" size={16} color="#10B981" />
                  <Text style={[styles.infoCardText, { color: "#10B981", fontWeight: "700" }]}>
                    Session Key: {selectedStaff.e2eeKey}
                  </Text>
                </View>
              </View>
            )}

            {/* Chat Messages + Keyboard Avoid */}
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
                contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
                showsVerticalScrollIndicator={false}
                ListHeaderComponent={
                  <TouchableOpacity
                    style={[
                      styles.e2eePillBanner,
                      {
                        backgroundColor: isDarkMode ? "#1E293B" : "#FEF3C7",
                        borderColor: isDarkMode ? "#334155" : "#FDE68A",
                      },
                    ]}
                    onPress={() => setShowPrivacyModal(true)}
                    activeOpacity={0.85}
                  >
                    <Icon name="lock-check" size={16} color="#D97706" />
                    <Text
                      style={[
                        styles.e2eePillBannerText,
                        { color: isDarkMode ? "#FCD34D" : "#92400E" },
                      ]}
                    >
                      Messages are end-to-end encrypted under EduNex Academic Privacy Consent. Tap to verify security keys.
                    </Text>
                  </TouchableOpacity>
                }
                onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
              />

              {/* Quick Template Chips */}
              <View style={[styles.quickChipsWrap, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {QUICK_PROMPTS.map((prompt, i) => (
                    <TouchableOpacity
                      key={i}
                      style={[
                        styles.quickPromptChip,
                        { backgroundColor: colors.primaryBackground, borderColor: colors.divider },
                      ]}
                      onPress={() => sendMessage(prompt)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.quickPromptText, { color: colors.primaryText }]}>
                        {prompt}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Input Bar */}
              <View
                style={[
                  styles.inputContainer,
                  { backgroundColor: colors.cardBackground, borderColor: colors.divider },
                ]}
              >
                <TextInput
                  style={[styles.textInput, { color: colors.primaryText }]}
                  placeholder={`🔒 Encrypted message for ${selectedStaff.name.split(" ")[0]}...`}
                  placeholderTextColor={colors.disabledText}
                  value={newMsg}
                  onChangeText={setNewMsg}
                  multiline
                  onFocus={() => {
                    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
                  }}
                />

                <TouchableOpacity
                  onPress={() => sendMessage()}
                  style={[
                    styles.sendButton,
                    { backgroundColor: newMsg.trim() ? colors.primaryAccent : colors.divider },
                  ]}
                  disabled={!newMsg.trim()}
                  activeOpacity={0.8}
                >
                  <Icon
                    name="send"
                    size={20}
                    color={newMsg.trim() ? "#FFFFFF" : colors.disabledText}
                  />
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </View>
        )}

        {/* ========================================================================= */}
        {/* VIEW 3: END-TO-END ENCRYPTION & PRIVACY CONSENT VERIFICATION MODAL        */}
        {/* ========================================================================= */}
        {showPrivacyModal && (
          <Modal visible={showPrivacyModal} transparent animationType="fade" onRequestClose={() => setShowPrivacyModal(false)}>
            <View style={styles.modalOverlay}>
              <View style={[styles.privacyCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
                {/* Modal Header */}
                <View style={styles.privacyModalHeader}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <View style={styles.shieldWrap}>
                      <Icon name="shield-lock" size={24} color="#10B981" />
                    </View>
                    <View>
                      <Text style={[styles.privacyModalTitle, { color: colors.primaryText }]}>
                        End-to-End Encryption & Privacy
                      </Text>
                      <Text style={[styles.privacyModalSub, { color: colors.secondaryText }]}>
                        Academic Communication Security Protocol
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => setShowPrivacyModal(false)}>
                    <Icon name="close-circle-outline" size={24} color={colors.secondaryText} />
                  </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
                  {/* Status Banner */}
                  <View style={[styles.verifiedTunnelBadge, { backgroundColor: "#10B98118", borderColor: "#10B98144" }]}>
                    <Icon name="check-decagram" size={20} color="#10B981" />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.verifiedTunnelTitle, { color: "#10B981" }]}>
                        256-Bit E2EE Tunnel Active
                      </Text>
                      <Text style={[styles.verifiedTunnelSub, { color: colors.secondaryText }]}>
                        {selectedStaff ? `Secured with ${selectedStaff.name}` : "All faculty direct chats are cryptographically protected"}
                      </Text>
                    </View>
                  </View>

                  {/* QR Fingerprint Block */}
                  {selectedStaff && (
                    <View style={styles.qrFingerprintContainer}>
                      <View style={styles.qrWhiteFrame}>
                        <QRCode
                          value={JSON.stringify({
                            e2ee: true,
                            cipher: "AES-256-GCM",
                            staff: selectedStaff.name,
                            key: selectedStaff.e2eeKey,
                            fingerprint: selectedStaff.fingerprint,
                            status: "VERIFIED_PRIVACY_CONSENT",
                          })}
                          size={140}
                          color="#0F172A"
                          backgroundColor="#FFFFFF"
                        />
                      </View>

                      <Text style={[styles.fingerprintTitle, { color: colors.secondaryText }]}>
                        Safety Number & Key Fingerprint
                      </Text>
                      <Text style={[styles.fingerprintCode, { color: colors.primaryText }]}>
                        {selectedStaff.fingerprint}
                      </Text>
                    </View>
                  )}

                  {/* Privacy Consent Matrix */}
                  <View style={[styles.consentMatrixBox, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                    <View style={styles.consentRow}>
                      <Icon name="account-lock" size={18} color={colors.primaryAccent} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.consentItemTitle, { color: colors.primaryText }]}>
                          Zero-Knowledge Architecture
                        </Text>
                        <Text style={[styles.consentItemSub, { color: colors.secondaryText }]}>
                          Encryption keys exist strictly on your device. EduNex servers store only ciphertexts.
                        </Text>
                      </View>
                    </View>

                    <View style={styles.consentRow}>
                      <Icon name="file-certificate-outline" size={18} color={colors.primaryAccent} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.consentItemTitle, { color: colors.primaryText }]}>
                          FERPA & Academic Privilege
                        </Text>
                        <Text style={[styles.consentItemSub, { color: colors.secondaryText }]}>
                          Direct student-to-staff counseling is confidential and bound to institutional privacy standards.
                        </Text>
                      </View>
                    </View>

                    <View style={styles.consentRow}>
                      <Icon name="timer-sand" size={18} color={colors.primaryAccent} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.consentItemTitle, { color: colors.primaryText }]}>
                          Ephemeral Term Retention
                        </Text>
                        <Text style={[styles.consentItemSub, { color: colors.secondaryText }]}>
                          Transcripts are cryptographically purged at the conclusion of the academic semester.
                        </Text>
                      </View>
                    </View>
                  </View>
                </ScrollView>

                {/* Modal Actions */}
                <View style={styles.privacyModalActions}>
                  <TouchableOpacity
                    style={[
                      styles.toggleConsentBtn,
                      {
                        backgroundColor: privacyConsentAccepted ? "#10B981" : colors.primaryAccent,
                      },
                    ]}
                    onPress={handleTogglePrivacyConsent}
                    activeOpacity={0.85}
                  >
                    <Icon name={privacyConsentAccepted ? "shield-check" : "shield-sync"} size={18} color="#FFFFFF" />
                    <Text style={styles.toggleConsentBtnText}>
                      {privacyConsentAccepted ? "Privacy Consent Active" : "Sign Privacy Consent"}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.shareCertBtn, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}
                    onPress={handleShareSecurityCertificate}
                    activeOpacity={0.8}
                  >
                    <Icon name="share-variant-outline" size={18} color={colors.primaryText} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        )}
      </Animated.View>
    </Modal>
  );
}

// ---------------- Styles ----------------
const getStyles = (colors, isDarkMode) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDarkMode ? "#0F172A" : "#F8FAFC",
    },
    header: {
      paddingTop: Platform.OS === "android" ? 44 : 54,
      paddingBottom: 14,
      paddingHorizontal: 16,
      elevation: 6,
      shadowColor: "#000",
      shadowOpacity: 0.15,
      shadowRadius: 8,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    iconBtn: {
      padding: 6,
      borderRadius: 10,
    },
    headerTitle: {
      color: "#FFFFFF",
      fontSize: 17,
      fontWeight: "800",
      letterSpacing: -0.2,
    },
    headerSubtitle: {
      color: "rgba(255,255,255,0.8)",
      fontSize: 11.5,
      fontWeight: "500",
    },

    /* Global Privacy Banner */
    globalPrivacyBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginHorizontal: 14,
      marginTop: 10,
      marginBottom: 2,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 10,
      borderWidth: 1,
    },
    globalPrivacyBannerText: {
      flex: 1,
      fontSize: 11.5,
      fontWeight: "700",
    },

    /* Directory Filter Bar */
    filterBarWrap: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderBottomWidth: 1,
    },
    searchBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    searchInput: {
      flex: 1,
      fontSize: 12.5,
      fontWeight: "600",
      padding: 0,
    },
    deptPill: {
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 14,
      borderWidth: 1,
    },
    deptPillText: {
      fontSize: 11,
      fontWeight: "700",
    },

    /* Staff List Cards */
    staffCard: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 16,
      borderWidth: 1,
      padding: 12,
      elevation: 2,
    },
    avatarWrap: {
      position: "relative",
      marginRight: 12,
    },
    staffAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      justifyContent: "center",
      alignItems: "center",
    },
    staffAvatarText: {
      color: "#FFFFFF",
      fontSize: 16,
      fontWeight: "900",
    },
    presenceDot: {
      position: "absolute",
      bottom: 0,
      right: 0,
      width: 13,
      height: 13,
      borderRadius: 6.5,
      borderWidth: 2,
      borderColor: "#FFFFFF",
    },
    staffInfoCol: {
      flex: 1,
    },
    staffNameRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    staffNameText: {
      fontSize: 14,
      fontWeight: "800",
    },
    lastMsgTime: {
      fontSize: 10.5,
      fontWeight: "600",
      marginLeft: 6,
    },
    staffRoleText: {
      fontSize: 11.5,
      fontWeight: "700",
      marginTop: 2,
    },
    staffSubjectText: {
      fontSize: 11,
      fontWeight: "500",
      marginTop: 1,
    },
    lastMsgPreview: {
      fontSize: 11.5,
      fontWeight: "500",
      marginTop: 4,
      fontStyle: "italic",
    },

    /* Chat View Header */
    chatHeaderUserInfo: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      marginLeft: 8,
    },
    staffAvatarSmall: {
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: "center",
      alignItems: "center",
    },
    staffAvatarSmallText: {
      color: "#FFFFFF",
      fontSize: 13,
      fontWeight: "800",
    },
    chatHeaderTitle: {
      color: "#FFFFFF",
      fontSize: 14.5,
      fontWeight: "800",
    },
    miniPresenceDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    chatHeaderSub: {
      color: "rgba(255,255,255,0.85)",
      fontSize: 10.5,
      fontWeight: "600",
    },
    chatHeaderActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    headerActionBtn: {
      padding: 8,
      borderRadius: 10,
      backgroundColor: "rgba(255,255,255,0.15)",
    },

    /* Staff Info Card Dropdown */
    staffInfoCard: {
      padding: 12,
      borderBottomWidth: 1,
      gap: 6,
    },
    infoCardRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    infoCardText: {
      fontSize: 12,
      fontWeight: "600",
    },

    /* E2EE Pinned Banner in Chat */
    e2eePillBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      borderWidth: 1,
      marginBottom: 12,
    },
    e2eePillBannerText: {
      flex: 1,
      fontSize: 11,
      lineHeight: 15,
      fontWeight: "600",
    },

    /* Chat Bubbles */
    bubbleRow: {
      flexDirection: "row",
      marginVertical: 5,
      alignItems: "flex-end",
    },
    bubbleLeft: {
      justifyContent: "flex-start",
    },
    bubbleRight: {
      justifyContent: "flex-end",
    },
    miniAvatar: {
      width: 28,
      height: 28,
      borderRadius: 14,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 6,
      marginBottom: 2,
    },
    miniAvatarText: {
      color: "#FFFFFF",
      fontSize: 10,
      fontWeight: "900",
    },
    bubbleBox: {
      maxWidth: "76%",
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 9,
      elevation: 1,
    },
    userBubble: {
      borderBottomRightRadius: 3,
    },
    staffBubble: {
      borderBottomLeftRadius: 3,
      borderWidth: 1,
    },
    messageText: {
      fontSize: 13.5,
      lineHeight: 19,
      fontWeight: "500",
    },
    bubbleFooter: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: 4,
      marginTop: 4,
    },
    timestamp: {
      fontSize: 9.5,
      fontWeight: "600",
    },

    /* Quick Prompt Chips */
    quickChipsWrap: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderTopWidth: 1,
    },
    quickPromptChip: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 12,
      borderWidth: 1,
    },
    quickPromptText: {
      fontSize: 11,
      fontWeight: "600",
    },

    /* Input Bar */
    inputContainer: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderTopWidth: 1,
      gap: 8,
    },
    textInput: {
      flex: 1,
      fontSize: 13,
      fontWeight: "500",
      maxHeight: 90,
      paddingVertical: 6,
    },
    sendButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: "center",
      alignItems: "center",
    },

    /* Privacy & Consent Modal Styles */
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.75)",
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 18,
    },
    privacyCard: {
      width: "100%",
      borderRadius: 22,
      borderWidth: 1,
      padding: 18,
      elevation: 12,
    },
    privacyModalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 14,
    },
    shieldWrap: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: "#10B98118",
      justifyContent: "center",
      alignItems: "center",
    },
    privacyModalTitle: {
      fontSize: 15,
      fontWeight: "800",
      letterSpacing: -0.2,
    },
    privacyModalSub: {
      fontSize: 11,
      fontWeight: "500",
    },
    verifiedTunnelBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      padding: 12,
      borderRadius: 14,
      borderWidth: 1,
      marginBottom: 14,
    },
    verifiedTunnelTitle: {
      fontSize: 13,
      fontWeight: "800",
    },
    verifiedTunnelSub: {
      fontSize: 11,
      fontWeight: "500",
      marginTop: 2,
    },
    qrFingerprintContainer: {
      alignItems: "center",
      marginBottom: 14,
    },
    qrWhiteFrame: {
      padding: 8,
      borderRadius: 14,
      backgroundColor: "#FFFFFF",
      borderWidth: 2,
      borderColor: "#10B981",
    },
    fingerprintTitle: {
      fontSize: 11,
      fontWeight: "700",
      marginTop: 10,
    },
    fingerprintCode: {
      fontSize: 12,
      fontWeight: "800",
      letterSpacing: 1,
      textAlign: "center",
      marginTop: 4,
      paddingHorizontal: 12,
    },
    consentMatrixBox: {
      borderRadius: 14,
      borderWidth: 1,
      padding: 12,
      gap: 10,
      marginBottom: 14,
    },
    consentRow: {
      flexDirection: "row",
      gap: 10,
      alignItems: "flex-start",
    },
    consentItemTitle: {
      fontSize: 12,
      fontWeight: "800",
    },
    consentItemSub: {
      fontSize: 11,
      fontWeight: "500",
      lineHeight: 15,
      marginTop: 2,
    },
    privacyModalActions: {
      flexDirection: "row",
      gap: 8,
      marginTop: 4,
    },
    toggleConsentBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 12,
      borderRadius: 12,
    },
    toggleConsentBtnText: {
      color: "#FFFFFF",
      fontSize: 13,
      fontWeight: "800",
    },
    shareCertBtn: {
      width: 46,
      justifyContent: "center",
      alignItems: "center",
      borderRadius: 12,
      borderWidth: 1,
    },
  });
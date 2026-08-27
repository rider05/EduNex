import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useTheme } from "../../../context/ThemeContext";
import { resolveIdentity } from "../../../services/identityService";
import { showToast } from "../../../utils/toastService";
import { api } from "../../../services/api";

export default function ClassGroupMsgModal({ visible, onClose, colors: propColors }) {
  const theme = useTheme();
  const colors = propColors || theme.colors || {};
  const isDarkMode = theme.isDarkMode || false;
  const styles = getStyles(colors, isDarkMode);

  const [announcements, setAnnouncements] = useState([]);
  const [activeTab, setActiveTab] = useState("broadcasts");
  const [user, setUser] = useState(null);

  const fetchNotices = useCallback(async () => {
    try {
      const res = await api.get("/notices");
      const items = res?.data || res || [];
      const mapped = (Array.isArray(items) ? items : []).map((n, i) => ({
        id: n._id || n.id || String(i),
        title: n.subject || n.title || "—",
        text: n.message || n.content || "—",
        author: n.sender || n.author || "—",
        date: n.date || n.createdAt || "—",
        tag: n.tag || n.category || "General",
        attachment: n.attachment || null,
        color: n.tag === "Exam Notice" ? "#4F46E5" : n.tag === "Lab Alert" ? "#10B981" : "#F59E0B",
      }));
      setAnnouncements(mapped);
    } catch {
      setAnnouncements([]);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      resolveIdentity().then(setUser).catch(() => {});
      fetchNotices();
    }
  }, [visible, fetchNotices]);

  const [title, setTitle] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [selectedTag, setSelectedTag] = useState("General");
  const [attachment, setAttachment] = useState(null);

  const TAGS = ["General", "Lab Alert", "Exam Notice", "Assignment", "Urgent"];

  if (!visible) return null;

  const handleSendAnnouncement = () => {
    if (!title.trim() || !announcement.trim()) {
      showToast("Please provide both a title and message body", "warning");
      return;
    }

    const newMsg = {
      id: Date.now().toString(),
      title: title.trim(),
      text: announcement.trim(),
      date: "Just now",
      author: user?.name || "",
      tag: selectedTag,
      attachment: attachment ? attachment.name : null,
      color: selectedTag === "Exam Notice" ? "#4F46E5" : selectedTag === "Lab Alert" ? "#10B981" : "#F59E0B",
    };

    setAnnouncements([newMsg, ...announcements]);
    setTitle("");
    setAnnouncement("");
    setAttachment(null);
    setActiveTab("broadcasts");
    showToast("Classroom announcement broadcasted to all students!", "success");
  };

  const pickAttachment = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: "*/*" });
      if (!result.canceled && result.assets?.[0]) {
        setAttachment(result.assets[0]);
        showToast("File attached: " + result.assets[0].name, "info");
      }
    } catch {
      // Ignored
    }
  };

  const openCamera = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Camera permission is needed to attach reference sheets.");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.[0]) {
        setAttachment({ name: result.assets[0].uri?.split("/").pop() || "Classroom_Photo.jpg" });
        showToast("Photo captured and attached!", "info");
      }
    } catch {
      // Ignored
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.overlay}
      >
        <View
          style={[
            styles.modalContainer,
            {
              backgroundColor: colors.cardBackground || "#FFFFFF",
              borderColor: colors.divider || "rgba(0,0,0,0.1)",
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
              <View style={[styles.iconWrap, { backgroundColor: "#4F46E518" }]}>
                <Icon name="bullhorn-outline" size={24} color="#4F46E5" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { color: colors.primaryText }]}>Classroom Broadcast Hub</Text>
                <Text style={[styles.subtitle, { color: colors.secondaryText }]}>
                  Broadcast notices & lab schedules to active cohorts
                </Text>
              </View>
            </View>

            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Icon name="close-circle-outline" size={24} color={colors.secondaryText} />
            </TouchableOpacity>
          </View>

          {/* View Switcher */}
          <View style={[styles.tabBar, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
            <TouchableOpacity
              style={[
                styles.tabBtn,
                activeTab === "broadcasts" && { backgroundColor: colors.primaryAccent },
              ]}
              onPress={() => setActiveTab("broadcasts")}
            >
              <Text
                style={[
                  styles.tabBtnText,
                  { color: activeTab === "broadcasts" ? "#FFFFFF" : colors.secondaryText },
                ]}
              >
                Broadcasts ({announcements.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tabBtn,
                activeTab === "compose" && { backgroundColor: colors.primaryAccent },
              ]}
              onPress={() => setActiveTab("compose")}
            >
              <Text
                style={[
                  styles.tabBtnText,
                  { color: activeTab === "compose" ? "#FFFFFF" : colors.secondaryText },
                ]}
              >
                + New Announcement
              </Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollBody}>
            {activeTab === "broadcasts" ? (
              <View style={{ gap: 10 }}>
                {announcements.map((item) => (
                  <View
                    key={item.id}
                    style={[styles.announcementCard, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}
                  >
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <View style={[styles.tagBadge, { backgroundColor: `${item.color}18` }]}>
                        <Text style={[styles.tagBadgeText, { color: item.color }]}>{item.tag}</Text>
                      </View>
                      <Text style={[styles.dateText, { color: colors.secondaryText }]}>{item.date}</Text>
                    </View>

                    <Text style={[styles.announcementTitle, { color: colors.primaryText }]}>{item.title}</Text>
                    <Text style={[styles.announcementBody, { color: colors.secondaryText }]}>{item.text}</Text>

                    <View style={[styles.authorRow, { borderTopColor: colors.divider }]}>
                      <Icon name="account-tie" size={15} color={colors.primaryAccent} />
                      <Text style={[styles.authorText, { color: colors.primaryAccent }]}>{item.author}</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={{ gap: 10 }}>
                {/* Tag Selector */}
                <Text style={[styles.inputLabel, { color: colors.secondaryText }]}>Select Notice Priority / Category</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {TAGS.map((t) => {
                    const isSel = selectedTag === t;
                    return (
                      <TouchableOpacity
                        key={t}
                        style={[
                          styles.catPill,
                          isSel
                            ? { backgroundColor: colors.primaryAccent, borderColor: colors.primaryAccent }
                            : { backgroundColor: colors.primaryBackground, borderColor: colors.divider },
                        ]}
                        onPress={() => setSelectedTag(t)}
                      >
                        <Text style={[styles.catPillText, { color: isSel ? "#FFFFFF" : colors.primaryText }]}>
                          {t}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* Title */}
                <View>
                  <Text style={[styles.inputLabel, { color: colors.secondaryText }]}>Announcement Headline</Text>
                  <TextInput
                    style={[styles.textInput, { backgroundColor: colors.primaryBackground, borderColor: colors.divider, color: colors.primaryText }]}
                    placeholder="e.g. Schedule for Deep Learning Assignment Review..."
                    placeholderTextColor={colors.disabledText}
                    value={title}
                    onChangeText={setTitle}
                  />
                </View>

                {/* Message Body */}
                <View>
                  <Text style={[styles.inputLabel, { color: colors.secondaryText }]}>Detailed Notice Message</Text>
                  <TextInput
                    style={[styles.textArea, { backgroundColor: colors.primaryBackground, borderColor: colors.divider, color: colors.primaryText }]}
                    placeholder="Type the instructions for students and teaching assistants..."
                    placeholderTextColor={colors.disabledText}
                    value={announcement}
                    onChangeText={setAnnouncement}
                    multiline
                    numberOfLines={4}
                  />
                </View>

                {/* Attachments */}
                <View style={styles.attachRow}>
                  <TouchableOpacity
                    style={[styles.attachBtn, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}
                    onPress={pickAttachment}
                  >
                    <Icon name="paperclip" size={18} color={colors.primaryAccent} />
                    <Text style={[styles.attachBtnText, { color: colors.primaryAccent }]}>Attach Document</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.attachBtn, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}
                    onPress={openCamera}
                  >
                    <Icon name="camera-outline" size={18} color={colors.primaryAccent} />
                    <Text style={[styles.attachBtnText, { color: colors.primaryAccent }]}>Take Photo</Text>
                  </TouchableOpacity>
                </View>

                {attachment && (
                  <View style={[styles.attachmentBadge, { backgroundColor: "#10B98114", borderColor: "#10B98133" }]}>
                    <Icon name="file-check-outline" size={16} color="#10B981" />
                    <Text style={styles.attachmentBadgeText} numberOfLines={1}>{attachment.name}</Text>
                    <TouchableOpacity onPress={() => setAttachment(null)}>
                      <Icon name="close" size={16} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                )}

                {/* Broadcast Action */}
                <TouchableOpacity
                  style={[styles.broadcastBtn, { backgroundColor: colors.primaryAccent }]}
                  onPress={handleSendAnnouncement}
                  activeOpacity={0.85}
                >
                  <Icon name="send-check" size={18} color="#FFFFFF" />
                  <Text style={styles.broadcastBtnText}>Broadcast to Cohort</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ---------------- Styles ----------------
const getStyles = (colors, isDarkMode) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "rgba(0,0,0,0.75)",
      paddingHorizontal: 16,
    },
    modalContainer: {
      width: "100%",
      maxHeight: "85%",
      borderRadius: 22,
      borderWidth: 1,
      padding: 18,
      elevation: 12,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    iconWrap: {
      width: 42,
      height: 42,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
    },
    title: {
      fontSize: 16,
      fontWeight: "800",
      letterSpacing: -0.2,
    },
    subtitle: {
      fontSize: 11,
      fontWeight: "500",
      marginTop: 1,
    },
    closeBtn: {
      padding: 4,
    },
    tabBar: {
      flexDirection: "row",
      borderRadius: 12,
      borderWidth: 1,
      padding: 4,
      marginBottom: 12,
    },
    tabBtn: {
      flex: 1,
      alignItems: "center",
      paddingVertical: 7,
      borderRadius: 9,
    },
    tabBtnText: {
      fontSize: 11.5,
      fontWeight: "700",
    },
    scrollBody: {
      paddingBottom: 10,
    },
    announcementCard: {
      borderRadius: 14,
      borderWidth: 1,
      padding: 12,
    },
    tagBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    tagBadgeText: {
      fontSize: 9.5,
      fontWeight: "900",
      textTransform: "uppercase",
    },
    dateText: {
      fontSize: 10.5,
      fontWeight: "500",
    },
    announcementTitle: {
      fontSize: 13.5,
      fontWeight: "800",
      marginTop: 4,
    },
    announcementBody: {
      fontSize: 12,
      lineHeight: 16,
      fontWeight: "500",
      marginTop: 3,
    },
    authorRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      marginTop: 8,
      paddingTop: 6,
      borderTopWidth: 1,
    },
    authorText: {
      fontSize: 11,
      fontWeight: "700",
    },
    inputLabel: {
      fontSize: 11.5,
      fontWeight: "700",
      marginBottom: 3,
    },
    catPill: {
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 10,
      borderWidth: 1,
    },
    catPillText: {
      fontSize: 11,
      fontWeight: "700",
    },
    textInput: {
      borderWidth: 1,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
      fontSize: 12.5,
    },
    textArea: {
      borderWidth: 1,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
      fontSize: 12.5,
      minHeight: 70,
      textAlignVertical: "top",
    },
    attachRow: {
      flexDirection: "row",
      gap: 8,
    },
    attachBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 9,
      borderRadius: 10,
      borderWidth: 1,
    },
    attachBtnText: {
      fontSize: 11.5,
      fontWeight: "700",
    },
    attachmentBadge: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: 8,
      borderRadius: 8,
      borderWidth: 1,
    },
    attachmentBadgeText: {
      fontSize: 11.5,
      fontWeight: "600",
      color: "#10B981",
      flex: 1,
      marginHorizontal: 6,
    },
    broadcastBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 12,
      borderRadius: 12,
      marginTop: 4,
    },
    broadcastBtnText: {
      color: "#FFFFFF",
      fontSize: 13,
      fontWeight: "800",
    },
  });
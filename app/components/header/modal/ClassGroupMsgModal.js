import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  Image,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";

export default function ClassGroupMsgModal({ visible, onClose, colors }) {
  const [messages, setMessages] = useState([
    {
      id: "1",
      title: "Lab Update",
      text: "AI Lab will start at 2:00 PM today.",
      date: "11 Nov, 2025",
    },
  ]);

  const [title, setTitle] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [link, setLink] = useState("");
  const [showLinkField, setShowLinkField] = useState(false);
  const [attachment, setAttachment] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [focusedField, setFocusedField] = useState("");

  // ✅ Send new announcement
  const handleSendAnnouncement = () => {
    if (!title.trim() || !announcement.trim()) return;

    const newMsg = {
      id: Date.now().toString(),
      title,
      text: announcement,
      link,
      attachment,
      photo,
      date: new Date().toLocaleDateString("en-GB"),
    };
    setMessages((prev) => [newMsg, ...prev]);
    setTitle("");
    setAnnouncement("");
    setLink("");
    setShowLinkField(false);
    setAttachment(null);
    setPhoto(null);
  };

  // ✅ Pick file
  const pickAttachment = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: "*/*" });
    if (!result.canceled) setAttachment(result.assets?.[0]);
  };

  // ✅ Take a photo
  const openCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      alert("Camera permission required");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled) setPhoto(result.assets[0]);
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <SafeAreaView
          style={[styles.innerContainer, { backgroundColor: colors.primaryBackground }]}
        >
          {/* ===== Header ===== */}
          <View style={[styles.header, { backgroundColor: colors.primaryAccent }]}>
            <Text style={styles.headerText}>Class Group Announcements</Text>
            <TouchableOpacity onPress={onClose}>
              <Icon name="close" size={26} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* ===== Message List ===== */}
          <FlatList
            data={messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.msgList}
            renderItem={({ item }) => (
              <View style={[styles.msgCard, { backgroundColor: colors.cardBackground }]}>
                <View style={styles.msgHeader}>
                  <Icon name="bullhorn-outline" size={20} color={colors.primaryAccent} />
                  <Text style={[styles.msgTitle, { color: colors.primaryText }]}>
                    {item.title}
                  </Text>
                </View>
                <Text style={[styles.msgText, { color: colors.secondaryText }]}>
                  {item.text}
                </Text>
                {item.photo && (
                  <Image
                    source={{ uri: item.photo.uri }}
                    style={{ width: 140, height: 100, borderRadius: 10, marginTop: 8 }}
                  />
                )}
                {item.link ? (
                  <Text
                    style={[styles.msgLink, { color: colors.primaryAccent }]}
                    numberOfLines={1}
                  >
                    🔗 {item.link}
                  </Text>
                ) : null}
                {item.attachment ? (
                  <Text style={[styles.msgAttachment, { color: colors.warningText }]}>
                    📎 {item.attachment.name}
                  </Text>
                ) : null}
                <Text style={[styles.msgDate, { color: colors.disabledText }]}>
                  {item.date}
                </Text>
              </View>
            )}
          />

          {/* ===== Input Section ===== */}
          <View style={[styles.inputSection, { borderTopColor: colors.divider }]}>
            {/* 📷 Preview if photo taken */}
            {photo && (
              <View style={styles.previewContainer}>
                <Image
                  source={{ uri: photo.uri }}
                  style={styles.previewImage}
                  resizeMode="cover"
                />
                <TouchableOpacity onPress={() => setPhoto(null)} style={styles.removeBtn}>
                  <Icon name="close-circle" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            )}

            {/* Title Field */}
            <Text style={[styles.label, { color: colors.secondaryText }]}>Title</Text>
            <TextInput
              style={[
                styles.input,
                {
                  borderColor:
                    focusedField === "title" ? colors.primaryAccent : colors.divider,
                },
              ]}
              placeholder="Enter title"
              placeholderTextColor={colors.disabledText}
              value={title}
              onFocus={() => setFocusedField("title")}
              onBlur={() => setFocusedField("")}
              onChangeText={setTitle}
            />

            {/* Message Field */}
            <Text style={[styles.label, { color: colors.secondaryText, marginTop: 10 }]}>
              Message
            </Text>
            <TextInput
              style={[
                styles.textArea,
                {
                  borderColor:
                    focusedField === "announcement"
                      ? colors.primaryAccent
                      : colors.divider,
                },
              ]}
              placeholder="Type your message..."
              placeholderTextColor={colors.disabledText}
              multiline
              value={announcement}
              onFocus={() => setFocusedField("announcement")}
              onBlur={() => setFocusedField("")}
              onChangeText={setAnnouncement}
            />

            {/* Optional Link Field */}
            {showLinkField && (
              <TextInput
                style={[
                  styles.linkInput,
                  {
                    borderColor:
                      focusedField === "link" ? colors.primaryAccent : colors.divider,
                  },
                ]}
                placeholder="Paste link (optional)"
                placeholderTextColor={colors.disabledText}
                value={link}
                onFocus={() => setFocusedField("link")}
                onBlur={() => setFocusedField("")}
                onChangeText={setLink}
              />
            )}

            {/* ===== Bottom Action Row ===== */}
            <View style={styles.bottomRow}>
              {/* Camera (bottom-left) */}
              <TouchableOpacity onPress={openCamera} style={styles.cameraIcon}>
                <Icon
                  name="camera-outline"
                  size={26}
                  color={photo ? colors.primaryAccent : colors.secondaryText}
                />
              </TouchableOpacity>

              {/* Right icons row */}
              <View style={styles.rightActions}>
                <TouchableOpacity onPress={pickAttachment} style={styles.iconBtn}>
                  <Icon
                    name="paperclip"
                    size={24}
                    color={attachment ? colors.primaryAccent : colors.secondaryText}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setShowLinkField((prev) => !prev)}
                  style={styles.iconBtn}
                >
                  <Icon
                    name="link-variant"
                    size={24}
                    color={showLinkField ? colors.primaryAccent : colors.secondaryText}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleSendAnnouncement}
                  style={[styles.sendBtn, { backgroundColor: colors.primaryAccent }]}
                >
                  <Icon name="send" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "flex-end" },
  innerContainer: {
    flex: 1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  headerText: { color: "#fff", fontSize: 17, fontWeight: "700" },
  msgList: { padding: 15, paddingBottom: 100 },
  msgCard: { borderRadius: 12, padding: 14, marginBottom: 10, elevation: 2 },
  msgHeader: { flexDirection: "row", alignItems: "center", marginBottom: 5 },
  msgTitle: { fontSize: 15, fontWeight: "700", marginLeft: 6 },
  msgText: { fontSize: 14, lineHeight: 20 },
  msgLink: { fontSize: 13, marginTop: 4, textDecorationLine: "underline" },
  msgAttachment: { fontSize: 13, marginTop: 4 },
  msgDate: { fontSize: 11, textAlign: "right", marginTop: 6 },
  inputSection: { padding: 15, borderTopWidth: 1 },
  label: { fontSize: 13, fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    fontSize: 15,
    color: "black",
    backgroundColor: "#fff",
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    height: 80,
    textAlignVertical: "top",
    fontSize: 15,
    color: "black",
    backgroundColor: "#fff",
  },
  linkInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    fontSize: 15,
    color: "black",
    backgroundColor: "#fff",
    marginTop: 10,
  },
  previewContainer: {
    alignSelf: "flex-start",
    marginBottom: 8,
    position: "relative",
  },
  previewImage: {
    width: 100,
    height: 80,
    borderRadius: 10,
  },
  removeBtn: {
    position: "absolute",
    top: -6,
    right: -6,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 20,
    padding: 2,
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
  },
  cameraIcon: { marginRight: 10 },
  rightActions: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  iconBtn: { padding: 8, marginHorizontal: 4 },
  sendBtn: { padding: 12, borderRadius: 30, elevation: 3, marginLeft: 5 },
});
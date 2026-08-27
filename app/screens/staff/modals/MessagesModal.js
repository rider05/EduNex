import React, { useRef, useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  TextInput,
  ScrollView,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { useTheme } from "../../../context/ThemeContext";
import { getMessagesList } from "../../../services/dataService";
import { showToast } from "../../../utils/toastService";

const DEFAULT_MESSAGES = [];

export default function MessagesModal({ visible, onClose, colors: propColors }) {
  const theme = useTheme();
  const colors = propColors || theme.colors || {};
  const isDarkMode = theme.isDarkMode || false;
  const styles = getStyles(colors, isDarkMode);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const [search, setSearch] = useState("");
  const [messages, setMessages] = useState(DEFAULT_MESSAGES);
  const [replyText, setReplyText] = useState("");
  const [selectedMessage, setSelectedMessage] = useState(null);

  const loadMessages = useCallback(async () => {
    try {
      const list = await getMessagesList({ limit: 50 });
      if (Array.isArray(list) && list.length > 0) {
        setMessages(
          list.map((m, idx) => ({
            id: m.id || m._id || String(idx + 1),
            sender: m.senderName || m.from || "EduNex Member",
            role: "Communication",
            text: m.message || m.text || "",
            time: "Recently",
            unread: m.read === false,
            color: "#4F46E5",
          }))
        );
      }
    } catch {
      // Use fallback
    }
  }, []);

  useEffect(() => {
    if (visible) {
      loadMessages();
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
          easing: Easing.out(Easing.ease),
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 65,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      slideAnim.setValue(40);
    }
  }, [visible, fadeAnim, slideAnim, loadMessages]);

  if (!visible) return null;

  const handleSendReply = () => {
    if (!replyText.trim()) return;
    showToast("Reply sent to " + selectedMessage.sender.split("(")[0], "success");
    setReplyText("");
    setSelectedMessage(null);
  };

  const filtered = messages.filter((m) => {
    if (search.trim()) {
      const q = search.toLowerCase();
      return m.sender.toLowerCase().includes(q) || m.text.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.modalOverlay, { opacity: fadeAnim }]}>
        <Animated.View
          style={[
            styles.modalContainer,
            {
              backgroundColor: colors.cardBackground || "#FFFFFF",
              borderColor: colors.divider || "rgba(0,0,0,0.1)",
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
              <View style={[styles.iconWrap, { backgroundColor: "#3B82F618" }]}>
                <Icon name="message-text-outline" size={24} color="#3B82F6" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { color: colors.primaryText }]}>Faculty Messages & Inquiries</Text>
                <Text style={[styles.subtitle, { color: colors.secondaryText }]}>
                  Parent counseling inquiries & student doubts
                </Text>
              </View>
            </View>

            <TouchableOpacity onPress={onClose} style={styles.closeIconBtn}>
              <Icon name="close-circle-outline" size={24} color={colors.secondaryText} />
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View style={[styles.searchBox, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
            <Icon name="magnify" size={18} color={colors.secondaryText} />
            <TextInput
              style={[styles.searchInput, { color: colors.primaryText }]}
              placeholder="Search conversations..."
              placeholderTextColor={colors.disabledText}
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch("")}>
                <Icon name="close-circle" size={16} color={colors.secondaryText} />
              </TouchableOpacity>
            )}
          </View>

          {/* Messages List */}
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
            {filtered.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.msgCard,
                  {
                    backgroundColor: colors.primaryBackground,
                    borderColor: item.unread ? colors.primaryAccent : colors.divider,
                  },
                ]}
                onPress={() => setSelectedMessage(item)}
                activeOpacity={0.85}
              >
                <View style={styles.msgCardTop}>
                  <View style={[styles.msgAvatar, { backgroundColor: item.color }]}>
                    <Icon name="account" size={18} color="#FFFFFF" />
                  </View>

                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <Text style={[styles.senderText, { color: colors.primaryText }]} numberOfLines={1}>
                        {item.sender}
                      </Text>
                      {item.unread && (
                        <View style={[styles.unreadBadge, { backgroundColor: colors.primaryAccent }]}>
                          <Text style={styles.unreadText}>NEW</Text>
                        </View>
                      )}
                    </View>

                    <Text style={[styles.roleText, { color: colors.secondaryText }]}>{item.role}</Text>
                  </View>
                </View>

                <Text style={[styles.msgBody, { color: colors.primaryText }]} numberOfLines={2}>
                  {item.text}
                </Text>

                <View style={styles.msgCardBottom}>
                  <Text style={[styles.timeText, { color: colors.disabledText }]}>{item.time}</Text>
                  <Text style={[styles.replyActionText, { color: colors.primaryAccent }]}>Tap to Reply</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Reply Sheet Modal */}
          {selectedMessage && (
            <View style={[styles.replyContainer, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={[styles.replyingToText, { color: colors.secondaryText }]}>
                  Replying to <Text style={{ color: colors.primaryText, fontWeight: "800" }}>{selectedMessage.sender.split("(")[0]}</Text>
                </Text>
                <TouchableOpacity onPress={() => setSelectedMessage(null)}>
                  <Icon name="close" size={18} color={colors.secondaryText} />
                </TouchableOpacity>
              </View>

              <View style={[styles.replyInputWrap, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                <TextInput
                  style={[styles.replyInput, { color: colors.primaryText }]}
                  placeholder="Type your message..."
                  placeholderTextColor={colors.disabledText}
                  value={replyText}
                  onChangeText={setReplyText}
                />
                <TouchableOpacity
                  style={[styles.sendBtn, { backgroundColor: colors.primaryAccent }]}
                  onPress={handleSendReply}
                >
                  <Icon name="send" size={16} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Done Button */}
          <TouchableOpacity
            style={[styles.closeButton, { backgroundColor: colors.primaryAccent }]}
            onPress={onClose}
            activeOpacity={0.85}
          >
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ---------------- Styles ----------------
const getStyles = (colors, isDarkMode) =>
  StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.75)",
      justifyContent: "center",
      alignItems: "center",
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
    closeIconBtn: {
      padding: 4,
    },
    searchBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 12,
      borderWidth: 1,
      marginBottom: 10,
    },
    searchInput: {
      flex: 1,
      fontSize: 12,
      padding: 0,
    },
    msgCard: {
      borderRadius: 14,
      borderWidth: 1,
      padding: 12,
    },
    msgCardTop: {
      flexDirection: "row",
      alignItems: "center",
    },
    msgAvatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      justifyContent: "center",
      alignItems: "center",
    },
    senderText: {
      fontSize: 13,
      fontWeight: "800",
      flex: 1,
    },
    unreadBadge: {
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderRadius: 4,
    },
    unreadText: {
      color: "#FFFFFF",
      fontSize: 8.5,
      fontWeight: "900",
    },
    roleText: {
      fontSize: 10.5,
      fontWeight: "500",
    },
    msgBody: {
      fontSize: 12,
      lineHeight: 16,
      fontWeight: "500",
      marginTop: 6,
    },
    msgCardBottom: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 8,
      paddingTop: 6,
      borderTopWidth: 1,
      borderTopColor: "rgba(150,150,150,0.15)",
    },
    timeText: {
      fontSize: 10,
      fontWeight: "500",
    },
    replyActionText: {
      fontSize: 11,
      fontWeight: "700",
    },
    replyContainer: {
      borderRadius: 14,
      borderWidth: 1,
      padding: 10,
      marginTop: 8,
      gap: 6,
    },
    replyingToText: {
      fontSize: 11,
      fontWeight: "500",
    },
    replyInputWrap: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 10,
      borderWidth: 1,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    replyInput: {
      flex: 1,
      fontSize: 12,
      paddingVertical: 4,
    },
    sendBtn: {
      width: 30,
      height: 30,
      borderRadius: 15,
      justifyContent: "center",
      alignItems: "center",
    },
    closeButton: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 12,
      borderRadius: 12,
      marginTop: 12,
    },
    closeText: {
      color: "#FFFFFF",
      fontWeight: "800",
      fontSize: 13,
    },
  });
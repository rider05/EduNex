import React, { useState, useRef, useEffect, useCallback } from "react";
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
  Animated,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { useTheme } from "../../../context/ThemeContext";
import { resolveIdentity } from "../../../services/identityService";
import { api } from "../../../services/api";

export default function CommunityModal({ visible, onClose, colors: propColors }) {
  const theme = useTheme();
  const colors = propColors || theme.colors || {};
  const isDarkMode = theme.isDarkMode || false;
  const styles = getStyles(colors, isDarkMode);

  const slideAnim = useRef(new Animated.Value(40)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [user, setUser] = useState(null);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await api.get("/messages");
      const items = res?.data || res || [];
      const mapped = (Array.isArray(items) ? items : []).map((m, i) => ({
        id: m._id || m.id || String(i),
        sender: m.sender || m.author || "—",
        role: m.role || "",
        text: m.text || m.content || m.message || "—",
        time: m.time || m.createdAt || "—",
        isSelf: m.isSelf || false,
        color: m.color || "#0D9488",
      }));
      setMessages(mapped);
    } catch {
      setMessages([]);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      resolveIdentity().then(setUser).catch(() => {});
      fetchMessages();
    }
  }, [visible, fetchMessages]);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 65,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      slideAnim.setValue(40);
      fadeAnim.setValue(0);
    }
  }, [visible, slideAnim, fadeAnim]);

  const handleSend = () => {
    if (!inputMessage.trim()) return;
    const newMsg = {
      id: `cm_${Date.now()}`,
      sender: user?.name ? `${user.name} (You)` : "You",
      role: user?.role || "",
      text: inputMessage.trim(),
      time: "Just now",
      isSelf: true,
      color: "#0D9488",
    };
    setMessages([...messages, newMsg]);
    setInputMessage("");
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.overlay}
      >
        <Animated.View
          style={[
            styles.modalContainer,
            {
              backgroundColor: colors.cardBackground || "#FFFFFF",
              borderColor: colors.divider || "rgba(0,0,0,0.1)",
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
              <View style={[styles.iconWrap, { backgroundColor: "#0D948818" }]}>
                <Icon name="account-group-outline" size={24} color="#0D9488" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { color: colors.primaryText }]}>Faculty Community Forum</Text>
                <Text style={[styles.subtitle, { color: colors.secondaryText }]}>
                  Inter-departmental announcements & Academic Council
                </Text>
              </View>
            </View>

            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Icon name="close-circle-outline" size={24} color={colors.secondaryText} />
            </TouchableOpacity>
          </View>

          {/* Messages Feed */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.messagesScroll}
          >
            {messages.map((item) => (
              <View
                key={item.id}
                style={[
                  styles.messageBubble,
                  item.isSelf
                    ? [styles.selfBubble, { backgroundColor: colors.primaryAccent }]
                    : [styles.peerBubble, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }],
                ]}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                  <Text
                    style={[
                      styles.senderName,
                      { color: item.isSelf ? "rgba(255,255,255,0.9)" : item.color },
                    ]}
                  >
                    {item.sender}
                  </Text>
                  <Text
                    style={[
                      styles.timeText,
                      { color: item.isSelf ? "rgba(255,255,255,0.7)" : colors.disabledText },
                    ]}
                  >
                    {item.time}
                  </Text>
                </View>

                <Text
                  style={[
                    styles.messageText,
                    { color: item.isSelf ? "#FFFFFF" : colors.primaryText },
                  ]}
                >
                  {item.text}
                </Text>
              </View>
            ))}
          </ScrollView>

          {/* Input Bar */}
          <View style={[styles.inputBar, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
            <TextInput
              style={[styles.textInput, { color: colors.primaryText }]}
              placeholder="Post message to faculty forum..."
              placeholderTextColor={colors.disabledText}
              value={inputMessage}
              onChangeText={setInputMessage}
            />
            <TouchableOpacity
              style={[
                styles.sendBtn,
                { backgroundColor: inputMessage.trim() ? colors.primaryAccent : colors.divider },
              ]}
              onPress={handleSend}
              disabled={!inputMessage.trim()}
            >
              <Icon name="send" size={16} color={inputMessage.trim() ? "#FFFFFF" : colors.disabledText} />
            </TouchableOpacity>
          </View>
        </Animated.View>
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
    messagesScroll: {
      gap: 10,
      paddingVertical: 6,
    },
    messageBubble: {
      borderRadius: 14,
      padding: 12,
      maxWidth: "92%",
    },
    selfBubble: {
      alignSelf: "flex-end",
      borderBottomRightRadius: 2,
    },
    peerBubble: {
      alignSelf: "flex-start",
      borderWidth: 1,
      borderBottomLeftRadius: 2,
    },
    senderName: {
      fontSize: 11,
      fontWeight: "800",
    },
    timeText: {
      fontSize: 9.5,
      fontWeight: "500",
      marginLeft: 8,
    },
    messageText: {
      fontSize: 12.5,
      lineHeight: 17,
      fontWeight: "500",
      marginTop: 2,
    },
    inputBar: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 12,
      borderWidth: 1,
      paddingHorizontal: 12,
      paddingVertical: 6,
      marginTop: 12,
      gap: 8,
    },
    textInput: {
      flex: 1,
      fontSize: 12.5,
      paddingVertical: 4,
    },
    sendBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      justifyContent: "center",
      alignItems: "center",
    },
  });
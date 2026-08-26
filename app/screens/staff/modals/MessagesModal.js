// modals/MessagesModal.js
import React, { useRef, useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  Animated,
  Easing,
  TextInput,
  FlatList,
  ActivityIndicator,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { getMessagesList } from "../../../services/dataService";

// Fallback shown only if the server is unreachable
const FALLBACK_MESSAGES = [
  {
    id: "offline",
    name: "📡 EduNex Server",
    text: "Could not reach the server. Showing cached view.",
    time: "",
    unread: false,
  },
];

const formatTime = (value) => {
  try {
    const d = value?.toDate ? value.toDate() : new Date(value);
    if (!isNaN(d)) {
      return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    }
  } catch {}
  return "";
};

const mapMessage = (m) => ({
  id: String(m.id || m._id || Math.random()),
  name: m.senderName || m.from || m.name || m.title || "Unknown sender",
  text: m.message || m.text || m.body || m.content || "",
  time: formatTime(m.createdAt || m.time || m.date),
  unread: m.read === false || m.unread === true,
});

const MessagesModal = ({ visible, onClose, colors }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const [search, setSearch] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadMessages = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getMessagesList({ limit: 50 });
      const mapped = Array.isArray(list) ? list.map(mapMessage) : [];
      setMessages(mapped.length > 0 ? mapped : FALLBACK_MESSAGES);
    } catch (err) {
      console.warn("MessagesModal load error:", err?.message || err);
      setMessages(FALLBACK_MESSAGES);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      loadMessages();
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
          easing: Easing.out(Easing.ease),
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      slideAnim.setValue(50);
    }
  }, [visible, fadeAnim, slideAnim, loadMessages]);

  // 🔍 Filter messages
  const handleSearch = (text) => {
    setSearch(text);
  };

  const filteredMessages = messages.filter((msg) =>
    msg.name.toLowerCase().includes(search.toLowerCase())
  );

  // 💬 Render single message
  const renderMessage = ({ item }) => (
    <View
      style={[
        styles.messageCard,
        item.unread && { backgroundColor: "#3498DB10" },
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text style={[styles.senderName, { color: colors.primaryText }]}>
          {item.name}
        </Text>
        <Text
          style={[
            styles.messageText,
            { color: colors.secondaryText },
          ]}
          numberOfLines={1}
        >
          {item.text}
        </Text>
      </View>
      <View style={styles.timeContainer}>
        <Text style={styles.timeText}>{item.time}</Text>
        {item.unread && <View style={styles.unreadDot} />}
      </View>
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="none">
      <Animated.View
        style={[
          styles.modalOverlay,
          { opacity: fadeAnim, backgroundColor: "rgba(0,0,0,0.45)" },
        ]}
      >
        <Animated.View
          style={[
            styles.modalContainer,
            {
              backgroundColor: colors.cardBackground,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconBadge}>
              <Icon name="email-outline" size={32} color="#3498DB" />
            </View>
            <Text style={[styles.title, { color: "#3498DB" }]}>
              Messages
            </Text>
          </View>

          <Text style={[styles.subtitle, { color: colors.secondaryText }]}>
            💬 Check your latest messages from AI & DS students and faculty.
          </Text>

          {/* Search Bar */}
          <View style={styles.searchBar}>
            <Icon name="magnify" size={20} color="#aaa" />
            <TextInput
              placeholder="Search messages..."
              value={search}
              onChangeText={handleSearch}
              style={[styles.searchInput, { color: colors.primaryText }]}
              placeholderTextColor="#888"
            />
          </View>

          {/* Messages List */}
          {loading ? (
            <ActivityIndicator
              size="large"
              color="#3498DB"
              style={{ marginTop: 30, marginBottom: 30 }}
            />
          ) : (
            <FlatList
              data={filteredMessages}
              keyExtractor={(item) => item.id}
              renderItem={renderMessage}
              showsVerticalScrollIndicator={false}
              style={{ marginTop: 10, maxHeight: 300 }}
              ListEmptyComponent={
                <Text
                  style={{
                    color: colors.secondaryText,
                    textAlign: "center",
                    marginTop: 40,
                  }}
                >
                  No messages found 😕
                </Text>
              }
            />
          )}

          {/* Close Button */}
          <Pressable
            style={[styles.closeButton, { backgroundColor: "#3498DB" }]}
            onPress={onClose}
          >
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    width: "90%",
    borderRadius: 20,
    padding: 22,
    elevation: 10,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 10,
  },
  iconBadge: {
    backgroundColor: "#3498DB15",
    padding: 10,
    borderRadius: 50,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
  },
  subtitle: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 15,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#3498DB10",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#3498DB30",
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
  },
  messageCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#3498DB08",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#3498DB20",
  },
  senderName: {
    fontSize: 15,
    fontWeight: "600",
  },
  messageText: {
    fontSize: 13,
    marginTop: 2,
  },
  timeContainer: {
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 4,
  },
  timeText: {
    fontSize: 11,
    color: "#777",
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 10,
    backgroundColor: "#3498DB",
  },
  closeButton: {
    marginTop: 15,
    alignSelf: "center",
    paddingVertical: 10,
    paddingHorizontal: 28,
    borderRadius: 10,
    elevation: 3,
  },
  closeText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
    letterSpacing: 0.4,
  },
});

export default MessagesModal;
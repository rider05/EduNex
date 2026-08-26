import React, { useState, useRef, useEffect } from "react";
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
  Animated,
  SafeAreaView,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";

export default function CommunityModal({ visible, onClose, colors }) {
  const slideAnim = useRef(new Animated.Value(100)).current;
  const [messages, setMessages] = useState([
    { id: "1", sender: "Dept. Office", text: "Faculty meeting at 10:00 AM, 15 Nov." },
    { id: "2", sender: "HOD", text: "Submit syllabus reports by 17 Nov." },
    { id: "3", sender: "Principal", text: "Staff appreciation week begins 22 Nov!" },
  ]);
  const [inputMessage, setInputMessage] = useState("");

  useEffect(() => {
    if (visible) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      slideAnim.setValue(100);
    }
  }, [visible, slideAnim]);

  const handleSend = () => {
    if (inputMessage.trim() === "") return;
    const newMsg = {
      id: Date.now().toString(),
      sender: "You",
      text: inputMessage.trim(),
    };
    setMessages((prev) => [newMsg, ...prev]);
    setInputMessage("");
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none">
      <Animated.View
        style={[
          styles.container,
          { backgroundColor: colors.primaryBackground, transform: [{ translateY: slideAnim }] },
        ]}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
        >
          <SafeAreaView style={{ flex: 1 }}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.primaryAccent }]}>
              <View style={styles.headerLeft}>
                <Icon name="account-group-outline" size={26} color="#fff" />
                <Text style={styles.headerTitle}>Community Announcements</Text>
              </View>
              <TouchableOpacity onPress={onClose}>
                <Icon name="close" size={26} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Message List */}
            <FlatList
              data={messages}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.messageContainer}
              inverted
              renderItem={({ item }) => (
                <View
                  style={[
                    styles.messageBubble,
                    {
                      backgroundColor:
                        item.sender === "You" ? colors.primaryAccent : colors.cardBackground,
                      alignSelf: item.sender === "You" ? "flex-end" : "flex-start",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.senderName,
                      { color: item.sender === "You" ? "#fff" : colors.primaryAccent },
                    ]}
                  >
                    {item.sender}
                  </Text>
                  <Text
                    style={[
                      styles.messageText,
                      { color: item.sender === "You" ? "#fff" : colors.primaryText },
                    ]}
                  >
                    {item.text}
                  </Text>
                </View>
              )}
            />

            {/* Input Bar */}
            <View style={[styles.inputWrapper, { backgroundColor: colors.cardBackground }]}>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: colors.primaryText,
                    borderColor: colors.primaryAccent,
                  },
                ]}
                placeholder="Type a group announcement..."
                placeholderTextColor={colors.secondaryText}
                value={inputMessage}
                onChangeText={setInputMessage}
              />
              <TouchableOpacity
                onPress={handleSend}
                style={[styles.sendButton, { backgroundColor: colors.primaryAccent }]}
              >
                <Icon name="send" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
    height: "100%",
    position: "absolute",
    bottom: 0,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    overflow: "hidden",
    elevation: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 18,
    elevation: 6,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  messageContainer: {
    flexGrow: 1,
    padding: 15,
    paddingBottom: 100,
  },
  messageBubble: {
    borderRadius: 14,
    padding: 10,
    marginVertical: 6,
    maxWidth: "80%",
    elevation: 2,
  },
  senderName: {
    fontWeight: "700",
    fontSize: 12,
    marginBottom: 2,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: "#ddd",
    elevation: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: 15,
  },
  sendButton: {
    marginLeft: 10,
    padding: 10,
    borderRadius: 10,
    elevation: 3,
  },
});
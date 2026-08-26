import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../../../context/ThemeContext";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";

export default function FeedbackModal({ visible, onClose }) {
  const { colors } = useTheme();
  if (!visible) return null;

  const feedbackExamples = [
    "Request for parent–teacher meeting schedule",
    "Feedback on cafeteria food quality",
    "Suggestion for better communication portal",
  ];

  const isDark = colors.mode === "dark";
  const sectionBg = isDark
    ? colors.cardBackground + "AA" // slightly translucent for dark mode depth
    : colors.primaryAccent + "11"; // light tint for light mode

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View
          style={[
            styles.modalContainer,
            { backgroundColor: colors.cardBackground },
          ]}
        >
          {/* Header */}
          <LinearGradient
            colors={[colors.primaryAccent, colors.primaryAccent + "CC"]}
            style={styles.header}
          >
            <Icon name="message-text-outline" size={24} color="#fff" />
            <Text style={styles.headerText}>Feedback & Queries</Text>
            <TouchableOpacity onPress={onClose}>
              <Icon name="close-circle" size={24} color="#fff" />
            </TouchableOpacity>
          </LinearGradient>

          {/* Body */}
          <ScrollView
            contentContainerStyle={styles.body}
            showsVerticalScrollIndicator={false}
          >
            {/* Info Card */}
            <View
              style={[
                styles.sectionCard,
                {
                  backgroundColor: sectionBg,
                  borderColor: colors.primaryAccent + "33",
                },
              ]}
            >
              <Text
                style={[
                  styles.sectionText,
                  { color: colors.primaryText },
                ]}
              >
                Share your valuable feedback or raise queries regarding your
                child’s academics, hostel, or campus life. Your opinions help us
                improve and enhance the learning experience.
              </Text>
            </View>

            {/* Example Topics */}
            <View
              style={[
                styles.sectionCard,
                {
                  backgroundColor: sectionBg,
                  borderColor: colors.primaryAccent + "33",
                },
              ]}
            >
              <View style={styles.sectionHeader}>
                <Icon
                  name="lightbulb-on-outline"
                  size={20}
                  color={colors.primaryAccent}
                />
                <Text
                  style={[
                    styles.sectionTitle,
                    { color: colors.primaryAccent },
                  ]}
                >
                  Example Topics
                </Text>
              </View>

              {feedbackExamples.map((item, index) => (
                <View key={index} style={styles.exampleRow}>
                  <Icon
                    name="circle-small"
                    size={20}
                    color={colors.primaryAccent}
                  />
                  <Text
                    style={[
                      styles.exampleText,
                      { color: colors.primaryText },
                    ]}
                  >
                    {item}
                  </Text>
                </View>
              ))}
            </View>

            {/* Footer Note */}
            <Text
              style={[
                styles.note,
                { color: colors.secondaryText, textAlign: "center" },
              ]}
            >
              💡 Your feedback helps us create a better environment for every
              student.
            </Text>
          </ScrollView>

          {/* Close Button */}
          <TouchableOpacity
            onPress={onClose}
            style={[
              styles.closeButton,
              { backgroundColor: colors.primaryAccent },
            ]}
            activeOpacity={0.85}
          >
            <Icon name="check-circle-outline" size={18} color="#fff" />
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// 🎨 Styles
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },

  modalContainer: {
    width: "90%",
    borderRadius: 20,
    overflow: "hidden",
    elevation: 10,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },

  headerText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 17,
  },

  body: {
    padding: 16,
  },

  sectionCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    shadowColor: "#00000020",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 3,
  },

  sectionText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },

  sectionTitle: {
    fontWeight: "700",
    fontSize: 15,
    marginLeft: 6,
  },

  exampleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },

  exampleText: {
    fontSize: 14,
    marginLeft: 4,
    flexShrink: 1,
  },

  note: {
    fontSize: 13,
    marginTop: 6,
    fontStyle: "italic",
  },

  closeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },

  closeText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
    marginLeft: 6,
  },
});
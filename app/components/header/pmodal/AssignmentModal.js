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

export default function AssignmentModal({ visible, onClose }) {
  const { colors } = useTheme();
  if (!visible) return null;

  const assignments = [
    {
      id: 1,
      title: "Physics Lab Report Submission",
      date: "Nov 15, 2025",
      type: "Assignment",
    },
    {
      id: 2,
      title: "Mathematics Midterm Exam",
      date: "Dec 1, 2025",
      type: "Exam",
    },
    {
      id: 3,
      title: "English Presentation Slides",
      date: "Dec 10, 2025",
      type: "Assignment",
    },
  ];

  const isDark = colors.mode === "dark";
  const subCardBg = isDark
    ? colors.cardBackground + "AA"
    : colors.primaryAccent + "11"; // soft tint background like FeesModal

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
            style={styles.headerContainer}
          >
            <Icon name="calendar-text-outline" size={22} color="#fff" />
            <Text style={styles.headerText}>Assignments & Exams</Text>
            <TouchableOpacity onPress={onClose}>
              <Icon name="close-circle" size={22} color="#fff" />
            </TouchableOpacity>
          </LinearGradient>

          {/* Body */}
          <View
            style={[
              styles.innerCard,
              { backgroundColor: subCardBg, borderColor: colors.primaryAccent + "22" },
            ]}
          >
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {assignments.map((item) => (
                <View
                  key={item.id}
                  style={[
                    styles.assignmentBox,
                    {
                      backgroundColor: colors.cardBackground,
                      borderColor: colors.primaryAccent + "22",
                    },
                  ]}
                >
                  <View style={styles.assignmentHeader}>
                    <Icon
                      name={
                        item.type === "Exam"
                          ? "book-open-variant"
                          : "file-document-outline"
                      }
                      size={20}
                      color={colors.primaryAccent}
                      style={{ marginRight: 10 }}
                    />
                    <Text
                      style={[
                        styles.assignmentTitle,
                        { color: colors.primaryText },
                      ]}
                    >
                      {item.title}
                    </Text>
                  </View>

                  <View style={styles.assignmentFooter}>
                    <View
                      style={[
                        styles.dateBadge,
                        { backgroundColor: colors.primaryAccent },
                      ]}
                    >
                      <Icon name="calendar" size={12} color="#fff" />
                      <Text style={styles.dateText}>{item.date}</Text>
                    </View>

                    <Text
                      style={[
                        styles.typeLabel,
                        {
                          color:
                            item.type === "Exam"
                              ? "#FF6B6B"
                              : "#2ECC71",
                        },
                      ]}
                    >
                      {item.type}
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>

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
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
  },

  headerContainer: {
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

  innerCard: {
    margin: 14,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: "#00000010",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },

  scrollContent: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    maxHeight: 280,
  },

  assignmentBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    shadowColor: "#00000015",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 3,
    elevation: 2,
  },

  assignmentHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },

  assignmentTitle: {
    fontSize: 15,
    fontWeight: "600",
    flexShrink: 1,
  },

  assignmentFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 5,
  },

  dateBadge: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },

  dateText: {
    color: "#fff",
    fontSize: 12,
    marginLeft: 5,
  },

  typeLabel: {
    fontWeight: "700",
    fontSize: 13,
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
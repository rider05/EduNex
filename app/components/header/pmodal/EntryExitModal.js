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

export default function EntryExitModal({ visible, onClose }) {
  const { colors } = useTheme();
  if (!visible) return null;

  const isDark = colors.mode === "dark";
  const sectionBg = isDark
    ? colors.cardBackground + "AA"
    : colors.primaryAccent + "11";

  const entries = [
    { time: "08:55 AM", action: "Entered Main Gate" },
    { time: "09:02 AM", action: "Entered Classroom Block" },
    { time: "12:45 PM", action: "Exited for Lunch" },
    { time: "01:20 PM", action: "Re-entered Campus" },
    { time: "04:30 PM", action: "Exited Campus" },
    { time: "05:00 PM", action: "Returned for Extra Class" },
    { time: "06:15 PM", action: "Exited Campus" },
  ];

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
            <Icon name="door-open" size={22} color="#fff" />
            <Text style={styles.headerText}>Campus Entry / Exit Log</Text>
            <TouchableOpacity onPress={onClose}>
              <Icon name="close-circle" size={22} color="#fff" />
            </TouchableOpacity>
          </LinearGradient>

          {/* Scrollable Content */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollBody}
          >
            {/* Inner Section */}
            <View
              style={[
                styles.innerCard,
                {
                  backgroundColor: sectionBg,
                  borderColor: colors.primaryAccent + "22",
                },
              ]}
            >
              {entries.map((entry, index) => (
                <View
                  key={index}
                  style={[
                    styles.entryBox,
                    {
                      backgroundColor: colors.cardBackground,
                      borderColor: colors.primaryAccent + "22",
                    },
                  ]}
                >
                  <View style={styles.entryRow}>
                    <Icon
                      name={
                        entry.action.toLowerCase().includes("enter")
                          ? "login-variant"
                          : "logout-variant"
                      }
                      size={18}
                      color={
                        entry.action.toLowerCase().includes("enter")
                          ? "#2ECC71"
                          : "#FF6B6B"
                      }
                    />
                    <Text style={[styles.timeText, { color: colors.primaryText }]}>
                      {entry.time}
                    </Text>
                  </View>
                  <Text
                    style={[styles.actionText, { color: colors.secondaryText }]}
                  >
                    {entry.action}
                  </Text>
                </View>
              ))}
            </View>

            {/* Footer Note */}
            <Text style={[styles.note, { color: colors.secondaryText }]}>
              🕒 Logs update in real-time for accurate attendance tracking.
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
    maxHeight: "85%",
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

  scrollBody: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },

  innerCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    marginBottom: 14,
    shadowColor: "#00000010",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },

  entryBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    shadowColor: "#00000015",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 3,
    elevation: 2,
  },

  entryRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
    gap: 8,
  },

  timeText: {
    fontSize: 15,
    fontWeight: "600",
  },

  actionText: {
    fontSize: 13,
    opacity: 0.9,
  },

  note: {
    fontSize: 13,
    textAlign: "center",
    marginTop: 4,
    marginBottom: 12,
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
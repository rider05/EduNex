import React, { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
} from "react-native";
import { useTheme } from "../../../context/ThemeContext";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { LinearGradient } from "expo-linear-gradient";

export default function FeesModal({ visible, onClose }) {
  const { colors } = useTheme();
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  const [daysLeft, setDaysLeft] = useState(7);

  useEffect(() => {
    if (visible) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();

      const dueDate = new Date("2025-11-30");
      const today = new Date();
      const diff = Math.max(
        0,
        Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24))
      );
      setDaysLeft(diff);
    } else {
      fadeAnim.setValue(0);
    }
  }, [visible, fadeAnim]);

  // Color by urgency
  const getDueColor = () => {
    if (daysLeft > 10) return "#2ECC71";
    if (daysLeft > 5) return "#F1C40F";
    if (daysLeft > 2) return "#E67E22";
    return "#E74C3C";
  };

  const dueColor = getDueColor();

  return (
    <Modal visible={visible} transparent animationType="none">
      <Animated.View
        style={[
          styles.overlay,
          {
            opacity: fadeAnim,
            backgroundColor: "rgba(0,0,0,0.5)",
          },
        ]}
      >
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
            <Icon name="cash-multiple" size={32} color="#fff" />
            <Text style={styles.headerText}>Fees Overview</Text>
            <TouchableOpacity onPress={onClose}>
              <Icon name="close-circle" size={26} color="#fff" />
            </TouchableOpacity>
          </LinearGradient>

          {/* Main Info */}
          <View style={styles.body}>
            <View style={styles.section}>
              <View
                style={[
                  styles.iconBox,
                  { backgroundColor: colors.primaryAccent + "22" },
                ]}
              >
                <Icon name="currency-inr" size={24} color={colors.primaryAccent} />
              </View>
              <View style={styles.sectionText}>
                <Text style={[styles.title, { color: colors.primaryText }]}>
                  Total Pending Fees
                </Text>
                <Text style={[styles.value, { color: dueColor }]}>₹15,000</Text>
              </View>
            </View>

            <View
              style={[
                styles.separator,
                { backgroundColor: colors.secondaryText + "22" },
              ]}
            />

            <View style={styles.section}>
              <View
                style={[
                  styles.iconBox,
                  { backgroundColor: colors.primaryAccent + "22" },
                ]}
              >
                <Icon name="calendar" size={24} color={colors.primaryAccent} />
              </View>
              <View style={styles.sectionText}>
                <Text style={[styles.title, { color: colors.primaryText }]}>
                  Due Date
                </Text>
                <Text style={[styles.value, { color: colors.secondaryText }]}>
                  30 Nov 2025
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.separator,
                { backgroundColor: colors.secondaryText + "22" },
              ]}
            />

            <View style={styles.section}>
              <View
                style={[
                  styles.iconBox,
                  { backgroundColor: dueColor + "22" },
                ]}
              >
                <Icon name="alert-decagram-outline" size={24} color={dueColor} />
              </View>
              <View style={styles.sectionText}>
                <Text style={[styles.title, { color: colors.primaryText }]}>
                  Payment Status
                </Text>
                <Text style={[styles.value, { color: dueColor }]}>
                  {daysLeft > 0
                    ? `${daysLeft} day${daysLeft > 1 ? "s" : ""} left`
                    : "Overdue!"}
                </Text>
              </View>
            </View>

            {/* Subtle Progress Bar */}
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <Animated.View
                  style={[
                    styles.progressFill,
                    {
                      backgroundColor: dueColor,
                      width: `${Math.min(100, ((15 - daysLeft) / 15) * 100)}%`,
                    },
                  ]}
                />
              </View>
            </View>

            {/* Note */}
            <Text style={[styles.note, { color: colors.secondaryText }]}>
              💡 Pay your fees before the due date to avoid penalties.
            </Text>
          </View>

          {/* Close Button */}
          <TouchableOpacity
            style={[styles.closeButton, { backgroundColor: colors.primaryAccent }]}
            onPress={onClose}
            activeOpacity={0.8}
          >
            <Icon name="check-circle-outline" size={18} color="#fff" />
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
}

// 🎨 Styles
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    width: "85%",
    borderRadius: 18,
    overflow: "hidden",
    elevation: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  headerText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 18,
  },
  body: {
    padding: 15,
  },
  section: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 10,
  },
  iconBox: {
    width: 45,
    height: 45,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionText: {
    marginLeft: 12,
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 2,
  },
  value: {
    fontSize: 16,
    fontWeight: "700",
  },
  separator: {
    height: 1,
    marginHorizontal: 5,
    marginVertical: 4,
    borderRadius: 1,
  },
  progressContainer: {
    marginTop: 8,
    width: "100%",
  },
  progressBar: {
    width: "100%",
    height: 8,
    borderRadius: 5,
    backgroundColor: "rgba(255,255,255,0.1)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 5,
  },
  note: {
    fontSize: 13,
    textAlign: "center",
    marginTop: 10,
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
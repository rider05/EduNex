// modals/AttendanceModal.js
import React, { useRef, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  Animated,
  Easing,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";

const AttendanceModal = ({ visible, onClose, colors }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  // Animate modal entrance (fade + slide up)
  useEffect(() => {
    if (visible) {
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
  }, [visible, fadeAnim, slideAnim]);

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
              <Icon name="check-decagram" size={32} color="#27AE60" />
            </View>
            <Text style={[styles.title, { color: "#27AE60" }]}>Attendance</Text>
          </View>

          {/* Greeting */}
          <Text style={[styles.greeting, { color: colors.primaryText }]}>
            Hey there 👋, ready to mark your attendance for today’s class?
          </Text>

          {/* Class Cards */}
          <View style={styles.classCard}>
            <View style={styles.classInfo}>
              <Text style={styles.classTitle}>📘 Data Structures</Text>
              <Text style={styles.classTime}>9:00 AM - 9:45 AM</Text>
            </View>
            <Pressable style={styles.markBtn}>
              <Text style={styles.markText}>Mark</Text>
            </Pressable>
          </View>

          <View style={styles.classCard}>
            <View style={styles.classInfo}>
              <Text style={styles.classTitle}>🧪 Computer Networks</Text>
              <Text style={styles.classTime}>10:00 AM - 10:45 AM</Text>
            </View>
            <Pressable style={styles.markBtn}>
              <Text style={styles.markText}>Mark</Text>
            </Pressable>
          </View>

          {/* Closing Button */}
          <Pressable
            style={[styles.closeButton, { backgroundColor: "#27AE60" }]}
            onPress={onClose}
          >
            <Text style={styles.closeText}>Done</Text>
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
    width: "88%",
    borderRadius: 24,
    paddingVertical: 22,
    paddingHorizontal: 20,
    elevation: 8,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 3 },
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
    justifyContent: "center",
    gap: 8,
  },
  iconBadge: {
    backgroundColor: "#27AE6015",
    padding: 10,
    borderRadius: 50,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
  },
  greeting: {
    fontSize: 15,
    textAlign: "center",
    opacity: 0.8,
    marginBottom: 20,
  },
  classCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#27AE6010",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#27AE6030",
  },
  classInfo: { flex: 1 },
  classTitle: { fontSize: 16, fontWeight: "600", color: "#27AE60" },
  classTime: { fontSize: 13, color: "#555", marginTop: 2 },
  markBtn: {
    backgroundColor: "#27AE60",
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  markText: { color: "#fff", fontWeight: "700", fontSize: 13 },
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

export default AttendanceModal;
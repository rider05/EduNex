import React, { useRef, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  Animated,
  Pressable,
  StyleSheet,
  TouchableWithoutFeedback,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";

export default function WardModal({ visible, onClose, colors, data }) {
  const slideAnim = useRef(new Animated.Value(1)).current; // 1 = hidden, 0 = visible
  const fadeAnim = useRef(new Animated.Value(0)).current; // overlay fade

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 320, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, fadeAnim, slideAnim]);

  if (!visible) return null;

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 500],
  });

  return (
    <Modal transparent visible={visible} animationType="none">
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[styles.overlay, { opacity: fadeAnim }]} />
      </TouchableWithoutFeedback>

      <Animated.View
        style={[
          styles.container,
          {
            backgroundColor: colors.cardBackground,
            transform: [{ translateY }],
          },
        ]}
      >
        <View style={styles.dragHandle} />
        <View style={styles.header}>
          <Icon name="account-child-outline" size={26} color={colors.primaryAccent} />
          <Text style={[styles.title, { color: colors.primaryAccent }]}>Ward Details</Text>
        </View>

        <InfoRow label="Name" value={data.wardName} colors={colors} />
        <InfoRow label="Roll No" value={data.rollNo} colors={colors} />
        <InfoRow label="Department" value={data.department} colors={colors} />
        <InfoRow label="Year" value={data.year} colors={colors} />
        <InfoRow label="Section" value={data.section} colors={colors} />
        <InfoRow label="Attendance" value={data.attendance} colors={colors} />
        <InfoRow label="Grade" value={data.grade} colors={colors} />

        <Pressable
          onPress={onClose}
          style={[styles.closeButton, { backgroundColor: colors.primaryAccent }]}
        >
          <Text style={styles.closeText}>Close</Text>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

const InfoRow = ({ label, value, colors }) => (
  <View style={styles.row}>
    <Text style={[styles.label, { color: colors.secondaryText }]}>{label}</Text>
    <Text style={[styles.value, { color: colors.primaryText }]}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  container: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 25,
    elevation: 10,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  dragHandle: {
    width: 45,
    height: 5,
    backgroundColor: "#ccc",
    borderRadius: 3,
    alignSelf: "center",
    marginBottom: 10,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  title: { fontSize: 18, fontWeight: "700" },
  row: { flexDirection: "row", justifyContent: "space-between", marginVertical: 6 },
  label: { fontSize: 14, fontWeight: "600", opacity: 0.8 },
  value: { fontSize: 15, fontWeight: "700" },
  closeButton: {
    alignSelf: "center",
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 50,
    borderRadius: 10,
  },
  closeText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
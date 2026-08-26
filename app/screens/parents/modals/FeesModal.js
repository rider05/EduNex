import React, { useRef, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  Animated,
  Pressable,
  TouchableWithoutFeedback,
  StyleSheet,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";

export default function FeesModal({ visible, onClose, colors, data = {} }) {
  const slideAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // ✅ Animate modal in/out smoothly
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

  // ✅ Prevent rendering until visible
  if (!visible) return null;

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 500],
  });

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      {/* Fade overlay */}
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[styles.overlay, { opacity: fadeAnim }]} />
      </TouchableWithoutFeedback>

      {/* Sliding modal content */}
      <Animated.View
        style={[
          styles.container,
          {
            backgroundColor: colors.cardBackground,
            transform: [{ translateY }],
          },
        ]}
      >
        {/* Drag Handle */}
        <View style={styles.dragHandle} />

        {/* Header */}
        <View style={styles.header}>
          <Icon name="cash-multiple" size={26} color="#E74C3C" />
          <Text style={[styles.title, { color: "#E74C3C" }]}>Fees Summary</Text>
        </View>

        {/* Info Rows */}
        <InfoRow label="Total Fees" value={data.totalFees || "₹ 0"} colors={colors} />
        <InfoRow label="Paid Fees" value={data.paidFees || "₹ 0"} colors={colors} />
        <InfoRow label="Pending Fees" value={data.feesDue || "₹ 0"} colors={colors} />

        {/* Buttons */}
        <Pressable
          style={[styles.payButton, { backgroundColor: "#E74C3C" }]}
          onPress={() => console.log("Navigate to payment screen")}
        >
          <Text style={styles.payText}>Pay Now</Text>
        </Pressable>

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

// ✅ Safe info row component
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
    shadowOffset: { width: 0, height: 3 },
  },
  dragHandle: {
    width: 45,
    height: 5,
    backgroundColor: "#ccc",
    borderRadius: 3,
    alignSelf: "center",
    marginBottom: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 15,
  },
  title: { fontSize: 18, fontWeight: "700" },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 6,
  },
  label: { fontSize: 14, fontWeight: "600", opacity: 0.8 },
  value: { fontSize: 15, fontWeight: "700" },
  payButton: {
    alignSelf: "center",
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 50,
    borderRadius: 10,
    elevation: 2,
  },
  payText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  closeButton: {
    alignSelf: "center",
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 45,
    borderRadius: 10,
    elevation: 2,
  },
  closeText: { color: "#fff", fontWeight: "700" },
});
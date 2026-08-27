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

export default function ReportModal({ visible, onClose, colors, data }) {
  const slideAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

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

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 500],
  });

  const subjects = [];

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none">
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[styles.overlay, { opacity: fadeAnim }]} />
      </TouchableWithoutFeedback>

      <Animated.View
        style={[
          styles.container,
          { backgroundColor: colors.cardBackground, transform: [{ translateY }] },
        ]}
      >
        <View style={styles.dragHandle} />
        <View style={styles.header}>
          <Icon name="chart-line" size={26} color="#2ECC71" />
          <Text style={[styles.title, { color: "#2ECC71" }]}>Progress Report</Text>
        </View>

        {subjects.map((s, i) => (
          <View key={i} style={styles.subjectRow}>
            <Text style={[styles.subjectName, { color: colors.primaryText }]}>{s.name}</Text>
            <Text style={[styles.subjectGrade, { color: "#2ECC71" }]}>{s.grade}</Text>
          </View>
        ))}

        <View style={styles.cgpaRow}>
          <Text style={[styles.cgpaLabel, { color: colors.secondaryText }]}>CGPA</Text>
          <Text style={[styles.cgpaValue, { color: "#2ECC71" }]}>{data.cgpa}</Text>
        </View>

        <Pressable onPress={onClose} style={[styles.closeButton, { backgroundColor: "#2ECC71" }]}>
          <Text style={styles.closeText}>Close</Text>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { position: "absolute", width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.4)" },
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
  dragHandle: { width: 45, height: 5, backgroundColor: "#ccc", borderRadius: 3, alignSelf: "center", marginBottom: 10 },
  header: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 15 },
  title: { fontSize: 18, fontWeight: "700" },
  subjectRow: { flexDirection: "row", justifyContent: "space-between", marginVertical: 6 },
  subjectName: { fontSize: 15, fontWeight: "600" },
  subjectGrade: { fontSize: 15, fontWeight: "700" },
  cgpaRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 15 },
  cgpaLabel: { fontSize: 15, fontWeight: "600" },
  cgpaValue: { fontSize: 18, fontWeight: "800" },
  closeButton: { alignSelf: "center", marginTop: 20, paddingVertical: 10, paddingHorizontal: 50, borderRadius: 10 },
  closeText: { color: "#fff", fontWeight: "700" },
});
import React, { useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Animated,
  Pressable,
} from "react-native";

export default function AssignmentModal({ visible, onClose, colors }) {
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 6,
          tension: 80,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 0.8,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, fadeAnim, scaleAnim]);

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none">
      <Animated.View
        style={[
          styles.overlay,
          {
            opacity: fadeAnim,
          },
        ]}
      >
        <Animated.View
          style={[
            styles.cardContainer,
            {
              backgroundColor: colors.cardBackground,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <Text style={[styles.title, { color: colors.primaryText }]}>
            📘 Assignment Summary
          </Text>

          <View style={styles.divider} />

          <View style={styles.statRow}>
            <Text style={[styles.statLabel, { color: colors.secondaryText }]}>
              Total Assignments:
            </Text>
            <Text style={[styles.statValue, { color: colors.primaryAccent }]}>
              12
            </Text>
          </View>

          <View style={styles.statRow}>
            <Text style={[styles.statLabel, { color: colors.secondaryText }]}>
              Pending Review:
            </Text>
            <Text style={[styles.statValue, { color: "#E67E22" }]}>3</Text>
          </View>

          <View style={styles.statRow}>
            <Text style={[styles.statLabel, { color: colors.secondaryText }]}>
              Completed:
            </Text>
            <Text style={[styles.statValue, { color: "#27AE60" }]}>9</Text>
          </View>

          <View style={[styles.divider, { marginVertical: 10 }]} />

          <Text style={[styles.footerText, { color: colors.secondaryText }]}>
            Overall Submission Rate:{" "}
            <Text style={{ color: colors.primaryAccent, fontWeight: "700" }}>
              85%
            </Text>
          </Text>

          <Pressable
            onPress={onClose}
            style={[styles.btn, { backgroundColor: colors.primaryAccent }]}
          >
            <Text style={styles.btnText}>Close</Text>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  cardContainer: {
    width: "85%",
    borderRadius: 20,
    padding: 25,
    elevation: 8,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 10,
  },
  divider: {
    height: 1,
    backgroundColor: "#ddd",
    marginVertical: 8,
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 4,
  },
  statLabel: {
    fontSize: 15,
  },
  statValue: {
    fontSize: 15,
    fontWeight: "700",
  },
  footerText: {
    textAlign: "center",
    marginBottom: 15,
    fontSize: 14,
  },
  btn: {
    alignSelf: "center",
    paddingVertical: 10,
    paddingHorizontal: 30,
    borderRadius: 10,
    elevation: 2,
  },
  btnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
});
import React, { useEffect, useRef } from "react";
import { View, Text, Animated, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function SuccessAnimation() {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const iconScaleAnim = useRef(new Animated.Value(0.5)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let hideTimer;

    // PLAY ANIMATION IMMEDIATELY
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 5,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.spring(iconScaleAnim, {
        toValue: 1,
        friction: 3,
        tension: 60,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      hideTimer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(opacityAnim, {
            toValue: 0,
            duration: 250,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 0,
            duration: 250,
            useNativeDriver: true,
          }),
          Animated.timing(iconScaleAnim, {
            toValue: 0.5,
            duration: 250,
            useNativeDriver: true,
          }),
        ]).start();
      }, 1400);
    });

    return () => clearTimeout(hideTimer);
  }, [iconScaleAnim, opacityAnim, scaleAnim]);

  return (
    <View style={styles.overlay} pointerEvents="none">
      <Animated.View
        style={[
          styles.container,
          { opacity: opacityAnim, transform: [{ scale: scaleAnim }] },
        ]}
      >
        <View style={styles.circle}>
          <Animated.View style={{ transform: [{ scale: iconScaleAnim }] }}>
            <Ionicons
              name="checkmark-circle-outline"
              size={80}
              color="#4BB543"
            />
          </Animated.View>
        </View>

        <Text style={styles.successText}>User Added Successfully!</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 999,
  },
  container: {
    backgroundColor: "#222",
    borderRadius: 25,
    paddingVertical: 30,
    paddingHorizontal: 50,
    borderColor: "#3bb14a",
    borderWidth: 1,
    alignItems: "center",
  },
  circle: {
    backgroundColor: "rgba(75,181,67,0.25)",
    borderRadius: 75,
    padding: 24,
    marginBottom: 15,
  },
  successText: {
    color: "#d2ffd2",
    fontSize: 20,
    fontWeight: "700",
    textShadowColor: "rgba(75,181,67,0.7)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
});
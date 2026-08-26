import React, { useRef, useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Animated,
  ScrollView,
  PanResponder,
  Dimensions,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { useTheme } from "../../../context/ThemeContext";
import { api } from "../../../services/api";

const { height } = Dimensions.get("window");
const CLOSE_THRESHOLD = 100;

function SkeletonNoticeCard({ isDarkMode }) {
  const shimmerAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, { toValue: 0.85, duration: 750, useNativeDriver: true }),
        Animated.timing(shimmerAnim, { toValue: 0.3, duration: 750, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [shimmerAnim]);

  const baseBg = isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(100,116,139,0.12)";

  return (
    <View style={skeletonStyles.cardItem}>
      <Animated.View style={[skeletonStyles.iconBox, { backgroundColor: baseBg, opacity: shimmerAnim }]} />
      <View style={skeletonStyles.textSection}>
        <Animated.View style={[skeletonStyles.titleBar, { backgroundColor: baseBg, opacity: shimmerAnim }]} />
        <Animated.View style={[skeletonStyles.textBar, { backgroundColor: baseBg, opacity: shimmerAnim }]} />
      </View>
    </View>
  );
}

const skeletonStyles = StyleSheet.create({
  cardItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  iconBox: {
    width: 45,
    height: 45,
    borderRadius: 12,
    marginRight: 12,
  },
  textSection: { flex: 1 },
  titleBar: { width: "60%", height: 15, borderRadius: 4, marginBottom: 8 },
  textBar: { width: "90%", height: 12, borderRadius: 4 },
});

export default function NotificationModal({ visible, onClose }) {
  const { colors, isDarkMode } = useTheme();
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const translateY = useRef(new Animated.Value(height)).current;

  useEffect(() => {
    if (visible) {
      setNotifications([]);
      setIsLoading(true);
      api.get("/notices", { limit: 10, sort: "-createdAt" })
        .then((res) => {
          if (res?.data && res.data.length > 0) {
            const mapped = res.data.map((n, idx) => ({
              id: n.id || idx,
              icon: n.senderRole === "admin" ? "shield-alert-outline" : "bell-ring-outline",
              color: n.isNew ? "#4F46E5" : "#64748B",
              title: n.subject || n.sender || "Campus Notice",
              text: n.message || n.text || "",
            }));
            setNotifications(mapped);
          }
        })
        .catch((e) => console.log("Notices load error:", e))
        .finally(() => setIsLoading(false));
    }
  }, [visible]);

  // animate open/close on visibility change
  useEffect(() => {
    Animated.timing(translateY, {
      toValue: visible ? 0 : height,
      duration: visible ? 350 : 250,
      useNativeDriver: true,
    }).start();
  }, [visible, translateY]);

  // only the handle (grey bar area) is draggable
  const dragDy = useRef(0);

  const handlePan = useRef(
    PanResponder.create({
      // start responder on a small vertical intent (so taps still work)
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6,
      onPanResponderMove: (_, g) => {
        // allow dragging down only
        if (g.dy > 0) {
          dragDy.current = g.dy;
          translateY.setValue(g.dy);
        }
      },
      onPanResponderRelease: () => {
        if (dragDy.current > CLOSE_THRESHOLD) {
          Animated.timing(translateY, {
            toValue: height,
            duration: 220,
            useNativeDriver: true,
          }).start(() => {
            dragDy.current = 0;
            onClose?.();
          });
        } else {
          // snap back to open
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
          }).start(() => {
            dragDy.current = 0;
          });
        }
      },
    })
  ).current;

  const styles = getStyles(colors, isDarkMode);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <Animated.View style={[styles.bottomSheet, { transform: [{ translateY }] }]}>
          {/* Pull handle (only this area is draggable) */}
          <View style={styles.handleWrapper} {...handlePan.panHandlers}>
            <View style={styles.handle} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Icon name="bell-ring-outline" size={26} color="#FFF" />
            <Text style={styles.headerTitle}>Notifications</Text>
          </View>

          {/* List (scrollable, not draggable) */}
          <ScrollView contentContainerStyle={styles.scrollContainer}>
            {isLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <SkeletonNoticeCard key={i} isDarkMode={isDarkMode} />
                ))
              : notifications.length > 0
                ? notifications.map((note) => (
                    <View key={note.id} style={styles.cardItem}>
                      <View style={[styles.iconContainer, { backgroundColor: note.color + "22" }]}>
                        <Icon name={note.icon} size={24} color={note.color} />
                      </View>
                      <View style={styles.textSection}>
                        <Text style={[styles.cardTitle, { color: isDarkMode ? "#FFF" : "#000" }]}>
                          {note.title}
                        </Text>
                        <Text style={[styles.cardText, { color: isDarkMode ? "#D3D3D3" : "#555" }]}>
                          {note.text}
                        </Text>
                      </View>
                    </View>
                  ))
                : (
                  <View style={styles.emptyState}>
                    <Icon name="bell-off-outline" size={48} color={isDarkMode ? "#555" : "#CCC"} />
                    <Text style={[styles.emptyText, { color: isDarkMode ? "#888" : "#999" }]}>
                      No notices yet
                    </Text>
                  </View>
                )
            }
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const getStyles = (colors, isDarkMode) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.35)",
      justifyContent: "flex-end",
    },
    bottomSheet: {
      backgroundColor: isDarkMode ? "rgba(25,25,35,0.96)" : "#FFFFFFEE",
      borderTopLeftRadius: 30,
      borderTopRightRadius: 30,
      paddingTop: 8,
      paddingBottom: 24,
      elevation: 20,
      shadowColor: "#000",
      shadowOpacity: 0.25,
      shadowOffset: { width: 0, height: -3 },
      shadowRadius: 8,
      borderTopWidth: 1,
      borderColor: isDarkMode ? "#333" : "#E6E6E6",
      minHeight: height * 0.6,
    },
    handleWrapper: {
      alignItems: "center",
      paddingVertical: 10, // give users space to grab
    },
    handle: {
      width: 52,
      height: 6,
      borderRadius: 3,
      backgroundColor: isDarkMode ? "#666" : "#CCC",
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
      marginTop: 8,
      marginHorizontal: 20,
      borderRadius: 14,
      paddingVertical: 10,
      gap: 8,
    },
    headerTitle: {
      color: "#FFF",
      fontSize: 17,
      fontWeight: "bold",
    },
    scrollContainer: {
      paddingHorizontal: 20,
      paddingTop: 15,
      paddingBottom: 20,
    },
    cardItem: {
      flexDirection: "row",
      alignItems: "flex-start",
      backgroundColor: isDarkMode ? "#2E2E3F" : "#F9FAFF",
      borderRadius: 14,
      padding: 12,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: isDarkMode ? "#3A3A4F" : "#E3E5F0",
      elevation: 2,
    },
    iconContainer: {
      width: 45,
      height: 45,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 12,
    },
    textSection: { flex: 1 },
    cardTitle: { fontSize: 15, fontWeight: "bold", marginBottom: 4 },
    cardText: { fontSize: 13, lineHeight: 18 },
    emptyState: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 40,
    },
    emptyText: {
      fontSize: 14,
      marginTop: 10,
    },
  });
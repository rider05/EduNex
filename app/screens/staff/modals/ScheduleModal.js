// modals/ScheduleModal.js
import React, { useRef, useEffect, useState } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  Animated,
  Easing,
  FlatList,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { getFacultySchedule } from "../../../services/dataService";

const ScheduleModal = ({ visible, onClose, colors }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const [schedule, setSchedule] = useState([]);

  useEffect(() => {
    if (visible) {
      getFacultySchedule()
        .then((list) =>
          setSchedule(
            (Array.isArray(list) ? list : []).map((s, i) => ({
              id: String(s.id ?? i),
              subject: `${s.subject || s.class || "Class"}`,
              time: s.time || "",
              room: s.room || "—",
            }))
          )
        )
        .catch(() => setSchedule([]));
    }

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

  const renderItem = ({ item }) => (
    <View style={styles.scheduleCard}>
      <View>
        <Text style={[styles.subject, { color: colors.primaryText }]}>
          {item.subject}
        </Text>
        <Text style={styles.time}>{item.time}</Text>
      </View>
      <View style={styles.roomBadge}>
        <Text style={styles.roomText}>{item.room}</Text>
      </View>
    </View>
  );

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
              <Icon name="calendar-clock" size={32} color="#9B59B6" />
            </View>
            <Text style={[styles.title, { color: "#9B59B6" }]}>{"Today's Schedule"}</Text>
          </View>

          <Text style={[styles.subtitle, { color: colors.secondaryText }]}>
            {"📅 Here's your upcoming class schedule for the day."}
          </Text>

          {/* Schedule List */}
          <FlatList
            data={schedule}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            style={{ marginTop: 10, maxHeight: 300 }}
          />

          {/* Close Button */}
          <Pressable
            style={[styles.closeButton, { backgroundColor: "#9B59B6" }]}
            onPress={onClose}
          >
            <Text style={styles.closeText}>Close</Text>
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
    width: "90%",
    borderRadius: 20,
    padding: 22,
    elevation: 10,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 10,
  },
  iconBadge: {
    backgroundColor: "#9B59B615",
    padding: 10,
    borderRadius: 50,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
  },
  subtitle: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 15,
  },
  scheduleCard: {
    backgroundColor: "#9B59B610",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#9B59B620",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  subject: {
    fontSize: 15,
    fontWeight: "600",
  },
  time: {
    fontSize: 13,
    color: "#555",
    marginTop: 2,
  },
  roomBadge: {
    backgroundColor: "#9B59B615",
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  roomText: {
    color: "#9B59B6",
    fontWeight: "700",
    fontSize: 12,
  },
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

export default ScheduleModal;
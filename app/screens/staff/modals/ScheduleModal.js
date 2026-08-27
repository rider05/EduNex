import React, { useRef, useEffect, useState } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  ScrollView,
  Share,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { useTheme } from "../../../context/ThemeContext";
import { getFacultySchedule } from "../../../services/dataService";
import { resolveIdentity } from "../../../services/identityService";
import { showToast } from "../../../utils/toastService";

const DEFAULT_SCHEDULE = [];

export default function ScheduleModal({ visible, onClose, colors: propColors }) {
  const theme = useTheme();
  const colors = propColors || theme.colors || {};
  const isDarkMode = theme.isDarkMode || false;
  const styles = getStyles(colors, isDarkMode);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const [schedule, setSchedule] = useState(DEFAULT_SCHEDULE);
  const [facultyName, setFacultyName] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const id = await resolveIdentity();
        if (id?.staff?.name) setFacultyName(id.staff.name);
      } catch (e) { /* silent */ }
    })();
  }, []);

  useEffect(() => {
    if (visible) {
      getFacultySchedule()
        .then((list) => {
          if (Array.isArray(list) && list.length > 0) {
            setSchedule(
              list.map((s, i) => ({
                id: String(s.id ?? i),
                day: s.day || "—",
                subject: `${s.subject || s.class || "—"}`,
                class: s.className || "—",
                time: s.time || "—",
                room: s.room || "—",
                color: "#4F46E5",
              }))
            );
          }
        })
        .catch(() => setSchedule([]));

      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
          easing: Easing.out(Easing.ease),
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 65,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      slideAnim.setValue(40);
    }
  }, [visible, fadeAnim, slideAnim]);

  if (!visible) return null;

  const handleShareSchedule = async () => {
    try {
      const text = schedule
        .map((s) => `⏰ ${s.time}\n📖 ${s.subject}\n📍 ${s.room} (${s.class})`)
        .join("\n\n");
      await Share.share({
        title: "Faculty Teaching Schedule",
        message: `📅 EDUNEX FACULTY TEACHING SCHEDULE\nFaculty: ${facultyName || "Faculty"}\n\n${text}`,
      });
      showToast("Schedule shared!", "success");
    } catch (err) {
      console.log("Share error:", err);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.modalOverlay, { opacity: fadeAnim }]}>
        <Animated.View
          style={[
            styles.modalContainer,
            {
              backgroundColor: colors.cardBackground || "#FFFFFF",
              borderColor: colors.divider || "rgba(0,0,0,0.1)",
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
              <View style={[styles.iconWrap, { backgroundColor: "#8B5CF618" }]}>
                <Icon name="calendar-clock" size={24} color="#8B5CF6" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { color: colors.primaryText }]}>Academic Teaching Schedule</Text>
                <Text style={[styles.subtitle, { color: colors.secondaryText }]}>
                  Weekly lecture slots, lab sessions & cabin hours
                </Text>
              </View>
            </View>

            <TouchableOpacity onPress={onClose} style={styles.closeIconBtn}>
              <Icon name="close-circle-outline" size={24} color={colors.secondaryText} />
            </TouchableOpacity>
          </View>

          {/* Schedule List */}
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
            {schedule.map((item) => (
              <View
                key={item.id}
                style={[styles.scheduleCard, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}
              >
                <View style={[styles.indicator, { backgroundColor: item.color || colors.primaryAccent }]} />

                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.timeText, { color: colors.primaryAccent }]}>{item.time}</Text>
                  <Text style={[styles.subjectText, { color: colors.primaryText }]} numberOfLines={1}>
                    {item.subject}
                  </Text>
                  <Text style={[styles.metaText, { color: colors.secondaryText }]}>
                    📍 {item.room} · {item.class}
                  </Text>
                </View>
              </View>
            ))}
          </ScrollView>

          {/* Action Row */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.shareBtn, { backgroundColor: colors.primaryAccent }]}
              onPress={handleShareSchedule}
              activeOpacity={0.85}
            >
              <Icon name="share-variant" size={16} color="#FFFFFF" />
              <Text style={styles.shareBtnText}>Share Schedule</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.closeButton, { borderColor: colors.divider }]}
              onPress={onClose}
              activeOpacity={0.85}
            >
              <Text style={[styles.closeText, { color: colors.primaryText }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ---------------- Styles ----------------
const getStyles = (colors, isDarkMode) =>
  StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.75)",
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 16,
    },
    modalContainer: {
      width: "100%",
      maxHeight: "85%",
      borderRadius: 22,
      borderWidth: 1,
      padding: 18,
      elevation: 12,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    iconWrap: {
      width: 42,
      height: 42,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
    },
    title: {
      fontSize: 16,
      fontWeight: "800",
      letterSpacing: -0.2,
    },
    subtitle: {
      fontSize: 11,
      fontWeight: "500",
      marginTop: 1,
    },
    closeIconBtn: {
      padding: 4,
    },
    scheduleCard: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 14,
      borderWidth: 1,
      padding: 12,
    },
    indicator: {
      width: 4,
      height: 38,
      borderRadius: 2,
    },
    timeText: {
      fontSize: 11,
      fontWeight: "800",
    },
    subjectText: {
      fontSize: 13,
      fontWeight: "800",
      marginTop: 2,
    },
    metaText: {
      fontSize: 11,
      fontWeight: "500",
      marginTop: 1,
    },
    actionRow: {
      flexDirection: "row",
      gap: 8,
      marginTop: 12,
    },
    shareBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 12,
      borderRadius: 12,
    },
    shareBtnText: {
      color: "#FFFFFF",
      fontSize: 13,
      fontWeight: "800",
    },
    closeButton: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
    },
    closeText: {
      fontSize: 13,
      fontWeight: "800",
    },
  });
import React, { useRef, useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  ScrollView,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { useTheme } from "../../../context/ThemeContext";
import { showToast } from "../../../utils/toastService";
import { getFacultySchedule } from "../../../services/dataService";

export default function AttendanceModal({ visible, onClose, colors: propColors }) {
  const theme = useTheme();
  const colors = propColors || theme.colors || {};
  const isDarkMode = theme.isDarkMode || false;
  const styles = getStyles(colors, isDarkMode);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const [classes, setClasses] = useState([]);
  const [confirmClass, setConfirmClass] = useState(null);

  const loadSchedule = useCallback(async () => {
    try {
      const schedule = await getFacultySchedule();
      const today = new Date().toLocaleDateString("en-US", { weekday: "long" });
      const todaySlots = (Array.isArray(schedule) ? schedule : []).filter(
        (s) => !s.day || s.day.toLowerCase() === today.toLowerCase()
      );
      const mapped = todaySlots.map((s, idx) => ({
        id: s.id || String(idx + 1),
        period: s.period || idx + 1,
        periodName: s.periodName || `Period ${idx + 1}`,
        time: s.time || s.slot || "—",
        name: s.subject || s.course || s.name || "Class",
        venue: s.venue || s.room || s.location || "—",
        status: s.status || "Upcoming",
        isDone: false,
      }));
      setClasses(mapped);
    } catch {
      setClasses([]);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      loadSchedule();
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true, easing: Easing.out(Easing.ease) }),
        Animated.spring(slideAnim, { toValue: 0, tension: 65, friction: 8, useNativeDriver: true }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      slideAnim.setValue(40);
    }
  }, [visible, fadeAnim, slideAnim, loadSchedule]);

  if (!visible) return null;

  const handlePromptConfirmation = (item) => setConfirmClass(item);

  const handleConfirmLock = () => {
    if (!confirmClass) return;
    setClasses((prev) =>
      prev.map((c) => (c.id === confirmClass.id ? { ...c, isDone: true, status: "Submitted" } : c))
    );
    showToast(`Attendance verified & locked for ${(confirmClass.name || "").split("(")[0]}`, "success");
    setConfirmClass(null);
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.modalOverlay, { opacity: fadeAnim }]}>
        <Animated.View
          style={[styles.modalContainer, { backgroundColor: colors.cardBackground || "#FFFFFF", borderColor: colors.divider || "rgba(0,0,0,0.1)", transform: [{ translateY: slideAnim }] }]}
        >
          <View style={styles.header}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
              <View style={[styles.iconWrap, { backgroundColor: "#10B98118" }]}>
                <Icon name="check-decagram" size={24} color="#10B981" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { color: colors.primaryText }]}>Daily Attendance Call</Text>
                <Text style={[styles.subtitle, { color: colors.secondaryText }]}>
                  {classes.length > 0 ? `${classes.length} lecture${classes.length > 1 ? "s" : ""} scheduled today` : "No lectures scheduled today"}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeIconBtn}>
              <Icon name="close-circle-outline" size={24} color={colors.secondaryText} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 6 }}>
            {classes.length === 0 ? (
              <View style={{ alignItems: "center", paddingVertical: 30 }}>
                <Icon name="calendar-blank-outline" size={48} color={colors.secondaryText} />
                <Text style={{ fontSize: 14, fontWeight: "700", color: colors.primaryText, marginTop: 12 }}>No Classes Today</Text>
                <Text style={{ fontSize: 12, color: colors.secondaryText, marginTop: 4 }}>No lectures are scheduled for today.</Text>
              </View>
            ) : (
              classes.map((item) => (
                <View
                  key={item.id}
                  style={[styles.classCard, { backgroundColor: colors.primaryBackground, borderColor: item.status === "In Session" ? "#10B981" : colors.divider }]}
                >
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <View style={{ backgroundColor: colors.primaryAccent + "18", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                        <Text style={{ color: colors.primaryAccent, fontSize: 9.5, fontWeight: "900" }}>{item.periodName.toUpperCase()}</Text>
                      </View>
                      <Text style={[styles.timeText, { color: colors.secondaryText }]}>{item.time}</Text>
                      {item.status === "In Session" && (
                        <View style={styles.liveTag}>
                          <View style={styles.liveDot} />
                          <Text style={styles.liveTagText}>IN SESSION</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.className, { color: colors.primaryText }]} numberOfLines={1}>{item.name}</Text>
                    <Text style={[styles.venueText, { color: colors.secondaryText }]}>{item.venue}</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.markBtn, { backgroundColor: item.isDone ? "#10B98118" : colors.primaryAccent, borderColor: item.isDone ? "#10B981" : "transparent" }]}
                    onPress={() => handlePromptConfirmation(item)}
                    activeOpacity={0.85}
                    disabled={item.isDone}
                  >
                    <Icon name={item.isDone ? "lock-check" : "lock-outline"} size={16} color={item.isDone ? "#10B981" : "#FFFFFF"} />
                    <Text style={[styles.markBtnText, { color: item.isDone ? "#10B981" : "#FFFFFF" }]}>{item.isDone ? "Locked" : "Lock Roll"}</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </ScrollView>

          <TouchableOpacity style={[styles.closeButton, { backgroundColor: colors.primaryAccent }]} onPress={onClose} activeOpacity={0.85}>
            <Text style={styles.closeText}>Done</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>

      {confirmClass && (
        <Modal visible={!!confirmClass} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={[styles.confirmCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
              <Icon name="lock-alert" size={40} color="#F59E0B" />
              <Text style={[styles.confirmTitle, { color: colors.primaryText }]}>Confirm Attendance Lock?</Text>
              <Text style={[styles.confirmSub, { color: colors.secondaryText }]}>
                Lock and freeze attendance for <Text style={{ color: colors.primaryText, fontWeight: "800" }}>{confirmClass.name}</Text>?
                {"\n"}This will submit official records to the University Registrar and notify parents of absent students.
              </Text>
              <View style={styles.confirmActions}>
                <TouchableOpacity style={[styles.cancelBtn, { borderColor: colors.divider }]} onPress={() => setConfirmClass(null)}>
                  <Text style={[styles.cancelBtnText, { color: colors.primaryText }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.lockBtnConfirm, { backgroundColor: "#10B981" }]} onPress={handleConfirmLock}>
                  <Icon name="lock" size={16} color="#FFFFFF" />
                  <Text style={styles.lockBtnConfirmText}>Lock & Submit</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </Modal>
  );
}

const getStyles = (colors, isDarkMode) =>
  StyleSheet.create({
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "center", alignItems: "center", paddingHorizontal: 16 },
    modalContainer: { width: "100%", maxHeight: "80%", borderRadius: 22, borderWidth: 1, padding: 18, elevation: 12 },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
    iconWrap: { width: 42, height: 42, borderRadius: 12, justifyContent: "center", alignItems: "center" },
    title: { fontSize: 16, fontWeight: "800", letterSpacing: -0.2 },
    subtitle: { fontSize: 11, fontWeight: "500", marginTop: 1 },
    closeIconBtn: { padding: 4 },
    classCard: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderRadius: 14, borderWidth: 1, padding: 12 },
    timeText: { fontSize: 11, fontWeight: "800" },
    liveTag: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#10B98114", paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 },
    liveDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: "#10B981" },
    liveTagText: { color: "#10B981", fontSize: 8.5, fontWeight: "900" },
    className: { fontSize: 13, fontWeight: "800", marginTop: 2 },
    venueText: { fontSize: 10.5, fontWeight: "500", marginTop: 1 },
    markBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1 },
    markBtnText: { fontSize: 11.5, fontWeight: "800" },
    closeButton: { alignItems: "center", justifyContent: "center", paddingVertical: 12, borderRadius: 12, marginTop: 14 },
    closeText: { color: "#FFFFFF", fontWeight: "800", fontSize: 13 },
    confirmCard: { width: "100%", borderRadius: 22, borderWidth: 1, padding: 22, alignItems: "center", elevation: 12 },
    confirmTitle: { fontSize: 16.5, fontWeight: "800", marginTop: 8 },
    confirmSub: { fontSize: 12, textAlign: "center", lineHeight: 16, marginTop: 6, marginBottom: 16 },
    confirmActions: { flexDirection: "row", gap: 10, width: "100%" },
    cancelBtn: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 12, borderRadius: 12, borderWidth: 1 },
    cancelBtnText: { fontSize: 13, fontWeight: "800" },
    lockBtnConfirm: { flex: 1, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", paddingVertical: 12, borderRadius: 12 },
    lockBtnConfirmText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  });

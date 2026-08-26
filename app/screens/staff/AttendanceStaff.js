import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Animated,
  Modal,
  Pressable,
  RefreshControl,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { useTheme } from "../../context/ThemeContext";
import { SkeletonListItem } from "../../components/common/SkeletonLoader";
import { getFacultyRoster, submitAttendanceBatch, getStaffClassName } from "../../services/dataService";
import useRefreshOnForeground from "../../hooks/useRefreshOnForeground";

export default function AttendanceStaff() {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [students, setStudents] = useState([]);
  const [className, setClassName] = useState("");

  const [confirmVisible, setConfirmVisible] = useState(false);
  const [successVisible, setSuccessVisible] = useState(false);
  const [summary, setSummary] = useState({ present: 0, absent: 0 });

  const fadeAnim = useRef(new Animated.Value(0)).current;

  const loadData = useCallback(async () => {
    try {
      const cls = await getStaffClassName();
      setClassName(cls || "");
      const roster = await getFacultyRoster(cls || undefined);
      if (roster && roster.length > 0) {
        setStudents(
          roster.map((s, idx) => ({
            id: s.id || String(idx + 1),
            name: s.name,
            roll: s.roll || s.rollNo,
            present: s.present !== undefined ? s.present : true,
          }))
        );
      }
    } catch (err) {
      console.log("Error loading attendance roster:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();

    loadData();
  }, [fadeAnim, loadData]);

  // Refetch roster when the app returns to the foreground
  useRefreshOnForeground(loadData);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const toggleAttendance = (id) => {
    setStudents((prev) =>
      prev.map((student) =>
        student.id === id ? { ...student, present: !student.present } : student
      )
    );
  };

  const openConfirmation = () => {
    const presentCount = students.filter((s) => s.present).length;
    const absentCount = students.length - presentCount;
    setSummary({ present: presentCount, absent: absentCount });
    setConfirmVisible(true);
  };

  const handleSave = async () => {
    setConfirmVisible(false);
    const todayStr = new Date().toISOString().split("T")[0];
    const attendanceDocs = students.map((s) => ({
      studentId: s.id,
      roll: s.roll,
      studentName: s.name,
      class: s.__class || className || s.class || "",
      date: todayStr,
      status: s.present ? "Present" : "Absent",
      markedBy: "staff",
    }));

    try {
      await submitAttendanceBatch(attendanceDocs);
    } catch (err) {
      console.log("Attendance bulk submit fallback:", err);
    }

    setTimeout(() => setSuccessVisible(true), 300);
  };

  const presentCount = students.filter((s) => s.present).length;
  const absentCount = students.length - presentCount;

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 80 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
            progressBackgroundColor={colors.cardBackground}
          />
        }
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={[styles.headerIconWrap, { backgroundColor: `${colors.primary}18` }]}>
            <Icon name="clipboard-check-outline" size={24} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.header, { color: colors.primaryText }]}>Class Attendance</Text>
            <Text style={[styles.subText, { color: colors.secondaryText }]}>
              Section AI-B • Real-time roll call
            </Text>
          </View>
        </View>

        {isLoading ? (
          <View style={{ marginTop: 14 }}>
            <SkeletonListItem />
            <SkeletonListItem />
            <SkeletonListItem />
            <SkeletonListItem />
          </View>
        ) : (
          <>
            {/* Live Counter Badges */}
        <View style={styles.counterRow}>
          <View style={[styles.counterBadge, { backgroundColor: "rgba(16, 185, 129, 0.12)", borderColor: "rgba(16, 185, 129, 0.3)" }]}>
            <Icon name="account-check" size={18} color="#10B981" />
            <Text style={[styles.counterText, { color: "#10B981" }]}>{presentCount} Present</Text>
          </View>
          <View style={[styles.counterBadge, { backgroundColor: "rgba(239, 68, 68, 0.12)", borderColor: "rgba(239, 68, 68, 0.3)" }]}>
            <Icon name="account-cancel" size={18} color="#EF4444" />
            <Text style={[styles.counterText, { color: "#EF4444" }]}>{absentCount} Absent</Text>
          </View>
          <View style={[styles.counterBadge, { backgroundColor: `${colors.primary}12`, borderColor: `${colors.primary}30` }]}>
            <Icon name="account-group" size={18} color={colors.primary} />
            <Text style={[styles.counterText, { color: colors.primary }]}>{students.length} Total</Text>
          </View>
        </View>

        {/* Student Cards */}
        {students.map((student) => (
          <TouchableOpacity
            key={student.id}
            activeOpacity={0.9}
            style={[
              styles.card,
              { borderLeftColor: student.present ? "#2ECC71" : "#E74C3C" },
            ]}
          >
            <View style={styles.cardLeft}>
              <Icon
                name={student.present ? "account-check" : "account-cancel"}
                size={28}
                color={student.present ? "#2ECC71" : "#E74C3C"}
              />
              <View>
                <Text style={[styles.name, { color: colors.primaryText }]}>
                  {student.name}
                </Text>
                <Text
                  style={[
                    styles.status,
                    { color: student.present ? "#2ECC71" : "#E74C3C" },
                  ]}
                >
                  {student.present ? "Present" : "Absent"}
                </Text>
              </View>
            </View>

            <Switch
              trackColor={{ false: "#ccc", true: "#2ECC71" }}
              thumbColor="#fff"
              value={student.present}
              onValueChange={() => toggleAttendance(student.id)}
            />
          </TouchableOpacity>
        ))}

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: "#2ECC71" }]}
          onPress={openConfirmation}
        >
          <Icon name="check-decagram" size={22} color="#fff" />
          <Text style={styles.saveText}>Save Attendance</Text>
        </TouchableOpacity>
        </>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>

      {/* Confirmation Modal */}
      <Modal visible={confirmVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: colors.cardBackground }]}>
            <View style={styles.modalHeader}>
              <Icon name="alert-decagram-outline" size={35} color="#F39C12" />
              <Text style={[styles.modalTitle, { color: "#F39C12" }]}>
                Confirm Submission
              </Text>
            </View>
            <Text style={[styles.modalText, { color: colors.primaryText }]}>
              Are you sure you want to submit today’s attendance record?
            </Text>

            <View style={styles.summaryBox}>
              <View style={styles.summaryRow}>
                <Icon name="account-check" size={22} color="#2ECC71" />
                <Text style={[styles.summaryText, { color: "#2ECC71" }]}>
                  Present: {summary.present}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Icon name="account-cancel" size={22} color="#E74C3C" />
                <Text style={[styles.summaryText, { color: "#E74C3C" }]}>
                  Absent: {summary.absent}
                </Text>
              </View>
            </View>

            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.cancelBtn, { backgroundColor: "#E74C3C" }]}
                onPress={() => setConfirmVisible(false)}
              >
                <Text style={styles.modalBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.confirmBtn, { backgroundColor: "#2ECC71" }]}
                onPress={handleSave}
              >
                <Text style={styles.modalBtnText}>Confirm</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ✅ Success Popup */}
      <Modal visible={successVisible} transparent animationType="none">
        <View style={styles.successOverlay}>
          <View style={[styles.successContainer, { backgroundColor: colors.cardBackground }]}>
            <View style={styles.successIconContainer}>
              <Icon name="check-circle" size={60} color="#2ECC71" />
            </View>
            <Text style={[styles.successTitle, { color: "#2ECC71" }]}>
              Attendance Submitted!
            </Text>
            <Text style={[styles.successSubtitle, { color: colors.secondaryText }]}>
              The attendance record has been saved successfully.
            </Text>

            <View style={styles.successSummary}>
              <Text style={[styles.successSummaryText, { color: "#2ECC71" }]}>
                ✅ Present: {summary.present}
              </Text>
              <Text style={[styles.successSummaryText, { color: "#E74C3C" }]}>
                ❌ Absent: {summary.absent}
              </Text>
            </View>

            <Pressable
              style={[styles.okBtn, { backgroundColor: "#2ECC71" }]}
              onPress={() => setSuccessVisible(false)}
            >
              <Text style={styles.okText}>OK</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </Animated.View>
  );
}

const getStyles = (colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.primaryBackground,
      paddingHorizontal: 18,
      paddingTop: 16,
      paddingBottom: 40,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginBottom: 16,
    },
    headerIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 14,
      justifyContent: "center",
      alignItems: "center",
    },
    header: { fontSize: 22, fontWeight: "800", color: colors.primaryText, letterSpacing: -0.3 },
    subText: { fontSize: 13, color: colors.secondaryText, marginTop: 2 },
    counterRow: {
      flexDirection: "row",
      gap: 8,
      marginBottom: 16,
    },
    counterBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      borderWidth: 1,
    },
    counterText: {
      fontSize: 12,
      fontWeight: "800",
    },
    listHeader: { marginBottom: 10, paddingHorizontal: 5 },
    listHeaderText: { fontSize: 18, fontWeight: "700" },
    listHeaderSub: { fontSize: 13, marginTop: 2 },
    card: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: colors.cardBackground,
      paddingVertical: 14,
      paddingHorizontal: 15,
      borderRadius: 14,
      borderLeftWidth: 5,
      marginBottom: 10,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 3,
      elevation: 2,
    },
    cardLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
    name: { fontSize: 16, fontWeight: "600" },
    status: { fontSize: 13, fontWeight: "500" },
    saveBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      marginTop: 25,
      marginBottom: 25,
      paddingVertical: 14,
      borderRadius: 12,
      elevation: 3,
    },
    saveText: { color: "#fff", fontSize: 16, fontWeight: "700" },

    modalOverlay: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.45)" },
    modalContainer: { width: "85%", borderRadius: 18, padding: 20, elevation: 8 },
    modalHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
    modalTitle: { fontSize: 20, fontWeight: "700" },
    modalText: { fontSize: 15, lineHeight: 22, marginBottom: 20 },
    summaryBox: { borderRadius: 10, borderWidth: 1, borderColor: "#eee", padding: 10, marginBottom: 20 },
    summaryRow: { flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 4 },
    summaryText: { fontSize: 15, fontWeight: "600" },
    modalButtons: { flexDirection: "row", justifyContent: "space-between", gap: 15 },
    cancelBtn: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 10 },
    confirmBtn: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 10 },
    modalBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },

    // ✅ Success Popup Styles
    successOverlay: { flex: 1, justifyContent: "center", alignItems: "center" },
    successContainer: {
      width: "80%",
      borderRadius: 20,
      paddingVertical: 25,
      paddingHorizontal: 20,
      alignItems: "center",
      elevation: 10,
      shadowColor: "#000",
      shadowOpacity: 0.2,
      shadowRadius: 5,
    },
    successIconContainer: { marginBottom: 10 },
    successTitle: { fontSize: 20, fontWeight: "800", marginBottom: 5 },
    successSubtitle: { fontSize: 14, textAlign: "center", marginBottom: 15 },
    successSummary: { marginBottom: 15 },
    successSummaryText: { fontSize: 15, fontWeight: "600" },
    okBtn: { paddingVertical: 10, paddingHorizontal: 30, borderRadius: 10 },
    okText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  });
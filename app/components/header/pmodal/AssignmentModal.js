import React, { useState, useEffect, useCallback } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Share,
} from "react-native";
import { useTheme } from "../../../context/ThemeContext";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { getParentData } from "../../../services/dataService";
import { showToast } from "../../../utils/toastService";
import { api } from "../../../services/api";

export default function AssignmentModal({ visible, onClose }) {
  const { colors, isDarkMode } = useTheme();
  const styles = getStyles(colors, isDarkMode);

  const [selectedFilter, setSelectedFilter] = useState("All");
  const [wardName, setWardName] = useState("");
  const [rollNo, setRollNo] = useState("");
  const [examSchedule, setExamSchedule] = useState([]);

  const fetchAssignments = useCallback(async () => {
    try {
      const res = await api.get("/assignments");
      const items = res?.data || res || [];
      const mapped = (Array.isArray(items) ? items : []).map((a, i) => ({
        id: a._id || a.id || String(i),
        course: a.course || a.courseName || "—",
        type: a.type || a.category || "CIA-2",
        date: a.dueDate || a.date || "—",
        room: a.room || a.location || "—",
        portions: a.portions || a.syllabus || a.title || "—",
        maxMarks: a.maxMarks || a.totalMarks || 50,
        color: a.color || "#4F46E5",
      }));
      setExamSchedule(mapped);
    } catch {
      setExamSchedule([]);
    }
  }, []);

  useEffect(() => {
    getParentData().then((data) => {
      if (data?.ward) {
        setWardName(data.ward.name || "");
        setRollNo(data.ward.rollNo || "");
      }
    }).catch(() => {});
    fetchAssignments();
  }, [fetchAssignments]);

  if (!visible) return null;

  const handleShareSchedule = async () => {
    try {
      const summary = examSchedule.map(
        (e) => `📅 ${e.course}\nType: ${e.type}\nDate: ${e.date}\nPortions: ${e.portions}`
      ).join("\n\n");

      await Share.share({
        title: "Semester 5 CIA-2 Exam Schedule",
        message: `📋 EDUNEX SEMESTER 5 EXAM SCHEDULE\nWard: ${wardName || "—"} (${rollNo || "—"})\n\n${summary}`,
      });
      showToast("Exam schedule shared!", "success");
    } catch (err) {
      console.log("Share error:", err);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.modalContainer, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
              <View style={[styles.iconWrap, { backgroundColor: colors.primaryAccent + "18" }]}>
                <Icon name="calendar-clock" size={24} color={colors.primaryAccent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.headerTitle, { color: colors.primaryText }]}>Exam & Assessment Calendar</Text>
                <Text style={[styles.headerSubtitle, { color: colors.secondaryText }]}>
                  Semester 5 CIA-2 Mid-Term Portions & Dates
                </Text>
              </View>
            </View>

            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Icon name="close-circle-outline" size={24} color={colors.secondaryText} />
            </TouchableOpacity>
          </View>

          {/* Filter Strip */}
          <View style={styles.filterStrip}>
            {["All", "Upcoming", "Labs"].map((f) => {
              const isSel = selectedFilter === f;
              return (
                <TouchableOpacity
                  key={f}
                  style={[
                    styles.filterPill,
                    isSel
                      ? { backgroundColor: colors.primaryAccent, borderColor: colors.primaryAccent }
                      : { backgroundColor: colors.primaryBackground, borderColor: colors.divider },
                  ]}
                  onPress={() => setSelectedFilter(f)}
                >
                  <Text style={[styles.filterPillText, { color: isSel ? "#FFFFFF" : colors.secondaryText }]}>
                    {f}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Scrollable Content */}
          <ScrollView contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
            {examSchedule.map((item) => (
              <View
                key={item.id}
                style={[styles.examCard, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}
              >
                <View style={styles.examCardTop}>
                  <View style={[styles.courseIconCircle, { backgroundColor: `${item.color}18` }]}>
                    <Icon name="book-open-page-variant" size={20} color={item.color} />
                  </View>

                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.courseName, { color: colors.primaryText }]} numberOfLines={1}>
                      {item.course}
                    </Text>
                    <Text style={[styles.examType, { color: item.color }]}>{item.type}</Text>
                  </View>

                  <View style={styles.weightageBadge}>
                    <Text style={styles.weightageBadgeText}>{item.maxMarks} Marks</Text>
                  </View>
                </View>

                {/* Details Box */}
                <View style={[styles.detailsBox, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
                  <View style={styles.detailRow}>
                    <Icon name="clock-outline" size={14} color={colors.secondaryText} />
                    <Text style={[styles.detailText, { color: colors.primaryText }]}>{item.date}</Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Icon name="map-marker-radius" size={14} color={colors.secondaryText} />
                    <Text style={[styles.detailText, { color: colors.primaryText }]}>{item.room}</Text>
                  </View>

                  <View style={styles.portionsRow}>
                    <Icon name="format-list-checks" size={14} color={colors.primaryAccent} />
                    <Text style={[styles.portionsText, { color: colors.secondaryText }]}>
                      Portions: {item.portions}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.footerRow}>
            <TouchableOpacity
              style={[styles.shareBtn, { backgroundColor: colors.primaryAccent }]}
              onPress={handleShareSchedule}
              activeOpacity={0.85}
            >
              <Icon name="share-variant" size={16} color="#FFFFFF" />
              <Text style={styles.shareBtnText}>Share Exam Timetable</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.doneBtn, { borderColor: colors.divider }]}
              onPress={onClose}
            >
              <Text style={[styles.doneBtnText, { color: colors.primaryText }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ---------------- Styles ----------------
const getStyles = (colors, isDarkMode) =>
  StyleSheet.create({
    overlay: {
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
    headerTitle: {
      fontSize: 16,
      fontWeight: "800",
      letterSpacing: -0.2,
    },
    headerSubtitle: {
      fontSize: 11,
      fontWeight: "500",
      marginTop: 1,
    },
    closeBtn: {
      padding: 4,
    },
    filterStrip: {
      flexDirection: "row",
      gap: 6,
      marginBottom: 12,
    },
    filterPill: {
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 10,
      borderWidth: 1,
    },
    filterPillText: {
      fontSize: 11,
      fontWeight: "700",
    },
    scrollBody: {
      gap: 10,
      paddingBottom: 10,
    },
    examCard: {
      borderRadius: 16,
      borderWidth: 1,
      padding: 12,
    },
    examCardTop: {
      flexDirection: "row",
      alignItems: "center",
    },
    courseIconCircle: {
      width: 38,
      height: 38,
      borderRadius: 10,
      justifyContent: "center",
      alignItems: "center",
    },
    courseName: {
      fontSize: 13,
      fontWeight: "800",
    },
    examType: {
      fontSize: 11,
      fontWeight: "700",
      marginTop: 2,
    },
    weightageBadge: {
      backgroundColor: "#4F46E514",
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
    },
    weightageBadgeText: {
      color: "#4F46E5",
      fontSize: 10,
      fontWeight: "900",
    },
    detailsBox: {
      borderRadius: 12,
      borderWidth: 1,
      padding: 10,
      marginTop: 10,
      gap: 4,
    },
    detailRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    detailText: {
      fontSize: 11.5,
      fontWeight: "600",
    },
    portionsRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 6,
      marginTop: 4,
    },
    portionsText: {
      fontSize: 11,
      lineHeight: 15,
      fontWeight: "500",
      flex: 1,
    },
    footerRow: {
      flexDirection: "row",
      gap: 8,
      marginTop: 14,
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
    doneBtn: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
    },
    doneBtnText: {
      fontSize: 13,
      fontWeight: "800",
    },
  });
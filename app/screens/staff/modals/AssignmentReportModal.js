import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  TextInput,
  ScrollView,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { useTheme } from "../../../context/ThemeContext";
import { api } from "../../../services/api";
import { showToast } from "../../../utils/toastService";

import { getFacultyData, getFacultyAssignedSubjects } from "../../../services/dataService";

const DEFAULT_REPORTS = [];

export default function AssignmentReportModal({ visible, onClose, colors: propColors }) {
  const theme = useTheme();
  const colors = propColors || theme.colors || {};
  const isDarkMode = theme.isDarkMode || false;
  const styles = getStyles(colors, isDarkMode);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const [search, setSearch] = useState("");
  const [reports, setReports] = useState(DEFAULT_REPORTS);
  const [activeFilter, setActiveFilter] = useState("All");

  const loadReports = useCallback(async () => {
    try {
      const facData = await getFacultyData();
      const subjects = await getFacultyAssignedSubjects(facData);

      const res = await api.get("/assignments", { sort: "-createdAt", limit: 100 });
      const rawList = Array.isArray(res?.data) ? res.data : [];

      // Scoping: Staff only views submissions for their assigned subjects
      const scopedList = rawList.filter((a) => {
        const asgSubName = String(a.subject || a.course || a.courseName || "").toLowerCase();
        const asgSubCode = String(a.subjectCode || a.code || "").toLowerCase();
        const assignedBy = String(a.assignedBy || "").toLowerCase();
        const facName = String(facData?.name || "").toLowerCase();
        const facId = String(facData?.staffId || "").toLowerCase();

        if (facName && assignedBy && (assignedBy.includes(facName) || facName.includes(assignedBy))) return true;
        if (facId && String(a.facultyId || "").toLowerCase() === facId) return true;

        return subjects.some((sub) => {
          const sName = String(sub.name || "").toLowerCase();
          const sCode = String(sub.code || "").toLowerCase();
          if (sCode && asgSubCode && (sCode === asgSubCode || asgSubCode.includes(sCode))) return true;
          if (sName && asgSubName && (asgSubName.includes(sName) || sName.includes(asgSubName))) return true;
          return false;
        });
      });

      if (scopedList.length > 0) {
        setReports(
          scopedList.map((a, idx) => ({
            id: a.id || a._id || String(idx + 1),
            name: a.studentName || [a.name, a.roll ? `(${a.roll})` : ""].filter(Boolean).join(" ") || "Student",
            topic: `${a.subjectCode || a.code ? `${a.subjectCode || a.code} · ` : ""}${a.title || a.topic || "Practical Coursework Report"}`,
            submittedOn: a.dueDate || a.createdAt?.slice(0, 10) || "—",
            status: a.status?.toLowerCase().includes("graded") ? "Graded" : "Pending",
            marks: a.obtainedMarks != null ? `${a.obtainedMarks}/${a.totalMarks || 50}` : a.marks ? `${a.marks}/50` : "Needs Grading",
            color: a.status?.toLowerCase().includes("graded") ? "#10B981" : "#F59E0B",
          }))
        );
      } else {
        setReports([]);
      }
    } catch {
      setReports([]);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      loadReports();
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
  }, [visible, fadeAnim, slideAnim, loadReports]);

  if (!visible) return null;

  const handleGrade = (id) => {
    setReports((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const maxMarks = Number(r.maxMarks) || 50;
        const score = r.marks && r.marks !== "—" ? r.marks : `${Math.round(maxMarks * 0.9)}/${maxMarks}`;
        return { ...r, status: "Graded", marks: score, color: "#10B981" };
      })
    );
    showToast("Report marked as Graded!", "success");
  };

  const filtered = reports.filter((r) => {
    if (activeFilter === "Pending" && r.status !== "Pending") return false;
    if (activeFilter === "Graded" && r.status !== "Graded") return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return r.name.toLowerCase().includes(q) || r.topic.toLowerCase().includes(q);
    }
    return true;
  });

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
              <View style={[styles.iconWrap, { backgroundColor: "#E67E2218" }]}>
                <Icon name="file-document-edit" size={24} color="#E67E22" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { color: colors.primaryText }]}>Assignment & CIA Submissions</Text>
                <Text style={[styles.subtitle, { color: colors.secondaryText }]}>
                  Review lab experiments & grade Continuous Assessment files
                </Text>
              </View>
            </View>

            <TouchableOpacity onPress={onClose} style={styles.closeIconBtn}>
              <Icon name="close-circle-outline" size={24} color={colors.secondaryText} />
            </TouchableOpacity>
          </View>

          {/* Filter Pills */}
          <View style={styles.filterRow}>
            {["All", "Pending", "Graded"].map((f) => {
              const isSel = activeFilter === f;
              return (
                <TouchableOpacity
                  key={f}
                  style={[
                    styles.filterPill,
                    isSel
                      ? { backgroundColor: colors.primaryAccent, borderColor: colors.primaryAccent }
                      : { backgroundColor: colors.primaryBackground, borderColor: colors.divider },
                  ]}
                  onPress={() => setActiveFilter(f)}
                >
                  <Text style={[styles.filterPillText, { color: isSel ? "#FFFFFF" : colors.secondaryText }]}>
                    {f}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Search Box */}
          <View style={[styles.searchBox, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
            <Icon name="magnify" size={18} color={colors.secondaryText} />
            <TextInput
              style={[styles.searchInput, { color: colors.primaryText }]}
              placeholder="Search by student or topic..."
              placeholderTextColor={colors.disabledText}
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch("")}>
                <Icon name="close-circle" size={16} color={colors.secondaryText} />
              </TouchableOpacity>
            )}
          </View>

          {/* Reports List */}
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
            {filtered.map((item) => (
              <View
                key={item.id}
                style={[styles.reportCard, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}
              >
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={[styles.studentName, { color: colors.primaryText }]} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <View
                      style={[
                        styles.statusTag,
                        { backgroundColor: item.status === "Graded" ? "#10B98118" : "#F59E0B18" },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusTagText,
                          { color: item.status === "Graded" ? "#10B981" : "#D97706" },
                        ]}
                      >
                        {item.status} ({item.marks})
                      </Text>
                    </View>
                  </View>

                  <Text style={[styles.topicText, { color: colors.secondaryText }]} numberOfLines={2}>
                    {item.topic}
                  </Text>
                  <Text style={[styles.dateText, { color: colors.disabledText }]}>
                    Submitted: {item.submittedOn}
                  </Text>
                </View>

                {item.status === "Pending" && (
                  <TouchableOpacity
                    style={[styles.gradeBtn, { backgroundColor: colors.primaryAccent }]}
                    onPress={() => handleGrade(item.id)}
                  >
                    <Icon name="check" size={15} color="#FFFFFF" />
                    <Text style={styles.gradeBtnText}>Grade</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </ScrollView>

          {/* Done Button */}
          <TouchableOpacity
            style={[styles.closeButton, { backgroundColor: colors.primaryAccent }]}
            onPress={onClose}
            activeOpacity={0.85}
          >
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
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
    filterRow: {
      flexDirection: "row",
      gap: 6,
      marginBottom: 8,
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
    searchBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 12,
      borderWidth: 1,
      marginBottom: 10,
    },
    searchInput: {
      flex: 1,
      fontSize: 12,
      padding: 0,
    },
    reportCard: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 14,
      borderWidth: 1,
      padding: 12,
    },
    studentName: {
      fontSize: 13,
      fontWeight: "800",
      flex: 1,
    },
    statusTag: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      marginLeft: 6,
    },
    statusTagText: {
      fontSize: 9.5,
      fontWeight: "900",
    },
    topicText: {
      fontSize: 11,
      lineHeight: 15,
      marginTop: 2,
    },
    dateText: {
      fontSize: 10,
      marginTop: 2,
    },
    gradeBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      marginLeft: 10,
    },
    gradeBtnText: {
      color: "#FFFFFF",
      fontSize: 11,
      fontWeight: "800",
    },
    closeButton: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 12,
      borderRadius: 12,
      marginTop: 12,
    },
    closeText: {
      color: "#FFFFFF",
      fontWeight: "800",
      fontSize: 13,
    },
  });
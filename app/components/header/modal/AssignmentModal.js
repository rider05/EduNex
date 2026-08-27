import React, { useRef, useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Animated,
  TouchableOpacity,
  ScrollView,
  Share,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { useTheme } from "../../../context/ThemeContext";
import { showToast } from "../../../utils/toastService";
import { api } from "../../../services/api";

export default function AssignmentModal({ visible, onClose, colors: propColors }) {
  const theme = useTheme();
  const colors = propColors || theme.colors || {};
  const isDarkMode = theme.isDarkMode || false;
  const styles = getStyles(colors, isDarkMode);

  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [assignments, setAssignments] = useState([]);

  const fetchAssignments = useCallback(async () => {
    try {
      const res = await api.get("/assignments");
      const items = res?.data || res || [];
      const mapped = (Array.isArray(items) ? items : []).map((a, i) => ({
        id: a._id || a.id || String(i),
        course: a.course || a.courseName || "—",
        title: a.title || a.name || "—",
        submitted: a.submitted || 0,
        pending: a.pending || 0,
        dueDate: a.dueDate || a.deadline || "—",
        color: "#4F46E5",
      }));
      setAssignments(mapped);
    } catch {
      setAssignments([]);
    }
  }, []);

  useEffect(() => {
    if (visible) fetchAssignments();
  }, [visible, fetchAssignments]);

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
      scaleAnim.setValue(0.85);
      fadeAnim.setValue(0);
    }
  }, [visible, fadeAnim, scaleAnim]);

  if (!visible) return null;

  const totalSubmitted = assignments.reduce((sum, a) => sum + (a.submitted || 0), 0);
  const totalStudents = assignments.reduce((sum, a) => sum + (a.submitted || 0) + (a.pending || 0), 0) || 1;
  const totalPending = assignments.reduce((sum, a) => sum + (a.pending || 0), 0);
  const submissionRate = Math.round((totalSubmitted / totalStudents) * 100);

  const handleShare = async () => {
    try {
      const summary = assignments.map(
        (a) => `📘 ${a.course}\nTask: ${a.title}\nSubmitted: ${a.submitted} (Pending: ${a.pending})\nDue: ${a.dueDate}`
      ).join("\n\n");

      await Share.share({
        title: "Assignment Submission Summary",
        message: `📋 EDUNEX COURSEWORK SUBMISSION METRICS\nSubmission Rate: ${submissionRate}%\n\n${summary}`,
      });
      showToast("Assignment metrics shared!", "success");
    } catch (err) {
      console.log("Share error:", err);
    }
  };

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <Animated.View
          style={[
            styles.cardContainer,
            {
              backgroundColor: colors.cardBackground || "#FFFFFF",
              borderColor: colors.divider || "rgba(0,0,0,0.1)",
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
              <View style={[styles.iconWrap, { backgroundColor: "#4F46E518" }]}>
                <Icon name="file-document-edit-outline" size={24} color="#4F46E5" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { color: colors.primaryText }]}>Coursework & Assignments</Text>
                <Text style={[styles.subtitle, { color: colors.secondaryText }]}>
                  Semester 5 Lab Submissions & Review Metrics
                </Text>
              </View>
            </View>

            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Icon name="close-circle-outline" size={24} color={colors.secondaryText} />
            </TouchableOpacity>
          </View>

          {/* Quick Stats Strip */}
          <View style={[styles.statsStrip, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
            <View style={styles.statItem}>
              <Text style={[styles.statVal, { color: "#10B981" }]}>{submissionRate}%</Text>
              <Text style={[styles.statLabel, { color: colors.secondaryText }]}>Submission Rate</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statVal, { color: colors.primaryAccent }]}>{totalSubmitted}</Text>
              <Text style={[styles.statLabel, { color: colors.secondaryText }]}>Submitted</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statVal, { color: "#F59E0B" }]}>{totalPending}</Text>
              <Text style={[styles.statLabel, { color: colors.secondaryText }]}>Pending</Text>
            </View>
          </View>

          {/* Assignment Cards */}
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
            {assignments.map((item) => (
              <View
                key={item.id}
                style={[styles.assignmentCard, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={[styles.courseName, { color: colors.primaryText }]} numberOfLines={1}>
                    {item.course}
                  </Text>
                  <View style={[styles.statusBadge, { backgroundColor: `${item.color}18` }]}>
                    <Text style={[styles.statusBadgeText, { color: item.color }]}>{item.submitted}</Text>
                  </View>
                </View>

                <Text style={[styles.taskTitle, { color: colors.secondaryText }]} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={[styles.dueDateText, { color: colors.disabledText }]}>
                  Due Date: {item.dueDate}
                </Text>
              </View>
            ))}
          </ScrollView>

          {/* Action Row */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.shareBtn, { backgroundColor: colors.primaryAccent }]}
              onPress={handleShare}
              activeOpacity={0.85}
            >
              <Icon name="share-variant" size={16} color="#FFFFFF" />
              <Text style={styles.shareBtnText}>Share Metrics</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.closeBtnFooter, { borderColor: colors.divider }]}
              onPress={onClose}
            >
              <Text style={[styles.closeBtnFooterText, { color: colors.primaryText }]}>Close</Text>
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
    overlay: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "rgba(0,0,0,0.75)",
      paddingHorizontal: 16,
    },
    cardContainer: {
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
    closeBtn: {
      padding: 4,
    },
    statsStrip: {
      flexDirection: "row",
      borderRadius: 12,
      borderWidth: 1,
      padding: 10,
      marginBottom: 10,
      justifyContent: "space-around",
    },
    statItem: {
      alignItems: "center",
    },
    statVal: {
      fontSize: 14.5,
      fontWeight: "900",
    },
    statLabel: {
      fontSize: 10,
      fontWeight: "600",
      marginTop: 1,
    },
    assignmentCard: {
      borderRadius: 14,
      borderWidth: 1,
      padding: 12,
    },
    courseName: {
      fontSize: 13,
      fontWeight: "800",
      flex: 1,
    },
    statusBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      marginLeft: 6,
    },
    statusBadgeText: {
      fontSize: 9.5,
      fontWeight: "900",
    },
    taskTitle: {
      fontSize: 11.5,
      lineHeight: 15,
      marginTop: 3,
    },
    dueDateText: {
      fontSize: 10.5,
      marginTop: 3,
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
    closeBtnFooter: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
    },
    closeBtnFooterText: {
      fontSize: 13,
      fontWeight: "800",
    },
  });
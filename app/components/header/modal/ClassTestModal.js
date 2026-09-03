import React, { useRef, useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, Modal, Animated, TouchableOpacity, ScrollView, Share } from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { useTheme } from "../../../context/ThemeContext";
import { showToast } from "../../../utils/toastService";
import { api } from "../../../services/api";

export default function ClassTestModal({ visible, onClose, colors: propColors }) {
  const theme = useTheme();
  const colors = propColors || theme.colors || {};
  const isDarkMode = theme.isDarkMode || false;
  const styles = getStyles(colors, isDarkMode);

  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [testReports, setTestReports] = useState([]);

  const fetchTestReports = useCallback(async () => {
    try {
      const res = await api.get("/assignments");
      const items = res?.data || res || [];
      const mapped = (Array.isArray(items) ? items : []).map((a, i) => ({
        id: a._id || a.id || String(i),
        course: a.course || a.courseName || "—",
        class: a.className || a.class || "—",
        status: a.status || "Evaluated",
        passRate: a.passRate || `${Math.round((a.submitted || 0) / Math.max(a.totalStudents || 1, 1) * 100)}%`,
        avgScore: a.avgScore || a.averageMarks || "—",
        topScorer: a.topScorer || "—",
      }));
      setTestReports(mapped);
    } catch {
      setTestReports([]);
    }
  }, []);

  useEffect(() => {
    if (visible) fetchTestReports();
  }, [visible, fetchTestReports]);

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

  const handleShareReport = async () => {
    try {
      const summary = testReports.map(
        (t) => `📊 ${t.course}\nClass: ${t.class}\nPass Rate: ${t.passRate} (Avg: ${t.avgScore})\nTop Scorer: ${t.topScorer}`
      ).join("\n\n");

      await Share.share({
        title: "CIA Class Assessment Report",
        message: `📋 EDUNEX CIA INTERNAL ASSESSMENT PERFORMANCE\n\n${summary}`,
      });
      showToast("Class test report shared!", "success");
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
                <Icon name="clipboard-text-clock" size={24} color="#4F46E5" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { color: colors.primaryText }]}>Continuous Assessment Reports</Text>
                <Text style={[styles.subtitle, { color: colors.secondaryText }]}>
                  Current Semester Assessment Analysis
                </Text>
              </View>
            </View>

            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Icon name="close-circle-outline" size={24} color={colors.secondaryText} />
            </TouchableOpacity>
          </View>

          {/* Test Performance Cards */}
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 4 }}>
            {testReports.map((t) => (
              <View
                key={t.id}
                style={[styles.reportCard, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={[styles.courseName, { color: colors.primaryText }]} numberOfLines={1}>
                    {t.course}
                  </Text>
                  <View style={styles.evalBadge}>
                    <Icon name="check-decagram" size={12} color="#10B981" />
                    <Text style={styles.evalBadgeText}>{t.status}</Text>
                  </View>
                </View>

                <Text style={[styles.classText, { color: colors.secondaryText }]}>{t.class}</Text>

                {/* Metrics Grid */}
                <View style={[styles.metricsGrid, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
                  <View style={styles.metricItem}>
                    <Text style={[styles.metricVal, { color: "#10B981" }]}>{t.passRate}</Text>
                    <Text style={[styles.metricLabel, { color: colors.secondaryText }]}>Pass Rate</Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Text style={[styles.metricVal, { color: "#4F46E5" }]}>{t.avgScore}</Text>
                    <Text style={[styles.metricLabel, { color: colors.secondaryText }]}>Batch Avg</Text>
                  </View>
                  <View style={[styles.metricItem, { flex: 1.4 }]}>
                    <Text style={[styles.metricVal, { color: colors.primaryText }]} numberOfLines={1}>
                      {t.topScorer.split("(")[0]}
                    </Text>
                    <Text style={[styles.metricLabel, { color: colors.secondaryText }]}>Top Scorer</Text>
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>

          {/* Next Test Announcement Banner */}
          <View style={[styles.nextTestBanner, { backgroundColor: "#4F46E514", borderColor: "#4F46E533" }]}>
            <Icon name="calendar-alert" size={18} color="#4F46E5" />
            <Text style={[styles.nextTestText, { color: colors.primaryText }]}>
              Next Exam: <Text style={{ color: "#4F46E5", fontWeight: "800" }}>CIA-2 Commencing Nov 15</Text>
            </Text>
          </View>

          {/* Action Row */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.shareBtn, { backgroundColor: colors.primaryAccent }]}
              onPress={handleShareReport}
              activeOpacity={0.85}
            >
              <Icon name="share-variant" size={16} color="#FFFFFF" />
              <Text style={styles.shareBtnText}>Share Report</Text>
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
      paddingTop: 22,
      elevation: 12,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 16,
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
    reportCard: {
      borderRadius: 14,
      borderWidth: 1,
      padding: 12,
    },
    courseName: {
      fontSize: 13,
      fontWeight: "800",
      flex: 1,
    },
    evalBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      backgroundColor: "#10B98114",
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    evalBadgeText: {
      color: "#10B981",
      fontSize: 9,
      fontWeight: "900",
    },
    classText: {
      fontSize: 11,
      fontWeight: "500",
      marginTop: 2,
    },
    metricsGrid: {
      flexDirection: "row",
      borderRadius: 10,
      borderWidth: 1,
      padding: 8,
      marginTop: 8,
      justifyContent: "space-around",
    },
    metricItem: {
      alignItems: "center",
      flex: 1,
    },
    metricVal: {
      fontSize: 12,
      fontWeight: "800",
    },
    metricLabel: {
      fontSize: 9.5,
      fontWeight: "600",
      marginTop: 1,
    },
    nextTestBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      padding: 10,
      borderRadius: 12,
      borderWidth: 1,
      marginTop: 10,
    },
    nextTestText: {
      fontSize: 11.5,
      fontWeight: "600",
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
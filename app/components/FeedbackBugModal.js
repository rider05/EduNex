import React, { useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { useTheme } from "../context/ThemeContext";
import { resolveIdentity } from "../services/identityService";
import { submitBugReport } from "../services/dataService";
import { showToast } from "../utils/toastService";

const CATEGORIES = [
  { id: "bug", label: "Bug / Error", icon: "bug-outline" },
  { id: "ui", label: "UI / Visual Glitch", icon: "palette-outline" },
  { id: "performance", label: "Slow / Lag", icon: "speedometer" },
  { id: "data", label: "Data Inconsistency", icon: "database-alert-outline" },
  { id: "feature", label: "Feature Idea", icon: "lightbulb-outline" },
];

const SEVERITIES = [
  { id: "low", label: "Low", color: "#10B981" },
  { id: "medium", label: "Medium", color: "#F59E0B" },
  { id: "high", label: "High", color: "#F97316" },
  { id: "critical", label: "Critical", color: "#EF4444" },
];

export default function FeedbackBugModal({ visible, onClose, initialScreen = "" }) {
  const { colors } = useTheme();

  const [category, setCategory] = useState("bug");
  const [severity, setSeverity] = useState("medium");
  const [screenContext, setScreenContext] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [userInfo, setUserInfo] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      resolveIdentity().then((id) => {
        setUserInfo(id);
      });
      setScreenContext("");
    }
  }, [visible]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      showToast("Please enter a short issue title.", "warning");
      return;
    }
    if (!description.trim()) {
      showToast("Please provide details or steps to reproduce.", "warning");
      return;
    }

    setIsSubmitting(true);
    try {
      const u = userInfo?.user || {};
      const payload = {
        title: title.trim(),
        description: description.trim(),
        category,
        severity,
        screen: screenContext.trim() || initialScreen.trim() || "General",
        status: "open",
        reporter: {
          username: userInfo?.username || u.username || "anonymous",
          name: userInfo?.student?.name || userInfo?.parent?.name || userInfo?.staff?.name || userInfo?.admin?.name || u.name || userInfo?.username || "User",
          role: userInfo?.role || u.role || "student",
          email: userInfo?.student?.email || userInfo?.parent?.email || userInfo?.staff?.email || u.email || "",
          phone: userInfo?.student?.phone || userInfo?.parent?.phone || userInfo?.staff?.phone || u.mobile || "",
          rollNo: userInfo?.rollNo || userInfo?.wardRollNo || "",
        },
        device: {
          platform: Platform.OS,
          version: String(Platform.Version),
          appVersion: "1.0.1 (EduNex Ecosystem)",
        },
      };

      await submitBugReport(payload);
      showToast("🚀 Bug report submitted directly to developer controls!", "success");
      setTitle("");
      setDescription("");
      onClose();
    } catch (err) {
      console.log("Bug report submission error:", err);
      showToast("Could not submit bug report. Please try again.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.overlay}
      >
        <View style={[styles.modalCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
          {/* Header */}
          <View style={[styles.headerRow, { borderBottomColor: colors.divider }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={[styles.headerIconCircle, { backgroundColor: "#EF444418" }]}>
                <Icon name="bug-outline" size={22} color="#EF4444" />
              </View>
              <View>
                <Text style={[styles.headerTitle, { color: colors.primaryText }]}>Report Bug / Feedback</Text>
                <Text style={[styles.headerSub, { color: colors.secondaryText }]}>
                  Developer Diagnostic Console
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Icon name="close-circle-outline" size={24} color={colors.secondaryText} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
            {/* User Diagnostic Tag */}
            <View style={[styles.userTag, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
              <Icon name="account-circle-outline" size={16} color={colors.primaryAccent} />
              <Text style={[styles.userTagText, { color: colors.primaryText }]}>
                {userInfo?.username ? `@${userInfo.username} (${(userInfo.role || "user").toUpperCase()})` : "User Session"} · {Platform.OS.toUpperCase()}
              </Text>
            </View>

            {/* Category Selector */}
            <Text style={[styles.inputLabel, { color: colors.primaryText }]}>Issue Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
              {CATEGORIES.map((c) => {
                const active = category === c.id;
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active ? colors.primaryAccent : colors.primaryBackground,
                        borderColor: active ? colors.primaryAccent : colors.divider,
                      },
                    ]}
                    onPress={() => setCategory(c.id)}
                  >
                    <Icon name={c.icon} size={15} color={active ? "#FFFFFF" : colors.secondaryText} />
                    <Text style={[styles.chipText, { color: active ? "#FFFFFF" : colors.primaryText }]}>
                      {c.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Severity Selector */}
            <Text style={[styles.inputLabel, { color: colors.primaryText }]}>Severity Level</Text>
            <View style={styles.severityGrid}>
              {SEVERITIES.map((s) => {
                const active = severity === s.id;
                return (
                  <TouchableOpacity
                    key={s.id}
                    style={[
                      styles.severityBtn,
                      {
                        backgroundColor: active ? s.color + "22" : colors.primaryBackground,
                        borderColor: active ? s.color : colors.divider,
                      },
                    ]}
                    onPress={() => setSeverity(s.id)}
                  >
                    <View style={[styles.sevDot, { backgroundColor: s.color }]} />
                    <Text style={[styles.sevText, { color: active ? s.color : colors.secondaryText }]}>
                      {s.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Screen / Feature */}
            <Text style={[styles.inputLabel, { color: colors.primaryText }]}>Screen / Affected Feature</Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: colors.primaryBackground, borderColor: colors.divider, color: colors.primaryText }]}
              placeholder="e.g. Fees Screen, Full Timetable, Attendance..."
              placeholderTextColor={colors.secondaryText}
              value={screenContext}
              onChangeText={setScreenContext}
            />

            {/* Issue Title */}
            <Text style={[styles.inputLabel, { color: colors.primaryText }]}>Issue Summary / Title *</Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: colors.primaryBackground, borderColor: colors.divider, color: colors.primaryText }]}
              placeholder="Brief summary of the issue or feedback"
              placeholderTextColor={colors.secondaryText}
              value={title}
              onChangeText={setTitle}
            />

            {/* Description */}
            <Text style={[styles.inputLabel, { color: colors.primaryText }]}>Details & Steps to Reproduce *</Text>
            <TextInput
              style={[
                styles.textInput,
                styles.textArea,
                { backgroundColor: colors.primaryBackground, borderColor: colors.divider, color: colors.primaryText },
              ]}
              placeholder="Explain what happened, expected behavior, or steps to reproduce..."
              placeholderTextColor={colors.secondaryText}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </ScrollView>

          {/* Footer Submit Action */}
          <View style={[styles.footerRow, { borderTopColor: colors.divider }]}>
            <TouchableOpacity
              style={[styles.cancelBtn, { borderColor: colors.divider }]}
              onPress={onClose}
              disabled={isSubmitting}
            >
              <Text style={[styles.cancelBtnText, { color: colors.secondaryText }]}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: colors.primaryAccent }]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Icon name="send-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.submitBtnText}>Submit to Developer</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalCard: {
    width: "100%",
    maxWidth: 480,
    maxHeight: "88%",
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
    elevation: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  headerSub: {
    fontSize: 11,
    fontWeight: "500",
    marginTop: 1,
  },
  body: {
    padding: 16,
  },
  userTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
  },
  userTagText: {
    fontSize: 11,
    fontWeight: "700",
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 10,
    marginBottom: 6,
  },
  chipRow: {
    flexDirection: "row",
    marginBottom: 6,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    marginRight: 8,
  },
  chipText: {
    fontSize: 11.5,
    fontWeight: "700",
  },
  severityGrid: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 6,
  },
  severityBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  sevDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  sevText: {
    fontSize: 11.5,
    fontWeight: "800",
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
  },
  textArea: {
    minHeight: 80,
    paddingTop: 10,
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  cancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: "600",
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
  },
  submitBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
});

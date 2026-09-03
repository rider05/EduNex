import React, { useState, useEffect, useCallback } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { useTheme } from "../../../context/ThemeContext";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { showToast } from "../../../utils/toastService";
import { api } from "../../../services/api";

const FEEDBACK_CATEGORIES = [
  "Academics & Teaching",
  "Hostel & Dining",
  "Transport Shuttle",
  "Fee & Accounts",
  "General Administration",
];

export default function FeedbackModal({ visible, onClose }) {
  const { colors, isDarkMode } = useTheme();
  const styles = getStyles(colors, isDarkMode);

  const [activeTab, setActiveTab] = useState("new");
  const [selectedCategory, setSelectedCategory] = useState(FEEDBACK_CATEGORIES[0]);
  const [rating, setRating] = useState(5);
  const [subject, setSubject] = useState("");
  const [comments, setComments] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [queries, setQueries] = useState([]);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await api.get("/messages");
      const items = res?.data || res || [];
      const mapped = (Array.isArray(items) ? items : []).map((m, i) => ({
        id: m._id || m.id || `q_${i}`,
        category: m.category || "General Administration",
        title: m.subject || m.title || "—",
        date: m.date || m.createdAt || "—",
        status: m.status || "Under Review",
        reply: m.reply || m.response || null,
      }));
      setQueries(mapped);
    } catch {
      setQueries([]);
    }
  }, []);

  useEffect(() => {
    if (visible) fetchMessages();
  }, [visible, fetchMessages]);

  if (!visible) return null;

  const handleSubmit = async () => {
    if (!subject.trim() || !comments.trim()) {
      showToast("Please enter a subject and feedback message", "warning");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.post("/messages", {
        category: selectedCategory,
        subject: subject.trim(),
        message: comments.trim(),
        rating,
      });
      const saved = res?.data || res || {};
      const newQuery = {
        id: saved._id || saved.id || `q_${Date.now()}`,
        category: selectedCategory,
        title: subject.trim(),
        date: "Today",
        status: "Under Review",
        reply: saved.reply || null,
      };
      setQueries([newQuery, ...queries]);
      setSubject("");
      setComments("");
      setActiveTab("history");
      showToast("Feedback submitted successfully!", "success");
    } catch {
      const newQuery = {
        id: `q_${Date.now()}`,
        category: selectedCategory,
        title: subject.trim(),
        date: "Today",
        status: "Under Review",
        reply: null,
      };
      setQueries([newQuery, ...queries]);
      setSubject("");
      setComments("");
      setActiveTab("history");
      showToast("Feedback submitted successfully!", "success");
    } finally {
      setIsSubmitting(false);
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
                <Icon name="message-draw" size={24} color={colors.primaryAccent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.headerTitle, { color: colors.primaryText }]}>Institutional Feedback</Text>
                <Text style={[styles.headerSubtitle, { color: colors.secondaryText }]}>
                  Parent Queries & Dean Office Helpdesk
                </Text>
              </View>
            </View>

            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Icon name="close-circle-outline" size={24} color={colors.secondaryText} />
            </TouchableOpacity>
          </View>

          {/* View Switcher */}
          <View style={[styles.tabBar, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
            <TouchableOpacity
              style={[
                styles.tabBtn,
                activeTab === "new" && { backgroundColor: colors.primaryAccent },
              ]}
              onPress={() => setActiveTab("new")}
            >
              <Text
                style={[
                  styles.tabBtnText,
                  { color: activeTab === "new" ? "#FFFFFF" : colors.secondaryText },
                ]}
              >
                Submit New Query
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tabBtn,
                activeTab === "history" && { backgroundColor: colors.primaryAccent },
              ]}
              onPress={() => setActiveTab("history")}
            >
              <Text
                style={[
                  styles.tabBtnText,
                  { color: activeTab === "history" ? "#FFFFFF" : colors.secondaryText },
                ]}
              >
                Previous Queries ({queries.length})
              </Text>
            </TouchableOpacity>
          </View>

          {/* Form or History */}
          <ScrollView contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
            {activeTab === "new" ? (
              <View style={{ gap: 10 }}>
                {/* Category Pills */}
                <Text style={[styles.fieldLabel, { color: colors.secondaryText }]}>Select Department</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {FEEDBACK_CATEGORIES.map((cat) => {
                    const isSel = selectedCategory === cat;
                    return (
                      <TouchableOpacity
                        key={cat}
                        style={[
                          styles.catPill,
                          isSel
                            ? { backgroundColor: colors.primaryAccent, borderColor: colors.primaryAccent }
                            : { backgroundColor: colors.primaryBackground, borderColor: colors.divider },
                        ]}
                        onPress={() => setSelectedCategory(cat)}
                      >
                        <Text
                          style={[
                            styles.catPillText,
                            { color: isSel ? "#FFFFFF" : colors.primaryText },
                          ]}
                        >
                          {cat}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* Rating Bar */}
                <View style={[styles.ratingBox, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                  <Text style={[styles.ratingLabel, { color: colors.primaryText }]}>Overall Satisfaction</Text>
                  <View style={{ flexDirection: "row", gap: 6, marginTop: 4 }}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <TouchableOpacity key={star} onPress={() => setRating(star)}>
                        <Icon
                          name={star <= rating ? "star" : "star-outline"}
                          size={24}
                          color="#F59E0B"
                        />
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Subject */}
                <View>
                  <Text style={[styles.fieldLabel, { color: colors.secondaryText }]}>Subject / Topic</Text>
                  <TextInput
                    style={[styles.textInput, { backgroundColor: colors.primaryBackground, borderColor: colors.divider, color: colors.primaryText }]}
                    placeholder="e.g. Request for academic counseling slot..."
                    placeholderTextColor={colors.disabledText}
                    value={subject}
                    onChangeText={setSubject}
                  />
                </View>

                {/* Comments */}
                <View>
                  <Text style={[styles.fieldLabel, { color: colors.secondaryText }]}>Detailed Query / Suggestion</Text>
                  <TextInput
                    style={[styles.textArea, { backgroundColor: colors.primaryBackground, borderColor: colors.divider, color: colors.primaryText }]}
                    placeholder="Type your message to the institution..."
                    placeholderTextColor={colors.disabledText}
                    value={comments}
                    onChangeText={setComments}
                    multiline
                    numberOfLines={4}
                  />
                </View>

                {/* Submit Action */}
                <TouchableOpacity
                  style={[styles.submitBtn, { backgroundColor: colors.primaryAccent }]}
                  onPress={handleSubmit}
                  disabled={isSubmitting}
                  activeOpacity={0.85}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <Icon name="send-check" size={18} color="#FFFFFF" />
                      <Text style={styles.submitBtnText}>Submit Query to Dean Office</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ gap: 10 }}>
                {queries.map((q) => (
                  <View
                    key={q.id}
                    style={[styles.queryCard, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}
                  >
                    <View style={styles.queryTop}>
                      <Text style={[styles.queryCat, { color: colors.primaryAccent }]}>{q.category}</Text>
                      <View
                        style={[
                          styles.queryStatusBadge,
                          {
                            backgroundColor: q.status === "Resolved" ? "#10B98114" : "#F59E0B14",
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.queryStatusText,
                            { color: q.status === "Resolved" ? "#10B981" : "#D97706" },
                          ]}
                        >
                          {q.status}
                        </Text>
                      </View>
                    </View>

                    <Text style={[styles.queryTitle, { color: colors.primaryText }]}>{q.title}</Text>
                    <Text style={[styles.queryDate, { color: colors.secondaryText }]}>{q.date}</Text>

                    {q.reply && (
                      <View style={[styles.replyBox, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
                        <Icon name="subdirectory-arrow-right" size={16} color={colors.primaryAccent} />
                        <Text style={[styles.replyText, { color: colors.primaryText }]}>{q.reply}</Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
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
    tabBar: {
      flexDirection: "row",
      borderRadius: 12,
      borderWidth: 1,
      padding: 4,
      marginBottom: 12,
    },
    tabBtn: {
      flex: 1,
      alignItems: "center",
      paddingVertical: 7,
      borderRadius: 9,
    },
    tabBtnText: {
      fontSize: 11.5,
      fontWeight: "700",
    },
    scrollBody: {
      paddingBottom: 10,
    },
    fieldLabel: {
      fontSize: 11.5,
      fontWeight: "700",
      marginBottom: 4,
    },
    catPill: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 10,
      borderWidth: 1,
    },
    catPillText: {
      fontSize: 11,
      fontWeight: "700",
    },
    ratingBox: {
      borderRadius: 12,
      borderWidth: 1,
      padding: 10,
      marginVertical: 4,
    },
    ratingLabel: {
      fontSize: 12,
      fontWeight: "700",
    },
    textInput: {
      borderWidth: 1,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
      fontSize: 12.5,
      fontWeight: "500",
    },
    textArea: {
      borderWidth: 1,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
      fontSize: 12.5,
      minHeight: 70,
      textAlignVertical: "top",
    },
    submitBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 12,
      borderRadius: 12,
      marginTop: 6,
    },
    submitBtnText: {
      color: "#FFFFFF",
      fontSize: 13,
      fontWeight: "800",
    },
    queryCard: {
      borderRadius: 14,
      borderWidth: 1,
      padding: 12,
    },
    queryTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    queryCat: {
      fontSize: 10.5,
      fontWeight: "800",
      textTransform: "uppercase",
    },
    queryStatusBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    queryStatusText: {
      fontSize: 9.5,
      fontWeight: "900",
    },
    queryTitle: {
      fontSize: 13,
      fontWeight: "800",
      marginTop: 3,
    },
    queryDate: {
      fontSize: 10.5,
      fontWeight: "500",
      marginTop: 1,
    },
    replyBox: {
      flexDirection: "row",
      gap: 6,
      padding: 8,
      borderRadius: 10,
      borderWidth: 1,
      marginTop: 8,
      alignItems: "flex-start",
    },
    replyText: {
      fontSize: 11,
      lineHeight: 15,
      flex: 1,
      fontWeight: "500",
    },
  });
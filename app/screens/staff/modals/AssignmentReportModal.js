// modals/AssignmentReportModal.js
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  Animated,
  Easing,
  TextInput,
  FlatList,
  ActivityIndicator,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { api } from "../../../services/api";

const formatSubmittedOn = (value) => {
  if (!value) return "-";
  try {
    const d = value?.toDate ? value.toDate() : new Date(value);
    if (!isNaN(d)) {
      return d.toLocaleDateString([], { month: "short", day: "numeric" });
    }
  } catch {}
  return "-";
};

const normalizeStatus = (raw) => {
  const s = String(raw || "").toLowerCase();
  if (s.includes("late")) return "Late";
  if (s.includes("pending") || s === "" || s === "-") return "Pending";
  if (s.includes("graded") || s.includes("reviewed")) return "Graded";
  if (s.includes("submit")) return "Submitted";
  return raw || "Pending";
};

const mapReport = (a) => ({
  id: String(a.id || a._id || Math.random()),
  name:
    a.studentName ||
    [a.name, a.roll ? `(${a.roll})` : ""].filter(Boolean).join(" ") ||
    a.studentId ||
    "Unknown student",
  topic: a.title || a.topic || a.assignmentTitle || "Untitled topic",
  status: normalizeStatus(a.status || a.submissionStatus),
  submittedOn: formatSubmittedOn(a.submittedOn || a.submittedAt || a.createdAt),
});

const AssignmentReportModal = ({ visible, onClose, colors }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const [search, setSearch] = useState("");
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/assignments", { sort: "-createdAt", limit: 100 });
      setReports(Array.isArray(res?.data) ? res.data.map(mapReport) : []);
    } catch (err) {
      console.warn("AssignmentReportModal load error:", err?.message || err);
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      loadReports();
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
  }, [visible, fadeAnim, slideAnim, loadReports]);

  // 🔍 Filter student list (server-side q search with local refinement)
  const filteredReports = reports.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase())
  );

  // 🎨 Status color
  const getStatusColor = (status) => {
    switch (status) {
      case "Submitted":
        return "#2ECC71";
      case "Pending":
        return "#F1C40F";
      case "Late":
        return "#E74C3C";
      case "Graded":
        return "#3498DB";
      default:
        return "#95A5A6";
    }
  };

  const renderItem = ({ item }) => (
    <View style={styles.reportCard}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.studentName, { color: colors.primaryText }]}>
          {item.name}
        </Text>
        <Text style={styles.studentDetails}>Topic: {item.topic}</Text>
        <Text style={styles.submittedOn}>Submitted On: {item.submittedOn}</Text>
      </View>
      <View
        style={[
          styles.statusBadge,
          { backgroundColor: `${getStatusColor(item.status)}20` },
        ]}
      >
        <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
          {item.status}
        </Text>
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
              <Icon name="notebook-outline" size={32} color="#E67E22" />
            </View>
            <Text style={[styles.title, { color: "#E67E22" }]}>
              Assignment Reports
            </Text>
          </View>

          <Text style={[styles.subtitle, { color: colors.secondaryText }]}>
            🧾 Track AI & DS student assignment submissions and deadlines.
          </Text>

          {/* Search Bar */}
          <View style={styles.searchBar}>
            <Icon name="magnify" size={20} color="#aaa" />
            <TextInput
              placeholder="Search student..."
              value={search}
              onChangeText={setSearch}
              style={[styles.searchInput, { color: colors.primaryText }]}
              placeholderTextColor="#888"
            />
          </View>

          {/* Assignment List */}
          {loading ? (
            <ActivityIndicator
              size="large"
              color="#E67E22"
              style={{ marginTop: 30, marginBottom: 30 }}
            />
          ) : (
            <FlatList
              data={filteredReports}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              showsVerticalScrollIndicator={false}
              style={{ marginTop: 10, maxHeight: 300 }}
              ListEmptyComponent={
                <Text
                  style={{
                    color: colors.secondaryText,
                    textAlign: "center",
                    marginTop: 40,
                  }}
                >
                  No assignments found 😕
                </Text>
              }
            />
          )}

          {/* Close Button */}
          <Pressable
            style={[styles.closeButton, { backgroundColor: "#E67E22" }]}
            onPress={onClose}
          >
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

// 🎨 Styles
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
    backgroundColor: "#E67E2215",
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
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E67E2208",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#E67E2230",
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
  },
  reportCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#E67E220A",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E67E2220",
  },
  studentName: {
    fontSize: 16,
    fontWeight: "600",
  },
  studentDetails: {
    fontSize: 13,
    color: "#555",
    marginTop: 2,
  },
  submittedOn: {
    fontSize: 12,
    color: "#777",
    marginTop: 1,
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  statusText: {
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

export default AssignmentReportModal;
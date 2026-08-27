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
import { getParentData, getPermits } from "../../../services/dataService";
import { showToast } from "../../../utils/toastService";

export default function EntryExitModal({ visible, onClose }) {
  const { colors, isDarkMode } = useTheme();
  const styles = getStyles(colors, isDarkMode);

  const [filter, setFilter] = useState("All");
  const [wardName, setWardName] = useState("");
  const [rollNo, setRollNo] = useState("");
  const [movements, setMovements] = useState([]);
  const [currentLocation, setCurrentLocation] = useState("—");

  const fetchGateLog = useCallback(async () => {
    try {
      const items = await getPermits();
      const wardRoll = rollNo || "";
      const mapped = (Array.isArray(items) ? items : [])
        .filter((p) => !wardRoll || p.rollNo === wardRoll || p.studentId === wardRoll)
        .map((p, i) => ({
          id: p.id || p._id || String(i),
          time: p.time || p.date || "—",
          location: p.place || p.gate || "Campus",
          action: p.type === "exit" ? "Exit Escort" : "Entry Cleared",
          status: p.status || "granted",
          isEntry: String(p.type || "entry").toLowerCase() === "entry",
        }));
      setMovements(mapped);
      if (mapped.length > 0) {
        const latest = mapped[0];
        setCurrentLocation(latest.location);
      }
    } catch {
      setMovements([]);
    }
  }, [rollNo]);

  useEffect(() => {
    getParentData().then((data) => {
      if (data?.ward) {
        setWardName(data.ward.name || "");
        setRollNo(data.ward.rollNo || "");
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (visible) fetchGateLog();
  }, [visible, fetchGateLog]);

  if (!visible) return null;

  const handleShareLog = async () => {
    try {
      const summary = movements.map(
        (m) => `🕒 ${m.time}\n📍 ${m.location}\n⚡ ${m.action} (${m.status})`
      ).join("\n\n");

      await Share.share({
        title: "Campus Movement & Gate Log",
        message: `🛡️ EDUNEX BIOMETRIC GATE LOG\nWard: ${wardName || "—"} (${rollNo || "—"})\n\n${summary}`,
      });
      showToast("Gate movement log shared!", "success");
    } catch (err) {
      console.log("Share error:", err);
    }
  };

  const filtered = movements.filter((m) => {
    if (filter === "Entries" && !m.isEntry) return false;
    if (filter === "Exits" && m.isEntry) return false;
    return true;
  });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.modalContainer, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
              <View style={[styles.iconWrap, { backgroundColor: "#10B98118" }]}>
                <Icon name="door-open" size={24} color="#10B981" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.headerTitle, { color: colors.primaryText }]}>Campus Presence & Gate Log</Text>
                <Text style={[styles.headerSubtitle, { color: colors.secondaryText }]}>
                  Biometric Turnstile Scans · {wardName || "—"}
                </Text>
              </View>
            </View>

            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Icon name="close-circle-outline" size={24} color={colors.secondaryText} />
            </TouchableOpacity>
          </View>

          {/* Real-time Status Badge */}
          <View style={[styles.liveStatusBadge, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
            <View style={styles.pulseDot} />
            <Text style={[styles.liveStatusText, { color: colors.primaryText }]}>
              Current Location: <Text style={{ color: "#10B981", fontWeight: "800" }}>{currentLocation}</Text>
            </Text>
          </View>

          {/* Filter Pills */}
          <View style={styles.filterRow}>
            {["All", "Entries", "Exits"].map((f) => {
              const isSel = filter === f;
              return (
                <TouchableOpacity
                  key={f}
                  style={[
                    styles.filterPill,
                    isSel
                      ? { backgroundColor: colors.primaryAccent, borderColor: colors.primaryAccent }
                      : { backgroundColor: colors.primaryBackground, borderColor: colors.divider },
                  ]}
                  onPress={() => setFilter(f)}
                >
                  <Text style={[styles.filterPillText, { color: isSel ? "#FFFFFF" : colors.secondaryText }]}>
                    {f}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Timeline List */}
          <ScrollView contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
            {filtered.map((item) => (
              <View
                key={item.id}
                style={[styles.movementCard, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}
              >
                <View
                  style={[
                    styles.iconCircle,
                    { backgroundColor: item.isEntry ? "#10B98118" : "#EF444418" },
                  ]}
                >
                  <Icon
                    name={item.isEntry ? "login-variant" : "logout-variant"}
                    size={20}
                    color={item.isEntry ? "#10B981" : "#EF4444"}
                  />
                </View>

                <View style={{ flex: 1, marginLeft: 12 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={[styles.actionTitle, { color: colors.primaryText }]}>{item.action}</Text>
                    <Text style={[styles.movementTime, { color: colors.secondaryText }]}>{item.time}</Text>
                  </View>

                  <Text style={[styles.locationText, { color: colors.secondaryText }]}>
                    📍 {item.location}
                  </Text>

                  <View style={styles.statusTag}>
                    <Text style={[styles.statusTagText, { color: item.isEntry ? "#10B981" : "#EF4444" }]}>
                      {item.status}
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
              onPress={handleShareLog}
              activeOpacity={0.85}
            >
              <Icon name="share-variant" size={16} color="#FFFFFF" />
              <Text style={styles.shareBtnText}>Share Movement Log</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.closeModalBtn, { borderColor: colors.divider }]}
              onPress={onClose}
            >
              <Text style={[styles.closeModalBtnText, { color: colors.primaryText }]}>Close</Text>
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
      marginBottom: 10,
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
    liveStatusBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      borderWidth: 1,
      marginBottom: 10,
    },
    pulseDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: "#10B981",
    },
    liveStatusText: {
      fontSize: 11.5,
      fontWeight: "600",
    },
    filterRow: {
      flexDirection: "row",
      gap: 6,
      marginBottom: 10,
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
      gap: 8,
      paddingBottom: 10,
    },
    movementCard: {
      flexDirection: "row",
      alignItems: "flex-start",
      borderRadius: 14,
      borderWidth: 1,
      padding: 12,
    },
    iconCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: "center",
      alignItems: "center",
    },
    actionTitle: {
      fontSize: 13,
      fontWeight: "800",
    },
    movementTime: {
      fontSize: 10.5,
      fontWeight: "500",
    },
    locationText: {
      fontSize: 11,
      fontWeight: "500",
      marginTop: 2,
    },
    statusTag: {
      marginTop: 4,
    },
    statusTagText: {
      fontSize: 10,
      fontWeight: "800",
    },
    footerRow: {
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
    closeModalBtn: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
    },
    closeModalBtnText: {
      fontSize: 13,
      fontWeight: "800",
    },
  });
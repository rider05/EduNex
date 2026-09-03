import React, { useEffect, useState, useCallback } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
} from "react-native";
import { useTheme } from "../../../context/ThemeContext";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { LinearGradient } from "expo-linear-gradient";
import { getStudentFees } from "../../../services/dataService";

export default function FeesModal({ visible, onClose }) {
  const { colors } = useTheme();
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  const [feesData, setFeesData] = useState({ due: 0, dueDate: "—" });
  const [daysLeft, setDaysLeft] = useState(0);

  const loadFees = useCallback(async () => {
    try {
      const fees = await getStudentFees();
      const due = Number(fees?.due) || 0;
      const dueDateStr = fees?.dueDate || fees?.dueInvoices?.[0]?.dueDate || "";
      setFeesData({ due, dueDate: dueDateStr || "—" });

      if (dueDateStr) {
        const dueDate = new Date(dueDateStr);
        const today = new Date();
        const diff = Math.max(0, Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24)));
        setDaysLeft(diff);
      } else {
        setDaysLeft(30);
      }
    } catch {
      setFeesData({ due: 0, dueDate: "—" });
    }
  }, []);

  useEffect(() => {
    if (visible) {
      loadFees();
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
    } else {
      fadeAnim.setValue(0);
    }
  }, [visible, fadeAnim, loadFees]);

  const getDueColor = () => {
    if (daysLeft > 10) return "#2ECC71";
    if (daysLeft > 5) return "#F1C40F";
    if (daysLeft > 2) return "#E67E22";
    return "#E74C3C";
  };

  const dueColor = getDueColor();
  const dueAmount = feesData.due > 0 ? `₹ ${feesData.due.toLocaleString("en-IN")}` : "No Dues";

  return (
    <Modal visible={visible} transparent animationType="none">
      <Animated.View style={[styles.overlay, { opacity: fadeAnim, backgroundColor: "rgba(0,0,0,0.5)" }]}>
        <View style={[styles.modalContainer, { backgroundColor: colors.cardBackground }]}>
          <LinearGradient colors={[colors.primaryAccent, colors.primaryAccent + "CC"]} style={styles.header}>
            <Icon name="cash-multiple" size={32} color="#fff" />
            <Text style={styles.headerText}>Fees Overview</Text>
            <TouchableOpacity onPress={onClose}>
              <Icon name="close-circle" size={26} color="#fff" />
            </TouchableOpacity>
          </LinearGradient>

          <View style={styles.body}>
            <View style={styles.section}>
              <View style={[styles.iconBox, { backgroundColor: colors.primaryAccent + "22" }]}>
                <Icon name="currency-inr" size={24} color={colors.primaryAccent} />
              </View>
              <View style={styles.sectionText}>
                <Text style={[styles.title, { color: colors.primaryText }]}>Total Pending Fees</Text>
                <Text style={[styles.value, { color: dueColor }]}>{dueAmount}</Text>
              </View>
            </View>

            <View style={[styles.separator, { backgroundColor: colors.secondaryText + "22" }]} />

            <View style={styles.section}>
              <View style={[styles.iconBox, { backgroundColor: colors.primaryAccent + "22" }]}>
                <Icon name="calendar" size={24} color={colors.primaryAccent} />
              </View>
              <View style={styles.sectionText}>
                <Text style={[styles.title, { color: colors.primaryText }]}>Due Date</Text>
                <Text style={[styles.value, { color: colors.secondaryText }]}>{feesData.dueDate}</Text>
              </View>
            </View>

            <View style={[styles.separator, { backgroundColor: colors.secondaryText + "22" }]} />

            <View style={styles.section}>
              <View style={[styles.iconBox, { backgroundColor: dueColor + "22" }]}>
                <Icon name="alert-decagram-outline" size={24} color={dueColor} />
              </View>
              <View style={styles.sectionText}>
                <Text style={[styles.title, { color: colors.primaryText }]}>Payment Status</Text>
                <Text style={[styles.value, { color: dueColor }]}>
                  {feesData.due > 0
                    ? daysLeft > 0
                      ? `${daysLeft} day${daysLeft > 1 ? "s" : ""} left`
                      : "Overdue!"
                    : "All Paid"}
                </Text>
              </View>
            </View>

            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <Animated.View
                  style={[
                    styles.progressFill,
                    {
                      backgroundColor: dueColor,
                      width: `${feesData.due > 0 ? Math.min(100, Math.max(5, 100 - (daysLeft / 30) * 100)) : 100}%`,
                    },
                  ]}
                />
              </View>
            </View>

            <Text style={[styles.note, { color: colors.secondaryText }]}>
              Pay your fees before the due date to avoid penalties.
            </Text>
          </View>

          <TouchableOpacity style={[styles.closeButton, { backgroundColor: colors.primaryAccent }]} onPress={onClose} activeOpacity={0.8}>
            <Icon name="check-circle-outline" size={18} color="#fff" />
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "center", alignItems: "center" },
  modalContainer: { width: "85%", borderRadius: 18, overflow: "hidden", elevation: 12 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 14 },
  headerText: { color: "#fff", fontWeight: "700", fontSize: 18 },
  body: { padding: 15 },
  section: { flexDirection: "row", alignItems: "center", marginVertical: 10 },
  iconBox: { width: 45, height: 45, borderRadius: 25, alignItems: "center", justifyContent: "center" },
  sectionText: { marginLeft: 12, flex: 1 },
  title: { fontSize: 15, fontWeight: "600", marginBottom: 2 },
  value: { fontSize: 16, fontWeight: "700" },
  separator: { height: 1, marginHorizontal: 5, marginVertical: 4, borderRadius: 1 },
  progressContainer: { marginTop: 8, width: "100%" },
  progressBar: { width: "100%", height: 8, borderRadius: 5, backgroundColor: "rgba(255,255,255,0.1)", overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 5 },
  note: { fontSize: 13, textAlign: "center", marginTop: 10, fontStyle: "italic" },
  closeButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 12 },
  closeText: { fontSize: 15, fontWeight: "700", color: "#fff", marginLeft: 6 },
});

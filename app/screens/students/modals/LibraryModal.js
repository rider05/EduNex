import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  ScrollView,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../../../context/ThemeContext";
import { getStudentLibrary } from "../../../services/dataService";

export default function LibraryModal({ visible, onClose }) {
  const { colors } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const [borrowedBooks, setBorrowedBooks] = useState([]);
  const [fine, setFine] = useState({ amount: 0, dueDate: "" });

  const loadLibrary = useCallback(async () => {
    try {
      const lib = await getStudentLibrary();
      setBorrowedBooks(Array.isArray(lib?.borrowedBooks) ? lib.borrowedBooks : []);
      if (lib?.fine) {
        setFine({
          amount: Number(lib.fine.amount) || 0,
          dueDate: lib.fine.dueDate || "",
        });
      }
    } catch {
      setBorrowedBooks([]);
      setFine({ amount: 0, dueDate: "" });
    }
  }, []);

  useEffect(() => {
    if (visible) {
      loadLibrary();
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
    } else {
      fadeAnim.setValue(0);
    }
  }, [visible, fadeAnim, loadLibrary]);

  return (
    <Modal transparent visible={visible} animationType="none">
      <Animated.View
        style={[styles.overlay, { backgroundColor: colors.overlayBackground || "rgba(0,0,0,0.5)", opacity: fadeAnim }]}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.cardBackground }]}>
          <LinearGradient colors={[colors.primaryAccent, colors.primaryAccent + "CC"]} style={styles.headerBar}>
            <Icon name="library" size={24} color="#fff" />
            <Text style={styles.headerText}>Library Details</Text>
            <TouchableOpacity onPress={onClose}>
              <Icon name="close-circle" size={26} color="#fff" />
            </TouchableOpacity>
          </LinearGradient>

          <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
            <View style={styles.section}>
              <View style={[styles.sectionIcon, { backgroundColor: colors.primaryAccent + "22" }]}>
                <Icon name="book-open-page-variant" size={26} color={colors.primaryAccent} />
              </View>
              <View style={styles.sectionContent}>
                <Text style={[styles.title, { color: colors.primaryText }]}>Borrowed Books</Text>
                {borrowedBooks.length === 0 ? (
                  <Text style={[styles.desc, { color: colors.secondaryText }]}>No books currently borrowed.</Text>
                ) : (
                  borrowedBooks.map((book, index) => (
                    <Text key={index} style={[styles.desc, { color: colors.secondaryText }]}>
                      • {book.title} — Due in {book.due}
                    </Text>
                  ))
                )}
              </View>
            </View>

            <View style={[styles.separator, { backgroundColor: colors.secondaryText + "22" }]} />

            <View style={styles.section}>
              <View style={[styles.sectionIcon, { backgroundColor: "#E74C3C22" }]}>
                <Icon name="clock-alert-outline" size={26} color="#E74C3C" />
              </View>
              <View style={styles.sectionContent}>
                <Text style={[styles.title, { color: colors.primaryText }]}>Pending Fine</Text>
                {fine.amount > 0 ? (
                  <Text style={[styles.desc, { color: colors.secondaryText }]}>
                    ₹{fine.amount.toLocaleString("en-IN")} — Pay before {fine.dueDate}
                  </Text>
                ) : (
                  <Text style={[styles.desc, { color: colors.secondaryText }]}>No pending fines.</Text>
                )}
              </View>
            </View>

            <View style={[styles.separator, { backgroundColor: colors.secondaryText + "22" }]} />

            <View style={styles.section}>
              <View style={[styles.sectionIcon, { backgroundColor: "#2ECC7122" }]}>
                <Icon name="lightbulb-on-outline" size={26} color="#2ECC71" />
              </View>
              <View style={styles.sectionContent}>
                <Text style={[styles.title, { color: colors.primaryText }]}>Reading Reminder</Text>
                <Text style={[styles.desc, { color: colors.secondaryText }]}>
                  Return or renew your books on time to avoid fines.
                </Text>
              </View>
            </View>
          </ScrollView>

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
  headerBar: { width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 14 },
  headerText: { color: "#fff", fontWeight: "700", fontSize: 18 },
  section: { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 15, marginVertical: 12 },
  sectionIcon: { width: 45, height: 45, borderRadius: 25, justifyContent: "center", alignItems: "center" },
  sectionContent: { flex: 1, marginLeft: 12 },
  title: { fontSize: 16, fontWeight: "700", marginBottom: 4 },
  desc: { fontSize: 14, lineHeight: 20 },
  separator: { height: 1, marginHorizontal: 18, marginVertical: 6, borderRadius: 1 },
  closeButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 12 },
  closeText: { fontSize: 15, fontWeight: "700", color: "#fff", marginLeft: 6 },
});

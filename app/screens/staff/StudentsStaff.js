import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Modal,
  Pressable,
  Linking,
  RefreshControl,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { useTheme } from "../../context/ThemeContext";
import { SkeletonListItem, SkeletonBox } from "../../components/common/SkeletonLoader";
import { getFacultyRoster, getStaffClassName } from "../../services/dataService";
import useRefreshOnForeground from "../../hooks/useRefreshOnForeground";

export default function StudentsStaff() {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [students, setStudents] = useState([]);
  const [className, setClassName] = useState("");
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [bottomMenuVisible, setBottomMenuVisible] = useState(false);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [callConfirmVisible, setCallConfirmVisible] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const cls = await getStaffClassName();
      setClassName(cls || "");
      const roster = await getFacultyRoster(cls || undefined);
      if (roster && roster.length > 0) {
        setStudents(
          roster.map((s, idx) => ({
            id: s.id || String(idx + 1),
            name: s.name || "",
            roll: s.roll || s.rollNo || "",
            cgpa: s.cgpa != null ? String(s.cgpa) : "—",
            attendance: s.attendance?.percentage || (s.attendance ? String(s.attendance) : "—"),
            phone: s.phone || "—",
            parentPhone: s.parentPhone || "—",
            parentName: s.parentName || s.parent?.name || "Parent",
          }))
        );
      } else {
        setStudents([]);
      }
    } catch (err) {
      console.log("Error loading students list:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Refetch roster when the app returns to the foreground
  useRefreshOnForeground(loadData);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setSearchText("");
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const filteredStudents = students.filter(
    (s) =>
      s.name.toLowerCase().includes(searchText.toLowerCase()) ||
      s.roll.toLowerCase().includes(searchText.toLowerCase())
  );

  const handleStudentPress = (student) => {
    setSelectedStudent(student);
    setBottomMenuVisible(true);
  };

  const confirmCall = async () => {
    setCallConfirmVisible(false);
    const phone = selectedStudent?.phone;
    if (!phone) return;

    const supported = await Linking.canOpenURL(`tel:${phone}`);
    if (supported) {
      Linking.openURL(`tel:${phone}`);
    } else {
      console.log("Please install a dialer package like com.android.dialer");
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 80 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
            progressBackgroundColor={colors.cardBackground}
          />
        }
      >
        {/* Header */}
        <Text style={styles.header}>{className ? `${className} Students` : "Students"}</Text>
        <Text style={styles.subHeader}>
          Manage and view student details for your department.
        </Text>

        {/* Search Bar */}
        <View style={styles.searchBar}>
          <Icon name="magnify" size={22} color={colors.secondaryText} />
          <TextInput
            style={[styles.searchInput, { color: colors.primaryText }]}
            placeholder="Search by name or roll number"
            placeholderTextColor={colors.secondaryText}
            value={searchText}
            onChangeText={setSearchText}
          />
        </View>

        {isLoading ? (
          <View style={{ marginTop: 14 }}>
            <SkeletonBox width="45%" height={16} style={{ marginBottom: 12 }} />
            <SkeletonListItem />
            <SkeletonListItem />
            <SkeletonListItem />
            <SkeletonListItem />
          </View>
        ) : (
          <>
            <Text style={styles.sectionTitle}>
              {filteredStudents.length} Students Found
            </Text>

            {/* Student Cards */}
            {filteredStudents.map((student) => (
              <TouchableOpacity
                key={student.id}
                activeOpacity={0.9}
                style={[styles.studentCard, { borderLeftColor: colors.primaryAccent }]}
                onPress={() => handleStudentPress(student)}
              >
                <View style={styles.cardContent}>
                  <View>
                    <Text style={styles.studentName}>{student.name}</Text>
                    <Text style={styles.rollNo}>🎓 {student.roll}</Text>
                    <Text style={styles.classText}>🏫 {student.class}</Text>
                    <Text style={styles.phoneText}>📞 {student.phone}</Text>
                  </View>
                  <View style={styles.iconContainer}>
                    <Icon
                      name="dots-horizontal-circle-outline"
                      size={28}
                      color={colors.primaryAccent}
                    />
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* 🧭 Bottom Menu Popup */}
      <Modal visible={bottomMenuVisible} transparent animationType="slide">
        <View style={styles.bottomOverlay}>
          <View style={[styles.bottomSheet, { backgroundColor: colors.cardBackground }]}>
            <View style={styles.bottomHeader}>
              <Icon name="account-circle" size={45} color={colors.primaryAccent} />
              <View>
                <Text style={[styles.bottomName, { color: colors.primaryText }]}>
                  {selectedStudent?.name}
                </Text>
                <Text style={[styles.bottomSub, { color: colors.secondaryText }]}>
                  {selectedStudent?.roll} • {selectedStudent?.class}
                </Text>
              </View>
            </View>

            {/* Left & Right Buttons */}
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.menuButton, { borderColor: colors.primaryAccent }]}
                onPress={() => {
                  setBottomMenuVisible(false);
                  setDetailsVisible(true);
                }}
              >
                <Icon name="information-outline" size={20} color={colors.primaryAccent} />
                <Text style={[styles.menuText, { color: colors.primaryAccent }]}>
                  View Details
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.menuButton, { borderColor: "#2ECC71" }]}
                onPress={() => {
                  setBottomMenuVisible(false);
                  setCallConfirmVisible(true);
                }}
              >
                <Icon name="phone" size={20} color="#2ECC71" />
                <Text style={[styles.menuText, { color: "#2ECC71" }]}>Call Student</Text>
              </TouchableOpacity>
            </View>

            {/* Close Button */}
            <Pressable
              style={[styles.closeBtn, { backgroundColor: colors.primaryAccent }]}
              onPress={() => setBottomMenuVisible(false)}
            >
              <Text style={styles.closeText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* 🧾 Details Popup */}
      <Modal visible={detailsVisible} transparent animationType="slide">
        <View style={styles.bottomOverlay}>
          <View style={[styles.detailsSheet, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.detailsTitle, { color: colors.primaryAccent }]}>
              Student Details
            </Text>
            <View style={styles.detailsContent}>
              <Text style={[styles.detailsLabel, { color: colors.secondaryText }]}>Name</Text>
              <Text style={[styles.detailsValue, { color: colors.primaryText }]}>
                {selectedStudent?.name}
              </Text>

              <Text style={[styles.detailsLabel, { color: colors.secondaryText }]}>
                Roll Number
              </Text>
              <Text style={[styles.detailsValue, { color: colors.primaryText }]}>
                {selectedStudent?.roll}
              </Text>

              <Text style={[styles.detailsLabel, { color: colors.secondaryText }]}>Class</Text>
              <Text style={[styles.detailsValue, { color: colors.primaryText }]}>
                {selectedStudent?.class}
              </Text>

              <Text style={[styles.detailsLabel, { color: colors.secondaryText }]}>Phone</Text>
              <Text style={[styles.detailsValue, { color: "#2ECC71" }]}>
                {selectedStudent?.phone}
              </Text>
            </View>

            <Pressable
              style={[styles.closeBtn, { backgroundColor: colors.primaryAccent }]}
              onPress={() => setDetailsVisible(false)}
            >
              <Text style={styles.closeText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ☎️ Call Confirmation */}
      <Modal visible={callConfirmVisible} transparent animationType="fade">
        <View style={styles.popupOverlay}>
          <View style={[styles.popupContainer, { backgroundColor: colors.cardBackground }]}>
            <Icon name="phone-classic" size={45} color="#2ECC71" />
            <Text style={[styles.popupTitle, { color: colors.primaryText }]}>Confirm Call</Text>
            <Text style={[styles.popupMessage, { color: colors.secondaryText }]}>
              Would you like to call{" "}
              <Text style={{ color: colors.primaryAccent, fontWeight: "700" }}>
                {selectedStudent?.name}
              </Text>
              ?
            </Text>

            <View style={styles.popupButtons}>
              <Pressable
                onPress={() => setCallConfirmVisible(false)}
                style={[styles.cancelBtn, { backgroundColor: "#E74C3C" }]}
              >
                <Text style={styles.popupBtnText}>No</Text>
              </Pressable>
              <Pressable
                onPress={confirmCall}
                style={[styles.confirmBtn, { backgroundColor: "#2ECC71" }]}
              >
                <Text style={styles.popupBtnText}>Yes</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const getStyles = (colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.primaryBackground,
      paddingTop: 80,
      paddingHorizontal: 18,
    },
    header: { fontSize: 28, fontWeight: "800", color: colors.primaryAccent, marginBottom: 5 },
    subHeader: { fontSize: 15, color: colors.secondaryText, marginBottom: 18 },
    searchBar: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.cardBackground,
      borderRadius: 12,
      paddingHorizontal: 12,
      marginBottom: 20,
      elevation: 2,
    },
    searchInput: { flex: 1, paddingVertical: 10, paddingHorizontal: 8, fontSize: 15 },
    sectionTitle: { fontSize: 18, fontWeight: "700", color: colors.primaryText, marginBottom: 10 },
    studentCard: {
      backgroundColor: colors.cardBackground,
      borderRadius: 14,
      paddingVertical: 15,
      paddingHorizontal: 15,
      marginBottom: 12,
      elevation: 3,
      borderLeftWidth: 5,
    },
    cardContent: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    studentName: { fontSize: 17, fontWeight: "700", color: colors.primaryText },
    rollNo: { fontSize: 14, color: colors.secondaryText },
    classText: { fontSize: 14, color: colors.secondaryText, marginTop: 2 },
    phoneText: { fontSize: 14, color: "#2ECC71", marginTop: 2 },
    iconContainer: { paddingLeft: 10 },

    bottomOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
    bottomSheet: { borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: 20, elevation: 10 },
    bottomHeader: { flexDirection: "row", alignItems: "center", gap: 15, marginBottom: 20 },
    bottomName: { fontSize: 19, fontWeight: "700" },
    bottomSub: { fontSize: 14 },
    buttonRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 15, gap: 10 },
    menuButton: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1.5,
      borderRadius: 10,
      paddingVertical: 12,
      paddingHorizontal: 15,
      justifyContent: "center",
      flex: 1,
      gap: 8,
    },
    menuText: { fontWeight: "700", fontSize: 15 },
    closeBtn: { alignItems: "center", paddingVertical: 12, borderRadius: 10 },
    closeText: { color: "#fff", fontWeight: "700", fontSize: 15 },

    detailsSheet: { borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: 20 },
    detailsTitle: { fontSize: 20, fontWeight: "800", marginBottom: 10 },
    detailsContent: { marginBottom: 20 },
    detailsLabel: { fontSize: 13, marginTop: 10 },
    detailsValue: { fontSize: 15, fontWeight: "600", marginTop: 2 },

    popupOverlay: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "rgba(0,0,0,0.4)",
    },
    popupContainer: {
      width: "80%",
      borderRadius: 18,
      padding: 25,
      alignItems: "center",
      elevation: 10,
    },
    popupTitle: { fontSize: 20, fontWeight: "800", marginTop: 10 },
    popupMessage: {
      fontSize: 15,
      textAlign: "center",
      marginVertical: 10,
      lineHeight: 22,
    },
    popupButtons: { flexDirection: "row", gap: 15, marginTop: 10 },
    cancelBtn: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 10 },
    confirmBtn: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 10 },
    popupBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  });
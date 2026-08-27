import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Modal,
  Linking,
  RefreshControl,
  Share,
  Alert,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { useTheme } from "../../context/ThemeContext";
import { SkeletonListItem } from "../../components/common/SkeletonLoader";
import { getFacultyRoster, getStaffClassName } from "../../services/dataService";
import useRefreshOnForeground from "../../hooks/useRefreshOnForeground";
import { showToast } from "../../utils/toastService";

const DEFAULT_STUDENTS = [];

const FILTER_TABS = ["All Students", "Section A", "Section B", "Mentee Wards", "Critical Attendance"];

export default function StudentsStaff() {
  const { colors, isDarkMode } = useTheme();
  const styles = getStyles(colors, isDarkMode);

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [students, setStudents] = useState(DEFAULT_STUDENTS);
  const [selectedFilter, setSelectedFilter] = useState("All Students");

  // Modals
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [callConfirmVisible, setCallConfirmVisible] = useState(false);
  const [callTarget, setCallTarget] = useState({ name: "", phone: "", role: "" });

  const loadData = useCallback(async () => {
    try {
      const cls = await getStaffClassName();
      const roster = await getFacultyRoster(cls || undefined);
      if (roster && roster.length > 0) {
        setStudents(
          roster.map((s, idx) => ({
            id: s.id || String(idx + 1),
            name: s.name || `Student ${idx + 1}`,
            roll: s.roll || s.rollNo || "—",
            regNo: s.regNo || "—",
            section: s.section || (idx % 2 === 0 ? "Section A" : "Section B"),
            cgpa: s.cgpa != null ? String(s.cgpa) : "—",
            attendance: s.attendance?.percentage || (s.attendance ? String(s.attendance) : "—"),
            attendanceStatus: s.attendance?.percentage && parseFloat(s.attendance.percentage) < 75 ? "Critical (<75%)" : "Safe",
            phone: s.phone || "—",
            parentName: s.parentName || s.parent?.name || "Parent / Guardian",
            parentPhone: s.parentPhone || s.parent?.phone || "—",
            email: s.email || `${s.name?.toLowerCase().replace(/\s+/g, ".")}@edunex.edu.in`,
            hostel: s.hostel || "—",
            bloodGroup: s.bloodGroup || "—",
            ciaScore: s.ciaScore || "—",
            mentorStatus: s.mentorStatus || s.mentorWard || (s.isMentee ? "Mentee Ward" : "Regular Student"),
            isMentee: s.isMentee || s.mentorWard === "Mentee Ward" || false,
          }))
        );
      }
    } catch (err) {
      console.log("Error loading students directory:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useRefreshOnForeground(loadData);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setSearchText("");
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      // Tab filter
      if (selectedFilter === "Section A" && s.section !== "Section A") return false;
      if (selectedFilter === "Section B" && s.section !== "Section B") return false;
      if (selectedFilter === "Mentee Wards" && !s.isMentee) return false;
      if (selectedFilter === "Critical Attendance" && !s.attendanceStatus.includes("Critical")) return false;

      // Text search
      if (searchText.trim()) {
        const q = searchText.toLowerCase().trim();
        const matchName = s.name.toLowerCase().includes(q);
        const matchRoll = s.roll.toLowerCase().includes(q);
        const matchReg = s.regNo.toLowerCase().includes(q);
        if (!matchName && !matchRoll && !matchReg) return false;
      }
      return true;
    });
  }, [students, selectedFilter, searchText]);

  const handleOpenDetails = (student) => {
    setSelectedStudent(student);
    setDetailsVisible(true);
  };

  const handleInitiateCall = (name, phone, role) => {
    if (!phone || phone === "—") {
      Alert.alert("Contact Not Available", `Phone number for ${name} is not on record.`);
      return;
    }
    setCallTarget({ name, phone, role });
    setCallConfirmVisible(true);
  };

  const confirmCall = async () => {
    setCallConfirmVisible(false);
    if (!callTarget.phone) return;
    Linking.openURL(`tel:${callTarget.phone}`).catch(() => {
      Alert.alert("Dialer Error", `Cannot dial ${callTarget.phone}`);
    });
  };

  const handleShareStudentDossier = async (student) => {
    try {
      await Share.share({
        title: `Student Dossier - ${student.name}`,
        message: `🎓 EDUNEX STUDENT ACADEMIC DOSSIER\nStudent: ${student.name} (${student.roll})\nReg No: ${student.regNo}\nClass: ${student.section} · ${student.department || student.program || "B.Tech"}\nCGPA: ${student.cgpa} / 10.0\nAttendance: ${student.attendance} (${student.attendanceStatus})\nCIA-1 Score: ${student.ciaScore}\nGuardian: ${student.parentName} (${student.parentPhone})\nStatus: ACTIVE & ENROLLED`,
      });
      showToast("Student dossier shared!", "success");
    } catch (err) {
      console.log("Share error:", err);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.primaryBackground }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primaryAccent]}
            tintColor={colors.primaryAccent}
            progressBackgroundColor={colors.cardBackground}
          />
        }
      >
        {/* ========================================================================= */}
        {/* 1. HEADER                                                                 */}
        {/* ========================================================================= */}
        <View style={styles.headerRow}>
          <View style={[styles.headerIconWrap, { backgroundColor: colors.primaryAccent + "18" }]}>
            <Icon name="account-group" size={24} color={colors.primaryAccent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: colors.primaryText }]}>Student Directory</Text>
            <Text style={[styles.headerSub, { color: colors.secondaryText }]}>
              Department Mentorship Roster & Academic Files
            </Text>
          </View>
        </View>

        {/* Filter Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6, marginBottom: 12 }}
        >
          {FILTER_TABS.map((tab) => {
            const isSel = selectedFilter === tab;
            return (
              <TouchableOpacity
                key={tab}
                style={[
                  styles.filterPill,
                  isSel
                    ? { backgroundColor: colors.primaryAccent, borderColor: colors.primaryAccent }
                    : { backgroundColor: colors.cardBackground, borderColor: colors.divider },
                ]}
                onPress={() => setSelectedFilter(tab)}
              >
                <Text style={[styles.filterPillText, { color: isSel ? "#FFFFFF" : colors.primaryText }]}>
                  {tab}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Search Bar */}
        <View style={[styles.searchBar, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
          <Icon name="magnify" size={20} color={colors.secondaryText} />
          <TextInput
            style={[styles.searchInput, { color: colors.primaryText }]}
            placeholder="Search by student name, roll or reg no..."
            placeholderTextColor={colors.disabledText}
            value={searchText}
            onChangeText={setSearchText}
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => setSearchText("")}>
              <Icon name="close-circle" size={16} color={colors.secondaryText} />
            </TouchableOpacity>
          )}
        </View>

        {isLoading ? (
          <View style={{ marginTop: 10 }}>
            <SkeletonListItem />
            <SkeletonListItem />
            <SkeletonListItem />
            <SkeletonListItem />
          </View>
        ) : (
          <>
            <View style={styles.countRow}>
              <Text style={[styles.countText, { color: colors.secondaryText }]}>
                Showing <Text style={{ color: colors.primaryText, fontWeight: "800" }}>{filteredStudents.length}</Text> enrolled students
              </Text>
            </View>

            {/* ========================================================================= */}
            {/* 2. STUDENT CARDS LIST                                                     */}
            {/* ========================================================================= */}
            <View style={{ gap: 10 }}>
              {filteredStudents.map((student) => {
                const isCritical = student.attendanceStatus.includes("Critical");
                return (
                  <View
                    key={student.id}
                    style={[
                      styles.studentCard,
                      {
                        backgroundColor: colors.cardBackground,
                        borderColor: isCritical ? "#EF444455" : colors.divider,
                      },
                    ]}
                  >
                    <View style={styles.cardTop}>
                      <View
                        style={[
                          styles.avatarCircle,
                          { backgroundColor: isCritical ? "#EF4444" : colors.primaryAccent },
                        ]}
                      >
                        <Text style={styles.avatarText}>
                          {student.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .slice(0, 2)}
                        </Text>
                      </View>

                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                          <Text style={[styles.studentName, { color: colors.primaryText }]} numberOfLines={1}>
                            {student.name}
                          </Text>
                          {student.isMentee && (
                            <View style={styles.menteeBadge}>
                              <Icon name="star" size={10} color="#F59E0B" />
                              <Text style={styles.menteeBadgeText}>MENTEE</Text>
                            </View>
                          )}
                        </View>

                        <Text style={[styles.studentRoll, { color: colors.secondaryText }]}>
                          {student.roll} · {student.section}
                        </Text>
                      </View>
                    </View>

                    {/* Micro Performance Badges */}
                    <View style={[styles.microStatsRow, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                      <View style={styles.microStat}>
                        <Text style={[styles.microLabel, { color: colors.secondaryText }]}>CGPA</Text>
                        <Text style={[styles.microVal, { color: colors.primaryText }]}>{student.cgpa} / 10.0</Text>
                      </View>

                      <View style={styles.microStat}>
                        <Text style={[styles.microLabel, { color: colors.secondaryText }]}>Attendance</Text>
                        <Text style={[styles.microVal, { color: isCritical ? "#EF4444" : "#10B981" }]}>
                          {student.attendance}
                        </Text>
                      </View>

                      <View style={styles.microStat}>
                        <Text style={[styles.microLabel, { color: colors.secondaryText }]}>CIA Marks</Text>
                        <Text style={[styles.microVal, { color: "#4F46E5" }]}>{student.ciaScore}</Text>
                      </View>
                    </View>

                    {/* Footer Actions */}
                    <View style={[styles.cardBottom, { borderTopColor: colors.divider }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.parentNameText, { color: colors.secondaryText }]} numberOfLines={1}>
                          👨‍👩‍👧 {student.parentName}
                        </Text>
                      </View>

                      <View style={styles.actionsGroup}>
                        <TouchableOpacity
                          style={[styles.actionIconBtn, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}
                          onPress={() => handleInitiateCall(student.name, student.phone, "Student")}
                          activeOpacity={0.8}
                        >
                          <Icon name="phone" size={15} color={colors.primaryAccent} />
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.actionIconBtn, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}
                          onPress={() => handleInitiateCall(student.parentName, student.parentPhone, "Parent / Guardian")}
                          activeOpacity={0.8}
                        >
                          <Icon name="phone-outgoing" size={15} color="#10B981" />
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.detailsBtn, { backgroundColor: colors.primaryAccent }]}
                          onPress={() => handleOpenDetails(student)}
                          activeOpacity={0.85}
                        >
                          <Text style={styles.detailsBtnText}>Dossier</Text>
                          <Icon name="chevron-right" size={14} color="#FFFFFF" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ========================================================================= */}
      {/* 3. STUDENT ACADEMIC DOSSIER MODAL                                         */}
      {/* ========================================================================= */}
      {selectedStudent && (
        <Modal
          visible={detailsVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setDetailsVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
              <View style={styles.modalHeaderRow}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                  <View style={[styles.avatarCircle, { backgroundColor: colors.primaryAccent }]}>
                    <Text style={styles.avatarText}>
                      {selectedStudent.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.modalStudentName, { color: colors.primaryText }]} numberOfLines={1}>
                      {selectedStudent.name}
                    </Text>
                    <Text style={[styles.modalStudentSub, { color: colors.secondaryText }]}>
                      {selectedStudent.roll} · {selectedStudent.regNo}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity onPress={() => setDetailsVisible(false)}>
                  <Icon name="close-circle-outline" size={24} color={colors.secondaryText} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 360 }}>
                <View style={[styles.dossierGrid, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                  <DossierRow icon="domain" label="Class & Program" value={`${selectedStudent.section} · ${selectedStudent.department || selectedStudent.program || "B.Tech"}`} colors={colors} />
                  <DossierRow icon="trophy-outline" label="Cumulative GPA" value={`${selectedStudent.cgpa} / 10.0`} colors={colors} />
                  <DossierRow icon="calendar-check" label="Attendance Standing" value={`${selectedStudent.attendance} (${selectedStudent.attendanceStatus})`} colors={colors} />
                  <DossierRow icon="clipboard-text-outline" label="Continuous Internal (CIA)" value={selectedStudent.ciaScore} colors={colors} />
                  <DossierRow icon="home-city-outline" label="Campus Residence" value={selectedStudent.hostel} colors={colors} />
                  <DossierRow icon="water-outline" label="Blood Group" value={selectedStudent.bloodGroup} colors={colors} />
                  <DossierRow icon="phone-outline" label="Student Mobile" value={selectedStudent.phone} colors={colors} />
                  <DossierRow icon="account-tie-outline" label="Parent / Guardian" value={selectedStudent.parentName} colors={colors} />
                  <DossierRow icon="phone-outgoing" label="Parent Mobile" value={selectedStudent.parentPhone} colors={colors} />
                </View>
              </ScrollView>

              <View style={styles.modalActionRow}>
                <TouchableOpacity
                  style={[styles.shareModalBtn, { backgroundColor: colors.primaryAccent }]}
                  onPress={() => handleShareStudentDossier(selectedStudent)}
                  activeOpacity={0.85}
                >
                  <Icon name="share-variant" size={16} color="#FFFFFF" />
                  <Text style={styles.shareModalBtnText}>Share Dossier</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.closeModalBtn, { borderColor: colors.divider }]}
                  onPress={() => setDetailsVisible(false)}
                >
                  <Text style={[styles.closeModalBtnText, { color: colors.primaryText }]}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* 4. CALL CONFIRMATION MODAL                                                */}
      {/* ========================================================================= */}
      <Modal visible={callConfirmVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.callCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
            <Icon name="phone-outgoing" size={44} color="#10B981" />
            <Text style={[styles.callTitle, { color: colors.primaryText }]}>Confirm Phone Call</Text>
            <Text style={[styles.callSub, { color: colors.secondaryText }]}>
              Dial <Text style={{ color: colors.primaryText, fontWeight: "800" }}>{callTarget.name}</Text> ({callTarget.role}) at {callTarget.phone}?
            </Text>

            <View style={styles.callActionRow}>
              <TouchableOpacity
                style={[styles.cancelCallBtn, { borderColor: colors.divider }]}
                onPress={() => setCallConfirmVisible(false)}
              >
                <Text style={[styles.cancelCallBtnText, { color: colors.primaryText }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.confirmCallBtn} onPress={confirmCall}>
                <Text style={styles.confirmCallBtnText}>Call Now</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function DossierRow({ icon, label, value, colors }) {
  return (
    <View style={[stylesSub.dossierRow, { borderBottomColor: colors.divider }]}>
      <Icon name={icon} size={16} color={colors.primaryAccent} />
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={[stylesSub.dossierLabel, { color: colors.secondaryText }]}>{label}</Text>
        <Text style={[stylesSub.dossierValue, { color: colors.primaryText }]}>{value || "—"}</Text>
      </View>
    </View>
  );
}

const stylesSub = StyleSheet.create({
  dossierRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  dossierLabel: {
    fontSize: 10.5,
    fontWeight: "600",
  },
  dossierValue: {
    fontSize: 12.5,
    fontWeight: "800",
    marginTop: 1,
  },
});

// ---------------- Styles ----------------
const getStyles = (colors, isDarkMode) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.primaryBackground },
    contentContainer: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 80 },

    /* Header */
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginBottom: 12,
    },
    headerIconWrap: {
      width: 42,
      height: 42,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: "800",
      letterSpacing: -0.3,
    },
    headerSub: {
      fontSize: 11.5,
      fontWeight: "500",
      marginTop: 2,
    },

    /* Filters */
    filterPill: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
      borderWidth: 1,
    },
    filterPillText: {
      fontSize: 11.5,
      fontWeight: "700",
    },

    /* Search */
    searchBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      borderWidth: 1,
      marginBottom: 10,
    },
    searchInput: {
      flex: 1,
      fontSize: 12.5,
      fontWeight: "500",
      padding: 0,
    },
    countRow: {
      marginBottom: 10,
    },
    countText: {
      fontSize: 12,
      fontWeight: "500",
    },

    /* Student Cards */
    studentCard: {
      borderRadius: 16,
      borderWidth: 1,
      padding: 14,
      elevation: 2,
    },
    cardTop: {
      flexDirection: "row",
      alignItems: "center",
    },
    avatarCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      justifyContent: "center",
      alignItems: "center",
    },
    avatarText: {
      color: "#FFFFFF",
      fontSize: 16,
      fontWeight: "800",
    },
    studentName: {
      fontSize: 14.5,
      fontWeight: "800",
      flex: 1,
    },
    menteeBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      backgroundColor: "#F59E0B18",
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    menteeBadgeText: {
      color: "#D97706",
      fontSize: 8.5,
      fontWeight: "900",
    },
    studentRoll: {
      fontSize: 11,
      fontWeight: "500",
      marginTop: 2,
    },
    microStatsRow: {
      flexDirection: "row",
      borderRadius: 10,
      borderWidth: 1,
      padding: 8,
      marginTop: 10,
      justifyContent: "space-around",
    },
    microStat: {
      alignItems: "center",
    },
    microLabel: {
      fontSize: 9.5,
      fontWeight: "600",
    },
    microVal: {
      fontSize: 12,
      fontWeight: "800",
      marginTop: 1,
    },
    cardBottom: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      borderTopWidth: 1,
      marginTop: 10,
      paddingTop: 8,
    },
    parentNameText: {
      fontSize: 11,
      fontWeight: "600",
    },
    actionsGroup: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    actionIconBtn: {
      width: 32,
      height: 32,
      borderRadius: 8,
      borderWidth: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    detailsBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
    },
    detailsBtnText: {
      color: "#FFFFFF",
      fontSize: 11,
      fontWeight: "800",
    },

    /* Modals */
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.75)",
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 18,
    },
    modalCard: {
      width: "100%",
      borderRadius: 22,
      borderWidth: 1,
      padding: 18,
      elevation: 12,
    },
    modalHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    modalStudentName: {
      fontSize: 15,
      fontWeight: "800",
    },
    modalStudentSub: {
      fontSize: 11,
      fontWeight: "500",
    },
    dossierGrid: {
      borderRadius: 14,
      borderWidth: 1,
      padding: 10,
      gap: 2,
      marginBottom: 12,
    },
    modalActionRow: {
      flexDirection: "row",
      gap: 8,
      marginTop: 10,
    },
    shareModalBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 12,
      borderRadius: 12,
    },
    shareModalBtnText: {
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

    /* Call Dialog */
    callCard: {
      width: "100%",
      borderRadius: 22,
      borderWidth: 1,
      padding: 22,
      alignItems: "center",
    },
    callTitle: {
      fontSize: 16.5,
      fontWeight: "800",
      marginTop: 10,
    },
    callSub: {
      fontSize: 12.5,
      textAlign: "center",
      lineHeight: 17,
      marginTop: 6,
      marginBottom: 14,
    },
    callActionRow: {
      flexDirection: "row",
      gap: 10,
      width: "100%",
    },
    cancelCallBtn: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
    },
    cancelCallBtnText: {
      fontSize: 13,
      fontWeight: "800",
    },
    confirmCallBtn: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: "#10B981",
    },
    confirmCallBtnText: {
      color: "#FFFFFF",
      fontSize: 13,
      fontWeight: "800",
    },
  });
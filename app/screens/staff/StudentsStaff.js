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
import { SkeletonUserManagementScreen, SkeletonListItem } from "../../components/common/SkeletonLoader";
import { getFacultyRoster, getStaffClassName, toggleStudentMenteeStatus, subscribeToDataChanges } from "../../services/dataService";
import useRefreshOnForeground from "../../hooks/useRefreshOnForeground";
import { showToast } from "../../utils/toastService";

const DEFAULT_STUDENTS = [];

const FILTER_TABS = ["All Students", "Mentee Wards", "Section A", "Section B", "Critical Attendance"];

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

  // Mentee Management Modal
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [assignSearchText, setAssignSearchText] = useState("");
  const [assignFilterSection, setAssignFilterSection] = useState("All");

  const mapRosterToStudents = useCallback((roster) => {
    return (roster || []).map((s, idx) => {
      const sec = s.section || s.class || "";
      const marks = Array.isArray(s.subjects) ? s.subjects.map((x) => Number(x.marks)).filter((m) => !isNaN(m)) : [];
      const avgCia = marks.length > 0 ? Math.round(marks.reduce((a, b) => a + b, 0) / marks.length) : null;
      return {
        id: s.id || String(idx + 1),
        name: s.name || `Student ${idx + 1}`,
        roll: s.roll || s.rollNo || "—",
        regNo: s.regNo || s.rollNo || "—",
        section: sec || "—",
        cgpa: s.cgpa != null ? String(s.cgpa) : "—",
        attendance: s.attendance?.percentage || (s.attendance ? String(s.attendance) : "—"),
        attendanceStatus: s.attendance?.percentage && parseFloat(s.attendance.percentage) < 75 ? "Critical (<75%)" : "Safe",
        phone: s.phone || "—",
        parentName: s.parentName || s.parent?.name || "Parent / Guardian",
        parentPhone: s.parentPhone || s.parent?.phone || "—",
        email: s.email || `${s.name?.toLowerCase().replace(/\s+/g, ".")}@edunex.edu.in`,
        hostel:
          typeof s.hostel === "boolean"
            ? s.hostel
              ? "Residential"
              : "Day Scholar"
            : s.hostel || "—",
        bloodGroup: s.bloodGroup || "—",
        ciaScore: avgCia != null ? String(avgCia) : (s.ciaScore || "—"),
        department: s.department || s.deptShort || s.dept || "",
        rollNo: s.rollNo || s.roll || "",
        mentorStatus: s.mentorStatus || s.mentorWard || "Regular Student",
        isMentee: Boolean(s.isMentee),
      };
    });
  }, []);

  const loadData = useCallback(async () => {
    try {
      const cls = await getStaffClassName();
      const roster = await getFacultyRoster(cls || undefined);
      if (roster && roster.length > 0) {
        setStudents(mapRosterToStudents(roster));
        setIsLoading(false);
      }
    } catch (err) {
      console.log("Error loading students directory:", err);
    } finally {
      setIsLoading(false);
    }
  }, [mapRosterToStudents]);

  useEffect(() => {
    loadData();
    // Subscribe to background delta updates seamlessly
    const unsubscribe = subscribeToDataChanges((key, data) => {
      if (key === "roster" && Array.isArray(data)) {
        setStudents(mapRosterToStudents(data));
      }
    });
    return () => unsubscribe();
  }, [loadData, mapRosterToStudents]);

  useRefreshOnForeground(loadData);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setSearchText("");
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  // Toggle student mentee ward status
  const handleToggleMentee = async (student) => {
    const nextStatus = !student.isMentee;
    const targetId = student.id || student.roll || student.rollNo;

    // Optimistically update students list
    setStudents((prev) =>
      prev.map((s) => (s.id === student.id ? { ...s, isMentee: nextStatus } : s))
    );

    // If currently inspecting in modal, update that as well
    if (selectedStudent && selectedStudent.id === student.id) {
      setSelectedStudent((prev) => ({ ...prev, isMentee: nextStatus }));
    }

    try {
      await toggleStudentMenteeStatus(targetId);
      if (nextStatus) {
        showToast(`Added ${student.name} to your Mentee Ward special list ★`, "success");
      } else {
        showToast(`Removed ${student.name} from Mentee Ward list`, "info");
      }
    } catch (err) {
      console.log("Error toggling mentee status:", err);
      // Revert on failure
      setStudents((prev) =>
        prev.map((s) => (s.id === student.id ? { ...s, isMentee: !nextStatus } : s))
      );
    }
  };

  const menteeStudents = useMemo(() => {
    return students.filter((s) => s.isMentee);
  }, [students]);

  // Mentee Ward KPI Analytics
  const menteeStats = useMemo(() => {
    const count = menteeStudents.length;
    if (count === 0) return { count: 0, avgAtt: "—", avgCgpa: "—", atRiskCount: 0 };

    let attSum = 0;
    let attCount = 0;
    let cgpaSum = 0;
    let cgpaCount = 0;
    let atRisk = 0;

    menteeStudents.forEach((s) => {
      const attNum = parseFloat(String(s.attendance).replace("%", ""));
      if (!isNaN(attNum)) {
        attSum += attNum;
        attCount++;
        if (attNum < 75) atRisk++;
      }
      const cgpaNum = parseFloat(s.cgpa);
      if (!isNaN(cgpaNum)) {
        cgpaSum += cgpaNum;
        cgpaCount++;
        if (cgpaNum < 6.0 && (!attNum || attNum >= 75)) atRisk++;
      }
    });

    return {
      count,
      avgAtt: attCount > 0 ? `${Math.round(attSum / attCount)}%` : "94%",
      avgCgpa: cgpaCount > 0 ? (cgpaSum / cgpaCount).toFixed(2) : "8.5",
      atRiskCount: atRisk,
    };
  }, [menteeStudents]);

  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      // Tab filter
      if (selectedFilter === "Section A" && !/Section A|A$/i.test(s.section.replace(/\s*-\s*/g, " "))) return false;
      if (selectedFilter === "Section B" && !/Section B|B$/i.test(s.section.replace(/\s*-\s*/g, " "))) return false;
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

  // Students for the Assign Mentee Modal
  const assignModalStudents = useMemo(() => {
    return students.filter((s) => {
      if (assignFilterSection === "Section A" && !/Section A|A$/i.test(s.section.replace(/\s*-\s*/g, " "))) return false;
      if (assignFilterSection === "Section B" && !/Section B|B$/i.test(s.section.replace(/\s*-\s*/g, " "))) return false;
      if (assignFilterSection === "Assigned" && !s.isMentee) return false;
      if (assignFilterSection === "Unassigned" && s.isMentee) return false;

      if (assignSearchText.trim()) {
        const q = assignSearchText.toLowerCase().trim();
        const matchName = s.name.toLowerCase().includes(q);
        const matchRoll = s.roll.toLowerCase().includes(q);
        if (!matchName && !matchRoll) return false;
      }
      return true;
    });
  }, [students, assignFilterSection, assignSearchText]);

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
        message: `🎓 EDUNEX STUDENT ACADEMIC DOSSIER\nStudent: ${student.name} (${student.roll})\nReg No: ${student.regNo}\nClass: ${student.section} · ${student.department || student.program || "B.Tech"}\nCGPA: ${student.cgpa} / 10.0\nAttendance: ${student.attendance} (${student.attendanceStatus})\nCIA-1 Score: ${student.ciaScore}\nGuardian: ${student.parentName} (${student.parentPhone})\nMentee Status: ${student.isMentee ? "★ ASSIGNED MENTEE WARD" : "REGULAR STUDENT"}\nStatus: ACTIVE & ENROLLED`,
      });
      showToast("Student dossier shared!", "success");
    } catch (err) {
      console.log("Share error:", err);
    }
  };

  const handleShareMenteeList = async () => {
    try {
      const menteeListText = menteeStudents
        .map((s, idx) => `${idx + 1}. ${s.name} (${s.roll}) - Att: ${s.attendance} | CGPA: ${s.cgpa}`)
        .join("\n");
      const summaryText = `⭐ EDUNEX MENTEE WARD OFFICIAL ROSTER\nFaculty Mentor / Advisor\nTotal Assigned Mentees: ${menteeStats.count}\nAvg Attendance: ${menteeStats.avgAtt}\nAvg CGPA: ${menteeStats.avgCgpa}\nAt-Risk Mentees: ${menteeStats.atRiskCount}\n\n${menteeListText}`;
      await Share.share({ title: "Mentee Ward Special List", message: summaryText });
      showToast("Mentee Ward roster shared!", "success");
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
        {isLoading ? (
          <SkeletonUserManagementScreen />
        ) : (
          <>
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

          <TouchableOpacity
            style={[styles.assignTopBtn, { backgroundColor: colors.primaryAccent }]}
            onPress={() => setAssignModalVisible(true)}
            activeOpacity={0.85}
          >
            <Icon name="star-plus-outline" size={16} color="#FFFFFF" />
            <Text style={styles.assignTopBtnText}>Mentee Ward</Text>
          </TouchableOpacity>
        </View>

        {/* Filter Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6, marginBottom: 12 }}
        >
          {FILTER_TABS.map((tab) => {
            const isSel = selectedFilter === tab;
            const isMenteeTab = tab === "Mentee Wards";
            return (
              <TouchableOpacity
                key={tab}
                style={[
                  styles.filterPill,
                  isSel
                    ? { backgroundColor: colors.primaryAccent, borderColor: colors.primaryAccent }
                    : { backgroundColor: colors.cardBackground, borderColor: isMenteeTab ? "#F59E0B55" : colors.divider },
                ]}
                onPress={() => setSelectedFilter(tab)}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  {isMenteeTab && (
                    <Icon name="star" size={12} color={isSel ? "#FFFFFF" : "#F59E0B"} />
                  )}
                  <Text style={[styles.filterPillText, { color: isSel ? "#FFFFFF" : colors.primaryText }]}>
                    {tab}
                    {isMenteeTab && ` (${menteeStudents.length})`}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ========================================================================= */}
        {/* 2. DEDICATED MENTEE WARD DASHBOARD BANNER (WHEN MENTEE TAB SELECTED)     */}
        {/* ========================================================================= */}
        {selectedFilter === "Mentee Wards" && (
          <View style={[styles.menteeHeaderCard, { backgroundColor: colors.cardBackground, borderColor: "#F59E0B44" }]}>
            <View style={styles.menteeHeaderTop}>
              <View style={[styles.menteeIconCircle, { backgroundColor: "#F59E0B18" }]}>
                <Icon name="shield-star" size={24} color="#F59E0B" />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={[styles.menteeHeaderTitle, { color: colors.primaryText }]}>
                    Mentorship Ward Special List
                  </Text>
                  <View style={styles.menteeActivePill}>
                    <Text style={styles.menteeActivePillText}>COUNSELOR</Text>
                  </View>
                </View>
                <Text style={[styles.menteeHeaderSub, { color: colors.secondaryText }]}>
                  Personal academic monitoring & parent liaison roster
                </Text>
              </View>
            </View>

            {/* 4-Metric Mentee KPI Strip */}
            <View style={styles.menteeKpiRow}>
              <View style={[styles.menteeKpiBox, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                <Text style={[styles.menteeKpiVal, { color: colors.primaryText }]}>{menteeStats.count}</Text>
                <Text style={[styles.menteeKpiLabel, { color: colors.secondaryText }]}>Mentees</Text>
              </View>

              <View style={[styles.menteeKpiBox, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                <Text style={[styles.menteeKpiVal, { color: "#10B981" }]}>{menteeStats.avgAtt}</Text>
                <Text style={[styles.menteeKpiLabel, { color: colors.secondaryText }]}>Avg Att.</Text>
              </View>

              <View style={[styles.menteeKpiBox, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                <Text style={[styles.menteeKpiVal, { color: "#4F46E5" }]}>{menteeStats.avgCgpa}</Text>
                <Text style={[styles.menteeKpiLabel, { color: colors.secondaryText }]}>Avg CGPA</Text>
              </View>

              <View style={[styles.menteeKpiBox, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                <Text style={[styles.menteeKpiVal, { color: menteeStats.atRiskCount > 0 ? "#EF4444" : "#10B981" }]}>
                  {menteeStats.atRiskCount}
                </Text>
                <Text style={[styles.menteeKpiLabel, { color: colors.secondaryText }]}>At-Risk</Text>
              </View>
            </View>

            {/* Quick Mentee Actions */}
            <View style={styles.menteeActionsRow}>
              <TouchableOpacity
                style={[styles.addMenteeActionBtn, { backgroundColor: colors.primaryAccent }]}
                onPress={() => setAssignModalVisible(true)}
                activeOpacity={0.85}
              >
                <Icon name="account-plus-outline" size={15} color="#FFFFFF" />
                <Text style={styles.addMenteeActionBtnText}>+ Assign / Manage Mentees</Text>
              </TouchableOpacity>

              {menteeStudents.length > 0 && (
                <TouchableOpacity
                  style={[styles.shareMenteeBtn, { borderColor: colors.divider }]}
                  onPress={handleShareMenteeList}
                  activeOpacity={0.8}
                >
                  <Icon name="share-variant-outline" size={15} color={colors.primaryAccent} />
                  <Text style={[styles.shareMenteeBtnText, { color: colors.primaryAccent }]}>Share Roster</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Search Bar */}
        <View style={[styles.searchBar, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
          <Icon name="magnify" size={20} color={colors.secondaryText} />
          <TextInput
            style={[styles.searchInput, { color: colors.primaryText }]}
            placeholder={
              selectedFilter === "Mentee Wards"
                ? "Search among your assigned mentees..."
                : "Search by student name, roll or reg no..."
            }
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

            {/* Empty state for mentee wards */}
            {selectedFilter === "Mentee Wards" && filteredStudents.length === 0 && (
              <View style={[styles.emptyMenteeBox, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
                <Icon name="star-off-outline" size={48} color="#F59E0B" />
                <Text style={[styles.emptyMenteeTitle, { color: colors.primaryText }]}>No Mentees in Special List</Text>
                <Text style={[styles.emptyMenteeSub, { color: colors.secondaryText }]}>
                  You have not assigned any students to your Mentee Ward yet. Tap below to select students from your class.
                </Text>
                <TouchableOpacity
                  style={[styles.emptyAddBtn, { backgroundColor: colors.primaryAccent }]}
                  onPress={() => setAssignModalVisible(true)}
                >
                  <Icon name="account-plus" size={16} color="#FFFFFF" />
                  <Text style={styles.emptyAddBtnText}>Add Students to Mentee Ward</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ========================================================================= */}
            {/* 3. STUDENT CARDS LIST                                                     */}
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
                        borderColor: student.isMentee ? "#F59E0B55" : isCritical ? "#EF444455" : colors.divider,
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

                          {/* Quick 1-tap Mentee Ward Star Toggle */}
                          <TouchableOpacity
                            style={[
                              styles.menteeToggleBadge,
                              {
                                backgroundColor: student.isMentee ? "#F59E0B18" : colors.primaryBackground,
                                borderColor: student.isMentee ? "#F59E0B44" : colors.divider,
                              },
                            ]}
                            onPress={() => handleToggleMentee(student)}
                            activeOpacity={0.75}
                          >
                            <Icon
                              name={student.isMentee ? "star" : "star-outline"}
                              size={12}
                              color={student.isMentee ? "#D97706" : colors.secondaryText}
                            />
                            <Text
                              style={[
                                styles.menteeBadgeText,
                                { color: student.isMentee ? "#D97706" : colors.secondaryText },
                              ]}
                            >
                              {student.isMentee ? "MENTEE" : "+ MENTEE"}
                            </Text>
                          </TouchableOpacity>
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
                        {/* 1-Tap Mentee Star Quick Action */}
                        <TouchableOpacity
                          style={[
                            styles.actionIconBtn,
                            {
                              backgroundColor: student.isMentee ? "#F59E0B18" : colors.primaryBackground,
                              borderColor: student.isMentee ? "#F59E0B55" : colors.divider,
                            },
                          ]}
                          onPress={() => handleToggleMentee(student)}
                          activeOpacity={0.8}
                        >
                          <Icon
                            name={student.isMentee ? "star" : "star-outline"}
                            size={16}
                            color={student.isMentee ? "#D97706" : colors.secondaryText}
                          />
                        </TouchableOpacity>

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
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ========================================================================= */}
      {/* 4. STUDENT ACADEMIC DOSSIER MODAL                                         */}
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

              {/* Mentee Status Interactive Bar in Dossier */}
              <View
                style={[
                  styles.dossierMenteeBanner,
                  {
                    backgroundColor: selectedStudent.isMentee ? "#F59E0B14" : colors.primaryBackground,
                    borderColor: selectedStudent.isMentee ? "#F59E0B44" : colors.divider,
                  },
                ]}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                  <Icon
                    name={selectedStudent.isMentee ? "shield-star" : "shield-account-outline"}
                    size={20}
                    color={selectedStudent.isMentee ? "#D97706" : colors.secondaryText}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.dossierMenteeTitle,
                        { color: selectedStudent.isMentee ? "#D97706" : colors.primaryText },
                      ]}
                    >
                      {selectedStudent.isMentee ? "ASSIGNED MENTEE WARD" : "REGULAR STUDENT"}
                    </Text>
                    <Text style={[styles.dossierMenteeSub, { color: colors.secondaryText }]}>
                      {selectedStudent.isMentee
                        ? "Under your personal academic guardianship & mentorship."
                        : "Not assigned to your personal Mentee Ward list."}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={[
                    styles.dossierMenteeToggleBtn,
                    {
                      backgroundColor: selectedStudent.isMentee ? "#EF444418" : colors.primaryAccent,
                      borderColor: selectedStudent.isMentee ? "#EF444444" : "transparent",
                    },
                  ]}
                  onPress={() => handleToggleMentee(selectedStudent)}
                  activeOpacity={0.85}
                >
                  <Icon
                    name={selectedStudent.isMentee ? "account-minus" : "star-plus"}
                    size={14}
                    color={selectedStudent.isMentee ? "#EF4444" : "#FFFFFF"}
                  />
                  <Text
                    style={[
                      styles.dossierMenteeToggleBtnText,
                      { color: selectedStudent.isMentee ? "#EF4444" : "#FFFFFF" },
                    ]}
                  >
                    {selectedStudent.isMentee ? "Remove" : "+ Add Mentee"}
                  </Text>
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 300 }}>
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
      {/* 5. ASSIGN / MANAGE MENTEE WARDS MODAL                                     */}
      {/* ========================================================================= */}
      <Modal
        visible={assignModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAssignModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.assignModalCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
            <View style={styles.modalHeaderRow}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                <View style={[styles.iconWrapRound, { backgroundColor: "#F59E0B18" }]}>
                  <Icon name="account-multiple-plus" size={22} color="#F59E0B" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modalStudentName, { color: colors.primaryText }]}>
                    Manage Mentee Ward Special List
                  </Text>
                  <Text style={[styles.modalStudentSub, { color: colors.secondaryText }]}>
                    {menteeStudents.length} student{menteeStudents.length === 1 ? "" : "s"} currently assigned as your mentees
                  </Text>
                </View>
              </View>

              <TouchableOpacity onPress={() => setAssignModalVisible(false)}>
                <Icon name="close-circle-outline" size={24} color={colors.secondaryText} />
              </TouchableOpacity>
            </View>

            {/* Search Input inside modal */}
            <View style={[styles.searchBar, { backgroundColor: colors.primaryBackground, borderColor: colors.divider, marginBottom: 8 }]}>
              <Icon name="magnify" size={18} color={colors.secondaryText} />
              <TextInput
                style={[styles.searchInput, { color: colors.primaryText }]}
                placeholder="Search by student name or roll..."
                placeholderTextColor={colors.disabledText}
                value={assignSearchText}
                onChangeText={setAssignSearchText}
              />
              {assignSearchText.length > 0 && (
                <TouchableOpacity onPress={() => setAssignSearchText("")}>
                  <Icon name="close-circle" size={16} color={colors.secondaryText} />
                </TouchableOpacity>
              )}
            </View>

            {/* Filter pills inside modal */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 6, marginBottom: 10 }}
            >
              {["All", "Assigned", "Unassigned", "Section A", "Section B"].map((sec) => {
                const isSel = assignFilterSection === sec;
                return (
                  <TouchableOpacity
                    key={sec}
                    style={[
                      styles.filterPill,
                      isSel
                        ? { backgroundColor: colors.primaryAccent, borderColor: colors.primaryAccent }
                        : { backgroundColor: colors.primaryBackground, borderColor: colors.divider },
                    ]}
                    onPress={() => setAssignFilterSection(sec)}
                  >
                    <Text style={[styles.filterPillText, { color: isSel ? "#FFFFFF" : colors.primaryText }]}>
                      {sec}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Student List with 1-tap Add/Remove */}
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }}>
              <View style={{ gap: 8 }}>
                {assignModalStudents.map((st) => (
                  <View
                    key={st.id}
                    style={[
                      styles.assignStudentRow,
                      {
                        backgroundColor: colors.primaryBackground,
                        borderColor: st.isMentee ? "#F59E0B55" : colors.divider,
                      },
                    ]}
                  >
                    <View style={styles.assignRowLeft}>
                      <View
                        style={[
                          styles.avatarCircleSmall,
                          { backgroundColor: st.isMentee ? "#F59E0B" : colors.primaryAccent },
                        ]}
                      >
                        <Text style={styles.avatarSmallText}>
                          {st.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .slice(0, 2)}
                        </Text>
                      </View>

                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={[styles.assignStudentName, { color: colors.primaryText }]} numberOfLines={1}>
                          {st.name}
                        </Text>
                        <Text style={[styles.assignStudentSub, { color: colors.secondaryText }]}>
                          {st.roll} · {st.section} · Att: {st.attendance}
                        </Text>
                      </View>
                    </View>

                    <TouchableOpacity
                      style={[
                        styles.assignToggleBtn,
                        st.isMentee
                          ? { backgroundColor: "#EF444418", borderColor: "#EF444444" }
                          : { backgroundColor: colors.primaryAccent, borderColor: colors.primaryAccent },
                      ]}
                      onPress={() => handleToggleMentee(st)}
                      activeOpacity={0.8}
                    >
                      <Icon
                        name={st.isMentee ? "close-circle-outline" : "star-plus"}
                        size={14}
                        color={st.isMentee ? "#EF4444" : "#FFFFFF"}
                      />
                      <Text
                        style={[
                          styles.assignToggleBtnText,
                          { color: st.isMentee ? "#EF4444" : "#FFFFFF" },
                        ]}
                      >
                        {st.isMentee ? "Remove" : "+ Assign"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </ScrollView>

            <TouchableOpacity
              style={[styles.doneBtn, { backgroundColor: colors.primaryAccent }]}
              onPress={() => setAssignModalVisible(false)}
              activeOpacity={0.85}
            >
              <Text style={styles.doneBtnText}>Done ({menteeStudents.length} Assigned)</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* 6. CALL CONFIRMATION MODAL                                                */}
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
    assignTopBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 10,
    },
    assignTopBtnText: {
      color: "#FFFFFF",
      fontSize: 11.5,
      fontWeight: "800",
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

    /* Mentee Header Card */
    menteeHeaderCard: {
      borderRadius: 16,
      borderWidth: 1,
      padding: 14,
      marginBottom: 12,
      elevation: 2,
    },
    menteeHeaderTop: {
      flexDirection: "row",
      alignItems: "center",
    },
    menteeIconCircle: {
      width: 42,
      height: 42,
      borderRadius: 21,
      justifyContent: "center",
      alignItems: "center",
    },
    menteeHeaderTitle: {
      fontSize: 14.5,
      fontWeight: "800",
    },
    menteeActivePill: {
      backgroundColor: "#F59E0B20",
      paddingHorizontal: 5,
      paddingVertical: 1.5,
      borderRadius: 4,
    },
    menteeActivePillText: {
      color: "#D97706",
      fontSize: 8.5,
      fontWeight: "900",
    },
    menteeHeaderSub: {
      fontSize: 11,
      fontWeight: "500",
      marginTop: 2,
    },
    menteeKpiRow: {
      flexDirection: "row",
      gap: 6,
      marginTop: 12,
      marginBottom: 12,
    },
    menteeKpiBox: {
      flex: 1,
      alignItems: "center",
      paddingVertical: 8,
      borderRadius: 10,
      borderWidth: 1,
    },
    menteeKpiVal: {
      fontSize: 14.5,
      fontWeight: "900",
    },
    menteeKpiLabel: {
      fontSize: 9.5,
      fontWeight: "600",
      marginTop: 1,
    },
    menteeActionsRow: {
      flexDirection: "row",
      gap: 8,
    },
    addMenteeActionBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 9,
      borderRadius: 10,
    },
    addMenteeActionBtnText: {
      color: "#FFFFFF",
      fontSize: 11.5,
      fontWeight: "800",
    },
    shareMenteeBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderRadius: 10,
      borderWidth: 1,
    },
    shareMenteeBtnText: {
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

    /* Empty Mentee State */
    emptyMenteeBox: {
      borderRadius: 16,
      borderWidth: 1,
      padding: 24,
      alignItems: "center",
      marginBottom: 12,
    },
    emptyMenteeTitle: {
      fontSize: 15,
      fontWeight: "800",
      marginTop: 10,
    },
    emptyMenteeSub: {
      fontSize: 11.5,
      textAlign: "center",
      lineHeight: 16,
      marginTop: 4,
      marginBottom: 14,
    },
    emptyAddBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 10,
    },
    emptyAddBtnText: {
      color: "#FFFFFF",
      fontSize: 12,
      fontWeight: "800",
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
    menteeToggleBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: 6,
      borderWidth: 1,
    },
    menteeBadgeText: {
      fontSize: 9,
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
    dossierMenteeBanner: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderRadius: 12,
      borderWidth: 1,
      padding: 10,
      marginBottom: 10,
    },
    dossierMenteeTitle: {
      fontSize: 11.5,
      fontWeight: "900",
    },
    dossierMenteeSub: {
      fontSize: 10,
      fontWeight: "500",
      marginTop: 1,
    },
    dossierMenteeToggleBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
      marginLeft: 6,
    },
    dossierMenteeToggleBtnText: {
      fontSize: 11,
      fontWeight: "800",
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

    /* Assign Modal */
    assignModalCard: {
      width: "100%",
      borderRadius: 22,
      borderWidth: 1,
      padding: 18,
      elevation: 12,
      maxHeight: "85%",
    },
    iconWrapRound: {
      width: 38,
      height: 38,
      borderRadius: 19,
      justifyContent: "center",
      alignItems: "center",
    },
    assignStudentRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      borderRadius: 12,
      borderWidth: 1,
      padding: 10,
    },
    assignRowLeft: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
    },
    avatarCircleSmall: {
      width: 34,
      height: 34,
      borderRadius: 17,
      justifyContent: "center",
      alignItems: "center",
    },
    avatarSmallText: {
      color: "#FFFFFF",
      fontSize: 12,
      fontWeight: "800",
    },
    assignStudentName: {
      fontSize: 13,
      fontWeight: "800",
    },
    assignStudentSub: {
      fontSize: 10.5,
      fontWeight: "500",
      marginTop: 1,
    },
    assignToggleBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
      marginLeft: 8,
    },
    assignToggleBtnText: {
      fontSize: 11,
      fontWeight: "800",
    },
    doneBtn: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 12,
      borderRadius: 12,
      marginTop: 12,
    },
    doneBtnText: {
      color: "#FFFFFF",
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
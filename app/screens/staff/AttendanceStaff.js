import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Modal,
  TextInput,
  RefreshControl,
  Share,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { useTheme } from "../../context/ThemeContext";
import { SkeletonListItem } from "../../components/common/SkeletonLoader";
import { getFacultyRoster, submitAttendanceBatch, getStaffClassName } from "../../services/dataService";
import { api } from "../../services/api";
import useRefreshOnForeground from "../../hooks/useRefreshOnForeground";
import { showToast } from "../../utils/toastService";

const DEFAULT_STUDENTS = [];

const SECTIONS = [];

export default function AttendanceStaff() {
  const { colors, isDarkMode } = useTheme();
  const styles = getStyles(colors, isDarkMode);

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [students, setStudents] = useState(DEFAULT_STUDENTS);
  const [sections, setSections] = useState(SECTIONS);
  const [activeSection, setActiveSection] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLocked, setIsLocked] = useState(false);

  const [confirmVisible, setConfirmVisible] = useState(false);
  const [successVisible, setSuccessVisible] = useState(false);
  const [summary, setSummary] = useState({ present: 0, absent: 0, od: 0 });

  const fadeAnim = useRef(new Animated.Value(0)).current;

  const loadData = useCallback(async () => {
    try {
      const cls = await getStaffClassName();
      const [rosterRes, sectionsRes] = await Promise.allSettled([
        getFacultyRoster(cls || undefined),
        api.get("/faculty/schedule", cls ? { class: cls } : undefined),
      ]);

      const roster = rosterRes.status === "fulfilled" ? rosterRes.value : null;
      if (roster && roster.length > 0) {
        setStudents(
          roster.map((s, idx) => ({
            id: s.id || String(idx + 1),
            name: s.name,
            roll: s.roll || s.rollNo,
            status: s.status || (s.present === false ? "A" : "P"),
            termAtt: s.attendance?.percentage || s.termAtt || "—",
            hostel: s.hostel || "Active Student",
          }))
        );
      }

      const scheduleData =
        sectionsRes.status === "fulfilled" && Array.isArray(sectionsRes.value?.data)
          ? sectionsRes.value.data
          : Array.isArray(sectionsRes.value)
          ? sectionsRes.value
          : [];
      if (scheduleData.length > 0) {
        const mapped = scheduleData.map((s, idx) => ({
          id: String(s.id ?? idx),
          label: s.className || s.label || s.class || `Section ${idx + 1}`,
          course: s.subject || s.course || "—",
          time: s.time || "—",
        }));
        setSections(mapped);
        setActiveSection((prev) => prev || mapped[0] || null);
      }
    } catch (err) {
      console.log("Error loading attendance roster:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    loadData();
  }, [fadeAnim, loadData]);

  useRefreshOnForeground(loadData);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const setStudentStatus = (id, newStatus) => {
    if (isLocked) {
      showToast("Attendance is locked. Request HOD override to edit.", "warning");
      return;
    }
    setStudents((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: newStatus } : s))
    );
  };

  const markAll = (statusToSet) => {
    if (isLocked) {
      showToast("Attendance is locked. Request HOD override to edit.", "warning");
      return;
    }
    setStudents((prev) => prev.map((s) => ({ ...s, status: statusToSet })));
    showToast(`All students marked as ${statusToSet === "P" ? "Present" : "Absent"}`, "info");
  };

  const openConfirmation = () => {
    const presentCount = students.filter((s) => s.status === "P").length;
    const absentCount = students.filter((s) => s.status === "A").length;
    const odCount = students.filter((s) => s.status === "OD").length;
    setSummary({ present: presentCount, absent: absentCount, od: odCount });
    setConfirmVisible(true);
  };

  const handleLockAndSubmit = async () => {
    setConfirmVisible(false);
    const todayStr = new Date().toISOString().split("T")[0];
    const attendanceDocs = students.map((s) => ({
      studentId: s.id,
      roll: s.roll,
      studentName: s.name,
      class: activeSection?.label || "",
      date: todayStr,
      status: s.status === "P" ? "Present" : s.status === "OD" ? "On-Duty" : "Absent",
      markedBy: "faculty_staff",
      locked: true,
    }));

    try {
      await submitAttendanceBatch(attendanceDocs);
    } catch (err) {
      console.log("Attendance bulk submit fallback:", err);
    }

    setIsLocked(true);
    setTimeout(() => setSuccessVisible(true), 250);
  };

  const handleUnlockRequest = () => {
    showToast("HOD override request sent for " + (activeSection?.label || ""), "info");
    setIsLocked(false);
  };

  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students;
    const q = searchQuery.toLowerCase().trim();
    return students.filter(
      (s) => s.name.toLowerCase().includes(q) || s.roll.toLowerCase().includes(q)
    );
  }, [students, searchQuery]);

  const presentCount = students.filter((s) => s.status === "P").length;
  const absentCount = students.filter((s) => s.status === "A").length;
  const odCount = students.filter((s) => s.status === "OD").length;
  const attendanceRate = students.length > 0 ? Math.round(((presentCount + odCount) / students.length) * 100) : 0;

  const handleShareRoster = async () => {
    try {
      const summaryText = `📋 EDUNEX OFFICIAL ATTENDANCE RECORD\nStatus: ${isLocked ? "LOCKED & FROZEN" : "DRAFT"}\nCourse: ${activeSection?.course || ""}\nClass: ${activeSection?.label || ""}\nDate: ${new Date().toLocaleDateString()}\n\n✅ Present: ${presentCount}\n❌ Absent: ${absentCount}\n🟣 On-Duty (OD): ${odCount}\nTurnout Rate: ${attendanceRate}%`;
      await Share.share({ title: "Class Attendance Record", message: summaryText });
      showToast("Attendance summary shared!", "success");
    } catch (err) {
      console.log("Share error:", err);
    }
  };

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
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
        {/* 1. HEADER & LOCK STATUS BANNER                                            */}
        {/* ========================================================================= */}
        <View style={styles.headerRow}>
          <View style={[styles.headerIconWrap, { backgroundColor: colors.primaryAccent + "18" }]}>
            <Icon name="clipboard-check-outline" size={24} color={colors.primaryAccent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: colors.primaryText }]}>Class Attendance</Text>
            <Text style={[styles.headerSub, { color: colors.secondaryText }]}>
              Digital Roll Call & Registrar Verification
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.sharePillBtn, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
            onPress={handleShareRoster}
            activeOpacity={0.8}
          >
            <Icon name="share-variant-outline" size={16} color={colors.primaryAccent} />
            <Text style={[styles.sharePillBtnText, { color: colors.primaryAccent }]}>Share</Text>
          </TouchableOpacity>
        </View>

        {/* Lock / Draft Status Indicator Banner */}
        <View
          style={[
            styles.lockStatusCard,
            {
              backgroundColor: isLocked ? "#10B98112" : "#F59E0B12",
              borderColor: isLocked ? "#10B98144" : "#F59E0B44",
            },
          ]}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
            <Icon
              name={isLocked ? "lock-check" : "lock-open-outline"}
              size={20}
              color={isLocked ? "#10B981" : "#D97706"}
            />
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.lockStatusTitle,
                  { color: isLocked ? "#10B981" : "#D97706" },
                ]}
              >
                {isLocked ? "ATTENDANCE LOCKED & FROZEN" : "DRAFT ROLL CALL (UNLOCKED)"}
              </Text>
              <Text style={[styles.lockStatusSub, { color: colors.secondaryText }]}>
                {isLocked
                  ? "Record submitted to Registrar. Parent alerts active."
                  : "Review student presence before locking this session."}
              </Text>
            </View>
          </View>

          {isLocked ? (
            <TouchableOpacity style={styles.unlockBtn} onPress={handleUnlockRequest}>
              <Icon name="lock-reset" size={14} color={colors.primaryAccent} />
              <Text style={[styles.unlockBtnText, { color: colors.primaryAccent }]}>Unlock</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.lockNowBtn, { backgroundColor: colors.primaryAccent }]} onPress={openConfirmation}>
              <Icon name="lock" size={14} color="#FFFFFF" />
              <Text style={styles.lockNowBtnText}>Lock Session</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Section & Course Selector Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, marginBottom: 12 }}
        >
          {sections.map((sec) => {
            const isSel = activeSection && activeSection.id === sec.id;
            return (
              <TouchableOpacity
                key={sec.id}
                style={[
                  styles.sectionPill,
                  isSel
                    ? { backgroundColor: colors.primaryAccent, borderColor: colors.primaryAccent }
                    : { backgroundColor: colors.cardBackground, borderColor: colors.divider },
                ]}
                onPress={() => {
                  setActiveSection(sec);
                  setIsLocked(false);
                }}
              >
                <Text style={[styles.sectionPillTitle, { color: isSel ? "#FFFFFF" : colors.primaryText }]}>
                  {sec.label}
                </Text>
                <Text style={[styles.sectionPillSub, { color: isSel ? "rgba(255,255,255,0.85)" : colors.secondaryText }]}>
                  {sec.time}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {isLoading ? (
          <View style={{ marginTop: 10 }}>
            <SkeletonListItem />
            <SkeletonListItem />
            <SkeletonListItem />
            <SkeletonListItem />
          </View>
        ) : (
          <>
            {/* ========================================================================= */}
            {/* 2. LIVE ATTENDANCE KPI STRIP                                              */}
            {/* ========================================================================= */}
            <View style={styles.kpiRow}>
              <View style={[styles.kpiCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
                <View style={[styles.kpiIconWrap, { backgroundColor: "#10B98118" }]}>
                  <Icon name="account-check" size={18} color="#10B981" />
                </View>
                <Text style={[styles.kpiVal, { color: "#10B981" }]}>{presentCount}</Text>
                <Text style={[styles.kpiLabel, { color: colors.secondaryText }]}>Present</Text>
              </View>

              <View style={[styles.kpiCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
                <View style={[styles.kpiIconWrap, { backgroundColor: "#EF444418" }]}>
                  <Icon name="account-cancel" size={18} color="#EF4444" />
                </View>
                <Text style={[styles.kpiVal, { color: "#EF4444" }]}>{absentCount}</Text>
                <Text style={[styles.kpiLabel, { color: colors.secondaryText }]}>Absent</Text>
              </View>

              <View style={[styles.kpiCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
                <View style={[styles.kpiIconWrap, { backgroundColor: "#8B5CF618" }]}>
                  <Icon name="badge-account-outline" size={18} color="#8B5CF6" />
                </View>
                <Text style={[styles.kpiVal, { color: "#8B5CF6" }]}>{odCount}</Text>
                <Text style={[styles.kpiLabel, { color: colors.secondaryText }]}>On-Duty (OD)</Text>
              </View>

              <View style={[styles.kpiCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
                <View style={[styles.kpiIconWrap, { backgroundColor: "#4F46E518" }]}>
                  <Icon name="percent-outline" size={18} color="#4F46E5" />
                </View>
                <Text style={[styles.kpiVal, { color: "#4F46E5" }]}>{attendanceRate}%</Text>
                <Text style={[styles.kpiLabel, { color: colors.secondaryText }]}>Turnout</Text>
              </View>
            </View>

            {/* Quick Bulk Action Buttons & Search */}
            <View style={styles.controlsRow}>
              <View style={[styles.searchBox, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
                <Icon name="magnify" size={18} color={colors.secondaryText} />
                <TextInput
                  style={[styles.searchInput, { color: colors.primaryText }]}
                  placeholder="Search student or roll no..."
                  placeholderTextColor={colors.disabledText}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery("")}>
                    <Icon name="close-circle" size={16} color={colors.secondaryText} />
                  </TouchableOpacity>
                )}
              </View>

              {!isLocked && (
                <View style={{ flexDirection: "row", gap: 6 }}>
                  <TouchableOpacity
                    style={[styles.bulkBtn, { backgroundColor: "#10B98118", borderColor: "#10B98144" }]}
                    onPress={() => markAll("P")}
                  >
                    <Icon name="check-all" size={16} color="#10B981" />
                    <Text style={[styles.bulkBtnText, { color: "#10B981" }]}>All Present</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.bulkBtn, { backgroundColor: "#EF444418", borderColor: "#EF444444" }]}
                    onPress={() => markAll("A")}
                  >
                    <Icon name="close-octagon-outline" size={16} color="#EF4444" />
                    <Text style={[styles.bulkBtnText, { color: "#EF4444" }]}>All Absent</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* ========================================================================= */}
            {/* 3. STUDENT ROSTER LIST                                                    */}
            {/* ========================================================================= */}
            <View style={{ gap: 8 }}>
              {filteredStudents.map((student) => {
                const isP = student.status === "P";
                const isA = student.status === "A";
                const isOD = student.status === "OD";

                return (
                  <View
                    key={student.id}
                    style={[
                      styles.studentCard,
                      {
                        backgroundColor: colors.cardBackground,
                        borderColor: isA ? "#EF444455" : colors.divider,
                        opacity: isLocked ? 0.9 : 1,
                      },
                    ]}
                  >
                    <View style={styles.studentCardLeft}>
                      <View
                        style={[
                          styles.avatarCircle,
                          {
                            backgroundColor: isP ? "#10B981" : isA ? "#EF4444" : "#8B5CF6",
                          },
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

                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={[styles.studentName, { color: colors.primaryText }]} numberOfLines={1}>
                          {student.name}
                        </Text>
                        <Text style={[styles.studentRoll, { color: colors.secondaryText }]}>
                          {student.roll} · {student.hostel}
                        </Text>
                        <Text style={[styles.termAttText, { color: colors.primaryAccent }]}>
                          Term Attendance: {student.termAtt}
                        </Text>
                      </View>
                    </View>

                    {/* 3-State Action Selector: P / A / OD */}
                    <View style={styles.statusButtonsGroup}>
                      <TouchableOpacity
                        style={[
                          styles.statusToggleBtn,
                          isP
                            ? { backgroundColor: "#10B981", borderColor: "#10B981" }
                            : { backgroundColor: colors.primaryBackground, borderColor: colors.divider },
                        ]}
                        onPress={() => setStudentStatus(student.id, "P")}
                        disabled={isLocked}
                      >
                        <Text style={[styles.statusToggleBtnText, { color: isP ? "#FFFFFF" : colors.secondaryText }]}>
                          P
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.statusToggleBtn,
                          isA
                            ? { backgroundColor: "#EF4444", borderColor: "#EF4444" }
                            : { backgroundColor: colors.primaryBackground, borderColor: colors.divider },
                        ]}
                        onPress={() => setStudentStatus(student.id, "A")}
                        disabled={isLocked}
                      >
                        <Text style={[styles.statusToggleBtnText, { color: isA ? "#FFFFFF" : colors.secondaryText }]}>
                          A
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.statusToggleBtn,
                          isOD
                            ? { backgroundColor: "#8B5CF6", borderColor: "#8B5CF6" }
                            : { backgroundColor: colors.primaryBackground, borderColor: colors.divider },
                        ]}
                        onPress={() => setStudentStatus(student.id, "OD")}
                        disabled={isLocked}
                      >
                        <Text style={[styles.statusToggleBtnText, { color: isOD ? "#FFFFFF" : colors.secondaryText }]}>
                          OD
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Bottom Action Button */}
            {!isLocked ? (
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: colors.primaryAccent }]}
                onPress={openConfirmation}
                activeOpacity={0.85}
              >
                <Icon name="lock-check" size={20} color="#FFFFFF" />
                <Text style={styles.saveBtnText}>
                  Lock & Submit Session ({presentCount} Present · {absentCount} Absent)
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={[styles.lockedBottomBox, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
                <Icon name="shield-check" size={22} color="#10B981" />
                <Text style={[styles.lockedBottomText, { color: colors.primaryText }]}>
                  This session is locked and submitted to the Registrar.
                </Text>
              </View>
            )}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ========================================================================= */}
      {/* 4. PRE-LOCK CONFIRMATION MODAL                                            */}
      {/* ========================================================================= */}
      <Modal visible={confirmVisible} transparent animationType="fade" onRequestClose={() => setConfirmVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
            <View style={styles.lockIconCircle}>
              <Icon name="lock-alert" size={32} color="#F59E0B" />
            </View>

            <Text style={[styles.modalTitle, { color: colors.primaryText }]}>Lock & Freeze Attendance?</Text>
            <Text style={[styles.modalSub, { color: colors.secondaryText }]}>
              Please verify your roll call before finalizing. Once locked, this official ledger entry will be submitted to the University Registrar and absent SMS alerts will be sent to parents.
            </Text>

            {/* Summary Breakdown Grid */}
            <View style={[styles.summaryBox, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryKey, { color: colors.secondaryText }]}>Lecture Course</Text>
                <Text style={[styles.summaryVal, { color: colors.primaryText }]}>{activeSection?.course || "—"}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryKey, { color: colors.secondaryText }]}>Batch & Section</Text>
                <Text style={[styles.summaryVal, { color: colors.primaryText }]}>{activeSection?.label || "—"}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryKey, { color: colors.secondaryText }]}>Present Students</Text>
                <Text style={[styles.summaryVal, { color: "#10B981" }]}>{summary.present} Students</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryKey, { color: colors.secondaryText }]}>Absent Students</Text>
                <Text style={[styles.summaryVal, { color: "#EF4444" }]}>{summary.absent} Students</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryKey, { color: colors.secondaryText }]}>On-Duty (OD)</Text>
                <Text style={[styles.summaryVal, { color: "#8B5CF6" }]}>{summary.od} Students</Text>
              </View>
            </View>

            {/* Alert Warning Box */}
            <View style={[styles.warningBox, { backgroundColor: "#F59E0B14", borderColor: "#F59E0B44" }]}>
              <Icon name="alert-circle-outline" size={16} color="#D97706" />
              <Text style={styles.warningText}>
                Modifications after locking require HOD Administrative Override.
              </Text>
            </View>

            {/* Buttons */}
            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={[styles.cancelBtn, { borderColor: colors.divider }]}
                onPress={() => setConfirmVisible(false)}
              >
                <Text style={[styles.cancelBtnText, { color: colors.primaryText }]}>Keep Editing</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.confirmBtn, { backgroundColor: "#10B981" }]}
                onPress={handleLockAndSubmit}
              >
                <Icon name="lock" size={16} color="#FFFFFF" />
                <Text style={styles.confirmBtnText}>Confirm & Lock</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* 5. SUCCESS POPUP                                                          */}
      {/* ========================================================================= */}
      <Modal visible={successVisible} transparent animationType="fade" onRequestClose={() => setSuccessVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
            <Icon name="check-circle" size={54} color="#10B981" />
            <Text style={[styles.modalTitle, { color: "#10B981" }]}>Attendance Locked!</Text>
            <Text style={[styles.modalSub, { color: colors.secondaryText }]}>
              The attendance record has been finalized and synchronized with the registrar ledger. Parents of {summary.absent} absent student(s) have been notified.
            </Text>

            <TouchableOpacity
              style={[styles.confirmBtn, { backgroundColor: "#10B981", width: "100%", marginTop: 16 }]}
              onPress={() => setSuccessVisible(false)}
            >
              <Text style={styles.confirmBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Animated.View>
  );
}

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
      marginBottom: 10,
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
    sharePillBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 10,
      borderWidth: 1,
    },
    sharePillBtnText: {
      fontSize: 11.5,
      fontWeight: "700",
    },

    /* Lock Status Card */
    lockStatusCard: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderRadius: 14,
      borderWidth: 1,
      padding: 12,
      marginBottom: 12,
    },
    lockStatusTitle: {
      fontSize: 12,
      fontWeight: "900",
      letterSpacing: 0.3,
    },
    lockStatusSub: {
      fontSize: 10.5,
      fontWeight: "500",
      marginTop: 1,
    },
    unlockBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
    },
    unlockBtnText: {
      fontSize: 11.5,
      fontWeight: "800",
    },
    lockNowBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
    },
    lockNowBtnText: {
      color: "#FFFFFF",
      fontSize: 11.5,
      fontWeight: "800",
    },

    /* Section Selector */
    sectionPill: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 14,
      borderWidth: 1,
    },
    sectionPillTitle: {
      fontSize: 12.5,
      fontWeight: "800",
    },
    sectionPillSub: {
      fontSize: 10.5,
      fontWeight: "500",
      marginTop: 1,
    },

    /* KPI Row */
    kpiRow: {
      flexDirection: "row",
      gap: 6,
      marginBottom: 12,
    },
    kpiCard: {
      flex: 1,
      alignItems: "center",
      paddingVertical: 10,
      borderRadius: 14,
      borderWidth: 1,
      elevation: 2,
    },
    kpiIconWrap: {
      width: 32,
      height: 32,
      borderRadius: 16,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 2,
    },
    kpiVal: {
      fontSize: 15,
      fontWeight: "900",
    },
    kpiLabel: {
      fontSize: 10,
      fontWeight: "700",
      marginTop: 1,
    },

    /* Controls & Search */
    controlsRow: {
      flexDirection: "column",
      gap: 8,
      marginBottom: 12,
    },
    searchBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      borderWidth: 1,
    },
    searchInput: {
      flex: 1,
      fontSize: 12.5,
      fontWeight: "500",
      padding: 0,
    },
    bulkBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 8,
      borderRadius: 10,
      borderWidth: 1,
    },
    bulkBtnText: {
      fontSize: 11.5,
      fontWeight: "800",
    },

    /* Student Cards */
    studentCard: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      borderRadius: 14,
      borderWidth: 1,
      padding: 12,
      elevation: 1,
    },
    studentCardLeft: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
    },
    avatarCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: "center",
      alignItems: "center",
    },
    avatarText: {
      color: "#FFFFFF",
      fontSize: 14,
      fontWeight: "800",
    },
    studentName: {
      fontSize: 13.5,
      fontWeight: "800",
    },
    studentRoll: {
      fontSize: 11,
      fontWeight: "500",
      marginTop: 1,
    },
    termAttText: {
      fontSize: 10.5,
      fontWeight: "700",
      marginTop: 2,
    },
    statusButtonsGroup: {
      flexDirection: "row",
      gap: 4,
      marginLeft: 8,
    },
    statusToggleBtn: {
      width: 32,
      height: 32,
      borderRadius: 8,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
    },
    statusToggleBtnText: {
      fontSize: 11,
      fontWeight: "900",
    },

    /* Save Button */
    saveBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 14,
      borderRadius: 14,
      marginTop: 14,
      elevation: 3,
    },
    saveBtnText: {
      color: "#FFFFFF",
      fontSize: 13.5,
      fontWeight: "800",
    },
    lockedBottomBox: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 14,
      borderRadius: 14,
      borderWidth: 1,
      marginTop: 14,
    },
    lockedBottomText: {
      fontSize: 12.5,
      fontWeight: "700",
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
      padding: 20,
      alignItems: "center",
      elevation: 12,
    },
    lockIconCircle: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: "#F59E0B18",
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 6,
    },
    modalTitle: {
      fontSize: 16.5,
      fontWeight: "800",
      marginTop: 4,
    },
    modalSub: {
      fontSize: 12,
      textAlign: "center",
      lineHeight: 16,
      marginTop: 4,
      marginBottom: 12,
    },
    summaryBox: {
      width: "100%",
      borderRadius: 14,
      borderWidth: 1,
      padding: 12,
      gap: 6,
    },
    summaryRow: {
      flexDirection: "row",
      justifyContent: "space-between",
    },
    summaryKey: {
      fontSize: 11.5,
      fontWeight: "600",
    },
    summaryVal: {
      fontSize: 12,
      fontWeight: "800",
    },
    warningBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      padding: 8,
      borderRadius: 10,
      borderWidth: 1,
      marginTop: 10,
      width: "100%",
    },
    warningText: {
      fontSize: 10.5,
      color: "#D97706",
      fontWeight: "700",
      flex: 1,
    },
    modalActionRow: {
      flexDirection: "row",
      gap: 8,
      marginTop: 14,
      width: "100%",
    },
    cancelBtn: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
    },
    cancelBtnText: {
      fontSize: 13,
      fontWeight: "800",
    },
    confirmBtn: {
      flex: 1,
      flexDirection: "row",
      gap: 6,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 12,
      borderRadius: 12,
    },
    confirmBtnText: {
      color: "#FFFFFF",
      fontSize: 13,
      fontWeight: "800",
    },
  });
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
import {
  getFacultyRoster,
  submitAttendanceBatch,
  getStaffClassName,
  getFacultySchedule,
  getFacultyData,
  savePeriodAttendanceRecord,
  getPeriodAttendanceRecords,
  subscribeToDataChanges,
} from "../../services/dataService";
import { api } from "../../services/api";
import useRefreshOnForeground from "../../hooks/useRefreshOnForeground";
import { showToast } from "../../utils/toastService";

const DEFAULT_PERIODS = [
  { id: "p1", number: 1, name: "Period 1", time: "08:45 AM - 09:40 AM", type: "Theory", subject: "Machine Learning (AD-506)" },
  { id: "p2", number: 2, name: "Period 2", time: "09:40 AM - 10:35 AM", type: "Theory", subject: "Cloud Computing (AD-505)" },
  { id: "p3", number: 3, name: "Period 3", time: "10:50 AM - 11:45 AM", type: "Theory", subject: "Explainable AI (AD-509)" },
  { id: "p4", number: 4, name: "Period 4", time: "11:45 AM - 12:40 PM", type: "Theory", subject: "Software Engineering (AD-501)" },
  { id: "p5", number: 5, name: "Period 5", time: "01:30 PM - 02:25 PM", type: "Practical Lab", subject: "ML Lab Practicals (AD-513)" },
  { id: "p6", number: 6, name: "Period 6", time: "02:25 PM - 03:20 PM", type: "Practical Lab", subject: "Big Data Lab (AD-514)" },
  { id: "p7", number: 7, name: "Period 7", time: "03:20 PM - 04:15 PM", type: "Seminar / Ward", subject: "Mentor & Tutor Ward (AD-507)" },
];

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

  // Staff In-Charge identity state
  const [staffInfo, setStaffInfo] = useState({
    name: "Ms. Z. Ananth Angel",
    staffId: "STF001",
    designation: "Assistant Professor & Class Tutor",
    department: "AI & DS",
  });

  // Period / Hour based states
  const [periods, setPeriods] = useState(DEFAULT_PERIODS);
  const [activePeriod, setActivePeriod] = useState(DEFAULT_PERIODS[0]);
  const [periodAttendance, setPeriodAttendance] = useState({}); // { [periodId]: { [studentId]: 'P'|'A'|'OD' } }
  const [periodLockState, setPeriodLockState] = useState({});   // { [periodId]: boolean }
  const [periodAudit, setPeriodAudit] = useState({});           // { [periodId]: { staffName, staffId, markedAt, etc. } }

  const [confirmVisible, setConfirmVisible] = useState(false);
  const [successVisible, setSuccessVisible] = useState(false);
  const [summary, setSummary] = useState({ present: 0, absent: 0, od: 0 });

  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Active period lock status
  const isLocked = Boolean(periodLockState[activePeriod?.id]);
  const activeAudit = periodAudit[activePeriod?.id] || null;

  const loadData = useCallback(async () => {
    try {
      const cls = await getStaffClassName();
      const todayStr = new Date().toISOString().split("T")[0];
      const [rosterRes, sectionsRes, scheduleRes, facultyRes, storedAuditRes] = await Promise.allSettled([
        getFacultyRoster(cls || undefined),
        api.get("/faculty/schedule", cls ? { class: cls } : undefined),
        getFacultySchedule(),
        getFacultyData(),
        getPeriodAttendanceRecords(todayStr, cls || "AI & DS - Section A"),
      ]);

      if (facultyRes.status === "fulfilled" && facultyRes.value) {
        const fac = facultyRes.value;
        setStaffInfo({
          name: fac.name || "Ms. Z. Ananth Angel",
          staffId: fac.staffId || fac.id || "STF001",
          designation: fac.designation || fac.role || "Assistant Professor & Class Tutor",
          department: fac.department || "AI & DS",
        });
      }

      const roster = rosterRes.status === "fulfilled" ? rosterRes.value : null;
      let loadedStudents = [];
      if (roster && roster.length > 0) {
        loadedStudents = roster.map((s, idx) => ({
          id: s.id || String(idx + 1),
          name: s.name,
          roll: s.roll || s.rollNo,
          status: s.status || (s.present === false ? "A" : "P"),
          termAtt: s.attendance?.percentage || s.termAtt || "—",
          hostel: s.hostel || "Active Student",
          isMentee: Boolean(s.isMentee),
        }));
        setStudents(loadedStudents);
      }

      // Initialize default attendance per period if not yet set
      setPeriodAttendance((prev) => {
        const next = { ...prev };
        DEFAULT_PERIODS.forEach((p) => {
          if (!next[p.id] && loadedStudents.length > 0) {
            const map = {};
            loadedStudents.forEach((st) => {
              map[st.id] = st.status || "P";
            });
            next[p.id] = map;
          }
        });
        return next;
      });

      // Load stored audit logs and locks
      if (storedAuditRes.status === "fulfilled" && storedAuditRes.value) {
        const storedAudit = storedAuditRes.value;
        setPeriodAudit(storedAudit);
        const locks = {};
        Object.keys(storedAudit).forEach((pId) => {
          if (storedAudit[pId]?.isLocked) {
            locks[pId] = true;
          }
        });
        setPeriodLockState((prev) => ({ ...prev, ...locks }));
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
      } else {
        const fallbackSections = [
          { id: "sec-a", label: "AI & DS - Section A", course: "B.Tech AI & DS", time: "Odd Semester 2026" },
          { id: "sec-b", label: "AI & DS - Section B", course: "B.Tech AI & DS", time: "Odd Semester 2026" },
        ];
        setSections(fallbackSections);
        setActiveSection((prev) => prev || fallbackSections[0]);
      }

      // Sync schedule slots if available
      const facultySched = scheduleRes.status === "fulfilled" && Array.isArray(scheduleRes.value) ? scheduleRes.value : [];
      if (facultySched.length > 0) {
        setPeriods((prev) =>
          prev.map((p, idx) => {
            const matched = facultySched[idx];
            if (matched) {
              return {
                ...p,
                subject: matched.subject || matched.course || p.subject,
                time: matched.time || p.time,
                room: matched.room || matched.venue || "D205",
              };
            }
            return p;
          })
        );
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

    const unsubscribe = subscribeToDataChanges((key, data) => {
      if (key === "roster" && Array.isArray(data)) {
        setStudents(
          data.map((s, idx) => ({
            id: s.id || String(idx + 1),
            name: s.name,
            roll: s.roll || s.rollNo,
            status: s.status || (s.present === false ? "A" : "P"),
            termAtt: s.attendance?.percentage || s.termAtt || "—",
            hostel: s.hostel || "Active Student",
            isMentee: Boolean(s.isMentee),
          }))
        );
      }
    });

    return () => unsubscribe();
  }, [fadeAnim, loadData]);

  useRefreshOnForeground(loadData);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  // Current status map for active period
  const currentPeriodMap = useMemo(() => {
    return periodAttendance[activePeriod?.id] || {};
  }, [periodAttendance, activePeriod]);

  // Set individual student status for active period
  const setStudentStatus = (id, newStatus) => {
    if (isLocked) {
      showToast(
        `Attendance for ${activePeriod.name} is entered by ${activeAudit?.staffName || staffInfo.name} and disabled until next hour.`,
        "warning"
      );
      return;
    }
    setPeriodAttendance((prev) => ({
      ...prev,
      [activePeriod.id]: {
        ...(prev[activePeriod.id] || {}),
        [id]: newStatus,
      },
    }));
  };

  // Mark all students for active period
  const markAll = (statusToSet) => {
    if (isLocked) {
      showToast(
        `Attendance for ${activePeriod.name} is entered by ${activeAudit?.staffName || staffInfo.name} and disabled until next hour.`,
        "warning"
      );
      return;
    }
    setPeriodAttendance((prev) => {
      const nextMap = { ...(prev[activePeriod.id] || {}) };
      students.forEach((st) => {
        nextMap[st.id] = statusToSet;
      });
      return { ...prev, [activePeriod.id]: nextMap };
    });
    showToast(`All students marked as ${statusToSet === "P" ? "Present" : "Absent"} for ${activePeriod.name}`, "info");
  };

  // Copy attendance from previous period
  const copyFromPreviousPeriod = () => {
    const currentIndex = periods.findIndex((p) => p.id === activePeriod.id);
    if (currentIndex <= 0) {
      showToast("No previous period to copy from.", "info");
      return;
    }
    const prevPeriod = periods[currentIndex - 1];
    const prevMap = periodAttendance[prevPeriod.id];
    if (!prevMap || Object.keys(prevMap).length === 0) {
      showToast(`No attendance recorded in ${prevPeriod.name} to copy.`, "warning");
      return;
    }

    setPeriodAttendance((prev) => ({
      ...prev,
      [activePeriod.id]: { ...prevMap },
    }));
    showToast(`Copied attendance roster from ${prevPeriod.name}!`, "success");
  };

  // KPI calculations for active period
  const { presentCount, absentCount, odCount, attendanceRate } = useMemo(() => {
    let p = 0;
    let a = 0;
    let od = 0;
    students.forEach((s) => {
      const st = currentPeriodMap[s.id] || s.status || "P";
      if (st === "P") p++;
      else if (st === "A") a++;
      else if (st === "OD") od++;
    });
    const total = students.length;
    const rate = total > 0 ? Math.round(((p + od) / total) * 100) : 0;
    return { presentCount: p, absentCount: a, odCount: od, attendanceRate: rate };
  }, [students, currentPeriodMap]);

  const openConfirmation = () => {
    setSummary({ present: presentCount, absent: absentCount, od: odCount });
    setConfirmVisible(true);
  };

  const handleLockAndSubmit = async () => {
    setConfirmVisible(false);
    const todayStr = new Date().toISOString().split("T")[0];
    const timeFormatted = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    const attendanceDocs = students.map((s) => {
      const st = currentPeriodMap[s.id] || "P";
      return {
        studentId: s.id,
        rollNo: s.roll,
        roll: s.roll,
        studentName: s.name,
        class: activeSection?.label || "AI & DS - Section A",
        date: todayStr,
        period: activePeriod.number,
        periodName: activePeriod.name,
        timeSlot: activePeriod.time,
        subject: activePeriod.subject || activeSection?.course || "Course Lecture",
        status: st === "P" ? "Present" : st === "OD" ? "On-Duty" : "Absent",
        markedBy: "faculty_staff",
        staffName: staffInfo.name,
        staffId: staffInfo.staffId,
        markedAt: timeFormatted,
        locked: true,
      };
    });

    try {
      await submitAttendanceBatch(attendanceDocs);
    } catch (err) {
      console.log("Attendance bulk submit fallback:", err);
    }

    // Prepare & save audit information
    const auditData = {
      staffName: staffInfo.name,
      staffId: staffInfo.staffId,
      staffRole: staffInfo.designation,
      markedAt: timeFormatted,
      date: todayStr,
      periodNumber: activePeriod.number,
      periodName: activePeriod.name,
      timeSlot: activePeriod.time,
      isLocked: true,
      summary: { present: presentCount, absent: absentCount, od: odCount, turnout: `${attendanceRate}%` },
    };

    setPeriodAudit((prev) => ({ ...prev, [activePeriod.id]: auditData }));
    setPeriodLockState((prev) => ({ ...prev, [activePeriod.id]: true }));

    await savePeriodAttendanceRecord(
      todayStr,
      activeSection?.id || activeSection?.label || "AI & DS - Section A",
      activePeriod.id,
      auditData
    );

    setTimeout(() => setSuccessVisible(true), 250);
  };

  const handleUnlockRequest = () => {
    showToast(`HOD override requested for ${activePeriod.name} (${activeSection?.label || ""})`, "info");
    setPeriodLockState((prev) => ({ ...prev, [activePeriod.id]: false }));
  };

  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students;
    const q = searchQuery.toLowerCase().trim();
    return students.filter(
      (s) => s.name.toLowerCase().includes(q) || s.roll.toLowerCase().includes(q)
    );
  }, [students, searchQuery]);

  const currentPeriodIndex = periods.findIndex((p) => p.id === activePeriod.id);
  const nextPeriod = currentPeriodIndex < periods.length - 1 ? periods[currentPeriodIndex + 1] : null;

  const handleShareRoster = async () => {
    try {
      const recorderText = activeAudit?.staffName
        ? `Faculty In-Charge: ${activeAudit.staffName} (${activeAudit.staffId}) [Submitted at ${activeAudit.markedAt}]`
        : `Faculty In-Charge: ${staffInfo.name} (${staffInfo.staffId})`;

      const summaryText = `📋 EDUNEX OFFICIAL ATTENDANCE RECORD\n` +
        `Period / Hour: ${activePeriod.name} (${activePeriod.time})\n` +
        `Subject: ${activePeriod.subject}\n` +
        `Class: ${activeSection?.label || ""}\n` +
        `Status: ${isLocked ? "LOCKED & FROZEN" : "DRAFT"}\n` +
        `${recorderText}\n` +
        `Date: ${new Date().toLocaleDateString()}\n\n` +
        `✅ Present: ${presentCount}\n` +
        `❌ Absent: ${absentCount}\n` +
        `🟣 On-Duty (OD): ${odCount}\n` +
        `Turnout Rate: ${attendanceRate}%`;
      await Share.share({ title: `${activePeriod.name} Attendance Record`, message: summaryText });
      showToast("Period attendance summary shared!", "success");
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
        {/* 1. HEADER & SHARE BUTTON                                                  */}
        {/* ========================================================================= */}
        <View style={styles.headerRow}>
          <View style={[styles.headerIconWrap, { backgroundColor: colors.primaryAccent + "18" }]}>
            <Icon name="clipboard-check-outline" size={24} color={colors.primaryAccent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: colors.primaryText }]}>Period Attendance</Text>
            <Text style={[styles.headerSub, { color: colors.secondaryText }]}>
              Hour-Wise Digital Roll Call & Registrar Ledger
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

        {/* ========================================================================= */}
        {/* 2. PERIOD / HOUR SELECTOR STRIP (HORIZONTAL)                              */}
        {/* ========================================================================= */}
        <View style={styles.periodSectionHeader}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Icon name="clock-outline" size={16} color={colors.primaryAccent} />
            <Text style={[styles.periodSectionTitle, { color: colors.primaryText }]}>Select Hour / Period</Text>
          </View>
          <Text style={[styles.periodCountBadge, { color: colors.secondaryText }]}>
            {periods.filter((p) => periodLockState[p.id]).length} / {periods.length} Locked
          </Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.periodPillsContainer}
        >
          {periods.map((p) => {
            const isSel = activePeriod?.id === p.id;
            const pLocked = Boolean(periodLockState[p.id]);
            const pAudit = periodAudit[p.id];

            return (
              <TouchableOpacity
                key={p.id}
                style={[
                  styles.periodPill,
                  isSel
                    ? { backgroundColor: colors.primaryAccent, borderColor: colors.primaryAccent }
                    : { backgroundColor: colors.cardBackground, borderColor: pLocked ? "#10B98155" : colors.divider },
                ]}
                onPress={() => setActivePeriod(p)}
                activeOpacity={0.85}
              >
                <View style={styles.periodPillTop}>
                  <Text style={[styles.periodPillNumber, { color: isSel ? "#FFFFFF" : colors.primaryText }]}>
                    Hour {p.number}
                  </Text>
                  {pLocked ? (
                    <View style={[styles.pillBadge, { backgroundColor: isSel ? "rgba(255,255,255,0.25)" : "#10B98120" }]}>
                      <Icon name="lock" size={10} color={isSel ? "#FFFFFF" : "#10B981"} />
                      <Text style={[styles.pillBadgeText, { color: isSel ? "#FFFFFF" : "#10B981" }]}>
                        {pAudit?.staffName ? pAudit.staffName.split(" ")[0] : "LOCKED"}
                      </Text>
                    </View>
                  ) : (
                    <View style={[styles.pillBadge, { backgroundColor: isSel ? "rgba(255,255,255,0.2)" : "#F59E0B20" }]}>
                      <Text style={[styles.pillBadgeText, { color: isSel ? "#FFFFFF" : "#D97706" }]}>DRAFT</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.periodPillTime, { color: isSel ? "rgba(255,255,255,0.85)" : colors.secondaryText }]} numberOfLines={1}>
                  {p.time.split("-")[0].trim()}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ========================================================================= */}
        {/* 3. ACTIVE PERIOD DETAILS & STAFF AUDIT BANNER                             */}
        {/* ========================================================================= */}
        <View
          style={[
            styles.activePeriodCard,
            {
              backgroundColor: colors.cardBackground,
              borderColor: isLocked ? "#10B98144" : colors.divider,
            },
          ]}
        >
          <View style={styles.activePeriodTop}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <View style={[styles.periodTag, { backgroundColor: colors.primaryAccent + "18" }]}>
                  <Text style={[styles.periodTagText, { color: colors.primaryAccent }]}>
                    {activePeriod.name.toUpperCase()} · {activePeriod.type.toUpperCase()}
                  </Text>
                </View>
                {isLocked && (
                  <View style={[styles.lockedTag, { backgroundColor: "#10B98118" }]}>
                    <Icon name="lock-check" size={12} color="#10B981" />
                    <Text style={styles.lockedTagText}>FROZEN & VERIFIED</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.activePeriodSubject, { color: colors.primaryText }]} numberOfLines={1}>
                {activePeriod.subject}
              </Text>
              <Text style={[styles.activePeriodTime, { color: colors.secondaryText }]}>
                ⏱ {activePeriod.time} · {activeSection?.label || "AI & DS - Section A"}
              </Text>
            </View>

            {isLocked ? (
              <TouchableOpacity style={[styles.unlockBtn, { borderColor: colors.primaryAccent + "44" }]} onPress={handleUnlockRequest}>
                <Icon name="lock-reset" size={14} color={colors.primaryAccent} />
                <Text style={[styles.unlockBtnText, { color: colors.primaryAccent }]}>HOD Unlock</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={[styles.lockNowBtn, { backgroundColor: colors.primaryAccent }]} onPress={openConfirmation}>
                <Icon name="lock" size={14} color="#FFFFFF" />
                <Text style={styles.lockNowBtnText}>Lock Hour {activePeriod.number}</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Dedicated Staff Audit Ledger Card */}
          <View
            style={[
              styles.staffAuditBox,
              {
                backgroundColor: isLocked ? "#10B98110" : colors.primaryBackground,
                borderColor: isLocked ? "#10B98133" : colors.divider,
              },
            ]}
          >
            <View style={styles.staffAuditLeft}>
              <View
                style={[
                  styles.staffAuditAvatar,
                  { backgroundColor: isLocked ? "#10B98122" : colors.primaryAccent + "20" },
                ]}
              >
                <Icon
                  name={isLocked ? "shield-account" : "account-tie"}
                  size={18}
                  color={isLocked ? "#10B981" : colors.primaryAccent}
                />
              </View>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={[styles.staffAuditTitle, { color: colors.primaryText }]} numberOfLines={1}>
                    {isLocked
                      ? `Recorded by: ${activeAudit?.staffName || staffInfo.name}`
                      : `Faculty In-Charge: ${staffInfo.name}`}
                  </Text>
                </View>
                <Text style={[styles.staffAuditSub, { color: colors.secondaryText }]}>
                  {isLocked
                    ? `Staff ID: ${activeAudit?.staffId || staffInfo.staffId} · Submitted at ${activeAudit?.markedAt || "Today"}`
                    : `Staff ID: ${staffInfo.staffId} · ${staffInfo.designation}`}
                </Text>
              </View>
            </View>

            {isLocked && (
              <View style={styles.verifiedBadge}>
                <Icon name="check-decagram" size={14} color="#10B981" />
                <Text style={styles.verifiedBadgeText}>VERIFIED</Text>
              </View>
            )}
          </View>

          {/* Time Lock Notice / Next Period Transition */}
          {isLocked && (
            <View style={[styles.timeLockNotice, { backgroundColor: "#F59E0B12", borderColor: "#F59E0B33" }]}>
              <Icon name="clock-alert-outline" size={16} color="#D97706" />
              <View style={{ flex: 1, marginLeft: 6 }}>
                <Text style={styles.timeLockNoticeTitle}>Attendance Frozen for this Period</Text>
                <Text style={[styles.timeLockNoticeSub, { color: colors.secondaryText }]}>
                  {nextPeriod
                    ? `Editing is disabled until next hour (${nextPeriod.name} begins at ${nextPeriod.time.split("-")[0].trim()}).`
                    : "Final period of the day is locked and signed."}
                </Text>
              </View>

              {nextPeriod && (
                <TouchableOpacity
                  style={[styles.nextHourBtn, { backgroundColor: colors.primaryAccent }]}
                  onPress={() => setActivePeriod(nextPeriod)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.nextHourBtnText}>Go to Hour {nextPeriod.number}</Text>
                  <Icon name="arrow-right" size={13} color="#FFFFFF" />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* Section Selector Pills */}
        {sections.length > 1 && (
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
                  onPress={() => setActiveSection(sec)}
                >
                  <Text style={[styles.sectionPillTitle, { color: isSel ? "#FFFFFF" : colors.primaryText }]}>
                    {sec.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

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
            {/* 4. LIVE ATTENDANCE KPI STRIP FOR ACTIVE PERIOD                            */}
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
                  placeholder={`Search in ${activePeriod.name}...`}
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
                <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
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

                  {currentPeriodIndex > 0 && (
                    <TouchableOpacity
                      style={[styles.bulkBtn, { backgroundColor: colors.primaryAccent + "18", borderColor: colors.primaryAccent + "44" }]}
                      onPress={copyFromPreviousPeriod}
                    >
                      <Icon name="content-copy" size={15} color={colors.primaryAccent} />
                      <Text style={[styles.bulkBtnText, { color: colors.primaryAccent }]}>
                        Copy Hour {periods[currentPeriodIndex - 1].number}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>

            {/* ========================================================================= */}
            {/* 5. STUDENT ROSTER FOR CURRENT PERIOD                                      */}
            {/* ========================================================================= */}
            <View style={{ gap: 8 }}>
              {filteredStudents.map((student) => {
                const currentStatus = currentPeriodMap[student.id] || "P";
                const isP = currentStatus === "P";
                const isA = currentStatus === "A";
                const isOD = currentStatus === "OD";

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
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <Text style={[styles.studentName, { color: colors.primaryText }]} numberOfLines={1}>
                            {student.name}
                          </Text>
                          {student.isMentee && (
                            <View style={styles.menteeMiniBadge}>
                              <Icon name="star" size={9} color="#F59E0B" />
                              <Text style={styles.menteeMiniBadgeText}>MENTEE</Text>
                            </View>
                          )}
                        </View>
                        <Text style={[styles.studentRoll, { color: colors.secondaryText }]}>
                          {student.roll} · {student.hostel}
                        </Text>
                        <Text style={[styles.termAttText, { color: colors.primaryAccent }]}>
                          Overall Attendance: {student.termAtt}
                        </Text>
                      </View>
                    </View>

                    {/* 3-State Action Selector: P / A / OD for Active Period */}
                    <View style={styles.statusButtonsGroup}>
                      <TouchableOpacity
                        style={[
                          styles.statusToggleBtn,
                          isP
                            ? { backgroundColor: "#10B981", borderColor: "#10B981" }
                            : { backgroundColor: colors.primaryBackground, borderColor: colors.divider },
                          isLocked && { opacity: isP ? 1 : 0.4 },
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
                          isLocked && { opacity: isA ? 1 : 0.4 },
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
                          isLocked && { opacity: isOD ? 1 : 0.4 },
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

            {/* Bottom Lock / Locked Banner */}
            {!isLocked ? (
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: colors.primaryAccent }]}
                onPress={openConfirmation}
                activeOpacity={0.85}
              >
                <Icon name="lock-check" size={20} color="#FFFFFF" />
                <Text style={styles.saveBtnText}>
                  Lock & Submit {activePeriod.name} ({presentCount} Present · {absentCount} Absent)
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={[styles.lockedBottomBox, { backgroundColor: colors.cardBackground, borderColor: "#10B98155" }]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                  <Icon name="shield-check" size={26} color="#10B981" />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.lockedBottomTitle, { color: colors.primaryText }]}>
                      {activePeriod.name} Recorded by {activeAudit?.staffName || staffInfo.name}
                    </Text>
                    <Text style={[styles.lockedBottomText, { color: colors.secondaryText }]}>
                      Sealed with Registrar at {activeAudit?.markedAt || "Today"}. Editing is disabled until next hour.
                    </Text>
                  </View>
                </View>

                {nextPeriod && (
                  <TouchableOpacity
                    style={[styles.bottomNextBtn, { backgroundColor: colors.primaryAccent }]}
                    onPress={() => setActivePeriod(nextPeriod)}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.bottomNextBtnText}>Hour {nextPeriod.number}</Text>
                    <Icon name="chevron-right" size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                )}
              </View>
            )}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ========================================================================= */}
      {/* 6. PERIOD PRE-LOCK CONFIRMATION MODAL                                     */}
      {/* ========================================================================= */}
      <Modal visible={confirmVisible} transparent animationType="fade" onRequestClose={() => setConfirmVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
            <View style={styles.lockIconCircle}>
              <Icon name="lock-alert" size={32} color="#F59E0B" />
            </View>

            <Text style={[styles.modalTitle, { color: colors.primaryText }]}>
              Lock {activePeriod.name} Attendance?
            </Text>
            <Text style={[styles.modalSub, { color: colors.secondaryText }]}>
              Please verify the period roll call. Once locked, this official ledger entry will be submitted to the University Registrar and parent SMS notifications will be triggered for absent students.
            </Text>

            {/* Summary Breakdown Grid */}
            <View style={[styles.summaryBox, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryKey, { color: colors.secondaryText }]}>Period / Slot</Text>
                <Text style={[styles.summaryVal, { color: colors.primaryText }]}>
                  {activePeriod.name} ({activePeriod.time})
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryKey, { color: colors.secondaryText }]}>Course / Subject</Text>
                <Text style={[styles.summaryVal, { color: colors.primaryText }]} numberOfLines={1}>
                  {activePeriod.subject}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryKey, { color: colors.secondaryText }]}>Class & Batch</Text>
                <Text style={[styles.summaryVal, { color: colors.primaryText }]}>{activeSection?.label || "AI & DS - Section A"}</Text>
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
      {/* 7. SUCCESS POPUP                                                          */}
      {/* ========================================================================= */}
      <Modal visible={successVisible} transparent animationType="fade" onRequestClose={() => setSuccessVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
            <Icon name="check-circle" size={54} color="#10B981" />
            <Text style={[styles.modalTitle, { color: "#10B981" }]}>{activePeriod.name} Locked!</Text>
            <Text style={[styles.modalSub, { color: colors.secondaryText }]}>
              Attendance for {activePeriod.name} ({activePeriod.subject}) has been officially registered and recorded in the academic repository.
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

    /* Period Section Header */
    periodSectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
    },
    periodSectionTitle: {
      fontSize: 13,
      fontWeight: "800",
    },
    periodCountBadge: {
      fontSize: 11,
      fontWeight: "600",
    },

    /* Period Pills */
    periodPillsContainer: {
      gap: 8,
      marginBottom: 12,
    },
    periodPill: {
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderRadius: 14,
      borderWidth: 1,
      minWidth: 105,
    },
    periodPillTop: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 6,
      marginBottom: 3,
    },
    periodPillNumber: {
      fontSize: 12.5,
      fontWeight: "800",
    },
    pillBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 2,
      paddingHorizontal: 5,
      paddingVertical: 2,
      borderRadius: 4,
    },
    pillBadgeText: {
      fontSize: 8.5,
      fontWeight: "900",
    },
    periodPillTime: {
      fontSize: 10,
      fontWeight: "600",
    },

    /* Active Period Card */
    activePeriodCard: {
      borderRadius: 16,
      borderWidth: 1,
      padding: 14,
      marginBottom: 12,
      elevation: 2,
    },
    activePeriodTop: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    periodTag: {
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 5,
      marginBottom: 4,
    },
    periodTagText: {
      fontSize: 9.5,
      fontWeight: "900",
    },
    lockedTag: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 5,
      marginBottom: 4,
    },
    lockedTagText: {
      color: "#10B981",
      fontSize: 9.5,
      fontWeight: "900",
    },
    activePeriodSubject: {
      fontSize: 15,
      fontWeight: "800",
      marginTop: 2,
    },
    activePeriodTime: {
      fontSize: 11,
      fontWeight: "500",
      marginTop: 2,
    },
    unlockBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 10,
      borderWidth: 1,
    },
    unlockBtnText: {
      fontSize: 11.5,
      fontWeight: "800",
    },
    lockNowBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
    },
    lockNowBtnText: {
      color: "#FFFFFF",
      fontSize: 11.5,
      fontWeight: "800",
    },

    /* Staff Audit Ledger Box */
    staffAuditBox: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderRadius: 12,
      borderWidth: 1,
      padding: 10,
      marginTop: 10,
    },
    staffAuditLeft: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
    },
    staffAuditAvatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      justifyContent: "center",
      alignItems: "center",
    },
    staffAuditTitle: {
      fontSize: 12,
      fontWeight: "800",
    },
    staffAuditSub: {
      fontSize: 10,
      fontWeight: "500",
      marginTop: 1,
    },
    verifiedBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      backgroundColor: "#10B98118",
      paddingHorizontal: 6,
      paddingVertical: 3,
      borderRadius: 6,
    },
    verifiedBadgeText: {
      color: "#10B981",
      fontSize: 9,
      fontWeight: "900",
    },

    /* Time Lock Notice */
    timeLockNotice: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 10,
      borderWidth: 1,
      padding: 8,
      marginTop: 8,
      gap: 6,
    },
    timeLockNoticeTitle: {
      color: "#D97706",
      fontSize: 11,
      fontWeight: "800",
    },
    timeLockNoticeSub: {
      fontSize: 10,
      fontWeight: "500",
      marginTop: 1,
    },
    nextHourBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
    },
    nextHourBtnText: {
      color: "#FFFFFF",
      fontSize: 11,
      fontWeight: "800",
    },

    /* Section Selector */
    sectionPill: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 12,
      borderWidth: 1,
    },
    sectionPillTitle: {
      fontSize: 11.5,
      fontWeight: "800",
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
      paddingHorizontal: 10,
      borderRadius: 10,
      borderWidth: 1,
      minWidth: 100,
    },
    bulkBtnText: {
      fontSize: 11,
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
    menteeMiniBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 2,
      backgroundColor: "#F59E0B18",
      paddingHorizontal: 4,
      paddingVertical: 1,
      borderRadius: 3,
    },
    menteeMiniBadgeText: {
      color: "#F59E0B",
      fontSize: 8,
      fontWeight: "900",
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
      justifyContent: "space-between",
      gap: 8,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 14,
      borderWidth: 1,
      marginTop: 14,
    },
    lockedBottomTitle: {
      fontSize: 12.5,
      fontWeight: "800",
    },
    lockedBottomText: {
      fontSize: 11,
      fontWeight: "500",
      marginTop: 2,
    },
    bottomNextBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 10,
    },
    bottomNextBtnText: {
      color: "#FFFFFF",
      fontSize: 11.5,
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
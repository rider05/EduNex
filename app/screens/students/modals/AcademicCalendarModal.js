import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  StatusBar,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { useTheme } from "../../../context/ThemeContext";
import { getAcademicCalendar, subscribeToDataChanges } from "../../../services/dataService";

const CALENDAR_DATA = {
  meta: {
    institution: "Coimbatore Institute of Engineering and Technology (CIET)",
    academicYear: "2026–2027",
    semester: "Odd Semester",
    programmes: "UG – B.E. / B.Tech. & PG – MBA",
    semesters: "Semesters III, V & VII",
    releaseDate: "19/05/2026",
    commencementDate: "02/07/2026",
    nextSemesterDate: "21/12/2026",
    totalWorkingDays: 90,
    lastInstructionDay: "31/10/2026",
  },
  milestones: [
    { event: "Commencement of Classes", date: "02 July 2026", icon: "school-outline", color: "#10B981" },
    { event: "Class Committee Meeting-I", date: "August 2026", icon: "account-group-outline", color: "#3B82F6" },
    { event: "Continuous Internal Assessment (CIA) I", date: "24 – 31 August 2026", icon: "clipboard-text-clock-outline", color: "#EF4444" },
    { event: "Feedback Survey-I", date: "September 2026", icon: "comment-text-outline", color: "#8B5CF6" },
    { event: "Class Committee Meeting-II", date: "October 2026", icon: "account-group-outline", color: "#3B82F6" },
    { event: "Continuous Internal Assessment (CIA) II", date: "22 – 28 October 2026", icon: "clipboard-text-clock-outline", color: "#EF4444" },
    { event: "Last Instruction Day (WD-90)", date: "31 October 2026", icon: "flag-checkered", color: "#EC4899" },
    { event: "Model Practical Examinations", date: "02 – 07 November 2026", icon: "flask-outline", color: "#6366F1" },
    { event: "End Semester Practical Examinations", date: "09 – 16 November 2026", icon: "flask-empty-outline", color: "#8B5CF6" },
    { event: "Commencement of Theory Examinations", date: "17 November 2026", icon: "book-open-page-variant", color: "#F59E0B" },
    { event: "Feedback Survey-II", date: "November 2026", icon: "comment-text-outline", color: "#8B5CF6" },
    { event: "Next Semester Classes Commence", date: "21 December 2026", icon: "calendar-arrow-right", color: "#10B981" },
  ],
  months: [
    {
      name: "July",
      year: "2026",
      workingDays: 24,
      days: [
        { date: 1, day: "Wed", details: "—", type: "regular" },
        { date: 2, day: "Thu", details: "Commencement of Classes", type: "event", highlight: true, wd: "WD-1" },
        { date: 3, day: "Fri", details: "WD-2", type: "wd", wd: "WD-2" },
        { date: 4, day: "Sat", details: "WD-3", type: "wd", wd: "WD-3" },
        { date: 5, day: "Sun", details: "Holiday", type: "holiday" },
        { date: 6, day: "Mon", details: "WD-4", type: "wd", wd: "WD-4" },
        { date: 7, day: "Tue", details: "WD-5", type: "wd", wd: "WD-5" },
        { date: 8, day: "Wed", details: "WD-6", type: "wd", wd: "WD-6" },
        { date: 9, day: "Thu", details: "WD-7", type: "wd", wd: "WD-7" },
        { date: 10, day: "Fri", details: "WD-8", type: "wd", wd: "WD-8" },
        { date: 11, day: "Sat", details: "Holiday", type: "holiday" },
        { date: 12, day: "Sun", details: "Holiday", type: "holiday" },
        { date: 13, day: "Mon", details: "WD-9", type: "wd", wd: "WD-9" },
        { date: 14, day: "Tue", details: "WD-10", type: "wd", wd: "WD-10" },
        { date: 15, day: "Wed", details: "WD-11", type: "wd", wd: "WD-11" },
        { date: 16, day: "Thu", details: "WD-12", type: "wd", wd: "WD-12" },
        { date: 17, day: "Fri", details: "WD-13", type: "wd", wd: "WD-13" },
        { date: 18, day: "Sat", details: "WD-14", type: "wd", wd: "WD-14" },
        { date: 19, day: "Sun", details: "Holiday", type: "holiday" },
        { date: 20, day: "Mon", details: "WD-15", type: "wd", wd: "WD-15" },
        { date: 21, day: "Tue", details: "WD-16", type: "wd", wd: "WD-16" },
        { date: 22, day: "Wed", details: "WD-17", type: "wd", wd: "WD-17" },
        { date: 23, day: "Thu", details: "WD-18", type: "wd", wd: "WD-18" },
        { date: 24, day: "Fri", details: "WD-19", type: "wd", wd: "WD-19" },
        { date: 25, day: "Sat", details: "Holiday", type: "holiday" },
        { date: 26, day: "Sun", details: "Holiday", type: "holiday" },
        { date: 27, day: "Mon", details: "WD-20", type: "wd", wd: "WD-20" },
        { date: 28, day: "Tue", details: "WD-21", type: "wd", wd: "WD-21" },
        { date: 29, day: "Wed", details: "WD-22", type: "wd", wd: "WD-22" },
        { date: 30, day: "Thu", details: "WD-23", type: "wd", wd: "WD-23" },
        { date: 31, day: "Fri", details: "WD-24", type: "wd", wd: "WD-24" },
      ],
    },
    {
      name: "August",
      year: "2026",
      workingDays: 23,
      days: [
        { date: 1, day: "Sat", details: "WD-25", type: "wd", wd: "WD-25" },
        { date: 2, day: "Sun", details: "Holiday", type: "holiday" },
        { date: 3, day: "Mon", details: "WD-26", type: "wd", wd: "WD-26" },
        { date: 4, day: "Tue", details: "WD-27", type: "wd", wd: "WD-27" },
        { date: 5, day: "Wed", details: "WD-28", type: "wd", wd: "WD-28" },
        { date: 6, day: "Thu", details: "WD-29", type: "wd", wd: "WD-29" },
        { date: 7, day: "Fri", details: "WD-30", type: "wd", wd: "WD-30" },
        { date: 8, day: "Sat", details: "Holiday", type: "holiday" },
        { date: 9, day: "Sun", details: "Holiday", type: "holiday" },
        { date: 10, day: "Mon", details: "WD-31", type: "wd", wd: "WD-31" },
        { date: 11, day: "Tue", details: "WD-32", type: "wd", wd: "WD-32" },
        { date: 12, day: "Wed", details: "WD-33", type: "wd", wd: "WD-33" },
        { date: 13, day: "Thu", details: "WD-34", type: "wd", wd: "WD-34" },
        { date: 14, day: "Fri", details: "WD-35", type: "wd", wd: "WD-35" },
        { date: 15, day: "Sat", details: "Independence Day 🇮🇳", type: "holiday", highlight: true },
        { date: 16, day: "Sun", details: "Holiday", type: "holiday" },
        { date: 17, day: "Mon", details: "WD-36", type: "wd", wd: "WD-36" },
        { date: 18, day: "Tue", details: "WD-37", type: "wd", wd: "WD-37" },
        { date: 19, day: "Wed", details: "WD-38", type: "wd", wd: "WD-38" },
        { date: 20, day: "Thu", details: "WD-39", type: "wd", wd: "WD-39" },
        { date: 21, day: "Fri", details: "WD-40", type: "wd", wd: "WD-40" },
        { date: 22, day: "Sat", details: "WD-41", type: "wd", wd: "WD-41" },
        { date: 23, day: "Sun", details: "Holiday", type: "holiday" },
        { date: 24, day: "Mon", details: "WD-42 – CIA I", type: "exam", highlight: true, wd: "WD-42" },
        { date: 25, day: "Tue", details: "WD-43 – CIA I", type: "exam", highlight: true, wd: "WD-43" },
        { date: 26, day: "Wed", details: "Milad-un-Nabi & Onam", type: "holiday", highlight: true },
        { date: 27, day: "Thu", details: "WD-44 – CIA I", type: "exam", highlight: true, wd: "WD-44" },
        { date: 28, day: "Fri", details: "WD-45 – CIA I", type: "exam", highlight: true, wd: "WD-45" },
        { date: 29, day: "Sat", details: "WD-46 – CIA I", type: "exam", highlight: true, wd: "WD-46" },
        { date: 30, day: "Sun", details: "Holiday", type: "holiday" },
        { date: 31, day: "Mon", details: "WD-47 – CIA I", type: "exam", highlight: true, wd: "WD-47" },
      ],
    },
    {
      name: "September",
      year: "2026",
      workingDays: 21,
      days: [
        { date: 1, day: "Tue", details: "WD-48", type: "wd", wd: "WD-48" },
        { date: 2, day: "Wed", details: "WD-49", type: "wd", wd: "WD-49" },
        { date: 3, day: "Thu", details: "WD-50", type: "wd", wd: "WD-50" },
        { date: 4, day: "Fri", details: "Krishna Jayanthi", type: "holiday", highlight: true },
        { date: 5, day: "Sat", details: "WD-51", type: "wd", wd: "WD-51" },
        { date: 6, day: "Sun", details: "Holiday", type: "holiday" },
        { date: 7, day: "Mon", details: "WD-51*", type: "wd", wd: "WD-51*" },
        { date: 8, day: "Tue", details: "WD-52", type: "wd", wd: "WD-52" },
        { date: 9, day: "Wed", details: "WD-53", type: "wd", wd: "WD-53" },
        { date: 10, day: "Thu", details: "WD-54", type: "wd", wd: "WD-54" },
        { date: 11, day: "Fri", details: "WD-55", type: "wd", wd: "WD-55" },
        { date: 12, day: "Sat", details: "Holiday", type: "holiday" },
        { date: 13, day: "Sun", details: "Holiday", type: "holiday" },
        { date: 14, day: "Mon", details: "Vinayakar Chaturthi", type: "holiday", highlight: true },
        { date: 15, day: "Tue", details: "WD-56", type: "wd", wd: "WD-56" },
        { date: 16, day: "Wed", details: "WD-57", type: "wd", wd: "WD-57" },
        { date: 17, day: "Thu", details: "WD-58", type: "wd", wd: "WD-58" },
        { date: 18, day: "Fri", details: "WD-59", type: "wd", wd: "WD-59" },
        { date: 19, day: "Sat", details: "WD-60", type: "wd", wd: "WD-60" },
        { date: 20, day: "Sun", details: "Holiday", type: "holiday" },
        { date: 21, day: "Mon", details: "WD-61", type: "wd", wd: "WD-61" },
        { date: 22, day: "Tue", details: "WD-62", type: "wd", wd: "WD-62" },
        { date: 23, day: "Wed", details: "WD-63", type: "wd", wd: "WD-63" },
        { date: 24, day: "Thu", details: "WD-64", type: "wd", wd: "WD-64" },
        { date: 25, day: "Fri", details: "WD-65", type: "wd", wd: "WD-65" },
        { date: 26, day: "Sat", details: "Holiday", type: "holiday" },
        { date: 27, day: "Sun", details: "Holiday", type: "holiday" },
        { date: 28, day: "Mon", details: "WD-66", type: "wd", wd: "WD-66" },
        { date: 29, day: "Tue", details: "WD-67", type: "wd", wd: "WD-67" },
        { date: 30, day: "Wed", details: "WD-68", type: "wd", wd: "WD-68" },
      ],
    },
    {
      name: "October",
      year: "2026",
      workingDays: 22,
      days: [
        { date: 1, day: "Thu", details: "WD-69", type: "wd", wd: "WD-69" },
        { date: 2, day: "Fri", details: "Gandhi Jayanthi", type: "holiday", highlight: true },
        { date: 3, day: "Sat", details: "WD-70", type: "wd", wd: "WD-70" },
        { date: 4, day: "Sun", details: "Holiday", type: "holiday" },
        { date: 5, day: "Mon", details: "WD-70*", type: "wd", wd: "WD-70*" },
        { date: 6, day: "Tue", details: "WD-71", type: "wd", wd: "WD-71" },
        { date: 7, day: "Wed", details: "WD-72", type: "wd", wd: "WD-72" },
        { date: 8, day: "Thu", details: "WD-73", type: "wd", wd: "WD-73" },
        { date: 9, day: "Fri", details: "WD-74", type: "wd", wd: "WD-74" },
        { date: 10, day: "Sat", details: "WD-75", type: "wd", wd: "WD-75" },
        { date: 11, day: "Sun", details: "Holiday", type: "holiday" },
        { date: 12, day: "Mon", details: "WD-76", type: "wd", wd: "WD-76" },
        { date: 13, day: "Tue", details: "WD-77", type: "wd", wd: "WD-77" },
        { date: 14, day: "Wed", details: "WD-78", type: "wd", wd: "WD-78" },
        { date: 15, day: "Thu", details: "WD-79", type: "wd", wd: "WD-79" },
        { date: 16, day: "Fri", details: "WD-80", type: "wd", wd: "WD-80" },
        { date: 17, day: "Sat", details: "Holiday", type: "holiday" },
        { date: 18, day: "Sun", details: "Holiday", type: "holiday" },
        { date: 19, day: "Mon", details: "Saraswathi Pooja", type: "holiday", highlight: true },
        { date: 20, day: "Tue", details: "Vijayadashami", type: "holiday", highlight: true },
        { date: 21, day: "Wed", details: "WD-81", type: "wd", wd: "WD-81" },
        { date: 22, day: "Thu", details: "WD-82 – CIA II", type: "exam", highlight: true, wd: "WD-82" },
        { date: 23, day: "Fri", details: "WD-83 – CIA II", type: "exam", highlight: true, wd: "WD-83" },
        { date: 24, day: "Sat", details: "WD-84 – CIA II", type: "exam", highlight: true, wd: "WD-84" },
        { date: 25, day: "Sun", details: "Holiday", type: "holiday" },
        { date: 26, day: "Mon", details: "WD-85 – CIA II", type: "exam", highlight: true, wd: "WD-85" },
        { date: 27, day: "Tue", details: "WD-86 – CIA II", type: "exam", highlight: true, wd: "WD-86" },
        { date: 28, day: "Wed", details: "WD-87 – CIA II", type: "exam", highlight: true, wd: "WD-87" },
        { date: 29, day: "Thu", details: "WD-88", type: "wd", wd: "WD-88" },
        { date: 30, day: "Fri", details: "WD-89", type: "wd", wd: "WD-89" },
        { date: 31, day: "Sat", details: "WD-90 – Last Instruction Day", type: "milestone", highlight: true, wd: "WD-90" },
      ],
    },
    {
      name: "November",
      year: "2026",
      workingDays: 0,
      note: "Primarily Practical & Theory Examination Period",
      days: [
        { date: 1, day: "Sun", details: "Holiday", type: "holiday" },
        { date: 2, day: "Mon", details: "Model Practical Examinations", type: "exam", highlight: true },
        { date: 3, day: "Tue", details: "Model Practical Examinations", type: "exam" },
        { date: 4, day: "Wed", details: "Model Practical Examinations", type: "exam" },
        { date: 5, day: "Thu", details: "Model Practical Examinations", type: "exam" },
        { date: 6, day: "Fri", details: "Model Practical Examinations", type: "exam" },
        { date: 7, day: "Sat", details: "Model Practical Examinations", type: "exam" },
        { date: 8, day: "Sun", details: "Deepavali 🪔", type: "holiday", highlight: true },
        { date: 9, day: "Mon", details: "End Semester Practical Examinations", type: "exam", highlight: true },
        { date: 10, day: "Tue", details: "End Semester Practical Examinations", type: "exam" },
        { date: 11, day: "Wed", details: "End Semester Practical Examinations", type: "exam" },
        { date: 12, day: "Thu", details: "End Semester Practical Examinations", type: "exam" },
        { date: 13, day: "Fri", details: "End Semester Practical Examinations", type: "exam" },
        { date: 14, day: "Sat", details: "End Semester Practical Examinations", type: "exam" },
        { date: 15, day: "Sun", details: "Holiday", type: "holiday" },
        { date: 16, day: "Mon", details: "End Semester Practical Examinations", type: "exam" },
        { date: 17, day: "Tue", details: "Commencement of Theory Examinations", type: "exam", highlight: true },
        { date: 18, day: "Wed", details: "Theory Examinations", type: "exam" },
        { date: 19, day: "Thu", details: "Theory Examinations", type: "exam" },
        { date: 20, day: "Fri", details: "Theory Examinations", type: "exam" },
        { date: 21, day: "Sat", details: "Holiday", type: "holiday" },
        { date: 22, day: "Sun", details: "Holiday", type: "holiday" },
        { date: 23, day: "Mon", details: "Theory Examinations", type: "exam" },
        { date: 24, day: "Tue", details: "Theory Examinations", type: "exam" },
        { date: 25, day: "Wed", details: "Theory Examinations", type: "exam" },
        { date: 26, day: "Thu", details: "Theory Examinations", type: "exam" },
        { date: 27, day: "Fri", details: "Theory Examinations", type: "exam" },
        { date: 28, day: "Sat", details: "Holiday", type: "holiday" },
        { date: 29, day: "Sun", details: "Holiday", type: "holiday" },
        { date: 30, day: "Mon", details: "Theory Examinations", type: "exam" },
      ],
    },
  ],
  holidays: [
    { month: "July", dates: ["5 Jul (Sun)", "11 Jul (Sat)", "12 Jul (Sun)", "19 Jul (Sun)", "25 Jul (Sat)", "26 Jul (Sun)"] },
    { month: "August", dates: ["2 Aug (Sun)", "8 Aug (Sat)", "9 Aug (Sun)", "15 Aug – Independence Day 🇮🇳", "16 Aug (Sun)", "23 Aug (Sun)", "26 Aug – Milad-un-Nabi & Onam", "30 Aug (Sun)"] },
    { month: "September", dates: ["4 Sep – Krishna Jayanthi", "6 Sep (Sun)", "12 Sep (Sat)", "13 Sep (Sun)", "14 Sep – Vinayakar Chaturthi", "20 Sep (Sun)", "26 Sep (Sat)", "27 Sep (Sun)"] },
    { month: "October", dates: ["2 Oct – Gandhi Jayanthi", "4 Oct (Sun)", "11 Oct (Sun)", "17 Oct (Sat)", "18 Oct (Sun)", "19 Oct – Saraswathi Pooja", "20 Oct – Vijayadashami", "25 Oct (Sun)"] },
    { month: "November", dates: ["1 Nov (Sun)", "8 Nov – Deepavali 🪔", "15 Nov (Sun)", "21 Nov (Sat)", "22 Nov (Sun)", "28 Nov (Sat)", "29 Nov (Sun)"] },
  ],
};

export default function AcademicCalendarModal({ visible, onClose }) {
  const { colors, isDarkMode } = useTheme();
  const styles = getStyles(colors, isDarkMode);

  const [calendarData, setCalendarData] = useState(CALENDAR_DATA);
  const [activeTab, setActiveTab] = useState("July"); // "Overview", "July", "August", "September", "October", "November", "Holidays"
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchCalendar = useCallback(async (force = false) => {
    if (force) setRefreshing(true);
    try {
      const doc = await getAcademicCalendar(force);
      if (doc && doc.months && doc.months.length > 0) {
        setCalendarData(doc);
      }
    } catch (e) {
      console.warn("Error fetching live academic calendar:", e);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      fetchCalendar();
    }
  }, [visible, fetchCalendar]);

  useEffect(() => {
    const unsub = subscribeToDataChanges((key, data) => {
      if (key === "academicCalendar" && data && data.months) {
        setCalendarData(data);
      }
    });
    return unsub;
  }, []);

  const meta = calendarData.meta || calendarData;
  const monthsList = calendarData.months || CALENDAR_DATA.months;
  const milestonesList = calendarData.milestones || CALENDAR_DATA.milestones;
  const holidaysList = calendarData.holidays || CALENDAR_DATA.holidays;

  const currentMonthData = useMemo(() => {
    return monthsList.find((m) => m.name.toLowerCase() === activeTab.toLowerCase()) || monthsList[0];
  }, [monthsList, activeTab]);

  const filteredDays = useMemo(() => {
    if (!currentMonthData || !currentMonthData.days) return [];
    if (!searchQuery.trim()) return currentMonthData.days;
    const q = searchQuery.toLowerCase();
    return currentMonthData.days.filter(
      (d) =>
        String(d.date).includes(q) ||
        d.day?.toLowerCase().includes(q) ||
        d.details?.toLowerCase().includes(q) ||
        (d.wd && d.wd.toLowerCase().includes(q))
    );
  }, [currentMonthData, searchQuery]);

  const getTagStyle = (type, highlight) => {
    if (highlight && type === "exam") {
      return { bg: "#EF444418", text: "#EF4444", border: "#EF4444" };
    }
    if (highlight && type === "milestone") {
      return { bg: "#EC489918", text: "#EC4899", border: "#EC4899" };
    }
    if (type === "holiday") {
      return { bg: isDarkMode ? "#332222" : "#FEE2E2", text: "#DC2626", border: "#FCA5A5" };
    }
    if (type === "exam") {
      return { bg: isDarkMode ? "#2D1F3D" : "#EDE9FE", text: "#7C3AED", border: "#C4B5FD" };
    }
    if (type === "event" || highlight) {
      return { bg: "#10B98118", text: "#10B981", border: "#10B981" };
    }
    return { bg: colors.primaryBackground, text: colors.primaryText, border: colors.divider };
  };

  const theoryExamMs = milestonesList.find((m) => m.event?.toLowerCase().includes("theory"))?.date || "17 Nov 2026";
  const totalWdCount = meta.totalWorkingDays || calendarData.workingDays?.total || 90;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.primaryBackground }]} edges={["top", "bottom"]}>
        {/* Header Bar */}
        <View style={[styles.headerBar, { borderBottomColor: colors.divider }]}>
          <View style={styles.headerLeft}>
            <TouchableOpacity style={styles.backBtn} onPress={onClose} activeOpacity={0.7} accessibilityLabel="Back">
              <Icon name="arrow-left" size={24} color={colors.primaryText} />
            </TouchableOpacity>
            <View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={[styles.headerTitle, { color: colors.primaryText }]}>Academic Calendar</Text>
                <View style={[styles.termBadge, { backgroundColor: colors.primaryAccent + "18" }]}>
                  <Text style={[styles.termBadgeText, { color: colors.primaryAccent }]}>ODD SEM</Text>
                </View>
                {loading && <ActivityIndicator size="small" color={colors.primaryAccent} style={{ marginLeft: 4 }} />}
              </View>
              <Text style={[styles.headerSubtitle, { color: colors.secondaryText }]}>
                {meta.institutionCode || "CIET"} {meta.academicYear || "2026–2027"} · {meta.semesters || "UG & PG"}
              </Text>
            </View>
          </View>

          <TouchableOpacity style={styles.closeRoundBtn} onPress={onClose} activeOpacity={0.7}>
            <Icon name="close" size={20} color={colors.secondaryText} />
          </TouchableOpacity>
        </View>

        {/* Tab Strip */}
        <View style={[styles.tabBar, { borderBottomColor: colors.divider }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabContent}>
            {["Overview", "July", "August", "September", "October", "November", "Holidays"].map((tab) => {
              const isSelected = activeTab === tab;
              return (
                <TouchableOpacity
                  key={tab}
                  style={[
                    styles.tabPill,
                    isSelected
                      ? { backgroundColor: colors.primaryAccent, borderColor: colors.primaryAccent }
                      : { backgroundColor: colors.cardBackground, borderColor: colors.divider },
                  ]}
                  onPress={() => {
                    setActiveTab(tab);
                    setSearchQuery("");
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.tabPillText, { color: isSelected ? "#FFFFFF" : colors.primaryText }]}>
                    {tab === "Holidays" ? "🎉 Holidays" : tab === "Overview" ? "⭐ Key Dates" : tab}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollBody}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchCalendar(true)}
              tintColor={colors.primaryAccent}
              colors={[colors.primaryAccent]}
            />
          }
        >
          {/* OVERVIEW TAB */}
          {activeTab === "Overview" && (
            <View style={{ gap: 14 }}>
              {/* Institution Hero */}
              <View style={[styles.heroCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
                <View style={styles.heroTop}>
                  <View style={[styles.instBadge, { backgroundColor: colors.primaryAccent + "18" }]}>
                    <Icon name="town-hall" size={24} color={colors.primaryAccent} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.instName, { color: colors.primaryText }]}>{meta.institution || "CIET"}</Text>
                    <Text style={[styles.instSub, { color: colors.secondaryText }]}>
                      Academic Year {meta.academicYear} · {meta.semester}
                    </Text>
                  </View>
                </View>

                {/* Quick Meta Grid */}
                <View style={[styles.metaGrid, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                  <View style={styles.metaCell}>
                    <Text style={[styles.metaLabel, { color: colors.secondaryText }]}>Classes Commence</Text>
                    <Text style={[styles.metaVal, { color: "#10B981" }]}>{meta.commencementDate || "02 July 2026"}</Text>
                  </View>
                  <View style={styles.metaCell}>
                    <Text style={[styles.metaLabel, { color: colors.secondaryText }]}>Last Instruction</Text>
                    <Text style={[styles.metaVal, { color: "#EC4899" }]}>{meta.lastInstructionDay || "31 Oct 2026"}</Text>
                  </View>
                  <View style={styles.metaCell}>
                    <Text style={[styles.metaLabel, { color: colors.secondaryText }]}>Theory Exams</Text>
                    <Text style={[styles.metaVal, { color: "#F59E0B" }]}>{theoryExamMs}</Text>
                  </View>
                  <View style={styles.metaCell}>
                    <Text style={[styles.metaLabel, { color: colors.secondaryText }]}>Next Sem Classes</Text>
                    <Text style={[styles.metaVal, { color: "#3B82F6" }]}>{meta.nextSemesterDate || "21 Dec 2026"}</Text>
                  </View>
                </View>
              </View>

              {/* Working Days Progress */}
              <View style={[styles.wdSummaryCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <Text style={[styles.cardTitle, { color: colors.primaryText }]}>📊 Month-wise Working Days</Text>
                  <View style={[styles.totalWdBadge, { backgroundColor: "#10B98118" }]}>
                    <Text style={[styles.totalWdText, { color: "#10B981" }]}>Total: {totalWdCount} Normal WDs</Text>
                  </View>
                </View>

                <View style={styles.wdGrid}>
                  {monthsList.map((m) => (
                    <TouchableOpacity
                      key={m.name}
                      style={[styles.wdMonthBox, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}
                      onPress={() => setActiveTab(m.name)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.wdMonthName, { color: colors.primaryText }]}>{m.name}</Text>
                      <Text style={[styles.wdMonthVal, { color: colors.primaryAccent }]}>
                        {m.workingDays > 0 ? `${m.workingDays} WDs` : "Exams"}
                      </Text>
                      <Text style={[styles.wdMonthSub, { color: colors.secondaryText }]}>
                        {m.name === "November" ? "Practical & Theory" : `WD Progression`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Milestones Timeline */}
              <View style={[styles.sectionCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
                <Text style={[styles.cardTitle, { color: colors.primaryText, marginBottom: 12 }]}>
                  ⭐ Important Dates & Milestones
                </Text>

                <View style={{ gap: 10 }}>
                  {milestonesList.map((ms, idx) => (
                    <View
                      key={idx}
                      style={[
                        styles.milestoneItem,
                        {
                          backgroundColor: colors.primaryBackground,
                          borderColor: colors.divider,
                          borderLeftColor: ms.color || "#3B82F6",
                        },
                      ]}
                    >
                      <View style={[styles.milestoneIconWrap, { backgroundColor: (ms.color || "#3B82F6") + "18" }]}>
                        <Icon name={ms.icon || "calendar"} size={18} color={ms.color || "#3B82F6"} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.milestoneEvent, { color: colors.primaryText }]}>{ms.event}</Text>
                        <Text style={[styles.milestoneDate, { color: ms.color || "#3B82F6" }]}>📅 {ms.date}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          )}

          {/* MONTH VIEW (July, August, September, October, November) */}
          {activeTab !== "Overview" && activeTab !== "Holidays" && currentMonthData && (
            <View style={{ gap: 12 }}>
              {/* Month Header Banner */}
              <View style={[styles.monthBannerCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View>
                    <Text style={[styles.monthBannerTitle, { color: colors.primaryText }]}>
                      🗓️ {currentMonthData.name} {currentMonthData.year}
                    </Text>
                    <Text style={[styles.monthBannerSub, { color: colors.secondaryText }]}>
                      {currentMonthData.workingDays > 0
                        ? `${currentMonthData.workingDays} Instructional Working Days`
                        : currentMonthData.note || "Examination Period"}
                    </Text>
                  </View>

                  <View style={[styles.monthBadge, { backgroundColor: colors.primaryAccent + "18" }]}>
                    <Text style={[styles.monthBadgeText, { color: colors.primaryAccent }]}>
                      {currentMonthData.workingDays > 0 ? `${currentMonthData.workingDays} WDs` : "EXAMS"}
                    </Text>
                  </View>
                </View>

                {/* Search in Month */}
                <View style={[styles.searchBox, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                  <Icon name="magnify" size={18} color={colors.secondaryText} />
                  <TextInput
                    style={[styles.searchInput, { color: colors.primaryText }]}
                    placeholder={`Filter in ${currentMonthData.name} (date, CIA, holiday)...`}
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
              </View>

              {/* Days Table List */}
              <View style={[styles.daysTableCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
                <View style={[styles.tableHead, { backgroundColor: colors.primaryBackground, borderBottomColor: colors.divider }]}>
                  <Text style={[styles.thDate, { color: colors.secondaryText }]}>DATE</Text>
                  <Text style={[styles.thDay, { color: colors.secondaryText }]}>DAY</Text>
                  <Text style={[styles.thDetails, { color: colors.secondaryText }]}>STATUS / EVENT / WD</Text>
                </View>

                {filteredDays.map((d) => {
                  const tag = getTagStyle(d.type, d.highlight);
                  const isSunday = d.day === "Sun";
                  const isSat = d.day === "Sat";

                  return (
                    <View
                      key={d.date}
                      style={[
                        styles.dayRow,
                        {
                          borderBottomColor: colors.divider,
                          backgroundColor: d.highlight
                            ? tag.bg
                            : isSunday
                            ? isDarkMode
                              ? "rgba(239, 68, 68, 0.05)"
                              : "rgba(254, 242, 242, 0.7)"
                            : isSat && d.type === "holiday"
                            ? isDarkMode
                              ? "rgba(255, 255, 255, 0.02)"
                              : "rgba(241, 245, 249, 0.6)"
                            : "transparent",
                        },
                      ]}
                    >
                      {/* Date Num */}
                      <View style={styles.dateCol}>
                        <Text style={[styles.dateText, { color: d.type === "holiday" ? "#EF4444" : colors.primaryText, fontWeight: d.highlight ? "900" : "700" }]}>
                          {d.date}
                        </Text>
                      </View>

                      {/* Day Name */}
                      <View style={styles.dayCol}>
                        <Text style={[styles.dayText, { color: isSunday ? "#EF4444" : colors.secondaryText }]}>
                          {d.day}
                        </Text>
                      </View>

                      {/* Details & WD Badge */}
                      <View style={styles.detailsCol}>
                        <View style={[styles.statusPill, { backgroundColor: tag.bg, borderColor: tag.border }]}>
                          <Text style={[styles.statusText, { color: tag.text, fontWeight: d.highlight ? "800" : "600" }]}>
                            {d.details}
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* HOLIDAYS TAB */}
          {activeTab === "Holidays" && (
            <View style={{ gap: 12 }}>
              <View style={[styles.heroCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <View style={[styles.instBadge, { backgroundColor: "#EF444418" }]}>
                    <Icon name="calendar-heart" size={24} color="#EF4444" />
                  </View>
                  <View>
                    <Text style={[styles.cardTitle, { color: colors.primaryText }]}>Official Institutional Holidays</Text>
                    <Text style={[styles.instSub, { color: colors.secondaryText }]}>Odd Semester 2026–2027 Schedule</Text>
                  </View>
                </View>
              </View>

              {holidaysList.map((hGroup) => (
                <View key={hGroup.month} style={[styles.sectionCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
                  <Text style={[styles.cardTitle, { color: colors.primaryAccent, fontSize: 14, marginBottom: 8 }]}>
                    🗓️ {hGroup.month} 2026
                  </Text>
                  <View style={styles.holidayWrap}>
                    {hGroup.dates.map((h, i) => (
                      <View key={i} style={[styles.holidayChip, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                        <Icon name="beach" size={13} color="#EF4444" />
                        <Text style={[styles.holidayChipText, { color: colors.primaryText }]}>{h}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const getStyles = (colors, isDarkMode) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    headerBar: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingTop: Platform.OS === "android" ? Math.max(StatusBar.currentHeight || 0, 14) : 14,
      paddingBottom: 14,
      borderBottomWidth: 1,
    },
    headerLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      flex: 1,
    },
    backBtn: {
      padding: 4,
    },
    closeRoundBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)",
    },
    headerTitle: {
      fontSize: 16,
      fontWeight: "800",
    },
    headerSubtitle: {
      fontSize: 11,
      fontWeight: "500",
      marginTop: 2,
    },
    termBadge: {
      paddingHorizontal: 6,
      paddingVertical: 1.5,
      borderRadius: 4,
    },
    termBadgeText: {
      fontSize: 9.5,
      fontWeight: "900",
    },

    /* Tab Bar */
    tabBar: {
      borderBottomWidth: 1,
      paddingVertical: 8,
    },
    tabContent: {
      paddingHorizontal: 16,
      gap: 8,
    },
    tabPill: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 10,
      borderWidth: 1,
    },
    tabPillText: {
      fontSize: 12,
      fontWeight: "700",
    },

    /* Scroll Body */
    scrollBody: {
      padding: 16,
      paddingBottom: 40,
    },

    /* Hero Card */
    heroCard: {
      borderRadius: 16,
      borderWidth: 1,
      padding: 14,
    },
    heroTop: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 12,
    },
    instBadge: {
      width: 44,
      height: 44,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
    },
    instName: {
      fontSize: 13.5,
      fontWeight: "800",
    },
    instSub: {
      fontSize: 11,
      fontWeight: "500",
      marginTop: 2,
    },
    metaGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      borderRadius: 12,
      borderWidth: 1,
      padding: 10,
      gap: 8,
    },
    metaCell: {
      width: "48%",
    },
    metaLabel: {
      fontSize: 10.5,
      fontWeight: "500",
    },
    metaVal: {
      fontSize: 12,
      fontWeight: "800",
      marginTop: 2,
    },

    /* Working Days Summary */
    wdSummaryCard: {
      borderRadius: 16,
      borderWidth: 1,
      padding: 14,
    },
    cardTitle: {
      fontSize: 13.5,
      fontWeight: "800",
    },
    totalWdBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
    },
    totalWdText: {
      fontSize: 11,
      fontWeight: "800",
    },
    wdGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    wdMonthBox: {
      width: "31.5%",
      borderRadius: 12,
      borderWidth: 1,
      padding: 10,
      alignItems: "center",
    },
    wdMonthName: {
      fontSize: 12,
      fontWeight: "800",
    },
    wdMonthVal: {
      fontSize: 13,
      fontWeight: "900",
      marginTop: 4,
    },
    wdMonthSub: {
      fontSize: 9.5,
      fontWeight: "500",
      marginTop: 2,
      textAlign: "center",
    },

    /* Section Card */
    sectionCard: {
      borderRadius: 16,
      borderWidth: 1,
      padding: 14,
    },
    milestoneItem: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 12,
      borderWidth: 1,
      borderLeftWidth: 4,
      padding: 10,
      gap: 10,
    },
    milestoneIconWrap: {
      width: 34,
      height: 34,
      borderRadius: 10,
      justifyContent: "center",
      alignItems: "center",
    },
    milestoneEvent: {
      fontSize: 12.5,
      fontWeight: "700",
    },
    milestoneDate: {
      fontSize: 11,
      fontWeight: "600",
      marginTop: 2,
    },

    /* Month Banner */
    monthBannerCard: {
      borderRadius: 16,
      borderWidth: 1,
      padding: 14,
      gap: 12,
    },
    monthBannerTitle: {
      fontSize: 15,
      fontWeight: "800",
    },
    monthBannerSub: {
      fontSize: 11.5,
      fontWeight: "500",
      marginTop: 2,
    },
    monthBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
    },
    monthBadgeText: {
      fontSize: 11,
      fontWeight: "900",
    },
    searchBox: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 10,
      borderWidth: 1,
      paddingHorizontal: 10,
      height: 38,
      gap: 6,
    },
    searchInput: {
      flex: 1,
      fontSize: 12,
      height: "100%",
    },

    /* Days Table */
    daysTableCard: {
      borderRadius: 16,
      borderWidth: 1,
      overflow: "hidden",
    },
    tableHead: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderBottomWidth: 1,
    },
    thDate: {
      width: 44,
      fontSize: 10.5,
      fontWeight: "800",
    },
    thDay: {
      width: 44,
      fontSize: 10.5,
      fontWeight: "800",
    },
    thDetails: {
      flex: 1,
      fontSize: 10.5,
      fontWeight: "800",
    },
    dayRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 9,
      paddingHorizontal: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    dateCol: {
      width: 44,
    },
    dateText: {
      fontSize: 13,
    },
    dayCol: {
      width: 44,
    },
    dayText: {
      fontSize: 12,
      fontWeight: "600",
    },
    detailsCol: {
      flex: 1,
    },
    statusPill: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      borderWidth: 1,
      alignSelf: "flex-start",
    },
    statusText: {
      fontSize: 11,
    },

    /* Holidays */
    holidayWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
    },
    holidayChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      borderWidth: 1,
    },
    holidayChipText: {
      fontSize: 11,
      fontWeight: "600",
    },
  });

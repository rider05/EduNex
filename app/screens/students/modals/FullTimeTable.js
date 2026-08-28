import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Modal,
  TouchableWithoutFeedback,
  Share,
  TextInput,
  Linking,
  ActivityIndicator,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "../../../context/ThemeContext";
import { showToast } from "../../../utils/toastService";
import { api } from "../../../services/api";
import { getStudentData } from "../../../services/dataService";
import { resolveIdentity } from "../../../services/identityService";

const DEPT_CODE_MAP = {
  "AI & DS": "AIDS",
  "CSE": "CSE",
  "AIML": "AIML",
  "IT": "IT",
  "ECE": "ECE",
  "EEE": "EEE",
  "MECH": "MECH",
};

// Full 5-Day Academic Schedule (Monday to Friday)
const DEFAULT_TIMETABLE_AI = {
  Monday: [
    {
      period: "Period 1",
      time: "08:45 - 09:40 AM",
      duration: "55 mins",
      code: "AI8501",
      subject: "Deep Learning & Neural Networks",
      type: "Theory",
      teacher: "Dr. Meenakshi Sundaram",
      room: "Lecture Hall 201",
      color: "#4F46E5",
      isBreak: false,
      teacherDetails: {
        designation: "Professor & HOD",
        cabin: "Staff Block A · Room 201",
        email: "meenakshi.s@edunex.edu.in",
        phone: "+91 98765 11001",
      },
    },
    {
      period: "Period 2",
      time: "09:40 - 10:35 AM",
      duration: "55 mins",
      code: "CS8502",
      subject: "Database Management Systems",
      type: "Theory",
      teacher: "Prof. Rajesh Kumar",
      room: "Lecture Hall 201",
      color: "#0D9488",
      isBreak: false,
      teacherDetails: {
        designation: "Associate Professor",
        cabin: "Staff Block A · Room 205",
        email: "rajesh.k@edunex.edu.in",
        phone: "+91 98765 11002",
      },
    },
    {
      period: "Recess",
      time: "10:35 - 10:50 AM",
      duration: "15 mins",
      subject: "Morning Refreshment Break",
      type: "Break",
      room: "Campus Courtyard",
      color: "#F59E0B",
      isBreak: true,
    },
    {
      period: "Period 3 & 4",
      time: "10:50 - 12:40 PM",
      duration: "110 mins",
      code: "AI8511",
      subject: "Big Data Analytics & PySpark Lab",
      type: "Lab",
      teacher: "Dr. Meenakshi Sundaram",
      room: "AI Computing Lab 201",
      color: "#7C3AED",
      isBreak: false,
      teacherDetails: {
        designation: "Professor & HOD",
        cabin: "Staff Block A · Room 201",
        email: "meenakshi.s@edunex.edu.in",
      },
    },
    {
      period: "Lunch",
      time: "12:40 - 01:30 PM",
      duration: "50 mins",
      subject: "Lunch Recess",
      type: "Break",
      room: "University Dining Hall",
      color: "#F59E0B",
      isBreak: true,
    },
    {
      period: "Period 5",
      time: "01:30 - 02:25 PM",
      duration: "55 mins",
      code: "AI8502",
      subject: "Natural Language Processing",
      type: "Theory",
      teacher: "Dr. Anand Chandrasekar",
      room: "Lecture Hall 204",
      color: "#DB2777",
      isBreak: false,
      teacherDetails: {
        designation: "Assistant Professor",
        cabin: "Staff Block A · Room 208",
        email: "anand.c@edunex.edu.in",
      },
    },
    {
      period: "Period 6",
      time: "02:25 - 03:20 PM",
      duration: "55 mins",
      code: "MA8501",
      subject: "Optimization Techniques in ML",
      type: "Theory",
      teacher: "Dr. S. Ramaswamy",
      room: "Lecture Hall 201",
      color: "#2563EB",
      isBreak: false,
      teacherDetails: {
        designation: "Professor of Mathematics",
        cabin: "Science Block · Room 102",
        email: "ramaswamy.s@edunex.edu.in",
      },
    },
    {
      period: "Period 7",
      time: "03:20 - 04:15 PM",
      duration: "55 mins",
      code: "AI8512",
      subject: "Capstone Mentorship & Project Review",
      type: "Lab",
      teacher: "Dr. Meenakshi Sundaram",
      room: "AI Lab 201",
      color: "#10B981",
      isBreak: false,
    },
  ],
  Tuesday: [
    {
      period: "Period 1",
      time: "08:45 - 09:40 AM",
      duration: "55 mins",
      code: "AI8502",
      subject: "Natural Language Processing",
      type: "Theory",
      teacher: "Dr. Anand Chandrasekar",
      room: "Lecture Hall 201",
      color: "#DB2777",
      isBreak: false,
    },
    {
      period: "Period 2",
      time: "09:40 - 10:35 AM",
      duration: "55 mins",
      code: "AI8501",
      subject: "Deep Learning & Neural Networks",
      type: "Theory",
      teacher: "Dr. Meenakshi Sundaram",
      room: "Lecture Hall 201",
      color: "#4F46E5",
      isBreak: false,
    },
    {
      period: "Recess",
      time: "10:35 - 10:50 AM",
      duration: "15 mins",
      subject: "Morning Refreshment Break",
      type: "Break",
      room: "Campus Courtyard",
      color: "#F59E0B",
      isBreak: true,
    },
    {
      period: "Period 3",
      time: "10:50 - 11:45 AM",
      duration: "55 mins",
      code: "CS8502",
      subject: "Database Management Systems",
      type: "Theory",
      teacher: "Prof. Rajesh Kumar",
      room: "Lecture Hall 201",
      color: "#0D9488",
      isBreak: false,
    },
    {
      period: "Period 4",
      time: "11:45 - 12:40 PM",
      duration: "55 mins",
      code: "MA8501",
      subject: "Optimization Techniques in ML",
      type: "Theory",
      teacher: "Dr. S. Ramaswamy",
      room: "Lecture Hall 201",
      color: "#2563EB",
      isBreak: false,
    },
    {
      period: "Lunch",
      time: "12:40 - 01:30 PM",
      duration: "50 mins",
      subject: "Lunch Recess",
      type: "Break",
      room: "University Dining Hall",
      color: "#F59E0B",
      isBreak: true,
    },
    {
      period: "Period 5 & 6",
      time: "01:30 - 03:20 PM",
      duration: "110 mins",
      code: "CS8511",
      subject: "Database Systems Practical Lab",
      type: "Lab",
      teacher: "Prof. Rajesh Kumar",
      room: "Database Lab 202",
      color: "#0D9488",
      isBreak: false,
    },
    {
      period: "Period 7",
      time: "03:20 - 04:15 PM",
      duration: "55 mins",
      code: "LIB001",
      subject: "Digital Library & Paper Reading",
      type: "Theory",
      teacher: "Library Faculty",
      room: "Central Digital Library",
      color: "#6366F1",
      isBreak: false,
    },
  ],
  Wednesday: [
    {
      period: "Period 1 & 2",
      time: "08:45 - 10:35 AM",
      duration: "110 mins",
      code: "AI8513",
      subject: "Computer Vision & PyTorch Model Lab",
      type: "Lab",
      teacher: "Dr. Meenakshi Sundaram",
      room: "AI Vision Lab 203",
      color: "#4F46E5",
      isBreak: false,
    },
    {
      period: "Recess",
      time: "10:35 - 10:50 AM",
      duration: "15 mins",
      subject: "Morning Refreshment Break",
      type: "Break",
      room: "Campus Courtyard",
      color: "#F59E0B",
      isBreak: true,
    },
    {
      period: "Period 3",
      time: "10:50 - 11:45 AM",
      duration: "55 mins",
      code: "AI8501",
      subject: "Deep Learning & Neural Networks",
      type: "Theory",
      teacher: "Dr. Meenakshi Sundaram",
      room: "Lecture Hall 201",
      color: "#4F46E5",
      isBreak: false,
    },
    {
      period: "Period 4",
      time: "11:45 - 12:40 PM",
      duration: "55 mins",
      code: "AI8502",
      subject: "Natural Language Processing",
      type: "Theory",
      teacher: "Dr. Anand Chandrasekar",
      room: "Lecture Hall 201",
      color: "#DB2777",
      isBreak: false,
    },
    {
      period: "Lunch",
      time: "12:40 - 01:30 PM",
      duration: "50 mins",
      subject: "Lunch Recess",
      type: "Break",
      room: "University Dining Hall",
      color: "#F59E0B",
      isBreak: true,
    },
    {
      period: "Period 5",
      time: "01:30 - 02:25 PM",
      duration: "55 mins",
      code: "CS8502",
      subject: "Database Management Systems",
      type: "Theory",
      teacher: "Prof. Rajesh Kumar",
      room: "Lecture Hall 201",
      color: "#0D9488",
      isBreak: false,
    },
    {
      period: "Period 6 & 7",
      time: "02:25 - 04:15 PM",
      duration: "110 mins",
      code: "AI8514",
      subject: "Open Elective Seminar / Webinar",
      type: "Theory",
      teacher: "Guest Faculty",
      room: "Auditorium Hall B",
      color: "#8B5CF6",
      isBreak: false,
    },
  ],
  Thursday: [
    {
      period: "Period 1",
      time: "08:45 - 09:40 AM",
      duration: "55 mins",
      code: "MA8501",
      subject: "Optimization Techniques in ML",
      type: "Theory",
      teacher: "Dr. S. Ramaswamy",
      room: "Lecture Hall 201",
      color: "#2563EB",
      isBreak: false,
    },
    {
      period: "Period 2",
      time: "09:40 - 10:35 AM",
      duration: "55 mins",
      code: "CS8502",
      subject: "Database Management Systems",
      type: "Theory",
      teacher: "Prof. Rajesh Kumar",
      room: "Lecture Hall 201",
      color: "#0D9488",
      isBreak: false,
    },
    {
      period: "Recess",
      time: "10:35 - 10:50 AM",
      duration: "15 mins",
      subject: "Morning Refreshment Break",
      type: "Break",
      room: "Campus Courtyard",
      color: "#F59E0B",
      isBreak: true,
    },
    {
      period: "Period 3",
      time: "10:50 - 11:45 AM",
      duration: "55 mins",
      code: "AI8502",
      subject: "Natural Language Processing",
      type: "Theory",
      teacher: "Dr. Anand Chandrasekar",
      room: "Lecture Hall 201",
      color: "#DB2777",
      isBreak: false,
    },
    {
      period: "Period 4",
      time: "11:45 - 12:40 PM",
      duration: "55 mins",
      code: "AI8501",
      subject: "Deep Learning & Neural Networks",
      type: "Theory",
      teacher: "Dr. Meenakshi Sundaram",
      room: "Lecture Hall 201",
      color: "#4F46E5",
      isBreak: false,
    },
    {
      period: "Lunch",
      time: "12:40 - 01:30 PM",
      duration: "50 mins",
      subject: "Lunch Recess",
      type: "Break",
      room: "University Dining Hall",
      color: "#F59E0B",
      isBreak: true,
    },
    {
      period: "Period 5 & 6",
      time: "01:30 - 03:20 PM",
      duration: "110 mins",
      code: "AI8515",
      subject: "NLP & LLM Hands-on Practical Lab",
      type: "Lab",
      teacher: "Dr. Anand Chandrasekar",
      room: "AI NLP Lab 204",
      color: "#DB2777",
      isBreak: false,
    },
    {
      period: "Period 7",
      time: "03:20 - 04:15 PM",
      duration: "55 mins",
      code: "TUT001",
      subject: "CIA Tutorial & Doubt Clearance",
      type: "Theory",
      teacher: "Dr. Meenakshi Sundaram",
      room: "Lecture Hall 201",
      color: "#10B981",
      isBreak: false,
    },
  ],
  Friday: [
    {
      period: "Period 1",
      time: "08:45 - 09:40 AM",
      duration: "55 mins",
      code: "AI8501",
      subject: "Deep Learning & Neural Networks",
      type: "Theory",
      teacher: "Dr. Meenakshi Sundaram",
      room: "Lecture Hall 201",
      color: "#4F46E5",
      isBreak: false,
    },
    {
      period: "Period 2",
      time: "09:40 - 10:35 AM",
      duration: "55 mins",
      code: "AI8502",
      subject: "Natural Language Processing",
      type: "Theory",
      teacher: "Dr. Anand Chandrasekar",
      room: "Lecture Hall 201",
      color: "#DB2777",
      isBreak: false,
    },
    {
      period: "Recess",
      time: "10:35 - 10:50 AM",
      duration: "15 mins",
      subject: "Morning Refreshment Break",
      type: "Break",
      room: "Campus Courtyard",
      color: "#F59E0B",
      isBreak: true,
    },
    {
      period: "Period 3",
      time: "10:50 - 11:45 AM",
      duration: "55 mins",
      code: "MA8501",
      subject: "Optimization Techniques in ML",
      type: "Theory",
      teacher: "Dr. S. Ramaswamy",
      room: "Lecture Hall 201",
      color: "#2563EB",
      isBreak: false,
    },
    {
      period: "Period 4",
      time: "11:45 - 12:40 PM",
      duration: "55 mins",
      code: "CS8502",
      subject: "Database Management Systems",
      type: "Theory",
      teacher: "Prof. Rajesh Kumar",
      room: "Lecture Hall 201",
      color: "#0D9488",
      isBreak: false,
    },
    {
      period: "Lunch",
      time: "12:40 - 01:30 PM",
      duration: "50 mins",
      subject: "Lunch Recess",
      type: "Break",
      room: "University Dining Hall",
      color: "#F59E0B",
      isBreak: true,
    },
    {
      period: "Period 5 & 6",
      time: "01:30 - 03:20 PM",
      duration: "110 mins",
      code: "PROJ501",
      subject: "Industry Mini-Project Prototyping",
      type: "Lab",
      teacher: "Faculty Committee",
      room: "Project Incubation Lab 101",
      color: "#10B981",
      isBreak: false,
    },
    {
      period: "Period 7",
      time: "03:20 - 04:15 PM",
      duration: "55 mins",
      code: "CLUB01",
      subject: "AI Student Technical Society",
      type: "Theory",
      teacher: "Student Tech Leads",
      room: "Seminar Hall A",
      color: "#F59E0B",
      isBreak: false,
    },
  ],
};

const daysList = [
  { short: "Mon", full: "Monday" },
  { short: "Tue", full: "Tuesday" },
  { short: "Wed", full: "Wednesday" },
  { short: "Thu", full: "Thursday" },
  { short: "Fri", full: "Friday" },
];

export default function FullTimetable({ visible = true, onClose }) {
  const { colors, isDarkMode } = useTheme();
  const styles = getStyles(colors, isDarkMode);

  const getCurrentDay = () => {
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const today = new Date().getDay();
    const currentDayName = dayNames[today];
    if (currentDayName === "Sunday" || currentDayName === "Saturday") return "Monday";
    return currentDayName;
  };

  const getTodayName = () => {
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    return dayNames[new Date().getDay()];
  };

  // Student Profile Data
  const [studentCohort, setStudentCohort] = useState({
    name: "Karthik Raja M",
    rollNo: "25ACSE001",
    department: "Artificial Intelligence & Data Science",
    deptShort: "AI & DS",
    year: "III Year",
    semester: "Semester 5 (Odd)",
    section: "Section A",
    advisor: "Dr. Meenakshi Sundaram",
  });

  const [selectedDay, setSelectedDay] = useState(getCurrentDay());
  const [selectedSessionType, setSelectedSessionType] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClass, setSelectedClass] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [timetableData, setTimetableData] = useState(DEFAULT_TIMETABLE_AI);
  const [loading, setLoading] = useState(false);

  // Load student profile
  useEffect(() => {
    async function loadStudentCohort() {
      try {
        const [student, identity, raw] = await Promise.all([
          getStudentData().catch(() => null),
          resolveIdentity().catch(() => null),
          AsyncStorage.getItem("userData").catch(() => null),
        ]);

        const rawUser = raw ? JSON.parse(raw) : null;
        const dept =
          student?.department ||
          identity?.department ||
          rawUser?.department ||
          "Artificial Intelligence & Data Science";
        const deptShort = dept.includes("AI")
          ? "AI & DS"
          : dept.includes("Computer") || dept.includes("CSE")
          ? "CSE"
          : "AI & DS";
        const year = student?.year || identity?.year || rawUser?.year || "III Year";
        const semester = student?.semester || identity?.semester || rawUser?.semester || "Semester 5";
        const section = student?.section || student?.class || rawUser?.section || "A";

        setStudentCohort({
          name: student?.name || identity?.name || rawUser?.name || "Karthik Raja M",
          rollNo: student?.rollNo || student?.roll || identity?.rollNo || "25ACSE001",
          department: dept,
          deptShort,
          year: typeof year === "number" ? `Year ${year}` : year,
          semester: `${semester} (Odd)`,
          section: section.includes("Section") ? section : `Section ${section}`,
          advisor: "Dr. Meenakshi Sundaram",
        });
      } catch (e) {
        console.log("Error loading student cohort in Timetable:", e);
      }
    }
    loadStudentCohort();
  }, []);

  const fetchTimetable = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/timetable").catch(() => null);
      const docs = res?.data || [];
      const code = DEPT_CODE_MAP[studentCohort.deptShort] || "AIDS";
      const match = docs.find(
        (d) =>
          d.departmentCode === code ||
          d.department === studentCohort.department ||
          d.department === studentCohort.deptShort
      );

      if (match?.schedule && Object.keys(match.schedule).length > 0) {
        setTimetableData(match.schedule);
      } else {
        setTimetableData(DEFAULT_TIMETABLE_AI);
      }
    } catch (err) {
      console.log("Timetable fetch error, using default:", err);
      setTimetableData(DEFAULT_TIMETABLE_AI);
    } finally {
      setLoading(false);
    }
  }, [studentCohort]);

  useEffect(() => {
    if (visible) fetchTimetable();
  }, [visible, fetchTimetable]);

  const baseDaySchedule = useMemo(() => timetableData[selectedDay] || DEFAULT_TIMETABLE_AI[selectedDay] || [], [timetableData, selectedDay]);

  const filteredSchedule = useMemo(() => {
    return baseDaySchedule.filter((item) => {
      if (selectedSessionType === "Theory" && (item.type !== "Theory" || item.isBreak)) return false;
      if (selectedSessionType === "Labs" && (item.type !== "Lab" || item.isBreak)) return false;
      if (selectedSessionType === "Breaks" && !item.isBreak) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchSub = item.subject?.toLowerCase().includes(q);
        const matchTeach = item.teacher?.toLowerCase().includes(q);
        const matchRoom = item.room?.toLowerCase().includes(q);
        const matchCode = item.code?.toLowerCase().includes(q);
        if (!matchSub && !matchTeach && !matchRoom && !matchCode) return false;
      }
      return true;
    });
  }, [baseDaySchedule, selectedSessionType, searchQuery]);

  const totalLectures = baseDaySchedule.filter((i) => !i.isBreak && i.type === "Theory").length;
  const totalLabs = baseDaySchedule.filter((i) => !i.isBreak && i.type === "Lab").length;
  const totalBreaks = baseDaySchedule.filter((i) => i.isBreak).length;

  const handleClassClick = (item) => {
    if (!item.isBreak) {
      setSelectedClass(item);
      setShowDetailsModal(true);
    }
  };

  const closeDetailsModal = () => {
    setShowDetailsModal(false);
    setTimeout(() => setSelectedClass(null), 300);
  };

  const handleShareSchedule = async () => {
    try {
      const classList = filteredSchedule
        .map(
          (c) =>
            `• [${c.time}] ${c.period ? `${c.period}: ` : ""}${c.subject} (${
              c.isBreak ? "Break" : `${c.room} · ${c.teacher || "Faculty"}`
            })`
        )
        .join("\n");

      await Share.share({
        title: `EduNex Timetable - ${selectedDay} (${studentCohort.deptShort})`,
        message: `📅 EDUNEX OFFICIAL ACADEMIC TIMETABLE\nCohort: ${studentCohort.deptShort} · ${studentCohort.year} (${studentCohort.section})\nDay: ${selectedDay}\n\nSchedule:\n${classList}\n\nGenerated via EduNex Campus App.`,
      });
      showToast(`Shared ${selectedDay}'s schedule!`, "success");
    } catch (err) {
      console.log("Share error:", err);
    }
  };

  const handleContactFaculty = (type, value) => {
    if (type === "email") {
      Linking.openURL(`mailto:${value}`).catch(() => showToast(`Email: ${value}`, "info"));
    } else if (type === "phone") {
      Linking.openURL(`tel:${value.replace(/\s+/g, "")}`).catch(() => showToast(`Phone: ${value}`, "info"));
    }
  };

  const handleBookConsultation = () => {
    showToast(`Consultation request sent to ${selectedClass?.teacher}!`, "success");
    closeDetailsModal();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.primaryBackground }]}>
        <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />

        {/* 1. TOP HEADER */}
        <View style={[styles.header, { borderBottomColor: colors.divider }]}>
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={onClose} style={[styles.closeButton, { backgroundColor: colors.cardBackground }]} activeOpacity={0.7}>
              <Icon name="arrow-left" size={22} color={colors.primaryText} />
            </TouchableOpacity>
            <View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={[styles.headerTitle, { color: colors.primaryText }]}>Class Timetable</Text>
                <View style={styles.liveTermBadge}>
                  <Text style={styles.liveTermBadgeText}>{"Odd '25"}</Text>
                </View>
              </View>
              <Text style={[styles.headerSubtitle, { color: colors.secondaryText }]}>
                {studentCohort.deptShort} · {studentCohort.year} ({studentCohort.section})
              </Text>
            </View>
          </View>

          <View style={styles.headerRightActions}>
            <TouchableOpacity
              style={[styles.headerActionBtn, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
              onPress={handleShareSchedule}
              activeOpacity={0.8}
            >
              <Icon name="share-variant-outline" size={19} color={colors.primaryAccent} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* 2. ENROLLED COHORT HERO CARD */}
          <View style={[styles.cohortHeroCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
            <View style={styles.cohortTopRow}>
              <View style={[styles.deptIconBadge, { backgroundColor: colors.primaryAccent + "18" }]}>
                <Icon name="school-outline" size={24} color={colors.primaryAccent} />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={[styles.cohortTitle, { color: colors.primaryText }]} numberOfLines={1}>
                    {studentCohort.department}
                  </Text>
                  <View style={styles.enrolledBadge}>
                    <Icon name="check-decagram" size={11} color="#10B981" />
                    <Text style={styles.enrolledBadgeText}>ENROLLED</Text>
                  </View>
                </View>

                <Text style={[styles.cohortSub, { color: colors.secondaryText }]}>
                  {studentCohort.year} · {studentCohort.section} · {studentCohort.semester}
                </Text>
              </View>
            </View>

            <View style={[styles.advisorStrip, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
              <Icon name="account-tie-outline" size={16} color={colors.primaryAccent} />
              <Text style={[styles.advisorText, { color: colors.primaryText }]}>
                Class Advisor: <Text style={{ fontWeight: "800" }}>{studentCohort.advisor}</Text>
              </Text>
            </View>
          </View>

          {/* 3. DAY SELECTOR TABS (MON - FRI) */}
          <View style={styles.daySelectorRow}>
            {daysList.map((day) => {
              const isSelected = selectedDay === day.full;
              const isToday = getTodayName() === day.full;

              return (
                <TouchableOpacity
                  key={day.full}
                  style={[
                    styles.dayPill,
                    isSelected
                      ? { backgroundColor: colors.primaryAccent, borderColor: colors.primaryAccent }
                      : { backgroundColor: colors.cardBackground, borderColor: colors.divider },
                  ]}
                  onPress={() => setSelectedDay(day.full)}
                  activeOpacity={0.8}
                >
                  {isToday && (
                    <View style={[styles.todayDot, { backgroundColor: isSelected ? "#FFFFFF" : "#10B981" }]} />
                  )}
                  <Text style={[styles.dayPillShort, { color: isSelected ? "#FFFFFF" : colors.primaryText }]}>
                    {day.short}
                  </Text>
                  <Text style={[styles.dayPillFull, { color: isSelected ? "rgba(255,255,255,0.85)" : colors.secondaryText }]}>
                    {day.full.slice(0, 3)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* 4. METRICS STRIP */}
          <View style={[styles.metricsBannerCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
            <View style={styles.metricItem}>
              <Text style={[styles.metricVal, { color: colors.primaryAccent }]}>{filteredSchedule.length}</Text>
              <Text style={[styles.metricLbl, { color: colors.secondaryText }]}>Sessions</Text>
            </View>
            <View style={[styles.metricDivider, { backgroundColor: colors.divider }]} />
            <View style={styles.metricItem}>
              <Text style={[styles.metricVal, { color: "#2563EB" }]}>{totalLectures}</Text>
              <Text style={[styles.metricLbl, { color: colors.secondaryText }]}>Lectures</Text>
            </View>
            <View style={[styles.metricDivider, { backgroundColor: colors.divider }]} />
            <View style={styles.metricItem}>
              <Text style={[styles.metricVal, { color: "#7C3AED" }]}>{totalLabs}</Text>
              <Text style={[styles.metricLbl, { color: colors.secondaryText }]}>Labs</Text>
            </View>
            <View style={[styles.metricDivider, { backgroundColor: colors.divider }]} />
            <View style={styles.metricItem}>
              <Text style={[styles.metricVal, { color: "#F59E0B" }]}>{totalBreaks}</Text>
              <Text style={[styles.metricLbl, { color: colors.secondaryText }]}>Recess</Text>
            </View>
          </View>

          {/* 5. SEARCH & SESSION TYPE FILTER */}
          <View style={styles.filterSection}>
            <View style={[styles.searchBar, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
              <Icon name="magnify" size={18} color={colors.secondaryText} />
              <TextInput
                style={[styles.searchInput, { color: colors.primaryText }]}
                placeholder="Search subject, faculty, or room..."
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

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginTop: 8 }}>
              {["All", "Theory", "Labs", "Breaks"].map((type) => {
                const isSel = selectedSessionType === type;
                return (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.typePill,
                      isSel
                        ? { backgroundColor: colors.primaryAccent, borderColor: colors.primaryAccent }
                        : { backgroundColor: colors.cardBackground, borderColor: colors.divider },
                    ]}
                    onPress={() => setSelectedSessionType(type)}
                  >
                    <Text style={[styles.typePillText, { color: isSel ? "#FFFFFF" : colors.primaryText }]}>
                      {type}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* 6. DAILY SCHEDULE TIMELINE */}
          {loading ? (
            <View style={{ paddingVertical: 40, alignItems: "center" }}>
              <ActivityIndicator size="large" color={colors.primaryAccent} />
              <Text style={{ color: colors.secondaryText, marginTop: 10, fontSize: 12 }}>
                Loading {studentCohort.deptShort} timetable...
              </Text>
            </View>
          ) : filteredSchedule.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
              <Icon name="calendar-blank-outline" size={44} color={colors.disabledText} />
              <Text style={[styles.emptyTitle, { color: colors.primaryText }]}>No Scheduled Sessions</Text>
              <Text style={[styles.emptySub, { color: colors.secondaryText }]}>
                No lectures or labs found matching your filter criteria on {selectedDay}.
              </Text>
            </View>
          ) : (
            <View style={{ gap: 10, marginTop: 10 }}>
              {filteredSchedule.map((item, idx) => {
                if (item.isBreak) {
                  return (
                    <View
                      key={idx}
                      style={[styles.breakCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
                    >
                      <Icon
                        name={item.subject.toLowerCase().includes("lunch") ? "food-fork-drink" : "coffee-outline"}
                        size={20}
                        color="#F59E0B"
                      />
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                          <Text style={[styles.breakTitle, { color: colors.primaryText }]}>{item.subject}</Text>
                          <Text style={[styles.breakDuration, { color: "#F59E0B" }]}>{item.duration}</Text>
                        </View>
                        <Text style={[styles.breakMeta, { color: colors.secondaryText }]}>
                          ⏰ {item.time} · 📍 {item.room}
                        </Text>
                      </View>
                    </View>
                  );
                }

                return (
                  <TouchableOpacity
                    key={idx}
                    style={[styles.lectureCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
                    onPress={() => handleClassClick(item)}
                    activeOpacity={0.85}
                  >
                    <View style={[styles.colorStrip, { backgroundColor: item.color || colors.primaryAccent }]} />

                    <View style={{ flex: 1, padding: 12 }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <View style={[styles.periodBadge, { backgroundColor: (item.color || colors.primaryAccent) + "18" }]}>
                            <Text style={[styles.periodBadgeText, { color: item.color || colors.primaryAccent }]}>
                              {item.period}
                            </Text>
                          </View>
                          <Text style={[styles.lectureTime, { color: colors.primaryText }]}>{item.time}</Text>
                        </View>

                        <View style={[styles.typeBadge, { backgroundColor: item.type === "Lab" ? "#7C3AED18" : "#2563EB18" }]}>
                          <Text style={[styles.typeBadgeText, { color: item.type === "Lab" ? "#7C3AED" : "#2563EB" }]}>
                            {item.type === "Lab" ? "Lab" : "Theory"}
                          </Text>
                        </View>
                      </View>

                      <Text style={[styles.subjectName, { color: colors.primaryText }]} numberOfLines={2}>
                        {item.subject}
                      </Text>

                      <View style={styles.lectureFooterRow}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
                          <Icon name="account-outline" size={15} color={colors.primaryAccent} />
                          <Text style={[styles.teacherName, { color: colors.secondaryText }]} numberOfLines={1}>
                            {item.teacher}
                          </Text>
                        </View>

                        <View style={[styles.roomPill, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                          <Icon name="map-marker-outline" size={12} color={colors.primaryAccent} />
                          <Text style={[styles.roomText, { color: colors.primaryText }]}>{item.room}</Text>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>

        {/* 7. CLASS DETAILS MODAL */}
        <Modal visible={showDetailsModal} transparent animationType="fade" onRequestClose={closeDetailsModal}>
          <TouchableWithoutFeedback onPress={closeDetailsModal}>
            <View style={styles.modalBackdrop}>
              <TouchableWithoutFeedback>
                <View style={[styles.modalCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
                  {selectedClass && (
                    <>
                      <View style={styles.modalHeader}>
                        <View style={[styles.modalIconWrap, { backgroundColor: (selectedClass.color || colors.primaryAccent) + "18" }]}>
                          <Icon name="book-open-page-variant" size={24} color={selectedClass.color || colors.primaryAccent} />
                        </View>
                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <Text style={[styles.modalSubjTitle, { color: colors.primaryText }]}>
                            {selectedClass.subject}
                          </Text>
                          <Text style={[styles.modalSubjCode, { color: colors.secondaryText }]}>
                            {selectedClass.code || "Course Core"} · {selectedClass.type}
                          </Text>
                        </View>
                        <TouchableOpacity onPress={closeDetailsModal}>
                          <Icon name="close-circle-outline" size={24} color={colors.secondaryText} />
                        </TouchableOpacity>
                      </View>

                      {/* Class Meta Grid */}
                      <View style={[styles.metaGrid, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                        <View style={styles.metaCol}>
                          <Text style={[styles.metaKey, { color: colors.secondaryText }]}>Schedule Time</Text>
                          <Text style={[styles.metaVal, { color: colors.primaryText }]}>{selectedClass.time}</Text>
                        </View>
                        <View style={styles.metaCol}>
                          <Text style={[styles.metaKey, { color: colors.secondaryText }]}>Classroom Venue</Text>
                          <Text style={[styles.metaVal, { color: colors.primaryText }]}>{selectedClass.room}</Text>
                        </View>
                      </View>

                      {/* Faculty Info Card */}
                      <View style={[styles.facultyDetailCard, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                          <View style={[styles.facAvatar, { backgroundColor: selectedClass.color || colors.primaryAccent }]}>
                            <Icon name="account-tie" size={24} color="#FFFFFF" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.facName, { color: colors.primaryText }]}>{selectedClass.teacher}</Text>
                            <Text style={[styles.facCabin, { color: colors.secondaryText }]}>
                              {selectedClass.teacherDetails?.cabin || "Faculty Cabin Block A"}
                            </Text>
                          </View>
                        </View>

                        {selectedClass.teacherDetails && (
                          <View style={styles.contactRow}>
                            {selectedClass.teacherDetails.email && (
                              <TouchableOpacity
                                style={[styles.contactBtn, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
                                onPress={() => handleContactFaculty("email", selectedClass.teacherDetails.email)}
                              >
                                <Icon name="email-outline" size={16} color={colors.primaryAccent} />
                                <Text style={[styles.contactBtnText, { color: colors.primaryAccent }]}>Email</Text>
                              </TouchableOpacity>
                            )}

                            {selectedClass.teacherDetails.phone && (
                              <TouchableOpacity
                                style={[styles.contactBtn, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
                                onPress={() => handleContactFaculty("phone", selectedClass.teacherDetails.phone)}
                              >
                                <Icon name="phone-outline" size={16} color="#10B981" />
                                <Text style={[styles.contactBtnText, { color: "#10B981" }]}>Call</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        )}
                      </View>

                      {/* Request Consultation Action */}
                      <TouchableOpacity
                        style={[styles.consultBtn, { backgroundColor: colors.primaryAccent }]}
                        onPress={handleBookConsultation}
                      >
                        <Icon name="calendar-clock" size={18} color="#FFFFFF" />
                        <Text style={styles.consultBtnText}>Request 1-on-1 Cabin Consultation</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      </SafeAreaView>
    </Modal>
  );
}

// ---------------- Styles ----------------
const getStyles = (colors, _isDarkMode) =>
  StyleSheet.create({
    container: { flex: 1 },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
    },
    headerLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    closeButton: {
      width: 38,
      height: 38,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
    },
    headerTitle: {
      fontSize: 17,
      fontWeight: "800",
      letterSpacing: -0.2,
    },
    liveTermBadge: {
      backgroundColor: "#10B98118",
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    liveTermBadgeText: {
      color: "#10B981",
      fontSize: 9.5,
      fontWeight: "900",
    },
    headerSubtitle: {
      fontSize: 11,
      fontWeight: "500",
      marginTop: 1,
    },
    headerRightActions: {
      flexDirection: "row",
      gap: 8,
    },
    headerActionBtn: {
      width: 38,
      height: 38,
      borderRadius: 12,
      borderWidth: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    scrollContent: {
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 40,
    },

    /* Cohort Hero Card */
    cohortHeroCard: {
      borderRadius: 18,
      borderWidth: 1,
      padding: 14,
      marginBottom: 12,
      elevation: 2,
    },
    cohortTopRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    deptIconBadge: {
      width: 42,
      height: 42,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
    },
    cohortTitle: {
      fontSize: 14,
      fontWeight: "800",
      flex: 1,
    },
    enrolledBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      backgroundColor: "#10B98118",
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      marginLeft: 6,
    },
    enrolledBadgeText: {
      color: "#10B981",
      fontSize: 9,
      fontWeight: "900",
    },
    cohortSub: {
      fontSize: 11,
      fontWeight: "500",
      marginTop: 2,
    },
    advisorStrip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      borderRadius: 10,
      borderWidth: 1,
      padding: 8,
      marginTop: 10,
    },
    advisorText: {
      fontSize: 11,
    },

    /* Day Selector Tabs */
    daySelectorRow: {
      flexDirection: "row",
      gap: 6,
      marginBottom: 10,
    },
    dayPill: {
      flex: 1,
      alignItems: "center",
      paddingVertical: 8,
      borderRadius: 12,
      borderWidth: 1,
      position: "relative",
    },
    todayDot: {
      position: "absolute",
      top: 4,
      right: 6,
      width: 5,
      height: 5,
      borderRadius: 2.5,
    },
    dayPillShort: {
      fontSize: 13,
      fontWeight: "800",
    },
    dayPillFull: {
      fontSize: 9.5,
      fontWeight: "600",
      marginTop: 1,
    },

    /* Metrics */
    metricsBannerCard: {
      flexDirection: "row",
      borderRadius: 14,
      borderWidth: 1,
      padding: 10,
      marginBottom: 12,
      justifyContent: "space-around",
    },
    metricItem: {
      alignItems: "center",
    },
    metricVal: {
      fontSize: 14,
      fontWeight: "900",
    },
    metricLbl: {
      fontSize: 9.5,
      fontWeight: "600",
      marginTop: 1,
    },
    metricDivider: {
      width: 1,
      height: "70%",
      alignSelf: "center",
    },

    /* Filter Section */
    filterSection: {
      marginBottom: 10,
    },
    searchBar: {
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
      padding: 0,
    },
    typePill: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 10,
      borderWidth: 1,
    },
    typePillText: {
      fontSize: 11.5,
      fontWeight: "700",
    },

    /* Timeline Cards */
    breakCard: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 14,
      borderWidth: 1,
      padding: 12,
    },
    breakTitle: {
      fontSize: 13,
      fontWeight: "800",
    },
    breakDuration: {
      fontSize: 11,
      fontWeight: "800",
    },
    breakMeta: {
      fontSize: 11,
      fontWeight: "500",
      marginTop: 2,
    },
    lectureCard: {
      flexDirection: "row",
      borderRadius: 14,
      borderWidth: 1,
      overflow: "hidden",
    },
    colorStrip: {
      width: 5,
    },
    periodBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    periodBadgeText: {
      fontSize: 9.5,
      fontWeight: "900",
    },
    lectureTime: {
      fontSize: 11.5,
      fontWeight: "700",
    },
    typeBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    typeBadgeText: {
      fontSize: 9.5,
      fontWeight: "900",
    },
    subjectName: {
      fontSize: 13.5,
      fontWeight: "800",
      marginTop: 6,
    },
    lectureFooterRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 8,
      paddingTop: 6,
      borderTopWidth: 1,
      borderTopColor: "rgba(150,150,150,0.15)",
    },
    teacherName: {
      fontSize: 11,
      fontWeight: "600",
    },
    roomPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      borderWidth: 1,
    },
    roomText: {
      fontSize: 10.5,
      fontWeight: "700",
    },
    emptyCard: {
      borderRadius: 16,
      borderWidth: 1,
      padding: 30,
      alignItems: "center",
      marginTop: 20,
    },
    emptyTitle: {
      fontSize: 15,
      fontWeight: "800",
      marginTop: 10,
    },
    emptySub: {
      fontSize: 12,
      textAlign: "center",
      marginTop: 4,
    },

    /* Modal Backdrop & Card */
    modalBackdrop: {
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
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 12,
    },
    modalIconWrap: {
      width: 42,
      height: 42,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
    },
    modalSubjTitle: {
      fontSize: 14.5,
      fontWeight: "800",
    },
    modalSubjCode: {
      fontSize: 11,
      fontWeight: "500",
      marginTop: 1,
    },
    metaGrid: {
      flexDirection: "row",
      borderRadius: 12,
      borderWidth: 1,
      padding: 10,
      marginBottom: 10,
    },
    metaCol: {
      flex: 1,
    },
    metaKey: {
      fontSize: 10.5,
      fontWeight: "600",
    },
    metaVal: {
      fontSize: 12,
      fontWeight: "800",
      marginTop: 2,
    },
    facultyDetailCard: {
      borderRadius: 14,
      borderWidth: 1,
      padding: 12,
      marginBottom: 12,
    },
    facAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: "center",
      alignItems: "center",
    },
    facName: {
      fontSize: 13,
      fontWeight: "800",
    },
    facCabin: {
      fontSize: 11,
      fontWeight: "500",
      marginTop: 1,
    },
    contactRow: {
      flexDirection: "row",
      gap: 8,
      marginTop: 10,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: "rgba(150,150,150,0.15)",
    },
    contactBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
      paddingVertical: 7,
      borderRadius: 8,
      borderWidth: 1,
    },
    contactBtnText: {
      fontSize: 11.5,
      fontWeight: "700",
    },
    consultBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 12,
      borderRadius: 12,
    },
    consultBtnText: {
      color: "#FFFFFF",
      fontSize: 12.5,
      fontWeight: "800",
    },
  });

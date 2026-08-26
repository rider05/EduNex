import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
  RefreshControl,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { useTheme } from "../../context/ThemeContext";
import { SkeletonProfileCard, SkeletonKPIRow, SkeletonListItem } from "../../components/common/SkeletonLoader";
import { getStudentData } from "../../services/dataService";
import useRefreshOnForeground from "../../hooks/useRefreshOnForeground";

// Ward info starts empty — filled only from live MongoDB data
const DEFAULT_WARD = {
  name: "",
  dept: "",
  regNo: "",
  year: "",
  semester: "",
  attendance: "",
  cgpa: "",
  advisor: "",
  contact: "",
};

const DEFAULT_COURSES = [];

export default function WardDetailsParent() {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [wardInfo, setWardInfo] = useState(DEFAULT_WARD);
  const [courses, setCourses] = useState(DEFAULT_COURSES);

  const loadData = useCallback(async () => {
    try {
      const student = await getStudentData();
      if (student) {
        setWardInfo((prev) => ({
          ...prev,
          name: student.name || prev.name,
          dept: student.department || student.dept || prev.dept,
          regNo: student.roll || student.rollNo || prev.regNo,
          year: student.year || prev.year,
          semester: student.semester || prev.semester,
          attendance: student.attendance?.percentage || (student.attendance ? String(student.attendance) : "") || prev.attendance,
          cgpa: student.cgpa != null ? String(student.cgpa) : prev.cgpa,
          advisor: student.advisor?.name || (typeof student.advisor === "string" ? student.advisor : "") || prev.advisor,
          contact: student.advisor?.email || student.advisorEmail || student.contact || prev.contact,
        }));
        if (Array.isArray(student.subjects) && student.subjects.length > 0) {
          setCourses(
            student.subjects.map((s, i) => ({
              name: s.name || s.subjectName || `Subject ${i + 1}`,
              grade: s.grade || s.marksPercentage || "-",
              credit: s.credit || s.credits || 3,
            }))
          );
        }
      }
    } catch (err) {
      console.warn("WardDetailsParent load error:", err?.message || err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Refetch ward data when the app returns to the foreground
  useRefreshOnForeground(loadData);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  // Contact Advisor
  const handleContactAdvisor = async () => {
    const email = wardInfo.contact;
    const url = `mailto:${email}`;
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      Linking.openURL(url);
    } else {
      Alert.alert("Error", "Unable to open email client.");
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
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
      <Text style={styles.header}>Ward Details</Text>

      {isLoading ? (
        <View style={{ marginTop: 10 }}>
          <SkeletonProfileCard />
          <SkeletonKPIRow count={2} />
          <SkeletonListItem />
          <SkeletonListItem />
        </View>
      ) : (
        <>
          {/* Student Info */}
          <View style={styles.profileCard}>
            <View style={styles.row}>
              <View style={styles.avatarCircle}>
                <Icon name="account-outline" size={40} color={colors.primaryAccent} />
              </View>
              <View style={{ marginLeft: 15, flex: 1 }}>
                <Text style={styles.name}>{wardInfo.name}</Text>
                <Text style={styles.subText}>{wardInfo.dept}</Text>
                <Text style={styles.subText}>Reg No: {wardInfo.regNo}</Text>
              </View>
            </View>
          </View>

          {/* Academic Overview */}
          <View style={styles.statsRow}>
        <View style={[styles.statCard, { borderColor: colors.primaryAccent }]}>
          <Icon name="calendar-check" size={22} color={colors.primaryAccent} />
          <Text style={[styles.statValue, { color: colors.primaryAccent }]}>
            {wardInfo.attendance}
          </Text>
          <Text style={styles.statLabel}>Attendance</Text>
        </View>

        <View style={[styles.statCard, { borderColor: "#2ECC71" }]}>
          <Icon name="chart-line" size={22} color="#2ECC71" />
          <Text style={[styles.statValue, { color: "#2ECC71" }]}>
            {wardInfo.cgpa}
          </Text>
          <Text style={styles.statLabel}>Current CGPA</Text>
        </View>
      </View>

      {/* Semester Info */}
      <View style={styles.semesterCard}>
        <Icon name="school-outline" size={22} color={colors.primaryAccent} />
        <Text style={styles.semesterText}>
          {wardInfo.year} • {wardInfo.semester}
        </Text>
      </View>

      {/* Course Performance */}
      <Text style={styles.sectionTitle}>Course Performance</Text>
      <View style={styles.courseCard}>
        {courses.map((course, index) => (
          <View key={index} style={styles.courseRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.courseName}>{course.name}</Text>
              <Text style={styles.courseCredit}>{course.credit} Credits</Text>
            </View>
            <View
              style={[
                styles.gradeBadge,
                {
                  backgroundColor:
                    course.grade === "O"
                      ? "#27AE60"
                      : course.grade === "A+"
                      ? "#2980B9"
                      : course.grade === "A"
                      ? "#F1C40F"
                      : "#E67E22",
                },
              ]}
            >
              <Text style={styles.gradeText}>{course.grade}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Advisor Info */}
      <Text style={styles.sectionTitle}>Class Advisor</Text>
      <View style={styles.advisorCard}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Icon name="account-tie-outline" size={30} color={colors.primaryAccent} />
          <View style={{ marginLeft: 12 }}>
            <Text style={styles.advisorName}>{wardInfo.advisor}</Text>
            <Text style={styles.advisorEmail}>{wardInfo.contact}</Text>
          </View>
        </View>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handleContactAdvisor}
          style={[styles.contactBtn, { backgroundColor: colors.primaryAccent }]}
        >
          <Icon name="email-outline" size={18} color="#fff" />
          <Text style={styles.contactText}>Contact</Text>
        </TouchableOpacity>
      </View>
      </>
      )}

      <View style={{ height: 80 }} />
    </ScrollView>
  );
}

const getStyles = (colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.primaryBackground,
    },
    contentContainer: {
      paddingHorizontal: 20,
      paddingTop: 60,
      paddingBottom: 50,
    },
    header: {
      fontSize: 26,
      fontWeight: "800",
      color: colors.primaryText,
      marginBottom: 20,
    },

    // 🔹 Profile Card
    profileCard: {
      backgroundColor: colors.cardBackground,
      borderRadius: 16,
      padding: 18,
      marginBottom: 25,
      elevation: 4,
      shadowColor: "#000",
      shadowOpacity: 0.1,
      shadowRadius: 3,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
    },
    avatarCircle: {
      width: 65,
      height: 65,
      borderRadius: 50,
      backgroundColor: colors.primaryAccent + "15",
      justifyContent: "center",
      alignItems: "center",
    },
    name: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.primaryText,
    },
    subText: {
      fontSize: 13,
      color: colors.secondaryText,
      marginTop: 2,
    },

    // 🔹 Stats
    statsRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 22,
    },
    statCard: {
      width: "48%",
      alignItems: "center",
      borderWidth: 1.5,
      borderRadius: 14,
      paddingVertical: 14,
      backgroundColor: colors.cardBackground,
      elevation: 3,
    },
    statValue: {
      fontSize: 18,
      fontWeight: "800",
      marginVertical: 5,
    },
    statLabel: {
      fontSize: 13,
      fontWeight: "500",
      color: colors.secondaryText,
    },

    // 🔹 Semester Info
    semesterCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.cardBackground,
      borderRadius: 14,
      paddingVertical: 12,
      paddingHorizontal: 14,
      marginBottom: 25,
      elevation: 2,
    },
    semesterText: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.primaryText,
      marginLeft: 8,
    },

    // 🔹 Courses
    sectionTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.primaryText,
      marginBottom: 12,
    },
    courseCard: {
      backgroundColor: colors.cardBackground,
      borderRadius: 14,
      elevation: 3,
      marginBottom: 25,
    },
    courseRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderBottomWidth: 0.8,
      borderBottomColor: colors.secondaryText + "30",
    },
    courseName: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.primaryText,
    },
    courseCredit: {
      fontSize: 12,
      color: colors.secondaryText,
      marginTop: 2,
    },
    gradeBadge: {
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    gradeText: {
      color: "#fff",
      fontWeight: "700",
      fontSize: 13,
    },

    // 🔹 Advisor Card
    advisorCard: {
      backgroundColor: colors.cardBackground,
      borderRadius: 16,
      padding: 16,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      elevation: 4,
    },
    advisorName: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.primaryText,
    },
    advisorEmail: {
      fontSize: 13,
      color: colors.secondaryText,
      marginTop: 2,
    },
    contactBtn: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 10,
    },
    contactText: {
      color: "#fff",
      fontSize: 13,
      fontWeight: "600",
      marginLeft: 6,
    },
  });
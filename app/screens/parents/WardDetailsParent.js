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
  Share,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { useTheme } from "../../context/ThemeContext";
import { SkeletonProfileCard, SkeletonKPIRow, SkeletonListItem } from "../../components/common/SkeletonLoader";
import { getStudentData, getPermits, getSubjects, enrichSubjectFromCatalog } from "../../services/dataService";
import useRefreshOnForeground from "../../hooks/useRefreshOnForeground";
import { showToast } from "../../utils/toastService";

const DEFAULT_WARD = {};

const ENROLLED_COURSES = [];

const RECENT_PERMITS = [];

export default function WardDetailsParent() {
  const { colors, isDarkMode } = useTheme();
  const styles = getStyles(colors, isDarkMode);

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [wardInfo, setWardInfo] = useState(DEFAULT_WARD);
  const [courses, setCourses] = useState(ENROLLED_COURSES);
  const [permits, setPermits] = useState(RECENT_PERMITS);

  const loadData = useCallback(async () => {
    try {
      const student = await getStudentData();
      const permitDocs = await getPermits().catch(() => []);
      const subjectCatalog = await getSubjects().catch(() => []);
      if (student) {
        setWardInfo((prev) => ({
          ...prev,
          name: student.name || prev.name,
          dept: student.department || student.dept || prev.dept,
          rollNo: student.roll || student.rollNo || prev.rollNo,
          regNo: student.regNo || prev.regNo || "",
          year: student.year || prev.year,
          semester: student.semester || prev.semester,
          batch: student.batch || prev.batch,
          section: student.section || prev.section,
          attendance: student.attendance?.percentage || prev.attendance,
          cgpa: student.cgpa != null ? String(student.cgpa) : prev.cgpa,
          advisor: student.advisor?.name || (typeof student.advisor === "string" ? student.advisor : prev.advisor),
          advisorPhone: student.advisor?.phone || student.advisorPhone || prev.advisorPhone,
          advisorEmail: student.advisor?.email || student.advisorEmail || prev.advisorEmail,
          advisorCabin: student.advisor?.cabin || prev.advisorCabin,
          bloodGroup: student.bloodGroup || prev.bloodGroup,
          hostel:
            typeof student.hostel === "boolean"
              ? student.hostel
                ? "Residential"
                : "Day Scholar"
              : student.hostel || prev.hostel || "—",
          phone: student.phone || prev.phone,
        }));
        if (Array.isArray(student.subjects)) {
          setCourses(
            student.subjects.map((c, i) => {
              const en = enrichSubjectFromCatalog(c, subjectCatalog);
              return {
                code: en.code || en.subjectCode || "",
                name: en.name || en.title || "",
                faculty: en.faculty || en.facultyInCharge || en.teacher || "—",
                credits: en.credits != null ? en.credits : "—",
                grade: en.grade || "—",
                attendance: en.attendance || "",
                type: en.type || (en.credits >= 4 ? "Core" : "Theory"),
                color:
                  en.color || ["#4F46E5", "#0EA5E9", "#8B5CF6", "#10B981", "#F59E0B"][i % 5],
                icon: en.icon || "book-open-variant",
              };
            })
          );
        } else if (Array.isArray(student.courses)) {
          setCourses(student.courses);
        }
        if (Array.isArray(permitDocs) && permitDocs.length > 0) {
          const wardRoll = student.rollNo || student.roll || "";
          setPermits(
            permitDocs
              .filter((p) => !wardRoll || p.rollNo === wardRoll || p.studentId === wardRoll)
              .map((p, i) => ({
                id: p.id || p._id || `prm-${i}`,
                type: p.type || "entry",
                destination: p.place || p.destination || p.gate || "Campus",
                place: p.place || p.gate || "Campus",
                time: p.time || "",
                date: p.date || "",
                gate: p.gate || "Main Gate",
                status: p.status || "granted",
                color: p.color || (p.type === "exit" ? "#F59E0B" : "#10B981"),
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

  useRefreshOnForeground(loadData);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleContactAdvisor = () => {
    if (!wardInfo.advisorPhone) return;
    Linking.openURL(`tel:${wardInfo.advisorPhone}`).catch(() => {
      Alert.alert("Error", `Cannot dial ${wardInfo.advisorPhone}`);
    });
  };

  const handleEmailAdvisor = () => {
    if (!wardInfo.advisorEmail) return;
    Linking.openURL(`mailto:${wardInfo.advisorEmail}?subject=Parent%20Inquiry%20regarding%20${wardInfo.name}`).catch(() => {
      Alert.alert("Error", `Cannot open email client for ${wardInfo.advisorEmail}`);
    });
  };

  const handleShareWardProfile = async () => {
    try {
      await Share.share({
        title: `Ward Academic Profile - ${wardInfo.name}`,
        message: `🎓 EDUNEX WARD ACADEMIC DOSSIER\nStudent Name: ${wardInfo.name}\nRoll No: ${wardInfo.rollNo} · Reg No: ${wardInfo.regNo}\nProgram: ${wardInfo.dept} (${wardInfo.year})\nCGPA: ${wardInfo.cgpa} / 10.0 (Rank: ${wardInfo.rank})\nAttendance: ${wardInfo.attendance} (${wardInfo.attendanceDays})\nClass Counselor: ${wardInfo.advisor}\nStatus: ENROLLED & ACTIVE`,
      });
      showToast("Ward profile summary shared!", "success");
    } catch (err) {
      console.log("Share error:", err);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.primaryBackground }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
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
        <View style={styles.header}>
          <View style={[styles.headerIconWrap, { backgroundColor: colors.primaryAccent + "18" }]}>
            <Icon name="account-child-circle" size={24} color={colors.primaryAccent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: colors.primaryText }]}>Ward Profile</Text>
            <Text style={[styles.headerSubtitle, { color: colors.secondaryText }]}>
              Academic Dossier, Performance & Welfare Records
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.sharePillBtn, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
            onPress={handleShareWardProfile}
            activeOpacity={0.8}
          >
            <Icon name="share-variant-outline" size={16} color={colors.primaryAccent} />
            <Text style={[styles.sharePillBtnText, { color: colors.primaryAccent }]}>Share</Text>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={{ marginTop: 10 }}>
            <SkeletonProfileCard />
            <SkeletonKPIRow count={2} />
            <SkeletonListItem />
            <SkeletonListItem />
          </View>
        ) : (
          <>
            {/* ========================================================================= */}
            {/* 2. WARD IDENTITY HERO CARD                                                */}
            {/* ========================================================================= */}
            <View style={[styles.wardHeroCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
              <View style={styles.wardHeroTop}>
                <View style={[styles.avatarCircle, { backgroundColor: colors.primaryAccent }]}>
                  <Text style={styles.avatarInitials}>
                    {(wardInfo.name || "—")
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)}
                  </Text>
                </View>

                <View style={{ flex: 1, marginLeft: 14 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={[styles.wardName, { color: colors.primaryText }]} numberOfLines={1}>
                      {wardInfo.name}
                    </Text>
                    <View style={styles.activeBadge}>
                      <View style={styles.greenDot} />
                      <Text style={styles.activeBadgeText}>ACTIVE</Text>
                    </View>
                  </View>

                  <Text style={[styles.wardDept, { color: colors.primaryAccent }]} numberOfLines={1}>
                    {wardInfo.dept}
                  </Text>

                  <Text style={[styles.wardMeta, { color: colors.secondaryText }]}>
                    Roll: {wardInfo.rollNo} · Reg: {wardInfo.regNo}
                  </Text>
                </View>
              </View>

              {/* Meta Specs Grid */}
              <View style={[styles.specsGrid, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                <View style={styles.specItem}>
                  <Text style={[styles.specLabel, { color: colors.secondaryText }]}>Batch & Section</Text>
                  <Text style={[styles.specVal, { color: colors.primaryText }]}>
                    {wardInfo.batch} ({wardInfo.section})
                  </Text>
                </View>
                <View style={styles.specItem}>
                  <Text style={[styles.specLabel, { color: colors.secondaryText }]}>Campus Residence</Text>
                  <Text style={[styles.specVal, { color: colors.primaryText }]}>{wardInfo.hostel}</Text>
                </View>
                <View style={styles.specItem}>
                  <Text style={[styles.specLabel, { color: colors.secondaryText }]}>Blood Group</Text>
                  <Text style={[styles.specVal, { color: "#EF4444" }]}>{wardInfo.bloodGroup}</Text>
                </View>
                <View style={styles.specItem}>
                  <Text style={[styles.specLabel, { color: colors.secondaryText }]}>Current Term</Text>
                  <Text style={[styles.specVal, { color: colors.primaryText }]}>{wardInfo.semester}</Text>
                </View>
              </View>
            </View>

            {/* ========================================================================= */}
            {/* 3. ACADEMIC PERFORMANCE & ATTENDANCE KPI STRIP                            */}
            {/* ========================================================================= */}
            <View style={styles.kpiRow}>
              <View style={[styles.kpiCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
                <View style={[styles.kpiIconWrap, { backgroundColor: "#10B98118" }]}>
                  <Icon name="calendar-check" size={20} color="#10B981" />
                </View>
                <Text style={[styles.kpiVal, { color: "#10B981" }]}>{wardInfo.attendance}</Text>
                <Text style={[styles.kpiLabel, { color: colors.secondaryText }]}>Attendance</Text>
                <Text style={[styles.kpiSub, { color: colors.disabledText }]}>{wardInfo.attendanceDays}</Text>
              </View>

              <View style={[styles.kpiCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
                <View style={[styles.kpiIconWrap, { backgroundColor: "#4F46E518" }]}>
                  <Icon name="trophy-outline" size={20} color="#4F46E5" />
                </View>
                <Text style={[styles.kpiVal, { color: "#4F46E5" }]}>{wardInfo.cgpa}</Text>
                <Text style={[styles.kpiLabel, { color: colors.secondaryText }]}>Current CGPA</Text>
                <Text style={[styles.kpiSub, { color: colors.disabledText }]}>{wardInfo.rank}</Text>
              </View>

              <View style={[styles.kpiCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
                <View style={[styles.kpiIconWrap, { backgroundColor: "#8B5CF618" }]}>
                  <Icon name="certificate-outline" size={20} color="#8B5CF6" />
                </View>
                <Text style={[styles.kpiVal, { color: "#8B5CF6" }]}>{wardInfo.credits}</Text>
                <Text style={[styles.kpiLabel, { color: colors.secondaryText }]}>Credits Cleared</Text>
                <Text style={[styles.kpiSub, { color: colors.disabledText }]}>All Passed</Text>
              </View>
            </View>

            {/* ========================================================================= */}
            {/* 4. CLASS ADVISOR & MENTORSHIP CONTACT CARD                                */}
            {/* ========================================================================= */}
            <View style={[styles.advisorCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
              <View style={styles.advisorHeader}>
                <View style={[styles.advisorIconWrap, { backgroundColor: colors.primaryAccent + "18" }]}>
                  <Icon name="account-tie-outline" size={24} color={colors.primaryAccent} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.advisorRole, { color: colors.secondaryText }]}>Designated Class Counselor</Text>
                  <Text style={[styles.advisorName, { color: colors.primaryText }]}>{wardInfo.advisor}</Text>
                  <Text style={[styles.advisorCabin, { color: colors.disabledText }]}>{wardInfo.advisorCabin}</Text>
                </View>
              </View>

              <View style={styles.advisorActions}>
                <TouchableOpacity
                  style={[styles.advisorBtn, { backgroundColor: colors.primaryAccent }]}
                  onPress={handleContactAdvisor}
                  activeOpacity={0.85}
                >
                  <Icon name="phone" size={16} color="#FFFFFF" />
                  <Text style={styles.advisorBtnText}>Call Counselor</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.advisorBtnAlt, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}
                  onPress={handleEmailAdvisor}
                  activeOpacity={0.8}
                >
                  <Icon name="email-outline" size={16} color={colors.primaryText} />
                  <Text style={[styles.advisorBtnAltText, { color: colors.primaryText }]}>Email Inquiry</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* ========================================================================= */}
            {/* 5. ENROLLED SEMESTER COURSES & EVALUATION                                  */}
            {/* ========================================================================= */}
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: colors.primaryText }]}>
                Enrolled Semester Courses ({courses.length})
              </Text>
            </View>

            <View style={{ gap: 10 }}>
              {courses.map((course, index) => (
                <View
                  key={index}
                  style={[styles.courseCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
                >
                  <View style={styles.courseCardTop}>
                    <View style={[styles.courseIconCircle, { backgroundColor: course.color }]}>
                      <Icon name={course.icon} size={20} color="#FFFFFF" />
                    </View>

                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text style={[styles.courseCode, { color: course.color }]}>{course.code}</Text>
                        <Text style={[styles.courseCredits, { color: colors.secondaryText }]}>· {course.credits} Credits</Text>
                      </View>
                      <Text style={[styles.courseName, { color: colors.primaryText }]} numberOfLines={1}>
                        {course.name}
                      </Text>
                      <Text style={[styles.courseFaculty, { color: colors.secondaryText }]}>
                        Instructor: {course.faculty}
                      </Text>
                    </View>

                    {/* Grade Badge */}
                    <View
                      style={[
                        styles.gradeBadge,
                        {
                          backgroundColor:
                            course.grade === "O"
                              ? "#10B981"
                              : course.grade === "A+"
                              ? "#2563EB"
                              : "#F59E0B",
                        },
                      ]}
                    >
                      <Text style={styles.gradeBadgeText}>Grade {course.grade}</Text>
                    </View>
                  </View>

                  <View style={[styles.courseCardBottom, { borderTopColor: colors.divider }]}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Icon name="calendar-check" size={13} color="#10B981" />
                      <Text style={[styles.courseAttText, { color: "#10B981" }]}>
                        {course.attendance} Attendance
                      </Text>
                    </View>
                    <Text style={[styles.courseTypeText, { color: colors.secondaryText }]}>
                      {course.type} Course
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            {/* ========================================================================= */}
            {/* 6. CAMPUS WELFARE & GATE PERMITS LOG                                      */}
            {/* ========================================================================= */}
            <View style={[styles.sectionHeaderRow, { marginTop: 18 }]}>
              <Text style={[styles.sectionTitle, { color: colors.primaryText }]}>
                Campus Welfare & Leave Permits
              </Text>
            </View>

            <View style={{ gap: 8 }}>
              {permits.map((p) => (
                <View
                  key={p.id}
                  style={[styles.permitCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
                >
                  <View style={[styles.permitIndicator, { backgroundColor: p.color }]} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[styles.permitType, { color: colors.primaryText }]}>{p.type}</Text>
                    <Text style={[styles.permitDest, { color: colors.secondaryText }]}>{p.destination}</Text>
                    <Text style={[styles.permitDate, { color: colors.disabledText }]}>{p.date}</Text>
                  </View>
                  <View style={styles.permitStatusPill}>
                    <Icon name="check-decagram" size={13} color="#10B981" />
                    <Text style={styles.permitStatusText}>{p.status}</Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ---------------- Styles ----------------
const getStyles = (colors, isDarkMode) =>
  StyleSheet.create({
    container: { flex: 1 },
    scrollView: { flex: 1 },
    contentContainer: { paddingHorizontal: 16, paddingTop: 44, paddingBottom: 80 },

    /* Header */
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginBottom: 16,
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
    headerSubtitle: {
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

    /* Ward Hero Card */
    wardHeroCard: {
      borderRadius: 20,
      borderWidth: 1,
      padding: 16,
      marginBottom: 14,
      elevation: 3,
      shadowColor: "#000",
      shadowOpacity: 0.08,
      shadowRadius: 8,
    },
    wardHeroTop: {
      flexDirection: "row",
      alignItems: "center",
    },
    avatarCircle: {
      width: 56,
      height: 56,
      borderRadius: 28,
      justifyContent: "center",
      alignItems: "center",
    },
    avatarInitials: {
      color: "#FFFFFF",
      fontSize: 20,
      fontWeight: "900",
    },
    wardName: {
      fontSize: 17,
      fontWeight: "900",
      letterSpacing: -0.2,
      flex: 1,
    },
    activeBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: "#10B98114",
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    greenDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: "#10B981",
    },
    activeBadgeText: {
      color: "#10B981",
      fontSize: 8.5,
      fontWeight: "900",
    },
    wardDept: {
      fontSize: 12.5,
      fontWeight: "700",
      marginTop: 2,
    },
    wardMeta: {
      fontSize: 11,
      fontWeight: "500",
      marginTop: 2,
    },
    specsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      borderRadius: 12,
      borderWidth: 1,
      padding: 10,
      marginTop: 12,
      gap: 8,
    },
    specItem: {
      width: "47%",
    },
    specLabel: {
      fontSize: 10.5,
      fontWeight: "600",
    },
    specVal: {
      fontSize: 12,
      fontWeight: "800",
      marginTop: 1,
    },

    /* KPI Row */
    kpiRow: {
      flexDirection: "row",
      gap: 8,
      marginBottom: 14,
    },
    kpiCard: {
      flex: 1,
      alignItems: "center",
      paddingVertical: 12,
      borderRadius: 16,
      borderWidth: 1,
      elevation: 2,
    },
    kpiIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 6,
    },
    kpiVal: {
      fontSize: 15.5,
      fontWeight: "900",
    },
    kpiLabel: {
      fontSize: 11,
      fontWeight: "700",
      marginTop: 1,
    },
    kpiSub: {
      fontSize: 9.5,
      fontWeight: "500",
      marginTop: 2,
    },

    /* Advisor Card */
    advisorCard: {
      borderRadius: 18,
      borderWidth: 1,
      padding: 14,
      marginBottom: 14,
    },
    advisorHeader: {
      flexDirection: "row",
      alignItems: "center",
    },
    advisorIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
    },
    advisorRole: {
      fontSize: 10.5,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    advisorName: {
      fontSize: 14,
      fontWeight: "800",
      marginTop: 1,
    },
    advisorCabin: {
      fontSize: 11,
      fontWeight: "500",
      marginTop: 1,
    },
    advisorActions: {
      flexDirection: "row",
      gap: 8,
      marginTop: 12,
    },
    advisorBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 9,
      borderRadius: 10,
    },
    advisorBtnText: {
      color: "#FFFFFF",
      fontSize: 12,
      fontWeight: "800",
    },
    advisorBtnAlt: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 9,
      borderRadius: 10,
      borderWidth: 1,
    },
    advisorBtnAltText: {
      fontSize: 12,
      fontWeight: "700",
    },

    /* Courses Section */
    sectionHeaderRow: {
      marginBottom: 10,
    },
    sectionTitle: {
      fontSize: 15,
      fontWeight: "800",
    },
    courseCard: {
      borderRadius: 16,
      borderWidth: 1,
      padding: 14,
      elevation: 2,
    },
    courseCardTop: {
      flexDirection: "row",
      alignItems: "center",
    },
    courseIconCircle: {
      width: 40,
      height: 40,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
    },
    courseCode: {
      fontSize: 11,
      fontWeight: "900",
    },
    courseCredits: {
      fontSize: 10.5,
      fontWeight: "600",
    },
    courseName: {
      fontSize: 13.5,
      fontWeight: "800",
      marginTop: 1,
    },
    courseFaculty: {
      fontSize: 11,
      fontWeight: "500",
      marginTop: 2,
    },
    gradeBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
    },
    gradeBadgeText: {
      color: "#FFFFFF",
      fontSize: 10.5,
      fontWeight: "900",
    },
    courseCardBottom: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      borderTopWidth: 1,
      marginTop: 10,
      paddingTop: 8,
    },
    courseAttText: {
      fontSize: 11,
      fontWeight: "700",
    },
    courseTypeText: {
      fontSize: 11,
      fontWeight: "600",
    },

    /* Permits */
    permitCard: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 14,
      borderWidth: 1,
      padding: 12,
    },
    permitIndicator: {
      width: 4,
      height: 38,
      borderRadius: 2,
    },
    permitType: {
      fontSize: 13,
      fontWeight: "800",
    },
    permitDest: {
      fontSize: 11,
      fontWeight: "500",
      marginTop: 1,
    },
    permitDate: {
      fontSize: 10.5,
      fontWeight: "500",
      marginTop: 2,
    },
    permitStatusPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: "#10B98114",
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
    },
    permitStatusText: {
      color: "#10B981",
      fontSize: 10,
      fontWeight: "800",
    },
  });
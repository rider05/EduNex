import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useTheme } from "../../../context/ThemeContext";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { LinearGradient } from "expo-linear-gradient";
import { getExams, getInstitutions, getStudentData } from "../../../services/dataService";
import { shareHallTicketPdf } from "../../../utils/pdfGenerator";
import { showToast } from "../../../utils/toastService";

const { width } = Dimensions.get("window");

export default function ExamModal({ visible, onClose }) {
  const { colors } = useTheme();

  const [weekExams, setWeekExams] = useState([]);
  const [index, setIndex] = useState(0);
  const [daysLeft, setDaysLeft] = useState(0);
  const [hallTicketsReleased, setHallTicketsReleased] = useState(false);
  const [examSettings, setExamSettings] = useState({});
  const [studentInfo, setStudentInfo] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const progressAnim = useRef(new Animated.Value(0)).current;

  const loadExams = useCallback(async () => {
    try {
      const [examsRes, instRes, studentRes] = await Promise.allSettled([
        getExams(),
        getInstitutions(),
        getStudentData(),
      ]);

      if (studentRes.status === "fulfilled" && studentRes.value) {
        setStudentInfo(studentRes.value);
      }

      let examList = [];
      if (examsRes.status === "fulfilled" && examsRes.value) {
        const rawList = examsRes.value.records || examsRes.value.exams || [];
        examList = rawList.map((e) => ({
          subject: e.subject || e.subjectName || e.course || e.examName || "—",
          subjectCode: e.subjectCode || e.code || "—",
          date: e.date || "",
          time: e.time || "10:00 AM - 01:00 PM",
          venue: e.hall || e.room || "Hall D205",
          maxMarks: e.maxMarks || 50,
          hallTicketsReleased: !!e.hallTicketsReleased,
        }));
      }

      setWeekExams(examList);
      setIndex(0);

      // Check Hall Ticket release from institution or exams
      let isReleased = false;
      let settings = {
        session: "Continuous Internal Assessment (CIA-2)",
        academicYear: "2026–2027 (Odd Semester)",
        center: "Hall D205, Main Academic Block",
        coe: "Prof. S. R. Ramachandran, Ph.D. (Controller of Examinations)",
      };

      if (instRes.status === "fulfilled" && Array.isArray(instRes.value) && instRes.value[0]?.examSettings) {
        const es = instRes.value[0].examSettings;
        settings = { ...settings, ...es };
        isReleased = Boolean(es.hallTicketsReleased);
      } else if (examList.some((e) => e.hallTicketsReleased)) {
        isReleased = true;
      }

      setExamSettings(settings);
      setHallTicketsReleased(isReleased);
    } catch {
      setWeekExams([]);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      loadExams();
    }
  }, [visible, loadExams]);

  const currentExam = weekExams[index] || null;
  const examDate = currentExam?.date ? new Date(currentExam.date) : new Date();

  useEffect(() => {
    if (!currentExam?.date) return;
    const dateObj = new Date(currentExam.date);
    const now = new Date();
    const diffTime = dateObj - now;
    const diffDays = Math.max(Math.ceil(diffTime / (1000 * 60 * 60 * 24)), 0);
    setDaysLeft(diffDays);

    const percentage = Math.min(1, Math.max(0, (7 - diffDays) / 7));
    Animated.timing(progressAnim, {
      toValue: percentage,
      duration: 800,
      useNativeDriver: false,
    }).start();
  }, [currentExam, progressAnim]);

  const getProgressColor = () => {
    if (daysLeft >= 5) return "#2ECC71";
    if (daysLeft >= 3) return "#F1C40F";
    if (daysLeft >= 1) return "#E67E22";
    return "#E74C3C";
  };
  const progressColor = getProgressColor();

  const handlePrev = () => index > 0 && setIndex(index - 1);
  const handleNext = () => index < weekExams.length - 1 && setIndex(index + 1);

  const dayName = currentExam?.date ? examDate.toLocaleDateString("en-US", { weekday: "long" }) : "";
  const dateNum = currentExam?.date ? examDate.getDate() : "";

  const handleDownloadHallTicket = async () => {
    if (!hallTicketsReleased) {
      showToast("Hall Ticket has not been released yet by the CoE.", "info");
      return;
    }
    setIsDownloading(true);
    try {
      await shareHallTicketPdf({
        student: studentInfo || {},
        exams: weekExams,
        examSettings: examSettings,
      });
      showToast("Official Hall Ticket PDF generated!", "success");
    } catch (err) {
      console.log("Download hall ticket error:", err);
      showToast("Could not generate Hall Ticket PDF", "error");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.modalContainer, { backgroundColor: colors.cardBackground }]}>
          <LinearGradient colors={[colors.primaryAccent, colors.primaryAccent + "EE"]} style={styles.headerBar}>
            <TouchableOpacity disabled={index === 0} onPress={handlePrev} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Icon name="chevron-left-circle" size={28} color={index === 0 ? "rgba(255,255,255,0.3)" : "#fff"} />
            </TouchableOpacity>
            <View style={styles.headerTitleBox}>
              <Icon name="book-education-outline" size={20} color="#fff" />
              <Text style={styles.headerTitle}>Examination Center</Text>
            </View>
            <TouchableOpacity disabled={index === weekExams.length - 1} onPress={handleNext} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Icon name="chevron-right-circle" size={28} color={index === weekExams.length - 1 ? "rgba(255,255,255,0.3)" : "#fff"} />
            </TouchableOpacity>
          </LinearGradient>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
            {!currentExam ? (
              <View style={{ alignItems: "center", paddingVertical: 30 }}>
                <Icon name="calendar-blank-outline" size={48} color={colors.secondaryText} />
                <Text style={[styles.subjectTitle, { color: colors.primaryText, borderBottomWidth: 0, marginTop: 12 }]}>
                  No Exams Scheduled
                </Text>
                <Text style={[styles.footerNote, { color: colors.secondaryText, marginTop: 8 }]}>
                  There are currently no active exams configured in the academic calendar.
                </Text>
              </View>
            ) : (
              <>
                <View style={[styles.dateCircle, { borderColor: colors.primaryAccent }]}>
                  <Text style={[styles.dateNum, { color: colors.primaryAccent }]}>{dateNum}</Text>
                  <Text style={[styles.dayText, { color: colors.secondaryText }]}>{dayName.slice(0, 3)}</Text>
                </View>

                <Text style={[styles.subjectTitle, { color: colors.primaryText, borderColor: progressColor }]}>
                  {currentExam.subject}
                </Text>

                <View style={[styles.block, { borderColor: colors.divider, backgroundColor: colors.primaryBackground }]}>
                  <Icon name="clock-outline" size={20} color={colors.primaryAccent} style={styles.blockIcon} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.label, { color: colors.secondaryText }]}>Session Timing</Text>
                    <Text style={[styles.value, { color: colors.primaryText }]}>{currentExam.time}</Text>
                  </View>
                </View>

                <View style={[styles.block, { borderColor: colors.divider, backgroundColor: colors.primaryBackground }]}>
                  <Icon name="map-marker-outline" size={20} color={colors.primaryAccent} style={styles.blockIcon} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.label, { color: colors.secondaryText }]}>Examination Hall / Venue</Text>
                    <Text style={[styles.value, { color: colors.primaryText }]}>{currentExam.venue}</Text>
                  </View>
                </View>

                {/* Hall Ticket Release & Download Section */}
                <View style={[styles.hallTicketCard, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <Icon
                      name={hallTicketsReleased ? "ticket-confirmation-outline" : "lock-outline"}
                      size={20}
                      color={hallTicketsReleased ? "#10B981" : "#F59E0B"}
                    />
                    <Text style={[styles.hallTicketTitle, { color: colors.primaryText }]}>
                      {hallTicketsReleased ? "Hall Ticket Available" : "Hall Ticket Pending"}
                    </Text>
                  </View>

                  {hallTicketsReleased ? (
                    <>
                      <Text style={[styles.hallTicketSub, { color: colors.secondaryText }]}>
                        Released by Controller of Examinations. Carry a printed copy & College ID card to the exam hall.
                      </Text>
                      <TouchableOpacity
                        style={[styles.downloadBtn, { backgroundColor: colors.primaryAccent }]}
                        onPress={handleDownloadHallTicket}
                        disabled={isDownloading}
                        activeOpacity={0.85}
                      >
                        {isDownloading ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                            <Icon name="download-box-outline" size={18} color="#FFFFFF" />
                            <Text style={styles.downloadBtnText}>Download Official Hall Ticket (PDF)</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </>
                  ) : (
                    <Text style={[styles.hallTicketSub, { color: colors.secondaryText }]}>
                      🔒 Hall Ticket has not been released yet by the Controller of Examinations. It will become downloadable here once administrative release is enabled.
                    </Text>
                  )}
                </View>

                <View style={styles.progressContainer}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={[styles.progressLabel, { color: colors.secondaryText }]}>CIA-2 Assessment Progress</Text>
                    <Text style={[styles.progressLabel, { color: colors.primaryText, fontWeight: "800" }]}>
                      {daysLeft > 0 ? `${daysLeft} day${daysLeft > 1 ? "s" : ""} left` : "Exam Day"}
                    </Text>
                  </View>
                  <View style={[styles.progressBar, { backgroundColor: colors.divider }]}>
                    <Animated.View
                      style={[
                        styles.progressFill,
                        {
                          backgroundColor: progressColor,
                          width: progressAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: ["0%", "100%"],
                          }),
                        },
                      ]}
                    />
                  </View>
                </View>
              </>
            )}
          </ScrollView>

          <View style={[styles.buttonContainer, { borderTopColor: colors.divider }]}>
            <TouchableOpacity style={[styles.closeButton, { backgroundColor: colors.primaryAccent }]} onPress={onClose} activeOpacity={0.8}>
              <Icon name="check-circle-outline" size={18} color="#fff" />
              <Text style={styles.closeText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 16,
  },
  modalContainer: {
    width: width * 0.9,
    maxHeight: "88%",
    borderRadius: 22,
    overflow: "hidden",
    elevation: 12,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  headerBar: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 16,
  },
  headerTitleBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 16,
    letterSpacing: 0.2,
  },
  content: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    alignItems: "center",
  },
  dateCircle: {
    borderWidth: 2.5,
    borderRadius: 50,
    width: 64,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  dateNum: {
    fontSize: 22,
    fontWeight: "900",
  },
  dayText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  subjectTitle: {
    fontSize: 17,
    fontWeight: "800",
    borderBottomWidth: 2,
    marginBottom: 10,
    paddingBottom: 4,
    textAlign: "center",
  },
  block: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginVertical: 4,
    width: "100%",
  },
  blockIcon: {
    marginRight: 10,
  },
  label: {
    fontSize: 10.5,
    fontWeight: "600",
  },
  value: {
    fontSize: 13,
    fontWeight: "800",
    marginTop: 1,
  },
  hallTicketCard: {
    width: "100%",
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginTop: 10,
    marginBottom: 8,
  },
  hallTicketTitle: {
    fontSize: 13,
    fontWeight: "800",
  },
  hallTicketSub: {
    fontSize: 11,
    fontWeight: "500",
    lineHeight: 15,
  },
  downloadBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 10,
  },
  downloadBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  progressContainer: {
    width: "100%",
    marginTop: 6,
    marginBottom: 4,
  },
  progressLabel: {
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 4,
  },
  progressBar: {
    width: "100%",
    height: 6,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
  },
  buttonContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  closeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
    width: "100%",
  },
  closeText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
    marginLeft: 6,
  },
  footerNote: {
    textAlign: "center",
    fontSize: 12,
    marginTop: 8,
  },
});

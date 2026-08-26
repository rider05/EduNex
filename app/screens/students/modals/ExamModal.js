import React, { useState, useEffect, useRef } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
} from "react-native";
import { useTheme } from "../../../context/ThemeContext";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { LinearGradient } from "expo-linear-gradient";

const { width } = Dimensions.get("window");

export default function ExamModal({ visible, onClose }) {
  const { colors } = useTheme();

  // 🎓 Weekly exam schedule (college style)
  const weekExams = [
    {
      subject: "Database Management Systems",
      code: "AI-201",
      date: "2025-11-18",
      time: "10:00 AM - 01:00 PM",
      portion: "Unit 1 - Relational Model, Unit 2 - SQL, Unit 3 - Normalization",
      credits: 4,
      venue: "Exam Hall B2",
    },
    {
      subject: "Data Structures & Algorithms",
      code: "AI-202",
      date: "2025-11-20",
      time: "10:00 AM - 01:00 PM",
      portion: "Unit 1 - Trees, Unit 2 - Graphs, Unit 3 - Dynamic Programming",
      credits: 4,
      venue: "Hall 302",
    },
    {
      subject: "Machine Learning Fundamentals",
      code: "AI-203",
      date: "2025-11-22",
      time: "02:00 PM - 05:00 PM",
      portion: "Unit 1 - Regression, Unit 2 - Classification, Unit 3 - Clustering",
      credits: 4,
      venue: "Seminar Hall",
    },
  ];

  const [index, setIndex] = useState(0);
  const [daysLeft, setDaysLeft] = useState(0);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const currentExam = weekExams[index];
  const examDate = new Date(currentExam.date);

  // 🕒 Calculate days left dynamically
  useEffect(() => {
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
  }, [currentExam.date, progressAnim]);

  // 🎨 Dynamic progress color
  const getProgressColor = () => {
    if (daysLeft >= 5) return "#2ECC71";
    if (daysLeft >= 3) return "#F1C40F";
    if (daysLeft >= 1) return "#E67E22";
    return "#E74C3C";
  };
  const progressColor = getProgressColor();

  // 🔁 Navigation
  const handlePrev = () => index > 0 && setIndex(index - 1);
  const handleNext = () =>
    index < weekExams.length - 1 && setIndex(index + 1);

  const dayName = examDate.toLocaleDateString("en-US", { weekday: "long" });
  const dateNum = examDate.getDate();

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View
          style={[
            styles.modalContainer,
            { backgroundColor: colors.cardBackground },
          ]}
        >
          {/* Header */}
          <LinearGradient
            colors={[colors.primaryAccent, colors.primaryAccent + "AA"]}
            style={styles.headerBar}
          >
            <TouchableOpacity disabled={index === 0} onPress={handlePrev}>
              <Icon
                name="chevron-left-circle"
                size={30}
                color={index === 0 ? "#ccc" : "#fff"}
              />
            </TouchableOpacity>

            <View style={styles.headerTitleBox}>
              <Icon name="book-education-outline" size={22} color="#fff" />
              <Text style={styles.headerTitle}>Exam Schedule</Text>
            </View>

            <TouchableOpacity
              disabled={index === weekExams.length - 1}
              onPress={handleNext}
            >
              <Icon
                name="chevron-right-circle"
                size={30}
                color={
                  index === weekExams.length - 1 ? "#ccc" : "#fff"
                }
              />
            </TouchableOpacity>
          </LinearGradient>

          {/* Content */}
          <View style={styles.content}>
            {/* Date Circle */}
            <View
              style={[
                styles.dateCircle,
                { borderColor: colors.primaryAccent },
              ]}
            >
              <Text style={[styles.dateNum, { color: colors.primaryAccent }]}>
                {dateNum}
              </Text>
              <Text style={[styles.dayText, { color: colors.secondaryText }]}>
                {dayName}
              </Text>
            </View>

            <Text
              style={[
                styles.subjectTitle,
                { color: colors.primaryText, borderColor: progressColor },
              ]}
            >
              {currentExam.subject}
            </Text>

            <View
              style={[
                styles.block,
                { borderColor: colors.primaryAccent + "55" },
              ]}
            >
              <Icon
                name="clock-outline"
                size={22}
                color={colors.primaryAccent}
                style={styles.blockIcon}
              />
              <View>
                <Text style={[styles.label, { color: colors.secondaryText }]}>
                  Time
                </Text>
                <Text style={[styles.value, { color: colors.primaryText }]}>
                  {currentExam.time}
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.block,
                { borderColor: colors.primaryAccent + "55" },
              ]}
            >
              <Icon
                name="map-marker"
                size={22}
                color={colors.primaryAccent}
                style={styles.blockIcon}
              />
              <View>
                <Text style={[styles.label, { color: colors.secondaryText }]}>
                  Venue
                </Text>
                <Text style={[styles.value, { color: colors.primaryText }]}>
                  {currentExam.venue}
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.statusContainer,
                { borderColor: colors.primaryAccent + "44" },
              ]}
            >
              <Icon name="alarm-check" size={18} color={colors.primaryAccent} />
              <Text
                style={[styles.statusText, { color: colors.primaryAccent }]}
              >
                Scheduled
              </Text>
            </View>

            <Text style={[styles.footerNote, { color: colors.secondaryText }]}>
              🎯 Keep your ID card ready & revise key points before class!
            </Text>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressContainer}>
            <Text style={[styles.progressLabel, { color: colors.primaryText }]}>
              {daysLeft > 0
                ? `${daysLeft} day${daysLeft > 1 ? "s" : ""} left`
                : "Exam Day 🎓"}
            </Text>
            <View style={styles.progressBar}>
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

          {/* Close Button */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[
                styles.closeButton,
                { backgroundColor: colors.primaryAccent },
              ]}
              onPress={onClose}
              activeOpacity={0.8}
            >
              <Icon name="check-circle-outline" size={18} color="#fff" />
              <Text style={styles.closeText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// 🧩 Styles
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  modalContainer: {
    width: width * 0.84,
    borderRadius: 20,
    overflow: "hidden",
    elevation: 10,
  },
  headerBar: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  headerTitleBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerTitle: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 18,
  },
  content: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    alignItems: "center",
  },
  dateCircle: {
    borderWidth: 2,
    borderRadius: 50,
    width: 70,
    height: 70,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  dateNum: {
    fontSize: 24,
    fontWeight: "800",
  },
  dayText: {
    fontSize: 13,
    fontWeight: "500",
  },
  subjectTitle: {
    fontSize: 19,
    fontWeight: "700",
    borderBottomWidth: 2,
    marginBottom: 10,
    paddingBottom: 3,
  },
  block: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
    marginVertical: 6,
    width: "100%",
  },
  blockIcon: { marginRight: 10 },
  label: { fontSize: 13, fontWeight: "500" },
  value: { fontSize: 15, fontWeight: "700", marginTop: 2 },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 25,
    paddingVertical: 6,
    paddingHorizontal: 18,
    marginTop: 10,
  },
  statusText: { fontWeight: "700", marginLeft: 6, fontSize: 14 },
  footerNote: {
    textAlign: "center",
    fontSize: 13,
    fontStyle: "italic",
    marginTop: 10,
  },
  progressContainer: {
    width: "100%",
    paddingHorizontal: 18,
    marginTop: 8,
  },
  progressLabel: { fontSize: 13, fontWeight: "600", marginBottom: 4 },
  progressBar: {
    width: "100%",
    height: 8,
    borderRadius: 5,
    backgroundColor: "rgba(255,255,255,0.1)",
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 5 },
  buttonContainer: {
    paddingHorizontal: 18,
    paddingBottom: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
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
    fontSize: 15,
    fontWeight: "700",
    marginLeft: 6,
  },
});
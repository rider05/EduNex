import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { useTheme } from "../../../context/ThemeContext";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import Svg, { Circle } from "react-native-svg";
import { LinearGradient as ExpoGradient } from "expo-linear-gradient";

const { width } = Dimensions.get("window");

export default function AttendanceModal({ visible, onClose }) {
  const { colors } = useTheme();

  // ✅ JSON data (you’ll replace this later with database data)
  const attendanceData = {
    July: 0.92,
    August: 0.87,
    September: 0.78,
    October: 0.68,
    November: 0.82,
  };

  const months = Object.keys(attendanceData);
  const [currentIndex, setCurrentIndex] = useState(months.length - 1); // default: last month (November)
  const currentMonth = months[currentIndex];
  const attendance = attendanceData[currentMonth];

  // 🎨 Color by range
  const getAttendanceColor = (value) => {
    if (value >= 0.9) return "#2ECC71"; // Green
    if (value >= 0.75) return "#F1C40F"; // Yellow
    if (value >= 0.6) return "#E67E22"; // Orange
    return "#E74C3C"; // Red
  };
  const attendanceColor = getAttendanceColor(attendance);

  // ⬅️➡️ Handlers
  const handlePrev = () => {
    if (currentIndex > 0) setCurrentIndex((prev) => prev - 1);
  };
  const handleNext = () => {
    if (currentIndex < months.length - 1) setCurrentIndex((prev) => prev + 1);
  };

  // Circle setup
  const minRadius = 40;
  const maxRadius = 65;
  const radius = minRadius + (maxRadius - minRadius) * attendance;
  const strokeWidth = 9;
  const circumference = 2 * Math.PI * radius;
  const progressOffset = circumference - circumference * attendance;

  // Overall average
  const overallAvg =
    Object.values(attendanceData).reduce((a, b) => a + b, 0) / months.length;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <ExpoGradient
          colors={["rgba(255,255,255,0.05)", "rgba(0,0,0,0.25)"]}
          style={styles.modalContainer}
        >
          <View
            style={[
              styles.innerCard,
              { backgroundColor: colors.cardBackground },
            ]}
          >
            {/* Header */}
            <View style={styles.header}>
              <Icon name="calendar-month-outline" size={30} color={attendanceColor} />
              <Text style={[styles.headerText, { color: colors.primaryText }]}>
                Monthly Attendance
              </Text>
            </View>

            <View style={styles.divider} />

            {/* Month Switch Section */}
            <View style={styles.monthSwitcher}>
              <TouchableOpacity
                disabled={currentIndex === 0}
                onPress={handlePrev}
              >
                <Icon
                  name="chevron-left-circle"
                  size={30}
                  color={currentIndex === 0 ? "#ccc" : attendanceColor}
                />
              </TouchableOpacity>

              <Text style={[styles.monthText, { color: colors.primaryText }]}>
                {currentMonth}
              </Text>

              <TouchableOpacity
                disabled={currentIndex === months.length - 1}
                onPress={handleNext}
              >
                <Icon
                  name="chevron-right-circle"
                  size={30}
                  color={
                    currentIndex === months.length - 1 ? "#ccc" : attendanceColor
                  }
                />
              </TouchableOpacity>
            </View>

            {/* Donut Chart */}
            <View style={styles.chartWrapper}>
              <Svg
                width={width * 0.45}
                height={width * 0.45}
                viewBox={`0 0 ${radius * 2 + strokeWidth} ${radius * 2 + strokeWidth}`}
              >
                {/* Background Circle */}
                <Circle
                  stroke="rgba(200,200,200,0.25)"
                  fill="none"
                  cx={radius + strokeWidth / 2}
                  cy={radius + strokeWidth / 2}
                  r={radius}
                  strokeWidth={strokeWidth}
                />

                {/* Progress Circle */}
                <Circle
                  stroke={attendanceColor}
                  fill="none"
                  cx={radius + strokeWidth / 2}
                  cy={radius + strokeWidth / 2}
                  r={radius}
                  strokeWidth={strokeWidth}
                  strokeDasharray={circumference}
                  strokeDashoffset={progressOffset}
                  strokeLinecap="round"
                  rotation="-90"
                  originX={radius + strokeWidth / 2}
                  originY={radius + strokeWidth / 2}
                />
              </Svg>

              {/* Center Text */}
              <View style={styles.chartLabelContainer}>
                <Text style={[styles.chartValue, { color: colors.primaryText }]}>
                  {(attendance * 100).toFixed(2)}%
                </Text>
                <Text style={[styles.chartLabel, { color: colors.secondaryText }]}>
                  {currentMonth}
                </Text>
              </View>
            </View>

            {/* Overall Average Section */}
            <View style={styles.overallBox}>
              <Text style={[styles.overallText, { color: colors.secondaryText }]}>
                Overall Average:
              </Text>
              <Text style={[styles.overallValue, { color: attendanceColor }]}>
                {(overallAvg * 100).toFixed(2)}%
              </Text>
            </View>

            {/* Close Button */}
            <TouchableOpacity
              style={[
                styles.closeButton,
                { backgroundColor: attendanceColor },
              ]}
              onPress={onClose}
            >
              <Icon name="close-circle-outline" size={18} color="#fff" />
              <Text style={styles.closeText}>Close</Text>
            </TouchableOpacity>
          </View>
        </ExpoGradient>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.65)",
  },
  modalContainer: {
    width: "78%",
    borderRadius: 24,
    overflow: "hidden",
    padding: 2,
  },
  innerCard: {
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 14,
    alignItems: "center",
    elevation: 12,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 5,
  },
  headerText: {
    fontSize: 19,
    fontWeight: "700",
    marginLeft: 8,
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(0,0,0,0.1)",
    marginVertical: 10,
    width: "100%",
  },
  monthSwitcher: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "75%",
    marginBottom: 10,
  },
  monthText: {
    fontSize: 18,
    fontWeight: "700",
  },
  chartWrapper: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 12,
    position: "relative",
  },
  chartLabelContainer: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  chartValue: {
    fontSize: 24,
    fontWeight: "700",
  },
  chartLabel: {
    fontSize: 13,
    fontWeight: "500",
  },
  overallBox: {
    marginTop: 10,
    alignItems: "center",
  },
  overallText: {
    fontSize: 13,
    fontWeight: "500",
  },
  overallValue: {
    fontSize: 16,
    fontWeight: "700",
  },
  closeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
    paddingVertical: 10,
    borderRadius: 10,
    width: "100%",
  },
  closeText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 6,
  },
});
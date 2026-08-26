import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../context/ThemeContext'; // Adjust path as needed

const ATTENDANCE_PERCENTAGE = '85.5%';
const CGPA = '3.75';

const SCHEDULE_DATA = [
  { time: '10:00 AM', subject: 'Calculus II', faculty: 'Dr. Sharma', room: 'B-201', color: '#3498DB' },
  { time: '11:30 AM', subject: 'Data Structures', faculty: 'Prof. Singh', room: 'A-105', color: '#E74C3C' },
  { time: '02:00 PM', subject: 'English Lit.', faculty: 'Ms. George', room: 'C-302', color: '#2ECC71' },
];

const GRADE_ALERTS = [
  { subject: 'Thermodynamics', alert: 'Awaiting Final Grade', icon: 'clock-time-four-outline' },
  { subject: 'Operating Systems', alert: 'Quiz 2 Grade Posted', icon: 'bell-badge-outline' },
];

const ScheduleItem = ({ item, styles }) => (
  <View style={styles.scheduleRow}>
    <View style={[styles.timeBox, { backgroundColor: item.color }]}>
      <Text style={styles.timeText}>{item.time.split(' ')[0]}</Text>
      <Text style={styles.ampmText}>{item.time.split(' ')[1]}</Text>
    </View>
    <View style={styles.subjectDetails}>
      <Text style={styles.subjectName}>{item.subject}</Text>
      <Text style={styles.subjectInfo}>Room {item.room} · {item.faculty}</Text>
    </View>
  </View>
);

export default function AcademicsScreen() {
  const { colors } = useTheme();

  const styles = getStyles(colors);

  return (
    <ScrollView style={styles.outerContainer} contentContainerStyle={styles.scrollContent}>
      <Text style={styles.headerTitle}>My Academics</Text>

      {/* KPIs Row */}
      <View style={styles.metricsRow}>
        <View style={styles.metricCard}>
          <Icon name="medal-outline" size={30} color={colors.secondaryAccent} />
          <Text style={styles.metricValue}>{CGPA}</Text>
          <Text style={styles.metricLabel}>Current CGPA</Text>
        </View>
        <View style={styles.metricCard}>
          <Icon name="account-check-outline" size={30} color={colors.primaryAccent} />
          <Text style={styles.metricValue}>{ATTENDANCE_PERCENTAGE}</Text>
          <Text style={styles.metricLabel}>Total Attendance</Text>
        </View>
      </View>

      {/* Today's Schedule */}
      <Text style={styles.sectionTitle}>{"Today's Schedule"}</Text>
      <View style={styles.card}>
        {SCHEDULE_DATA.map((item, index) => (
          <ScheduleItem key={index} item={item} styles={styles} />
        ))}
        <TouchableOpacity style={styles.fullScheduleButton}>
          <Text style={[styles.fullScheduleButtonText, { color: colors.primaryAccent }]}>
            View Full Timetable
          </Text>
          <Icon name="arrow-right" size={16} color={colors.primaryAccent} />
        </TouchableOpacity>
      </View>

      {/* Grade Alerts & Quick Links */}
      <Text style={styles.sectionTitle}>Alerts & Grades</Text>
      <View style={styles.card}>
        {GRADE_ALERTS.map((alert, index) => (
          <TouchableOpacity key={index} style={styles.alertRow}>
            <Icon name={alert.icon} size={20} color={colors.warningText} style={styles.alertIcon} />
            <View style={styles.alertDetails}>
              <Text style={[styles.alertSubject, { color: colors.primaryText }]}>{alert.subject}</Text>
              <Text style={[styles.alertText, { color: colors.warningText }]}>{alert.alert}</Text>
            </View>
            <Icon name="chevron-right" size={20} color={colors.disabledText} />
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={styles.quickLink}>
          <Text style={[styles.quickLinkText, { color: colors.primaryAccent }]}>View All Grades</Text>
        </TouchableOpacity>
      </View>

      {/* Bottom spacer */}
      <View style={{ height: 90 }} />
    </ScrollView>
  );
}

const getStyles = (colors) =>
  StyleSheet.create({
    outerContainer: {
      flex: 1,
      backgroundColor: colors.primaryBackground,
    },
    scrollContent: {
      paddingHorizontal: 15,
      paddingVertical: 20,
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: '800',
      color: colors.primaryAccent,
      marginBottom: 25,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.primaryText,
      marginBottom: 10,
      marginTop: 15,
    },
    card: {
      backgroundColor: colors.cardBackground,
      borderRadius: 12,
      padding: 15,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 5,
      elevation: 4,
      marginBottom: 15,
    },
    metricsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 20,
    },
    metricCard: {
      backgroundColor: colors.cardBackground,
      borderRadius: 12,
      padding: 15,
      width: '48%',
      alignItems: 'flex-start',
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 5,
      elevation: 6,
      borderBottomWidth: 3,
      borderBottomColor: colors.primaryAccent,
    },
    metricValue: {
      fontSize: 32,
      fontWeight: '900',
      color: colors.primaryAccent,
      marginTop: 5,
    },
    metricLabel: {
      fontSize: 14,
      color: colors.secondaryText,
      marginTop: 5,
    },
    scheduleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 15,
      paddingBottom: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    timeBox: {
      width: 65,
      height: 65,
      borderRadius: 8,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 15,
    },
    timeText: {
      fontSize: 16,
      fontWeight: 'bold',
      color: '#FFFFFF',
    },
    ampmText: {
      fontSize: 12,
      color: '#FFFFFF',
      fontWeight: '600',
    },
    subjectDetails: {
      flex: 1,
    },
    subjectName: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.primaryText,
    },
    subjectInfo: {
      fontSize: 14,
      color: colors.secondaryText,
      marginTop: 2,
    },
    fullScheduleButton: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
      marginTop: 5,
    },
    fullScheduleButtonText: {
      fontWeight: '600',
      fontSize: 14,
    },
    alertRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    alertIcon: {
      marginRight: 10,
    },
    alertDetails: {
      flex: 1,
      marginRight: 10,
    },
    alertSubject: {
      fontSize: 15,
      fontWeight: '600',
    },
    alertText: {
      fontSize: 13,
      marginTop: 2,
    },
    quickLink: {
      marginTop: 15,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
      alignItems: 'center',
    },
    quickLinkText: {
      fontWeight: '600',
      fontSize: 15,
    },
  });
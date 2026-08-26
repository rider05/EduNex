import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  RefreshControl,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../context/ThemeContext';
import FullTimetable from './modals/FullTimeTable';
import AssessmentsReportsModal from './modals/AssessmentsReportsModal';
import { SkeletonKPIRow, SkeletonListItem } from '../../components/common/SkeletonLoader';
import { getStudentData, getStudentSchedule } from '../../services/dataService';
import useRefreshOnForeground from '../../hooks/useRefreshOnForeground';

const ATTENDANCE_PERCENTAGE = "";
const CGPA = "";
const INITIAL_SCHEDULE_DATA = [];

const ASSESSMENTS_REPORTS = [
  {
    subject: 'Data Structures',
    alert: 'Lab Evaluation Marks Released',
    icon: 'file-document-check-outline',
  },
  {
    subject: 'Database Management Systems',
    alert: 'Mid-Sem Report Ready to Download',
    icon: 'file-pdf-box',
  },
  {
    subject: 'Data Preprocessing and Visualization',
    alert: 'Submit Report by Tomorrow',
    icon: 'file-upload-outline',
  },
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
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showTimetable, setShowTimetable] = useState(false);
  const [showAssessments, setShowAssessments] = useState(false);
  const [attendance, setAttendance] = useState(ATTENDANCE_PERCENTAGE);
  const [cgpa, setCgpa] = useState(CGPA);
  const [schedule, setSchedule] = useState(INITIAL_SCHEDULE_DATA);
  const styles = getStyles(colors);

  const loadData = useCallback(async () => {
    try {
      const [student, studentSchedule] = await Promise.allSettled([
        getStudentData(),
        getStudentSchedule(),
      ]);

      if (student.status === "fulfilled" && student.value) {
        if (student.value.attendance?.percentage) {
          setAttendance(student.value.attendance.percentage);
        }
        if (student.value.cgpa) {
          setCgpa(String(student.value.cgpa));
        }
      }
      if (studentSchedule.status === "fulfilled" && studentSchedule.value?.length > 0) {
        setSchedule(studentSchedule.value);
      }
    } catch (err) {
      console.log("Error loading academics data:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // Refetch academics data when the app returns to the foreground
  useRefreshOnForeground(loadData);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  return (
    <>
      <ScrollView
        style={styles.outerContainer}
        contentContainerStyle={styles.scrollContent}
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
        <Text style={styles.headerTitle}>AI & DS Academics</Text>

        {isLoading ? (
          <View style={{ marginTop: 10 }}>
            <SkeletonKPIRow count={2} />
            <SkeletonListItem />
            <SkeletonListItem />
            <SkeletonListItem />
          </View>
        ) : (
          <>
            {/* KPIs */}
            <View style={styles.metricsRow}>
              <View style={styles.metricCard}>
                <Icon name="medal-outline" size={30} color={colors.secondaryAccent} />
                <Text style={styles.metricValue}>{cgpa}</Text>
                <Text style={styles.metricLabel}>Current CGPA</Text>
              </View>
              <View style={styles.metricCard}>
                <Icon
                  name="account-check-outline"
                  size={30}
                  color={colors.primaryAccent}
                />
                <Text style={styles.metricValue}>{attendance}</Text>
                <Text style={styles.metricLabel}>Total Attendance</Text>
              </View>
            </View>

            {/* Today's Schedule */}
            <Text style={styles.sectionTitle}>{"Today's Schedule"}</Text>
            <View style={styles.card}>
              {schedule.map((item, index) => (
                <ScheduleItem key={index} item={item} styles={styles} />
              ))}
          <TouchableOpacity
            style={styles.fullScheduleButton}
            onPress={() => setShowTimetable(true)}>
            <Text
              style={[
                styles.fullScheduleButtonText,
                { color: colors.primaryAccent },
              ]}>
              View Full Timetable
            </Text>
            <Icon name="arrow-right" size={16} color={colors.primaryAccent} />
          </TouchableOpacity>
        </View>

        {/* Assessments & Reports */}
        <Text style={styles.sectionTitle}>Assessments & Reports</Text>
        <View style={styles.card}>
          {ASSESSMENTS_REPORTS.map((item, index) => (
            <TouchableOpacity key={index} style={styles.alertRow}>
              <Icon
                name={item.icon}
                size={20}
                color={colors.warningText}
                style={styles.alertIcon}
              />
              <View style={styles.alertDetails}>
                <Text
                  style={[styles.alertSubject, { color: colors.primaryText }]}>
                  {item.subject}
                </Text>
                <Text style={[styles.alertText, { color: colors.warningText }]}>
                  {item.alert}
                </Text>
              </View>
              <Icon name="chevron-right" size={20} color={colors.disabledText} />
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={styles.quickLink}
            onPress={() => setShowAssessments(true)}>
            <Text
              style={[styles.quickLinkText, { color: colors.primaryAccent }]}>
              View All
            </Text>
          </TouchableOpacity>
        </View>
        </>
        )}

        <View style={{ height: 90 }} />
      </ScrollView>

      {/* Full Timetable Modal */}
      <Modal
        visible={showTimetable}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowTimetable(false)}>
        <FullTimetable onClose={() => setShowTimetable(false)} />
      </Modal>

      {/* Assessments Modal */}
      <Modal
        visible={showAssessments}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAssessments(false)}>
        <AssessmentsReportsModal onClose={() => setShowAssessments(false)} />
      </Modal>
    </>
  );
}

const getStyles = (colors) =>
  StyleSheet.create({
    outerContainer: {
      flex: 1,
      backgroundColor: colors.primaryBackground,
      paddingTop: 40,
      paddingBottom: 100,
    },
    scrollContent: {
      paddingHorizontal: 15,
      paddingVertical: 20,
      paddingBottom: 10,
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
      height: 60,
      marginBottom: 0,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    timeBox: {
      width: 56,
      height: 56,
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    timeText: {
      fontSize: 15,
      fontWeight: '800',
      color: '#FFFFFF',
      lineHeight: 18,
    },
    ampmText: {
      fontSize: 10,
      color: '#FFFFFF',
      fontWeight: '600',
      lineHeight: 13,
      marginTop: 1,
    },
    subjectDetails: {
      flex: 1,
      justifyContent: 'center',
    },
    subjectName: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.primaryText,
      lineHeight: 20,
    },
    subjectInfo: {
      fontSize: 13,
      color: colors.secondaryText,
      marginTop: 2,
      lineHeight: 17,
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
    alertIcon: { marginRight: 10 },
    alertDetails: { flex: 1, marginRight: 10 },
    alertSubject: { fontSize: 15, fontWeight: '600' },
    alertText: { fontSize: 13, marginTop: 2 },
    quickLink: {
      marginTop: 15,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
      alignItems: 'center',
    },
    quickLinkText: { fontWeight: '600', fontSize: 15 },
  });
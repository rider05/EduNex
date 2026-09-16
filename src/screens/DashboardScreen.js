import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../context/ThemeContext'; // Adjust the path as needed

export default function DashboardScreen() {
  const { colors } = useTheme();

  // Styles inside component so DashboardCard can access via closure
  const styles = getStyles(colors);

  // DashboardCard component with access to styles
  const DashboardCard = ({ title, value, iconName, color, onPress }) => (
    <TouchableOpacity style={[styles.card, { borderLeftColor: color }]} onPress={onPress}>
      <View style={styles.cardContent}>
        <Icon name={iconName} size={30} color={color} style={styles.cardIcon} />
        <View style={styles.cardTextContainer}>
          <Text style={[styles.cardTitle, { color }]}>{title}</Text>
          <Text style={[styles.cardValue, { color }]}>{value}</Text>
        </View>
        <Icon name="arrow-right" size={20} color="#999" />
      </View>
    </TouchableOpacity>
  );

  const studentData = {
    gpa: '—',
    dueFees: '—',
    upcomingExam: '—',
    libraryDues: '—',
    attendance: '—',
  };

  const handleCardPress = (title) => {
    console.log(`Navigating to ${title} section...`);
    // Replace with actual navigation logic
  };

  return (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.welcomeText}>Hello 👋</Text>
      <Text style={styles.subHeaderText}>Your progress at a glance.</Text>

      {/* KPIs row */}
      <View style={styles.kpiRow}>
        <View style={styles.kpiBox}>
          <Text style={[styles.kpiValue, { color: colors.primaryAccent }]}>A+</Text>
          <Text style={[styles.kpiLabel, { color: colors.secondaryText }]}>Current Grade</Text>
        </View>
        <View style={styles.kpiBox}>
          <Text style={[styles.kpiValue, { color: colors.primaryAccent }]}>{studentData.gpa}</Text>
          <Text style={[styles.kpiLabel, { color: colors.secondaryText }]}>Overall GPA</Text>
        </View>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.primaryText }]}>Your Responsibilities</Text>

      <DashboardCard
        title="Fees Due"
        value={studentData.dueFees}
        iconName="cash-multiple"
        color="#E74C3C"
        onPress={() => handleCardPress('Fees')}
      />
      <DashboardCard
        title="Next Exam"
        value={studentData.upcomingExam}
        iconName="calendar-check"
        color="#F39C12"
        onPress={() => handleCardPress('Exams')}
      />
      <DashboardCard
        title="Attendance Status"
        value={`${studentData.attendance} (Good)`}
        iconName="account-check"
        color="#2ECC71"
        onPress={() => handleCardPress('Attendance')}
      />
      <DashboardCard
        title="Library Dues"
        value={studentData.libraryDues}
        iconName="book-open-page-variant"
        color="#3498DB"
        onPress={() => handleCardPress('Library')}
      />

      {/* Spacer */}
      <View style={{ height: 90 }} />
    </ScrollView>
  );
}

const getStyles = (colors) =>
  StyleSheet.create({
    scrollView: {
      flex: 1,
      backgroundColor: colors.primaryBackground,
    },
    contentContainer: {
      paddingHorizontal: 20,
      paddingVertical: 25,
    },
    welcomeText: {
      fontSize: 28,
      fontWeight: '700',
      color: colors.primaryText,
    },
    subHeaderText: {
      fontSize: 16,
      color: colors.secondaryText,
      marginBottom: 20,
    },
    kpiRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 30,
    },
    kpiBox: {
      backgroundColor: colors.cardBackground,
      padding: 15,
      borderRadius: 12,
      width: '48%',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    kpiValue: {
      fontSize: 36,
      fontWeight: '900',
    },
    kpiLabel: {
      fontSize: 14,
      marginTop: 5,
      textAlign: 'center',
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '600',
      marginBottom: 15,
    },
    card: {
      backgroundColor: colors.cardBackground,
      borderRadius: 12,
      marginBottom: 15,
      paddingVertical: 18,
      paddingHorizontal: 15,
      flexDirection: 'row',
      alignItems: 'center',
      borderLeftWidth: 5,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 3,
      elevation: 2,
    },
    cardContent: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      justifyContent: 'space-between',
    },
    cardIcon: {
      marginRight: 15,
    },
    cardTextContainer: {
      flex: 1,
      marginRight: 10,
    },
    cardTitle: {
      fontSize: 14,
      color: colors.primaryText,
    },
    cardValue: {
      fontSize: 18,
      fontWeight: '700',
      marginTop: 2,
    },
  });
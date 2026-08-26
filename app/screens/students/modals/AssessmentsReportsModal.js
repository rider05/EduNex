import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../../context/ThemeContext';

export default function AssessmentsReportsModal({ onClose }) {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const DATA = [
    {
      title: 'Data Structures - Report 1',
      status: 'Submitted',
      due: 'Oct 22, 2025',
      icon: 'file-document-check-outline',
    },
    {
      title: 'Database Management Systems - Lab Report',
      status: 'Pending Submission',
      due: 'Nov 12, 2025',
      icon: 'file-upload-outline',
    },
    {
      title: 'Data Preprocessing - Assessment 2',
      status: 'Under Review',
      due: 'Nov 10, 2025',
      icon: 'file-eye-outline',
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Icon name="close" size={24} color={colors.primaryText} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Assessments & Reports</Text>
          <Text style={styles.headerSubtitle}>View or Submit Reports</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {DATA.map((item, index) => (
          <View key={index} style={styles.card}>
            <View style={styles.row}>
              <Icon name={item.icon} size={28} color={colors.primaryAccent} />
              <View style={styles.info}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.status}>
                  Status: {item.status} · Due: {item.due}
                </Text>
              </View>
            </View>

            <View style={styles.buttonRow}>
              <TouchableOpacity style={[styles.button, styles.viewButton]}>
                <Icon name="eye-outline" size={16} color={colors.primaryAccent} />
                <Text style={[styles.buttonTextAlt, { color: colors.primaryAccent }]}>
                  View
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.button, styles.submitButton]}>
                <Icon name="upload" size={16} color="#fff" />
                <Text style={styles.buttonText}>Submit</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.primaryBackground,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 15,
      paddingTop: StatusBar.currentHeight || 0,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    closeButton: {
      marginRight: 10,
    },
    headerTitle: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.primaryAccent,
    },
    headerSubtitle: {
      fontSize: 14,
      color: colors.secondaryText,
    },
    scrollContent: {
      padding: 15,
      paddingBottom: 50,
    },
    card: {
      backgroundColor: colors.cardBackground,
      borderRadius: 12,
      padding: 15,
      marginBottom: 15,
      elevation: 4,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 10,
    },
    info: {
      marginLeft: 10,
      flex: 1,
    },
    title: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.primaryText,
    },
    status: {
      fontSize: 13,
      color: colors.secondaryText,
      marginTop: 3,
    },
    buttonRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 10,
    },
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 6,
      paddingVertical: 8,
      paddingHorizontal: 12,
      flex: 0.48,
      gap: 6,
    },
    submitButton: {
      backgroundColor: colors.primaryAccent,
    },
    viewButton: {
      borderWidth: 1,
      borderColor: colors.primaryAccent,
      backgroundColor: 'transparent',
    },
    buttonText: {
      color: '#fff',
      fontWeight: '600',
      fontSize: 14,
    },
    buttonTextAlt: {
      fontWeight: '600',
      fontSize: 14,
    },
  });
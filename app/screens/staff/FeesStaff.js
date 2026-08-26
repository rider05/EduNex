import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  RefreshControl,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { useTheme } from "../../context/ThemeContext";
import { SkeletonBox, SkeletonListItem } from "../../components/common/SkeletonLoader";

const SAMPLE_PAYMENTS = [
  { id: "1", student: "Aditi Sharma", roll: "CS2025012", amount: 15000, status: "Paid", date: "20 Oct 2025" },
  { id: "2", student: "Ravi Kumar", roll: "CS2025034", amount: 10000, status: "Pending", date: "29 Oct 2025" },
  { id: "3", student: "Meena Raj", roll: "CS2025056", amount: 12000, status: "Paid", date: "18 Oct 2025" },
];

export default function FeesStaff() {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 450);
    return () => clearTimeout(timer);
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 800);
  }, []);

  const handleVerifyPayment = (student) => {
    Alert.alert("Verify Payment", `Confirm payment verification for ${student}?`);
  };

  const handleExportReport = () => {
    Alert.alert("Export Report", "Generating fee report for this month...");
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 150 }}
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
      <Text style={styles.header}>Fees Management</Text>
      <Text style={styles.subHeader}>View & verify student payment details</Text>

      {isLoading ? (
        <View style={{ marginTop: 14 }}>
          <SkeletonBox height={140} borderRadius={16} style={{ marginBottom: 16 }} />
          <SkeletonListItem />
          <SkeletonListItem />
          <SkeletonListItem />
        </View>
      ) : (
        <>
          {/* Summary Section */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <View>
                <Text style={styles.summaryLabel}>Total Collected</Text>
                <Text style={styles.summaryValue}>₹ 4,70,000</Text>
              </View>
              <Icon name="cash-multiple" size={30} color={colors.successText} />
            </View>

            <View style={[styles.summaryRow, { marginTop: 10 }]}>
              <View>
                <Text style={styles.summaryLabel}>Pending Dues</Text>
                <Text style={styles.summaryValuePending}>₹ 85,000</Text>
              </View>
              <Icon name="alert-circle-outline" size={30} color={colors.warningText} />
            </View>

            <TouchableOpacity style={styles.exportBtn} onPress={handleExportReport}>
              <Icon name="file-excel" size={20} color="#fff" />
              <Text style={styles.exportText}>Export Monthly Report</Text>
            </TouchableOpacity>
          </View>

          {/* Payment Table */}
          <Text style={styles.sectionTitle}>Recent Fee Records</Text>
      {SAMPLE_PAYMENTS.map((item) => (
        <View
          key={item.id}
          style={[
            styles.feeCard,
            { borderLeftColor: item.status === "Paid" ? colors.successText : colors.warningText },
          ]}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.studentName}>{item.student}</Text>
            <Text
              style={[
                styles.statusBadge,
                {
                  backgroundColor:
                    item.status === "Paid" ? colors.successBg : colors.warningBg,
                  color:
                    item.status === "Paid" ? colors.successText : colors.warningText,
                },
              ]}
            >
              {item.status}
            </Text>
          </View>

          <Text style={styles.rollNo}>Roll: {item.roll}</Text>

          <View style={styles.cardFooter}>
            <Text style={styles.amount}>₹ {item.amount.toLocaleString("en-IN")}</Text>
            <Text style={styles.date}>{item.date}</Text>
          </View>

          {item.status === "Pending" && (
            <TouchableOpacity
              style={styles.verifyBtn}
              onPress={() => handleVerifyPayment(item.student)}
            >
              <Icon name="check" size={18} color="#fff" />
              <Text style={styles.verifyText}>Verify Payment</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}
      </>
      )}
    </ScrollView>
  );
}

const getStyles = (colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.primaryBackground,
      paddingHorizontal: 15,
      paddingTop: 100,
    },
    header: {
      fontSize: 28,
      fontWeight: "800",
      color: colors.primaryAccent,
      marginBottom: 5,
    },
    subHeader: {
      fontSize: 15,
      color: colors.secondaryText,
      marginBottom: 20,
    },
    summaryCard: {
      backgroundColor: colors.cardBackground,
      borderRadius: 12,
      padding: 15,
      marginBottom: 20,
      elevation: 4,
      borderTopWidth: 4,
      borderTopColor: colors.primaryAccent,
    },
    summaryRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    summaryLabel: {
      color: colors.secondaryText,
      fontSize: 14,
    },
    summaryValue: {
      color: colors.successText,
      fontSize: 22,
      fontWeight: "800",
    },
    summaryValuePending: {
      color: colors.warningText,
      fontSize: 22,
      fontWeight: "800",
    },
    exportBtn: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.primaryAccent,
      paddingVertical: 10,
      borderRadius: 8,
      marginTop: 15,
    },
    exportText: {
      color: "#fff",
      marginLeft: 8,
      fontWeight: "600",
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.primaryText,
      marginBottom: 10,
    },
    feeCard: {
      backgroundColor: colors.cardBackground,
      borderRadius: 10,
      padding: 15,
      borderLeftWidth: 4,
      marginBottom: 12,
      elevation: 2,
    },
    cardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 5,
    },
    studentName: {
      fontSize: 17,
      fontWeight: "700",
      color: colors.primaryText,
    },
    rollNo: {
      fontSize: 13,
      color: colors.secondaryText,
      marginBottom: 6,
    },
    cardFooter: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
    },
    amount: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.primaryText,
    },
    date: {
      fontSize: 13,
      color: colors.secondaryText,
    },
    statusBadge: {
      fontSize: 13,
      fontWeight: "700",
      paddingVertical: 2,
      paddingHorizontal: 8,
      borderRadius: 6,
      overflow: "hidden",
    },
    verifyBtn: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.primaryAccent,
      borderRadius: 6,
      paddingVertical: 8,
      marginTop: 8,
    },
    verifyText: {
      color: "#fff",
      fontWeight: "600",
      marginLeft: 6,
    },
  });
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
import { api } from "../../services/api";

export default function FeesStaff() {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [payments, setPayments] = useState([]);
  const [totalCollected, setTotalCollected] = useState("—");
  const [pendingDues, setPendingDues] = useState("—");

  const loadData = useCallback(async () => {
    try {
      const res = await api.get("/students");
      const data = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
      const feeRecords = [];
      let collected = 0;
      let pending = 0;
      data.forEach((s, idx) => {
        if (s.fee || s.feeStatus || s.fees) {
          const amount = Number(s.fee?.amount || s.feeAmount || 0);
          const status = s.fee?.status || s.feeStatus || "Pending";
          feeRecords.push({
            id: String(s.id ?? idx),
            student: s.name || s.studentName || "Student",
            roll: s.roll || s.rollNo || "—",
            amount,
            status,
            date: s.fee?.date || s.feeDate || "—",
          });
          if (status === "Paid") collected += amount;
          else pending += amount;
        }
      });
      setPayments(feeRecords.length > 0 ? feeRecords : []);
      setTotalCollected(feeRecords.length > 0 ? `₹ ${collected.toLocaleString("en-IN")}` : "—");
      setPendingDues(feeRecords.length > 0 ? `₹ ${pending.toLocaleString("en-IN")}` : "—");
    } catch (err) {
      console.log("Error loading fee data:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

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
                <Text style={styles.summaryValue}>{totalCollected}</Text>
              </View>
              <Icon name="cash-multiple" size={30} color={colors.successText} />
            </View>

            <View style={[styles.summaryRow, { marginTop: 10 }]}>
              <View>
                <Text style={styles.summaryLabel}>Pending Dues</Text>
                <Text style={styles.summaryValuePending}>{pendingDues}</Text>
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
      {payments.map((item) => (
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
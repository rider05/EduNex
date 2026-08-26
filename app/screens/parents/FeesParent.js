import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { useTheme } from "../../context/ThemeContext";
import { SkeletonBox, SkeletonListItem } from "../../components/common/SkeletonLoader";
import PaymentModal from "../students/modals/PaymentModal";
import { getStudentFees } from "../../services/dataService";
import useRefreshOnForeground from "../../hooks/useRefreshOnForeground";

const inr = (n) => `₹ ${Number(n || 0).toLocaleString("en-IN")}`;

const formatDateStr = (value) => {
  try {
    const d = value?.toDate ? value.toDate() : new Date(value);
    if (!isNaN(d)) return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
  } catch {}
  return typeof value === "string" ? value : "";
};

const FALLBACK_SUMMARY = {
  total: "",
  paid: "",
  pending: "",
  dueDate: "",
};

const FALLBACK_TRANSACTIONS = [];

export default function FeesParent() {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [paymentVisible, setPaymentVisible] = useState(false);
  const [feeSummary, setFeeSummary] = useState(FALLBACK_SUMMARY);
  const [transactions, setTransactions] = useState(FALLBACK_TRANSACTIONS);

  const loadData = useCallback(async () => {
    try {
      const fees = await getStudentFees();
      if (fees && (fees.total != null || fees.due != null)) {
        setFeeSummary({
          total: inr(fees.total),
          paid: inr(fees.paid),
          pending: inr(fees.due),
          dueDate: formatDateStr(fees.dueDate) || FALLBACK_SUMMARY.dueDate,
        });
      }
      const history = Array.isArray(fees?.history) ? fees.history : [];
      const invoices = Array.isArray(fees?.dueInvoices) ? fees.dueInvoices : [];

      const paidRows = history.map((h) => ({
        id: h.id || h._id || Math.random(),
        title: h.item || h.title || "Payment",
        amount: typeof h.amount === "number" ? inr(h.amount) : h.amount || "",
        date: formatDateStr(h.date),
        status: h.status || "Paid",
      }));
      const dueRows = invoices.map((inv) => ({
        id: inv.id || inv._id || Math.random(),
        title: inv.title || "Invoice",
        amount: typeof inv.amount === "number" ? inr(inv.amount) : inv.amount || "",
        date: formatDateStr(inv.dueDate),
        status: inv.status || "Pending",
      }));
      if (paidRows.length > 0 || dueRows.length > 0) {
        setTransactions([...dueRows, ...paidRows]);
      }
    } catch (err) {
      console.warn("FeesParent load error:", err?.message || err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Refetch fees when the app returns to the foreground
  useRefreshOnForeground(loadData);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.contentContainer}
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
        <Text style={styles.header}>Fee Details</Text>

        {isLoading ? (
          <View style={{ marginTop: 10 }}>
            <SkeletonBox height={140} borderRadius={20} style={{ marginBottom: 16 }} />
            <SkeletonListItem />
            <SkeletonListItem />
            <SkeletonListItem />
          </View>
        ) : (
          <>
            {/* Summary Card */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryTop}>
                <View>
                  <Text style={styles.totalLabel}>Total Fees</Text>
                  <Text style={styles.totalValue}>{feeSummary.total}</Text>
                </View>
                <Icon name="cash-multiple" size={28} color="#fff" />
              </View>

              <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Paid</Text>
              <Text style={styles.paidValue}>{feeSummary.paid}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Pending</Text>
              <Text style={styles.pendingValue}>{feeSummary.pending}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Due</Text>
              <Text style={styles.dueValue}>{feeSummary.dueDate}</Text>
            </View>
          </View>
        </View>

        {/* Payment History */}
        <Text style={styles.sectionTitle}>Payment History</Text>
        {transactions.map((item) => (
          <TouchableOpacity
            key={item.id}
            activeOpacity={0.9}
            style={[
              styles.transactionCard,
              {
                borderLeftColor:
                  item.status === "Paid" ? "#2ECC71" : "#E74C3C",
              },
            ]}
          >
            <View style={styles.rowBetween}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Icon
                  name={
                    item.status === "Paid"
                      ? "check-circle-outline"
                      : "alert-circle-outline"
                  }
                  size={22}
                  color={item.status === "Paid" ? "#2ECC71" : "#E74C3C"}
                />
                <View style={{ marginLeft: 10 }}>
                  <Text
                    style={[styles.transTitle, { color: colors.primaryText }]}
                  >
                    {item.title}
                  </Text>
                  <Text
                    style={[styles.transDate, { color: colors.secondaryText }]}
                  >
                    {item.date}
                  </Text>
                </View>
              </View>

              <View style={{ alignItems: "flex-end" }}>
                <Text
                  style={[
                    styles.amount,
                    {
                      color:
                        item.status === "Paid" ? "#2ECC71" : "#E74C3C",
                    },
                  ]}
                >
                  {item.amount}
                </Text>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor:
                        item.status === "Paid" ? "#2ecc7040" : "#e74c3c40",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      {
                        color:
                          item.status === "Paid" ? "#2ECC71" : "#E74C3C",
                      },
                    ]}
                  >
                    {item.status}
                  </Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        ))}

        {/* Pay Now Button */}
        <TouchableOpacity
          activeOpacity={0.85}
          style={[styles.payNowBtn, { backgroundColor: colors.primaryAccent }]}
          onPress={() => setPaymentVisible(true)} // ✅ Open modal
        >
          <Icon name="credit-card-outline" size={18} color="#fff" />
          <Text style={styles.payNowText}>Pay Pending Fees</Text>
        </TouchableOpacity>
        </>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* ✅ Integrated Payment Modal */}
      <PaymentModal visible={paymentVisible} onClose={() => setPaymentVisible(false)} />
    </View>
  );
}

const getStyles = (colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.primaryBackground,
    },
    contentContainer: {
      paddingHorizontal: 18,
      paddingTop: 60,
      paddingBottom: 30,
    },
    header: {
      fontSize: 24,
      fontWeight: "800",
      color: colors.primaryText,
      marginBottom: 16,
    },

    // 🎓 Fee Summary Card
    summaryCard: {
      backgroundColor: colors.primaryAccent,
      borderRadius: 16,
      padding: 16,
      marginBottom: 25,
      elevation: 5,
      shadowColor: colors.primaryAccent,
      shadowOpacity: 0.2,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 3 },
    },
    summaryTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 6,
    },
    totalLabel: {
      color: "#fff",
      fontSize: 13,
      opacity: 0.85,
    },
    totalValue: {
      color: "#fff",
      fontSize: 22,
      fontWeight: "800",
    },
    summaryRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 10,
    },
    summaryItem: {
      flex: 1,
      alignItems: "center",
    },
    summaryLabel: {
      color: "#fff",
      fontSize: 12,
      opacity: 0.8,
    },
    paidValue: {
      color: "#2ECC71",
      fontWeight: "700",
      fontSize: 13,
      marginTop: 2,
    },
    pendingValue: {
      color: "#F1C40F",
      fontWeight: "700",
      fontSize: 13,
      marginTop: 2,
    },
    dueValue: {
      color: "#fff",
      fontWeight: "700",
      fontSize: 13,
      marginTop: 2,
    },

    // 💳 Payment List
    sectionTitle: {
      fontSize: 18,
      fontWeight: "700",
      marginBottom: 10,
      color: colors.primaryText,
    },
    transactionCard: {
      backgroundColor: colors.cardBackground,
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 12,
      marginBottom: 10,
      borderLeftWidth: 4,
      elevation: 2,
      shadowColor: "#000",
      shadowOpacity: 0.08,
      shadowRadius: 3,
    },
    transTitle: {
      fontSize: 14,
      fontWeight: "600",
    },
    transDate: {
      fontSize: 12,
      marginTop: 1,
    },
    amount: {
      fontSize: 14,
      fontWeight: "700",
    },
    statusBadge: {
      paddingVertical: 1.5,
      paddingHorizontal: 5,
      borderRadius: 4,
      marginTop: 3,
    },
    statusText: {
      fontSize: 10,
      fontWeight: "600",
    },

    // 💰 Pay Now Button
    payNowBtn: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      paddingVertical: 12,
      borderRadius: 10,
      marginTop: 15,
      elevation: 3,
      shadowColor: "#000",
      shadowOpacity: 0.1,
      shadowRadius: 3,
    },
    payNowText: {
      color: "#fff",
      fontSize: 14,
      fontWeight: "600",
      marginLeft: 6,
    },
  });
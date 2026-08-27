import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Share,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { useTheme } from "../../context/ThemeContext";
import { SkeletonBox, SkeletonListItem } from "../../components/common/SkeletonLoader";
import PaymentModal from "../students/modals/PaymentModal";
import { getStudentFees, getParentData } from "../../services/dataService";
import useRefreshOnForeground from "../../hooks/useRefreshOnForeground";
import { showToast } from "../../utils/toastService";

const DEFAULT_INVOICES = [];

const DEFAULT_RECEIPTS = [];

const TABS = [
  { key: "dues", label: "Pending Invoices", icon: "alert-circle-outline" },
  { key: "history", label: "Paid Receipts", icon: "receipt-text-outline" },
  { key: "scholarship", label: "Scholarships", icon: "certificate-outline" },
  { key: "bank", label: "Bank Transfer", icon: "bank-outline" },
];

export default function FeesParent() {
  const { colors, isDarkMode } = useTheme();
  const styles = getStyles(colors, isDarkMode);

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [paymentVisible, setPaymentVisible] = useState(false);
  const [selectedPayInvoice, setSelectedPayInvoice] = useState(null);

  // Tabs & Search
  const [activeTab, setActiveTab] = useState("dues");
  const [searchQuery, setSearchQuery] = useState("");

  // Data
  const [invoices, setInvoices] = useState(DEFAULT_INVOICES);
  const [receipts, setReceipts] = useState(DEFAULT_RECEIPTS);
  const [wardName, setWardName] = useState("");
  const [rollNo, setRollNo] = useState("");
  const [ward, setWard] = useState({});
  const [institution, setInstitution] = useState({});

  const loadData = useCallback(async () => {
    try {
      const fees = await getStudentFees();
      if (fees) {
        if (Array.isArray(fees.dueInvoices)) {
          setInvoices(fees.dueInvoices);
        }
        if (Array.isArray(fees.history)) {
          setReceipts(fees.history);
        }
      }
      try {
        const parentData = await getParentData();
        if (parentData?.ward) {
          setWardName(parentData.ward.name || "");
          setRollNo(parentData.ward.rollNo || "");
          setWard(parentData.ward);
        }
        if (parentData?.institution) {
          setInstitution(parentData.institution);
        }
      } catch (e) {}
    } catch (err) {
      console.warn("FeesParent load error:", err?.message || err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useRefreshOnForeground(loadData);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  // Calculations
  const totalDue = useMemo(() => {
    return invoices
      .filter((i) => i.status === "due" || !i.status)
      .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }, [invoices]);

  const totalPaid = useMemo(() => {
    return receipts.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }, [receipts]);

  const totalCourseFee = totalDue + totalPaid;
  const settlementPct = totalCourseFee > 0 ? Math.round((totalPaid / totalCourseFee) * 100) : 100;

  const handlePayNow = (specificInvoice = null) => {
    setSelectedPayInvoice(specificInvoice);
    setPaymentVisible(true);
  };

  const handleShareReceipt = async (receipt) => {
    try {
      await Share.share({
        title: `Fee Tax Receipt - ${receipt.receiptNo}`,
        message: `📄 EDUNEX PARENT FEE PAYMENT RECEIPT\nWard: ${wardName || "—"} (${rollNo || "—"})\nReceipt No: ${receipt.receiptNo}\nItem: ${receipt.title}\nAmount: ₹${receipt.amount.toLocaleString("en-IN")}\nDate: ${receipt.date}\nPayment Mode: ${receipt.method}\nTransaction Ref: ${receipt.txnId}\nStatus: VERIFIED & ACCOUNTED`,
      });
      showToast("Payment receipt shared!", "success");
    } catch (err) {
      console.log("Share error:", err);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.primaryBackground }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primaryAccent]}
            tintColor={colors.primaryAccent}
            progressBackgroundColor={colors.cardBackground}
          />
        }
      >
        {/* ========================================================================= */}
        {/* 1. HEADER                                                                 */}
        {/* ========================================================================= */}
        <View style={styles.header}>
          <View style={[styles.headerIconWrap, { backgroundColor: colors.primaryAccent + "18" }]}>
            <Icon name="cash-multiple" size={24} color={colors.primaryAccent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: colors.primaryText }]}>Fee Management</Text>
            <Text style={[styles.headerSubtitle, { color: colors.secondaryText }]}>
              Ward Term Invoices, Settlement & Tax Receipts
            </Text>
          </View>
        </View>

        {isLoading ? (
          <View style={{ marginTop: 10 }}>
            <SkeletonBox height={160} borderRadius={20} style={{ marginBottom: 16 }} />
            <SkeletonListItem />
            <SkeletonListItem />
            <SkeletonListItem />
          </View>
        ) : (
          <>
            {/* ========================================================================= */}
            {/* 2. EXECUTIVE FINANCIAL HERO CARD                                          */}
            {/* ========================================================================= */}
            <View style={[styles.heroCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
              <View style={styles.heroTopRow}>
                <View>
                  <Text style={[styles.heroSub, { color: colors.secondaryText }]}>OUTSTANDING TERM BALANCE</Text>
                  <Text style={[styles.heroDueAmount, { color: totalDue > 0 ? "#EF4444" : "#10B981" }]}>
                    ₹ {totalDue.toLocaleString("en-IN")}
                  </Text>
                </View>

                <View
                  style={[
                    styles.statusPill,
                    { backgroundColor: totalDue > 0 ? "#EF444418" : "#10B98118" },
                  ]}
                >
                  <Icon
                    name={totalDue > 0 ? "alert-circle" : "check-decagram"}
                    size={15}
                    color={totalDue > 0 ? "#EF4444" : "#10B981"}
                  />
                  <Text
                    style={[
                      styles.statusPillText,
                      { color: totalDue > 0 ? "#EF4444" : "#10B981" },
                    ]}
                  >
                    {totalDue > 0 ? "DUES PENDING" : "FEES CLEARED"}
                  </Text>
                </View>
              </View>

              {/* Progress Bar */}
              <View style={styles.progressWrap}>
                <View style={styles.progressLabelRow}>
                  <Text style={[styles.progressLabel, { color: colors.secondaryText }]}>
                    Annual Fee Cleared ({settlementPct}%)
                  </Text>
                  <Text style={[styles.progressValues, { color: colors.primaryText }]}>
                    ₹{totalPaid.toLocaleString("en-IN")} / ₹{totalCourseFee.toLocaleString("en-IN")}
                  </Text>
                </View>
                <View style={[styles.progressTrack, { backgroundColor: colors.primaryBackground }]}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${settlementPct}%`, backgroundColor: colors.primaryAccent },
                    ]}
                  />
                </View>
              </View>

              {/* Notice Row */}
              <View style={[styles.noticeRow, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                <Icon name="information-outline" size={16} color={totalDue > 0 ? "#F59E0B" : "#10B981"} />
                <Text style={[styles.noticeText, { color: colors.secondaryText }]} numberOfLines={2}>
                  {totalDue > 0
                    ? "Settle pending dues before the due date to ensure your ward's semester exam hall ticket is activated."
                    : "All fee invoices for this academic term have been successfully settled!"}
                </Text>
              </View>

              {/* Pay Now Button */}
              {totalDue > 0 && (
                <TouchableOpacity
                  style={[styles.payHeroBtn, { backgroundColor: colors.primaryAccent }]}
                  onPress={() => handlePayNow()}
                  activeOpacity={0.85}
                >
                  <Icon name="lightning-bolt" size={18} color="#FFFFFF" />
                  <Text style={styles.payHeroBtnText}>
                    Settle Pending Balance (₹{totalDue.toLocaleString("en-IN")})
                  </Text>
                  <Icon name="arrow-right" size={18} color="#FFFFFF" />
                </TouchableOpacity>
              )}
            </View>

            {/* ========================================================================= */}
            {/* 3. TABS STRIP                                                             */}
            {/* ========================================================================= */}
            <View style={styles.tabsStrip}>
              {TABS.map((tab) => {
                const isSel = activeTab === tab.key;
                return (
                  <TouchableOpacity
                    key={tab.key}
                    style={[
                      styles.tabPill,
                      isSel
                        ? { backgroundColor: colors.primaryAccent, borderColor: colors.primaryAccent }
                        : { backgroundColor: colors.cardBackground, borderColor: colors.divider },
                    ]}
                    onPress={() => setActiveTab(tab.key)}
                  >
                    <Icon name={tab.icon} size={14} color={isSel ? "#FFFFFF" : colors.secondaryText} />
                    <Text style={[styles.tabPillText, { color: isSel ? "#FFFFFF" : colors.primaryText }]}>
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Search Box */}
            {(activeTab === "dues" || activeTab === "history") && (
              <View style={[styles.searchBox, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
                <Icon name="magnify" size={18} color={colors.secondaryText} />
                <TextInput
                  style={[styles.searchInput, { color: colors.primaryText }]}
                  placeholder={activeTab === "dues" ? "Search pending invoices..." : "Search payment receipts..."}
                  placeholderTextColor={colors.disabledText}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery("")}>
                    <Icon name="close-circle" size={16} color={colors.secondaryText} />
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* ========================================================================= */}
            {/* 4. TAB CONTENT 1: PENDING INVOICES                                        */}
            {/* ========================================================================= */}
            {activeTab === "dues" && (
              <View style={{ gap: 10 }}>
                {invoices.map((inv) => (
                  <View
                    key={inv.id}
                    style={[styles.invoiceCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
                  >
                    <View style={styles.invoiceCardTop}>
                      <View style={[styles.invoiceIconCircle, { backgroundColor: inv.color || colors.primaryAccent }]}>
                        <Icon name={inv.icon || "file-document-outline"} size={20} color="#FFFFFF" />
                      </View>

                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={[styles.invoiceTitle, { color: colors.primaryText }]}>{inv.title}</Text>
                        <Text style={[styles.invoiceMeta, { color: colors.secondaryText }]}>
                          {inv.invoiceNo} · Due on {inv.dueDate}
                        </Text>
                      </View>

                      <Text style={[styles.invoiceAmount, { color: "#EF4444" }]}>
                        ₹ {inv.amount.toLocaleString("en-IN")}
                      </Text>
                    </View>

                    <Text style={[styles.invoiceDesc, { color: colors.disabledText }]}>
                      {inv.description}
                    </Text>

                    <View style={[styles.invoiceCardBottom, { borderTopColor: colors.divider }]}>
                      <View style={styles.dueTag}>
                        <View style={styles.redDot} />
                        <Text style={styles.dueTagText}>DUE ON {inv.dueDate || "—"}</Text>
                      </View>

                      <TouchableOpacity
                        style={[styles.paySingleBtn, { backgroundColor: colors.primaryAccent }]}
                        onPress={() => handlePayNow(inv)}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.paySingleBtnText}>Pay ₹{inv.amount.toLocaleString("en-IN")}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* ========================================================================= */}
            {/* 5. TAB CONTENT 2: PAID RECEIPTS & TAX INVOICES                            */}
            {/* ========================================================================= */}
            {activeTab === "history" && (
              <View style={{ gap: 10 }}>
                {receipts.map((rec) => (
                  <View
                    key={rec.id}
                    style={[styles.receiptCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
                  >
                    <View style={styles.receiptTop}>
                      <View style={styles.receiptIconCircle}>
                        <Icon name="check-bold" size={16} color="#10B981" />
                      </View>

                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={[styles.receiptTitle, { color: colors.primaryText }]}>{rec.title}</Text>
                        <Text style={[styles.receiptMeta, { color: colors.secondaryText }]}>
                          {rec.receiptNo} · {rec.date}
                        </Text>
                      </View>

                      <Text style={styles.receiptAmount}>+₹ {rec.amount.toLocaleString("en-IN")}</Text>
                    </View>

                    <View style={[styles.receiptBottom, { borderTopColor: colors.divider }]}>
                      <Text style={[styles.receiptMethod, { color: colors.secondaryText }]}>
                        💳 {rec.method} ({rec.txnId})
                      </Text>

                      <TouchableOpacity
                        style={[styles.shareReceiptBtn, { borderColor: colors.divider }]}
                        onPress={() => handleShareReceipt(rec)}
                        activeOpacity={0.8}
                      >
                        <Icon name="share-variant-outline" size={14} color={colors.primaryAccent} />
                        <Text style={[styles.shareReceiptText, { color: colors.primaryAccent }]}>Tax Receipt</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* ========================================================================= */}
            {/* 6. TAB CONTENT 3: SCHOLARSHIPS & FINANCIAL AID                            */}
            {/* ========================================================================= */}
            {activeTab === "scholarship" && (
              <View style={{ gap: 12 }}>
                <View style={[styles.scholarshipCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
                  <View style={styles.scholarshipHeader}>
                    <View style={styles.scholarshipIconCircle}>
                      <Icon name="school" size={24} color="#4F46E5" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.scholarshipTitle, { color: colors.primaryText }]}>
                        {ward?.scholarship?.name || "Academic Merit Grant"}
                      </Text>
                      <Text style={[styles.scholarshipOrg, { color: colors.secondaryText }]}>
                        {ward?.scholarship?.organization || "Institutional Financial Aid"}
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.scholarshipCreditBox, { backgroundColor: "#4F46E514", borderColor: "#4F46E533" }]}>
                    <Text style={[styles.scholarshipCreditLabel, { color: "#4F46E5" }]}>ANNUAL TUITION CONCESSION CREDIT</Text>
                    <Text style={[styles.scholarshipCreditAmount, { color: "#4F46E5" }]}>{"—"}</Text>
                  </View>

                  <View style={styles.scholarshipSpecs}>
                    <View style={styles.specRow}>
                      <Text style={[styles.specKey, { color: colors.secondaryText }]}>Sanction Order</Text>
                      <Text style={[styles.specVal, { color: colors.primaryText }]}>{"—"}</Text>
                    </View>
                    <View style={styles.specRow}>
                      <Text style={[styles.specKey, { color: colors.secondaryText }]}>Status</Text>
                      <Text style={[styles.specVal, { color: "#10B981" }]}>Active & Credited to Semester Ledger</Text>
                    </View>
                  </View>
                </View>
              </View>
            )}

            {/* ========================================================================= */}
            {/* 7. TAB CONTENT 4: OFFICIAL UNIVERSITY BANK DETAILS                         */}
            {/* ========================================================================= */}
            {activeTab === "bank" && (
              <View style={[styles.bankCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
                <Text style={[styles.bankTitle, { color: colors.primaryText }]}>Official Bank Account for NEFT / RTGS</Text>
                <Text style={[styles.bankSub, { color: colors.secondaryText }]}>
                  Please mention student Roll Number ({rollNo || "—"}) in the transaction remarks.
                </Text>

                <View style={[styles.bankGrid, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                  <View style={styles.bankRow}>
                    <Text style={[styles.bankKey, { color: colors.secondaryText }]}>Account Name</Text>
                    <Text style={[styles.bankVal, { color: colors.primaryText }]}>{institution.name || "EduNex Institute of Technology"}</Text>
                  </View>
                  <View style={styles.bankRow}>
                    <Text style={[styles.bankKey, { color: colors.secondaryText }]}>Bank Name</Text>
                    <Text style={[styles.bankVal, { color: colors.primaryText }]}>{institution.bankName || "—"}</Text>
                  </View>
                  <View style={styles.bankRow}>
                    <Text style={[styles.bankKey, { color: colors.secondaryText }]}>Account Number</Text>
                    <Text style={[styles.bankVal, { color: colors.primaryAccent }]}>{institution.bankAccount || "—"}</Text>
                  </View>
                  <View style={styles.bankRow}>
                    <Text style={[styles.bankKey, { color: colors.secondaryText }]}>IFSC Code</Text>
                    <Text style={[styles.bankVal, { color: colors.primaryAccent }]}>{institution.bankIfsc || "—"}</Text>
                  </View>
                  <View style={styles.bankRow}>
                    <Text style={[styles.bankKey, { color: colors.secondaryText }]}>Branch</Text>
                    <Text style={[styles.bankVal, { color: colors.primaryText }]}>{institution.bankBranch || "—"}</Text>
                  </View>
                </View>
              </View>
            )}
          </>
        )}

        {/* Payment Bottom Sheet */}
        <PaymentModal visible={paymentVisible} onClose={() => setPaymentVisible(false)} invoice={selectedPayInvoice} />

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ---------------- Styles ----------------
const getStyles = (colors, isDarkMode) =>
  StyleSheet.create({
    container: { flex: 1 },
    scrollView: { flex: 1 },
    contentContainer: { paddingHorizontal: 16, paddingTop: 44, paddingBottom: 80 },

    /* Header */
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginBottom: 16,
    },
    headerIconWrap: {
      width: 42,
      height: 42,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: "800",
      letterSpacing: -0.3,
    },
    headerSubtitle: {
      fontSize: 11.5,
      fontWeight: "500",
      marginTop: 2,
    },

    /* Hero Card */
    heroCard: {
      borderRadius: 20,
      borderWidth: 1,
      padding: 18,
      marginBottom: 14,
      elevation: 3,
      shadowColor: "#000",
      shadowOpacity: 0.08,
      shadowRadius: 8,
    },
    heroTopRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
    },
    heroSub: {
      fontSize: 10.5,
      fontWeight: "800",
      letterSpacing: 0.5,
    },
    heroDueAmount: {
      fontSize: 28,
      fontWeight: "900",
      marginTop: 2,
      letterSpacing: -0.5,
    },
    statusPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
    },
    statusPillText: {
      fontSize: 9.5,
      fontWeight: "900",
    },
    progressWrap: {
      marginTop: 12,
    },
    progressLabelRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 6,
    },
    progressLabel: {
      fontSize: 11,
      fontWeight: "600",
    },
    progressValues: {
      fontSize: 11.5,
      fontWeight: "800",
    },
    progressTrack: {
      height: 8,
      borderRadius: 4,
      overflow: "hidden",
    },
    progressFill: {
      height: "100%",
      borderRadius: 4,
    },
    noticeRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      padding: 10,
      borderRadius: 12,
      borderWidth: 1,
      marginTop: 12,
    },
    noticeText: {
      flex: 1,
      fontSize: 11,
      fontWeight: "500",
      lineHeight: 15,
    },
    payHeroBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      marginTop: 14,
      paddingVertical: 13,
      borderRadius: 14,
      elevation: 2,
    },
    payHeroBtnText: {
      color: "#FFFFFF",
      fontSize: 13.5,
      fontWeight: "800",
    },

    /* Tabs */
    tabsStrip: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
      marginBottom: 12,
    },
    tabPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 11,
      paddingVertical: 6,
      borderRadius: 12,
      borderWidth: 1,
    },
    tabPillText: {
      fontSize: 11,
      fontWeight: "700",
    },

    /* Search Box */
    searchBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      borderWidth: 1,
      marginBottom: 12,
    },
    searchInput: {
      flex: 1,
      fontSize: 12.5,
      fontWeight: "500",
      padding: 0,
    },

    /* Invoice Cards */
    invoiceCard: {
      borderRadius: 16,
      borderWidth: 1,
      padding: 14,
      elevation: 2,
    },
    invoiceCardTop: {
      flexDirection: "row",
      alignItems: "center",
    },
    invoiceIconCircle: {
      width: 40,
      height: 40,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
    },
    invoiceTitle: {
      fontSize: 13.5,
      fontWeight: "800",
    },
    invoiceMeta: {
      fontSize: 11,
      fontWeight: "500",
      marginTop: 2,
    },
    invoiceAmount: {
      fontSize: 16,
      fontWeight: "900",
    },
    invoiceDesc: {
      fontSize: 11,
      lineHeight: 15,
      marginTop: 8,
    },
    invoiceCardBottom: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      borderTopWidth: 1,
      marginTop: 10,
      paddingTop: 8,
    },
    dueTag: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    redDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: "#EF4444",
    },
    dueTagText: {
      color: "#EF4444",
      fontSize: 9.5,
      fontWeight: "900",
    },
    paySingleBtn: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 10,
    },
    paySingleBtnText: {
      color: "#FFFFFF",
      fontSize: 11.5,
      fontWeight: "800",
    },

    /* Receipts */
    receiptCard: {
      borderRadius: 16,
      borderWidth: 1,
      padding: 14,
      elevation: 2,
    },
    receiptTop: {
      flexDirection: "row",
      alignItems: "center",
    },
    receiptIconCircle: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: "#10B98118",
      justifyContent: "center",
      alignItems: "center",
    },
    receiptTitle: {
      fontSize: 13.5,
      fontWeight: "800",
    },
    receiptMeta: {
      fontSize: 11,
      fontWeight: "500",
      marginTop: 2,
    },
    receiptAmount: {
      fontSize: 15,
      fontWeight: "800",
      color: "#10B981",
    },
    receiptBottom: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      borderTopWidth: 1,
      marginTop: 10,
      paddingTop: 8,
    },
    receiptMethod: {
      fontSize: 11,
      fontWeight: "500",
    },
    shareReceiptBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      borderWidth: 1,
    },
    shareReceiptText: {
      fontSize: 11,
      fontWeight: "700",
    },

    /* Scholarship */
    scholarshipCard: {
      borderRadius: 18,
      borderWidth: 1,
      padding: 16,
    },
    scholarshipHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    scholarshipIconCircle: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: "#4F46E518",
      justifyContent: "center",
      alignItems: "center",
    },
    scholarshipTitle: {
      fontSize: 14,
      fontWeight: "800",
    },
    scholarshipOrg: {
      fontSize: 11,
      fontWeight: "500",
      marginTop: 2,
    },
    scholarshipCreditBox: {
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      marginVertical: 12,
      alignItems: "center",
    },
    scholarshipCreditLabel: {
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 0.5,
    },
    scholarshipCreditAmount: {
      fontSize: 20,
      fontWeight: "900",
      marginTop: 2,
    },
    scholarshipSpecs: {
      gap: 6,
    },
    specRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    specKey: {
      fontSize: 11.5,
      fontWeight: "600",
    },
    specVal: {
      fontSize: 12,
      fontWeight: "800",
    },

    /* Bank */
    bankCard: {
      borderRadius: 18,
      borderWidth: 1,
      padding: 16,
    },
    bankTitle: {
      fontSize: 14.5,
      fontWeight: "800",
    },
    bankSub: {
      fontSize: 11,
      fontWeight: "500",
      marginTop: 2,
      marginBottom: 12,
    },
    bankGrid: {
      borderRadius: 14,
      borderWidth: 1,
      padding: 12,
      gap: 8,
    },
    bankRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    bankKey: {
      fontSize: 11.5,
      fontWeight: "600",
    },
    bankVal: {
      fontSize: 12,
      fontWeight: "800",
    },
  });
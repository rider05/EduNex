import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Share,
  Modal,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { useTheme } from "../../context/ThemeContext";
import PaymentModal from "./modals/PaymentModal";
import { SkeletonBox, SkeletonListItem } from "../../components/common/SkeletonLoader";
import { getStudentFees, getStudentData } from "../../services/dataService";
import useRefreshOnForeground from "../../hooks/useRefreshOnForeground";
import { showToast } from "../../utils/toastService";

// ---------------- Fallback Fees Dataset ----------------
const DEFAULT_INVOICES = [];

const DEFAULT_HISTORY = [];

export default function FeesScreen() {
  const { colors, isDarkMode } = useTheme();
  const styles = getStyles(colors, isDarkMode);

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [paymentVisible, setPaymentVisible] = useState(false);
  const [selectedPayInvoice, setSelectedPayInvoice] = useState(null);

  // Active Tab: 'dues' | 'history' | 'scholarship' | 'breakdown'
  const [activeTab, setActiveTab] = useState("dues");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTerm, setSelectedTerm] = useState("Odd '25 (Sem 5)");

  // Invoice Details Modal
  const [selectedInvoiceDetail, setSelectedInvoiceDetail] = useState(null);

  // Data
  const [dueDetails, setDueDetails] = useState(DEFAULT_INVOICES);
  const [historyData, setHistoryData] = useState(DEFAULT_HISTORY);
  const [studentInfo, setStudentInfo] = useState(null);

  const loadData = useCallback(async () => {
    try {
      const [fees, student] = await Promise.all([
        getStudentFees().catch(() => null),
        getStudentData().catch(() => null),
      ]);
      if (student) setStudentInfo(student);
      if (fees) {
        if (Array.isArray(fees.dueInvoices)) {
          setDueDetails(fees.dueInvoices);
        }
        if (Array.isArray(fees.history)) {
          setHistoryData(fees.history);
        }
      }
    } catch (err) {
      console.log("Error loading fees data:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  useRefreshOnForeground(loadData);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  // Calculations
  const totalDueAmount = useMemo(() => {
    return dueDetails
      .filter((inv) => inv.status === "due")
      .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }, [dueDetails]);

  const totalPaidAmount = useMemo(() => {
    return historyData.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }, [historyData]);

  const totalCourseFee = totalDueAmount + totalPaidAmount;
  const settlementPercentage = totalCourseFee > 0 ? Math.round((totalPaidAmount / totalCourseFee) * 100) : 100;

  // Filtered Invoices
  const filteredInvoices = useMemo(() => {
    return dueDetails.filter((inv) => {
      if (activeTab === "dues" && inv.status !== "due") return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = inv.title.toLowerCase().includes(q);
        const matchInv = inv.invoiceNo?.toLowerCase().includes(q);
        const matchCat = inv.category?.toLowerCase().includes(q);
        if (!matchTitle && !matchInv && !matchCat) return false;
      }
      return true;
    });
  }, [dueDetails, activeTab, searchQuery]);

  // Filtered Receipts
  const filteredHistory = useMemo(() => {
    return historyData.filter((item) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = item.title.toLowerCase().includes(q);
        const matchRec = item.receiptNo?.toLowerCase().includes(q);
        const matchTxn = item.txnId?.toLowerCase().includes(q);
        if (!matchTitle && !matchRec && !matchTxn) return false;
      }
      return true;
    });
  }, [historyData, searchQuery]);

  const handlePayNow = (specificInvoice = null) => {
    setSelectedPayInvoice(specificInvoice);
    setPaymentVisible(true);
  };

  const handleShareReceipt = async (receipt) => {
    try {
      await Share.share({
        title: `Fee Tax Receipt - ${receipt.receiptNo}`,
        message: `📄 EDUNEX INSTITUTIONAL FEE RECEIPT\nReceipt No: ${receipt.receiptNo}\nItem: ${receipt.title}\nAmount Paid: ₹${receipt.amount.toLocaleString("en-IN")}\nDate & Time: ${receipt.date}\nPayment Mode: ${receipt.method}\nTransaction Ref: ${receipt.txnId}\nStatus: VERIFIED & CLEARED`,
      });
      showToast("Receipt shared successfully!", "success");
    } catch (err) {
      console.log("Share receipt error:", err);
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
        {isLoading ? (
          <View style={{ marginTop: 10 }}>
            <SkeletonBox height={180} borderRadius={24} style={{ marginBottom: 20 }} />
            <SkeletonListItem />
            <SkeletonListItem />
            <SkeletonListItem />
          </View>
        ) : (
          <>
            {/* Header Hub */}
            <View style={styles.header}>
              <View style={[styles.headerIconWrap, { backgroundColor: colors.primaryAccent + "18" }]}>
                <Icon name="cash-multiple" size={24} color={colors.primaryAccent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.headerTitle, { color: colors.primaryText }]}>Fee Management</Text>
                <Text style={[styles.headerSubtitle, { color: colors.secondaryText }]}>
                  Tuition invoices, dues & digital tax receipts
                </Text>
              </View>

              {/* Term Selector */}
              <TouchableOpacity
                style={[styles.termSelectorPill, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
                onPress={() => {
                  setSelectedTerm((prev) => (prev.includes("Sem 5") ? "Even '26 (Sem 6)" : "Odd '25 (Sem 5)"));
                  showToast("Term schedule switched", "info");
                }}
              >
                <Text style={[styles.termSelectorText, { color: colors.primaryAccent }]}>{selectedTerm}</Text>
                <Icon name="chevron-down" size={14} color={colors.primaryAccent} />
              </TouchableOpacity>
            </View>

            {/* Financial Hero Summary Card */}
            <View style={[styles.heroSummaryCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
              {/* Top Row: Total Due & Status Badge */}
              <View style={styles.heroTopRow}>
                <View>
                  <Text style={[styles.heroLabel, { color: colors.secondaryText }]}>Total Outstanding Due</Text>
                  <Text style={[styles.heroAmount, { color: totalDueAmount > 0 ? "#EF4444" : "#10B981" }]}>
                    ₹ {totalDueAmount.toLocaleString("en-IN")}
                  </Text>
                </View>

                <View
                  style={[
                    styles.clearanceBadge,
                    totalDueAmount > 0
                      ? { backgroundColor: "#EF444418" }
                      : { backgroundColor: "#10B98118" },
                  ]}
                >
                  <Icon
                    name={totalDueAmount > 0 ? "alert-circle-outline" : "check-decagram"}
                    size={16}
                    color={totalDueAmount > 0 ? "#EF4444" : "#10B981"}
                  />
                  <Text
                    style={[
                      styles.clearanceBadgeText,
                      { color: totalDueAmount > 0 ? "#EF4444" : "#10B981" },
                    ]}
                  >
                    {totalDueAmount > 0 ? "DUES PENDING" : "FEES CLEARED"}
                  </Text>
                </View>
              </View>

              {/* Settlement Progress Bar */}
              <View style={styles.progressSection}>
                <View style={styles.progressLabelRow}>
                  <Text style={[styles.progressLabel, { color: colors.secondaryText }]}>
                    Academic Fee Settlement ({settlementPercentage}%)
                  </Text>
                  <Text style={[styles.progressValues, { color: colors.primaryText }]}>
                    ₹{totalPaidAmount.toLocaleString("en-IN")} / ₹{totalCourseFee.toLocaleString("en-IN")}
                  </Text>
                </View>
                <View style={[styles.progressBarTrack, { backgroundColor: colors.primaryBackground }]}>
                  <View style={[styles.progressBarFill, { width: `${settlementPercentage}%`, backgroundColor: colors.primaryAccent }]} />
                </View>
              </View>

              {/* Exam Clearance Notice */}
              <View style={[styles.noticeRow, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                <Icon name="information-outline" size={16} color={totalDueAmount > 0 ? "#F59E0B" : "#10B981"} />
                <Text style={[styles.noticeText, { color: colors.secondaryText }]} numberOfLines={2}>
                  {totalDueAmount > 0
                    ? "Settle pending dues before Nov 30 to activate semester exam hall ticket."
                    : "All institutional dues cleared! Exam hall ticket is ready for download."}
                </Text>
              </View>

              {/* Quick Pay Action */}
              {totalDueAmount > 0 && (
                <TouchableOpacity
                  style={[styles.payHeroBtn, { backgroundColor: colors.primaryAccent }]}
                  onPress={() => handlePayNow()}
                  activeOpacity={0.85}
                >
                  <Icon name="lightning-bolt" size={18} color="#FFFFFF" />
                  <Text style={styles.payHeroBtnText}>
                    Pay Outstanding Balance (₹{totalDueAmount.toLocaleString("en-IN")})
                  </Text>
                  <Icon name="arrow-right" size={18} color="#FFFFFF" />
                </TouchableOpacity>
              )}
            </View>

            {/* Navigation Tabs */}
            <View style={styles.tabsStrip}>
              {[
                { key: "dues", label: `Pending Dues (${dueDetails.filter((d) => d.status === "due").length})`, icon: "alert-circle-outline" },
                { key: "history", label: `Receipts (${historyData.length})`, icon: "receipt-text-outline" },
                { key: "scholarship", label: "Scholarships", icon: "certificate-outline" },
                { key: "breakdown", label: "Fee Matrix", icon: "table" },
              ].map((tab) => {
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
              <View style={[styles.searchBarBox, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
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
            {/* TAB 1: PENDING DUES & INVOICES                                            */}
            {/* ========================================================================= */}
            {activeTab === "dues" && (
              <View style={{ gap: 10 }}>
                {filteredInvoices.length === 0 ? (
                  <View style={[styles.emptyCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
                    <Icon name="check-decagram-outline" size={48} color="#10B981" />
                    <Text style={[styles.emptyTitle, { color: colors.primaryText }]}>No Pending Invoices!</Text>
                    <Text style={[styles.emptySub, { color: colors.secondaryText }]}>
                      All current term invoices have been successfully paid and accounted for.
                    </Text>
                  </View>
                ) : (
                  filteredInvoices.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.invoiceCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
                      onPress={() => setSelectedInvoiceDetail(item)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.invoiceCardTop}>
                        <View style={[styles.invoiceIconCircle, { backgroundColor: item.iconBg || colors.primaryAccent }]}>
                          <Icon name={item.icon || "file-document-outline"} size={20} color="#FFFFFF" />
                        </View>

                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <View style={styles.invoiceTitleRow}>
                            <Text style={[styles.invoiceTitle, { color: colors.primaryText }]} numberOfLines={1}>
                              {item.title}
                            </Text>
                          </View>
                          <Text style={[styles.invoiceInvoiceNo, { color: colors.secondaryText }]}>
                            {item.invoiceNo} · Due on {item.dueDate}
                          </Text>
                        </View>

                        <Text style={[styles.invoiceAmountDue, { color: "#EF4444" }]}>
                          ₹ {item.amount.toLocaleString("en-IN")}
                        </Text>
                      </View>

                      <View style={styles.invoiceCardDivider} />

                      <View style={styles.invoiceCardBottom}>
                        <View style={styles.dueStatusPill}>
                          <View style={styles.redDot} />
                          <Text style={styles.dueStatusText}>PAYMENT DUE</Text>
                        </View>

                        <TouchableOpacity
                          style={[styles.paySingleBtn, { backgroundColor: colors.primaryAccent }]}
                          onPress={() => handlePayNow(item)}
                          activeOpacity={0.85}
                        >
                          <Text style={styles.paySingleBtnText}>Pay ₹{item.amount.toLocaleString("en-IN")}</Text>
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            )}

            {/* ========================================================================= */}
            {/* TAB 2: TRANSACTION RECEIPTS & TAX PROOF                                   */}
            {/* ========================================================================= */}
            {activeTab === "history" && (
              <View style={{ gap: 10 }}>
                {filteredHistory.map((rec) => (
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

                    <View style={[styles.receiptBottomRow, { borderTopColor: colors.divider }]}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Icon name="credit-card-check-outline" size={14} color={colors.secondaryText} />
                        <Text style={[styles.receiptMethodText, { color: colors.secondaryText }]}>
                          {rec.method} ({rec.txnId})
                        </Text>
                      </View>

                      <TouchableOpacity
                        style={[styles.downloadReceiptBtn, { borderColor: colors.divider }]}
                        onPress={() => handleShareReceipt(rec)}
                        activeOpacity={0.8}
                      >
                        <Icon name="share-variant-outline" size={14} color={colors.primaryAccent} />
                        <Text style={[styles.downloadReceiptText, { color: colors.primaryAccent }]}>Receipt</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* ========================================================================= */}
            {/* TAB 3: SCHOLARSHIPS & INSTITUTIONAL CONCESSIONS                           */}
            {/* ========================================================================= */}
            {activeTab === "scholarship" && (
              <View style={{ gap: 12 }}>
                <View style={[styles.scholarshipHero, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
                  <View style={styles.scholarshipHeaderRow}>
                    <View style={styles.scholarshipIconBadge}>
                      <Icon name="school" size={26} color="#4F46E5" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.scholarshipName, { color: colors.primaryText }]}>
                        {studentInfo?.scholarship?.name || "Academic Merit Grant"}
                      </Text>
                      <Text style={[styles.scholarshipOrg, { color: colors.secondaryText }]}>
                        {studentInfo?.scholarship?.organization || "Institutional Financial Aid"}
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.scholarshipAmountBox, { backgroundColor: "#4F46E514", borderColor: "#4F46E533" }]}>
                    <Text style={[styles.scholarshipAmountLabel, { color: "#4F46E5" }]}>ANNUAL TUITION CONCESSION</Text>
                    <Text style={[styles.scholarshipAmountVal, { color: "#4F46E5" }]}>—</Text>
                  </View>

                  <View style={styles.scholarshipSpecsGrid}>
                    <View style={styles.specItem}>
                      <Text style={[styles.specLabel, { color: colors.secondaryText }]}>Award Status</Text>
                      <Text style={[styles.specVal, { color: "#10B981" }]}>Active & Disbursed</Text>
                    </View>
                    <View style={styles.specItem}>
                      <Text style={[styles.specLabel, { color: colors.secondaryText }]}>Sanction Order</Text>
                      <Text style={[styles.specVal, { color: colors.primaryText }]}>—</Text>
                    </View>
                    <View style={styles.specItem}>
                      <Text style={[styles.specLabel, { color: colors.secondaryText }]}>Minimum GPA Required</Text>
                       <Text style={[styles.specVal, { color: colors.primaryText }]}>{studentInfo?.scholarship?.minCgpa || "—"}</Text>
                    </View>
                    <View style={styles.specItem}>
                      <Text style={[styles.specLabel, { color: colors.secondaryText }]}>Current CGPA</Text>
                       <Text style={[styles.specVal, { color: "#10B981" }]}>{studentInfo?.cgpa ? `${studentInfo.cgpa} (Eligible)` : "—"}</Text>
                    </View>
                  </View>
                </View>

                {/* Additional Grant Application */}
                <View style={[styles.grantInfoCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
                  <Icon name="hand-heart-outline" size={24} color={colors.primaryAccent} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.grantInfoTitle, { color: colors.primaryText }]}>Need Financial Assistance?</Text>
                    <Text style={[styles.grantInfoSub, { color: colors.secondaryText }]}>
                      Apply for Alumni Emergency Grants or Corporate CSR sponsorships through Dean Affairs.
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* ========================================================================= */}
            {/* TAB 4: COMPREHENSIVE FEE MATRIX                                           */}
            {/* ========================================================================= */}
            {activeTab === "breakdown" && (
              <View style={[styles.matrixCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
                <Text style={[styles.matrixTitle, { color: colors.primaryText }]}>{studentInfo?.department || "B.Tech"} · {studentInfo?.semester || "Semester"} Fee Matrix</Text>
                <Text style={[styles.matrixSub, { color: colors.secondaryText }]}>Approved by Academic Council for 2025-2026</Text>

                <View style={styles.matrixTable}>
                  {[
                    { head: "Tuition Fee (Theory + Lab)", sem: "—", status: "Billed" },
                    { head: "Anna University Exam & Registration", sem: "—", status: "Billed" },
                    { head: "High Performance Computing Lab", sem: "—", status: "Billed" },
                    { head: "IEEE & ACM Digital Library Access", sem: "—", status: "Billed" },
                    { head: "Student Welfare & Insurance Cover", sem: "—", status: "Billed" },
                    { head: "Hostel Residence (Shared 3-Bed)", sem: "—", status: "Billed" },
                    { head: "Less: Academic Scholarship Credit", sem: "—", status: "Deducted" },
                  ].map((row, idx) => (
                    <View key={idx} style={[styles.matrixTableRow, { borderBottomColor: colors.divider }]}>
                      <Text style={[styles.matrixColItem, { color: colors.primaryText }]}>{row.head}</Text>
                      <Text style={[styles.matrixColAmount, { color: row.sem.startsWith("-") ? "#10B981" : colors.primaryText }]}>
                        {row.sem}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </>
        )}

        {/* Payment Bottom Sheet */}
        <PaymentModal visible={paymentVisible} onClose={() => setPaymentVisible(false)} invoice={selectedPayInvoice} />

        {/* Invoice Detail Inspection Modal */}
        {selectedInvoiceDetail && (
          <Modal visible={!!selectedInvoiceDetail} transparent animationType="fade" onRequestClose={() => setSelectedInvoiceDetail(null)}>
            <View style={styles.detailModalOverlay}>
              <View style={[styles.detailModalCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
                <View style={styles.detailHeaderRow}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <View style={[styles.invoiceIconCircle, { backgroundColor: selectedInvoiceDetail.iconBg || colors.primaryAccent }]}>
                      <Icon name={selectedInvoiceDetail.icon || "file-document-outline"} size={22} color="#FFFFFF" />
                    </View>
                    <View>
                      <Text style={[styles.detailModalTitle, { color: colors.primaryText }]}>Invoice Details</Text>
                      <Text style={[styles.detailModalSub, { color: colors.secondaryText }]}>{selectedInvoiceDetail.invoiceNo}</Text>
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => setSelectedInvoiceDetail(null)}>
                    <Icon name="close-circle-outline" size={24} color={colors.secondaryText} />
                  </TouchableOpacity>
                </View>

                <View style={[styles.detailSummaryBox, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                  <Text style={[styles.detailItemName, { color: colors.primaryText }]}>{selectedInvoiceDetail.title}</Text>
                  <Text style={[styles.detailItemDesc, { color: colors.secondaryText }]}>{selectedInvoiceDetail.description}</Text>

                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: colors.secondaryText }]}>Total Payable</Text>
                    <Text style={[styles.detailVal, { color: "#EF4444" }]}>₹ {selectedInvoiceDetail.amount.toLocaleString("en-IN")}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: colors.secondaryText }]}>Due Date</Text>
                    <Text style={[styles.detailVal, { color: colors.primaryText }]}>{selectedInvoiceDetail.dueDate}</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.detailPayBtn, { backgroundColor: colors.primaryAccent }]}
                  onPress={() => {
                    const inv = selectedInvoiceDetail;
                    setSelectedInvoiceDetail(null);
                    handlePayNow(inv);
                  }}
                >
                  <Text style={styles.detailPayBtnText}>Proceed to Pay ₹{selectedInvoiceDetail.amount.toLocaleString("en-IN")}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        )}
      </ScrollView>
    </View>
  );
}

// ---------------- Styles ----------------
const getStyles = (colors, isDarkMode) =>
  StyleSheet.create({
    container: { flex: 1 },
    scrollView: { flex: 1 },
    contentContainer: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 80 },

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
    termSelectorPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 10,
      borderWidth: 1,
    },
    termSelectorText: {
      fontSize: 11,
      fontWeight: "700",
    },

    /* Hero Summary Card */
    heroSummaryCard: {
      borderRadius: 20,
      borderWidth: 1,
      padding: 18,
      marginBottom: 16,
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
    heroLabel: {
      fontSize: 12,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    heroAmount: {
      fontSize: 28,
      fontWeight: "900",
      marginTop: 4,
      letterSpacing: -0.5,
    },
    clearanceBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
    },
    clearanceBadgeText: {
      fontSize: 10,
      fontWeight: "900",
    },

    /* Progress Section */
    progressSection: {
      marginTop: 14,
    },
    progressLabelRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
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
    progressBarTrack: {
      height: 8,
      borderRadius: 4,
      overflow: "hidden",
    },
    progressBarFill: {
      height: "100%",
      borderRadius: 4,
    },

    /* Notice Row */
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

    /* Tabs Strip */
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
    searchBarBox: {
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
    invoiceTitleRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    invoiceTitle: {
      fontSize: 13.5,
      fontWeight: "800",
    },
    invoiceInvoiceNo: {
      fontSize: 11,
      fontWeight: "500",
      marginTop: 2,
    },
    invoiceAmountDue: {
      fontSize: 16,
      fontWeight: "900",
    },
    invoiceCardDivider: {
      height: 1,
      backgroundColor: "rgba(150,150,150,0.1)",
      marginVertical: 10,
    },
    invoiceCardBottom: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    dueStatusPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      backgroundColor: "#EF444414",
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
    },
    redDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: "#EF4444",
    },
    dueStatusText: {
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

    /* Empty Card */
    emptyCard: {
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
      borderRadius: 18,
      borderWidth: 1,
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: "800",
      marginTop: 8,
    },
    emptySub: {
      fontSize: 12,
      textAlign: "center",
      marginTop: 4,
      lineHeight: 16,
    },

    /* Receipt Cards */
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
    receiptBottomRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      borderTopWidth: 1,
      marginTop: 10,
      paddingTop: 8,
    },
    receiptMethodText: {
      fontSize: 11,
      fontWeight: "500",
    },
    downloadReceiptBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      borderWidth: 1,
    },
    downloadReceiptText: {
      fontSize: 11,
      fontWeight: "700",
    },

    /* Scholarship */
    scholarshipHero: {
      borderRadius: 18,
      borderWidth: 1,
      padding: 16,
    },
    scholarshipHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    scholarshipIconBadge: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: "#4F46E518",
      justifyContent: "center",
      alignItems: "center",
    },
    scholarshipName: {
      fontSize: 14,
      fontWeight: "800",
    },
    scholarshipOrg: {
      fontSize: 11,
      fontWeight: "500",
      marginTop: 2,
    },
    scholarshipAmountBox: {
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      marginVertical: 12,
      alignItems: "center",
    },
    scholarshipAmountLabel: {
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 0.5,
    },
    scholarshipAmountVal: {
      fontSize: 20,
      fontWeight: "900",
      marginTop: 2,
    },
    scholarshipSpecsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
    },
    specItem: {
      width: "47%",
    },
    specLabel: {
      fontSize: 10.5,
      fontWeight: "600",
    },
    specVal: {
      fontSize: 12,
      fontWeight: "800",
      marginTop: 2,
    },
    grantInfoCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 14,
      borderRadius: 16,
      borderWidth: 1,
    },
    grantInfoTitle: {
      fontSize: 13,
      fontWeight: "800",
    },
    grantInfoSub: {
      fontSize: 11,
      fontWeight: "500",
      marginTop: 2,
      lineHeight: 15,
    },

    /* Matrix */
    matrixCard: {
      borderRadius: 18,
      borderWidth: 1,
      padding: 16,
    },
    matrixTitle: {
      fontSize: 14,
      fontWeight: "800",
    },
    matrixSub: {
      fontSize: 11,
      fontWeight: "500",
      marginTop: 2,
      marginBottom: 12,
    },
    matrixTable: {
      gap: 8,
    },
    matrixTableRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 8,
      borderBottomWidth: 1,
    },
    matrixColItem: {
      fontSize: 12,
      fontWeight: "600",
      flex: 1,
      marginRight: 10,
    },
    matrixColAmount: {
      fontSize: 12.5,
      fontWeight: "800",
    },

    /* Detail Modal */
    detailModalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.75)",
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 20,
    },
    detailModalCard: {
      width: "100%",
      borderRadius: 20,
      borderWidth: 1,
      padding: 18,
    },
    detailHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 14,
    },
    detailModalTitle: {
      fontSize: 16,
      fontWeight: "800",
    },
    detailModalSub: {
      fontSize: 11.5,
      fontWeight: "500",
    },
    detailSummaryBox: {
      padding: 12,
      borderRadius: 14,
      borderWidth: 1,
      gap: 6,
      marginBottom: 16,
    },
    detailItemName: {
      fontSize: 14,
      fontWeight: "800",
    },
    detailItemDesc: {
      fontSize: 11.5,
      lineHeight: 16,
      marginBottom: 6,
    },
    detailRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    detailLabel: {
      fontSize: 11.5,
      fontWeight: "600",
    },
    detailVal: {
      fontSize: 12.5,
      fontWeight: "800",
    },
    detailPayBtn: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 12,
      borderRadius: 12,
    },
    detailPayBtnText: {
      color: "#FFFFFF",
      fontSize: 13.5,
      fontWeight: "800",
    },
  });
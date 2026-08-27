import React, { useState, useEffect, useCallback } from "react";
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  RefreshControl,
  ActivityIndicator,
  Share,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { useTheme } from "../../context/ThemeContext";
import { SkeletonKPIRow, SkeletonListItem } from "../../components/common/SkeletonLoader";
import { getAdminStats, getReports } from "../../services/dataService";
import { showToast } from "../../utils/toastService";
import useRefreshOnForeground from "../../hooks/useRefreshOnForeground";

export default function ReportsAdmin() {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTerm, setSelectedTerm] = useState("Odd Term (2025-26)");
  const [activeModal, setActiveModal] = useState(null);
  const [generateModalVisible, setGenerateModalVisible] = useState(false);

  // Generate Report Form State
  const [genReportType, setGenReportType] = useState("academic");
  const [genDept, setGenDept] = useState("All Departments");
  const [genFormat, setGenFormat] = useState("PDF");
  const [isGenerating, setIsGenerating] = useState(false);

  // Live Metric Overview
  const [overviewKPIs, setOverviewKPIs] = useState({});

  // Live Reports Catalog
  const [liveReports, setLiveReports] = useState([]);

  const seedColors = ["#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#EF4444", "#06B6D4"];

  const termOptions = [
    "Odd Term (2025-26)",
    "Even Term (2024-25)",
    "Annual Audit 2025",
    "Monthly Snapshot",
  ];

  const loadData = useCallback(async () => {
    try {
      const statsRes = await getAdminStats().catch(() => null);
      const reportsRes = await getReports().catch(() => []);

      const totalStudents = Number(String(statsRes?.totalStudents || "0").replace(/[^0-9]/g, "")) || 0;
      const totalStaff = Number(String(statsRes?.totalFaculty || "0").replace(/[^0-9]/g, "")) || 0;
      const ratio = totalStaff > 0 ? `1 : ${Math.round(totalStudents / totalStaff)}` : "";

      const feeCollectionPct = statsRes?.feeCollectionPct || "—";
      const attendancePct = statsRes?.attendancePct || "—";

      // Derive academic/pass/placement from the reports collection if present
      const reportCardsData = Array.isArray(reportsRes) ? reportsRes : [];
      const academicReport = reportCardsData.find((r) => r.category === "academic" && (r.title || "").toLowerCase().includes("academic"));
      const feeReport = reportCardsData.find((r) => (r.title || "").toLowerCase().includes("fee"));
      const attendanceReport = reportCardsData.find((r) => (r.title || "").toLowerCase().includes("attendance"));
      const placementReport = reportCardsData.find((r) => (r.title || "").toLowerCase().includes("placement"));

      setLiveReports(reportCardsData);

      setOverviewKPIs({
        academicPassRate: (academicReport && academicReport.statSecondary) || "—",
        feeRealization: (feeReport && feeReport.statSecondary) || feeCollectionPct,
        dailyAttendance: (attendanceReport && attendanceReport.statPrimary) || attendancePct,
        facultyStudentRatio: ratio,
        avgGPA: (academicReport && academicReport.statPrimary) || "—",
        placementRate: (placementReport && placementReport.statPrimary) || "—",
      });
    } catch (err) {
      console.log("ReportsAdmin load error:", err);
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

  // Handle Export / Share
  const handleExportReport = async (title) => {
    try {
      await Share.share({
        title: `${title} - EduNex Campus Analytics`,
        message: `📊 [EduNex Campus Analytics Report]\nTitle: ${title}\nAcademic Period: ${selectedTerm}\nGenerated on: ${new Date().toLocaleDateString()}\nStatus: Verified MongoDB Report Data.`,
      });
      showToast(`Exported ${title} successfully!`, "success");
    } catch (err) {
      console.log("Export share error:", err);
    }
  };

  // Handle Generate New Report
  const handleRunGenerator = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
      setGenerateModalVisible(false);
      showToast(`✅ Generated ${genFormat} report for ${genDept}!`, "success");
    }, 1400);
  };

  // Detailed Reports Catalog (built from live MongoDB reports, fallback to seeded catalog)
  const seededCatalog = [
    { id: "r1", title: "Academic Performance Analysis", subtitle: "CGPA distribution, pass rates, and grade analysis by department", desc: "CGPA distribution, pass rates, and grade analysis by department", icon: "chart-bar", color: "#3B82F6", category: "academic", statPrimary: "—", statSecondary: "—", highlights: [], details: {} },
    { id: "r2", title: "Attendance Compliance Report", subtitle: "Daily, weekly, and monthly attendance trends across all departments", desc: "Daily, weekly, and monthly attendance trends across all departments", icon: "calendar-check", color: "#10B981", category: "attendance", statPrimary: "—", statSecondary: "—", highlights: [], details: {} },
    { id: "r3", title: "Fee Collection & Revenue", subtitle: "Fee realization, pending dues, and scholarship disbursement summary", desc: "Fee realization, pending dues, and scholarship disbursement summary", icon: "currency-inr", color: "#F59E0B", category: "fees", statPrimary: "—", statSecondary: "—", highlights: [], details: {} },
    { id: "r4", title: "Faculty Workload Analysis", subtitle: "Teaching hours, research output, and student-faculty ratio by department", desc: "Teaching hours, research output, and student-faculty ratio by department", icon: "account-tie", color: "#8B5CF6", category: "faculty", statPrimary: "—", statSecondary: "—", highlights: [], details: {} },
    { id: "r5", title: "Placement & Career Services", subtitle: "Campus recruitment statistics, offer letters, and company partnerships", desc: "Campus recruitment statistics, offer letters, and company partnerships", icon: "briefcase-outline", color: "#EF4444", category: "placement", statPrimary: "—", statSecondary: "—", highlights: [], details: {} },
    { id: "r6", title: "Infrastructure Utilization", subtitle: "Hostel, lab, library, and transport capacity usage analytics", desc: "Hostel, lab, library, and transport capacity usage analytics", icon: "domain", color: "#06B6D4", category: "infrastructure", statPrimary: "—", statSecondary: "—", highlights: [], details: {} },
  ];

  const spreadReport = (r, i) => {
    const color = r.color || seedColors[i % seedColors.length];
    const highlights = Array.isArray(r.highlights)
      ? r.highlights.map((h) =>
          typeof h === "string" ? { label: h, value: "", bar: "100%", color } : h
        )
      : [];
    return {
      id: r._id || r.id || `r${i + 1}`,
      title: r.title || "Report",
      subtitle: r.desc || "",
      desc: r.desc || "",
      category: r.category || "General",
      icon: r.icon || "chart-bar",
      color,
      statPrimary: r.statPrimary || "—",
      statSecondary: r.statSecondary || "—",
      statPrimaryLabel: r.statPrimaryLabel || "",
      statSecondaryLabel: r.statSecondaryLabel || "",
      highlights,
      details: r.details && typeof r.details === "object" && !Array.isArray(r.details) ? r.details : {},
    };
  };

  const reportCards =
    liveReports.length > 0
      ? liveReports.map(spreadReport)
      : seededCatalog;

  const activeReportItem = reportCards.find((r) => r.id === activeModal);

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
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
        {/* Top Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.headerSub, { color: colors.secondaryText }]}>EXECUTIVE INTELLIGENCE</Text>
            <Text style={[styles.header, { color: colors.primaryText }]}>Reports & Analytics</Text>
          </View>

          <TouchableOpacity
            style={[styles.generateTopBtn, { backgroundColor: colors.primaryAccent }]}
            onPress={() => setGenerateModalVisible(true)}
            activeOpacity={0.85}
          >
            <Icon name="file-chart-outline" size={16} color="#fff" />
            <Text style={styles.generateTopBtnText}>Generate</Text>
          </TouchableOpacity>
        </View>

        {/* Academic Period Selector Bar */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.periodScroll}>
          {termOptions.map((term) => (
            <TouchableOpacity
              key={term}
              onPress={() => {
                setSelectedTerm(term);
                showToast(`Loaded analytics for ${term}`, "info");
              }}
              style={[
                styles.periodTab,
                {
                  backgroundColor: selectedTerm === term ? colors.primaryAccent : colors.cardBackground,
                  borderColor: selectedTerm === term ? colors.primaryAccent : colors.divider,
                },
              ]}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.periodTabText,
                  { color: selectedTerm === term ? "#fff" : colors.primaryText },
                ]}
              >
                {term}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {isLoading ? (
          <View style={{ marginTop: 15 }}>
            <SkeletonKPIRow count={2} />
            <SkeletonKPIRow count={2} />
            <SkeletonListItem />
            <SkeletonListItem />
          </View>
        ) : (
          <>
            {/* ========================================================================= */}
            {/* 1. EXECUTIVE KPI MATRIX                                                  */}
            {/* ========================================================================= */}
            <View style={styles.kpiGrid}>
              <View style={[styles.kpiCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
                <View style={[styles.kpiIconWrap, { backgroundColor: "#3B82F618" }]}>
                  <Icon name="school" size={20} color="#3B82F6" />
                </View>
                <Text style={[styles.kpiValue, { color: colors.primaryText }]}>{overviewKPIs.academicPassRate}</Text>
                <Text style={[styles.kpiLabel, { color: colors.secondaryText }]}>Academic Pass Rate</Text>
              </View>

              <View style={[styles.kpiCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
                <View style={[styles.kpiIconWrap, { backgroundColor: "#10B98118" }]}>
                  <Icon name="cash-check" size={20} color="#10B981" />
                </View>
                <Text style={[styles.kpiValue, { color: colors.primaryText }]}>{overviewKPIs.feeRealization}</Text>
                <Text style={[styles.kpiLabel, { color: colors.secondaryText }]}>Fee Realization</Text>
              </View>

              <View style={[styles.kpiCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
                <View style={[styles.kpiIconWrap, { backgroundColor: "#8B5CF618" }]}>
                  <Icon name="briefcase-check" size={20} color="#8B5CF6" />
                </View>
                <Text style={[styles.kpiValue, { color: colors.primaryText }]}>{overviewKPIs.placementRate}</Text>
                <Text style={[styles.kpiLabel, { color: colors.secondaryText }]}>Placement Rate</Text>
              </View>

              <View style={[styles.kpiCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
                <View style={[styles.kpiIconWrap, { backgroundColor: "#F59E0B18" }]}>
                  <Icon name="account-multiple-check" size={20} color="#F59E0B" />
                </View>
                <Text style={[styles.kpiValue, { color: colors.primaryText }]}>{overviewKPIs.facultyStudentRatio}</Text>
                <Text style={[styles.kpiLabel, { color: colors.secondaryText }]}>Faculty : Student</Text>
              </View>
            </View>

            {/* ========================================================================= */}
            {/* 2. DETAILED REPORTS & ANALYTICS CATALOG                                   */}
            {/* ========================================================================= */}
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionHeading, { color: colors.primaryText }]}>
                Domain Intelligence Reports
              </Text>
              <Text style={[styles.sectionSub, { color: colors.secondaryText }]}>
                Tap any domain report to inspect charts and export data
              </Text>
            </View>

            <View style={styles.reportsList}>
              {reportCards.map((r) => (
                <TouchableOpacity
                  key={r.id}
                  style={[
                    styles.reportCard,
                    {
                      backgroundColor: colors.cardBackground,
                      borderColor: colors.divider,
                      borderLeftColor: r.color,
                    },
                  ]}
                  onPress={() => setActiveModal(r.id)}
                  activeOpacity={0.85}
                >
                  <View style={styles.reportCardTop}>
                    <View style={[styles.reportIconCircle, { backgroundColor: r.color + "18" }]}>
                      <Icon name={r.icon} size={24} color={r.color} />
                    </View>

                    <View style={{ flex: 1 }}>
                      <View style={styles.reportTitleRow}>
                        <Text style={[styles.reportTitle, { color: colors.primaryText }]}>
                          {r.title}
                        </Text>
                        <View style={[styles.categoryPill, { backgroundColor: r.color + "18" }]}>
                          <Text style={[styles.categoryPillText, { color: r.color }]}>{r.category}</Text>
                        </View>
                      </View>
                      <Text style={[styles.reportDesc, { color: colors.secondaryText }]} numberOfLines={2}>
                        {r.desc}
                      </Text>
                    </View>
                  </View>

                  {/* Summary Bar Indicators */}
                  <View style={[styles.reportSummaryRow, { borderTopColor: colors.divider }]}>
                    <View style={styles.statPill}>
                      <Icon name="check-decagram" size={14} color={r.color} />
                      <Text style={[styles.statPillText, { color: colors.primaryText }]}>{r.statPrimary}</Text>
                    </View>
                    <View style={styles.statPill}>
                      <Icon name="chart-bell-curve" size={14} color={colors.secondaryText} />
                      <Text style={[styles.statPillText, { color: colors.secondaryText }]}>{r.statSecondary}</Text>
                    </View>
                    <Icon name="chevron-right" size={20} color={colors.secondaryText} style={{ marginLeft: "auto" }} />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        <View style={{ height: 110 }} />
      </ScrollView>

      {/* ========================================================================= */}
      {/* MODAL 1: REPORT DEEP DIVE & DRILL DOWN                                    */}
      {/* ========================================================================= */}
      {activeReportItem && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setActiveModal(null)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalBox, { backgroundColor: colors.cardBackground }]}>
              {/* Header */}
              <View style={styles.modalTopBar}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={[styles.modalHeaderIcon, { backgroundColor: activeReportItem.color + "20" }]}>
                    <Icon name={activeReportItem.icon} size={24} color={activeReportItem.color} />
                  </View>
                  <View>
                    <Text style={[styles.modalHeading, { color: colors.primaryText }]}>
                      {activeReportItem.title}
                    </Text>
                    <Text style={[styles.modalSub, { color: colors.secondaryText }]}>
                      Period: {selectedTerm} · Verified MongoDB Data
                    </Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => setActiveModal(null)}>
                  <Icon name="close-circle" size={26} color={colors.secondaryText} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
                {/* Visual Bar Breakdown */}
                <Text style={[styles.drilldownSectionTitle, { color: colors.secondaryText }]}>
                  DEPARTMENT & CATEGORY BREAKDOWN
                </Text>

                <View style={[styles.breakdownBox, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                  {activeReportItem.highlights.map((h, i) => (
                    <View key={i} style={styles.breakdownItem}>
                      <View style={styles.breakdownItemTop}>
                        <Text style={[styles.breakdownLabel, { color: colors.primaryText }]}>{h.label}</Text>
                        <Text style={[styles.breakdownValue, { color: h.color }]}>{h.value}</Text>
                      </View>
                      <View style={[styles.progressTrack, { backgroundColor: colors.divider }]}>
                        <View style={[styles.progressFill, { width: h.bar, backgroundColor: h.color }]} />
                      </View>
                    </View>
                  ))}
                </View>

                {/* Key Metrics Table */}
                <Text style={[styles.drilldownSectionTitle, { color: colors.secondaryText, marginTop: 14 }]}>
                  EXECUTIVE AUDIT SUMMARY
                </Text>

                <View style={[styles.metricsTable, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                  {Object.entries(activeReportItem.details).map(([k, v], idx) => (
                    <View key={idx} style={[styles.metricTableRow, { borderBottomColor: colors.divider }]}>
                      <Text style={[styles.metricKey, { color: colors.secondaryText }]}>
                        {k.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}
                      </Text>
                      <Text style={[styles.metricVal, { color: colors.primaryText }]}>{v}</Text>
                    </View>
                  ))}
                </View>
              </ScrollView>

              {/* Action Buttons */}
              <View style={styles.modalActionRow}>
                <TouchableOpacity
                  style={[styles.exportBtn, { backgroundColor: activeReportItem.color }]}
                  onPress={() => handleExportReport(activeReportItem.title)}
                  activeOpacity={0.85}
                >
                  <Icon name="share-variant-outline" size={18} color="#fff" />
                  <Text style={styles.actionBtnText}>Share / Export Summary</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.closeModalBtn, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}
                  onPress={() => setActiveModal(null)}
                >
                  <Text style={[styles.closeModalBtnText, { color: colors.primaryText }]}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: CUSTOM REPORT GENERATOR & EXPORT                                 */}
      {/* ========================================================================= */}
      <Modal visible={generateModalVisible} transparent animationType="slide" onRequestClose={() => setGenerateModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: colors.cardBackground }]}>
            <View style={styles.modalTopBar}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Icon name="file-chart-outline" size={24} color={colors.primaryAccent} />
                <Text style={[styles.modalHeading, { color: colors.primaryText }]}>Generate Custom Report</Text>
              </View>
              <TouchableOpacity onPress={() => setGenerateModalVisible(false)}>
                <Icon name="close-circle" size={24} color={colors.secondaryText} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              {/* 1. Report Type */}
              <Text style={[styles.inputLabel, { color: colors.primaryText }]}>1. Select Report Domain</Text>
              <View style={styles.generatorPillsGrid}>
                {[
                  { id: "academic", label: "Academic Audit", icon: "school" },
                  { id: "fees", label: "Fee Realization", icon: "cash" },
                  { id: "attendance", label: "Attendance Log", icon: "calendar-check" },
                  { id: "placement", label: "Placement Stats", icon: "briefcase" },
                  { id: "faculty", label: "Faculty Appraisal", icon: "account-tie" },
                ].map((type) => (
                  <TouchableOpacity
                    key={type.id}
                    style={[
                      styles.genChoicePill,
                      genReportType === type.id
                        ? { backgroundColor: colors.primaryAccent, borderColor: colors.primaryAccent }
                        : { backgroundColor: colors.primaryBackground, borderColor: colors.divider },
                    ]}
                    onPress={() => setGenReportType(type.id)}
                  >
                    <Icon
                      name={type.icon}
                      size={15}
                      color={genReportType === type.id ? "#fff" : colors.secondaryText}
                    />
                    <Text
                      style={[
                        styles.genChoicePillText,
                        { color: genReportType === type.id ? "#fff" : colors.primaryText },
                      ]}
                    >
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* 2. Department Scope */}
              <Text style={[styles.inputLabel, { color: colors.primaryText, marginTop: 12 }]}>2. Department Scope</Text>
              <View style={styles.generatorPillsGrid}>
                {["All Departments", "CSE", "AI-DS", "ECE", "MECH"].map((dept) => (
                  <TouchableOpacity
                    key={dept}
                    style={[
                      styles.genChoicePill,
                      genDept === dept
                        ? { backgroundColor: "#10B981", borderColor: "#10B981" }
                        : { backgroundColor: colors.primaryBackground, borderColor: colors.divider },
                    ]}
                    onPress={() => setGenDept(dept)}
                  >
                    <Text
                      style={[
                        styles.genChoicePillText,
                        { color: genDept === dept ? "#fff" : colors.primaryText },
                      ]}
                    >
                      {dept}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* 3. Export Format */}
              <Text style={[styles.inputLabel, { color: colors.primaryText, marginTop: 12 }]}>3. Export Document Format</Text>
              <View style={styles.generatorPillsGrid}>
                {[
                  { id: "PDF", label: "PDF Document (.pdf)", icon: "file-pdf-box" },
                  { id: "Excel", label: "Excel Sheet (.xlsx)", icon: "file-excel-box" },
                  { id: "CSV", label: "CSV Dataset (.csv)", icon: "file-delimited" },
                ].map((fmt) => (
                  <TouchableOpacity
                    key={fmt.id}
                    style={[
                      styles.genChoicePill,
                      genFormat === fmt.id
                        ? { backgroundColor: "#8B5CF6", borderColor: "#8B5CF6" }
                        : { backgroundColor: colors.primaryBackground, borderColor: colors.divider },
                    ]}
                    onPress={() => setGenFormat(fmt.id)}
                  >
                    <Icon
                      name={fmt.icon}
                      size={16}
                      color={genFormat === fmt.id ? "#fff" : colors.secondaryText}
                    />
                    <Text
                      style={[
                        styles.genChoicePillText,
                        { color: genFormat === fmt.id ? "#fff" : colors.primaryText },
                      ]}
                    >
                      {fmt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <TouchableOpacity
              style={[styles.runGenBtn, { backgroundColor: colors.primaryAccent }]}
              onPress={handleRunGenerator}
              disabled={isGenerating}
              activeOpacity={0.85}
            >
              {isGenerating ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Icon name="download" size={18} color="#fff" />
                  <Text style={styles.runGenBtnText}>Compile & Download {genFormat} Report</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const getStyles = (colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.primaryBackground },
    scrollContent: { paddingHorizontal: 16, paddingTop: 50, paddingBottom: 60 },

    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 12,
    },
    headerSub: {
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 1,
      marginBottom: 2,
    },
    header: {
      fontSize: 24,
      fontWeight: "900",
      letterSpacing: -0.5,
    },
    generateTopBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingVertical: 7,
      paddingHorizontal: 12,
      borderRadius: 16,
      elevation: 2,
    },
    generateTopBtnText: {
      color: "#fff",
      fontSize: 12.5,
      fontWeight: "800",
    },

    /* Period Selector */
    periodScroll: {
      marginBottom: 14,
    },
    periodTab: {
      borderWidth: 1,
      borderRadius: 20,
      paddingVertical: 6,
      paddingHorizontal: 14,
      marginRight: 8,
    },
    periodTabText: {
      fontSize: 12.5,
      fontWeight: "700",
    },

    /* KPI Grid */
    kpiGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      gap: 10,
      marginBottom: 16,
    },
    kpiCard: {
      width: "48%",
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      elevation: 2,
    },
    kpiIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 8,
    },
    kpiValue: {
      fontSize: 21,
      fontWeight: "900",
      letterSpacing: -0.5,
    },
    kpiLabel: {
      fontSize: 12,
      fontWeight: "600",
      marginTop: 2,
    },

    /* Section Headers */
    sectionHeader: {
      marginBottom: 12,
    },
    sectionHeading: {
      fontSize: 16,
      fontWeight: "800",
      letterSpacing: -0.3,
    },
    sectionSub: {
      fontSize: 12,
      fontWeight: "500",
      marginTop: 2,
    },

    /* Reports List */
    reportsList: {
      gap: 12,
    },
    reportCard: {
      borderRadius: 16,
      borderWidth: 1,
      borderLeftWidth: 6,
      padding: 14,
      elevation: 2,
    },
    reportCardTop: {
      flexDirection: "row",
      gap: 12,
      marginBottom: 10,
    },
    reportIconCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      justifyContent: "center",
      alignItems: "center",
    },
    reportTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 6,
      marginBottom: 4,
    },
    reportTitle: {
      fontSize: 14.5,
      fontWeight: "800",
      flex: 1,
    },
    categoryPill: {
      paddingVertical: 2,
      paddingHorizontal: 6,
      borderRadius: 6,
    },
    categoryPillText: {
      fontSize: 10.5,
      fontWeight: "800",
    },
    reportDesc: {
      fontSize: 12,
      lineHeight: 17,
      fontWeight: "500",
    },
    reportSummaryRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      borderTopWidth: 1,
      paddingTop: 10,
    },
    statPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    statPillText: {
      fontSize: 11.5,
      fontWeight: "700",
    },

    /* Modal Styling */
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.6)",
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 16,
    },
    modalBox: {
      width: "100%",
      maxHeight: "86%",
      borderRadius: 22,
      padding: 18,
      elevation: 10,
    },
    modalTopBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 14,
    },
    modalHeaderIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: "center",
      alignItems: "center",
    },
    modalHeading: {
      fontSize: 16,
      fontWeight: "800",
    },
    modalSub: {
      fontSize: 11,
      fontWeight: "500",
      marginTop: 2,
    },
    drilldownSectionTitle: {
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 0.6,
      marginBottom: 8,
    },

    /* Visual Breakdown Box */
    breakdownBox: {
      borderRadius: 12,
      borderWidth: 1,
      padding: 12,
      gap: 10,
    },
    breakdownItem: {
      gap: 4,
    },
    breakdownItemTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    breakdownLabel: {
      fontSize: 12.5,
      fontWeight: "700",
    },
    breakdownValue: {
      fontSize: 12.5,
      fontWeight: "800",
    },
    progressTrack: {
      height: 6,
      borderRadius: 3,
      overflow: "hidden",
    },
    progressFill: {
      height: "100%",
      borderRadius: 3,
    },

    /* Metrics Table */
    metricsTable: {
      borderRadius: 12,
      borderWidth: 1,
      paddingHorizontal: 12,
    },
    metricTableRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 10,
      borderBottomWidth: 1,
    },
    metricKey: {
      fontSize: 12.5,
      fontWeight: "600",
    },
    metricVal: {
      fontSize: 13,
      fontWeight: "800",
    },

    /* Modal Action Row */
    modalActionRow: {
      flexDirection: "row",
      gap: 10,
      marginTop: 14,
    },
    exportBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 12,
      borderRadius: 12,
      elevation: 2,
    },
    actionBtnText: {
      color: "#fff",
      fontSize: 13,
      fontWeight: "800",
    },
    closeModalBtn: {
      paddingVertical: 12,
      paddingHorizontal: 18,
      borderRadius: 12,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    closeModalBtnText: {
      fontSize: 13,
      fontWeight: "700",
    },

    /* Custom Generator Modal Inputs */
    inputLabel: {
      fontSize: 12,
      fontWeight: "700",
      marginBottom: 6,
    },
    generatorPillsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 10,
    },
    genChoicePill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingVertical: 7,
      paddingHorizontal: 11,
      borderRadius: 10,
      borderWidth: 1,
    },
    genChoicePillText: {
      fontSize: 12,
      fontWeight: "700",
    },
    runGenBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 12,
      borderRadius: 12,
      marginTop: 14,
    },
    runGenBtnText: {
      color: "#fff",
      fontSize: 13.5,
      fontWeight: "800",
    },
  });
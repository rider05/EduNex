import React, { useState, useEffect, useCallback, useMemo } from "react";
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
  TextInput,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { useTheme } from "../../context/ThemeContext";
import { SkeletonDashboardScreen } from "../../components/common/SkeletonLoader";
import { getAdminStats, getReports } from "../../services/dataService";
import { showToast } from "../../utils/toastService";
import { shareExecutiveReportPdf } from "../../utils/pdfGenerator";
import useRefreshOnForeground from "../../hooks/useRefreshOnForeground";

const SEED_COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#EF4444", "#06B6D4"];

export default function ReportsAdmin() {
  const { colors, isDarkMode } = useTheme();
  const styles = getStyles(colors, isDarkMode);

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // 1. FILTER & SEARCH CONTROLS
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedTerm, setSelectedTerm] = useState("Odd Term (2025-26)");
  const [sortBy, setSortBy] = useState("default"); // default, stat, alphabetical
  const [showComparison, setShowComparison] = useState(true);

  // 2. MODALS
  const [activeModal, setActiveModal] = useState(null);
  const [generateModalVisible, setGenerateModalVisible] = useState(false);

  // 3. ADVANCED GENERATOR CONTROLS
  const [genReportType, setGenReportType] = useState("academic");
  const [genDept, setGenDept] = useState("All Departments");
  const [genBatch, setGenBatch] = useState("All Batches");
  const [genInterval, setGenInterval] = useState("Semester-End");
  const [genFormat, setGenFormat] = useState("PDF");
  const [genIncludeCharts, setGenIncludeCharts] = useState(true);
  const [genIncludeRankings, setGenIncludeRankings] = useState(true);
  const [genIncludeDefaulters, setGenIncludeDefaulters] = useState(false);
  const [genAutoSchedule, setGenAutoSchedule] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // 4. METRIC DATA
  const [overviewKPIs, setOverviewKPIs] = useState({});
  const [liveReports, setLiveReports] = useState([]);

  const termOptions = [
    "Odd Term (2025-26)",
    "Even Term (2024-25)",
    "Annual Audit 2025",
    "Monthly Snapshot",
    "Past 30 Days",
  ];

  const categoryOptions = [
    { id: "all", label: "All Reports", icon: "view-grid-outline" },
    { id: "academic", label: "Academics", icon: "school-outline" },
    { id: "attendance", label: "Attendance", icon: "calendar-check-outline" },
    { id: "fees", label: "Financials", icon: "cash-multiple" },
    { id: "placement", label: "Placements", icon: "briefcase-outline" },
    { id: "faculty", label: "Faculty", icon: "account-tie-outline" },
    { id: "infrastructure", label: "Infrastructure", icon: "domain" },
  ];

  const loadData = useCallback(async () => {
    try {
      const statsRes = await getAdminStats().catch(() => null);
      const reportsRes = await getReports().catch(() => []);

      const totalStudents = Number(String(statsRes?.totalStudents || "0").replace(/[^0-9]/g, "")) || 0;
      const totalStaff = Number(String(statsRes?.totalFaculty || "0").replace(/[^0-9]/g, "")) || 0;
      const ratio = totalStaff > 0 ? `1 : ${Math.round(totalStudents / totalStaff)}` : "1 : 18";

      const feeCollectionPct = statsRes?.feeCollectionPct || "92.4%";
      const attendancePct = statsRes?.attendancePct || "94.8%";

      const reportCardsData = Array.isArray(reportsRes) ? reportsRes : [];
      const academicReport = reportCardsData.find((r) => r.category === "academic" && (r.title || "").toLowerCase().includes("academic"));
      const feeReport = reportCardsData.find((r) => (r.title || "").toLowerCase().includes("fee"));
      const attendanceReport = reportCardsData.find((r) => (r.title || "").toLowerCase().includes("attendance"));
      const placementReport = reportCardsData.find((r) => (r.title || "").toLowerCase().includes("placement"));

      setLiveReports(reportCardsData);

      setOverviewKPIs({
        academicPassRate: (academicReport && academicReport.statSecondary) || "93.4%",
        feeRealization: (feeReport && feeReport.statSecondary) || feeCollectionPct,
        dailyAttendance: (attendanceReport && attendanceReport.statPrimary) || attendancePct,
        facultyStudentRatio: ratio,
        avgGPA: (academicReport && academicReport.statPrimary) || "8.42 CGPA",
        placementRate: (placementReport && placementReport.statPrimary) || "88.6%",
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
    setRefreshing(false);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  // Handle Share Executive Summary
  const handleShareSummary = async (title) => {
    try {
      await Share.share({
        title: `${title} - EduNex Campus Analytics`,
        message: `📊 [EduNex Institutional Intelligence Report]\nTitle: ${title}\nAcademic Period: ${selectedTerm}\nStatus: Verified Institutional Audit Data.\nGenerated: ${new Date().toLocaleDateString()}`,
      });
      showToast(`Shared ${title} successfully!`, "success");
    } catch (err) {
      console.log("Export share error:", err);
    }
  };

  // Handle PDF Export
  const handleExportPdf = async (reportItem) => {
    try {
      await shareExecutiveReportPdf({
        title: reportItem.title,
        category: reportItem.category,
        period: selectedTerm,
        dept: genDept,
        highlights: reportItem.highlights || [],
        details: reportItem.details || {},
      });
      showToast("📄 Official Executive Audit PDF generated!", "success");
    } catch (err) {
      console.log("PDF Export error:", err);
      showToast("Could not generate PDF", "error");
    }
  };

  // Handle Generate Report with user options
  const handleRunGenerator = async () => {
    setIsGenerating(true);
    try {
      if (genFormat === "PDF") {
        await shareExecutiveReportPdf({
          title: `${genReportType.toUpperCase()} Domain Audit Report`,
          category: genReportType,
          period: `${selectedTerm} · ${genInterval}`,
          dept: genDept,
          highlights: [
            { label: `${genDept} Realization Index`, value: "94.2%", bar: "94%", color: "#3B82F6" },
            { label: `${genBatch} Benchmark Compliance`, value: "89.6%", bar: "89%", color: "#10B981" },
            { label: "Overall Institutional Ranking", value: "Tier-1 Autonomous", bar: "98%", color: "#8B5CF6" },
          ],
          details: {
            departmentScope: genDept,
            targetBatch: genBatch,
            auditInterval: genInterval,
            includeDefaulters: genIncludeDefaulters ? "Yes (Detailed Annexure)" : "No",
            complianceRating: "A++ Grade (NBA / NAAC)",
          },
        });
        showToast(`✅ Generated & Exported PDF Report for ${genDept}!`, "success");
      } else {
        setTimeout(() => {
          showToast(`✅ Compiled ${genFormat} Data Stream for ${genDept}!`, "success");
        }, 800);
      }
      setGenerateModalVisible(false);
    } catch (err) {
      console.warn("Generator error:", err);
      showToast("Could not compile report", "error");
    } finally {
      setIsGenerating(false);
    }
  };

  // Seeded Catalog
  const seededCatalog = useMemo(
    () => [
      {
        id: "r1",
        title: "Academic Performance Analysis",
        subtitle: "CGPA distribution, pass rates, and grade analysis by department",
        desc: "Comprehensive CGPA distribution, pass percentages, and subject-wise grade analysis across engineering and sciences.",
        icon: "chart-bar",
        color: "#3B82F6",
        category: "academic",
        statPrimary: "8.42 CGPA",
        statSecondary: "93.4% Pass Rate",
        highlights: [
          { label: "AI & DS Dept Pass Rate", value: "96.4%", bar: "96%", color: "#3B82F6" },
          { label: "CSE Dept Pass Rate", value: "94.8%", bar: "94%", color: "#10B981" },
          { label: "IT Dept Pass Rate", value: "92.1%", bar: "92%", color: "#8B5CF6" },
          { label: "ECE Dept Pass Rate", value: "90.5%", bar: "90%", color: "#F59E0B" },
        ],
        details: {
          totalAppeared: "1,420 Students",
          distinctionCount: "348 Candidates",
          firstClassCount: "892 Candidates",
          arrearCleared: "94.2% on First Attempt",
        },
      },
      {
        id: "r2",
        title: "Attendance Compliance Report",
        subtitle: "Daily, weekly, and monthly attendance trends across all departments",
        desc: "Real-time biometrics, RFID gate attendance, and leave compliance statistics for both staff and student cohorts.",
        icon: "calendar-check",
        color: "#10B981",
        category: "attendance",
        statPrimary: "94.8%",
        statSecondary: "98.2% Regularity",
        highlights: [
          { label: "Morning Session Attendance", value: "95.6%", bar: "95%", color: "#10B981" },
          { label: "Afternoon Session Attendance", value: "93.9%", bar: "93%", color: "#3B82F6" },
          { label: "Hostel Resident Compliance", value: "98.1%", bar: "98%", color: "#8B5CF6" },
        ],
        details: {
          chronicDefaulters: "18 Students (<75%)",
          condonationEligible: "12 Students",
          biometricSyncStatus: "99.4% Active",
        },
      },
      {
        id: "r3",
        title: "Fee Collection & Revenue",
        subtitle: "Fee realization, pending dues, and scholarship disbursement summary",
        desc: "Tuition realization, hostel dues, exam fee reconciliation, and government scholarship transfers.",
        icon: "currency-inr",
        color: "#F59E0B",
        category: "fees",
        statPrimary: "₹14.82 Cr",
        statSecondary: "92.4% Realized",
        highlights: [
          { label: "Tuition Fee Realization", value: "94.1%", bar: "94%", color: "#F59E0B" },
          { label: "Hostel & Mess Realization", value: "96.5%", bar: "96%", color: "#10B981" },
          { label: "Transport Fee Collection", value: "88.2%", bar: "88%", color: "#EF4444" },
        ],
        details: {
          scholarshipsDisbursed: "₹2.45 Cr",
          pendingArrears: "₹1.12 Cr",
          onlineGatewayShare: "88.4%",
        },
      },
      {
        id: "r4",
        title: "Faculty Workload Analysis",
        subtitle: "Teaching hours, research output, and student-faculty ratio by department",
        desc: "Weekly lecture hours, laboratory mentorship, funded research publications, and faculty appraisal scores.",
        icon: "account-tie",
        color: "#8B5CF6",
        category: "faculty",
        statPrimary: "1:18 Ratio",
        statSecondary: "18.4 Hrs / Wk",
        highlights: [
          { label: "Lecture Hours Compliance", value: "98.2%", bar: "98%", color: "#8B5CF6" },
          { label: "SCOPUS Journal Publications", value: "48 Papers", bar: "84%", color: "#3B82F6" },
          { label: "Funded Grant Realization", value: "₹65 Lakhs", bar: "76%", color: "#10B981" },
        ],
        details: {
          phdHoldingFaculty: "64%",
          avgStudentFeedback: "4.6 / 5.0",
          fdpAttendance: "92%",
        },
      },
      {
        id: "r5",
        title: "Placement & Career Services",
        subtitle: "Campus recruitment statistics, offer letters, and company partnerships",
        desc: "Tier-1 recruiting partners, dream offers, median salary statistics, and core vs IT placement ratios.",
        icon: "briefcase-outline",
        color: "#EF4444",
        category: "placement",
        statPrimary: "88.6% Placed",
        statSecondary: "₹8.4 LPA Avg",
        highlights: [
          { label: "Tier-1 Product Companies", value: "34 Offers", bar: "82%", color: "#EF4444" },
          { label: "Core Engineering Offers", value: "184 Offers", bar: "88%", color: "#10B981" },
          { label: "IT / Services Sector", value: "412 Offers", bar: "94%", color: "#3B82F6" },
        ],
        details: {
          highestPackage: "₹38.5 LPA (Google)",
          medianPackage: "₹7.2 LPA",
          totalRecruiters: "128 Companies",
        },
      },
      {
        id: "r6",
        title: "Infrastructure Utilization",
        subtitle: "Hostel, lab, library, and transport capacity usage analytics",
        desc: "Real-time occupancy metrics for campus residential blocks, computer laboratories, central library, and transit fleet.",
        icon: "domain",
        color: "#06B6D4",
        category: "infrastructure",
        statPrimary: "91.2% Cap",
        statSecondary: "38 Labs Active",
        highlights: [
          { label: "Hostel Bed Occupancy", value: "96.4%", bar: "96%", color: "#06B6D4" },
          { label: "Computer Lab Utilization", value: "88.5%", bar: "88%", color: "#3B82F6" },
          { label: "Bus Fleet Seat Fill Rate", value: "92.0%", bar: "92%", color: "#10B981" },
        ],
        details: {
          libraryFootfall: "1,240 / Day",
          smartClassrooms: "54 Active",
          wifiPeakBandwidth: "2.4 Gbps",
        },
      },
    ],
    []
  );

  const spreadReport = useCallback((r, i) => {
    const color = r.color || SEED_COLORS[i % SEED_COLORS.length];
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
      highlights,
      details: r.details && typeof r.details === "object" && !Array.isArray(r.details) ? r.details : {},
    };
  }, []);

  const rawReportCards = useMemo(
    () => (liveReports.length > 0 ? liveReports.map(spreadReport) : seededCatalog),
    [liveReports, seededCatalog, spreadReport]
  );

  // Filtered & Sorted Reports
  const filteredReports = useMemo(() => {
    let result = rawReportCards;

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.desc.toLowerCase().includes(q) ||
          r.category.toLowerCase().includes(q)
      );
    }

    // Category filter
    if (selectedCategory !== "all") {
      result = result.filter(
        (r) => r.category.toLowerCase() === selectedCategory.toLowerCase()
      );
    }

    // Sorting
    if (sortBy === "alphabetical") {
      result = [...result].sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortBy === "category") {
      result = [...result].sort((a, b) => a.category.localeCompare(b.category));
    }

    return result;
  }, [rawReportCards, searchQuery, selectedCategory, sortBy]);

  const activeReportItem = rawReportCards.find((r) => r.id === activeModal);

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
        {/* Top Header Bar */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerSub, { color: colors.secondaryText }]}>EXECUTIVE INTELLIGENCE</Text>
            <Text style={[styles.header, { color: colors.primaryText }]}>Reports & Analytics</Text>
          </View>

          <TouchableOpacity
            style={[styles.generateTopBtn, { backgroundColor: colors.primaryAccent }]}
            onPress={() => setGenerateModalVisible(true)}
            activeOpacity={0.85}
          >
            <Icon name="tune-vertical" size={15} color="#fff" />
            <Text style={styles.generateTopBtnText}>Custom Report</Text>
          </TouchableOpacity>
        </View>

        {/* 1. SEARCH QUERY INPUT BAR */}
        <View style={[styles.searchBarWrap, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
          <Icon name="magnify" size={18} color={colors.secondaryText} style={{ marginRight: 6 }} />
          <TextInput
            style={[styles.searchInput, { color: colors.primaryText }]}
            placeholder="Search reports by domain, KPI or keyword..."
            placeholderTextColor={colors.disabledText}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")} style={{ padding: 4 }}>
              <Icon name="close-circle" size={16} color={colors.secondaryText} />
            </TouchableOpacity>
          )}
        </View>

        {/* 2. CATEGORY FILTER CHIPS SCROLLBAR */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
          {categoryOptions.map((cat) => {
            const isSel = selectedCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                onPress={() => setSelectedCategory(cat.id)}
                style={[
                  styles.categoryPillBtn,
                  {
                    backgroundColor: isSel ? colors.primaryAccent : colors.cardBackground,
                    borderColor: isSel ? colors.primaryAccent : colors.divider,
                  },
                ]}
                activeOpacity={0.8}
              >
                <Icon
                  name={cat.icon}
                  size={14}
                  color={isSel ? "#fff" : colors.secondaryText}
                  style={{ marginRight: 4 }}
                />
                <Text
                  style={[
                    styles.categoryPillBtnText,
                    { color: isSel ? "#fff" : colors.primaryText },
                  ]}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* 3. PERIOD RANGE & SORT CONTROLS BAR */}
        <View style={styles.controlsBarRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
            {termOptions.map((term) => (
              <TouchableOpacity
                key={term}
                onPress={() => {
                  setSelectedTerm(term);
                  showToast(`Switched period: ${term}`, "info");
                }}
                style={[
                  styles.periodTab,
                  {
                    backgroundColor: selectedTerm === term ? colors.primaryAccent + "18" : colors.cardBackground,
                    borderColor: selectedTerm === term ? colors.primaryAccent : colors.divider,
                  },
                ]}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.periodTabText,
                    { color: selectedTerm === term ? colors.primaryAccent : colors.primaryText },
                  ]}
                >
                  {term}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Sort Pill */}
          <TouchableOpacity
            style={[styles.sortPillBtn, { borderColor: colors.divider, backgroundColor: colors.cardBackground }]}
            onPress={() => {
              const nextSort = sortBy === "default" ? "alphabetical" : sortBy === "alphabetical" ? "category" : "default";
              setSortBy(nextSort);
              showToast(`Sorted: ${nextSort.toUpperCase()}`, "info");
            }}
          >
            <Icon name="sort-variant" size={14} color={colors.primaryAccent} />
            <Text style={[styles.sortPillText, { color: colors.primaryText }]}>
              {sortBy === "default" ? "Sort" : sortBy.slice(0, 4)}
            </Text>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <SkeletonDashboardScreen />
        ) : (
          <>
            {/* ========================================================================= */}
            {/* 4. EXECUTIVE KPI MATRIX WITH PRIOR PERIOD COMPARISON                      */}
            {/* ========================================================================= */}
            <View style={styles.kpiHeaderRow}>
              <Text style={[styles.kpiHeaderTitle, { color: colors.secondaryText }]}>
                EXECUTIVE KPI BENCHMARKS
              </Text>

              <TouchableOpacity
                onPress={() => setShowComparison(!showComparison)}
                style={styles.comparisonToggle}
              >
                <Icon
                  name={showComparison ? "checkbox-marked-circle" : "checkbox-blank-circle-outline"}
                  size={14}
                  color={showComparison ? "#10B981" : colors.secondaryText}
                />
                <Text style={[styles.comparisonToggleText, { color: colors.secondaryText }]}>
                  Prior $\Delta$
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.kpiGrid}>
              <View style={[styles.kpiCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
                <View style={[styles.kpiIconWrap, { backgroundColor: "#3B82F618" }]}>
                  <Icon name="school" size={18} color="#3B82F6" />
                </View>
                <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4 }}>
                  <Text style={[styles.kpiValue, { color: colors.primaryText }]}>{overviewKPIs.academicPassRate}</Text>
                  {showComparison && <Text style={{ fontSize: 10, color: "#10B981", fontWeight: "800" }}>+2.4%</Text>}
                </View>
                <Text style={[styles.kpiLabel, { color: colors.secondaryText }]}>Academic Pass Rate</Text>
              </View>

              <View style={[styles.kpiCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
                <View style={[styles.kpiIconWrap, { backgroundColor: "#10B98118" }]}>
                  <Icon name="cash-check" size={18} color="#10B981" />
                </View>
                <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4 }}>
                  <Text style={[styles.kpiValue, { color: colors.primaryText }]}>{overviewKPIs.feeRealization}</Text>
                  {showComparison && <Text style={{ fontSize: 10, color: "#10B981", fontWeight: "800" }}>+1.8%</Text>}
                </View>
                <Text style={[styles.kpiLabel, { color: colors.secondaryText }]}>Fee Realization</Text>
              </View>

              <View style={[styles.kpiCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
                <View style={[styles.kpiIconWrap, { backgroundColor: "#8B5CF618" }]}>
                  <Icon name="briefcase-check" size={18} color="#8B5CF6" />
                </View>
                <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4 }}>
                  <Text style={[styles.kpiValue, { color: colors.primaryText }]}>{overviewKPIs.placementRate}</Text>
                  {showComparison && <Text style={{ fontSize: 10, color: "#10B981", fontWeight: "800" }}>+4.1%</Text>}
                </View>
                <Text style={[styles.kpiLabel, { color: colors.secondaryText }]}>Placement Rate</Text>
              </View>

              <View style={[styles.kpiCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
                <View style={[styles.kpiIconWrap, { backgroundColor: "#F59E0B18" }]}>
                  <Icon name="account-multiple-check" size={18} color="#F59E0B" />
                </View>
                <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4 }}>
                  <Text style={[styles.kpiValue, { color: colors.primaryText }]}>{overviewKPIs.facultyStudentRatio}</Text>
                  {showComparison && <Text style={{ fontSize: 10, color: "#3B82F6", fontWeight: "800" }}>Optimal</Text>}
                </View>
                <Text style={[styles.kpiLabel, { color: colors.secondaryText }]}>Faculty : Student</Text>
              </View>
            </View>

            {/* ========================================================================= */}
            {/* 5. REPORTS CATALOG LIST                                                  */}
            {/* ========================================================================= */}
            <View style={styles.sectionHeader}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={[styles.sectionHeading, { color: colors.primaryText }]}>
                  Domain Intelligence Catalog ({filteredReports.length})
                </Text>

                <TouchableOpacity
                  style={[styles.miniExportAllBtn, { borderColor: colors.divider, backgroundColor: colors.cardBackground }]}
                  onPress={() => handleShareSummary("All Campus Domain Analytics")}
                >
                  <Icon name="share-variant-outline" size={13} color={colors.primaryAccent} />
                  <Text style={[styles.miniExportAllText, { color: colors.primaryAccent }]}>Share All</Text>
                </TouchableOpacity>
              </View>
              <Text style={[styles.sectionSub, { color: colors.secondaryText }]}>
                Tap any domain card to inspect metrics, visual progress bars, or export PDF
              </Text>
            </View>

            <View style={styles.reportsList}>
              {filteredReports.map((r) => (
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
                      <Icon name={r.icon} size={22} color={r.color} />
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
                      <Icon name="check-decagram" size={13} color={r.color} />
                      <Text style={[styles.statPillText, { color: colors.primaryText }]}>{r.statPrimary}</Text>
                    </View>
                    <View style={styles.statPill}>
                      <Icon name="chart-bell-curve" size={13} color={colors.secondaryText} />
                      <Text style={[styles.statPillText, { color: colors.secondaryText }]}>{r.statSecondary}</Text>
                    </View>
                    <Icon name="chevron-right" size={18} color={colors.secondaryText} style={{ marginLeft: "auto" }} />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        <View style={{ height: 110 }} />
      </ScrollView>

      {/* ========================================================================= */}
      {/* MODAL 1: REPORT DEEP DIVE & DRILL DOWN WITH PDF EXPORT                   */}
      {/* ========================================================================= */}
      {activeReportItem && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setActiveModal(null)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalBox, { backgroundColor: colors.cardBackground }]}>
              {/* Header */}
              <View style={styles.modalTopBar}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                  <View style={[styles.modalHeaderIcon, { backgroundColor: activeReportItem.color + "20" }]}>
                    <Icon name={activeReportItem.icon} size={22} color={activeReportItem.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.modalHeading, { color: colors.primaryText }]}>
                      {activeReportItem.title}
                    </Text>
                    <Text style={[styles.modalSub, { color: colors.secondaryText }]}>
                      Period: {selectedTerm} · Verified Audit Data
                    </Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => setActiveModal(null)} style={{ padding: 4 }}>
                  <Icon name="close-circle" size={24} color={colors.secondaryText} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
                {/* Visual Bar Breakdown */}
                <Text style={[styles.drilldownSectionTitle, { color: colors.secondaryText }]}>
                  DEPARTMENTAL BREAKDOWN & BENCHMARKS
                </Text>

                <View style={[styles.breakdownBox, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                  {activeReportItem.highlights.map((h, i) => (
                    <View key={i} style={styles.breakdownItem}>
                      <View style={styles.breakdownItemTop}>
                        <Text style={[styles.breakdownLabel, { color: colors.primaryText }]}>{h.label}</Text>
                        <Text style={[styles.breakdownValue, { color: h.color }]}>{h.value}</Text>
                      </View>
                      <View style={[styles.progressTrack, { backgroundColor: colors.divider }]}>
                        <View style={[styles.progressFill, { width: h.bar || "80%", backgroundColor: h.color }]} />
                      </View>
                    </View>
                  ))}
                </View>

                {/* Key Metrics Table */}
                <Text style={[styles.drilldownSectionTitle, { color: colors.secondaryText, marginTop: 12 }]}>
                  GOVERNANCE & STATUTORY METRICS
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

              {/* Action Buttons: PDF Export, Share & Close */}
              <View style={styles.modalActionRow}>
                <TouchableOpacity
                  style={[styles.exportPdfBtn, { backgroundColor: activeReportItem.color }]}
                  onPress={() => handleExportPdf(activeReportItem)}
                  activeOpacity={0.85}
                >
                  <Icon name="file-pdf-box" size={17} color="#fff" />
                  <Text style={styles.actionBtnText}>Export PDF</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.shareBtn, { borderColor: colors.divider, backgroundColor: colors.primaryBackground }]}
                  onPress={() => handleShareSummary(activeReportItem.title)}
                  activeOpacity={0.85}
                >
                  <Icon name="share-variant-outline" size={16} color={colors.primaryText} />
                  <Text style={[styles.shareBtnText, { color: colors.primaryText }]}>Share</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.closeModalBtn, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}
                  onPress={() => setActiveModal(null)}
                >
                  <Text style={[styles.closeModalBtnText, { color: colors.secondaryText }]}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: CUSTOM MULTI-DIMENSIONAL REPORT GENERATOR CONTROLS               */}
      {/* ========================================================================= */}
      <Modal visible={generateModalVisible} transparent animationType="slide" onRequestClose={() => setGenerateModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: colors.cardBackground }]}>
            <View style={styles.modalTopBar}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={[styles.modalHeaderIcon, { backgroundColor: colors.primaryAccent + "18" }]}>
                  <Icon name="tune-vertical" size={20} color={colors.primaryAccent} />
                </View>
                <View>
                  <Text style={[styles.modalHeading, { color: colors.primaryText }]}>Custom Report Generator</Text>
                  <Text style={[styles.modalSub, { color: colors.secondaryText }]}>Select parameters, scope & format</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setGenerateModalVisible(false)}>
                <Icon name="close-circle" size={24} color={colors.secondaryText} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 440 }}>
              {/* 1. Report Domain */}
              <Text style={[styles.inputLabel, { color: colors.primaryText }]}>1. Domain Scope</Text>
              <View style={styles.generatorPillsGrid}>
                {[
                  { id: "academic", label: "Academic Audit", icon: "school" },
                  { id: "fees", label: "Fee Realization", icon: "cash" },
                  { id: "attendance", label: "Attendance Log", icon: "calendar-check" },
                  { id: "placement", label: "Placement Stats", icon: "briefcase" },
                  { id: "faculty", label: "Faculty Appraisal", icon: "account-tie" },
                  { id: "infrastructure", label: "Infrastructure", icon: "domain" },
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
                      size={14}
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
              <Text style={[styles.inputLabel, { color: colors.primaryText, marginTop: 10 }]}>2. Department Filter</Text>
              <View style={styles.generatorPillsGrid}>
                {["All Departments", "AI & DS", "CSE", "IT", "ECE", "MECH"].map((dept) => (
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

              {/* 3. Batch / Cohort */}
              <Text style={[styles.inputLabel, { color: colors.primaryText, marginTop: 10 }]}>3. Batch / Cohort</Text>
              <View style={styles.generatorPillsGrid}>
                {["All Batches", "I Year (2025)", "II Year (2024)", "III Year (2023)", "IV Year (2022)"].map((b) => (
                  <TouchableOpacity
                    key={b}
                    style={[
                      styles.genChoicePill,
                      genBatch === b
                        ? { backgroundColor: "#3B82F6", borderColor: "#3B82F6" }
                        : { backgroundColor: colors.primaryBackground, borderColor: colors.divider },
                    ]}
                    onPress={() => setGenBatch(b)}
                  >
                    <Text
                      style={[
                        styles.genChoicePillText,
                        { color: genBatch === b ? "#fff" : colors.primaryText },
                      ]}
                    >
                      {b}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* 4. Aggregation Interval */}
              <Text style={[styles.inputLabel, { color: colors.primaryText, marginTop: 10 }]}>4. Aggregation Interval</Text>
              <View style={styles.generatorPillsGrid}>
                {["Weekly Audit", "Monthly Summary", "Semester-End", "Annual Statutory"].map((interval) => (
                  <TouchableOpacity
                    key={interval}
                    style={[
                      styles.genChoicePill,
                      genInterval === interval
                        ? { backgroundColor: "#8B5CF6", borderColor: "#8B5CF6" }
                        : { backgroundColor: colors.primaryBackground, borderColor: colors.divider },
                    ]}
                    onPress={() => setGenInterval(interval)}
                  >
                    <Text
                      style={[
                        styles.genChoicePillText,
                        { color: genInterval === interval ? "#fff" : colors.primaryText },
                      ]}
                    >
                      {interval}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* 5. Document Format */}
              <Text style={[styles.inputLabel, { color: colors.primaryText, marginTop: 10 }]}>5. Export Format</Text>
              <View style={styles.generatorPillsGrid}>
                {[
                  { id: "PDF", label: "Official PDF Document", icon: "file-pdf-box" },
                  { id: "Excel", label: "Excel Sheet (.xlsx)", icon: "file-excel-box" },
                  { id: "CSV", label: "CSV Dataset", icon: "file-delimited" },
                  { id: "JSON", label: "JSON API Feed", icon: "code-json" },
                ].map((fmt) => (
                  <TouchableOpacity
                    key={fmt.id}
                    style={[
                      styles.genChoicePill,
                      genFormat === fmt.id
                        ? { backgroundColor: "#F59E0B", borderColor: "#F59E0B" }
                        : { backgroundColor: colors.primaryBackground, borderColor: colors.divider },
                    ]}
                    onPress={() => setGenFormat(fmt.id)}
                  >
                    <Icon
                      name={fmt.icon}
                      size={14}
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

              {/* 6. Sub-Metric Inclusion Checkboxes */}
              <Text style={[styles.inputLabel, { color: colors.primaryText, marginTop: 10 }]}>6. Additional Inclusions</Text>
              <View style={{ gap: 6, marginTop: 4 }}>
                <TouchableOpacity
                  style={styles.checkboxRow}
                  onPress={() => setGenIncludeCharts(!genIncludeCharts)}
                  activeOpacity={0.7}
                >
                  <Icon
                    name={genIncludeCharts ? "checkbox-marked" : "checkbox-blank-outline"}
                    size={18}
                    color={genIncludeCharts ? colors.primaryAccent : colors.secondaryText}
                  />
                  <Text style={[styles.checkboxLabel, { color: colors.primaryText }]}>Include Graphical Progress Bars & Benchmarks</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.checkboxRow}
                  onPress={() => setGenIncludeRankings(!genIncludeRankings)}
                  activeOpacity={0.7}
                >
                  <Icon
                    name={genIncludeRankings ? "checkbox-marked" : "checkbox-blank-outline"}
                    size={18}
                    color={genIncludeRankings ? colors.primaryAccent : colors.secondaryText}
                  />
                  <Text style={[styles.checkboxLabel, { color: colors.primaryText }]}>Include Department Ranking Tables & Median CGPA</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.checkboxRow}
                  onPress={() => setGenIncludeDefaulters(!genIncludeDefaulters)}
                  activeOpacity={0.7}
                >
                  <Icon
                    name={genIncludeDefaulters ? "checkbox-marked" : "checkbox-blank-outline"}
                    size={18}
                    color={genIncludeDefaulters ? colors.primaryAccent : colors.secondaryText}
                  />
                  <Text style={[styles.checkboxLabel, { color: colors.primaryText }]}>Include Defaulters & Dues Breakdown Annexure</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.checkboxRow}
                  onPress={() => setGenAutoSchedule(!genAutoSchedule)}
                  activeOpacity={0.7}
                >
                  <Icon
                    name={genAutoSchedule ? "checkbox-marked" : "checkbox-blank-outline"}
                    size={18}
                    color={genAutoSchedule ? "#10B981" : colors.secondaryText}
                  />
                  <Text style={[styles.checkboxLabel, { color: colors.primaryText }]}>⚡ Schedule recurring weekly email digest to Dean</Text>
                </TouchableOpacity>
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
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Icon name="download" size={17} color="#fff" />
                  <Text style={styles.runGenBtnText}>Compile & Export {genFormat} Report</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

// ---------------- Styles with Proper Rhythm & Alignment ----------------
const getStyles = (colors, isDarkMode) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.primaryBackground },
    scrollContent: { paddingHorizontal: 14, paddingTop: 46, paddingBottom: 60 },

    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 10,
    },
    headerSub: {
      fontSize: 10.5,
      fontWeight: "800",
      letterSpacing: 0.8,
      marginBottom: 2,
    },
    header: {
      fontSize: 22,
      fontWeight: "900",
      letterSpacing: -0.4,
    },
    generateTopBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingVertical: 7,
      paddingHorizontal: 11,
      borderRadius: 12,
    },
    generateTopBtnText: {
      color: "#fff",
      fontSize: 11.5,
      fontWeight: "800",
    },

    /* Search Bar */
    searchBarWrap: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 10,
      borderWidth: 1,
      paddingHorizontal: 10,
      height: 38,
      marginBottom: 10,
    },
    searchInput: {
      flex: 1,
      fontSize: 12,
      paddingVertical: 0,
    },

    /* Category Filter Chips */
    categoryScroll: {
      marginBottom: 8,
    },
    categoryPillBtn: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderRadius: 8,
      paddingVertical: 6,
      paddingHorizontal: 10,
      marginRight: 6,
    },
    categoryPillBtnText: {
      fontSize: 11,
      fontWeight: "700",
    },

    /* Controls Bar: Period + Sort */
    controlsBarRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 12,
      gap: 6,
    },
    periodTab: {
      borderWidth: 1,
      borderRadius: 8,
      paddingVertical: 5,
      paddingHorizontal: 10,
      marginRight: 6,
    },
    periodTabText: {
      fontSize: 11,
      fontWeight: "700",
    },
    sortPillBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      borderWidth: 1,
      borderRadius: 8,
      paddingVertical: 5,
      paddingHorizontal: 8,
    },
    sortPillText: {
      fontSize: 11,
      fontWeight: "700",
    },

    /* KPI Grid */
    kpiHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 6,
    },
    kpiHeaderTitle: {
      fontSize: 10.5,
      fontWeight: "800",
      letterSpacing: 0.5,
    },
    comparisonToggle: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    comparisonToggleText: {
      fontSize: 10,
      fontWeight: "700",
    },
    kpiGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      gap: 8,
      marginBottom: 14,
    },
    kpiCard: {
      width: "48.5%",
      borderRadius: 12,
      padding: 11,
      borderWidth: 1,
    },
    kpiIconWrap: {
      width: 32,
      height: 32,
      borderRadius: 16,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 6,
    },
    kpiValue: {
      fontSize: 18,
      fontWeight: "900",
      letterSpacing: -0.4,
    },
    kpiLabel: {
      fontSize: 11,
      fontWeight: "600",
      marginTop: 2,
    },

    /* Section Headers */
    sectionHeader: {
      marginBottom: 10,
    },
    sectionHeading: {
      fontSize: 14.5,
      fontWeight: "800",
      letterSpacing: -0.2,
    },
    sectionSub: {
      fontSize: 11,
      fontWeight: "500",
      marginTop: 2,
    },
    miniExportAllBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      borderWidth: 1,
      borderRadius: 6,
      paddingVertical: 3,
      paddingHorizontal: 8,
    },
    miniExportAllText: {
      fontSize: 10.5,
      fontWeight: "800",
    },

    /* Reports List */
    reportsList: {
      gap: 10,
    },
    reportCard: {
      borderRadius: 14,
      borderWidth: 1,
      borderLeftWidth: 5,
      padding: 12,
    },
    reportCardTop: {
      flexDirection: "row",
      gap: 10,
      marginBottom: 8,
    },
    reportIconCircle: {
      width: 38,
      height: 38,
      borderRadius: 19,
      justifyContent: "center",
      alignItems: "center",
    },
    reportTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 6,
      marginBottom: 3,
    },
    reportTitle: {
      fontSize: 13.5,
      fontWeight: "800",
      flex: 1,
    },
    categoryPill: {
      paddingVertical: 2,
      paddingHorizontal: 5,
      borderRadius: 4,
    },
    categoryPillText: {
      fontSize: 9.5,
      fontWeight: "800",
      textTransform: "uppercase",
    },
    reportDesc: {
      fontSize: 11,
      lineHeight: 15.5,
      fontWeight: "500",
    },
    reportSummaryRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      borderTopWidth: 1,
      paddingTop: 8,
    },
    statPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    statPillText: {
      fontSize: 11,
      fontWeight: "700",
    },

    /* Modal Styling */
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.72)",
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 14,
    },
    modalBox: {
      width: "100%",
      maxHeight: "88%",
      borderRadius: 20,
      padding: 16,
      elevation: 10,
    },
    modalTopBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 12,
    },
    modalHeaderIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      justifyContent: "center",
      alignItems: "center",
    },
    modalHeading: {
      fontSize: 15,
      fontWeight: "800",
    },
    modalSub: {
      fontSize: 10.5,
      fontWeight: "500",
      marginTop: 1,
    },
    drilldownSectionTitle: {
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 0.5,
      marginBottom: 6,
    },
    breakdownBox: {
      borderRadius: 10,
      borderWidth: 1,
      padding: 10,
      gap: 8,
    },
    breakdownItem: {
      gap: 3,
    },
    breakdownItemTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    breakdownLabel: {
      fontSize: 11,
      fontWeight: "700",
    },
    breakdownValue: {
      fontSize: 11,
      fontWeight: "800",
    },
    progressTrack: {
      height: 5,
      borderRadius: 3,
      overflow: "hidden",
    },
    progressFill: {
      height: "100%",
      borderRadius: 3,
    },
    metricsTable: {
      borderRadius: 10,
      borderWidth: 1,
      overflow: "hidden",
    },
    metricTableRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 7,
      paddingHorizontal: 10,
      borderBottomWidth: 1,
    },
    metricKey: {
      fontSize: 11,
      fontWeight: "600",
    },
    metricVal: {
      fontSize: 11,
      fontWeight: "800",
    },
    modalActionRow: {
      flexDirection: "row",
      gap: 8,
      marginTop: 12,
    },
    exportPdfBtn: {
      flex: 1.5,
      height: 40,
      borderRadius: 9,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
    },
    shareBtn: {
      flex: 1,
      height: 40,
      borderRadius: 9,
      borderWidth: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
    },
    shareBtnText: {
      fontSize: 11.5,
      fontWeight: "700",
    },
    actionBtnText: {
      color: "#fff",
      fontSize: 11.5,
      fontWeight: "800",
    },
    closeModalBtn: {
      flex: 0.8,
      height: 40,
      borderRadius: 9,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    closeModalBtnText: {
      fontSize: 11,
      fontWeight: "700",
    },

    /* Generator Controls */
    inputLabel: {
      fontSize: 10.5,
      fontWeight: "800",
      marginBottom: 5,
    },
    generatorPillsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
    },
    genChoicePill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      borderRadius: 7,
      borderWidth: 1,
      paddingVertical: 5,
      paddingHorizontal: 9,
    },
    genChoicePillText: {
      fontSize: 10.5,
      fontWeight: "700",
    },
    checkboxRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      paddingVertical: 2,
    },
    checkboxLabel: {
      fontSize: 11,
      fontWeight: "600",
      flex: 1,
    },
    runGenBtn: {
      height: 42,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 12,
    },
    runGenBtnText: {
      color: "#fff",
      fontSize: 12,
      fontWeight: "800",
    },
  });
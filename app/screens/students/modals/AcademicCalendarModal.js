import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  StatusBar,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { useTheme } from "../../../context/ThemeContext";
import { getAcademicCalendar, subscribeToDataChanges } from "../../../services/dataService";

export default function AcademicCalendarModal({ visible, onClose }) {
  const { colors, isDarkMode } = useTheme();
  const styles = getStyles(colors, isDarkMode);

  const [calendarData, setCalendarData] = useState(null);
  const [activeTab, setActiveTab] = useState("Overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchCalendar = useCallback(async (force = false) => {
    if (force) setRefreshing(true);
    else if (!calendarData) setLoading(true);
    try {
      const doc = await getAcademicCalendar(force);
      if (doc && (doc.months || doc.milestones || doc.institution)) {
        setCalendarData(doc);
      }
    } catch (e) {
      console.warn("Error fetching academic calendar from DB:", e);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [calendarData]);

  useEffect(() => {
    if (visible) {
      fetchCalendar(false);
    }
  }, [visible, fetchCalendar]);

  useEffect(() => {
    const unsub = subscribeToDataChanges((key, data) => {
      if (key === "academicCalendar" && data) {
        setCalendarData(data);
      }
    });
    return unsub;
  }, []);

  const meta = useMemo(() => calendarData?.meta || calendarData || {}, [calendarData]);
  const monthsList = useMemo(() => calendarData?.months || [], [calendarData]);
  const milestonesList = useMemo(() => calendarData?.milestones || [], [calendarData]);
  const holidaysList = useMemo(() => calendarData?.holidays || [], [calendarData]);

  const availableTabs = useMemo(() => {
    if (!calendarData || monthsList.length === 0) return ["Overview"];
    const monthNames = monthsList.map((m) => m.name);
    return ["Overview", ...monthNames, "Holidays"];
  }, [calendarData, monthsList]);

  const currentMonthData = useMemo(() => {
    if (monthsList.length === 0) return null;
    return monthsList.find((m) => m.name.toLowerCase() === activeTab.toLowerCase()) || null;
  }, [monthsList, activeTab]);

  const filteredDays = useMemo(() => {
    if (!currentMonthData || !currentMonthData.days) return [];
    if (!searchQuery.trim()) return currentMonthData.days;
    const q = searchQuery.toLowerCase().trim();
    return currentMonthData.days.filter(
      (d) =>
        String(d.date).includes(q) ||
        d.day?.toLowerCase().includes(q) ||
        d.details?.toLowerCase().includes(q) ||
        (d.wd && d.wd.toLowerCase().includes(q))
    );
  }, [currentMonthData, searchQuery]);

  const getTagStyle = (type, highlight) => {
    if (highlight && type === "exam") {
      return { bg: "#EF444418", text: "#EF4444", border: "#EF4444" };
    }
    if (highlight && type === "milestone") {
      return { bg: "#EC489918", text: "#EC4899", border: "#EC4899" };
    }
    if (type === "holiday") {
      return { bg: isDarkMode ? "#332222" : "#FEE2E2", text: "#DC2626", border: "#FCA5A5" };
    }
    if (type === "exam") {
      return { bg: isDarkMode ? "#2D1F3D" : "#EDE9FE", text: "#7C3AED", border: "#C4B5FD" };
    }
    if (type === "event" || highlight) {
      return { bg: "#10B98118", text: "#10B981", border: "#10B981" };
    }
    return { bg: colors.primaryBackground, text: colors.primaryText, border: colors.divider };
  };

  const theoryExamMs = milestonesList.find((m) => m.event?.toLowerCase().includes("theory"))?.date || "—";
  const totalWdCount = meta.totalWorkingDays || calendarData?.workingDays?.total || 90;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.primaryBackground }]} edges={["top", "bottom"]}>
        {/* Header Bar */}
        <View style={[styles.headerBar, { borderBottomColor: colors.divider }]}>
          <View style={styles.headerLeft}>
            <TouchableOpacity style={styles.backBtn} onPress={onClose} activeOpacity={0.7} accessibilityLabel="Back">
              <Icon name="arrow-left" size={24} color={colors.primaryText} />
            </TouchableOpacity>
            <View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={[styles.headerTitle, { color: colors.primaryText }]}>Academic Calendar</Text>
                <View style={[styles.termBadge, { backgroundColor: colors.primaryAccent + "18" }]}>
                  <Text style={[styles.termBadgeText, { color: colors.primaryAccent }]}>
                    {meta.semester ? meta.semester.toUpperCase() : "LIVE DB"}
                  </Text>
                </View>
                {loading && <ActivityIndicator size="small" color={colors.primaryAccent} style={{ marginLeft: 4 }} />}
              </View>
              <Text style={[styles.headerSubtitle, { color: colors.secondaryText }]}>
                {meta.institutionCode || "CIET"} {meta.academicYear || "2026–2027"} · {meta.semesters || "Odd Semester"}
              </Text>
            </View>
          </View>

          <TouchableOpacity style={styles.closeRoundBtn} onPress={onClose} activeOpacity={0.7}>
            <Icon name="close" size={20} color={colors.secondaryText} />
          </TouchableOpacity>
        </View>

        {/* Tab Strip */}
        <View style={[styles.tabBar, { borderBottomColor: colors.divider }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabContent}>
            {availableTabs.map((tab) => {
              const isSelected = activeTab === tab;
              return (
                <TouchableOpacity
                  key={tab}
                  style={[
                    styles.tabPill,
                    isSelected
                      ? { backgroundColor: colors.primaryAccent, borderColor: colors.primaryAccent }
                      : { backgroundColor: colors.cardBackground, borderColor: colors.divider },
                  ]}
                  onPress={() => {
                    setActiveTab(tab);
                    setSearchQuery("");
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.tabPillText, { color: isSelected ? "#FFFFFF" : colors.primaryText }]}>
                    {tab === "Holidays" ? "🎉 Holidays" : tab === "Overview" ? "⭐ Key Dates" : tab}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollBody}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchCalendar(true)}
              tintColor={colors.primaryAccent}
              colors={[colors.primaryAccent]}
            />
          }
        >
          {/* LOADING STATE */}
          {loading && !calendarData && (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={colors.primaryAccent} />
              <Text style={[styles.loadingTitle, { color: colors.primaryText }]}>Fetching from Database…</Text>
              <Text style={[styles.loadingSub, { color: colors.secondaryText }]}>
                Loading semester working days & institutional schedule
              </Text>
            </View>
          )}

          {/* EMPTY STATE */}
          {!loading && !calendarData && (
            <View style={styles.emptyBox}>
              <Icon name="calendar-remove-outline" size={48} color={colors.secondaryText} />
              <Text style={[styles.emptyTitle, { color: colors.primaryText }]}>No Calendar in Database</Text>
              <Text style={[styles.emptySub, { color: colors.secondaryText }]}>
                No academic calendar records found in the database.
              </Text>
              <TouchableOpacity style={[styles.retryBtn, { backgroundColor: colors.primaryAccent }]} onPress={() => fetchCalendar(true)}>
                <Icon name="refresh" size={18} color="#FFFFFF" />
                <Text style={styles.retryBtnText}>Retry Database Sync</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* OVERVIEW TAB */}
          {calendarData && activeTab === "Overview" && (
            <View style={{ gap: 14 }}>
              {/* Institution Hero */}
              <View style={[styles.heroCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
                <View style={styles.heroTop}>
                  <View style={[styles.instBadge, { backgroundColor: colors.primaryAccent + "18" }]}>
                    <Icon name="town-hall" size={24} color={colors.primaryAccent} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.instName, { color: colors.primaryText }]}>{meta.institution || "Institution Calendar"}</Text>
                    <Text style={[styles.instSub, { color: colors.secondaryText }]}>
                      Academic Year {meta.academicYear || "2026–2027"} · {meta.semester || "Odd Semester"}
                    </Text>
                  </View>
                </View>

                {/* Quick Meta Grid */}
                <View style={[styles.metaGrid, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                  <View style={styles.metaCell}>
                    <Text style={[styles.metaLabel, { color: colors.secondaryText }]}>Classes Commence</Text>
                    <Text style={[styles.metaVal, { color: "#10B981" }]}>{meta.commencementDate || "—"}</Text>
                  </View>
                  <View style={styles.metaCell}>
                    <Text style={[styles.metaLabel, { color: colors.secondaryText }]}>Last Instruction</Text>
                    <Text style={[styles.metaVal, { color: "#EC4899" }]}>{meta.lastInstructionDay || "—"}</Text>
                  </View>
                  <View style={styles.metaCell}>
                    <Text style={[styles.metaLabel, { color: colors.secondaryText }]}>Theory Exams</Text>
                    <Text style={[styles.metaVal, { color: "#F59E0B" }]}>{theoryExamMs}</Text>
                  </View>
                  <View style={styles.metaCell}>
                    <Text style={[styles.metaLabel, { color: colors.secondaryText }]}>Next Sem Classes</Text>
                    <Text style={[styles.metaVal, { color: "#3B82F6" }]}>{meta.nextSemesterDate || "—"}</Text>
                  </View>
                </View>
              </View>

              {/* Working Days Progress */}
              {monthsList.length > 0 && (
                <View style={[styles.wdSummaryCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <Text style={[styles.cardTitle, { color: colors.primaryText }]}>📊 Month-wise Working Days</Text>
                    <View style={[styles.totalWdBadge, { backgroundColor: "#10B98118" }]}>
                      <Text style={[styles.totalWdText, { color: "#10B981" }]}>Total: {totalWdCount} Normal WDs</Text>
                    </View>
                  </View>

                  <View style={styles.wdGrid}>
                    {monthsList.map((m) => (
                      <TouchableOpacity
                        key={m.name}
                        style={[styles.wdMonthBox, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}
                        onPress={() => setActiveTab(m.name)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.wdMonthName, { color: colors.primaryText }]}>{m.name}</Text>
                        <Text style={[styles.wdMonthVal, { color: colors.primaryAccent }]}>
                          {m.workingDays > 0 ? `${m.workingDays} WDs` : "Exams"}
                        </Text>
                        <Text style={[styles.wdMonthSub, { color: colors.secondaryText }]}>
                          {m.name === "November" ? "Practical & Theory" : "WD Progression"}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* Milestones Timeline */}
              {milestonesList.length > 0 && (
                <View style={[styles.sectionCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
                  <Text style={[styles.cardTitle, { color: colors.primaryText, marginBottom: 12 }]}>
                    ⭐ Important Dates & Milestones
                  </Text>

                  <View style={{ gap: 10 }}>
                    {milestonesList.map((ms, idx) => (
                      <View
                        key={idx}
                        style={[
                          styles.milestoneItem,
                          {
                            backgroundColor: colors.primaryBackground,
                            borderColor: colors.divider,
                            borderLeftColor: ms.color || "#3B82F6",
                          },
                        ]}
                      >
                        <View style={[styles.milestoneIconWrap, { backgroundColor: (ms.color || "#3B82F6") + "18" }]}>
                          <Icon name={ms.icon || "calendar"} size={18} color={ms.color || "#3B82F6"} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.milestoneEvent, { color: colors.primaryText }]}>{ms.event}</Text>
                          <Text style={[styles.milestoneDate, { color: ms.color || "#3B82F6" }]}>📅 {ms.date}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>
          )}

          {/* MONTH VIEW (Dynamically fetched from DB) */}
          {calendarData && activeTab !== "Overview" && activeTab !== "Holidays" && currentMonthData && (
            <View style={{ gap: 12 }}>
              {/* Month Header Banner */}
              <View style={[styles.monthBannerCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View>
                    <Text style={[styles.monthBannerTitle, { color: colors.primaryText }]}>
                      {currentMonthData.name} {currentMonthData.year}
                    </Text>
                    <Text style={[styles.monthBannerSub, { color: colors.secondaryText }]}>
                      {currentMonthData.workingDays > 0
                        ? `${currentMonthData.workingDays} Normal Working Days`
                        : currentMonthData.note || "Examination Period"}
                    </Text>
                  </View>
                  <View style={[styles.monthWdBadge, { backgroundColor: colors.primaryAccent + "18" }]}>
                    <Text style={[styles.monthWdBadgeText, { color: colors.primaryAccent }]}>
                      {currentMonthData.workingDays > 0 ? `${currentMonthData.workingDays} WDs` : "EXAMS"}
                    </Text>
                  </View>
                </View>

                {/* Search in Month */}
                <View style={[styles.searchBox, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                  <Icon name="magnify" size={18} color={colors.secondaryText} />
                  <TextInput
                    style={[styles.searchInput, { color: colors.primaryText }]}
                    placeholder={`Search in ${currentMonthData.name} (e.g. CIA, WD-12, Holiday)...`}
                    placeholderTextColor={colors.secondaryText}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    clearButtonMode="while-editing"
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery("")}>
                      <Icon name="close-circle" size={16} color={colors.secondaryText} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Day-by-Day Table */}
              <View style={[styles.tableCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
                {/* Table Header */}
                <View style={[styles.tableHeaderRow, { backgroundColor: colors.primaryBackground, borderBottomColor: colors.divider }]}>
                  <Text style={[styles.thDate, { color: colors.secondaryText }]}>DATE</Text>
                  <Text style={[styles.thDay, { color: colors.secondaryText }]}>DAY</Text>
                  <Text style={[styles.thDetails, { color: colors.secondaryText }]}>SCHEDULE / EVENT DETAILS</Text>
                </View>

                {/* Rows */}
                {filteredDays.map((d) => {
                  const tag = getTagStyle(d.type, d.highlight);
                  const isSunday = d.day === "Sun";
                  const isSat = d.day === "Sat";

                  return (
                    <View
                      key={d.date}
                      style={[
                        styles.dayRow,
                        {
                          borderBottomColor: colors.divider,
                          backgroundColor: d.highlight
                            ? tag.bg
                            : isSunday
                            ? isDarkMode
                              ? "rgba(239, 68, 68, 0.05)"
                              : "rgba(254, 242, 242, 0.7)"
                            : isSat && d.type === "holiday"
                            ? isDarkMode
                              ? "rgba(255, 255, 255, 0.02)"
                              : "rgba(241, 245, 249, 0.6)"
                            : "transparent",
                        },
                      ]}
                    >
                      {/* Date Num */}
                      <View style={styles.dateCol}>
                        <Text style={[styles.dateText, { color: d.type === "holiday" ? "#EF4444" : colors.primaryText, fontWeight: d.highlight ? "900" : "700" }]}>
                          {d.date}
                        </Text>
                      </View>

                      {/* Day Name */}
                      <View style={styles.dayCol}>
                        <Text style={[styles.dayText, { color: isSunday ? "#EF4444" : colors.secondaryText }]}>
                          {d.day}
                        </Text>
                      </View>

                      {/* Details & WD Badge */}
                      <View style={styles.detailsCol}>
                        <View style={[styles.statusPill, { backgroundColor: tag.bg, borderColor: tag.border }]}>
                          <Text style={[styles.statusText, { color: tag.text, fontWeight: d.highlight ? "800" : "600" }]}>
                            {d.details}
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* HOLIDAYS TAB */}
          {calendarData && activeTab === "Holidays" && (
            <View style={{ gap: 12 }}>
              <View style={[styles.heroCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <View style={[styles.instBadge, { backgroundColor: "#EF444418" }]}>
                    <Icon name="calendar-heart" size={24} color="#EF4444" />
                  </View>
                  <View>
                    <Text style={[styles.cardTitle, { color: colors.primaryText }]}>Official Institutional Holidays</Text>
                    <Text style={[styles.instSub, { color: colors.secondaryText }]}>
                      {meta.semester || "Odd Semester"} {meta.academicYear || "2026–2027"} Schedule
                    </Text>
                  </View>
                </View>
              </View>

              {holidaysList.map((hGroup) => (
                <View key={hGroup.month} style={[styles.sectionCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
                  <Text style={[styles.cardTitle, { color: colors.primaryAccent, fontSize: 14, marginBottom: 8 }]}>
                    🗓️ {hGroup.month} 2026
                  </Text>
                  <View style={styles.holidayWrap}>
                    {(hGroup.dates || []).map((h, i) => (
                      <View key={i} style={[styles.holidayChip, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                        <Icon name="beach" size={13} color="#EF4444" />
                        <Text style={[styles.holidayChipText, { color: colors.primaryText }]}>{h}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const getStyles = (colors, isDarkMode) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    headerBar: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingTop: Platform.OS === "android" ? Math.max(StatusBar.currentHeight || 0, 14) : 14,
      paddingBottom: 14,
      borderBottomWidth: 1,
    },
    headerLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      flex: 1,
    },
    backBtn: {
      padding: 4,
    },
    closeRoundBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)",
    },
    headerTitle: {
      fontSize: 16,
      fontWeight: "800",
    },
    headerSubtitle: {
      fontSize: 11,
      fontWeight: "500",
      marginTop: 2,
    },
    termBadge: {
      paddingHorizontal: 6,
      paddingVertical: 1.5,
      borderRadius: 4,
    },
    termBadgeText: {
      fontSize: 9.5,
      fontWeight: "900",
    },

    /* Tab Bar */
    tabBar: {
      borderBottomWidth: 1,
      paddingVertical: 8,
    },
    tabContent: {
      paddingHorizontal: 14,
      gap: 8,
    },
    tabPill: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 16,
      borderWidth: 1,
    },
    tabPillText: {
      fontSize: 12,
      fontWeight: "700",
    },

    /* Body */
    scrollBody: {
      padding: 16,
      paddingBottom: 30,
    },
    loadingBox: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 60,
      gap: 10,
    },
    loadingTitle: {
      fontSize: 15,
      fontWeight: "700",
      marginTop: 6,
    },
    loadingSub: {
      fontSize: 12,
      textAlign: "center",
    },
    emptyBox: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 60,
      gap: 10,
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: "800",
      marginTop: 6,
    },
    emptySub: {
      fontSize: 12,
      textAlign: "center",
      paddingHorizontal: 20,
    },
    retryBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 10,
      marginTop: 8,
    },
    retryBtnText: {
      color: "#FFFFFF",
      fontSize: 13,
      fontWeight: "700",
    },

    /* Hero Card */
    heroCard: {
      borderRadius: 16,
      borderWidth: 1,
      padding: 16,
      elevation: 2,
    },
    heroTop: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 14,
    },
    instBadge: {
      width: 44,
      height: 44,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
    },
    instName: {
      fontSize: 15,
      fontWeight: "800",
    },
    instSub: {
      fontSize: 11,
      fontWeight: "500",
      marginTop: 2,
    },
    metaGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      borderRadius: 12,
      borderWidth: 1,
      paddingVertical: 10,
      paddingHorizontal: 8,
    },
    metaCell: {
      width: "50%",
      paddingVertical: 6,
      paddingHorizontal: 8,
    },
    metaLabel: {
      fontSize: 10,
      fontWeight: "600",
      textTransform: "uppercase",
      letterSpacing: 0.3,
    },
    metaVal: {
      fontSize: 13,
      fontWeight: "800",
      marginTop: 2,
    },

    /* Summary Card */
    wdSummaryCard: {
      borderRadius: 16,
      borderWidth: 1,
      padding: 16,
      elevation: 2,
    },
    cardTitle: {
      fontSize: 14.5,
      fontWeight: "800",
    },
    totalWdBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
    },
    totalWdText: {
      fontSize: 11,
      fontWeight: "800",
    },
    wdGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    wdMonthBox: {
      width: "48%",
      borderRadius: 12,
      borderWidth: 1,
      padding: 12,
    },
    wdMonthName: {
      fontSize: 13,
      fontWeight: "800",
    },
    wdMonthVal: {
      fontSize: 15,
      fontWeight: "900",
      marginTop: 2,
    },
    wdMonthSub: {
      fontSize: 10,
      marginTop: 2,
    },

    /* Section Card */
    sectionCard: {
      borderRadius: 16,
      borderWidth: 1,
      padding: 16,
      elevation: 2,
    },
    milestoneItem: {
      flexDirection: "row",
      alignItems: "center",
      padding: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderLeftWidth: 4,
      gap: 10,
    },
    milestoneIconWrap: {
      width: 34,
      height: 34,
      borderRadius: 8,
      justifyContent: "center",
      alignItems: "center",
    },
    milestoneEvent: {
      fontSize: 12.5,
      fontWeight: "700",
    },
    milestoneDate: {
      fontSize: 11,
      fontWeight: "700",
      marginTop: 2,
    },

    /* Month Banner */
    monthBannerCard: {
      borderRadius: 16,
      borderWidth: 1,
      padding: 14,
      elevation: 2,
      gap: 12,
    },
    monthBannerTitle: {
      fontSize: 17,
      fontWeight: "800",
    },
    monthBannerSub: {
      fontSize: 11,
      fontWeight: "500",
      marginTop: 2,
    },
    monthWdBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
    },
    monthWdBadgeText: {
      fontSize: 11,
      fontWeight: "900",
    },
    searchBox: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 10,
      borderWidth: 1,
      paddingHorizontal: 10,
      paddingVertical: 6,
      gap: 8,
    },
    searchInput: {
      flex: 1,
      fontSize: 12,
      padding: 0,
    },

    /* Table */
    tableCard: {
      borderRadius: 16,
      borderWidth: 1,
      overflow: "hidden",
      elevation: 2,
    },
    tableHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderBottomWidth: 1,
    },
    thDate: {
      width: 44,
      fontSize: 10.5,
      fontWeight: "800",
    },
    thDay: {
      width: 44,
      fontSize: 10.5,
      fontWeight: "800",
    },
    thDetails: {
      flex: 1,
      fontSize: 10.5,
      fontWeight: "800",
    },
    dayRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 9,
      paddingHorizontal: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    dateCol: {
      width: 44,
    },
    dateText: {
      fontSize: 13,
    },
    dayCol: {
      width: 44,
    },
    dayText: {
      fontSize: 12,
      fontWeight: "600",
    },
    detailsCol: {
      flex: 1,
    },
    statusPill: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      borderWidth: 1,
      alignSelf: "flex-start",
    },
    statusText: {
      fontSize: 11,
    },

    /* Holidays */
    holidayWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
    },
    holidayChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      borderWidth: 1,
    },
    holidayChipText: {
      fontSize: 11,
      fontWeight: "600",
    },
  });

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

const getCurrentMonthName = (months = []) => {
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const currentName = monthNames[new Date().getMonth()];
  if (!months || months.length === 0) return currentName;
  const match = months.find((m) => m.name.toLowerCase() === currentName.toLowerCase());
  return match ? match.name : months[0].name;
};

export default function AcademicCalendarModal({ visible, onClose }) {
  const { colors, isDarkMode } = useTheme();
  const styles = getStyles(colors, isDarkMode);

  const [calendarData, setCalendarData] = useState(null);
  const [activeTab, setActiveTab] = useState(() => getCurrentMonthName());
  const [viewMode, setViewMode] = useState("calendar"); // "calendar" | "table"
  const [selectedGridDay, setSelectedGridDay] = useState(null);
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
        if (doc.months && doc.months.length > 0) {
          const autoMonth = getCurrentMonthName(doc.months);
          setActiveTab(autoMonth);
        }
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

  const gridWeeks = useMemo(() => {
    if (!currentMonthData || !currentMonthData.days || currentMonthData.days.length === 0) return [];
    const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const firstDay = currentMonthData.days[0];
    const offset = firstDay ? daysOfWeek.indexOf(firstDay.day) : 0;

    const cells = [];
    for (let i = 0; i < (offset >= 0 ? offset : 0); i++) {
      cells.push(null);
    }
    for (const d of currentMonthData.days) {
      cells.push(d);
    }
    while (cells.length % 7 !== 0) {
      cells.push(null);
    }

    const rows = [];
    for (let i = 0; i < cells.length; i += 7) {
      rows.push(cells.slice(i, i + 7));
    }
    return rows;
  }, [currentMonthData]);

  const theoryExamMs = milestonesList.find((m) => m.event?.toLowerCase().includes("theory"))?.date || "—";
  const totalWdCount = meta.totalWorkingDays || calendarData?.workingDays?.total || 90;

  const today = new Date();
  const todayDate = today.getDate();
  const todayMonthName = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][today.getMonth()];
  const isCurrentMonthActive = Boolean(currentMonthData && currentMonthData.name.toLowerCase() === todayMonthName.toLowerCase());

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

                {/* Search & View Mode Controls */}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
                  <View style={[styles.searchBox, { flex: 1, backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                    <Icon name="magnify" size={18} color={colors.secondaryText} />
                    <TextInput
                      style={[styles.searchInput, { color: colors.primaryText }]}
                      placeholder={`Search ${currentMonthData.name}…`}
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

                  {/* View Mode Toggle Pill */}
                  <View style={[styles.mobileViewModeToggle, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                    <TouchableOpacity
                      style={[styles.mobileViewModeBtn, viewMode === "calendar" && { backgroundColor: colors.primaryAccent }]}
                      onPress={() => setViewMode("calendar")}
                      activeOpacity={0.8}
                    >
                      <Icon name="calendar-month" size={16} color={viewMode === "calendar" ? "#FFFFFF" : colors.secondaryText} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.mobileViewModeBtn, viewMode === "table" && { backgroundColor: colors.primaryAccent }]}
                      onPress={() => setViewMode("table")}
                      activeOpacity={0.8}
                    >
                      <Icon name="format-list-bulleted" size={16} color={viewMode === "table" ? "#FFFFFF" : colors.secondaryText} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* 📅 CALENDAR GRID VIEW */}
              {viewMode === "calendar" && (
                <View style={[styles.gridCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
                  {/* Weekday Headers */}
                  <View style={styles.gridWeekHeader}>
                    {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((dayName, dIdx) => (
                      <View key={dIdx} style={styles.gridDayCol}>
                        <Text
                          style={[
                            styles.gridDayHeaderText,
                            { color: dIdx === 0 ? "#EF4444" : dIdx === 6 ? "#3B82F6" : colors.secondaryText },
                          ]}
                        >
                          {dayName}
                        </Text>
                      </View>
                    ))}
                  </View>

                  {/* 7-Column Grid Rows */}
                  <View style={styles.gridWeeksContainer}>
                    {gridWeeks.map((week, wIdx) => (
                      <View key={`week-${wIdx}`} style={styles.gridWeekRow}>
                        {week.map((d, colIdx) => {
                          if (!d) {
                            return <View key={`blank-${colIdx}`} style={styles.gridCellBlank} />;
                          }

                          const isSun = d.day === "Sun";
                          const isSat = d.day === "Sat";
                          const isHoliday = d.type === "holiday";
                          const isExam = d.type === "exam";
                          const isSelected = selectedGridDay?.date === d.date;
                          const isToday = isCurrentMonthActive && d.date === todayDate;

                          return (
                            <TouchableOpacity
                              key={d.date}
                              style={[
                                styles.gridDayCell,
                                {
                                  borderColor: isToday
                                    ? "#10B981"
                                    : isSelected
                                    ? colors.primaryAccent
                                    : isHoliday
                                    ? "rgba(239, 68, 68, 0.4)"
                                    : d.highlight
                                    ? "rgba(79, 70, 229, 0.4)"
                                    : colors.divider,
                                  borderWidth: isToday || isSelected ? 2 : 1,
                                  backgroundColor: isToday
                                    ? "#10B98118"
                                    : isSelected
                                    ? colors.primaryAccent + "18"
                                    : isHoliday
                                    ? "rgba(239, 68, 68, 0.08)"
                                    : d.highlight
                                    ? "rgba(79, 70, 229, 0.06)"
                                    : colors.primaryBackground,
                                },
                              ]}
                              onPress={() => setSelectedGridDay(isSelected ? null : d)}
                              activeOpacity={0.7}
                            >
                              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                                <Text
                                  style={[
                                    styles.gridDateNum,
                                    {
                                      color: isToday ? "#10B981" : isHoliday ? "#EF4444" : isSun ? "#EF4444" : isSat ? "#3B82F6" : colors.primaryText,
                                      fontWeight: isToday || d.highlight || isSelected ? "900" : "700",
                                    },
                                  ]}
                                >
                                  {d.date}
                                </Text>
                                {isToday ? (
                                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#10B981" }} />
                                ) : d.highlight ? (
                                  <Text style={{ fontSize: 9 }}>⭐</Text>
                                ) : null}
                              </View>

                              {d.wd ? (
                                <View style={[styles.gridWdBadge, { backgroundColor: isToday ? "#059669" : "#10B981" }]}>
                                  <Text style={styles.gridWdText}>{d.wd.replace("WD-", "")}</Text>
                                </View>
                              ) : isHoliday ? (
                                <Text style={{ fontSize: 9 }}>🏖️</Text>
                              ) : isExam ? (
                                <Text style={{ fontSize: 9 }}>📝</Text>
                              ) : null}
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    ))}
                  </View>

                  {/* Selected Day Preview Banner */}
                  {selectedGridDay && (
                    <View style={[styles.selectedDayCard, { backgroundColor: colors.primaryBackground, borderColor: colors.primaryAccent }]}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                          <View style={[styles.selectedDayNumBox, { backgroundColor: colors.primaryAccent }]}>
                            <Text style={styles.selectedDayNumText}>{selectedGridDay.date}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.selectedDayTitle, { color: colors.primaryText }]}>
                              {currentMonthData.name} {selectedGridDay.date} ({selectedGridDay.day})
                            </Text>
                            <Text style={[styles.selectedDaySub, { color: selectedGridDay.type === "holiday" ? "#EF4444" : colors.secondaryText }]}>
                              {selectedGridDay.details || (selectedGridDay.type === "holiday" ? "Holiday" : "Regular Working Day")}
                            </Text>
                          </View>
                        </View>
                        {selectedGridDay.wd && (
                          <View style={[styles.wdPill, { backgroundColor: "#10B98118", borderColor: "#10B981" }]}>
                            <Text style={[styles.wdPillText, { color: "#10B981" }]}>{selectedGridDay.wd}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  )}
                </View>
              )}

              {/* 📋 AGENDA / TABLE VIEW (Mobile-Optimized Clean Card List) */}
              {viewMode === "table" && (
                <View style={styles.agendaListWrap}>
                  {filteredDays.map((d) => {
                    const isSunday = d.day === "Sun";
                    const isHoliday = d.type === "holiday";
                    const isExam = d.type === "exam";
                    const isToday = isCurrentMonthActive && d.date === todayDate;

                    return (
                      <View
                        key={d.date}
                        style={[
                          styles.agendaCard,
                          {
                            backgroundColor: colors.cardBackground,
                            borderColor: isToday
                              ? "#10B981"
                              : isHoliday
                              ? "rgba(239, 68, 68, 0.35)"
                              : d.highlight
                              ? colors.primaryAccent
                              : colors.divider,
                            borderWidth: isToday ? 1.5 : 1,
                            borderLeftWidth: isToday ? 4 : d.highlight ? 4 : isHoliday ? 4 : isExam ? 4 : 1,
                            borderLeftColor: isToday
                              ? "#10B981"
                              : isHoliday
                              ? "#EF4444"
                              : isExam
                              ? "#8B5CF6"
                              : d.highlight
                              ? colors.primaryAccent
                              : colors.divider,
                          },
                        ]}
                      >
                        {/* Left: Date Badge Box */}
                        <View
                          style={[
                            styles.agendaDateBadge,
                            {
                              backgroundColor: isToday
                                ? "#10B98118"
                                : isHoliday
                                ? "rgba(239, 68, 68, 0.08)"
                                : isSunday
                                ? isDarkMode
                                  ? "rgba(239, 68, 68, 0.06)"
                                  : "rgba(254, 242, 242, 0.9)"
                                : colors.primaryBackground,
                              borderColor: isToday ? "#10B981" : colors.divider,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.agendaDateNum,
                              {
                                color: isToday ? "#10B981" : isHoliday || isSunday ? "#EF4444" : colors.primaryText,
                                fontWeight: isToday || d.highlight ? "900" : "800",
                              },
                            ]}
                          >
                            {d.date < 10 ? `0${d.date}` : d.date}
                          </Text>
                          <Text
                            style={[
                              styles.agendaDayName,
                              {
                                color: isToday ? "#10B981" : isHoliday || isSunday ? "#EF4444" : colors.secondaryText,
                              },
                            ]}
                          >
                            {d.day ? d.day.toUpperCase() : ""}
                          </Text>
                        </View>

                        {/* Center: Details & Status */}
                        <View style={styles.agendaDetailsWrap}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                            {isToday && (
                              <View style={{ backgroundColor: "#10B981", paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 }}>
                                <Text style={{ color: "#FFF", fontSize: 9.5, fontWeight: "900" }}>TODAY</Text>
                              </View>
                            )}
                            {d.highlight && <Text style={{ fontSize: 13 }}>⭐</Text>}
                            <Text
                              style={[
                                styles.agendaTitle,
                                {
                                  color: isToday ? "#10B981" : isHoliday ? "#EF4444" : isExam ? "#7C3AED" : colors.primaryText,
                                  fontWeight: isToday || d.highlight || isExam || isHoliday ? "800" : "600",
                                },
                              ]}
                            >
                              {d.details && d.details !== "—"
                                ? d.details
                                : isHoliday
                                ? "Institutional Holiday"
                                : d.wd
                                ? `Regular Working Day (${d.wd})`
                                : "No Academic Activity"}
                            </Text>
                          </View>

                          {/* Status Chip Row */}
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 }}>
                            {isHoliday ? (
                              <View style={[styles.agendaChip, { backgroundColor: "#EF444418", borderColor: "#EF444430" }]}>
                                <Text style={[styles.agendaChipText, { color: "#EF4444" }]}>🏖️ Holiday</Text>
                              </View>
                            ) : isExam ? (
                              <View style={[styles.agendaChip, { backgroundColor: "#8B5CF618", borderColor: "#8B5CF630" }]}>
                                <Text style={[styles.agendaChipText, { color: "#8B5CF6" }]}>📝 Examination</Text>
                              </View>
                            ) : d.highlight ? (
                              <View style={[styles.agendaChip, { backgroundColor: colors.primaryAccent + "18", borderColor: colors.primaryAccent + "30" }]}>
                                <Text style={[styles.agendaChipText, { color: colors.primaryAccent }]}>⭐ Academic Milestone</Text>
                              </View>
                            ) : (
                              <View style={[styles.agendaChip, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                                <Text style={[styles.agendaChipText, { color: colors.secondaryText }]}>
                                  {d.wd ? "Instruction Day" : "Regular Day"}
                                </Text>
                              </View>
                            )}
                          </View>
                        </View>

                        {/* Right: WD Badge */}
                        <View style={styles.agendaWdCol}>
                          {d.wd ? (
                            <View style={[styles.wdPill, { backgroundColor: "#10B98118", borderColor: "#10B981" }]}>
                              <Text style={[styles.wdPillText, { color: "#10B981" }]}>{d.wd}</Text>
                            </View>
                          ) : (
                            <Text style={{ fontSize: 11, color: colors.secondaryText, fontWeight: "600" }}>—</Text>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
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
    mobileViewModeToggle: {
      flexDirection: "row",
      borderRadius: 8,
      borderWidth: 1,
      padding: 2,
    },
    mobileViewModeBtn: {
      width: 32,
      height: 32,
      borderRadius: 6,
      justifyContent: "center",
      alignItems: "center",
    },

    /* Calendar Grid */
    gridCard: {
      borderRadius: 16,
      borderWidth: 1,
      padding: 10,
      elevation: 2,
      gap: 8,
    },
    gridWeekHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingBottom: 6,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: "rgba(150,150,150,0.2)",
    },
    gridDayCol: {
      width: "13.2%",
      alignItems: "center",
      justifyContent: "center",
    },
    gridDayHeaderText: {
      fontSize: 10,
      fontWeight: "800",
    },
    gridWeeksContainer: {
      gap: 5,
    },
    gridWeekRow: {
      flexDirection: "row",
      justifyContent: "space-between",
    },
    gridCellBlank: {
      width: "13.2%",
      height: 48,
      borderRadius: 8,
      backgroundColor: "transparent",
    },
    gridDayCell: {
      width: "13.2%",
      height: 48,
      borderRadius: 8,
      borderWidth: 1,
      padding: 3.5,
      justifyContent: "space-between",
    },
    gridDateNum: {
      fontSize: 11.5,
    },
    gridWdBadge: {
      borderRadius: 4,
      paddingHorizontal: 2.5,
      paddingVertical: 1,
      alignSelf: "flex-start",
    },
    gridWdText: {
      color: "#FFFFFF",
      fontSize: 8,
      fontWeight: "900",
    },
    selectedDayCard: {
      borderRadius: 12,
      borderWidth: 1.5,
      padding: 12,
      marginTop: 6,
    },
    selectedDayNumBox: {
      width: 34,
      height: 34,
      borderRadius: 8,
      justifyContent: "center",
      alignItems: "center",
    },
    selectedDayNumText: {
      color: "#FFFFFF",
      fontSize: 15,
      fontWeight: "900",
    },
    selectedDayTitle: {
      fontSize: 13,
      fontWeight: "800",
    },
    selectedDaySub: {
      fontSize: 11.5,
      fontWeight: "600",
      marginTop: 1,
    },

    /* Agenda List / Mobile Schedule View */
    agendaListWrap: {
      gap: 8,
    },
    agendaCard: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 14,
      borderWidth: 1,
      padding: 10,
      elevation: 1,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
    },
    agendaDateBadge: {
      width: 48,
      height: 48,
      borderRadius: 10,
      borderWidth: 1,
      justifyContent: "center",
      alignItems: "center",
      flexShrink: 0,
    },
    agendaDateNum: {
      fontSize: 17,
      lineHeight: 20,
    },
    agendaDayName: {
      fontSize: 9.5,
      fontWeight: "800",
      marginTop: 1,
    },
    agendaDetailsWrap: {
      flex: 1,
      paddingHorizontal: 10,
      justifyContent: "center",
    },
    agendaTitle: {
      fontSize: 13,
      lineHeight: 17,
    },
    agendaChip: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
      borderWidth: 1,
    },
    agendaChipText: {
      fontSize: 9.5,
      fontWeight: "700",
    },
    agendaWdCol: {
      minWidth: 54,
      alignItems: "flex-end",
      justifyContent: "center",
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
    thWd: {
      width: 60,
      fontSize: 10.5,
      fontWeight: "800",
      textAlign: "center",
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
      paddingRight: 6,
    },
    dayEventText: {
      fontSize: 12,
      lineHeight: 16,
    },
    wdCol: {
      width: 60,
      alignItems: "center",
      justifyContent: "center",
    },
    wdPill: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
      borderWidth: 1,
    },
    wdPillText: {
      fontSize: 10,
      fontWeight: "900",
    },
    noWdText: {
      fontSize: 11,
      fontWeight: "600",
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

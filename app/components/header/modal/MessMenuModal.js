import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Share,
  Platform,
  StatusBar,
  ActivityIndicator,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { useTheme } from "../../../context/ThemeContext";
import { showToast } from "../../../utils/toastService";
import { api } from "../../../services/api";

const DAYS_OF_WEEK = [
  { full: "Monday", short: "Mon", code: "M" },
  { full: "Tuesday", short: "Tue", code: "T" },
  { full: "Wednesday", short: "Wed", code: "W" },
  { full: "Thursday", short: "Thu", code: "T" },
  { full: "Friday", short: "Fri", code: "F" },
  { full: "Saturday", short: "Sat", code: "S" },
  { full: "Sunday", short: "Sun", code: "S" },
];

const MEAL_ICONS = {
  breakfast: "coffee-outline",
  lunch: "silverware-fork-knife",
  snacks: "cupcake",
  dinner: "food-drumstick-outline",
};

const MEAL_COLORS = {
  breakfast: "#F59E0B",
  lunch: "#10B981",
  snacks: "#8B5CF6",
  dinner: "#3B82F6",
};

const getCurrentDayName = () => {
  const dayIndex = new Date().getDay();
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return days[dayIndex] || "Monday";
};

const getCurrentMealType = () => {
  const hour = new Date().getHours();
  const minute = new Date().getMinutes();
  const decTime = hour + minute / 60;

  if (decTime >= 6.0 && decTime < 10.5) return "breakfast";
  if (decTime >= 10.5 && decTime < 15.5) return "lunch";
  if (decTime >= 15.5 && decTime < 18.75) return "snacks";
  return "dinner";
};

export default function MessMenuModal({ visible, onClose }) {
  const { colors, isDarkMode } = useTheme();
  const styles = getStyles(colors, isDarkMode);

  const [selectedDay, setSelectedDay] = useState(getCurrentDayName());
  const [activeMealFilter, setActiveMealFilter] = useState("all");
  const [messSchedule, setMessSchedule] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  const todayDayName = useMemo(() => getCurrentDayName(), []);

  const loadMessMenu = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.get("/messMenu", { limit: 100 });
      const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
      const scheduleMap = {};

      list.forEach((doc) => {
        const day = doc.day || doc.dayOfWeek;
        if (day) {
          scheduleMap[day] = {
            breakfast: doc.breakfast || null,
            lunch: doc.lunch || null,
            snacks: doc.snacks || null,
            dinner: doc.dinner || null,
          };
        }
      });

      setMessSchedule(scheduleMap);
    } catch (err) {
      console.warn("loadMessMenu error:", err);
      setMessSchedule({});
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      const today = getCurrentDayName();
      const currentMeal = getCurrentMealType();
      setSelectedDay(today);
      setActiveMealFilter(currentMeal);
      loadMessMenu();
    }
  }, [visible, loadMessMenu]);

  const currentDayIndex = useMemo(() => {
    return DAYS_OF_WEEK.findIndex((d) => d.full === selectedDay);
  }, [selectedDay]);

  const handlePrevDay = () => {
    const nextIdx = (currentDayIndex - 1 + DAYS_OF_WEEK.length) % DAYS_OF_WEEK.length;
    setSelectedDay(DAYS_OF_WEEK[nextIdx].full);
  };

  const handleNextDay = () => {
    const nextIdx = (currentDayIndex + 1) % DAYS_OF_WEEK.length;
    setSelectedDay(DAYS_OF_WEEK[nextIdx].full);
  };

  const todayMenu = useMemo(() => {
    return messSchedule[selectedDay] || null;
  }, [messSchedule, selectedDay]);

  const displayedMealKeys = useMemo(() => {
    if (activeMealFilter === "all") return ["breakfast", "lunch", "snacks", "dinner"];
    return [activeMealFilter];
  }, [activeMealFilter]);

  const handleShareMenu = async () => {
    if (!todayMenu) return;
    try {
      const parts = [];
      if (todayMenu.breakfast?.items) parts.push(`☕ BREAKFAST: ${todayMenu.breakfast.items.join(", ")}`);
      if (todayMenu.lunch?.items) parts.push(`🍛 LUNCH: ${todayMenu.lunch.items.join(", ")}`);
      if (todayMenu.snacks?.items) parts.push(`🍵 SNACKS: ${todayMenu.snacks.items.join(", ")}`);
      if (todayMenu.dinner?.items) parts.push(`🍲 DINNER: ${todayMenu.dinner.items.join(", ")}`);

      await Share.share({
        title: `Campus Dining Menu - ${selectedDay}`,
        message: `🍽️ EDUNEX CAMPUS & HOSTEL DINING MENU (${selectedDay.toUpperCase()})\n\n${parts.join("\n\n")}\n\nVerified by Central Campus Mess Committee.`,
      });
      showToast("Dining menu shared!", "success");
    } catch (_e) {}
  };

  const isSelectedDayToday = selectedDay === todayDayName;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlayFull}>
        {/* Header */}
        <View style={[styles.fullHeader, { backgroundColor: colors.primaryAccent }]}>
          <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
            <Icon name="arrow-left" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={styles.fullHeaderTitle}>Campus Dining & Mess Menu</Text>
              <View style={styles.verifiedBadge}>
                <Icon name="shield-check" size={12} color="#10B981" />
                <Text style={styles.verifiedBadgeText}>OFFICIAL</Text>
              </View>
            </View>
            <Text style={styles.fullHeaderSub}>Weekly Nutrition Schedule</Text>
          </View>
          <TouchableOpacity style={styles.headerBtn} onPress={loadMessMenu}>
            <Icon name="refresh" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Body Container */}
        <View style={[styles.bodyContainer, { backgroundColor: colors.cardBackground }]}>
          {/* Day Navigation Bar */}
          <View style={[styles.dayNavRow, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
            <TouchableOpacity onPress={handlePrevDay} style={styles.navArrowBtn}>
              <Icon name="chevron-left" size={24} color={colors.primaryText} />
            </TouchableOpacity>

            <View style={{ alignItems: "center" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={[styles.selectedDayTitle, { color: colors.primaryText }]}>{selectedDay}</Text>
                {isSelectedDayToday && (
                  <View style={[styles.todayTag, { backgroundColor: colors.primaryAccent }]}>
                    <Text style={styles.todayTagText}>TODAY</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.selectedDaySub, { color: colors.secondaryText }]}>
                {todayMenu ? "Hostel Mess Schedule" : "No schedule recorded"}
              </Text>
            </View>

            <TouchableOpacity onPress={handleNextDay} style={styles.navArrowBtn}>
              <Icon name="chevron-right" size={24} color={colors.primaryText} />
            </TouchableOpacity>
          </View>

          {/* Horizontal Day Selector Chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingVertical: 10 }}
          >
            {DAYS_OF_WEEK.map((d) => {
              const isSel = selectedDay === d.full;
              const isToday = todayDayName === d.full;
              return (
                <TouchableOpacity
                  key={d.full}
                  style={[
                    styles.dayChip,
                    isSel
                      ? { backgroundColor: colors.primaryAccent, borderColor: colors.primaryAccent }
                      : { backgroundColor: colors.primaryBackground, borderColor: colors.divider },
                  ]}
                  onPress={() => setSelectedDay(d.full)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.dayChipText, { color: isSel ? "#FFFFFF" : colors.primaryText }]}>
                    {d.short}
                  </Text>
                  {isToday && (
                    <View style={[styles.todayDot, { backgroundColor: isSel ? "#FFFFFF" : colors.primaryAccent }]} />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Meal Filter Tabs */}
          <View style={[styles.mealFilterRow, { borderBottomColor: colors.divider }]}>
            {["all", "breakfast", "lunch", "snacks", "dinner"].map((m) => {
              const isSel = activeMealFilter === m;
              return (
                <TouchableOpacity
                  key={m}
                  style={[
                    styles.mealFilterBtn,
                    isSel && { borderBottomColor: colors.primaryAccent, borderBottomWidth: 2 },
                  ]}
                  onPress={() => setActiveMealFilter(m)}
                >
                  <Text
                    style={[
                      styles.mealFilterText,
                      { color: isSel ? colors.primaryAccent : colors.secondaryText, fontWeight: isSel ? "800" : "600" },
                    ]}
                  >
                    {m.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Meal Cards Content */}
          {isLoading ? (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
              <ActivityIndicator size="large" color={colors.primaryAccent} />
              <Text style={{ marginTop: 12, color: colors.secondaryText, fontSize: 13 }}>
                Loading dining menu from server...
              </Text>
            </View>
          ) : !todayMenu ? (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 24 }}>
              <Icon name="food-off" size={54} color={colors.secondaryText} style={{ marginBottom: 12 }} />
              <Text style={{ fontSize: 16, fontWeight: "700", color: colors.primaryText, textAlign: "center" }}>
                No mess menu published.
              </Text>
              <Text style={{ fontSize: 12.5, color: colors.secondaryText, textAlign: "center", marginTop: 6 }}>
                The dining committee has not published menu items for {selectedDay} yet.
              </Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
              {displayedMealKeys.map((key) => {
                const meal = todayMenu[key];
                if (!meal) return null;
                const icon = MEAL_ICONS[key] || "food";
                const color = MEAL_COLORS[key] || colors.primaryAccent;
                const itemsList = Array.isArray(meal.items) ? meal.items : [];

                return (
                  <View
                    key={key}
                    style={[
                      styles.mealCard,
                      { backgroundColor: colors.primaryBackground, borderColor: colors.divider },
                    ]}
                  >
                    <View style={styles.mealCardHeader}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <View style={[styles.mealIconBox, { backgroundColor: color + "18" }]}>
                          <Icon name={icon} size={20} color={color} />
                        </View>
                        <View>
                          <Text style={[styles.mealTitle, { color: colors.primaryText }]}>
                            {key.toUpperCase()}
                          </Text>
                          {meal.time && (
                            <Text style={[styles.mealTime, { color: colors.secondaryText }]}>{meal.time}</Text>
                          )}
                        </View>
                      </View>
                      {meal.calories && (
                        <View style={[styles.calBadge, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
                          <Text style={[styles.calText, { color: color }]}>⚡ {meal.calories}</Text>
                        </View>
                      )}
                    </View>

                    {itemsList.length > 0 ? (
                      <View style={{ marginTop: 10, gap: 6 }}>
                        {itemsList.map((item, idx) => (
                          <View key={`${item}_${idx}`} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                            <View style={[styles.bulletDot, { backgroundColor: color }]} />
                            <Text style={[styles.itemText, { color: colors.primaryText }]}>{item}</Text>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <Text style={{ color: colors.secondaryText, fontStyle: "italic", marginTop: 8 }}>
                        No specific dishes recorded for this meal.
                      </Text>
                    )}

                    {meal.highlight && (
                      <View style={[styles.highlightBox, { backgroundColor: color + "10", borderColor: color + "33" }]}>
                        <Icon name="star" size={14} color={color} />
                        <Text style={[styles.highlightText, { color }]}>{meal.highlight}</Text>
                      </View>
                    )}
                  </View>
                );
              })}

              <TouchableOpacity
                style={[styles.shareBtn, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}
                onPress={handleShareMenu}
              >
                <Icon name="share-variant-outline" size={18} color={colors.primaryAccent} />
                <Text style={[styles.shareBtnText, { color: colors.primaryAccent }]}>Share {selectedDay}'s Menu</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const getStyles = (colors, _isDarkMode) =>
  StyleSheet.create({
    overlayFull: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.8)",
    },
    fullHeader: {
      paddingTop: Platform.OS === "android" ? Math.max(StatusBar.currentHeight || 0, 44) : 52,
      paddingBottom: 14,
      paddingHorizontal: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    headerBtn: {
      padding: 6,
      borderRadius: 10,
    },
    fullHeaderTitle: {
      color: "#FFFFFF",
      fontSize: 16.5,
      fontWeight: "800",
    },
    fullHeaderSub: {
      color: "rgba(255,255,255,0.8)",
      fontSize: 11,
      fontWeight: "500",
      marginTop: 2,
    },
    verifiedBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      backgroundColor: "rgba(255,255,255,0.2)",
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    verifiedBadgeText: {
      color: "#FFFFFF",
      fontSize: 8.5,
      fontWeight: "900",
    },
    bodyContainer: {
      flex: 1,
    },
    dayNavRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
    },
    navArrowBtn: {
      padding: 8,
    },
    selectedDayTitle: {
      fontSize: 16,
      fontWeight: "800",
    },
    selectedDaySub: {
      fontSize: 11,
      fontWeight: "500",
      marginTop: 2,
    },
    todayTag: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    todayTagText: {
      color: "#FFFFFF",
      fontSize: 8.5,
      fontWeight: "900",
    },
    dayChip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 10,
      borderWidth: 1,
      alignItems: "center",
    },
    dayChipText: {
      fontSize: 12,
      fontWeight: "700",
    },
    todayDot: {
      width: 4,
      height: 4,
      borderRadius: 2,
      marginTop: 3,
    },
    mealFilterRow: {
      flexDirection: "row",
      borderBottomWidth: 1,
      paddingHorizontal: 16,
    },
    mealFilterBtn: {
      flex: 1,
      paddingVertical: 10,
      alignItems: "center",
    },
    mealFilterText: {
      fontSize: 11,
    },
    mealCard: {
      borderRadius: 14,
      borderWidth: 1,
      padding: 14,
      marginBottom: 12,
    },
    mealCardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    mealIconBox: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    mealTitle: {
      fontSize: 13,
      fontWeight: "800",
    },
    mealTime: {
      fontSize: 11,
      fontWeight: "500",
    },
    calBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      borderWidth: 1,
    },
    calText: {
      fontSize: 10.5,
      fontWeight: "700",
    },
    bulletDot: {
      width: 5,
      height: 5,
      borderRadius: 2.5,
    },
    itemText: {
      fontSize: 12.5,
      fontWeight: "600",
    },
    highlightBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      padding: 8,
      borderRadius: 8,
      borderWidth: 1,
      marginTop: 10,
    },
    highlightText: {
      fontSize: 11,
      fontWeight: "700",
    },
    shareBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
      marginTop: 8,
    },
    shareBtnText: {
      fontSize: 12.5,
      fontWeight: "700",
    },
  });

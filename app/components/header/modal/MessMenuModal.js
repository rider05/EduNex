import React, { useState, useEffect, useMemo } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Share,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { useTheme } from "../../../context/ThemeContext";
import { showToast } from "../../../utils/toastService";

const DAYS_OF_WEEK = [
  { full: "Monday", short: "Mon", code: "M" },
  { full: "Tuesday", short: "Tue", code: "T" },
  { full: "Wednesday", short: "Wed", code: "W" },
  { full: "Thursday", short: "Thu", code: "T" },
  { full: "Friday", short: "Fri", code: "F" },
  { full: "Saturday", short: "Sat", code: "S" },
  { full: "Sunday", short: "Sun", code: "S" },
];

const MESS_SCHEDULE = {
  Monday: {
    breakfast: {
      time: "07:30 AM - 09:00 AM",
      items: ["Ghee Pongal & Medu Vada", "Coconut Chutney & Sambar", "Bread Butter Jam", "Tea & Filter Coffee"],
      highlight: "Hot Pongal Special",
      calories: "450 kcal",
    },
    lunch: {
      time: "12:30 PM - 02:15 PM",
      items: ["Steamed Sona Masoori Rice", "Chettinad Veg Gravy / Chicken Chukka (Spl)", "South Indian Sambar & Rasam", "Poriyal & Appalam", "Thick Curd & Payasam"],
      highlight: "Chettinad Special Feast",
      calories: "680 kcal",
    },
    snacks: {
      time: "04:45 PM - 05:45 PM",
      items: ["Onion Pakoda & Mint Chutney", "Biscuits & Cookies", "Masala Chai / Hot Coffee"],
      highlight: "Crispy Evening Snack",
      calories: "220 kcal",
    },
    dinner: {
      time: "07:30 PM - 09:15 PM",
      items: ["Soft Phulka Roti (2 pcs)", "Paneer Butter Masala", "Jeera Rice & Dal Tadka", "Fresh Green Salad & Milk"],
      highlight: "North Indian Delicacy",
      calories: "550 kcal",
    },
  },
  Tuesday: {
    breakfast: {
      time: "07:30 AM - 09:00 AM",
      items: ["Steamed Idli & Podi Dosa", "Tomato Chutney & Vadacurry", "Fresh Fruits & Boiled Eggs", "Coffee & Tea"],
      highlight: "Crispy Dosa Day",
      calories: "420 kcal",
    },
    lunch: {
      time: "12:30 PM - 02:15 PM",
      items: ["Hyderabadi Veg Biryani / Egg Biryani", "Mirchi Ka Salan & Onion Raitha", "White Rice & Tomato Rasam", "Crispy Chips & Ice Cream"],
      highlight: "Hyderabadi Dum Biryani",
      calories: "720 kcal",
    },
    snacks: {
      time: "04:45 PM - 05:45 PM",
      items: ["Sweet Corn Chaat", "Lemon Tea & Filter Coffee"],
      highlight: "Healthy Corn Snack",
      calories: "180 kcal",
    },
    dinner: {
      time: "07:30 PM - 09:15 PM",
      items: ["Chapati & Dal Makhani", "Veg Fried Rice & Gobi Manchurian", "Warm Badam Milk"],
      highlight: "Indo-Chinese Fusion",
      calories: "580 kcal",
    },
  },
  Wednesday: {
    breakfast: {
      time: "07:30 AM - 09:00 AM",
      items: ["Poori & Potato Masala", "Rava Kesari", "Boiled Sprouts & Tea"],
      highlight: "Fluffy Poori Special",
      calories: "510 kcal",
    },
    lunch: {
      time: "12:30 PM - 02:15 PM",
      items: ["White Rice & Mor Kuzhambu", "Mutton Gravy (Non-Veg Spl) / Mushroom Curry", "Beetroot Poriyal & Curd"],
      highlight: "Mid-Week Special Feast",
      calories: "690 kcal",
    },
    snacks: {
      time: "04:45 PM - 05:45 PM",
      items: ["Veg Cutlet & Sauce", "Masala Chai"],
      highlight: "Hot Cutlet",
      calories: "210 kcal",
    },
    dinner: {
      time: "07:30 PM - 09:15 PM",
      items: ["Malabar Parotta & Veg Kurma", "Curd Rice & Pickle", "Hot Milk"],
      highlight: "Malabar Delicacy",
      calories: "610 kcal",
    },
  },
  Thursday: {
    breakfast: {
      time: "07:30 AM - 09:00 AM",
      items: ["Rava Upma & Coconut Chutney", "Medu Vada & Sambar", "Fresh Bananas & Coffee"],
      highlight: "Traditional Breakfast",
      calories: "410 kcal",
    },
    lunch: {
      time: "12:30 PM - 02:15 PM",
      items: ["Curd Rice & Lemon Rice", "Potato Roast & Appalam", "Vatha Kuzhambu & White Rice"],
      highlight: "Variety Rice Extravaganza",
      calories: "640 kcal",
    },
    snacks: {
      time: "04:45 PM - 05:45 PM",
      items: ["Samosa & Green Chutney", "Filter Coffee"],
      highlight: "Punjabi Samosa",
      calories: "240 kcal",
    },
    dinner: {
      time: "07:30 PM - 09:15 PM",
      items: ["Phulka & Kadai Veg", "Steamed Rice & Garlic Rasam", "Gulab Jamun & Milk"],
      highlight: "Sweet Treat Night",
      calories: "570 kcal",
    },
  },
  Friday: {
    breakfast: {
      time: "07:30 AM - 09:00 AM",
      items: ["Aloo Paratha & Curd", "Pickle & Butter", "Boiled Egg & Tea"],
      highlight: "Punjabi Paratha",
      calories: "480 kcal",
    },
    lunch: {
      time: "12:30 PM - 02:15 PM",
      items: ["Steamed Rice & Drumstick Sambar", "Fish Curry (Non-Veg Spl) / Paneer Tikka", "Keerai Kootu & Curd"],
      highlight: "Grand Friday Lunch",
      calories: "710 kcal",
    },
    snacks: {
      time: "04:45 PM - 05:45 PM",
      items: ["Banana Bajji & Chutney", "Chai"],
      highlight: "Crispy Bajji",
      calories: "230 kcal",
    },
    dinner: {
      time: "07:30 PM - 09:15 PM",
      items: ["Idiyappam & Coconut Milk", "Veg Stew / Egg Curry", "Warm Halwa"],
      highlight: "Idiyappam Feast",
      calories: "520 kcal",
    },
  },
  Saturday: {
    breakfast: {
      time: "08:00 AM - 09:30 AM",
      items: ["Masala Dosa & Sambar", "3 Types Chutneys", "Filter Coffee"],
      highlight: "Weekend Dosa Special",
      calories: "460 kcal",
    },
    lunch: {
      time: "12:30 PM - 02:15 PM",
      items: ["Kashmiri Pulao & Dum Aloo", "White Rice & Dal", "Papad & Raita"],
      highlight: "Kashmiri Pulao",
      calories: "650 kcal",
    },
    snacks: {
      time: "04:45 PM - 05:45 PM",
      items: ["Sundal & Tea"],
      highlight: "Healthy Protein Snack",
      calories: "170 kcal",
    },
    dinner: {
      time: "07:30 PM - 09:15 PM",
      items: ["Naan & Paneer Butter Masala", "Veg Biryani & Curd Rice", "Ice Cream"],
      highlight: "Weekend Dinner Party",
      calories: "680 kcal",
    },
  },
  Sunday: {
    breakfast: {
      time: "08:00 AM - 09:30 AM",
      items: ["Chole Bhature & Onion Salad", "Sweet Lassi & Coffee"],
      highlight: "Grand Sunday Brunch",
      calories: "590 kcal",
    },
    lunch: {
      time: "12:30 PM - 02:30 PM",
      items: ["Special Thalassery Dum Biryani (Chicken / Veg)", "Boiled Egg & Brinjal Gravy", "Onion Raitha & Bread Halwa"],
      highlight: "Sunday Royal Biryani Feast",
      calories: "820 kcal",
    },
    snacks: {
      time: "04:45 PM - 05:45 PM",
      items: ["Cookies & Masala Chai"],
      highlight: "Evening Refreshment",
      calories: "160 kcal",
    },
    dinner: {
      time: "07:30 PM - 09:15 PM",
      items: ["Soft Phulka & Mixed Veg Curry", "Jeera Rice & Rasam", "Fresh Cut Watermelon & Milk"],
      highlight: "Light Sunday Dinner",
      calories: "490 kcal",
    },
  },
};

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

// ---------------- Helpers ----------------
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

  // Auto select today's day and current active meal
  const [selectedDay, setSelectedDay] = useState(getCurrentDayName());
  const [activeMealFilter, setActiveMealFilter] = useState("all");

  const todayDayName = useMemo(() => getCurrentDayName(), []);
  const currentLiveMeal = useMemo(() => getCurrentMealType(), []);

  useEffect(() => {
    if (visible) {
      const today = getCurrentDayName();
      const currentMeal = getCurrentMealType();
      setSelectedDay(today);
      setActiveMealFilter(currentMeal);
    }
  }, [visible]);

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
    return MESS_SCHEDULE[selectedDay] || MESS_SCHEDULE.Monday;
  }, [selectedDay]);

  const displayedMealKeys = useMemo(() => {
    if (activeMealFilter === "all") return ["breakfast", "lunch", "snacks", "dinner"];
    return [activeMealFilter];
  }, [activeMealFilter]);

  const handleShareMenu = async () => {
    try {
      await Share.share({
        title: `Campus Dining Menu - ${selectedDay}`,
        message: `🍽️ EDUNEX CAMPUS & HOSTEL DINING MENU (${selectedDay.toUpperCase()})\n\n☕ BREAKFAST (${todayMenu.breakfast.time})\n${todayMenu.breakfast.items.join(", ")}\n\n🍛 LUNCH (${todayMenu.lunch.time})\n${todayMenu.lunch.items.join(", ")}\n\n🍵 SNACKS (${todayMenu.snacks.time})\n${todayMenu.snacks.items.join(", ")}\n\n🍲 DINNER (${todayMenu.dinner.time})\n${todayMenu.dinner.items.join(", ")}\n\nVerified by Central Campus Mess Committee.`,
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
              <Text style={styles.fullHeaderTitle}>Campus & Mess Dining Menu</Text>
              <View style={styles.todayLivePill}>
                <Text style={styles.todayLivePillText}>LIVE AUTO-SYNC</Text>
              </View>
            </View>
            <Text style={styles.fullHeaderSub}>
              {todayDayName} · Currently serving: {currentLiveMeal.toUpperCase()}
            </Text>
          </View>
          <TouchableOpacity style={styles.headerBtn} onPress={handleShareMenu}>
            <Icon name="share-variant" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Content Body */}
        <View style={[styles.bodyContainer, { backgroundColor: colors.cardBackground }]}>
          {/* 1. SEAMLESS 7-DAY CALENDAR STRIP (No horizontal overflowing scroll) */}
          <View style={[styles.weekStripContainer, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
            {DAYS_OF_WEEK.map((item) => {
              const isSel = selectedDay === item.full;
              const isToday = item.full === todayDayName;

              return (
                <TouchableOpacity
                  key={item.full}
                  style={[
                    styles.weekDayButton,
                    isSel && { backgroundColor: colors.primaryAccent, borderColor: colors.primaryAccent },
                  ]}
                  onPress={() => setSelectedDay(item.full)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.weekDayText,
                      { color: isSel ? "#FFFFFF" : colors.secondaryText },
                      isSel && { fontWeight: "900" },
                    ]}
                  >
                    {item.short}
                  </Text>
                  {isToday ? (
                    <View
                      style={[
                        styles.todayDot,
                        { backgroundColor: isSel ? "#FFFFFF" : colors.primaryAccent },
                      ]}
                    />
                  ) : (
                    <View style={styles.emptyDot} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* 2. DAY TITLE & STEPPER CONTROL (Prev / Next Arrows + Jump to Today) */}
          <View style={[styles.dayStepperRow, { borderBottomColor: colors.divider }]}>
            <TouchableOpacity
              onPress={handlePrevDay}
              style={[styles.stepperBtn, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}
              activeOpacity={0.7}
            >
              <Icon name="chevron-left" size={20} color={colors.primaryText} />
            </TouchableOpacity>

            <View style={styles.dayTitleCenter}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Icon name="calendar-month-outline" size={16} color={colors.primaryAccent} />
                <Text style={[styles.dayTitleText, { color: colors.primaryText }]}>
                  {selectedDay + "'s Menu"}
                </Text>
                {isSelectedDayToday && (
                  <View style={[styles.todayBadge, { backgroundColor: "#10B98118", borderColor: "#10B98144" }]}>
                    <Text style={styles.todayBadgeText}>TODAY</Text>
                  </View>
                )}
              </View>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              {!isSelectedDayToday && (
                <TouchableOpacity
                  style={[styles.jumpTodayBtn, { backgroundColor: colors.primaryAccent + "18", borderColor: colors.primaryAccent }]}
                  onPress={() => setSelectedDay(todayDayName)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.jumpTodayText, { color: colors.primaryAccent }]}>Today</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={handleNextDay}
                style={[styles.stepperBtn, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}
                activeOpacity={0.7}
              >
                <Icon name="chevron-right" size={20} color={colors.primaryText} />
              </TouchableOpacity>
            </View>
          </View>

          {/* 3. MEAL CATEGORY SEGMENT TABS */}
          <View style={styles.mealSegmentWrap}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              <TouchableOpacity
                style={[
                  styles.mealFilterPill,
                  activeMealFilter === "all"
                    ? { backgroundColor: colors.primaryAccent, borderColor: colors.primaryAccent }
                    : { backgroundColor: colors.primaryBackground, borderColor: colors.divider },
                ]}
                onPress={() => setActiveMealFilter("all")}
              >
                <Text style={[styles.mealFilterText, { color: activeMealFilter === "all" ? "#FFFFFF" : colors.secondaryText }]}>
                  All Meals (4)
                </Text>
              </TouchableOpacity>

              {["breakfast", "lunch", "snacks", "dinner"].map((m) => {
                const isSel = activeMealFilter === m;
                const isLive = isSelectedDayToday && currentLiveMeal === m;
                const col = MEAL_COLORS[m];

                return (
                  <TouchableOpacity
                    key={m}
                    style={[
                      styles.mealFilterPill,
                      isSel
                        ? { backgroundColor: col, borderColor: col }
                        : { backgroundColor: colors.primaryBackground, borderColor: colors.divider },
                    ]}
                    onPress={() => setActiveMealFilter(m)}
                  >
                    <Icon name={MEAL_ICONS[m]} size={13} color={isSel ? "#FFFFFF" : col} />
                    <Text
                      style={[
                        styles.mealFilterText,
                        {
                          color: isSel ? "#FFFFFF" : colors.primaryText,
                          fontWeight: isSel ? "800" : "600",
                        },
                      ]}
                    >
                      {m.charAt(0).toUpperCase() + m.slice(1)} {isLive ? "🟢" : ""}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* 4. MEAL CARDS LIST */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 60, gap: 12 }}
          >
            {displayedMealKeys.map((mealKey) => {
              const meal = todayMenu[mealKey];
              const mealColor = MEAL_COLORS[mealKey];
              const mealIcon = MEAL_ICONS[mealKey];
              const isServingNow = isSelectedDayToday && currentLiveMeal === mealKey;

              return (
                <View
                  key={mealKey}
                  style={[
                    styles.mealCard,
                    {
                      backgroundColor: colors.primaryBackground,
                      borderColor: isServingNow ? mealColor : colors.divider,
                      borderWidth: isServingNow ? 2 : 1,
                    },
                  ]}
                >
                  {/* Meal Header */}
                  <View style={styles.mealHeaderRow}>
                    <View style={[styles.mealIconCircle, { backgroundColor: mealColor + "18" }]}>
                      <Icon name={mealIcon} size={22} color={mealColor} />
                    </View>

                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                        <Text style={[styles.mealTitle, { color: colors.primaryText }]}>
                          {mealKey.toUpperCase()}
                        </Text>
                        {isServingNow ? (
                          <View style={[styles.servingNowBadge, { backgroundColor: "#10B98118", borderColor: "#10B98144" }]}>
                            <View style={styles.servingDot} />
                            <Text style={styles.servingNowText}>SERVING RIGHT NOW</Text>
                          </View>
                        ) : (
                          <Text style={[styles.calorieText, { color: colors.secondaryText }]}>{meal.calories}</Text>
                        )}
                      </View>
                      <Text style={[styles.mealTime, { color: colors.secondaryText }]}>{meal.time}</Text>
                    </View>
                  </View>

                  {/* Highlight Banner */}
                  <View style={[styles.highlightBanner, { backgroundColor: mealColor + "14" }]}>
                    <Icon name="star-outline" size={14} color={mealColor} />
                    <Text style={[styles.highlightText, { color: mealColor }]}>
                      Special: {meal.highlight}
                    </Text>
                  </View>

                  {/* Menu Items List */}
                  <View style={styles.itemsListWrap}>
                    {meal.items.map((item, idx) => (
                      <View key={idx} style={styles.itemRow}>
                        <Icon name="check-circle-outline" size={15} color="#10B981" />
                        <Text style={[styles.itemText, { color: colors.primaryText }]}>{item}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              );
            })}

            {/* Nutrition & Quality Assurance Note */}
            <View style={[styles.hygieneNoteCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
              <Icon name="shield-check" size={20} color="#10B981" />
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={[styles.hygieneTitle, { color: colors.primaryText }]}>FSSAI & ISO 22000 Certified Dining</Text>
                <Text style={[styles.hygieneSub, { color: colors.secondaryText }]}>
                  All meals prepared under strict hygienic conditions. RO water used for cooking. Mess Warden: 0422-2680199.
                </Text>
              </View>
            </View>
          </ScrollView>
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
      paddingTop: 44,
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
      letterSpacing: -0.2,
    },
    fullHeaderSub: {
      color: "rgba(255,255,255,0.8)",
      fontSize: 11,
      fontWeight: "500",
      marginTop: 2,
    },
    todayLivePill: {
      backgroundColor: "rgba(255,255,255,0.2)",
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    todayLivePillText: {
      color: "#FFFFFF",
      fontSize: 8.5,
      fontWeight: "900",
    },
    bodyContainer: {
      flex: 1,
      paddingTop: 10,
    },
    weekStripContainer: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginHorizontal: 16,
      padding: 4,
      borderRadius: 14,
      borderWidth: 1,
      marginBottom: 8,
    },
    weekDayButton: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 7,
      borderRadius: 10,
    },
    weekDayText: {
      fontSize: 12,
      fontWeight: "700",
    },
    todayDot: {
      width: 4,
      height: 4,
      borderRadius: 2,
      marginTop: 3,
    },
    emptyDot: {
      width: 4,
      height: 4,
      marginTop: 3,
    },
    dayStepperRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingBottom: 10,
      borderBottomWidth: 1,
      marginBottom: 10,
    },
    stepperBtn: {
      width: 32,
      height: 32,
      borderRadius: 8,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    dayTitleCenter: {
      flex: 1,
      alignItems: "center",
    },
    dayTitleText: {
      fontSize: 14,
      fontWeight: "800",
    },
    todayBadge: {
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderRadius: 4,
      borderWidth: 1,
    },
    todayBadgeText: {
      color: "#10B981",
      fontSize: 8.5,
      fontWeight: "900",
    },
    jumpTodayBtn: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      borderWidth: 1,
    },
    jumpTodayText: {
      fontSize: 10.5,
      fontWeight: "800",
    },
    mealSegmentWrap: {
      paddingHorizontal: 16,
      marginBottom: 10,
    },
    mealFilterPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
    },
    mealFilterText: {
      fontSize: 11.5,
      fontWeight: "700",
    },
    mealCard: {
      borderRadius: 16,
      padding: 14,
    },
    mealHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    mealIconCircle: {
      width: 42,
      height: 42,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
    },
    mealTitle: {
      fontSize: 13.5,
      fontWeight: "900",
      letterSpacing: 0.5,
    },
    mealTime: {
      fontSize: 11,
      fontWeight: "600",
      marginTop: 2,
    },
    servingNowBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 4,
      borderWidth: 1,
    },
    servingDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: "#10B981",
    },
    servingNowText: {
      color: "#10B981",
      fontSize: 8.5,
      fontWeight: "900",
    },
    calorieText: {
      fontSize: 11,
      fontWeight: "600",
    },
    highlightBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 8,
      marginVertical: 10,
    },
    highlightText: {
      fontSize: 11,
      fontWeight: "800",
    },
    itemsListWrap: {
      gap: 6,
    },
    itemRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    itemText: {
      fontSize: 12.5,
      fontWeight: "600",
    },
    hygieneNoteCard: {
      flexDirection: "row",
      alignItems: "center",
      padding: 12,
      borderRadius: 14,
      borderWidth: 1,
      marginTop: 6,
    },
    hygieneTitle: {
      fontSize: 12,
      fontWeight: "800",
    },
    hygieneSub: {
      fontSize: 10.5,
      fontWeight: "500",
      marginTop: 2,
    },
  });

import React, { useState, useMemo } from "react";
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

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const MESS_SCHEDULE = {
  Monday: {
    breakfast: {
      time: "07:30 AM - 09:00 AM",
      items: ["Ghee Pongal & Medu Vada", "Coconut Chutney & Sambar", "Bread Butter Jam", "Tea & Filter Coffee"],
      highlight: "Hot Pongal Special",
      calories: "450 kcal",
      isLive: false,
    },
    lunch: {
      time: "12:30 PM - 02:15 PM",
      items: ["Steamed Sona Masoori Rice", "Chettinad Veg Gravy / Chicken Chukka (Spl)", "South Indian Sambar & Rasam", "Poriyal & Appalam", "Thick Curd & Payasam"],
      highlight: "Chettinad Special Feast",
      calories: "680 kcal",
      isLive: true,
    },
    snacks: {
      time: "04:45 PM - 05:45 PM",
      items: ["Onion Pakoda & Mint Chutney", "Biscuits & Cookies", "Masala Chai / Hot Coffee"],
      highlight: "Crispy Evening Snack",
      calories: "220 kcal",
      isLive: false,
    },
    dinner: {
      time: "07:30 PM - 09:15 PM",
      items: ["Soft Phulka Roti (2 pcs)", "Paneer Butter Masala", "Jeera Rice & Dal Tadka", "Fresh Green Salad & Milk"],
      highlight: "North Indian Delicacy",
      calories: "550 kcal",
      isLive: false,
    },
  },
  Tuesday: {
    breakfast: {
      time: "07:30 AM - 09:00 AM",
      items: ["Steamed Idli & Podi Dosa", "Tomato Chutney & Vadacurry", "Fresh Fruits & Boiled Eggs", "Coffee & Tea"],
      highlight: "Crispy Dosa Day",
      calories: "420 kcal",
      isLive: false,
    },
    lunch: {
      time: "12:30 PM - 02:15 PM",
      items: ["Hyderabadi Veg Biryani / Egg Biryani", "Mirchi Ka Salan & Onion Raitha", "White Rice & Tomato Rasam", "Crispy Chips & Ice Cream"],
      highlight: "Hyderabadi Dum Biryani",
      calories: "720 kcal",
      isLive: false,
    },
    snacks: {
      time: "04:45 PM - 05:45 PM",
      items: ["Sweet Corn Chaat", "Lemon Tea & Filter Coffee"],
      highlight: "Healthy Corn Snack",
      calories: "180 kcal",
      isLive: false,
    },
    dinner: {
      time: "07:30 PM - 09:15 PM",
      items: ["Chapati & Dal Makhani", "Veg Fried Rice & Gobi Manchurian", "Warm Badam Milk"],
      highlight: "Indo-Chinese Fusion",
      calories: "580 kcal",
      isLive: false,
    },
  },
  Wednesday: {
    breakfast: {
      time: "07:30 AM - 09:00 AM",
      items: ["Poori & Potato Masala", "Rava Kesari", "Boiled Sprouts & Tea"],
      highlight: "Fluffy Poori Special",
      calories: "510 kcal",
      isLive: false,
    },
    lunch: {
      time: "12:30 PM - 02:15 PM",
      items: ["White Rice & Mor Kuzhambu", "Mutton Gravy (Non-Veg Spl) / Mushroom Curry", "Beetroot Poriyal & Curd"],
      highlight: "Mid-Week Special Feast",
      calories: "690 kcal",
      isLive: false,
    },
    snacks: {
      time: "04:45 PM - 05:45 PM",
      items: ["Veg Cutlet & Sauce", "Masala Chai"],
      highlight: "Hot Cutlet",
      calories: "210 kcal",
      isLive: false,
    },
    dinner: {
      time: "07:30 PM - 09:15 PM",
      items: ["Malabar Parotta & Veg Kurma", "Curd Rice & Pickle", "Hot Milk"],
      highlight: "Malabar Delicacy",
      calories: "610 kcal",
      isLive: false,
    },
  },
  Thursday: {
    breakfast: {
      time: "07:30 AM - 09:00 AM",
      items: ["Rava Upma & Coconut Chutney", "Medu Vada & Sambar", "Fresh Bananas & Coffee"],
      highlight: "Traditional Breakfast",
      calories: "410 kcal",
      isLive: false,
    },
    lunch: {
      time: "12:30 PM - 02:15 PM",
      items: ["Curd Rice & Lemon Rice", "Potato Roast & Appalam", "Vatha Kuzhambu & White Rice"],
      highlight: "Variety Rice Extravaganza",
      calories: "640 kcal",
      isLive: false,
    },
    snacks: {
      time: "04:45 PM - 05:45 PM",
      items: ["Samosa & Green Chutney", "Filter Coffee"],
      highlight: "Punjabi Samosa",
      calories: "240 kcal",
      isLive: false,
    },
    dinner: {
      time: "07:30 PM - 09:15 PM",
      items: ["Phulka & Kadai Veg", "Steamed Rice & Garlic Rasam", "Gulab Jamun & Milk"],
      highlight: "Sweet Treat Night",
      calories: "570 kcal",
      isLive: false,
    },
  },
  Friday: {
    breakfast: {
      time: "07:30 AM - 09:00 AM",
      items: ["Aloo Paratha & Curd", "Pickle & Butter", "Boiled Egg & Tea"],
      highlight: "Punjabi Paratha",
      calories: "480 kcal",
      isLive: false,
    },
    lunch: {
      time: "12:30 PM - 02:15 PM",
      items: ["Steamed Rice & Drumstick Sambar", "Fish Curry (Non-Veg Spl) / Paneer Tikka", "Keerai Kootu & Curd"],
      highlight: "Grand Friday Lunch",
      calories: "710 kcal",
      isLive: false,
    },
    snacks: {
      time: "04:45 PM - 05:45 PM",
      items: ["Banana Bajji & Chutney", "Chai"],
      highlight: "Crispy Bajji",
      calories: "230 kcal",
      isLive: false,
    },
    dinner: {
      time: "07:30 PM - 09:15 PM",
      items: ["Idiyappam & Coconut Milk", "Veg Stew / Egg Curry", "Warm Halwa"],
      highlight: "Idiyappam Feast",
      calories: "520 kcal",
      isLive: false,
    },
  },
  Saturday: {
    breakfast: {
      time: "08:00 AM - 09:30 AM",
      items: ["Masala Dosa & Sambar", "3 Types Chutneys", "Filter Coffee"],
      highlight: "Weekend Dosa Special",
      calories: "460 kcal",
      isLive: false,
    },
    lunch: {
      time: "12:30 PM - 02:15 PM",
      items: ["Kashmiri Pulao & Dum Aloo", "White Rice & Dal", "Papad & Raita"],
      highlight: "Kashmiri Pulao",
      calories: "650 kcal",
      isLive: false,
    },
    snacks: {
      time: "04:45 PM - 05:45 PM",
      items: ["Sundal & Tea"],
      highlight: "Healthy Protein Snack",
      calories: "170 kcal",
      isLive: false,
    },
    dinner: {
      time: "07:30 PM - 09:15 PM",
      items: ["Naan & Paneer Butter Masala", "Veg Biryani & Curd Rice", "Ice Cream"],
      highlight: "Weekend Dinner Party",
      calories: "680 kcal",
      isLive: false,
    },
  },
  Sunday: {
    breakfast: {
      time: "08:00 AM - 09:30 AM",
      items: ["Chole Bhature & Onion Salad", "Sweet Lassi & Coffee"],
      highlight: "Grand Sunday Brunch",
      calories: "590 kcal",
      isLive: false,
    },
    lunch: {
      time: "12:30 PM - 02:30 PM",
      items: ["Special Thalassery Dum Biryani (Chicken / Veg)", "Boiled Egg & Brinjal Gravy", "Onion Raitha & Bread Halwa"],
      highlight: "Sunday Royal Biryani Feast",
      calories: "820 kcal",
      isLive: false,
    },
    snacks: {
      time: "04:45 PM - 05:45 PM",
      items: ["Cookies & Masala Chai"],
      highlight: "Evening Refreshment",
      calories: "160 kcal",
      isLive: false,
    },
    dinner: {
      time: "07:30 PM - 09:15 PM",
      items: ["Soft Phulka & Mixed Veg Curry", "Jeera Rice & Rasam", "Fresh Cut Watermelon & Milk"],
      highlight: "Light Sunday Dinner",
      calories: "490 kcal",
      isLive: false,
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

export default function MessMenuModal({ visible, onClose }) {
  const { colors, isDarkMode } = useTheme();
  const styles = getStyles(colors, isDarkMode);

  const [selectedDay, setSelectedDay] = useState("Monday");
  const [dietaryFilter, setDietaryFilter] = useState("All");

  const todayMenu = useMemo(() => {
    return MESS_SCHEDULE[selectedDay] || MESS_SCHEDULE.Monday;
  }, [selectedDay]);

  const handleShareMenu = async () => {
    try {
      await Share.share({
        title: `Campus Dining Menu - ${selectedDay}`,
        message: `🍽️ EDUNEX CAMPUS & HOSTEL DINING MENU (${selectedDay.toUpperCase()})\n\n☕ BREAKFAST (${todayMenu.breakfast.time})\n${todayMenu.breakfast.items.join(", ")}\n\n🍛 LUNCH (${todayMenu.lunch.time})\n${todayMenu.lunch.items.join(", ")}\n\n🍵 SNACKS (${todayMenu.snacks.time})\n${todayMenu.snacks.items.join(", ")}\n\n🍲 DINNER (${todayMenu.dinner.time})\n${todayMenu.dinner.items.join(", ")}\n\nVerified by Central Campus Mess Committee.`,
      });
      showToast("Dining menu shared!", "success");
    } catch (_e) {}
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlayFull}>
        {/* Header */}
        <View style={[styles.fullHeader, { backgroundColor: colors.primaryAccent }]}>
          <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
            <Icon name="arrow-left" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.fullHeaderTitle}>Campus & Mess Dining Menu</Text>
            <Text style={styles.fullHeaderSub}>Daily Hostels & Cafeteria Food Timetable</Text>
          </View>
          <TouchableOpacity style={styles.headerBtn} onPress={handleShareMenu}>
            <Icon name="share-variant" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Content Body */}
        <View style={[styles.bodyContainer, { backgroundColor: colors.cardBackground }]}>
          {/* Day Horizontal Selector */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingHorizontal: 16, marginBottom: 12 }}
          >
            {DAYS_OF_WEEK.map((d) => {
              const isSel = selectedDay === d;
              return (
                <TouchableOpacity
                  key={d}
                  style={[
                    styles.dayPill,
                    isSel
                      ? { backgroundColor: colors.primaryAccent, borderColor: colors.primaryAccent }
                      : { backgroundColor: colors.primaryBackground, borderColor: colors.divider },
                  ]}
                  onPress={() => setSelectedDay(d)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.dayPillText, { color: isSel ? "#FFFFFF" : colors.primaryText }]}>
                    {d}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Meals List */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 60, gap: 12 }}
          >
            {["breakfast", "lunch", "snacks", "dinner"].map((mealKey) => {
              const meal = todayMenu[mealKey];
              const mealColor = MEAL_COLORS[mealKey];
              const mealIcon = MEAL_ICONS[mealKey];
              const isServingNow = meal.isLive;

              return (
                <View
                  key={mealKey}
                  style={[
                    styles.mealCard,
                    {
                      backgroundColor: colors.primaryBackground,
                      borderColor: isServingNow ? mealColor : colors.divider,
                      borderWidth: isServingNow ? 1.8 : 1,
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
                            <Text style={styles.servingNowText}>SERVING NOW</Text>
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
    },
    bodyContainer: {
      flex: 1,
      paddingTop: 12,
    },
    dayPill: {
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 10,
      borderWidth: 1,
    },
    dayPillText: {
      fontSize: 12,
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

import React from "react";
import { Platform } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { useTheme } from "../../context/ThemeContext";
import { emitRouteChange } from "../../services/navigationEvents";

import DashboardStaff from "../../screens/staff/DashboardStaff";
import AttendanceStaff from "../../screens/staff/AttendanceStaff";
import StudentsStaff from "../../screens/staff/StudentsStaff";
import ProfileStaff from "../../screens/staff/ProfileStaff";

const Tab = createBottomTabNavigator();

export default function AppNavigatorStaff({ onLogout, userRole }) {
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      screenListeners={{
        tabPress: (e) => {
          emitRouteChange(e?.target);
        },
        state: (e) => {
          const current = e?.data?.state?.routes?.[e?.data?.state?.index]?.name;
          if (current) emitRouteChange(current);
        },
      }}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.disabledText,
        tabBarStyle: {
          backgroundColor: colors.cardBackground,
          borderTopColor: colors.divider,
          borderTopWidth: 1,
          height: Platform.OS === "ios" ? 85 : 68,
          paddingBottom: Platform.OS === "ios" ? 24 : 10,
          paddingTop: 8,
          elevation: 8,
          shadowColor: colors.shadow,
          shadowOpacity: 0.1,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: -3 },
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "700",
          marginTop: 2,
        },
        tabBarIcon: ({ color, focused, size }) => {
          let iconName;
          switch (route.name) {
            case "Dashboard":
              iconName = focused ? "view-dashboard" : "view-dashboard-outline";
              break;
            case "Attendance":
              iconName = focused ? "clipboard-check" : "clipboard-check-outline";
              break;
            case "Students":
              iconName = focused ? "account-group" : "account-group-outline";
              break;
            case "Profile":
              iconName = focused ? "account" : "account-outline";
              break;
            default:
              iconName = "circle-outline";
          }
          return <Icon name={iconName} color={color} size={focused ? 24 : 22} />;
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardStaff} />
      <Tab.Screen name="Attendance" component={AttendanceStaff} />
      <Tab.Screen name="Students" component={StudentsStaff} />
      <Tab.Screen name="Profile">
        {(props) => <ProfileStaff {...props} onLogout={onLogout} userRole={userRole} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}
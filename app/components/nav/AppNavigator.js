import React from "react";
import { Platform } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { useTheme } from "../../context/ThemeContext";

import DashboardScreen from "../../screens/students/DashboardScreen";
import AcademicsScreen from "../../screens/students/AcademicsScreen";
import FeesScreen from "../../screens/students/FeesScreen";
import AdmissionFormScreen from "../../screens/students/AdmissionFormScreen";
import ProfileScreen from "../../screens/students/ProfileScreen";

const Tab = createBottomTabNavigator();

export default function AppNavigator({ onLogout, userRole }) {
  const { colors } = useTheme();

  return (
    <Tab.Navigator
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
            case "Academics":
              iconName = focused ? "book-open-variant" : "book-open-page-variant-outline";
              break;
            case "Fees":
              iconName = focused ? "credit-card" : "credit-card-outline";
              break;
            case "Apply":
              iconName = focused ? "file-document-edit" : "file-document-edit-outline";
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
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Academics" component={AcademicsScreen} />
      <Tab.Screen name="Fees" component={FeesScreen} />
      <Tab.Screen name="Apply" component={AdmissionFormScreen} />
      <Tab.Screen name="Profile">
        {() => <ProfileScreen onLogout={onLogout} userRole={userRole} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}
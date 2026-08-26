import React from "react";
import { Platform } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { useTheme } from "../../context/ThemeContext";

// Import admin-specific screens
import DashboardAdmin from "../../screens/admin/DashboardAdmin";
import ManageUsersAdmin from "../../screens/admin/ManageUsersAdmin";
import ReportsAdmin from "../../screens/admin/ReportsAdmin";
import SystemSettingsAdmin from "../../screens/admin/SystemSettingsAdmin";

const Tab = createBottomTabNavigator();

export default function AppNavigatorAdmin({ onLogout, userRole }) {
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
            case "ManageUsers":
              iconName = focused ? "account-multiple" : "account-multiple-outline";
              break;
            case "Reports":
              iconName = focused ? "file-chart" : "file-chart-outline";
              break;
            case "Settings":
              iconName = focused ? "cog" : "cog-outline";
              break;
            default:
              iconName = "circle-outline";
          }
          return <Icon name={iconName} color={color} size={focused ? 24 : 22} />;
        },
      })}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardAdmin}
        options={{ tabBarLabel: "Dashboard" }}
      />
      <Tab.Screen
        name="ManageUsers"
        component={ManageUsersAdmin}
        options={{ tabBarLabel: "Users" }}
      />
      <Tab.Screen
        name="Reports"
        component={ReportsAdmin}
        options={{ tabBarLabel: "Reports" }}
      />
      <Tab.Screen
        name="Settings"
        options={{ tabBarLabel: "Settings" }}
      >
        {() => <SystemSettingsAdmin onLogout={onLogout} userRole={userRole} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}
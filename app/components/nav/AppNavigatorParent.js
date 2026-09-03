import React from "react";
import { Platform } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { useTheme } from "../../context/ThemeContext";
import { emitRouteChange } from "../../services/navigationEvents";

// Import the Parent Screens
import DashboardParent from "../../screens/parents/DashboardParent";
import FeesParent from "../../screens/parents/FeesParent";
import MessagesParent from "../../screens/parents/MessagesParent";
import WardDetailsParent from "../../screens/parents/WardDetailsParent";
import ProfileParent from "../../screens/parents/ProfileParent";

const Tab = createBottomTabNavigator();

export default function AppNavigatorParent({ onLogout, userRole }) {
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
        tabBarHideOnKeyboard: true,
        tabBarIcon: ({ color, focused, size }) => {
          let iconName;

          switch (route.name) {
            case "Dashboard":
              iconName = focused ? "view-dashboard" : "view-dashboard-outline";
              break;
            case "Ward Details":
              iconName = focused ? "account-group" : "account-group-outline";
              break;
            case "Fees":
              iconName = focused ? "credit-card" : "credit-card-outline";
              break;
            case "Messages":
              iconName = focused ? "message-text" : "message-text-outline";
              break;
            case "Profile":
              iconName = focused ? "account-circle" : "account-circle-outline";
              break;
            default:
              iconName = "circle-outline";
          }

          return <Icon name={iconName} color={color} size={focused ? 24 : 22} />;
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardParent} />
      <Tab.Screen name="Ward Details" component={WardDetailsParent} />
      <Tab.Screen name="Fees" component={FeesParent} />
      <Tab.Screen name="Messages" component={MessagesParent} />
      <Tab.Screen name="Profile">
        {(props) => (
          <ProfileParent {...props} onLogout={onLogout} userRole={userRole} />
        )}
      </Tab.Screen>
    </Tab.Navigator>
  );
}
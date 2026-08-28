// components/AppNavigatorStudent.js
import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { NavigationContainer } from "@react-navigation/native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";

import DashboardScreen from "../screens/students/DashboardScreen";
import AcademicsScreen from "../screens/students/AcademicsScreen";
import DocSpaceScreen from "../screens/students/DocSpaceScreen";
import FeesScreen from "../screens/students/FeesScreen";
import ProfileScreen from "../screens/students/ProfileScreen";

const Tab = createBottomTabNavigator();

export default function AppNavigatorStudent() {
  return (
    <NavigationContainer independent={true}>
      <Tab.Navigator
        initialRouteName="Dashboard"
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: "#007AFF",
          tabBarInactiveTintColor: "gray",
          tabBarStyle: {
            backgroundColor: "#fff",
            borderTopWidth: 0.5,
            borderTopColor: "#ccc",
            paddingBottom: 5,
            height: 60,
          },
          tabBarIcon: ({ color, size }) => {
            let iconName;

            switch (route.name) {
              case "Dashboard":
                iconName = "view-dashboard";
                break;
              case "Academics":
                iconName = "school";
                break;
              case "DocSpace":
                iconName = "folder-account";
                break;
              case "Fees":
                iconName = "cash";
                break;
              case "Profile":
                iconName = "account";
                break;
              default:
                iconName = "circle";
            }

            return <Icon name={iconName} color={color} size={size} />;
          },
        })}
      >
        <Tab.Screen name="Dashboard" component={DashboardScreen} />
        <Tab.Screen name="Academics" component={AcademicsScreen} />
        <Tab.Screen name="DocSpace" component={DocSpaceScreen} />
        <Tab.Screen name="Fees" component={FeesScreen} />
        <Tab.Screen name="Profile" component={ProfileScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
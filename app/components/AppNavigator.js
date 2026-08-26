import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import DashboardScreen from '../screens/DashboardScreen';
import AcademicsScreen from '../screens/AcademicsScreen';
import FeesScreen from '../screens/FeesScreen';
import ProfileScreen from '../screens/ProfileScreen';
import AdmissionFormScreen from '../screens/AdmissionFormScreen'; // Import the new screen

const Tab = createBottomTabNavigator();

const TAB_OPTIONS = {
  headerShown: false,
  tabBarActiveTintColor: '#FFFFFF',
  tabBarInactiveTintColor: '#ADD8E6',
  tabBarStyle: {
    backgroundColor: '#2200FF',
    height: 100,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
    paddingTop: 20,
    bottom: -30,
    position: 'absolute',
    borderTopWidth: 0,
    elevation: 0,
  },
  tabBarLabelStyle: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: -4,
  },
  tabBarHideOnKeyboard: true,
};

export default function AppNavigator() {
  return (
    <Tab.Navigator screenOptions={TAB_OPTIONS}>
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Icon name="view-dashboard" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Academics"
        component={AcademicsScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Icon name="book-open-variant" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Fees"
        component={FeesScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Icon name="credit-card" color={color} size={size} />
          ),
        }}
      />
      {/* New tab for Admission Form */}
      <Tab.Screen
        name="Apply" // You can choose a different name
        component={AdmissionFormScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Icon name="file-document-edit" color={color} size={size} /> // A file/form icon
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Icon name="account" color={color} size={size} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  StatusBar,
  RefreshControl,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function SkipScreen({ onLogout, setShowModal }) {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 800);
  }, []);

  const handleGuestSignIn = async () => {
    await AsyncStorage.setItem("loggedInUser", "guest");
    await AsyncStorage.setItem("userRole", "guest");
    await AsyncStorage.setItem(
      "userData",
      JSON.stringify({ role: "guest", id: "guest", name: "Guest User" })
    );

    setShowModal?.(true);
  };

  return (
    <LinearGradient colors={["#0F172A", "#1E1B4B", "#312E81"]} style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#6366F1"]}
            tintColor="#6366F1"
            progressBackgroundColor="#1E1B4B"
          />
        }
      >
        {/* Top Hero Brand Header */}
        <View style={styles.header}>
          <View style={styles.badgeWrap}>
            <View style={styles.badgeDot} />
            <Text style={styles.badgeText}>GUEST PREVIEW MODE</Text>
          </View>
          <Text style={styles.appTitle}>EduNex</Text>
          <Text style={styles.subtitle}>Unified Smart Educational Management</Text>
        </View>

        {/* Main Feature Highlight Card */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardIconWrap}>
              <Icon name="compass-outline" size={24} color="#4F46E5" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.cardTitle}>Welcome to EduNex</Text>
              <Text style={styles.cardSubtitle}>
                Experience a connected ecosystem for Students, Faculty, Parents, and Administrators.
              </Text>
            </View>
          </View>

          {/* Feature Grid */}
          <View style={styles.featuresGrid}>
            <View style={styles.featureBox}>
              <View style={[styles.featureIconWrap, { backgroundColor: "rgba(79, 70, 229, 0.12)" }]}>
                <Icon name="view-dashboard-outline" size={24} color="#4F46E5" />
              </View>
              <Text style={styles.featureTitle}>Student Hub</Text>
              <Text style={styles.featureDesc}>CGPA, Timetables, Fee Portal & Leaves</Text>
            </View>

            <View style={styles.featureBox}>
              <View style={[styles.featureIconWrap, { backgroundColor: "rgba(13, 148, 136, 0.12)" }]}>
                <Icon name="account-tie-outline" size={24} color="#0D9488" />
              </View>
              <Text style={styles.featureTitle}>Faculty Portal</Text>
              <Text style={styles.featureDesc}>Live Attendance, Rosters & Tests</Text>
            </View>

            <View style={styles.featureBox}>
              <View style={[styles.featureIconWrap, { backgroundColor: "rgba(168, 85, 247, 0.12)" }]}>
                <Icon name="account-child-outline" size={24} color="#8B5CF6" />
              </View>
              <Text style={styles.featureTitle}>Parent Desk</Text>
              <Text style={styles.featureDesc}>Ward Progress, Alerts & Gate Passes</Text>
            </View>

            <View style={styles.featureBox}>
              <View style={[styles.featureIconWrap, { backgroundColor: "rgba(239, 68, 68, 0.12)" }]}>
                <Icon name="shield-check-outline" size={24} color="#EF4444" />
              </View>
              <Text style={styles.featureTitle}>Admin Suite</Text>
              <Text style={styles.featureDesc}>User Directory, Analytics & Config</Text>
            </View>
          </View>

          {/* Sign In CTA */}
          <TouchableOpacity style={styles.button} onPress={handleGuestSignIn} activeOpacity={0.85}>
            <LinearGradient
              colors={["#4F46E5", "#6366F1"]}
              style={styles.buttonGradient}
            >
              <Icon name="login" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.buttonText}>Sign In / Switch Account</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          © 2026 EduNex Systems • Empowering Smart Institutions
        </Text>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight || 24) + 30 : 60,
    paddingBottom: 40,
    alignItems: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: 28,
  },
  badgeWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 6,
    marginBottom: 12,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#34D399",
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  appTitle: {
    fontSize: 40,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 14,
    color: "#CBD5E1",
    marginTop: 4,
    fontWeight: "500",
    textAlign: "center",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    padding: 22,
    width: "100%",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  cardIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#EEF2FF",
    justifyContent: "center",
    alignItems: "center",
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
  },
  cardSubtitle: {
    fontSize: 13,
    color: "#64748B",
    lineHeight: 18,
    marginTop: 2,
  },
  featuresGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 20,
  },
  featureBox: {
    width: "48%",
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  featureIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  featureTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0F172A",
  },
  featureDesc: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
    lineHeight: 15,
  },
  button: {
    borderRadius: 16,
    overflow: "hidden",
    marginTop: 8,
  },
  buttonGradient: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 16,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  footer: {
    color: "#94A3B8",
    fontSize: 12,
    marginTop: 30,
    textAlign: "center",
    fontWeight: "500",
  },
});
import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  RefreshControl,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { useTheme } from "../../context/ThemeContext";

// Modals
import WardModal from "./modals/WardModal";
import FeesModal from "./modals/FeesModal";
import MessagesModal from "./modals/MessagesModal";
import ReportModal from "./modals/ReportModal";
import { SkeletonScreenLoader } from "../../components/common/SkeletonLoader";
import { getParentData } from "../../services/dataService";
import useRefreshOnForeground from "../../hooks/useRefreshOnForeground";

// Parent overview starts empty — filled only from live MongoDB data
const DEFAULT_OVERVIEW = {
  parentName: "",
  wardName: "",
  rollNo: "",
  department: "",
  year: "",
  section: "",
  attendance: "",
  grade: "",
  cgpa: "",
  feesDue: "",
  paidFees: "",
  alerts: 0,
};

// Reusable Dashboard Card component defined outside
function ParentDashboardCard({ title, value, subtitle, iconName, color, onPress, colors }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const animateIn = () =>
    Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true }).start();
  const animateOut = () =>
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPressIn={animateIn}
        onPressOut={animateOut}
        onPress={onPress}
        style={[styles.card, { backgroundColor: colors.cardBackground, borderLeftColor: color }]}
      >
        <View style={styles.cardContent}>
          <View style={[styles.iconContainer, { backgroundColor: `${color}18` }]}>
            <Icon name={iconName} size={26} color={color} />
          </View>

          <View style={styles.textContainer}>
            <Text style={[styles.cardTitle, { color: colors.secondaryText }]}>{title}</Text>
            <Text style={[styles.cardValue, { color: colors.primaryText }]}>{value}</Text>
            {subtitle ? <Text style={[styles.cardSubtitle, { color: colors.disabledText }]}>{subtitle}</Text> : null}
          </View>

          <View style={[styles.chevronBadge, { backgroundColor: colors.cardHighlight || "rgba(0,0,0,0.04)" }]}>
            <Icon name="chevron-right" size={20} color={colors.secondaryText} />
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function DashboardParent() {
  const { colors } = useTheme();

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [parentOverview, setParentOverview] = useState(DEFAULT_OVERVIEW);

  // Modal states
  const [wardModalVisible, setWardModalVisible] = useState(false);
  const [feesModalVisible, setFeesModalVisible] = useState(false);
  const [messagesModalVisible, setMessagesModalVisible] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const data = await getParentData();
      if (data?.overview) {
        setParentOverview((prev) => ({ ...prev, ...data.overview }));
      }
    } catch (err) {
      console.warn("DashboardParent load error:", err?.message || err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Refetch live data when the app returns to the foreground
  useRefreshOnForeground(loadData);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleCardPress = (title) => {
    switch (title) {
      case "Ward Details":
        setWardModalVisible(true);
        break;
      case "Fee Summary":
        setFeesModalVisible(true);
        break;
      case "Messages & Alerts":
        setMessagesModalVisible(true);
        break;
      case "Progress Report":
        setReportModalVisible(true);
        break;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.primaryBackground }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
            progressBackgroundColor={colors.cardBackground}
          />
        }
      >
        {isLoading ? (
          <SkeletonScreenLoader showProfile showKPIs listCount={4} />
        ) : (
          <>
            {/* Ward Profile Banner Card */}
            <View style={[styles.wardProfileCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
              <View style={styles.wardHeaderRow}>
                <View style={[styles.wardAvatar, { backgroundColor: `${colors.primary}20` }]}>
                  <Icon name="account-school" size={32} color={colors.primary} />
                </View>
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={[styles.wardGreeting, { color: colors.secondaryText }]}>
                    Welcome back, {parentOverview.parentName}
                  </Text>
                  <Text style={[styles.wardName, { color: colors.primaryText }]}>
                    {parentOverview.wardName}
                  </Text>
                  <Text style={[styles.wardMeta, { color: colors.disabledText }]}>
                    {parentOverview.rollNo} • {parentOverview.year} - {parentOverview.section}
                  </Text>
                </View>
              </View>
              <View style={[styles.wardDeptPill, { backgroundColor: colors.cardHighlight || "rgba(0,0,0,0.04)" }]}>
                <Icon name="school" size={16} color={colors.primary} style={{ marginRight: 6 }} />
                <Text style={[styles.wardDeptText, { color: colors.primaryText }]}>{parentOverview.department}</Text>
              </View>
            </View>

        {/* KPI Stats Row */}
        <View style={styles.kpiRow}>
          <View style={[styles.kpiBox, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <View style={[styles.kpiIconWrap, { backgroundColor: "rgba(16, 185, 129, 0.15)" }]}>
              <Icon name="calendar-check-outline" size={22} color="#10B981" />
            </View>
            <Text style={[styles.kpiValue, { color: "#10B981" }]}>
              {parentOverview.attendance}
            </Text>
            <Text style={[styles.kpiLabel, { color: colors.secondaryText }]}>Attendance</Text>
          </View>

          <View style={[styles.kpiBox, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <View style={[styles.kpiIconWrap, { backgroundColor: "rgba(79, 70, 229, 0.15)" }]}>
              <Icon name="certificate-outline" size={22} color="#4F46E5" />
            </View>
            <Text style={[styles.kpiValue, { color: "#4F46E5" }]}>
              {parentOverview.cgpa}
            </Text>
            <Text style={[styles.kpiLabel, { color: colors.secondaryText }]}>CGPA Score</Text>
          </View>

          <View style={[styles.kpiBox, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <View style={[styles.kpiIconWrap, { backgroundColor: "rgba(245, 158, 11, 0.15)" }]}>
              <Icon name="bell-ring-outline" size={22} color="#F59E0B" />
            </View>
            <Text style={[styles.kpiValue, { color: "#F59E0B" }]}>
              {parentOverview.alerts}
            </Text>
            <Text style={[styles.kpiLabel, { color: colors.secondaryText }]}>New Alerts</Text>
          </View>
        </View>

        {/* Section Header */}
        <Text style={[styles.sectionTitle, { color: colors.primaryText }]}>
          Ward Management
        </Text>

        {/* Action Cards */}
        <ParentDashboardCard
          title="Ward Details"
          value="Academic & Bio Information"
          subtitle="View subjects, mentors and class records"
          iconName="account-child-outline"
          color="#8B5CF6"
          onPress={() => handleCardPress("Ward Details")}
          colors={colors}
        />
        <ParentDashboardCard
          title="Fee Summary"
          value={`Pending Dues: ${parentOverview.feesDue}`}
          subtitle="Track semester invoices & payment receipts"
          iconName="cash-multiple"
          color="#EF4444"
          onPress={() => handleCardPress("Fee Summary")}
          colors={colors}
        />
        <ParentDashboardCard
          title="Messages & Alerts"
          value={`${parentOverview.alerts} Unread Notifications`}
          subtitle="Direct notes from faculty & management"
          iconName="bell-badge-outline"
          color="#F59E0B"
          onPress={() => handleCardPress("Messages & Alerts")}
          colors={colors}
        />
        <ParentDashboardCard
          title="Progress Report"
          value="Performance & Grades Card"
          subtitle="Assessments, mid-term & semester GPAs"
          iconName="chart-line"
          color="#10B981"
          onPress={() => handleCardPress("Progress Report")}
          colors={colors}
        />
        </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Smooth Modals */}
      <WardModal
        visible={wardModalVisible}
        onClose={() => setWardModalVisible(false)}
        colors={colors}
        data={parentOverview}
      />
      <FeesModal
        visible={feesModalVisible}
        onClose={() => setFeesModalVisible(false)}
        colors={colors}
        data={parentOverview}
      />
      <MessagesModal
        visible={messagesModalVisible}
        onClose={() => setMessagesModalVisible(false)}
        colors={colors}
        data={parentOverview}
      />
      <ReportModal
        visible={reportModalVisible}
        onClose={() => setReportModalVisible(false)}
        colors={colors}
        data={parentOverview}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  contentContainer: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 80 },
  wardProfileCard: {
    borderRadius: 20,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  wardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  wardAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    justifyContent: "center",
    alignItems: "center",
  },
  wardGreeting: { fontSize: 13, fontWeight: "600" },
  wardName: { fontSize: 20, fontWeight: "800", marginTop: 2 },
  wardMeta: { fontSize: 13, marginTop: 2, fontWeight: "500" },
  wardDeptPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginTop: 14,
  },
  wardDeptText: { fontSize: 13, fontWeight: "700" },
  kpiRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
    gap: 10,
  },
  kpiBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  kpiIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },
  kpiValue: { fontSize: 18, fontWeight: "900", marginBottom: 2 },
  kpiLabel: { fontSize: 11, fontWeight: "700" },
  sectionTitle: { fontSize: 18, fontWeight: "800", marginBottom: 14, letterSpacing: -0.3 },
  card: {
    borderRadius: 16,
    marginBottom: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderLeftWidth: 4,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  cardContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconContainer: {
    width: 46,
    height: 46,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  textContainer: { flex: 1 },
  cardTitle: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  cardValue: { fontSize: 15, fontWeight: "800", marginTop: 3 },
  cardSubtitle: { fontSize: 12, marginTop: 2 },
  chevronBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
});
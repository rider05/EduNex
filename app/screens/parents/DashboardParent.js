import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  RefreshControl,
  Linking,
  Alert,
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

const DEFAULT_OVERVIEW = {};

const PARENT_CIRCULARS = [];

const TODAY_TIMELINE = [];

export default function DashboardParent() {
  const { colors, isDarkMode } = useTheme();
  const styles = getStyles(colors, isDarkMode);

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [parentOverview, setParentOverview] = useState(DEFAULT_OVERVIEW);
  const [parentCirculars, setParentCirculars] = useState(PARENT_CIRCULARS);
  const [todayTimeline, setTodayTimeline] = useState(TODAY_TIMELINE);

  // Modal states
  const [wardModalVisible, setWardModalVisible] = useState(false);
  const [feesModalVisible, setFeesModalVisible] = useState(false);
  const [messagesModalVisible, setMessagesModalVisible] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);

  const heroCardScale = useRef(new Animated.Value(1)).current;

  const loadData = useCallback(async () => {
    try {
      const data = await getParentData();
      if (data?.overview) {
        setParentOverview((prev) => ({ ...prev, ...data.overview }));
      }
      if (Array.isArray(data?.circulars)) {
        setParentCirculars(
          data.circulars.map((c, i) => ({
            ...c,
            id: c.id || c._id || `circ-${i}`,
            title: c.title || c.subject || c.sender || "Circular",
            date: c.date || "",
            desc: c.content || c.message || c.description || c.sub || "",
            color:
              c.color || ["#4F46E5", "#0EA5E9", "#8B5CF6", "#10B981", "#F59E0B"][i % 5],
            icon: c.icon || "bullhorn-outline",
          }))
        );
      }
      if (Array.isArray(data?.timeline)) {
        setTodayTimeline(data.timeline);
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

  useRefreshOnForeground(loadData);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleCallAdvisor = () => {
    if (!parentOverview.advisorPhone) return;
    Linking.openURL(`tel:${parentOverview.advisorPhone}`).catch(() => {
      Alert.alert("Call Unavailable", `Cannot dial ${parentOverview.advisorPhone}`);
    });
  };

  const handleEmailAdvisor = () => {
    if (!parentOverview.advisorEmail) return;
    Linking.openURL(`mailto:${parentOverview.advisorEmail}?subject=Parent%20Inquiry%20regarding%20${parentOverview.wardName}`).catch(() => {
      Alert.alert("Email Unavailable", `Cannot open mail for ${parentOverview.advisorEmail}`);
    });
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
            colors={[colors.primaryAccent]}
            tintColor={colors.primaryAccent}
            progressBackgroundColor={colors.cardBackground}
          />
        }
      >
        {isLoading ? (
          <SkeletonScreenLoader showProfile showKPIs listCount={4} />
        ) : (
          <>
            {/* ========================================================================= */}
            {/* 1. HEADER HUB                                                             */}
            {/* ========================================================================= */}
            <View style={styles.header}>
              <View style={[styles.headerIconWrap, { backgroundColor: colors.primaryAccent + "18" }]}>
                <Icon name="shield-account" size={24} color={colors.primaryAccent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.headerGreeting, { color: colors.secondaryText }]}>
                  Parent Portal · Welcome back
                </Text>
                <Text style={[styles.headerTitle, { color: colors.primaryText }]}>
                  {parentOverview.parentName}
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.alertsBadgeBtn, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
                onPress={() => setMessagesModalVisible(true)}
                activeOpacity={0.8}
              >
                <Icon name="bell-badge-outline" size={18} color="#F59E0B" />
                <Text style={styles.alertsBadgeText}>{parentOverview.alerts || 0} Notices</Text>
              </TouchableOpacity>
            </View>

            {/* ========================================================================= */}
            {/* 2. WARD IDENTITY HERO CARD                                                */}
            {/* ========================================================================= */}
            <Animated.View
              style={[
                styles.wardHeroCard,
                {
                  backgroundColor: colors.cardBackground,
                  borderColor: colors.divider,
                  transform: [{ scale: heroCardScale }],
                },
              ]}
            >
              <View style={styles.wardHeroTop}>
                <View style={[styles.wardAvatarCircle, { backgroundColor: colors.primaryAccent }]}>
                  <Text style={styles.wardAvatarText}>
                    {(parentOverview.wardName || "—")
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)}
                  </Text>
                </View>

                <View style={{ flex: 1, marginLeft: 12 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Text style={[styles.wardNameText, { color: colors.primaryText }]} numberOfLines={1}>
                      {parentOverview.wardName}
                    </Text>
                    <View style={styles.activeStudentPill}>
                      <View style={styles.greenDot} />
                      <Text style={styles.activeStudentPillText}>ENROLLED</Text>
                    </View>
                  </View>

                  <Text style={[styles.wardProgramText, { color: colors.primaryAccent }]} numberOfLines={1}>
                    {parentOverview.department}
                  </Text>

                  <Text style={[styles.wardRollText, { color: colors.secondaryText }]}>
                    Roll: {parentOverview.rollNo} · {parentOverview.year} ({parentOverview.section})
                  </Text>
                </View>
              </View>

              {/* Live Presence Status */}
              <View style={[styles.liveStatusRow, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                <Icon name="map-marker-radius" size={16} color="#10B981" />
                <Text style={[styles.liveStatusText, { color: colors.primaryText }]} numberOfLines={1}>
                  {parentOverview.campusStatus || "On Campus"}
                </Text>
              </View>
            </Animated.View>

            {/* ========================================================================= */}
            {/* 3. EXECUTIVE KPI GAUGES                                                   */}
            {/* ========================================================================= */}
            <View style={styles.kpiRow}>
              <TouchableOpacity
                style={[styles.kpiBox, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
                onPress={() => setReportModalVisible(true)}
                activeOpacity={0.8}
              >
                <View style={[styles.kpiIconCircle, { backgroundColor: "#10B98118" }]}>
                  <Icon name="calendar-check" size={20} color="#10B981" />
                </View>
                <Text style={[styles.kpiVal, { color: "#10B981" }]}>{parentOverview.attendance}</Text>
                <Text style={[styles.kpiLabel, { color: colors.secondaryText }]}>Attendance</Text>
                <Text style={[styles.kpiSub, { color: colors.disabledText }]}>{parentOverview.attendanceDays || ""}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.kpiBox, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
                onPress={() => setReportModalVisible(true)}
                activeOpacity={0.8}
              >
                <View style={[styles.kpiIconCircle, { backgroundColor: "#4F46E518" }]}>
                  <Icon name="trophy-outline" size={20} color="#4F46E5" />
                </View>
                <Text style={[styles.kpiVal, { color: "#4F46E5" }]}>{parentOverview.cgpa}</Text>
                <Text style={[styles.kpiLabel, { color: colors.secondaryText }]}>Current CGPA</Text>
                <Text style={[styles.kpiSub, { color: colors.disabledText }]}>{parentOverview.rank || ""}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.kpiBox, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
                onPress={() => setFeesModalVisible(true)}
                activeOpacity={0.8}
              >
                <View style={[styles.kpiIconCircle, { backgroundColor: "#EF444418" }]}>
                  <Icon name="cash-multiple" size={20} color="#EF4444" />
                </View>
                <Text style={[styles.kpiVal, { color: "#EF4444" }]}>{parentOverview.feesDue}</Text>
                <Text style={[styles.kpiLabel, { color: colors.secondaryText }]}>Fee Balance</Text>
                <Text style={[styles.kpiSub, { color: colors.disabledText }]}>Fee Due</Text>
              </TouchableOpacity>
            </View>

            {/* ========================================================================= */}
            {/* 4. CLASS ADVISOR COUNSELING HOTLINE                                       */}
            {/* ========================================================================= */}
            <View style={[styles.advisorCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
              <View style={styles.advisorCardTop}>
                <View style={[styles.advisorAvatarCircle, { backgroundColor: "#4F46E518" }]}>
                  <Icon name="account-tie-outline" size={24} color="#4F46E5" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.advisorRoleText, { color: colors.secondaryText }]}>Designated Class Counselor</Text>
                  <Text style={[styles.advisorNameText, { color: colors.primaryText }]}>{parentOverview.advisor || parentOverview.advisorName || "—"}</Text>
                  <Text style={[styles.advisorDeptText, { color: colors.disabledText }]}>{parentOverview.department || ""} Office</Text>
                </View>
              </View>

              <View style={styles.advisorActionsRow}>
                <TouchableOpacity
                  style={[styles.advisorActionBtn, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}
                  onPress={handleCallAdvisor}
                  activeOpacity={0.8}
                >
                  <Icon name="phone" size={16} color={colors.primaryAccent} />
                  <Text style={[styles.advisorActionBtnText, { color: colors.primaryAccent }]}>Call Advisor</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.advisorActionBtn, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}
                  onPress={handleEmailAdvisor}
                  activeOpacity={0.8}
                >
                  <Icon name="email-outline" size={16} color={colors.primaryAccent} />
                  <Text style={[styles.advisorActionBtnText, { color: colors.primaryAccent }]}>Send Email</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* ========================================================================= */}
            {/* 5. PARENT MANAGEMENT ACTION POWER GRID                                    */}
            {/* ========================================================================= */}
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: colors.primaryText }]}>Ward Management Hub</Text>
            </View>

            <View style={styles.powerGrid}>
              <TouchableOpacity
                style={[styles.powerGridCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
                onPress={() => setWardModalVisible(true)}
                activeOpacity={0.8}
              >
                <View style={[styles.powerIconCircle, { backgroundColor: "#8B5CF618" }]}>
                  <Icon name="card-account-details-outline" size={22} color="#8B5CF6" />
                </View>
                <Text style={[styles.powerCardTitle, { color: colors.primaryText }]}>Academic Record</Text>
                <Text style={[styles.powerCardSub, { color: colors.secondaryText }]}>Coursework & Mentors</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.powerGridCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
                onPress={() => setFeesModalVisible(true)}
                activeOpacity={0.8}
              >
                <View style={[styles.powerIconCircle, { backgroundColor: "#EF444418" }]}>
                  <Icon name="cash-check" size={22} color="#EF4444" />
                </View>
                <Text style={[styles.powerCardTitle, { color: colors.primaryText }]}>Fee Invoices</Text>
                <Text style={[styles.powerCardSub, { color: colors.secondaryText }]}>Pay Dues & Receipts</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.powerGridCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
                onPress={() => setReportModalVisible(true)}
                activeOpacity={0.8}
              >
                <View style={[styles.powerIconCircle, { backgroundColor: "#10B98118" }]}>
                  <Icon name="chart-box-outline" size={22} color="#10B981" />
                </View>
                <Text style={[styles.powerCardTitle, { color: colors.primaryText }]}>Progress Report</Text>
                <Text style={[styles.powerCardSub, { color: colors.secondaryText }]}>CIA & Mid-Term Grades</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.powerGridCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
                onPress={() => setMessagesModalVisible(true)}
                activeOpacity={0.8}
              >
                <View style={[styles.powerIconCircle, { backgroundColor: "#F59E0B18" }]}>
                  <Icon name="bell-ring-outline" size={22} color="#F59E0B" />
                </View>
                <Text style={[styles.powerCardTitle, { color: colors.primaryText }]}>Campus Notices</Text>
                <Text style={[styles.powerCardSub, { color: colors.secondaryText }]}>Official Circulars</Text>
              </TouchableOpacity>
            </View>

            {/* ========================================================================= */}
            {/* 6. TODAY'S LECTURE TIMELINE FOR WARD                                      */}
            {/* ========================================================================= */}
            <View style={[styles.sectionHeaderRow, { marginTop: 18 }]}>
              <Text style={[styles.sectionTitle, { color: colors.primaryText }]}>{"Today's Academic Schedule"}</Text>
            </View>

            <View style={[styles.timelineCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
              {todayTimeline.map((item, idx) => {
                const isLive = item.status === "live";
                const isDone = item.status === "completed";
                return (
                  <View key={idx} style={[styles.timelineItemRow, { borderBottomColor: colors.divider }]}>
                    <View style={styles.timelineStatusCol}>
                      <View
                        style={[
                          styles.timelineDot,
                          isLive
                            ? { backgroundColor: "#10B981" }
                            : isDone
                            ? { backgroundColor: colors.disabledText }
                            : { backgroundColor: colors.primaryAccent },
                        ]}
                      />
                    </View>

                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={[styles.timelineSubject, { color: colors.primaryText }]}>{item.subject}</Text>
                      <Text style={[styles.timelineTime, { color: colors.secondaryText }]}>
                        {item.time} · {item.room}
                      </Text>
                    </View>

                    {isLive && (
                      <View style={styles.liveNowBadge}>
                        <Text style={styles.liveNowText}>IN SESSION</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>

            {/* ========================================================================= */}
            {/* 7. PARENT CIRCULARS & NOTICES TICKER                                      */}
            {/* ========================================================================= */}
            <View style={[styles.sectionHeaderRow, { marginTop: 18 }]}>
              <Text style={[styles.sectionTitle, { color: colors.primaryText }]}>Institutional Circulars</Text>
            </View>

            <View style={{ gap: 8 }}>
              {parentCirculars.map((circ) => (
                <View
                  key={circ.id}
                  style={[styles.circularCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
                >
                  <View style={[styles.circularIconCircle, { backgroundColor: `${circ.color}18` }]}>
                    <Icon name={circ.icon} size={20} color={circ.color} />
                  </View>

                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <Text style={[styles.circularTitle, { color: colors.primaryText }]} numberOfLines={1}>
                        {circ.title}
                      </Text>
                    </View>
                    <Text style={[styles.circularDate, { color: colors.secondaryText }]}>{circ.date}</Text>
                    <Text style={[styles.circularDesc, { color: colors.disabledText }]} numberOfLines={2}>
                      {circ.desc}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
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

// ---------------- Styles ----------------
const getStyles = (colors, isDarkMode) =>
  StyleSheet.create({
    container: { flex: 1 },
    scrollView: { flex: 1 },
    contentContainer: { paddingHorizontal: 16, paddingTop: 44, paddingBottom: 80 },

    /* Header */
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginBottom: 16,
    },
    headerIconWrap: {
      width: 42,
      height: 42,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
    },
    headerGreeting: {
      fontSize: 11,
      fontWeight: "600",
    },
    headerTitle: {
      fontSize: 19,
      fontWeight: "800",
      letterSpacing: -0.3,
    },
    alertsBadgeBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 10,
      borderWidth: 1,
    },
    alertsBadgeText: {
      fontSize: 11,
      fontWeight: "700",
      color: "#F59E0B",
    },

    /* Ward Hero Card */
    wardHeroCard: {
      borderRadius: 20,
      borderWidth: 1,
      padding: 16,
      marginBottom: 14,
      elevation: 3,
      shadowColor: "#000",
      shadowOpacity: 0.08,
      shadowRadius: 8,
    },
    wardHeroTop: {
      flexDirection: "row",
      alignItems: "center",
    },
    wardAvatarCircle: {
      width: 52,
      height: 52,
      borderRadius: 26,
      justifyContent: "center",
      alignItems: "center",
    },
    wardAvatarText: {
      color: "#FFFFFF",
      fontSize: 18,
      fontWeight: "900",
    },
    wardNameText: {
      fontSize: 16,
      fontWeight: "800",
      letterSpacing: -0.2,
      flex: 1,
    },
    activeStudentPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: "#10B98114",
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      marginLeft: 6,
    },
    greenDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: "#10B981",
    },
    activeStudentPillText: {
      color: "#10B981",
      fontSize: 8.5,
      fontWeight: "900",
    },
    wardProgramText: {
      fontSize: 12,
      fontWeight: "700",
      marginTop: 2,
    },
    wardRollText: {
      fontSize: 11,
      fontWeight: "500",
      marginTop: 2,
    },
    liveStatusRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 10,
      borderWidth: 1,
      marginTop: 12,
    },
    liveStatusText: {
      fontSize: 11,
      fontWeight: "600",
    },

    /* KPI Row */
    kpiRow: {
      flexDirection: "row",
      gap: 8,
      marginBottom: 14,
    },
    kpiBox: {
      flex: 1,
      alignItems: "center",
      paddingVertical: 12,
      borderRadius: 16,
      borderWidth: 1,
      elevation: 2,
    },
    kpiIconCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 6,
    },
    kpiVal: {
      fontSize: 16,
      fontWeight: "900",
    },
    kpiLabel: {
      fontSize: 11,
      fontWeight: "700",
      marginTop: 1,
    },
    kpiSub: {
      fontSize: 9.5,
      fontWeight: "500",
      marginTop: 2,
    },

    /* Advisor Counseling Card */
    advisorCard: {
      borderRadius: 18,
      borderWidth: 1,
      padding: 14,
      marginBottom: 14,
    },
    advisorCardTop: {
      flexDirection: "row",
      alignItems: "center",
    },
    advisorAvatarCircle: {
      width: 44,
      height: 44,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
    },
    advisorRoleText: {
      fontSize: 10.5,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    advisorNameText: {
      fontSize: 14,
      fontWeight: "800",
      marginTop: 1,
    },
    advisorDeptText: {
      fontSize: 11,
      fontWeight: "500",
      marginTop: 1,
    },
    advisorActionsRow: {
      flexDirection: "row",
      gap: 8,
      marginTop: 12,
    },
    advisorActionBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 8,
      borderRadius: 10,
      borderWidth: 1,
    },
    advisorActionBtnText: {
      fontSize: 11.5,
      fontWeight: "700",
    },

    /* Power Grid */
    sectionHeaderRow: {
      marginBottom: 10,
    },
    sectionTitle: {
      fontSize: 15,
      fontWeight: "800",
    },
    powerGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    powerGridCard: {
      width: "48.5%",
      borderRadius: 16,
      borderWidth: 1,
      padding: 12,
      elevation: 1,
    },
    powerIconCircle: {
      width: 40,
      height: 40,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 8,
    },
    powerCardTitle: {
      fontSize: 13,
      fontWeight: "800",
    },
    powerCardSub: {
      fontSize: 10.5,
      fontWeight: "500",
      marginTop: 2,
    },

    /* Timeline */
    timelineCard: {
      borderRadius: 16,
      borderWidth: 1,
      padding: 12,
    },
    timelineItemRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 10,
      borderBottomWidth: 1,
    },
    timelineStatusCol: {
      justifyContent: "center",
      alignItems: "center",
      width: 14,
    },
    timelineDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    timelineSubject: {
      fontSize: 12.5,
      fontWeight: "700",
    },
    timelineTime: {
      fontSize: 11,
      fontWeight: "500",
      marginTop: 2,
    },
    liveNowBadge: {
      backgroundColor: "#10B98118",
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    liveNowText: {
      color: "#10B981",
      fontSize: 9,
      fontWeight: "900",
    },

    /* Circulars */
    circularCard: {
      flexDirection: "row",
      alignItems: "flex-start",
      borderRadius: 14,
      borderWidth: 1,
      padding: 12,
    },
    circularIconCircle: {
      width: 38,
      height: 38,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
    },
    circularTitle: {
      fontSize: 13,
      fontWeight: "800",
    },
    circularDate: {
      fontSize: 10.5,
      fontWeight: "500",
      marginTop: 2,
    },
    circularDesc: {
      fontSize: 11,
      lineHeight: 15,
      marginTop: 4,
    },
  });
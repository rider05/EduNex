import React, { useState, useMemo } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Linking,
  Share,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { useTheme } from "../../../context/ThemeContext";
import { showToast } from "../../../utils/toastService";

const BUS_ROUTES = [
  {
    id: "R-101",
    routeNumber: "Route 01",
    name: "Gandhipuram Express",
    busNo: "TN 38 N 8492",
    driverName: "Mr. M. Selvam",
    driverPhone: "+91 98421 77310",
    status: "On Time",
    statusColor: "#10B981",
    currentLocation: "Lakshmi Mills Junction",
    etaMins: 7,
    capacity: "48 / 55 Seats",
    morningDeparture: "07:15 AM",
    eveningReturn: "05:15 PM",
    stops: [
      { name: "Gandhipuram Central Bus Stand", time: "07:15 AM", passed: true },
      { name: "Lakshmi Mills Signal", time: "07:30 AM", passed: true, isCurrent: true },
      { name: "Peelamedu / Hope College", time: "07:42 AM", passed: false },
      { name: "Civil Aerodrome", time: "07:55 AM", passed: false },
      { name: "Campus Main Gate (Arrival)", time: "08:15 AM", passed: false },
    ],
  },
  {
    id: "R-102",
    routeNumber: "Route 02",
    name: "RS Puram & Saibaba Colony",
    busNo: "TN 38 N 9104",
    driverName: "Mr. K. Palanisamy",
    driverPhone: "+91 98422 44190",
    status: "Arriving Soon",
    statusColor: "#3B82F6",
    currentLocation: "NSR Road Bus Stop",
    etaMins: 4,
    capacity: "52 / 55 Seats",
    morningDeparture: "07:20 AM",
    eveningReturn: "05:15 PM",
    stops: [
      { name: "RS Puram Head Post Office", time: "07:20 AM", passed: true },
      { name: "Saibaba Colony NSR Road", time: "07:35 AM", passed: true, isCurrent: true },
      { name: "Mettupalayam Road Jn", time: "07:48 AM", passed: false },
      { name: "Campus Main Gate (Arrival)", time: "08:15 AM", passed: false },
    ],
  },
  {
    id: "R-103",
    routeNumber: "Route 03",
    name: "Saravanampatti Tech Corridor",
    busNo: "TN 38 N 7721",
    driverName: "Mr. S. Murugesan",
    driverPhone: "+91 98423 88120",
    status: "Delayed (Traffic)",
    statusColor: "#F59E0B",
    currentLocation: "CHIL SEZ IT Park",
    etaMins: 14,
    capacity: "42 / 55 Seats",
    morningDeparture: "07:10 AM",
    eveningReturn: "05:15 PM",
    stops: [
      { name: "Thudiyalur Junction", time: "07:10 AM", passed: true },
      { name: "Saravanampatti Checkpost", time: "07:25 AM", passed: true },
      { name: "CHIL SEZ Entrance", time: "07:40 AM", passed: true, isCurrent: true },
      { name: "Kalapatti Junction", time: "07:55 AM", passed: false },
      { name: "Campus Main Gate (Arrival)", time: "08:20 AM", passed: false },
    ],
  },
  {
    id: "R-104",
    routeNumber: "Route 04",
    name: "Singanallur & Ondipudur",
    busNo: "TN 38 N 6610",
    driverName: "Mr. R. Vetrivel",
    driverPhone: "+91 98424 99015",
    status: "On Time",
    statusColor: "#10B981",
    currentLocation: "Singanallur Bus Stand",
    etaMins: 9,
    capacity: "46 / 55 Seats",
    morningDeparture: "07:25 AM",
    eveningReturn: "05:15 PM",
    stops: [
      { name: "Ondipudur Flyover", time: "07:25 AM", passed: true },
      { name: "Singanallur Bus Stand", time: "07:38 AM", passed: true, isCurrent: true },
      { name: "Ramanathapuram 80 Feet Rd", time: "07:50 AM", passed: false },
      { name: "Campus Main Gate (Arrival)", time: "08:15 AM", passed: false },
    ],
  },
  {
    id: "R-105",
    routeNumber: "Route 05",
    name: "Hostel & Sports Complex Shuttle",
    busNo: "TN 38 N 2209",
    driverName: "Mr. C. Arumugam",
    driverPhone: "+91 98425 11090",
    status: "Every 15 Mins",
    statusColor: "#8B5CF6",
    currentLocation: "Block A Boys Hostel",
    etaMins: 2,
    capacity: "24 / 32 Seats",
    morningDeparture: "Continuous",
    eveningReturn: "09:00 PM",
    stops: [
      { name: "Block A & B Hostels", time: "Every 15m", passed: true, isCurrent: true },
      { name: "Indoor Sports Complex", time: "+5m", passed: false },
      { name: "Central Library & Food Court", time: "+10m", passed: false },
      { name: "Academic Block 1 & 2", time: "+15m", passed: false },
    ],
  },
];

export default function BusTrackerModal({ visible, onClose }) {
  const { colors, isDarkMode } = useTheme();
  const styles = getStyles(colors, isDarkMode);

  const [selectedRouteId, setSelectedRouteId] = useState("R-101");
  const [searchQuery, setSearchQuery] = useState("");

  const activeRoute = useMemo(() => {
    return BUS_ROUTES.find((r) => r.id === selectedRouteId) || BUS_ROUTES[0];
  }, [selectedRouteId]);

  const filteredRoutes = useMemo(() => {
    if (!searchQuery.trim()) return BUS_ROUTES;
    const q = searchQuery.toLowerCase().trim();
    return BUS_ROUTES.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.routeNumber.toLowerCase().includes(q) ||
        r.busNo.toLowerCase().includes(q) ||
        r.stops.some((s) => s.name.toLowerCase().includes(q))
    );
  }, [searchQuery]);

  const handleCallDriver = (phone) => {
    Linking.openURL(`tel:${phone}`).catch(() => {
      showToast(`Driver contact: ${phone}`, "info");
    });
  };

  const handleShareRoute = async (route) => {
    try {
      await Share.share({
        title: `Campus Bus - ${route.name}`,
        message: `🚌 EDUNEX CAMPUS TRANSIT TRACKER\nRoute: ${route.routeNumber} (${route.name})\nBus No: ${route.busNo}\nStatus: ${route.status} · ETA: ${route.etaMins} mins\nCurrent Stop: ${route.currentLocation}\nDriver: ${route.driverName} (${route.driverPhone})\nMorning Departure: ${route.morningDeparture} · Evening: ${route.eveningReturn}`,
      });
      showToast("Bus route info shared!", "success");
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
            <Text style={styles.fullHeaderTitle}>Campus Bus & Shuttle Tracker</Text>
            <Text style={styles.fullHeaderSub}>Live Routes, ETAs & Transit Timetable</Text>
          </View>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => showToast("📡 Transit data updated real-time", "success")}
          >
            <Icon name="refresh" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Content Body */}
        <View style={[styles.bodyContainer, { backgroundColor: colors.cardBackground }]}>
          {/* Search Box */}
          <View style={[styles.searchBox, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
            <Icon name="magnify" size={18} color={colors.secondaryText} />
            <TextInput
              style={[styles.searchInput, { color: colors.primaryText }]}
              placeholder="Search route name, stop, or bus number..."
              placeholderTextColor={colors.disabledText}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <Icon name="close-circle" size={16} color={colors.secondaryText} />
              </TouchableOpacity>
            )}
          </View>

          {/* Route Horizontal Selector Pills */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingHorizontal: 16, marginBottom: 12 }}
          >
            {filteredRoutes.map((r) => {
              const isSel = selectedRouteId === r.id;
              return (
                <TouchableOpacity
                  key={r.id}
                  style={[
                    styles.routePill,
                    isSel
                      ? { backgroundColor: colors.primaryAccent, borderColor: colors.primaryAccent }
                      : { backgroundColor: colors.primaryBackground, borderColor: colors.divider },
                  ]}
                  onPress={() => setSelectedRouteId(r.id)}
                  activeOpacity={0.8}
                >
                  <Icon name="bus" size={14} color={isSel ? "#FFFFFF" : colors.secondaryText} />
                  <Text style={[styles.routePillText, { color: isSel ? "#FFFFFF" : colors.primaryText }]}>
                    {r.routeNumber}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Selected Route Live Hero Card */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 60 }}
          >
            <View style={[styles.heroCard, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
              <View style={styles.heroTopRow}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={[styles.heroRouteNumber, { color: colors.primaryAccent }]}>
                      {activeRoute.routeNumber}
                    </Text>
                    <View style={[styles.statusTag, { backgroundColor: activeRoute.statusColor + "18", borderColor: activeRoute.statusColor + "44" }]}>
                      <View style={[styles.statusDot, { backgroundColor: activeRoute.statusColor }]} />
                      <Text style={[styles.statusTagText, { color: activeRoute.statusColor }]}>
                        {activeRoute.status.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.heroRouteName, { color: colors.primaryText }]}>{activeRoute.name}</Text>
                  <Text style={[styles.heroBusNo, { color: colors.secondaryText }]}>Vehicle: {activeRoute.busNo}</Text>
                </View>

                {/* ETA Bubble */}
                <View style={[styles.etaBubble, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
                  <Text style={[styles.etaNumber, { color: colors.primaryAccent }]}>{activeRoute.etaMins}</Text>
                  <Text style={[styles.etaUnit, { color: colors.secondaryText }]}>mins ETA</Text>
                </View>
              </View>

              {/* Current Location Banner */}
              <View style={[styles.locationBanner, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
                <Icon name="crosshairs-gps" size={18} color={colors.primaryAccent} />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={[styles.locationLabel, { color: colors.secondaryText }]}>LIVE CURRENT LOCATION</Text>
                  <Text style={[styles.locationText, { color: colors.primaryText }]}>{activeRoute.currentLocation}</Text>
                </View>
              </View>

              {/* Driver & Schedule Quick Strip */}
              <View style={styles.driverScheduleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.metaKey, { color: colors.secondaryText }]}>Driver In-Charge</Text>
                  <Text style={[styles.metaVal, { color: colors.primaryText }]}>{activeRoute.driverName}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.metaKey, { color: colors.secondaryText }]}>Capacity</Text>
                  <Text style={[styles.metaVal, { color: colors.primaryText }]}>{activeRoute.capacity}</Text>
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.actionBtnRow}>
                <TouchableOpacity
                  style={[styles.callDriverBtn, { backgroundColor: "#10B981" }]}
                  onPress={() => handleCallDriver(activeRoute.driverPhone)}
                  activeOpacity={0.85}
                >
                  <Icon name="phone" size={16} color="#FFFFFF" />
                  <Text style={styles.callDriverText}>Call Driver</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.shareRouteBtn, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
                  onPress={() => handleShareRoute(activeRoute)}
                  activeOpacity={0.8}
                >
                  <Icon name="share-variant-outline" size={16} color={colors.primaryText} />
                  <Text style={[styles.shareRouteText, { color: colors.primaryText }]}>Share ETA</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Route Stop-by-Stop Timeline */}
            <Text style={[styles.sectionTitle, { color: colors.primaryText, marginTop: 18, marginBottom: 12 }]}>
              Route Stops & Timings
            </Text>

            <View style={[styles.timelineCard, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
              {activeRoute.stops.map((stop, idx) => {
                const isLast = idx === activeRoute.stops.length - 1;
                return (
                  <View key={stop.name} style={styles.stopRow}>
                    <View style={styles.stopIndicatorCol}>
                      <View
                        style={[
                          styles.stopNode,
                          stop.isCurrent
                            ? { backgroundColor: colors.primaryAccent, borderColor: colors.primaryAccent }
                            : stop.passed
                            ? { backgroundColor: "#10B981", borderColor: "#10B981" }
                            : { backgroundColor: colors.cardBackground, borderColor: colors.divider },
                        ]}
                      >
                        <Icon
                          name={stop.isCurrent ? "bus" : stop.passed ? "check" : "circle-small"}
                          size={stop.isCurrent ? 12 : 14}
                          color={stop.isCurrent || stop.passed ? "#FFFFFF" : colors.disabledText}
                        />
                      </View>
                      {!isLast && <View style={[styles.stopLine, { backgroundColor: stop.passed ? "#10B981" : colors.divider }]} />}
                    </View>

                    <View style={styles.stopContent}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                        <Text
                          style={[
                            styles.stopName,
                            {
                              color: stop.isCurrent
                                ? colors.primaryAccent
                                : stop.passed
                                ? colors.primaryText
                                : colors.secondaryText,
                              fontWeight: stop.isCurrent ? "900" : "700",
                            },
                          ]}
                        >
                          {stop.name}
                        </Text>
                        <Text style={[styles.stopTime, { color: stop.isCurrent ? colors.primaryAccent : colors.secondaryText }]}>
                          {stop.time}
                        </Text>
                      </View>
                      {stop.isCurrent && (
                        <View style={styles.hereBadge}>
                          <Text style={styles.hereBadgeText}>📍 BUS IS CURRENTLY HERE</Text>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
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
    searchBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginHorizontal: 16,
      marginBottom: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      borderWidth: 1,
    },
    searchInput: {
      flex: 1,
      fontSize: 12.5,
      padding: 0,
    },
    routePill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 10,
      borderWidth: 1,
    },
    routePillText: {
      fontSize: 11.5,
      fontWeight: "700",
    },
    heroCard: {
      borderRadius: 18,
      borderWidth: 1,
      padding: 16,
      elevation: 2,
    },
    heroTopRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
    },
    heroRouteNumber: {
      fontSize: 13,
      fontWeight: "900",
      letterSpacing: 0.5,
    },
    statusTag: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      borderWidth: 1,
    },
    statusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    statusTagText: {
      fontSize: 9,
      fontWeight: "900",
    },
    heroRouteName: {
      fontSize: 17,
      fontWeight: "900",
      marginTop: 2,
    },
    heroBusNo: {
      fontSize: 11.5,
      fontWeight: "600",
      marginTop: 1,
    },
    etaBubble: {
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      borderWidth: 1,
    },
    etaNumber: {
      fontSize: 22,
      fontWeight: "900",
    },
    etaUnit: {
      fontSize: 9.5,
      fontWeight: "700",
    },
    locationBanner: {
      flexDirection: "row",
      alignItems: "center",
      padding: 10,
      borderRadius: 12,
      borderWidth: 1,
      marginTop: 12,
    },
    locationLabel: {
      fontSize: 9,
      fontWeight: "800",
      letterSpacing: 0.5,
    },
    locationText: {
      fontSize: 12.5,
      fontWeight: "800",
      marginTop: 1,
    },
    driverScheduleRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 12,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: "rgba(150,150,150,0.15)",
    },
    metaKey: {
      fontSize: 10.5,
      fontWeight: "600",
    },
    metaVal: {
      fontSize: 12.5,
      fontWeight: "800",
      marginTop: 1,
    },
    actionBtnRow: {
      flexDirection: "row",
      gap: 10,
      marginTop: 14,
    },
    callDriverBtn: {
      flex: 1.2,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 10,
      borderRadius: 10,
    },
    callDriverText: {
      color: "#FFFFFF",
      fontSize: 12.5,
      fontWeight: "800",
    },
    shareRouteBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
    },
    shareRouteText: {
      fontSize: 12.5,
      fontWeight: "700",
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: "800",
    },
    timelineCard: {
      borderRadius: 16,
      borderWidth: 1,
      padding: 14,
    },
    stopRow: {
      flexDirection: "row",
      minHeight: 44,
    },
    stopIndicatorCol: {
      width: 24,
      alignItems: "center",
    },
    stopNode: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      justifyContent: "center",
      alignItems: "center",
      zIndex: 1,
    },
    stopLine: {
      width: 2,
      flex: 1,
      marginVertical: 1,
    },
    stopContent: {
      flex: 1,
      marginLeft: 10,
      paddingBottom: 12,
    },
    stopName: {
      fontSize: 12.5,
    },
    stopTime: {
      fontSize: 11,
      fontWeight: "700",
    },
    hereBadge: {
      backgroundColor: "#3B82F618",
      alignSelf: "flex-start",
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      marginTop: 3,
    },
    hereBadgeText: {
      color: "#3B82F6",
      fontSize: 9,
      fontWeight: "900",
    },
  });

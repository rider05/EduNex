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
  Platform,
  StatusBar,
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
    coordinatorName: "Prof. K. Sundaram (CSE)",
    coordinatorPhone: "+91 98421 99001",
    status: "On Time",
    statusColor: "#10B981",
    currentLocation: "Lakshmi Mills Junction",
    currentSpeed: "42 km/h",
    etaMins: 7,
    capacity: "48 / 55 Seats",
    occupancyPercent: 87,
    morningDeparture: "07:15 AM",
    eveningReturn: "05:15 PM",
    gpsStatus: "Live High Accuracy",
    stops: [
      { name: "Gandhipuram Central Bus Stand", time: "07:15 AM", passed: true },
      { name: "Lakshmi Mills Signal", time: "07:30 AM", passed: true, isCurrent: true },
      { name: "Peelamedu / Hope College", time: "07:42 AM", passed: false },
      { name: "Civil Aerodrome Junction", time: "07:55 AM", passed: false },
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
    coordinatorName: "Dr. A. Meenakshi (ECE)",
    coordinatorPhone: "+91 98422 88200",
    status: "Arriving Soon",
    statusColor: "#3B82F6",
    currentLocation: "NSR Road Bus Stop",
    currentSpeed: "36 km/h",
    etaMins: 4,
    capacity: "52 / 55 Seats",
    occupancyPercent: 94,
    morningDeparture: "07:20 AM",
    eveningReturn: "05:15 PM",
    gpsStatus: "Live High Accuracy",
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
    coordinatorName: "Prof. V. Rajesh (IT)",
    coordinatorPhone: "+91 98423 77300",
    status: "Delayed (Traffic)",
    statusColor: "#F59E0B",
    currentLocation: "CHIL SEZ IT Park",
    currentSpeed: "18 km/h",
    etaMins: 14,
    capacity: "42 / 55 Seats",
    occupancyPercent: 76,
    morningDeparture: "07:10 AM",
    eveningReturn: "05:15 PM",
    gpsStatus: "Live High Accuracy",
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
    coordinatorName: "Dr. N. Sathish (Mech)",
    coordinatorPhone: "+91 98424 66400",
    status: "On Time",
    statusColor: "#10B981",
    currentLocation: "Singanallur Bus Stand",
    currentSpeed: "45 km/h",
    etaMins: 9,
    capacity: "46 / 55 Seats",
    occupancyPercent: 83,
    morningDeparture: "07:25 AM",
    eveningReturn: "05:15 PM",
    gpsStatus: "Live High Accuracy",
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
    name: "Hostel & Sports Shuttle",
    busNo: "TN 38 N 2209",
    driverName: "Mr. C. Arumugam",
    driverPhone: "+91 98425 11090",
    coordinatorName: "Chief Hostel Warden",
    coordinatorPhone: "+91 98425 22100",
    status: "Every 15 Mins",
    statusColor: "#8B5CF6",
    currentLocation: "Block A Boys Hostel",
    currentSpeed: "22 km/h",
    etaMins: 2,
    capacity: "24 / 32 Seats",
    occupancyPercent: 75,
    morningDeparture: "Continuous",
    eveningReturn: "09:00 PM",
    gpsStatus: "Live High Accuracy",
    stops: [
      { name: "Block A & B Hostels", time: "Every 15m", passed: true, isCurrent: true },
      { name: "Indoor Sports Complex", time: "+5m", passed: false },
      { name: "Central Library & Food Court", time: "+10m", passed: false },
      { name: "Academic Block 1 & 2", time: "+15m", passed: false },
    ],
  },
  {
    id: "R-106",
    routeNumber: "Route 06",
    name: "Pollachi & Kinathukadavu Suburban",
    busNo: "TN 38 N 5543",
    driverName: "Mr. P. Velusamy",
    driverPhone: "+91 98426 33210",
    coordinatorName: "Prof. M. Karthik (Civil)",
    coordinatorPhone: "+91 98426 44300",
    status: "On Time",
    statusColor: "#10B981",
    currentLocation: "Kinathukadavu Tollgate",
    currentSpeed: "50 km/h",
    etaMins: 16,
    capacity: "50 / 55 Seats",
    occupancyPercent: 90,
    morningDeparture: "07:00 AM",
    eveningReturn: "05:15 PM",
    gpsStatus: "Live High Accuracy",
    stops: [
      { name: "Pollachi Central Stand", time: "07:00 AM", passed: true },
      { name: "Kinathukadavu Checkpost", time: "07:22 AM", passed: true, isCurrent: true },
      { name: "Othakkalmandapam Jn", time: "07:45 AM", passed: false },
      { name: "Malumichampatti", time: "07:55 AM", passed: false },
      { name: "Campus Main Gate (Arrival)", time: "08:15 AM", passed: false },
    ],
  },
  {
    id: "R-107",
    routeNumber: "Route 07",
    name: "Tirupur & Avinashi Highway Line",
    busNo: "TN 38 N 3391",
    driverName: "Mr. D. Natarajan",
    driverPhone: "+91 98427 55490",
    coordinatorName: "Dr. S. Ramesh (AI & DS)",
    coordinatorPhone: "+91 98427 66500",
    status: "On Time",
    statusColor: "#10B981",
    currentLocation: "Avinashi Old Bus Stand",
    currentSpeed: "55 km/h",
    etaMins: 19,
    capacity: "49 / 55 Seats",
    occupancyPercent: 89,
    morningDeparture: "06:50 AM",
    eveningReturn: "05:15 PM",
    gpsStatus: "Live High Accuracy",
    stops: [
      { name: "Tirupur Old Bus Stand", time: "06:50 AM", passed: true },
      { name: "Avinashi New Bypass", time: "07:15 AM", passed: true, isCurrent: true },
      { name: "Kaniyur Toll Plaza", time: "07:40 AM", passed: false },
      { name: "Neelambur Bypass", time: "07:52 AM", passed: false },
      { name: "Campus Main Gate (Arrival)", time: "08:15 AM", passed: false },
    ],
  },
  {
    id: "R-108",
    routeNumber: "Route 08",
    name: "Vadavalli & Marudhamalai Express",
    busNo: "TN 38 N 1184",
    driverName: "Mr. G. Karuppusamy",
    driverPhone: "+91 98428 77610",
    coordinatorName: "Prof. T. Selvi (MBA)",
    coordinatorPhone: "+91 98428 88700",
    status: "On Time",
    statusColor: "#10B981",
    currentLocation: "Vadavalli Bus Terminus",
    currentSpeed: "38 km/h",
    etaMins: 11,
    capacity: "44 / 55 Seats",
    occupancyPercent: 80,
    morningDeparture: "07:20 AM",
    eveningReturn: "05:15 PM",
    gpsStatus: "Live High Accuracy",
    stops: [
      { name: "Marudhamalai Adivaram", time: "07:15 AM", passed: true },
      { name: "Vadavalli Bus Terminus", time: "07:30 AM", passed: true, isCurrent: true },
      { name: "Lawley Road Junction", time: "07:45 AM", passed: false },
      { name: "Campus Main Gate (Arrival)", time: "08:15 AM", passed: false },
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

  const handleCall = (phone, label) => {
    Linking.openURL(`tel:${phone}`).catch(() => {
      showToast(`${label}: ${phone}`, "info");
    });
  };

  const handleShareRoute = async (route) => {
    try {
      await Share.share({
        title: `Campus Bus - ${route.name}`,
        message: `🚌 EDUNEX CAMPUS TRANSIT TRACKER\nRoute: ${route.routeNumber} (${route.name})\nBus No: ${route.busNo}\nStatus: ${route.status} · ETA: ${route.etaMins} mins\nLive Speed: ${route.currentSpeed} · Location: ${route.currentLocation}\nDriver: ${route.driverName} (${route.driverPhone})\nFaculty In-Charge: ${route.coordinatorName}\nMorning Departure: ${route.morningDeparture} · Evening: ${route.eveningReturn}`,
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
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={styles.fullHeaderTitle}>Campus Bus & Transit Hub</Text>
              <View style={styles.liveGpsBadge}>
                <View style={styles.gpsPulseDot} />
                <Text style={styles.liveGpsBadgeText}>GPS LIVE</Text>
              </View>
            </View>
            <Text style={styles.fullHeaderSub}>8 Active Routes · Real-Time Speed & Arrival ETAs</Text>
          </View>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => showToast("📡 Satellite telemetry refreshed!", "success")}
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
              placeholder="Search route name, stop, driver, or bus number..."
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
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
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

              {/* Current Location & Speed Banner */}
              <View style={[styles.locationBanner, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
                <Icon name="crosshairs-gps" size={20} color={colors.primaryAccent} />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={[styles.locationLabel, { color: colors.secondaryText }]}>CURRENT STOP & SPEED</Text>
                    <Text style={[styles.speedText, { color: "#10B981" }]}>⚡ {activeRoute.currentSpeed}</Text>
                  </View>
                  <Text style={[styles.locationText, { color: colors.primaryText }]}>{activeRoute.currentLocation}</Text>
                </View>
              </View>

              {/* Seat Capacity & Occupancy Bar */}
              <View style={[styles.occupancyBox, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <Text style={[styles.occupancyLabel, { color: colors.secondaryText }]}>Live Seat Capacity</Text>
                  <Text style={[styles.occupancyVal, { color: colors.primaryText }]}>
                    {activeRoute.capacity} ({activeRoute.occupancyPercent}%)
                  </Text>
                </View>
                <View style={[styles.occupancyTrack, { backgroundColor: colors.primaryBackground }]}>
                  <View
                    style={[
                      styles.occupancyFill,
                      {
                        width: `${activeRoute.occupancyPercent}%`,
                        backgroundColor: activeRoute.occupancyPercent > 90 ? "#EF4444" : "#10B981",
                      },
                    ]}
                  />
                </View>
              </View>

              {/* Driver & Coordinator Info */}
              <View style={styles.driverScheduleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.metaKey, { color: colors.secondaryText }]}>Driver In-Charge</Text>
                  <Text style={[styles.metaVal, { color: colors.primaryText }]}>{activeRoute.driverName}</Text>
                  <TouchableOpacity onPress={() => handleCall(activeRoute.driverPhone, "Driver")}>
                    <Text style={[styles.phoneLink, { color: colors.primaryAccent }]}>{activeRoute.driverPhone}</Text>
                  </TouchableOpacity>
                </View>
                <View style={{ flex: 1, paddingLeft: 10 }}>
                  <Text style={[styles.metaKey, { color: colors.secondaryText }]}>Faculty In-Charge</Text>
                  <Text style={[styles.metaVal, { color: colors.primaryText }]} numberOfLines={1}>{activeRoute.coordinatorName}</Text>
                  <TouchableOpacity onPress={() => handleCall(activeRoute.coordinatorPhone, "Faculty")}>
                    <Text style={[styles.phoneLink, { color: colors.primaryAccent }]}>{activeRoute.coordinatorPhone}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.actionBtnRow}>
                <TouchableOpacity
                  style={[styles.callDriverBtn, { backgroundColor: "#10B981" }]}
                  onPress={() => handleCall(activeRoute.driverPhone, "Driver")}
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

            {/* Digital Student Bus Pass Badge */}
            <View style={[styles.busPassCard, { backgroundColor: colors.primaryAccent + "14", borderColor: colors.primaryAccent + "33" }]}>
              <Icon name="smart-card" size={24} color={colors.primaryAccent} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={[styles.busPassTitle, { color: colors.primaryAccent }]}>DIGITAL STUDENT BUS PASS</Text>
                <Text style={[styles.busPassSub, { color: colors.secondaryText }]}>
                  ID: #BP-2025-AI041 · Valid across all 8 campus routes for current semester.
                </Text>
              </View>
            </View>

            {/* Route Stop-by-Stop Timeline */}
            <Text style={[styles.sectionTitle, { color: colors.primaryText, marginTop: 18, marginBottom: 12 }]}>
              Route Stops & Timetable Schedule
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

            {/* Transport Desk Emergency Help */}
            <View style={[styles.helpDeskCard, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
              <Icon name="phone-classic" size={20} color="#F59E0B" />
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={[styles.helpDeskTitle, { color: colors.primaryText }]}>Campus Transport Control Room</Text>
                <Text style={[styles.helpDeskSub, { color: colors.secondaryText }]}>
                  Helpline: 0422-2680150 · Transport Officer: +91 94430 11990
                </Text>
              </View>
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
      paddingTop: Platform.OS === "android" ? Math.max(StatusBar.currentHeight || 0, 44) : 52,
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
      marginTop: 2,
    },
    liveGpsBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: "rgba(255,255,255,0.2)",
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    gpsPulseDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: "#10B981",
    },
    liveGpsBadgeText: {
      color: "#FFFFFF",
      fontSize: 8.5,
      fontWeight: "900",
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
    speedText: {
      fontSize: 11,
      fontWeight: "800",
    },
    occupancyBox: {
      padding: 10,
      borderRadius: 12,
      borderWidth: 1,
      marginTop: 10,
    },
    occupancyLabel: {
      fontSize: 10.5,
      fontWeight: "700",
    },
    occupancyVal: {
      fontSize: 11,
      fontWeight: "800",
    },
    occupancyTrack: {
      height: 6,
      borderRadius: 3,
      overflow: "hidden",
    },
    occupancyFill: {
      height: "100%",
      borderRadius: 3,
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
      fontSize: 12,
      fontWeight: "800",
      marginTop: 1,
    },
    phoneLink: {
      fontSize: 11,
      fontWeight: "700",
      marginTop: 2,
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
    busPassCard: {
      flexDirection: "row",
      alignItems: "center",
      padding: 12,
      borderRadius: 14,
      borderWidth: 1,
      marginTop: 12,
    },
    busPassTitle: {
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 0.5,
    },
    busPassSub: {
      fontSize: 10.5,
      fontWeight: "500",
      marginTop: 1,
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
    helpDeskCard: {
      flexDirection: "row",
      alignItems: "center",
      padding: 12,
      borderRadius: 14,
      borderWidth: 1,
      marginTop: 14,
    },
    helpDeskTitle: {
      fontSize: 12,
      fontWeight: "800",
    },
    helpDeskSub: {
      fontSize: 10.5,
      fontWeight: "500",
      marginTop: 2,
    },
  });

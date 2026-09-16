import React, { useState, useEffect, useMemo, useCallback } from "react";
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
  KeyboardAvoidingView,
  ActivityIndicator,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { useTheme } from "../../../context/ThemeContext";
import { showToast } from "../../../utils/toastService";
import { api } from "../../../services/api";

export default function BusTrackerModal({ visible, onClose }) {
  const { colors, isDarkMode } = useTheme();
  const styles = getStyles(colors, isDarkMode);

  const [routes, setRoutes] = useState([]);
  const [selectedRouteId, setSelectedRouteId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const loadRoutes = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.get("/transport", { limit: 100 });
      const rawList = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
      const mapped = rawList.map((r, idx) => ({
        id: r.id || r._id || `R-${idx + 1}`,
        routeNumber: r.routeNumber || r.route || `Route ${idx + 1}`,
        name: r.name || r.routeName || "Campus Transit Line",
        busNo: r.busNo || r.vehicleNo || r.vehicleRegistration || "—",
        driverName: r.driverName || r.driver || "—",
        driverPhone: r.driverPhone || r.driverContact || "—",
        coordinatorName: r.coordinatorName || r.facultyInCharge || "—",
        coordinatorPhone: r.coordinatorPhone || r.facultyContact || "—",
        status: r.status || "Location unavailable",
        statusColor: r.status === "On Time" ? "#10B981" : r.status === "Delayed" ? "#EF4444" : "#F59E0B",
        currentLocation: r.currentLocation || "Location unavailable",
        currentSpeed: r.currentSpeed || "Tracking unavailable",
        etaMins: r.etaMins != null ? r.etaMins : "—",
        capacity: r.capacity || (r.totalSeats ? `${r.occupiedSeats || 0} / ${r.totalSeats} Seats` : "—"),
        occupancyPercent: r.occupancyPercent || 0,
        morningDeparture: r.morningDeparture || r.departureTime || "—",
        eveningReturn: r.eveningReturn || r.returnTime || "—",
        gpsStatus: r.gpsStatus || "Tracking unavailable",
        stops: Array.isArray(r.stops) ? r.stops : [],
      }));

      setRoutes(mapped);
      if (mapped.length > 0 && !selectedRouteId) {
        setSelectedRouteId(mapped[0].id);
      }
    } catch (err) {
      console.warn("loadRoutes error:", err);
      setRoutes([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedRouteId]);

  useEffect(() => {
    if (visible) {
      loadRoutes();
    }
  }, [visible, loadRoutes]);

  const activeRoute = useMemo(() => {
    return routes.find((r) => r.id === selectedRouteId) || routes[0] || null;
  }, [routes, selectedRouteId]);

  const filteredRoutes = useMemo(() => {
    if (!searchQuery.trim()) return routes;
    const q = searchQuery.toLowerCase().trim();
    return routes.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.routeNumber.toLowerCase().includes(q) ||
        r.busNo.toLowerCase().includes(q) ||
        r.stops.some((s) => (s.name || s).toLowerCase().includes(q))
    );
  }, [routes, searchQuery]);

  const handleCall = (phone, label) => {
    if (!phone || phone === "—") {
      showToast(`${label} contact unavailable`, "info");
      return;
    }
    Linking.openURL(`tel:${phone}`).catch(() => {
      showToast(`${label}: ${phone}`, "info");
    });
  };

  const handleShareRoute = async (route) => {
    if (!route) return;
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
                <Text style={styles.liveGpsBadgeText}>TRANSIT</Text>
              </View>
            </View>
            <Text style={styles.fullHeaderSub}>
              {routes.length > 0 ? `${routes.length} Active Routes · Real-Time Speed & Arrival ETAs` : "Transport Fleet"}
            </Text>
          </View>
          <TouchableOpacity style={styles.headerBtn} onPress={loadRoutes}>
            <Icon name="refresh" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Content Body */}
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <View style={[styles.bodyContainer, { backgroundColor: colors.cardBackground }]}>
            {isLoading ? (
              <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                <ActivityIndicator size="large" color={colors.primaryAccent} />
                <Text style={{ marginTop: 12, color: colors.secondaryText, fontSize: 13 }}>
                  Loading transport routes from server...
                </Text>
              </View>
            ) : routes.length === 0 ? (
              <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 24 }}>
                <Icon name="bus-alert" size={54} color={colors.secondaryText} style={{ marginBottom: 12 }} />
                <Text style={{ fontSize: 16, fontWeight: "700", color: colors.primaryText, textAlign: "center" }}>
                  No transport routes configured.
                </Text>
                <Text style={{ fontSize: 12.5, color: colors.secondaryText, textAlign: "center", marginTop: 6 }}>
                  Campus transport schedules and bus routes will appear here once published by the administration.
                </Text>
              </View>
            ) : (
              <>
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

                {activeRoute && (
                  <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 60 }}>
                    <View style={[styles.heroCard, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                      <View style={styles.heroTopRow}>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            <Text style={[styles.heroRouteNumber, { color: colors.primaryAccent }]}>
                              {activeRoute.routeNumber}
                            </Text>
                            <View
                              style={[
                                styles.statusTag,
                                {
                                  backgroundColor: activeRoute.statusColor + "18",
                                  borderColor: activeRoute.statusColor + "44",
                                },
                              ]}
                            >
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
                          <Text style={[styles.occupancyLabel, { color: colors.secondaryText }]}>Seat Capacity</Text>
                          <Text style={[styles.occupancyVal, { color: colors.primaryText }]}>
                            {activeRoute.capacity}
                          </Text>
                        </View>
                        {activeRoute.occupancyPercent > 0 && (
                          <View style={[styles.occupancyTrack, { backgroundColor: colors.primaryBackground }]}>
                            <View
                              style={[
                                styles.occupancyFill,
                                {
                                  width: `${Math.min(100, activeRoute.occupancyPercent)}%`,
                                  backgroundColor: activeRoute.occupancyPercent > 90 ? "#EF4444" : "#10B981",
                                },
                              ]}
                            />
                          </View>
                        )}
                      </View>

                      {/* Driver & Coordinator Info */}
                      <View style={styles.driverScheduleRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.metaKey, { color: colors.secondaryText }]}>Driver In-Charge</Text>
                          <Text style={[styles.metaVal, { color: colors.primaryText }]}>{activeRoute.driverName}</Text>
                          {activeRoute.driverPhone !== "—" && (
                            <TouchableOpacity onPress={() => handleCall(activeRoute.driverPhone, "Driver")}>
                              <Text style={[styles.phoneLink, { color: colors.primaryAccent }]}>{activeRoute.driverPhone}</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                        <View style={{ flex: 1, paddingLeft: 10 }}>
                          <Text style={[styles.metaKey, { color: colors.secondaryText }]}>Faculty In-Charge</Text>
                          <Text style={[styles.metaVal, { color: colors.primaryText }]} numberOfLines={1}>
                            {activeRoute.coordinatorName}
                          </Text>
                          {activeRoute.coordinatorPhone !== "—" && (
                            <TouchableOpacity onPress={() => handleCall(activeRoute.coordinatorPhone, "Faculty")}>
                              <Text style={[styles.phoneLink, { color: colors.primaryAccent }]}>{activeRoute.coordinatorPhone}</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>

                      {/* Action Buttons */}
                      <View style={styles.actionBtnRow}>
                        {activeRoute.driverPhone !== "—" && (
                          <TouchableOpacity
                            style={[styles.callDriverBtn, { backgroundColor: "#10B981" }]}
                            onPress={() => handleCall(activeRoute.driverPhone, "Driver")}
                            activeOpacity={0.85}
                          >
                            <Icon name="phone" size={16} color="#FFFFFF" />
                            <Text style={styles.callDriverText}>Call Driver</Text>
                          </TouchableOpacity>
                        )}

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
                    {Array.isArray(activeRoute.stops) && activeRoute.stops.length > 0 && (
                      <>
                        <Text style={[styles.sectionTitle, { color: colors.primaryText, marginTop: 18, marginBottom: 12 }]}>
                          Route Stops & Timetable Schedule
                        </Text>

                        <View style={[styles.timelineCard, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                          {activeRoute.stops.map((stop, idx) => {
                            const isLast = idx === activeRoute.stops.length - 1;
                            const stopName = typeof stop === "string" ? stop : stop.name || "Stop";
                            const stopTime = typeof stop === "object" ? stop.time : "—";
                            const isCurrent = typeof stop === "object" && Boolean(stop.isCurrent);
                            const passed = typeof stop === "object" && Boolean(stop.passed);

                            return (
                              <View key={`${stopName}_${idx}`} style={styles.stopRow}>
                                <View style={styles.stopIndicatorCol}>
                                  <View
                                    style={[
                                      styles.stopNode,
                                      isCurrent
                                        ? { backgroundColor: colors.primaryAccent, borderColor: colors.primaryAccent }
                                        : passed
                                        ? { backgroundColor: "#10B981", borderColor: "#10B981" }
                                        : { backgroundColor: colors.cardBackground, borderColor: colors.divider },
                                    ]}
                                  >
                                    <Icon
                                      name={isCurrent ? "bus" : passed ? "check" : "circle-small"}
                                      size={isCurrent ? 12 : 14}
                                      color={isCurrent || passed ? "#FFFFFF" : colors.disabledText}
                                    />
                                  </View>
                                  {!isLast && <View style={[styles.stopLine, { backgroundColor: passed ? "#10B981" : colors.divider }]} />}
                                </View>

                                <View style={styles.stopContent}>
                                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                                    <Text
                                      style={[
                                        styles.stopName,
                                        {
                                          color: isCurrent
                                            ? colors.primaryAccent
                                            : passed
                                            ? colors.primaryText
                                            : colors.secondaryText,
                                          fontWeight: isCurrent ? "900" : "700",
                                        },
                                      ]}
                                    >
                                      {stopName}
                                    </Text>
                                    {stopTime && stopTime !== "—" && (
                                      <Text style={[styles.stopTime, { color: isCurrent ? colors.primaryAccent : colors.secondaryText }]}>
                                        {stopTime}
                                      </Text>
                                    )}
                                  </View>
                                  {isCurrent && (
                                    <View style={styles.hereBadge}>
                                      <Text style={styles.hereBadgeText}>📍 CURRENT ESTIMATED STOP</Text>
                                    </View>
                                  )}
                                </View>
                              </View>
                            );
                          })}
                        </View>
                      </>
                    )}
                  </ScrollView>
                )}
              </>
            )}
          </View>
        </KeyboardAvoidingView>
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
      width: 5,
      height: 5,
      borderRadius: 3,
    },
    statusTagText: {
      fontSize: 9,
      fontWeight: "900",
    },
    heroRouteName: {
      fontSize: 15,
      fontWeight: "800",
      marginTop: 3,
    },
    heroBusNo: {
      fontSize: 11.5,
      fontWeight: "500",
      marginTop: 2,
    },
    etaBubble: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: 1,
    },
    etaNumber: {
      fontSize: 20,
      fontWeight: "900",
      lineHeight: 22,
    },
    etaUnit: {
      fontSize: 9.5,
      fontWeight: "600",
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
      fontSize: 9.5,
      fontWeight: "800",
      letterSpacing: 0.5,
    },
    speedText: {
      fontSize: 10,
      fontWeight: "800",
    },
    locationText: {
      fontSize: 12,
      fontWeight: "700",
      marginTop: 1,
    },
    occupancyBox: {
      padding: 10,
      borderRadius: 12,
      borderWidth: 1,
      marginTop: 10,
    },
    occupancyLabel: {
      fontSize: 11,
      fontWeight: "600",
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
      marginTop: 12,
      paddingTop: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(150,150,150,0.2)",
    },
    metaKey: {
      fontSize: 10,
      fontWeight: "600",
      textTransform: "uppercase",
    },
    metaVal: {
      fontSize: 12,
      fontWeight: "700",
      marginTop: 2,
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
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 10,
      borderRadius: 10,
    },
    callDriverText: {
      color: "#FFFFFF",
      fontSize: 12,
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
      fontSize: 12,
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

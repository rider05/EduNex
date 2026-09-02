import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated, Easing } from "react-native";
import { useTheme } from "../../context/ThemeContext";

/**
 * Base Shimmer Box with smooth pulsating animation
 */
export function SkeletonBox({
  width = "100%",
  height = 20,
  borderRadius = 8,
  style,
}) {
  const { colors } = useTheme();
  const shimmerAnim = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 0.85,
          duration: 750,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0.35,
          duration: 750,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [shimmerAnim]);

  const baseBg = colors.cardHighlight || "rgba(148, 163, 184, 0.16)";

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: baseBg,
          opacity: shimmerAnim,
        },
        style,
      ]}
    />
  );
}

/**
 * Circular Avatar Skeleton
 */
export function SkeletonCircle({ size = 48, style }) {
  return (
    <SkeletonBox
      width={size}
      height={size}
      borderRadius={size / 2}
      style={style}
    />
  );
}

/**
 * Text Line Skeleton
 */
export function SkeletonText({
  width = "80%",
  height = 14,
  style,
  borderRadius = 4,
}) {
  return (
    <SkeletonBox
      width={width}
      height={height}
      borderRadius={borderRadius}
      style={[{ marginVertical: 3 }, style]}
    />
  );
}

/**
 * Profile Header Card Skeleton
 */
export function SkeletonProfileCard() {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.cardContainer,
        { backgroundColor: colors.cardBackground, borderColor: colors.divider },
      ]}
    >
      <View style={styles.row}>
        <SkeletonCircle size={60} />
        <View style={{ flex: 1, marginLeft: 14 }}>
          <SkeletonText width="40%" height={12} />
          <SkeletonText width="75%" height={18} style={{ marginVertical: 6 }} />
          <SkeletonText width="55%" height={12} />
        </View>
      </View>
    </View>
  );
}

/**
 * KPI Grid Skeleton (2x2 or N items)
 */
export function SkeletonKPIRow({ count = 2 }) {
  const { colors } = useTheme();
  return (
    <View style={styles.kpiRow}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.kpiCard,
            { backgroundColor: colors.cardBackground, borderColor: colors.divider },
          ]}
        >
          <SkeletonCircle size={36} style={{ alignSelf: "center", marginBottom: 10 }} />
          <SkeletonText width="55%" height={20} style={{ alignSelf: "center", marginBottom: 6 }} />
          <SkeletonText width="75%" height={12} style={{ alignSelf: "center", marginBottom: 4 }} />
          <SkeletonText width="45%" height={10} style={{ alignSelf: "center" }} />
        </View>
      ))}
    </View>
  );
}

/**
 * Card / List Item Skeleton
 */
export function SkeletonListItem() {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.listCard,
        { backgroundColor: colors.cardBackground, borderColor: colors.divider },
      ]}
    >
      <View style={styles.row}>
        <SkeletonBox width={44} height={44} borderRadius={12} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <SkeletonText width="70%" height={15} />
          <SkeletonText width="45%" height={11} style={{ marginTop: 6 }} />
        </View>
        <SkeletonBox width={22} height={22} borderRadius={11} />
      </View>
    </View>
  );
}

/**
 * Complete Dashboard Screen Skeleton (Student, Staff, Parent, Admin)
 */
export function SkeletonDashboardScreen() {
  const { colors } = useTheme();
  return (
    <View style={styles.screenWrapper}>
      {/* Header Profile / Welcome Banner */}
      <View
        style={[
          styles.heroBanner,
          { backgroundColor: colors.cardBackground, borderColor: colors.divider },
        ]}
      >
        <View style={styles.row}>
          <SkeletonCircle size={52} />
          <View style={{ flex: 1, marginLeft: 14 }}>
            <SkeletonText width="45%" height={13} />
            <SkeletonText width="80%" height={19} style={{ marginVertical: 4 }} />
            <SkeletonText width="60%" height={12} />
          </View>
        </View>
      </View>

      {/* 2x2 KPI Grid */}
      <SkeletonKPIRow count={2} />
      <SkeletonKPIRow count={2} />

      {/* Quick Action Matrix / List Preview */}
      <View style={{ marginTop: 12 }}>
        <SkeletonText width="35%" height={15} style={{ marginBottom: 10 }} />
        <SkeletonListItem />
        <SkeletonListItem />
        <SkeletonListItem />
      </View>
    </View>
  );
}

/**
 * Academics & Assignments Screen Skeleton
 */
export function SkeletonAcademicsScreen() {
  const { colors } = useTheme();
  return (
    <View style={styles.screenWrapper}>
      {/* Top Tabs */}
      <View style={styles.rowBetween}>
        <SkeletonBox width="30%" height={38} borderRadius={10} />
        <SkeletonBox width="30%" height={38} borderRadius={10} />
        <SkeletonBox width="30%" height={38} borderRadius={10} />
      </View>

      {/* Performance Summary Banner */}
      <View
        style={[
          styles.cardContainer,
          { backgroundColor: colors.cardBackground, borderColor: colors.divider, marginTop: 14 },
        ]}
      >
        <View style={styles.rowBetween}>
          <View style={{ flex: 1 }}>
            <SkeletonText width="50%" height={12} />
            <SkeletonText width="85%" height={22} style={{ marginVertical: 6 }} />
            <SkeletonText width="65%" height={12} />
          </View>
          <SkeletonCircle size={56} />
        </View>
      </View>

      {/* List Items */}
      <View style={{ marginTop: 12 }}>
        <SkeletonText width="40%" height={15} style={{ marginBottom: 10 }} />
        <SkeletonListItem />
        <SkeletonListItem />
        <SkeletonListItem />
        <SkeletonListItem />
      </View>
    </View>
  );
}

/**
 * Attendance Screen Skeleton
 */
export function SkeletonAttendanceScreen() {
  const { colors } = useTheme();
  return (
    <View style={styles.screenWrapper}>
      {/* Circular Gauge / Percentage Card */}
      <View
        style={[
          styles.cardContainer,
          { backgroundColor: colors.cardBackground, borderColor: colors.divider, alignItems: "center", paddingVertical: 24 },
        ]}
      >
        <SkeletonCircle size={100} style={{ marginBottom: 14 }} />
        <SkeletonText width="40%" height={22} style={{ alignSelf: "center", marginBottom: 6 }} />
        <SkeletonText width="60%" height={13} style={{ alignSelf: "center" }} />
      </View>

      {/* Monthly Summary Matrix */}
      <SkeletonKPIRow count={2} />

      {/* Daily Records List */}
      <View style={{ marginTop: 12 }}>
        <SkeletonText width="35%" height={15} style={{ marginBottom: 10 }} />
        <SkeletonListItem />
        <SkeletonListItem />
        <SkeletonListItem />
      </View>
    </View>
  );
}

/**
 * Fees & Finance Screen Skeleton
 */
export function SkeletonFeesScreen() {
  const { colors } = useTheme();
  return (
    <View style={styles.screenWrapper}>
      {/* Hero Fee Balance Banner */}
      <View
        style={[
          styles.heroBanner,
          { backgroundColor: colors.cardBackground, borderColor: colors.divider, paddingVertical: 20 },
        ]}
      >
        <SkeletonText width="35%" height={12} style={{ marginBottom: 6 }} />
        <SkeletonText width="60%" height={26} style={{ marginBottom: 10 }} />
        <View style={styles.row}>
          <SkeletonBox width="45%" height={36} borderRadius={10} style={{ marginRight: 10 }} />
          <SkeletonBox width="45%" height={36} borderRadius={10} />
        </View>
      </View>

      {/* Matrix Breakdown */}
      <SkeletonKPIRow count={2} />

      {/* Transaction History List */}
      <View style={{ marginTop: 12 }}>
        <SkeletonText width="40%" height={15} style={{ marginBottom: 10 }} />
        <SkeletonListItem />
        <SkeletonListItem />
        <SkeletonListItem />
      </View>
    </View>
  );
}

/**
 * Document Space / Digital Locker Skeleton
 */
export function SkeletonDocSpaceScreen() {
  const { colors } = useTheme();
  return (
    <View style={styles.screenWrapper}>
      {/* Search Input Bar */}
      <SkeletonBox width="100%" height={44} borderRadius={12} style={{ marginBottom: 14 }} />

      {/* Folder Categories Grid */}
      <View style={styles.kpiRow}>
        <View style={[styles.kpiCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
          <SkeletonBox width={36} height={36} borderRadius={8} style={{ marginBottom: 8 }} />
          <SkeletonText width="60%" height={14} />
          <SkeletonText width="40%" height={10} />
        </View>
        <View style={[styles.kpiCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
          <SkeletonBox width={36} height={36} borderRadius={8} style={{ marginBottom: 8 }} />
          <SkeletonText width="60%" height={14} />
          <SkeletonText width="40%" height={10} />
        </View>
      </View>

      {/* Recent Files List */}
      <View style={{ marginTop: 12 }}>
        <SkeletonText width="35%" height={15} style={{ marginBottom: 10 }} />
        <SkeletonListItem />
        <SkeletonListItem />
        <SkeletonListItem />
        <SkeletonListItem />
      </View>
    </View>
  );
}

/**
 * Profile Screen Skeleton
 */
export function SkeletonProfileScreen() {
  const { colors } = useTheme();
  return (
    <View style={styles.screenWrapper}>
      {/* Avatar Header Box */}
      <View
        style={[
          styles.cardContainer,
          { backgroundColor: colors.cardBackground, borderColor: colors.divider, alignItems: "center", paddingVertical: 22 },
        ]}
      >
        <SkeletonCircle size={78} style={{ marginBottom: 12 }} />
        <SkeletonText width="55%" height={18} style={{ alignSelf: "center", marginBottom: 6 }} />
        <SkeletonText width="40%" height={12} style={{ alignSelf: "center" }} />
      </View>

      {/* Bio / Key Matrix */}
      <SkeletonKPIRow count={2} />

      {/* Personal Info Field Rows */}
      <View
        style={[
          styles.cardContainer,
          { backgroundColor: colors.cardBackground, borderColor: colors.divider, marginTop: 6 },
        ]}
      >
        <SkeletonText width="40%" height={14} style={{ marginBottom: 12 }} />
        {Array.from({ length: 4 }).map((_, i) => (
          <View key={i} style={[styles.rowBetween, { paddingVertical: 10, borderBottomWidth: i < 3 ? 1 : 0, borderBottomColor: colors.divider }]}>
            <SkeletonText width="30%" height={12} />
            <SkeletonText width="45%" height={12} />
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * User Management & Admin Screens Skeleton
 */
export function SkeletonUserManagementScreen() {
  return (
    <View style={styles.screenWrapper}>
      {/* Search & Filter Pills */}
      <SkeletonBox width="100%" height={44} borderRadius={12} style={{ marginBottom: 12 }} />
      <View style={[styles.rowBetween, { marginBottom: 14 }]}>
        <SkeletonBox width="22%" height={32} borderRadius={8} />
        <SkeletonBox width="22%" height={32} borderRadius={8} />
        <SkeletonBox width="22%" height={32} borderRadius={8} />
        <SkeletonBox width="22%" height={32} borderRadius={8} />
      </View>

      {/* Metric Counters */}
      <SkeletonKPIRow count={2} />

      {/* User Records List */}
      <View style={{ marginTop: 12 }}>
        <SkeletonText width="35%" height={15} style={{ marginBottom: 10 }} />
        <SkeletonListItem />
        <SkeletonListItem />
        <SkeletonListItem />
        <SkeletonListItem />
      </View>
    </View>
  );
}

/**
 * Universal Screen Loader Switcher
 */
export function SkeletonScreenLoader({
  mode = "dashboard", // "dashboard" | "academics" | "attendance" | "fees" | "docspace" | "profile" | "users" | "generic"
  listCount = 4,
}) {
  switch (mode) {
    case "dashboard":
      return <SkeletonDashboardScreen />;
    case "academics":
      return <SkeletonAcademicsScreen />;
    case "attendance":
      return <SkeletonAttendanceScreen />;
    case "fees":
      return <SkeletonFeesScreen />;
    case "docspace":
      return <SkeletonDocSpaceScreen />;
    case "profile":
      return <SkeletonProfileScreen />;
    case "users":
      return <SkeletonUserManagementScreen />;
    default:
      return (
        <View style={styles.screenWrapper}>
          <SkeletonProfileCard />
          <SkeletonKPIRow count={2} />
          <View style={{ marginTop: 12 }}>
            {Array.from({ length: listCount }).map((_, idx) => (
              <SkeletonListItem key={idx} />
            ))}
          </View>
        </View>
      );
  }
}

const styles = StyleSheet.create({
  screenWrapper: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  heroBanner: {
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 14,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  cardContainer: {
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 14,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  kpiRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  kpiCard: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  listCard: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 10,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
});

export default SkeletonScreenLoader;

import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated, Easing } from "react-native";
import { useTheme } from "../../context/ThemeContext";

/**
 * Base Shimmer Box
 */
export function SkeletonBox({
  width = "100%",
  height = 20,
  borderRadius = 8,
  style,
}) {
  const { colors } = useTheme();
  const shimmerAnim = useRef(new Animated.Value(0.3)).current;

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
          toValue: 0.3,
          duration: 750,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [shimmerAnim]);

  const baseBg = colors.cardHighlight || "rgba(100, 116, 139, 0.12)";

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
        { backgroundColor: colors.cardBackground, borderColor: colors.border },
      ]}
    >
      <View style={styles.row}>
        <SkeletonCircle size={56} />
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
 * KPI Grid Skeleton
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
            { backgroundColor: colors.cardBackground, borderColor: colors.border },
          ]}
        >
          <SkeletonCircle size={36} style={{ alignSelf: "center", marginBottom: 8 }} />
          <SkeletonText width="50%" height={18} style={{ alignSelf: "center", marginBottom: 4 }} />
          <SkeletonText width="70%" height={11} style={{ alignSelf: "center" }} />
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
        { backgroundColor: colors.cardBackground, borderColor: colors.border },
      ]}
    >
      <View style={styles.row}>
        <SkeletonBox width={42} height={42} borderRadius={12} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <SkeletonText width="65%" height={15} />
          <SkeletonText width="40%" height={11} style={{ marginTop: 4 }} />
        </View>
        <SkeletonBox width={20} height={20} borderRadius={10} />
      </View>
    </View>
  );
}

/**
 * Full Screen Skeleton Layout Placeholder
 */
export function SkeletonScreenLoader({
  showProfile = true,
  showKPIs = true,
  listCount = 4,
}) {
  return (
    <View style={styles.screenWrapper}>
      {showProfile && <SkeletonProfileCard />}
      {showKPIs && <SkeletonKPIRow count={2} />}
      <View style={{ marginTop: 12 }}>
        {Array.from({ length: listCount }).map((_, idx) => (
          <SkeletonListItem key={idx} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screenWrapper: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  cardContainer: {
    padding: 18,
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
  kpiRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 14,
  },
  kpiCard: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    alignItems: "center",
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

export default SkeletonBox;

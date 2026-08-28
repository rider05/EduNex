import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import {
  Platform,
  StatusBar,
  Animated,
  PanResponder,
  View,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as NavigationBar from "expo-navigation-bar";

const ImmersiveBarsContext = createContext({
  isBarsVisible: true,
  showBars: () => {},
  hideBars: () => {},
  resetHideTimer: () => {},
  insets: { top: 0, bottom: 0, left: 0, right: 0 },
  animValue: new Animated.Value(1),
});

export const useImmersiveBars = () => useContext(ImmersiveBarsContext);

const HIDE_TIMEOUT_MS = 3000; // 3 seconds

export function ImmersiveBarsProvider({ children }) {
  const insets = useSafeAreaInsets();
  const [isBarsVisible, setIsBarsVisible] = useState(true);
  const hideTimerRef = useRef(null);
  const animValue = useRef(new Animated.Value(1)).current; // 1 = visible, 0 = hidden

  // Synchronize System Navigation Bar & Status Bar with visibility state
  const syncSystemBars = useCallback((visible) => {
    try {
      StatusBar.setHidden(!visible, "slide");

      if (Platform.OS === "android") {
        if (visible) {
          NavigationBar.setVisibilityAsync("visible").catch(() => {});
          NavigationBar.setBehaviorAsync("overlay-swipe").catch(() => {});
        } else {
          NavigationBar.setVisibilityAsync("hidden").catch(() => {});
          NavigationBar.setBehaviorAsync("overlay-swipe").catch(() => {});
        }
      }
    } catch (_e) {
      // safe fallback
    }
  }, []);

  const hideBars = useCallback(() => {
    setIsBarsVisible(false);
    syncSystemBars(false);
    Animated.timing(animValue, {
      toValue: 0,
      duration: 250,
      useNativeDriver: false,
    }).start();
  }, [syncSystemBars, animValue]);

  const showBars = useCallback(() => {
    setIsBarsVisible(true);
    syncSystemBars(true);
    Animated.timing(animValue, {
      toValue: 1,
      duration: 200,
      useNativeDriver: false,
    }).start();

    // Reset 3-second auto-hide timer
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      hideBars();
    }, HIDE_TIMEOUT_MS);
  }, [hideBars, syncSystemBars, animValue]);

  const resetHideTimer = useCallback(() => {
    if (!isBarsVisible) {
      showBars();
      return;
    }
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      hideBars();
    }, HIDE_TIMEOUT_MS);
  }, [isBarsVisible, showBars, hideBars]);

  // Start 3s countdown on initial mount
  useEffect(() => {
    showBars();
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [showBars]);

  // Top Trigger Area PanResponder: Detect pull down / touch near top edge
  const topPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_evt, gestureState) => {
        // Trigger on downward drag / pull
        return gestureState.dy > 4;
      },
      onPanResponderGrant: () => {
        showBars();
      },
      onPanResponderRelease: () => {
        resetHideTimer();
      },
    })
  ).current;

  // Bottom Trigger Area PanResponder: Detect pull up / touch near bottom edge
  const bottomPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_evt, gestureState) => {
        // Trigger on upward drag / pull
        return gestureState.dy < -4;
      },
      onPanResponderGrant: () => {
        showBars();
      },
      onPanResponderRelease: () => {
        resetHideTimer();
      },
    })
  ).current;

  // Global Interaction Watcher: Awaken bars and restart 3s timer on active touches
  const globalTouchHandler = () => {
    resetHideTimer();
  };

  const topTriggerHeight = Math.max(insets.top + 36, 48);
  const bottomTriggerHeight = Math.max(insets.bottom + 48, 56);

  return (
    <ImmersiveBarsContext.Provider
      value={{
        isBarsVisible,
        showBars,
        hideBars,
        resetHideTimer,
        insets,
        animValue,
      }}
    >
      <View
        style={styles.rootContainer}
        onStartShouldSetResponderCapture={() => {
          globalTouchHandler();
          return false;
        }}
      >
        <StatusBar
          hidden={!isBarsVisible}
          showHideTransition="slide"
          translucent
          backgroundColor="transparent"
          barStyle="light-content"
        />

        {children}

        {/* TOP EDGE TRIGGER ZONE: Pull down near top edge to reveal status bar */}
        {!isBarsVisible && (
          <View
            {...topPanResponder.panHandlers}
            style={[
              styles.topTriggerZone,
              { height: topTriggerHeight },
            ]}
          >
            <View style={styles.topPullPill} />
          </View>
        )}

        {/* BOTTOM EDGE TRIGGER ZONE: Pull up near bottom edge to reveal navigation bar */}
        {!isBarsVisible && (
          <View
            {...bottomPanResponder.panHandlers}
            style={[
              styles.bottomTriggerZone,
              { height: bottomTriggerHeight },
            ]}
          >
            <View style={styles.bottomPullPill} />
          </View>
        )}
      </View>
    </ImmersiveBarsContext.Provider>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
  },
  topTriggerZone: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    justifyContent: "flex-start",
    alignItems: "center",
    backgroundColor: "transparent",
  },
  topPullPill: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255, 255, 255, 0.4)",
    marginTop: 6,
  },
  bottomTriggerZone: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    justifyContent: "flex-end",
    alignItems: "center",
    backgroundColor: "transparent",
  },
  bottomPullPill: {
    width: 48,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255, 255, 255, 0.4)",
    marginBottom: 6,
  },
});

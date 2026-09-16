import React, { useRef, useState, useEffect, createContext, useContext } from "react";
import {
  Animated,
  StyleSheet,
  Dimensions,
  Easing,
  View,
  Text,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";

const { width } = Dimensions.get("window");
const ToastContext = createContext();

export function ToastProvider({ children }) {
  const [message, setMessage] = useState("");
  const [type, setType] = useState("success");
  const [visible, setVisible] = useState(false);
  const animationRef = useRef(null);
  const hideTimerRef = useRef(null);

  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTranslateY = useRef(new Animated.Value(40)).current;
  const toastScale = useRef(new Animated.Value(0.85)).current;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        animationRef.current.stop();
      }
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, []);

  const showToast = (msg, t = "success") => {
    if (!msg) return;

    if (animationRef.current) {
      animationRef.current.stop();
      animationRef.current = null;
    }
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }

    setMessage(String(msg));
    setType((t || "success").toLowerCase());
    setVisible(true);

    toastOpacity.setValue(0);
    toastTranslateY.setValue(40);
    toastScale.setValue(0.85);

    // Smooth native entrance
    const entranceAnim = Animated.parallel([
      Animated.timing(toastOpacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.spring(toastTranslateY, {
        toValue: 0,
        friction: 7,
        tension: 80,
        useNativeDriver: true,
      }),
      Animated.spring(toastScale, {
        toValue: 1,
        friction: 7,
        tension: 80,
        useNativeDriver: true,
      }),
    ]);

    animationRef.current = entranceAnim;
    entranceAnim.start(() => {
      animationRef.current = null;

      // Auto dismiss after 2.8s
      hideTimerRef.current = setTimeout(() => {
        const exitAnim = Animated.parallel([
          Animated.timing(toastOpacity, {
            toValue: 0,
            duration: 250,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(toastTranslateY, {
            toValue: 30,
            duration: 250,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(toastScale, {
            toValue: 0.9,
            duration: 250,
            useNativeDriver: true,
          }),
        ]);

        animationRef.current = exitAnim;
        exitAnim.start(() => {
          animationRef.current = null;
          setVisible(false);
        });
      }, 2800);
    });
  };

  const getIcon = () => {
    switch (type) {
      case "success":
        return "check-circle-outline";
      case "error":
        return "alert-circle-outline";
      case "warning":
        return "alert-outline";
      default:
        return "information-outline";
    }
  };

  const getColor = () => {
    switch (type) {
      case "success":
        return "#10B981";
      case "error":
        return "#EF4444";
      case "warning":
        return "#F59E0B";
      default:
        return "#3B82F6";
    }
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {visible && (
        <Animated.View
          style={[
            styles.outerWrapper,
            {
              opacity: toastOpacity,
              transform: [{ translateY: toastTranslateY }, { scale: toastScale }],
            },
          ]}
          pointerEvents="none"
        >
          <View
            style={[
              styles.toastContainer,
              {
                backgroundColor: getColor(),
              },
            ]}
          >
            <View style={styles.iconWrapper}>
              <Icon name={getIcon()} size={22} color="#FFFFFF" />
            </View>

            <Text
              numberOfLines={2}
              ellipsizeMode="tail"
              style={[
                styles.toastText,
                message?.length > 45 ? { fontSize: 13 } : null,
              ]}
            >
              {message}
            </Text>
          </View>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

export const useAppToast = () => useContext(ToastContext);

const styles = StyleSheet.create({
  outerWrapper: {
    position: "absolute",
    bottom: 95,
    left: 16,
    right: 16,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    elevation: 9999,
  },
  toastContainer: {
    minHeight: 48,
    maxWidth: width * 0.88,
    borderRadius: 26,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  iconWrapper: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  toastText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    textAlignVertical: "center",
    flexShrink: 1,
    includeFontPadding: false,
    lineHeight: 18,
  },
});
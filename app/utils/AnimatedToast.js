import React, { useRef, useState, createContext, useContext } from "react";
import {
  Animated,
  StyleSheet,
  Dimensions,
  Easing,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";

const { width } = Dimensions.get("window");
const ToastContext = createContext();

export function ToastProvider({ children }) {
  const [message, setMessage] = useState("");
  const [type, setType] = useState("success");
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);
  const animationRef = useRef(null);

  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTranslateY = useRef(new Animated.Value(60)).current;
  const toastScale = useRef(new Animated.Value(0.85)).current;
  const toastWidth = useRef(new Animated.Value(55)).current;

  const getDynamicWidth = (text) => {
    const baseWidth = 100;
    const textLength = Math.max(0, text?.length || 0);
    const scaled = baseWidth + Math.min(textLength * 6, 200);
    return Math.min(scaled, width * 0.75);
  };

  const iconTranslateX = toastWidth.interpolate({
    inputRange: [55, width * 0.45],
    outputRange: [0, -6],
    extrapolate: "clamp",
  });

  const textOpacity = toastWidth.interpolate({
    inputRange: [55, width * 0.3, width * 0.5],
    outputRange: [0, 0, 1],
    extrapolate: "clamp",
  });

  const showToast = (msg, t = "success") => {
    const newWidth = getDynamicWidth(msg || "");

    if (animationRef.current) {
      animationRef.current.stop();
      animationRef.current = null;
    }

    if (animating) {
      Animated.timing(toastOpacity, {
        toValue: 0,
        duration: 100,
        useNativeDriver: true,
      }).start(() => {
        setMessage(msg);
        setType((t || "success").toLowerCase());
        resetAndStart(newWidth);
      });
    } else {
      setMessage(msg);
      setType((t || "success").toLowerCase());
      resetAndStart(newWidth);
    }
  };

  const resetAndStart = (targetWidth) => {
    setVisible(true);
    setAnimating(true);

    toastOpacity.setValue(0);
    toastTranslateY.setValue(60);
    toastScale.setValue(0.85);
    toastWidth.setValue(55);

    requestAnimationFrame(() => startAnimation(targetWidth));
  };

  const startAnimation = (targetWidth) => {
    const animation = Animated.sequence([
      Animated.parallel([
        Animated.timing(toastOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(toastScale, {
          toValue: 1,
          duration: 250,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]),

      Animated.timing(toastWidth, {
        toValue: targetWidth,
        duration: 700,
        useNativeDriver: false,
      }),

      Animated.delay(2200),

      Animated.parallel([
        Animated.timing(toastOpacity, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(toastWidth, {
          toValue: 55,
          duration: 400,
          useNativeDriver: false,
        }),
        Animated.timing(toastTranslateY, {
          toValue: 120,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(toastScale, {
          toValue: 0.9,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),

      Animated.delay(100),
    ]);

    animationRef.current = animation;

    animation.start(() => {
      animationRef.current = null;
      setAnimating(false);
      setVisible(false);
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
        return "#4CAF50";
      case "error":
        return "#E53935";
      case "warning":
        return "#FFC107";
      default:
        return "#2196F3";
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
          <Animated.View
            style={[
              styles.toastContainer,
              {
                width: toastWidth,
                backgroundColor: getColor(),
              },
            ]}
          >
            <Animated.View
              style={[
                styles.iconWrapper,
                { transform: [{ translateX: iconTranslateX }] },
              ]}
            >
              <Icon name={getIcon()} size={22} color="#fff" />
            </Animated.View>

            <Animated.Text
              numberOfLines={1}
              ellipsizeMode="tail"
              style={[
                styles.toastText,
                { opacity: textOpacity },
                message?.length > 60 ? { fontSize: 13 } : null,
              ]}
            >
              {message}
            </Animated.Text>
          </Animated.View>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

export const useAppToast = () => useContext(ToastContext);

const styles = StyleSheet.create({
  outerWrapper: {
    position: "absolute",
    bottom: 110, // raised slightly higher for better visibility
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    elevation: 9999,
  },
  toastContainer: {
    height: 52,
    borderRadius: 26,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center", // perfectly centered content
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    overflow: "hidden",
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  iconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  toastText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    textAlignVertical: "center",
    flexShrink: 1,
    includeFontPadding: false,
  },
});
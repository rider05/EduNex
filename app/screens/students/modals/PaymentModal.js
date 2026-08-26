import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  Modal,
  StyleSheet,
  Animated,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Dimensions,
  PanResponder,
  StatusBar,
  Platform,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useTheme } from "../../../context/ThemeContext";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const COLLAPSED_Y = 200;
const OPEN_THRESHOLD = 120;
const CLOSE_THRESHOLD = 120;
const VELOCITY_THRESHOLD = 1.2;

export default function PaymentModal({ visible, onClose }) {
  const { colors, isDarkMode } = useTheme();

  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const lastTranslateY = useRef(SCREEN_HEIGHT);

  const [step, setStep] = useState("gateway");
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [upiId, setUpiId] = useState("");
  const [bank, setBank] = useState("");
  const [cardDetails, setCardDetails] = useState({
    number: "",
    expiry: "",
    cvv: "",
  });

  const [cameraVisible, setCameraVisible] = useState(false);
  const [flashOn, setFlashOn] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [isFullscreen, setIsFullscreen] = useState(false);

  const SAFE_TOP = Platform.OS === "android" ? (StatusBar.currentHeight || 16) : 50;

  const animateTo = useCallback((value) => {
    lastTranslateY.current = value;
    Animated.spring(translateY, {
      toValue: value,
      tension: 60,
      friction: 9,
      useNativeDriver: true,
    }).start();
  }, [translateY]);

  useEffect(() => {
    if (visible) {
      setStep("gateway");
      setSelectedMethod(null);
      setUpiId("");
      setBank("");
      setCardDetails({ number: "", expiry: "", cvv: "" });
      setIsFullscreen(false);

      animateTo(COLLAPSED_Y);
    } else animateTo(SCREEN_HEIGHT);
  }, [visible, animateTo]);

  /* ------------------- DRAG GESTURES ------------------- */
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 5,

      onPanResponderGrant: () => {
        translateY.stopAnimation();
      },

      onPanResponderMove: (_, g) => {
        let newVal = lastTranslateY.current + g.dy;
        newVal = Math.max(0, Math.min(SCREEN_HEIGHT, newVal));
        translateY.setValue(newVal);
      },

      onPanResponderRelease: (_, g) => {
        const final = lastTranslateY.current + g.dy;

        if (g.vy < -VELOCITY_THRESHOLD) return goFull();
        if (g.vy > VELOCITY_THRESHOLD) return closeSheet();

        if (final < COLLAPSED_Y - OPEN_THRESHOLD) return goFull();
        if (final > COLLAPSED_Y + CLOSE_THRESHOLD) return closeSheet();

        animateTo(isFullscreen ? 0 : COLLAPSED_Y);
      },
    })
  ).current;

  const goFull = () => {
    setIsFullscreen(true);
    animateTo(0);
  };

  const closeSheet = () => {
    setIsFullscreen(false);
    animateTo(SCREEN_HEIGHT);
    setTimeout(onClose, 250);
  };

  /* ---------------- PROCEED PAYMENT ---------------- */
  const handleProceedPayment = () => {
    if (!selectedMethod) return alert("Choose a method!");
    if (selectedMethod === "upi" && !upiId) return alert("Enter UPI ID!");
    if (
      selectedMethod === "card" &&
      (!cardDetails.number || !cardDetails.expiry || !cardDetails.cvv)
    )
      return alert("Fill card details!");
    if (selectedMethod === "netbank" && !bank) return alert("Enter bank name!");

    setStep("processing");
    setTimeout(() => setStep("success"), 2200);
  };

  /* ---------------- CAMERA ---------------- */
  const handleOpenCamera = async () => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) return alert("Camera permission needed.");
    }
    setCameraVisible(true);
  };

  const handleScanned = ({ data }) => {
    setCameraVisible(false);
    setUpiId(data);
  };

  const styles = getStyles(colors, isDarkMode, SAFE_TOP, isFullscreen);

  return (
    <>
      {/* ---------- PAYMENT SHEET ---------- */}
      <Modal visible={visible} transparent animationType="none">
        <View style={styles.overlay}>
          <Animated.View
            style={[
              styles.sheet,
              {
                transform: [{ translateY }],
                height: isFullscreen ? SCREEN_HEIGHT - SAFE_TOP : undefined,
              },
            ]}
          >
            {/* DRAG HANDLE */}
            <View {...panResponder.panHandlers} style={styles.handleContainer}>
              <View style={[styles.handle, { backgroundColor: colors.border }]} />

              {isFullscreen && (
                <TouchableOpacity style={styles.closeX} onPress={closeSheet}>
                  <Icon name="close" size={26} color={colors.primaryText} />
                </TouchableOpacity>
              )}
            </View>

            {/* CONTENT */}
            {step === "gateway" && (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* HEADER */}
                <View style={styles.header}>
                  <Icon name="credit-card-outline" size={30} color={colors.primaryAccent} />
                  <Text style={[styles.headerTitle, { color: colors.primaryText }]}>
                    Payment Gateway
                  </Text>
                </View>

                {/* SUBTITLE */}
                <Text style={[styles.subtitle, { color: colors.secondaryText }]}>
                  Choose a payment method
                </Text>

                {/* METHOD OPTIONS */}
                <View style={styles.methodList}>
                  {[
                    { id: "upi", icon: "qrcode-scan", name: "UPI / Google Pay" },
                    { id: "card", icon: "credit-card-outline", name: "Credit / Debit Card" },
                    { id: "netbank", icon: "bank-outline", name: "Net Banking" },
                  ].map((m) => (
                    <TouchableOpacity
                      key={m.id}
                      style={[
                        styles.methodItem,
                        {
                          borderColor:
                            selectedMethod === m.id ? colors.primaryAccent : colors.border,
                          backgroundColor:
                            selectedMethod === m.id ? `${colors.primaryAccent}25` : colors.cardBackground,
                        },
                      ]}
                      onPress={() => setSelectedMethod(m.id)}
                    >
                      <View style={styles.methodLeft}>
                        <Icon
                          name={m.icon}
                          size={26}
                          color={
                            selectedMethod === m.id ? colors.primaryAccent : colors.secondaryText
                          }
                        />
                        <Text
                          style={[
                            styles.methodText,
                            {
                              color:
                                selectedMethod === m.id ? colors.primaryAccent : colors.primaryText,
                            },
                          ]}
                        >
                          {m.name}
                        </Text>
                      </View>

                      {selectedMethod === m.id && (
                        <Icon name="check-circle" size={22} color={colors.primaryAccent} />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>

                {/* UPI INPUT */}
                {selectedMethod === "upi" && (
                  <View style={styles.inputBox}>
                    <Text style={[styles.label, { color: colors.secondaryText }]}>
                      Enter UPI ID
                    </Text>
                    <View style={styles.upiRow}>
                      <TextInput
                        style={[styles.input, { flex: 1 }]}
                        placeholder="example@upi"
                        placeholderTextColor={isDarkMode ? "#777" : "#999"}
                        value={upiId}
                        onChangeText={setUpiId}
                      />
                      <TouchableOpacity style={styles.cameraBtn} onPress={handleOpenCamera}>
                        <Icon name="camera" size={22} color={colors.primaryAccent} />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* CARD INPUT */}
                {selectedMethod === "card" && (
                  <View style={styles.inputBox}>
                    <Text style={[styles.label, { color: colors.secondaryText }]}>
                      Card Details
                    </Text>

                    <View style={styles.cardRow}>
                      <Icon name="credit-card-outline" size={22} color={colors.primaryAccent} />
                      <TextInput
                        style={styles.cardInput}
                        placeholder="Card Number"
                        keyboardType="numeric"
                        maxLength={16}
                        placeholderTextColor={isDarkMode ? "#777" : "#aaa"}
                        value={cardDetails.number}
                        onChangeText={(v) =>
                          setCardDetails({ ...cardDetails, number: v })
                        }
                      />
                    </View>

                    <View style={styles.cardSplitRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.smallLabel}>Expiry</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="MM/YY"
                          maxLength={5}
                          placeholderTextColor={isDarkMode ? "#777" : "#aaa"}
                          value={cardDetails.expiry}
                          onChangeText={(v) =>
                            setCardDetails({ ...cardDetails, expiry: v })
                          }
                        />
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={styles.smallLabel}>CVV</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="***"
                          secureTextEntry
                          maxLength={3}
                          keyboardType="numeric"
                          placeholderTextColor={isDarkMode ? "#777" : "#aaa"}
                          value={cardDetails.cvv}
                          onChangeText={(v) =>
                            setCardDetails({ ...cardDetails, cvv: v })
                          }
                        />
                      </View>
                    </View>
                  </View>
                )}

                {/* NET BANK */}
                {selectedMethod === "netbank" && (
                  <View style={styles.inputBox}>
                    <Text style={[styles.label, { color: colors.secondaryText }]}>
                      Bank Name
                    </Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter bank"
                      placeholderTextColor={isDarkMode ? "#777" : "#aaa"}
                      value={bank}
                      onChangeText={setBank}
                    />
                  </View>
                )}

                {/* ACTION BUTTONS */}
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={[styles.cancelBtn, { borderColor: colors.primaryAccent }]}
                    onPress={closeSheet}
                  >
                    <Text style={[styles.cancelText, { color: colors.primaryAccent }]}>
                      Cancel
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.payBtn, { backgroundColor: colors.primaryAccent }]}
                    onPress={handleProceedPayment}
                  >
                    <Text style={styles.payText}>Proceed</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}

            {/* PROCESSING */}
            {step === "processing" && (
              <View style={styles.centeredBox}>
                <Icon name="credit-card-sync-outline" size={60} color={colors.primaryAccent} />
                <Text style={[styles.headerTitle, { color: colors.primaryText }]}>
                  Processing Payment...
                </Text>
              </View>
            )}

            {/* SUCCESS */}
            {step === "success" && (
              <View style={styles.centeredBox}>
                <Icon name="check-circle" size={70} color={colors.successText} />
                <Text style={[styles.headerTitle, { color: colors.successText }]}>
                  Payment Successful!
                </Text>

                <TouchableOpacity
                  style={[styles.successClose, { backgroundColor: colors.primaryAccent }]}
                  onPress={closeSheet}
                >
                  <Text style={styles.successCloseText}>Close</Text>
                </TouchableOpacity>
              </View>
            )}
          </Animated.View>
        </View>
      </Modal>

      {/* ---------- CAMERA ---------- */}
      <Modal visible={cameraVisible} animationType="slide">
        <View style={styles.cameraOverlay}>
          <CameraView
            style={styles.fullCamera}
            onBarcodeScanned={handleScanned}
            enableTorch={flashOn}
          />

          <View style={[styles.cameraHeader, { top: SAFE_TOP }]}>
            <TouchableOpacity onPress={() => setCameraVisible(false)}>
              <Icon name="arrow-left" size={30} color="#fff" />
            </TouchableOpacity>

            <Text style={styles.cameraTitle}>Scan UPI QR</Text>

            <TouchableOpacity onPress={() => setFlashOn(!flashOn)}>
              <Icon
                name={flashOn ? "flash" : "flash-off"}
                size={30}
                color={flashOn ? "#FFD700" : "#fff"}
              />
            </TouchableOpacity>
          </View>

          {/* ⭐ SCAN NOW BUTTON ⭐ */}
          <TouchableOpacity style={styles.scanNowBtn}>
            <Icon name="qrcode-scan" size={26} color="#fff" />
            <Text style={styles.scanNowText}>Scan Now</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </>
  );
}

/* ----------------------- STYLES ----------------------- */

const getStyles = (colors, isDarkMode, SAFE_TOP, isFullscreen) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: "rgba(0,0,0,0.4)",
    },

    sheet: {
      width: SCREEN_WIDTH,
      position: "absolute",
      bottom: 0,
      backgroundColor: colors.cardBackground,
      paddingTop: isFullscreen ? SAFE_TOP : 14,
      paddingHorizontal: 20,
      paddingBottom: 20,
      borderTopLeftRadius: isFullscreen ? 0 : 25,
      borderTopRightRadius: isFullscreen ? 0 : 25,
      minHeight: SCREEN_HEIGHT - COLLAPSED_Y,
    },

    handleContainer: {
      alignItems: "center",
      paddingBottom: 8,
    },
    handle: {
      width: 60,
      height: 6,
      borderRadius: 6,
      opacity: 0.9,
    },
    closeX: {
      position: "absolute",
      right: 10,
      top: -6,
      padding: 6,
      zIndex: 20,
    },

    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginBottom: 8,
    },
    headerTitle: {
      fontSize: 22,
      fontWeight: "800",
    },
    subtitle: {
      fontSize: 14,
      marginBottom: 15,
    },

    methodList: {
      gap: 12,
      marginBottom: 20,
    },
    methodItem: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 14,
      paddingHorizontal: 12,
      borderWidth: 1.4,
      borderRadius: 12,
    },
    methodLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    methodText: {
      fontSize: 15,
      fontWeight: "600",
    },

    inputBox: {
      marginBottom: 18,
    },
    label: {
      fontSize: 13,
      fontWeight: "600",
      marginBottom: 6,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingVertical: 10,
      paddingHorizontal: 12,
      backgroundColor: colors.inputBackground,
      color: colors.primaryText,
    },

    upiRow: {
      flexDirection: "row",
      alignItems: "center",
    },

    cameraBtn: {
      marginLeft: 10,
      padding: 10,
      borderRadius: 10,
      backgroundColor: `${colors.primaryAccent}22`,
      justifyContent: "center",
      alignItems: "center",
    },

    cardRow: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      backgroundColor: colors.inputBackground,
      marginBottom: 10,
    },
    cardInput: {
      flex: 1,
      paddingVertical: 10,
      paddingHorizontal: 10,
      fontSize: 15,
      color: colors.primaryText,
    },
    cardSplitRow: {
      flexDirection: "row",
      gap: 12,
    },
    smallLabel: {
      fontSize: 12,
      marginBottom: 5,
      color: colors.secondaryText,
    },

    actions: {
      flexDirection: "row",
      marginTop: 10,
      gap: 10,
    },
    cancelBtn: {
      flex: 1,
      borderWidth: 1.3,
      paddingVertical: 12,
      borderRadius: 10,
      alignItems: "center",
    },
    cancelText: {
      fontWeight: "700",
      fontSize: 15,
    },
    payBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 10,
      alignItems: "center",
    },
    payText: {
      color: "#fff",
      fontSize: 15,
      fontWeight: "700",
    },

    centeredBox: {
      alignItems: "center",
      paddingTop: 60,
      paddingBottom: 80,
    },
    successClose: {
      marginTop: 18,
      paddingVertical: 12,
      paddingHorizontal: 30,
      borderRadius: 10,
    },
    successCloseText: {
      color: "#fff",
      fontSize: 16,
      fontWeight: "700",
    },

    /* CAMERA */
    cameraOverlay: {
      flex: 1,
      backgroundColor: "#000",
    },
    fullCamera: {
      flex: 1,
    },
    cameraHeader: {
      position: "absolute",
      left: 0,
      right: 0,
      paddingHorizontal: 20,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    cameraTitle: {
      color: "#fff",
      fontSize: 18,
      fontWeight: "700",
    },

    scanNowBtn: {
      position: "absolute",
      bottom: 80,
      alignSelf: "center",
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 12,
      paddingHorizontal: 20,
      backgroundColor: "#2196F3",
      borderRadius: 30,
      elevation: 5,
    },
    scanNowText: {
      color: "#fff",
      fontSize: 16,
      fontWeight: "700",
      marginLeft: 10,
    },
  });
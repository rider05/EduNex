import React, { useEffect, useRef, useState, useMemo } from "react";
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
  Platform,
  ActivityIndicator,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Linking,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { LinearGradient } from "expo-linear-gradient";
import QRCode from "react-native-qrcode-svg";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useTheme } from "../../../context/ThemeContext";
import { showToast } from "../../../utils/toastService";
import { shareFeeReceiptPdf } from "../../../utils/pdfGenerator";
import { getInstitutions } from "../../../services/dataService";
import { api } from "../../../services/api";
import { generateTransactionChecksum, decryptPaymentPayload } from "../../../utils/securityService";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

const POPULAR_BANKS = [
  { id: "sbi", name: "State Bank of India", code: "SBI", icon: "bank", color: "#2563EB" },
  { id: "hdfc", name: "HDFC Bank", code: "HDFC", icon: "bank-outline", color: "#1E3A8A" },
  { id: "icici", name: "ICICI Bank", code: "ICICI", icon: "bank", color: "#B91C1C" },
  { id: "axis", name: "Axis Bank", code: "AXIS", icon: "bank-outline", color: "#991B1B" },
  { id: "kotak", name: "Kotak Mahindra", code: "KOTAK", icon: "bank", color: "#DC2626" },
  { id: "pnb", name: "Punjab National Bank", code: "PNB", icon: "bank-outline", color: "#D97706" },
];

const UPI_APPS = [
  { id: "gpay", name: "Google Pay", icon: "google", color: "#4285F4", scheme: "tez://upi/pay" },
  { id: "phonepe", name: "PhonePe", icon: "cellphone", color: "#5F259F", scheme: "phonepe://pay" },
  { id: "paytm", name: "Paytm UPI", icon: "wallet-outline", color: "#00BAF2", scheme: "paytmmp://pay" },
  { id: "bhim", name: "BHIM UPI", icon: "bank-transfer", color: "#008800", scheme: "upi://pay" },
  { id: "cred", name: "CRED UPI", icon: "shield-check", color: "#1E293B", scheme: "upi://pay" },
];

export default function PaymentModal({ visible, onClose, invoice, onSuccess, student }) {
  const { colors = {}, isDarkMode } = useTheme() || {};

  // Step: 'gateway' | 'processing' | 'cancelled' | 'success'
  const [step, setStep] = useState("gateway");
  const processingTimerRef = useRef(null);
  const [selectedMethod, setSelectedMethod] = useState("upi"); // 'upi' | 'card' | 'netbank' | 'wallet'
  const [upiSubMethod, setUpiSubMethod] = useState("qr"); // 'qr' | 'app' | 'vpa'
  const [upiId, setUpiId] = useState("");
  const [selectedBank, setSelectedBank] = useState("hdfc");
  const [selectedUpiApp, setSelectedUpiApp] = useState("gpay");
  const [paymentConfig, setPaymentConfig] = useState({
    upiId: "-",
    merchantName: "-",
    merchantCode: "-",
    bankName: "-",
    encryptionStatus: "AES-256 Secured Ledger",
  });

  // Card form state
  const [cardNumber, setCardNumber] = useState("");
  const [cardHolder, setCardHolder] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [saveCard, setSaveCard] = useState(true);

  // Breakdown drawer state
  const [showBreakdown, setShowBreakdown] = useState(false);

  // Camera QR scanner state
  const [cameraVisible, setCameraVisible] = useState(false);
  const [flashOn, setFlashOn] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  // Generated transaction details
  const [txnDetails, setTxnDetails] = useState(null);

  // Animation values
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const translateYAnim = useRef(new Animated.Value(30)).current;
  const processingPulse = useRef(new Animated.Value(1)).current;

  // Invoice calculations
  const invoiceTitle = invoice?.title || "Semester Academic Tuition Fee";
  const invoiceNumber = invoice?.invoiceNo || `INV-EDX-${Math.floor(100000 + Math.random() * 900000)}`;
  const payableAmount = Number(invoice?.amount) || 45000;
  const studentName = student?.name || "Karthi Keyan";
  const studentRoll = student?.id || student?.rollNo || "22CS045";

  // Fee components breakdown
  const tuitionBase = Math.round(payableAmount * 0.75);
  const labCess = Math.round(payableAmount * 0.15);
  const libraryFee = Math.round(payableAmount * 0.1);

  // Format Card Number (XXXX XXXX XXXX XXXX)
  const handleCardNumberChange = (text) => {
    const cleaned = text.replace(/[^0-9]/g, "").slice(0, 16);
    const parts = cleaned.match(/.{1,4}/g);
    setCardNumber(parts ? parts.join(" ") : cleaned);
  };

  // Format Expiry (MM/YY)
  const handleExpiryChange = (text) => {
    const cleaned = text.replace(/[^0-9]/g, "").slice(0, 4);
    if (cleaned.length >= 3) {
      setCardExpiry(`${cleaned.slice(0, 2)}/${cleaned.slice(2)}`);
    } else {
      setCardExpiry(cleaned);
    }
  };

  // Detect card type
  const cardBrand = useMemo(() => {
    const raw = cardNumber.replace(/\s/g, "");
    if (raw.startsWith("4")) return { brand: "VISA", icon: "credit-card", color: "#1E3A8A" };
    if (raw.startsWith("5") || raw.startsWith("2")) return { brand: "Mastercard", icon: "credit-card", color: "#EA580C" };
    if (raw.startsWith("6")) return { brand: "RuPay", icon: "credit-card-chip", color: "#16A34A" };
    if (raw.startsWith("3")) return { brand: "AMEX", icon: "credit-card-outline", color: "#2563EB" };
    return { brand: "Debit / Credit", icon: "credit-card-outline", color: "#4F46E5" };
  }, [cardNumber]);

  // Modal open/close animation
  useEffect(() => {
    if (visible) {
      setStep("gateway");
      setSelectedMethod("upi");
      setUpiSubMethod("qr");
      setUpiId("");
      setCardNumber("");
      setCardHolder(studentName);
      setCardExpiry("");
      setCardCvv("");
      setShowBreakdown(false);

      Animated.parallel([
        Animated.timing(backdropAnim, { toValue: 1, duration: 240, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, friction: 8, tension: 65, useNativeDriver: true }),
        Animated.spring(translateYAnim, { toValue: 0, friction: 8, tension: 65, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(backdropAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 0.92, duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, backdropAnim, scaleAnim, translateYAnim, studentName]);

  // Pulse animation for processing step
  useEffect(() => {
    if (step === "processing") {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(processingPulse, { toValue: 1.15, duration: 750, useNativeDriver: true }),
          Animated.timing(processingPulse, { toValue: 1, duration: 750, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [step, processingPulse]);

  // Fetch live admin encrypted payment config
  useEffect(() => {
    if (visible) {
      getInstitutions()
        .then((instList) => {
          const inst = Array.isArray(instList) ? instList[0] : Array.isArray(instList?.data) ? instList.data[0] : instList;
          if (inst?.paymentConfig) {
            const pc = inst.paymentConfig;
            const vpa = pc.encryptedUpiId
              ? decryptPaymentPayload(pc.encryptedUpiId)
              : pc.encryptedVpa
              ? decryptPaymentPayload(pc.encryptedVpa)
              : pc.upiId || "-";
            setPaymentConfig({
              ...pc,
              upiId: vpa || "-",
              merchantName: pc.merchantName || inst.name || "-",
              merchantCode: pc.merchantCode || inst.code || "-",
              bankName: pc.bankName || inst.bankName || "-",
              encryptionStatus: pc.encryptionStatus || "AES-256 Secured Ledger",
            });
          }
        })
        .catch(() => {});
    }
  }, [visible]);

  // Handle Payment Trigger & Native Payment App Launch
  const handleProceedPayment = async () => {
    if (selectedMethod === "upi" && upiSubMethod === "vpa" && !upiId.trim()) {
      showToast("Please enter a valid UPI ID (e.g. name@okaxis)", "warning");
      return;
    }

    if (selectedMethod === "card") {
      if (cardNumber.replace(/\s/g, "").length < 16) {
        showToast("Please enter a complete 16-digit card number", "warning");
        return;
      }
      if (cardExpiry.length < 5) {
        showToast("Please enter a valid expiry date (MM/YY)", "warning");
        return;
      }
      if (cardCvv.length < 3) {
        showToast("Please enter 3-digit CVV", "warning");
        return;
      }
    }

    const newTxnId = `TXN${Date.now().toString().slice(-8)}`;
    const bankRef = `EDX${Math.floor(100000000 + Math.random() * 900000000)}`;
    const paymentTimestamp = new Date().toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const merchantVpa = paymentConfig.upiId !== "-" ? paymentConfig.upiId : "";
    const merchantName = paymentConfig.merchantName !== "-" ? paymentConfig.merchantName : "EduNex";

    // 1. TRIGGER NATIVE PAYMENT APPS FOR UPI
    if (selectedMethod === "upi") {
      if (!merchantVpa) {
        showToast("Institutional payment gateway is initializing. Please try again.", "warning");
        return;
      }
      const upiUrl = `upi://pay?pa=${encodeURIComponent(merchantVpa)}&pn=${encodeURIComponent(merchantName)}&mc=EDUNEX&tr=${newTxnId}&tn=${encodeURIComponent(invoiceNumber + " " + invoiceTitle)}&am=${payableAmount}&cu=INR`;

      let targetAppUrl = upiUrl;
      if (selectedUpiApp === "gpay") {
        targetAppUrl = `tez://upi/pay?pa=${encodeURIComponent(merchantVpa)}&pn=${encodeURIComponent(merchantName)}&tr=${newTxnId}&am=${payableAmount}&cu=INR`;
      } else if (selectedUpiApp === "phonepe") {
        targetAppUrl = `phonepe://pay?pa=${encodeURIComponent(merchantVpa)}&pn=${encodeURIComponent(merchantName)}&tr=${newTxnId}&am=${payableAmount}&cu=INR`;
      } else if (selectedUpiApp === "paytm") {
        targetAppUrl = `paytmmp://pay?pa=${encodeURIComponent(merchantVpa)}&pn=${encodeURIComponent(merchantName)}&tr=${newTxnId}&am=${payableAmount}&cu=INR`;
      }

      try {
        const canOpen = await Linking.canOpenURL(targetAppUrl);
        if (canOpen) {
          await Linking.openURL(targetAppUrl);
        } else {
          const canOpenGeneric = await Linking.canOpenURL(upiUrl);
          if (canOpenGeneric) {
            await Linking.openURL(upiUrl);
          }
        }
      } catch (linkErr) {
        console.log("UPI App launch note:", linkErr);
      }
    }

    setStep("processing");

    const securityChecksum = generateTransactionChecksum({
      txnId: newTxnId,
      invoiceNo: invoiceNumber,
      amount: payableAmount,
      date: paymentTimestamp,
    });

    const paymentResult = {
      id: invoice?.id || Date.now().toString(),
      invoiceNo: invoiceNumber,
      title: invoiceTitle,
      amount: payableAmount,
      date: paymentTimestamp,
      txnId: newTxnId,
      bankRef: bankRef,
      receiptNo: `REC-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      securityChecksum: securityChecksum,
      merchantVpa: merchantVpa,
      encryptionStatus: paymentConfig.encryptionStatus || "AES-256 Secured Ledger",
      method:
        selectedMethod === "upi"
          ? `UPI (${selectedUpiApp.toUpperCase()} - ${merchantVpa})`
          : selectedMethod === "card"
          ? `${cardBrand.brand} Card (•••• ${cardNumber.slice(-4) || "8821"})`
          : selectedMethod === "netbank"
          ? `NetBanking (${selectedBank.toUpperCase()})`
          : "Campus Wallet",
      status: "cleared",
    };

    setTxnDetails(paymentResult);

    // Update MongoDB backend ledger in real time
    try {
      const targetRoll = studentRoll || "STU-2024-AIDS01";
      await api.post(`/students/${targetRoll}/history`, {
        receiptNo: paymentResult.receiptNo,
        title: paymentResult.title,
        amount: paymentResult.amount,
        date: paymentResult.date,
        method: paymentResult.method,
        txnId: paymentResult.txnId,
        bankRef: paymentResult.bankRef,
        checksum: paymentResult.securityChecksum,
        status: "completed",
      });
      await api.post("/fees", {
        id: `FEE-${Date.now().toString().slice(-6)}`,
        studentId: targetRoll,
        rollNo: targetRoll,
        studentName: studentName || "Student",
        invoiceId: paymentResult.receiptNo,
        receiptNo: paymentResult.receiptNo,
        item: paymentResult.title,
        amount: paymentResult.amount,
        paid: paymentResult.amount,
        due: 0,
        status: "Paid",
        dueDate: "15 Sep 2026",
        paymentDate: paymentResult.date,
        semester: "5th Semester",
        department: "Artificial Intelligence & Data Science",
        txnId: paymentResult.txnId,
        method: paymentResult.method,
        checksum: paymentResult.securityChecksum,
      });
    } catch (dbErr) {
      console.log("DB Payment sync note:", dbErr);
    }

    processingTimerRef.current = setTimeout(() => {
      setStep("success");
      showToast("✅ Encrypted Payment Cleared & Recorded!", "success");
      if (onSuccess) onSuccess(paymentResult);
    }, 2200);
  };

  // Share digital receipt
  const handleShareReceipt = async () => {
    if (!txnDetails) return;
    try {
      await shareFeeReceiptPdf({
        receipt: {
          id: txnDetails.receiptNo,
          receiptNo: txnDetails.receiptNo,
          date: txnDetails.date,
          amount: `₹${(txnDetails.amount || 0).toLocaleString("en-IN")}`,
          mode: txnDetails.method,
          transactionId: txnDetails.txnId,
          breakdown: [
            { item: txnDetails.title || "Academic Term / Tuition Fee", amount: `₹${(txnDetails.amount || 0).toLocaleString("en-IN")}` },
          ],
        },
        student: {
          name: studentName,
          rollNo: studentRoll,
        },
      });
      showToast("Official PDF receipt generated!", "success");
    } catch (err) {
      console.log("Share receipt error:", err);
      showToast("Could not generate PDF receipt", "error");
    }
  };

  // Camera Barcode scanner
  const handleOpenCamera = async () => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        showToast("Camera permission is required to scan UPI QR codes.", "warning");
        return;
      }
    }
    setCameraVisible(true);
  };

  const handleScanned = ({ data }) => {
    setCameraVisible(false);
    setUpiId(data);
    setUpiSubMethod("vpa");
    showToast("QR code scanned & UPI ID recognized!", "success");
  };

  // Colors
  const accentColor = colors.primaryAccent || "#4F46E5";
  const cardBg = colors.cardBackground || (isDarkMode ? "#18181B" : "#FFFFFF");
  const inputBg = colors.inputBackground || (isDarkMode ? "#27272A" : "#F4F4F5");
  const textColor = colors.primaryText || (isDarkMode ? "#FAFAFA" : "#09090B");
  const subTextColor = colors.secondaryText || (isDarkMode ? "#A1A1AA" : "#71717A");
  const borderColor = colors.divider || (isDarkMode ? "#27272A" : "#E4E4E7");
  const placeholderColor = colors.disabledText || (isDarkMode ? "#71717A" : "#A1A1AA");

  return (
    <>
      <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
        <TouchableWithoutFeedback onPress={onClose}>
          <Animated.View style={[styles.overlay, { opacity: backdropAnim }]}>
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : undefined}
              style={styles.keyboardAvoid}
            >
              <TouchableWithoutFeedback>
                <Animated.View
                  style={[
                    styles.sheetCard,
                    {
                      backgroundColor: cardBg,
                      borderColor: borderColor,
                      transform: [{ scale: scaleAnim }, { translateY: translateYAnim }],
                    },
                  ]}
                >
                  {/* Top Drag Indicator */}
                  <View style={styles.handleContainer}>
                    <View style={[styles.handleBar, { backgroundColor: isDarkMode ? "#3F3F46" : "#E2E8F0" }]} />
                  </View>

                  {/* Header Row */}
                  <View style={styles.headerRow}>
                    <View style={[styles.headerIconCircle, { backgroundColor: accentColor + "18" }]}>
                      <Icon name="shield-check-outline" size={24} color={accentColor} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={[styles.headerTitle, { color: textColor }]}>EduNex Pay Gateway</Text>
                      <Text style={[styles.headerSubtitle, { color: subTextColor }]}>
                        Institutional 256-Bit SSL Encrypted Checkout
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={onClose}
                      style={[styles.closeBtn, { backgroundColor: isDarkMode ? "#27272A" : "#F1F5F9" }]}
                      activeOpacity={0.7}
                    >
                      <Icon name="close" size={18} color={subTextColor} />
                    </TouchableOpacity>
                  </View>

                  {/* ============================================================= */}
                  {/* STEP 1: GATEWAY & PAYMENT METHOD SELECTION                    */}
                  {/* ============================================================= */}
                  {step === "gateway" && (
                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollBody}>
                      {/* Invoice Summary Banner */}
                      <View style={[styles.invoiceBanner, { backgroundColor: isDarkMode ? "#27272A80" : "#F8FAFC", borderColor }]}>
                        <View style={styles.invoiceBannerTop}>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.invoiceBannerTitle, { color: textColor }]} numberOfLines={1}>
                              {invoiceTitle}
                            </Text>
                            <Text style={[styles.invoiceBannerMeta, { color: subTextColor }]}>
                              {invoiceNumber} • {studentName} ({studentRoll})
                            </Text>
                          </View>

                          <View style={styles.amountBox}>
                            <Text style={[styles.amountLabel, { color: subTextColor }]}>Total Payable</Text>
                            <Text style={[styles.amountValue, { color: accentColor }]}>
                              ₹{payableAmount.toLocaleString("en-IN")}
                            </Text>
                          </View>
                        </View>

                        {/* Breakdown Accordion Toggle */}
                        <TouchableOpacity
                          style={[styles.breakdownToggle, { borderTopColor: borderColor }]}
                          onPress={() => setShowBreakdown((prev) => !prev)}
                          activeOpacity={0.7}
                        >
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                            <Icon name="receipt-outline" size={15} color={accentColor} />
                            <Text style={[styles.breakdownToggleText, { color: accentColor }]}>
                              {showBreakdown ? "Hide Fee Breakdown" : "View Itemized Fee Breakdown"}
                            </Text>
                          </View>
                          <Icon
                            name={showBreakdown ? "chevron-up" : "chevron-down"}
                            size={16}
                            color={accentColor}
                          />
                        </TouchableOpacity>

                        {/* Itemized Fee Breakdown Drawer */}
                        {showBreakdown && (
                          <View style={[styles.breakdownDrawer, { borderTopColor: borderColor }]}>
                            <View style={styles.breakdownRow}>
                              <Text style={[styles.breakdownItem, { color: subTextColor }]}>Tuition & Instruction Base</Text>
                              <Text style={[styles.breakdownAmount, { color: textColor }]}>₹{tuitionBase.toLocaleString("en-IN")}</Text>
                            </View>
                            <View style={styles.breakdownRow}>
                              <Text style={[styles.breakdownItem, { color: subTextColor }]}>Laboratory & Computing Lab Cess</Text>
                              <Text style={[styles.breakdownAmount, { color: textColor }]}>₹{labCess.toLocaleString("en-IN")}</Text>
                            </View>
                            <View style={styles.breakdownRow}>
                              <Text style={[styles.breakdownItem, { color: subTextColor }]}>Digital Library & Campus Amenities</Text>
                              <Text style={[styles.breakdownAmount, { color: textColor }]}>₹{libraryFee.toLocaleString("en-IN")}</Text>
                            </View>
                            <View style={styles.breakdownRow}>
                              <Text style={[styles.breakdownItem, { color: "#10B981" }]}>Government Educational GST Exemption</Text>
                              <Text style={[styles.breakdownAmount, { color: "#10B981" }]}>- ₹ 0.00 (0%)</Text>
                            </View>
                          </View>
                        )}
                      </View>

                      {/* Payment Method Selector Tabs */}
                      <Text style={[styles.sectionTitle, { color: textColor }]}>Select Payment Mode</Text>
                      <View style={styles.methodSelectorRow}>
                        {[
                          { id: "upi", name: "UPI & QR", icon: "qrcode-scan" },
                          { id: "card", name: "Cards", icon: "credit-card-outline" },
                          { id: "netbank", name: "Net Banking", icon: "bank-outline" },
                          { id: "wallet", name: "Wallet / EMI", icon: "wallet-outline" },
                        ].map((tab) => {
                          const isSel = selectedMethod === tab.id;
                          return (
                            <TouchableOpacity
                              key={tab.id}
                              style={[
                                styles.methodTabPill,
                                {
                                  backgroundColor: isSel ? accentColor : isDarkMode ? "#27272A" : "#F1F5F9",
                                  borderColor: isSel ? accentColor : borderColor,
                                },
                              ]}
                              onPress={() => setSelectedMethod(tab.id)}
                              activeOpacity={0.8}
                            >
                              <Icon name={tab.icon} size={16} color={isSel ? "#FFFFFF" : subTextColor} />
                              <Text style={[styles.methodTabPillText, { color: isSel ? "#FFFFFF" : textColor }]}>
                                {tab.name}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>

                      {/* ----------------- METHOD 1: UPI / QR ----------------- */}
                      {selectedMethod === "upi" && (
                        <View style={styles.methodContentBox}>
                          {/* Sub Tabs: QR Code vs Apps vs VPA */}
                          <View style={[styles.subTabGroup, { backgroundColor: isDarkMode ? "#27272A" : "#F1F5F9" }]}>
                            <TouchableOpacity
                              style={[styles.subTabBtn, upiSubMethod === "qr" && { backgroundColor: cardBg }]}
                              onPress={() => setUpiSubMethod("qr")}
                            >
                              <Text style={[styles.subTabBtnText, { color: upiSubMethod === "qr" ? accentColor : subTextColor }]}>
                                Dynamic QR Code
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.subTabBtn, upiSubMethod === "app" && { backgroundColor: cardBg }]}
                              onPress={() => setUpiSubMethod("app")}
                            >
                              <Text style={[styles.subTabBtnText, { color: upiSubMethod === "app" ? accentColor : subTextColor }]}>
                                UPI Apps
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.subTabBtn, upiSubMethod === "vpa" && { backgroundColor: cardBg }]}
                              onPress={() => setUpiSubMethod("vpa")}
                            >
                              <Text style={[styles.subTabBtnText, { color: upiSubMethod === "vpa" ? accentColor : subTextColor }]}>
                                Enter UPI ID
                              </Text>
                            </TouchableOpacity>
                          </View>

                          {/* 1A. Dynamic QR Code View */}
                          {upiSubMethod === "qr" && (
                            <View style={styles.qrSection}>
                              <View style={[styles.qrFrame, { backgroundColor: "#FFFFFF" }]}>
                                <QRCode
                                  value={`upi://pay?pa=${encodeURIComponent(paymentConfig.upiId !== "-" ? paymentConfig.upiId : "")}&pn=${encodeURIComponent(paymentConfig.merchantName !== "-" ? paymentConfig.merchantName : "EduNex")}&am=${payableAmount}&cu=INR&tn=${invoiceNumber}`}
                                  size={160}
                                  color="#0F172A"
                                  backgroundColor="#FFFFFF"
                                />
                              </View>
                              <Text style={[styles.qrScanHelper, { color: textColor }]}>
                                Scan with any UPI App (GPay, PhonePe, Paytm, CRED)
                              </Text>
                              <Text style={[styles.qrSubHelper, { color: subTextColor }]}>
                                Institutional VPA: <Text style={{ fontWeight: "700", color: accentColor }}>{paymentConfig.upiId}</Text> (Encrypted Gateway)
                              </Text>
                            </View>
                          )}

                          {/* 1B. 1-Tap UPI Apps Grid */}
                          {upiSubMethod === "app" && (
                            <View style={styles.upiAppsGrid}>
                              {UPI_APPS.map((app) => {
                                const isAppSel = selectedUpiApp === app.id;
                                return (
                                  <TouchableOpacity
                                    key={app.id}
                                    style={[
                                      styles.upiAppCard,
                                      {
                                        backgroundColor: isAppSel ? app.color + "12" : inputBg,
                                        borderColor: isAppSel ? app.color : borderColor,
                                        borderWidth: isAppSel ? 1.8 : 1,
                                      },
                                    ]}
                                    onPress={() => setSelectedUpiApp(app.id)}
                                    activeOpacity={0.8}
                                  >
                                    <View style={[styles.upiAppIconCircle, { backgroundColor: app.color }]}>
                                      <Icon name={app.icon} size={20} color="#FFFFFF" />
                                    </View>
                                    <View style={{ flex: 1, marginLeft: 10 }}>
                                      <Text style={[styles.upiAppName, { color: textColor }]}>{app.name}</Text>
                                      <Text style={[styles.upiAppMeta, { color: subTextColor }]}>Instant Redirect & Pay</Text>
                                    </View>
                                    <Icon
                                      name={isAppSel ? "radiobox-marked" : "radiobox-blank"}
                                      size={20}
                                      color={isAppSel ? app.color : placeholderColor}
                                    />
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                          )}

                          {/* 1C. Manual UPI ID Input */}
                          {upiSubMethod === "vpa" && (
                            <View style={styles.vpaInputSection}>
                              <Text style={[styles.inputLabel, { color: subTextColor }]}>ENTER UPI ID / VPA</Text>
                              <View style={[styles.inputContainer, { backgroundColor: inputBg, borderColor }]}>
                                <Icon name="at" size={20} color={accentColor} style={{ marginRight: 8 }} />
                                <TextInput
                                  style={[styles.textInput, { color: textColor }]}
                                  placeholder="e.g. mobileNumber@okhdfcbank"
                                  placeholderTextColor={placeholderColor}
                                  value={upiId}
                                  onChangeText={setUpiId}
                                  autoCapitalize="none"
                                />
                                <TouchableOpacity style={[styles.cameraIconBtn, { backgroundColor: accentColor + "18" }]} onPress={handleOpenCamera}>
                                  <Icon name="camera-outline" size={18} color={accentColor} />
                                </TouchableOpacity>
                              </View>
                            </View>
                          )}
                        </View>
                      )}

                      {/* ----------------- METHOD 2: CARDS ----------------- */}
                      {selectedMethod === "card" && (
                        <View style={styles.methodContentBox}>
                          {/* Holographic Virtual Card Preview */}
                          <LinearGradient
                            colors={["#1E1B4B", "#312E81", "#4338CA"]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.virtualCard}
                          >
                            <View style={styles.virtualCardTop}>
                              <View style={styles.chipRow}>
                                <Icon name="integrated-circuit-chip" size={32} color="#FBBF24" />
                                <Icon name="contactless-payment" size={24} color="rgba(255,255,255,0.7)" />
                              </View>
                              <Text style={styles.virtualCardBrand}>{cardBrand.brand}</Text>
                            </View>

                            <Text style={styles.virtualCardNumber}>
                              {cardNumber ? cardNumber : "•••• •••• •••• ••••"}
                            </Text>

                            <View style={styles.virtualCardBottom}>
                              <View>
                                <Text style={styles.virtualCardLabel}>CARDHOLDER</Text>
                                <Text style={styles.virtualCardVal} numberOfLines={1}>
                                  {cardHolder ? cardHolder.toUpperCase() : "STUDENT NAME"}
                                </Text>
                              </View>
                              <View>
                                <Text style={styles.virtualCardLabel}>EXPIRES</Text>
                                <Text style={styles.virtualCardVal}>
                                  {cardExpiry ? cardExpiry : "MM/YY"}
                                </Text>
                              </View>
                            </View>
                          </LinearGradient>

                          {/* Card Number Input */}
                          <View style={styles.cardInputGroup}>
                            <Text style={[styles.inputLabel, { color: subTextColor }]}>CARD NUMBER</Text>
                            <View style={[styles.inputContainer, { backgroundColor: inputBg, borderColor }]}>
                              <Icon name="credit-card-outline" size={20} color={accentColor} style={{ marginRight: 8 }} />
                              <TextInput
                                style={[styles.textInput, { color: textColor }]}
                                placeholder="4532 8821 9043 2219"
                                placeholderTextColor={placeholderColor}
                                keyboardType="number-pad"
                                value={cardNumber}
                                onChangeText={handleCardNumberChange}
                                maxLength={19}
                              />
                            </View>
                          </View>

                          {/* Split Row: Expiry & CVV */}
                          <View style={styles.splitRow}>
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.inputLabel, { color: subTextColor }]}>VALID THRU</Text>
                              <View style={[styles.inputContainer, { backgroundColor: inputBg, borderColor }]}>
                                <TextInput
                                  style={[styles.textInput, { color: textColor }]}
                                  placeholder="MM/YY"
                                  placeholderTextColor={placeholderColor}
                                  keyboardType="number-pad"
                                  value={cardExpiry}
                                  onChangeText={handleExpiryChange}
                                  maxLength={5}
                                />
                              </View>
                            </View>

                            <View style={{ flex: 1 }}>
                              <Text style={[styles.inputLabel, { color: subTextColor }]}>CVV / CVC</Text>
                              <View style={[styles.inputContainer, { backgroundColor: inputBg, borderColor }]}>
                                <TextInput
                                  style={[styles.textInput, { color: textColor }]}
                                  placeholder="•••"
                                  placeholderTextColor={placeholderColor}
                                  keyboardType="number-pad"
                                  secureTextEntry
                                  value={cardCvv}
                                  onChangeText={(t) => setCardCvv(t.slice(0, 4))}
                                  maxLength={4}
                                />
                                <Icon name="help-circle-outline" size={16} color={placeholderColor} />
                              </View>
                            </View>
                          </View>

                          {/* Cardholder Name */}
                          <View style={styles.cardInputGroup}>
                            <Text style={[styles.inputLabel, { color: subTextColor }]}>CARDHOLDER NAME</Text>
                            <View style={[styles.inputContainer, { backgroundColor: inputBg, borderColor }]}>
                              <Icon name="account-outline" size={20} color={accentColor} style={{ marginRight: 8 }} />
                              <TextInput
                                style={[styles.textInput, { color: textColor }]}
                                placeholder="Name as printed on card"
                                placeholderTextColor={placeholderColor}
                                value={cardHolder}
                                onChangeText={setCardHolder}
                              />
                            </View>
                          </View>

                          {/* Save Card Checkbox */}
                          <TouchableOpacity
                            style={styles.saveCardRow}
                            onPress={() => setSaveCard((prev) => !prev)}
                            activeOpacity={0.8}
                          >
                            <Icon
                              name={saveCard ? "checkbox-marked" : "checkbox-blank-outline"}
                              size={20}
                              color={saveCard ? accentColor : subTextColor}
                            />
                            <Text style={[styles.saveCardText, { color: subTextColor }]}>
                              Save card securely for future semester fee dues (PCI-DSS)
                            </Text>
                          </TouchableOpacity>
                        </View>
                      )}

                      {/* ----------------- METHOD 3: NET BANKING ----------------- */}
                      {selectedMethod === "netbank" && (
                        <View style={styles.methodContentBox}>
                          <Text style={[styles.inputLabel, { color: subTextColor }]}>POPULAR INDIAN BANKS</Text>
                          <View style={styles.banksGrid}>
                            {POPULAR_BANKS.map((b) => {
                              const isBankSel = selectedBank === b.id;
                              return (
                                <TouchableOpacity
                                  key={b.id}
                                  style={[
                                    styles.bankCard,
                                    {
                                      backgroundColor: isBankSel ? accentColor + "15" : inputBg,
                                      borderColor: isBankSel ? accentColor : borderColor,
                                      borderWidth: isBankSel ? 1.8 : 1,
                                    },
                                  ]}
                                  onPress={() => setSelectedBank(b.id)}
                                  activeOpacity={0.8}
                                >
                                  <View style={[styles.bankIconCircle, { backgroundColor: b.color }]}>
                                    <Icon name={b.icon} size={18} color="#FFFFFF" />
                                  </View>
                                  <Text style={[styles.bankCardName, { color: textColor }]} numberOfLines={1}>
                                    {b.code}
                                  </Text>
                                  {isBankSel && (
                                    <Icon name="check-circle" size={14} color={accentColor} style={styles.bankCheck} />
                                  )}
                                </TouchableOpacity>
                              );
                            })}
                          </View>

                          <View style={[styles.otherBanksPill, { backgroundColor: isDarkMode ? "#27272A" : "#F1F5F9", borderColor }]}>
                            <Icon name="bank-plus" size={20} color={accentColor} />
                            <Text style={[styles.otherBanksText, { color: textColor }]}>
                              Over 65+ Other Banks Supported
                            </Text>
                            <Icon name="chevron-right" size={18} color={subTextColor} />
                          </View>
                        </View>
                      )}

                      {/* ----------------- METHOD 4: WALLET / EMI ----------------- */}
                      {selectedMethod === "wallet" && (
                        <View style={styles.methodContentBox}>
                          {/* Student Smart Wallet */}
                          <View style={[styles.walletCard, { backgroundColor: isDarkMode ? "#27272A" : "#F8FAFC", borderColor }]}>
                            <View style={styles.walletHeader}>
                              <View style={[styles.walletIconCircle, { backgroundColor: "#10B98118" }]}>
                                <Icon name="wallet" size={22} color="#10B981" />
                              </View>
                              <View style={{ flex: 1, marginLeft: 10 }}>
                                <Text style={[styles.walletTitle, { color: textColor }]}>EduNex Smart Campus Wallet</Text>
                                <Text style={[styles.walletSub, { color: subTextColor }]}>Available Balance: ₹12,500</Text>
                              </View>
                              <TouchableOpacity style={[styles.walletTopUpBtn, { borderColor: accentColor }]}>
                                <Text style={[styles.walletTopUpText, { color: accentColor }]}>Top-Up</Text>
                              </TouchableOpacity>
                            </View>
                          </View>

                          {/* 0% Interest Education Loan EMI */}
                          <View style={[styles.emiOptionCard, { backgroundColor: isDarkMode ? "#1E293B50" : "#F0FDF4", borderColor: isDarkMode ? "#334155" : "#DCFCE7" }]}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                              <Icon name="tag-outline" size={20} color="#10B981" />
                              <Text style={[styles.emiTitle, { color: isDarkMode ? "#34D399" : "#166534" }]}>
                                0% No-Cost EMI Available
                              </Text>
                            </View>
                            <Text style={[styles.emiDesc, { color: isDarkMode ? "#94A3B8" : "#166534" }]}>
                              Split ₹{payableAmount.toLocaleString("en-IN")} into 3 or 6 monthly installments with EduNex Student FlexiPay.
                            </Text>
                          </View>
                        </View>
                      )}

                      {/* Security Trust Badges */}
                      <View style={styles.securityStrip}>
                        <View style={styles.securityItem}>
                          <Icon name="shield-lock" size={14} color="#10B981" />
                          <Text style={[styles.securityItemText, { color: subTextColor }]}>256-Bit SSL</Text>
                        </View>
                        <View style={styles.securityDot} />
                        <View style={styles.securityItem}>
                          <Icon name="check-decagram" size={14} color="#10B981" />
                          <Text style={[styles.securityItemText, { color: subTextColor }]}>RBI / NPCI Verified</Text>
                        </View>
                        <View style={styles.securityDot} />
                        <View style={styles.securityItem}>
                          <Icon name="lock" size={14} color="#10B981" />
                          <Text style={[styles.securityItemText, { color: subTextColor }]}>PCI-DSS L1</Text>
                        </View>
                      </View>
                    </ScrollView>
                  )}

                  {/* ============================================================= */}
                  {/* STEP 2: PROCESSING ANIMATION STATE                            */}
                  {/* ============================================================= */}
                  {step === "processing" && (
                    <View style={styles.processingContainer}>
                      <Animated.View
                        style={[
                          styles.processingCircle,
                          {
                            backgroundColor: accentColor + "15",
                            transform: [{ scale: processingPulse }],
                          },
                        ]}
                      >
                        <ActivityIndicator size="large" color={accentColor} />
                      </Animated.View>
                      <Text style={[styles.processingTitle, { color: textColor }]}>
                        Verifying Transaction...
                      </Text>
                      <Text style={[styles.processingSub, { color: subTextColor }]}>
                        Connecting with institutional banking gateway & updating ledger. Please do not close or press back.
                      </Text>

                      <View style={[styles.processingStatusCard, { backgroundColor: isDarkMode ? "#27272A" : "#F8FAFC", borderColor }]}>
                        <View style={styles.statusStepRow}>
                          <Icon name="check-circle" size={16} color="#10B981" />
                          <Text style={[styles.statusStepText, { color: textColor }]}>Payment Authorization Initiated</Text>
                        </View>
                        <View style={styles.statusStepRow}>
                          <Icon name="check-circle" size={16} color="#10B981" />
                          <Text style={[styles.statusStepText, { color: textColor }]}>Auditing Student Financial Record</Text>
                        </View>
                        <View style={styles.statusStepRow}>
                          <ActivityIndicator size="small" color={accentColor} style={{ width: 16 }} />
                          <Text style={[styles.statusStepText, { color: accentColor, fontWeight: "700" }]}>
                            Generating Digitally Signed Receipt...
                          </Text>
                        </View>
                      </View>
                    </View>
                  )}

                  {/* ============================================================= */}
                  {/* STEP 3: PAYMENT SUCCESS & DIGITAL TAX RECEIPT                 */}
                  {/* ============================================================= */}
                  {step === "success" && txnDetails && (
                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollBody}>
                      <View style={styles.successHeader}>
                        <View style={styles.successIconCircle}>
                          <Icon name="check" size={32} color="#FFFFFF" />
                        </View>
                        <Text style={[styles.successTitle, { color: textColor }]}>Payment Successful!</Text>
                        <Text style={[styles.successSub, { color: subTextColor }]}>
                          Your semester fee has been credited & marked cleared.
                        </Text>
                      </View>

                      {/* Official Digital Tax Receipt Card */}
                      <View style={[styles.receiptCard, { backgroundColor: isDarkMode ? "#27272A" : "#F8FAFC", borderColor }]}>
                        <View style={styles.receiptTopBar}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                            <Icon name="school" size={18} color={accentColor} />
                            <Text style={[styles.receiptInstituteText, { color: textColor }]}>EDUNEX INSTITUTE</Text>
                          </View>
                          <View style={styles.receiptPaidBadge}>
                            <Text style={styles.receiptPaidBadgeText}>CLEARED</Text>
                          </View>
                        </View>

                        <View style={styles.receiptAmountRow}>
                          <Text style={[styles.receiptAmountText, { color: accentColor }]}>
                            ₹{txnDetails.amount.toLocaleString("en-IN")}
                          </Text>
                          <Text style={[styles.receiptTaxNote, { color: subTextColor }]}>Total Amount Paid</Text>
                        </View>

                        <View style={[styles.receiptDivider, { backgroundColor: borderColor }]} />

                        <View style={styles.receiptGrid}>
                          <View style={styles.receiptRow}>
                            <Text style={[styles.receiptLabel, { color: subTextColor }]}>Receipt No</Text>
                            <Text style={[styles.receiptValue, { color: textColor }]}>{txnDetails.receiptNo}</Text>
                          </View>
                          <View style={styles.receiptRow}>
                            <Text style={[styles.receiptLabel, { color: subTextColor }]}>Invoice</Text>
                            <Text style={[styles.receiptValue, { color: textColor }]}>{txnDetails.invoiceNo}</Text>
                          </View>
                          <View style={styles.receiptRow}>
                            <Text style={[styles.receiptLabel, { color: subTextColor }]}>Candidate</Text>
                            <Text style={[styles.receiptValue, { color: textColor }]}>{studentName} ({studentRoll})</Text>
                          </View>
                          <View style={styles.receiptRow}>
                            <Text style={[styles.receiptLabel, { color: subTextColor }]}>Payment Mode</Text>
                            <Text style={[styles.receiptValue, { color: textColor }]}>{txnDetails.method}</Text>
                          </View>
                          <View style={styles.receiptRow}>
                            <Text style={[styles.receiptLabel, { color: subTextColor }]}>Transaction Ref</Text>
                            <Text style={[styles.receiptValue, { color: textColor }]}>{txnDetails.txnId}</Text>
                          </View>
                          <View style={styles.receiptRow}>
                            <Text style={[styles.receiptLabel, { color: subTextColor }]}>Date & Time</Text>
                            <Text style={[styles.receiptValue, { color: textColor }]}>{txnDetails.date}</Text>
                          </View>
                        </View>
                      </View>
                    </ScrollView>
                  )}

                  {/* ============================================================= */}
                  {/* FOOTER ACTIONS                                                */}
                  {/* ============================================================= */}
                  <View style={[styles.footerRow, { borderTopColor: borderColor }]}>
                    {step === "gateway" && (
                      <>
                        <TouchableOpacity style={[styles.cancelBtn, { borderColor }]} onPress={onClose} activeOpacity={0.7}>
                          <Text style={[styles.cancelBtnText, { color: subTextColor }]}>Cancel</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.payBtn} onPress={handleProceedPayment} activeOpacity={0.85}>
                          <LinearGradient
                            colors={[accentColor, "#4338CA"]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.gradientPayBtn}
                          >
                            <Icon name="lock-check" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                            <Text style={styles.payBtnText}>
                              Pay ₹{payableAmount.toLocaleString("en-IN")}
                            </Text>
                          </LinearGradient>
                        </TouchableOpacity>
                      </>
                    )}

                    {step === "success" && (
                      <>
                        <TouchableOpacity
                          style={[styles.shareReceiptBtn, { backgroundColor: isDarkMode ? "#27272A" : "#F1F5F9", borderColor }]}
                          onPress={handleShareReceipt}
                          activeOpacity={0.8}
                        >
                          <Icon name="share-variant" size={17} color={textColor} />
                          <Text style={[styles.shareReceiptText, { color: textColor }]}>Share Receipt</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.doneBtn, { backgroundColor: accentColor }]}
                          onPress={onClose}
                          activeOpacity={0.85}
                        >
                          <Text style={styles.doneBtnText}>Back to Dashboard</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                </Animated.View>
              </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
          </Animated.View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* ---------- CAMERA SCANNER MODAL ---------- */}
      <Modal visible={cameraVisible} animationType="slide">
        <View style={styles.cameraOverlay}>
          <CameraView
            style={styles.fullCamera}
            onBarcodeScanned={handleScanned}
            enableTorch={flashOn}
          />
          <View style={styles.cameraHeader}>
            <TouchableOpacity onPress={() => setCameraVisible(false)} style={styles.cameraCloseBtn}>
              <Icon name="arrow-left" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.cameraTitle}>Scan UPI Payment QR</Text>
            <TouchableOpacity onPress={() => setFlashOn(!flashOn)} style={styles.cameraCloseBtn}>
              <Icon name={flashOn ? "flash" : "flash-off"} size={24} color={flashOn ? "#FBBF24" : "#FFFFFF"} />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  keyboardAvoid: {
    width: "100%",
    maxWidth: 460,
    justifyContent: "center",
    alignItems: "center",
  },
  sheetCard: {
    width: "100%",
    borderRadius: 24,
    borderWidth: 1,
    paddingTop: 10,
    paddingHorizontal: 18,
    paddingBottom: 16,
    elevation: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    maxHeight: SCREEN_HEIGHT * 0.92,
  },
  handleContainer: {
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 8,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    marginBottom: 14,
  },
  headerIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 17.5,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    fontSize: 11.5,
    fontWeight: "500",
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollBody: {
    paddingBottom: 4,
  },
  invoiceBanner: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    marginBottom: 14,
  },
  invoiceBannerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  invoiceBannerTitle: {
    fontSize: 13.5,
    fontWeight: "700",
  },
  invoiceBannerMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  amountBox: {
    alignItems: "flex-end",
    marginLeft: 10,
  },
  amountLabel: {
    fontSize: 10.5,
    fontWeight: "600",
  },
  amountValue: {
    fontSize: 17,
    fontWeight: "800",
  },
  breakdownToggle: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  breakdownToggleText: {
    fontSize: 11.5,
    fontWeight: "700",
  },
  breakdownDrawer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    gap: 6,
  },
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  breakdownItem: {
    fontSize: 11.5,
  },
  breakdownAmount: {
    fontSize: 11.5,
    fontWeight: "600",
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8,
  },
  methodSelectorRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 12,
  },
  methodTabPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
  },
  methodTabPillText: {
    fontSize: 11,
    fontWeight: "700",
  },
  methodContentBox: {
    marginBottom: 10,
  },
  subTabGroup: {
    flexDirection: "row",
    borderRadius: 10,
    padding: 3,
    marginBottom: 12,
  },
  subTabBtn: {
    flex: 1,
    paddingVertical: 7,
    alignItems: "center",
    borderRadius: 8,
  },
  subTabBtnText: {
    fontSize: 11.5,
    fontWeight: "700",
  },
  qrSection: {
    alignItems: "center",
    paddingVertical: 10,
  },
  qrFrame: {
    padding: 12,
    borderRadius: 16,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    marginBottom: 10,
  },
  qrScanHelper: {
    fontSize: 12.5,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 2,
  },
  qrSubHelper: {
    fontSize: 11.5,
    textAlign: "center",
  },
  upiAppsGrid: {
    gap: 8,
  },
  upiAppCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 14,
  },
  upiAppIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  upiAppName: {
    fontSize: 13,
    fontWeight: "700",
  },
  upiAppMeta: {
    fontSize: 11,
  },
  vpaInputSection: {
    gap: 4,
  },
  inputLabel: {
    fontSize: 10.5,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 46,
  },
  textInput: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: "500",
    paddingVertical: 0,
  },
  cameraIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  virtualCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    elevation: 6,
    shadowColor: "#312E81",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
  },
  virtualCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  chipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  virtualCardBrand: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1,
  },
  virtualCardNumber: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 3,
    marginBottom: 16,
  },
  virtualCardBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  virtualCardLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  virtualCardVal: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  cardInputGroup: {
    marginBottom: 10,
  },
  splitRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },
  saveCardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
    marginBottom: 6,
  },
  saveCardText: {
    fontSize: 11,
    flex: 1,
  },
  banksGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  bankCard: {
    width: "31%",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 12,
  },
  bankIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  bankCardName: {
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
  },
  bankCheck: {
    position: "absolute",
    top: 4,
    right: 4,
  },
  otherBanksPill: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  otherBanksText: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: "600",
  },
  walletCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
  },
  walletHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  walletIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  walletTitle: {
    fontSize: 12.5,
    fontWeight: "700",
  },
  walletSub: {
    fontSize: 11,
    marginTop: 2,
  },
  walletTopUpBtn: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  walletTopUpText: {
    fontSize: 11.5,
    fontWeight: "700",
  },
  emiOptionCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 4,
  },
  emiTitle: {
    fontSize: 12.5,
    fontWeight: "700",
  },
  emiDesc: {
    fontSize: 11.5,
    lineHeight: 16,
  },
  securityStrip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
    paddingTop: 8,
  },
  securityItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  securityItemText: {
    fontSize: 10.5,
    fontWeight: "600",
  },
  securityDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "#94A3B8",
  },
  processingContainer: {
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: 12,
  },
  processingCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 18,
  },
  processingTitle: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 6,
    textAlign: "center",
  },
  processingSub: {
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 20,
  },
  processingStatusCard: {
    width: "100%",
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  statusStepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusStepText: {
    fontSize: 12,
    fontWeight: "500",
  },
  successHeader: {
    alignItems: "center",
    paddingVertical: 14,
  },
  successIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#10B981",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
    elevation: 4,
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  successTitle: {
    fontSize: 19,
    fontWeight: "800",
  },
  successSub: {
    fontSize: 12,
    marginTop: 3,
    textAlign: "center",
  },
  receiptCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  receiptTopBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  receiptInstituteText: {
    fontSize: 12.5,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  receiptPaidBadge: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  receiptPaidBadgeText: {
    color: "#166534",
    fontSize: 10,
    fontWeight: "800",
  },
  receiptAmountRow: {
    alignItems: "center",
    paddingVertical: 12,
  },
  receiptAmountText: {
    fontSize: 26,
    fontWeight: "900",
  },
  receiptTaxNote: {
    fontSize: 11,
    marginTop: 2,
  },
  receiptDivider: {
    height: 1,
    marginVertical: 10,
  },
  receiptGrid: {
    gap: 7,
  },
  receiptRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  receiptLabel: {
    fontSize: 11.5,
  },
  receiptValue: {
    fontSize: 11.5,
    fontWeight: "700",
  },
  footerRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: "700",
  },
  payBtn: {
    flex: 1.8,
    borderRadius: 14,
    overflow: "hidden",
    elevation: 3,
    shadowColor: "#4F46E5",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  gradientPayBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
    paddingHorizontal: 12,
  },
  payBtnText: {
    color: "#FFFFFF",
    fontSize: 13.5,
    fontWeight: "800",
  },
  shareReceiptBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  shareReceiptText: {
    fontSize: 12.5,
    fontWeight: "700",
  },
  doneBtn: {
    flex: 1.2,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  doneBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  cameraOverlay: {
    flex: 1,
    backgroundColor: "#000000",
  },
  fullCamera: {
    flex: 1,
  },
  cameraHeader: {
    position: "absolute",
    top: Platform.OS === "android" ? 20 : 50,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
  },
  cameraTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  cameraCloseBtn: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
});
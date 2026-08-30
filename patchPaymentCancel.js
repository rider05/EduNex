const fs = require('fs');
const filePath = 'd:\\edunex\\app\\screens\\students\\modals\\PaymentModal.js';
let code = fs.readFileSync(filePath, 'utf8');

// 1. Add timer ref for processing
const timerSearch = `  // Step: 'gateway' | 'processing' | 'success'
  const [step, setStep] = useState("gateway");`;

const timerReplace = `  // Step: 'gateway' | 'processing' | 'cancelled' | 'success'
  const [step, setStep] = useState("gateway");
  const processingTimerRef = useRef(null);`;

code = code.replace(timerSearch, timerReplace);

// 2. Update handleProceedPayment to store timer
const timeoutSearch = `    setTimeout(() => {
      setStep("success");
      showToast("✅ Encrypted Payment Cleared & Recorded!", "success");
      if (onSuccess) onSuccess(paymentResult);
    }, 2200);`;

const timeoutReplace = `    processingTimerRef.current = setTimeout(() => {
      setStep("success");
      showToast("✅ Encrypted Payment Cleared & Recorded!", "success");
      if (onSuccess) onSuccess(paymentResult);
    }, 2200);`;

code = code.replace(timeoutSearch, timeoutReplace);

// 3. Update processing state to show Payable amount and Cancel button
const procSearch = `                      <View style={[styles.processingStatusCard, { backgroundColor: isDarkMode ? "#27272A" : "#F8FAFC", borderColor }]}>
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
                    </View>`;

const procReplace = `                      <View style={[styles.processingStatusCard, { backgroundColor: isDarkMode ? "#27272A" : "#F8FAFC", borderColor }]}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: borderColor }}>
                          <Text style={{ fontSize: 12, fontWeight: "700", color: subTextColor }}>TRANSACTION AMOUNT</Text>
                          <Text style={{ fontSize: 16, fontWeight: "900", color: accentColor }}>₹{payableAmount.toLocaleString("en-IN")}</Text>
                        </View>
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

                      <TouchableOpacity
                        style={{ marginTop: 16, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10, borderWidth: 1, borderColor: "#EF4444", backgroundColor: isDarkMode ? "#EF444415" : "#FEF2F2", flexDirection: "row", alignItems: "center", gap: 8 }}
                        onPress={() => {
                          if (processingTimerRef.current) clearTimeout(processingTimerRef.current);
                          setStep("cancelled");
                          showToast("⚠️ Payment was cancelled. No amount was deducted.", "info");
                        }}
                        activeOpacity={0.8}
                      >
                        <Icon name="close-circle-outline" size={18} color="#EF4444" />
                        <Text style={{ color: "#EF4444", fontWeight: "800", fontSize: 13 }}>Cancel Transaction (₹{payableAmount.toLocaleString("en-IN")})</Text>
                      </TouchableOpacity>
                    </View>`;

code = code.replace(procSearch, procReplace);

// 4. Add STEP: CANCELLED View
const successSearch = `                  {/* ============================================================= */}
                  {/* STEP 3: PAYMENT SUCCESS & DIGITAL TAX RECEIPT                 */}
                  {/* ============================================================= */}`;

const cancelledAndSuccess = `                  {/* ============================================================= */}
                  {/* STEP: PAYMENT CANCELLED / ABORTED VIEW                        */}
                  {/* ============================================================= */}
                  {step === "cancelled" && (
                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollBody}>
                      <View style={{ alignItems: "center", paddingVertical: 14 }}>
                        <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: "#EF444418", borderWidth: 2, borderColor: "#EF4444", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
                          <Icon name="close" size={32} color="#EF4444" />
                        </View>
                        <Text style={{ fontSize: 19, fontWeight: "800", color: textColor, marginBottom: 4 }}>
                          Payment Cancelled
                        </Text>
                        <Text style={{ fontSize: 12.5, color: subTextColor, textAlign: "center", paddingHorizontal: 16 }}>
                          Transaction was aborted. No funds have been deducted from your account.
                        </Text>
                      </View>

                      {/* Prominent Paying Amount Highlight Box */}
                      <View style={{ backgroundColor: isDarkMode ? "#27272A" : "#FEF2F2", borderWidth: 1, borderColor: isDarkMode ? "#3F3F46" : "#FECACA", borderRadius: 14, padding: 14, marginHorizontal: 4, marginBottom: 12 }}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                          <Text style={{ fontSize: 11, fontWeight: "800", color: subTextColor, letterSpacing: 0.8 }}>
                            PAYABLE AMOUNT
                          </Text>
                          <View style={{ backgroundColor: "#EF444420", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                            <Text style={{ fontSize: 11, fontWeight: "800", color: "#EF4444" }}>NOT DEDUCTED</Text>
                          </View>
                        </View>

                        <Text style={{ fontSize: 28, fontWeight: "900", color: "#EF4444", marginVertical: 6 }}>
                          ₹{payableAmount.toLocaleString("en-IN")}
                        </Text>

                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
                          <Icon name="shield-check" size={15} color="#10B981" />
                          <Text style={{ fontSize: 12, color: "#10B981", fontWeight: "700" }}>₹0.00 Debited • 100% Safe</Text>
                        </View>
                      </View>

                      {/* Invoice Details Card */}
                      <View style={{ backgroundColor: isDarkMode ? "#18181B" : "#F8FAFC", borderWidth: 1, borderColor, borderRadius: 14, padding: 14, marginHorizontal: 4, gap: 10 }}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                          <Text style={{ fontSize: 12.5, color: subTextColor }}>Fee Item</Text>
                          <Text style={{ fontSize: 13, fontWeight: "600", color: textColor }}>{invoiceTitle}</Text>
                        </View>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                          <Text style={{ fontSize: 12.5, color: subTextColor }}>Invoice No</Text>
                          <Text style={{ fontSize: 13, fontWeight: "600", color: textColor }}>{invoiceNumber}</Text>
                        </View>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                          <Text style={{ fontSize: 12.5, color: subTextColor }}>Student</Text>
                          <Text style={{ fontSize: 13, fontWeight: "600", color: textColor }}>{studentName} ({studentRoll})</Text>
                        </View>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                          <Text style={{ fontSize: 12.5, color: subTextColor }}>Payment Status</Text>
                          <Text style={{ fontSize: 12, fontWeight: "800", color: "#EF4444" }}>PENDING / UNPAID</Text>
                        </View>
                      </View>
                    </ScrollView>
                  )}

                  {/* ============================================================= */}
                  {/* STEP 3: PAYMENT SUCCESS & DIGITAL TAX RECEIPT                 */}
                  {/* ============================================================= */}`;

code = code.replace(successSearch, cancelledAndSuccess);

// 5. Update Footer actions to support 'cancelled'
const footerSearch = `                    {step === "gateway" && (
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
                    )}`;

const footerReplace = `                    {step === "gateway" && (
                      <>
                        <TouchableOpacity style={[styles.cancelBtn, { borderColor }]} onPress={() => {
                          setStep("cancelled");
                          showToast("⚠️ Payment session cancelled.", "info");
                        }} activeOpacity={0.7}>
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

                    {step === "cancelled" && (
                      <>
                        <TouchableOpacity
                          style={[styles.cancelBtn, { borderColor }]}
                          onPress={onClose}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.cancelBtnText, { color: subTextColor }]}>Exit Dues</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.payBtn}
                          onPress={() => setStep("gateway")}
                          activeOpacity={0.85}
                        >
                          <LinearGradient
                            colors={[accentColor, "#4338CA"]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.gradientPayBtn}
                          >
                            <Icon name="refresh" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                            <Text style={styles.payBtnText}>
                              Retry Pay ₹{payableAmount.toLocaleString("en-IN")}
                            </Text>
                          </LinearGradient>
                        </TouchableOpacity>
                      </>
                    )}`;

code = code.replace(footerSearch, footerReplace);

fs.writeFileSync(filePath, code, 'utf8');
console.log('Successfully updated PaymentModal.js with Cancelled state & Paying amount display!');

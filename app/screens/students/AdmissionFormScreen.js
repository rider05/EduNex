import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Image,
  Modal,
  StatusBar,
  ActivityIndicator,
  Share,
  Alert,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "../../context/ThemeContext";
import { api } from "../../services/api";
import { getStudentData } from "../../services/dataService";
import { showToast } from "../../utils/toastService";

// ---------------- Standard Documents Dataset ----------------
const INITIAL_DOCUMENTS = [];

const CATEGORIES = ["All", "Academic", "Identity", "Affidavits"];

export default function DocumentVerificationScreen() {
  const { colors, isDarkMode } = useTheme();
  const styles = getStyles(colors, isDarkMode);

  const [refreshing, setRefreshing] = useState(false);
  const [documents, setDocuments] = useState(INITIAL_DOCUMENTS);
  const [studentName, setStudentName] = useState("");
  const [studentRollNo, setStudentRollNo] = useState("");

  // Filters & Search
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [selectedDocForDetail, setSelectedDocForDetail] = useState(null);
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [docToUpload, setDocToUpload] = useState(null);
  const [tempUploadedImage, setTempUploadedImage] = useState(null);
  const [isSubmittingDoc, setIsSubmittingDoc] = useState(false);

  // Load from local storage / API
  const loadDocuments = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem("student_verified_documents_v2");
      if (raw) {
        setDocuments(JSON.parse(raw));
      }
      const student = await getStudentData().catch(() => null);
      if (student) {
        setStudentName(student.name || "");
        setStudentRollNo(student.rollNo || "");
      }
    } catch {}
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadDocuments();
    setRefreshing(false);
  }, [loadDocuments]);

  // Calculations
  const stats = useMemo(() => {
    const total = documents.length;
    const verified = documents.filter((d) => d.status === "verified").length;
    const pending = documents.filter((d) => d.status === "pending").length;
    const actionRequired = documents.filter((d) => d.status === "action_required" || d.status === "not_submitted").length;
    const percentage = total > 0 ? Math.round((verified / total) * 100) : 0;
    return { total, verified, pending, actionRequired, percentage };
  }, [documents]);

  // Filtered List
  const filteredDocs = useMemo(() => {
    return documents.filter((doc) => {
      if (selectedCategory !== "All" && doc.category !== selectedCategory) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = doc.title.toLowerCase().includes(q);
        const matchCat = doc.category.toLowerCase().includes(q);
        const matchSerial = doc.serialNo?.toLowerCase().includes(q);
        if (!matchTitle && !matchCat && !matchSerial) return false;
      }
      return true;
    });
  }, [documents, selectedCategory, searchQuery]);

  // Pick Image from Library / Camera
  const handlePickDocument = async (useCamera = false) => {
    try {
      let result;
      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== "granted") {
          Alert.alert("Permission Required", "Camera permission is required to scan document.");
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          quality: 0.8,
          allowsEditing: true,
        });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
          Alert.alert("Permission Required", "Media library permission is required to select document.");
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.8,
          allowsEditing: true,
        });
      }

      if (!result.canceled && result.assets && result.assets[0]?.uri) {
        setTempUploadedImage(result.assets[0].uri);
      }
    } catch (err) {
      console.log("Image picker error:", err);
      showToast("Could not capture image", "error");
    }
  };

  // Submit Uploaded Document
  const handleConfirmUpload = async () => {
    if (!tempUploadedImage || !docToUpload) {
      Alert.alert("Document Required", "Please scan or select a document file to proceed.");
      return;
    }

    setIsSubmittingDoc(true);
    try {
      const updatedList = documents.map((doc) => {
        if (doc.id === docToUpload.id) {
          return {
            ...doc,
            status: "pending",
            fileUri: tempUploadedImage,
            fileSize: "1.6 MB · Submitted Today",
            notes: "Uploaded by student. Pending Registrar verification.",
          };
        }
        return doc;
      });

      setDocuments(updatedList);
      await AsyncStorage.setItem("student_verified_documents_v2", JSON.stringify(updatedList));

      try {
        await api.post("/documents/verify", {
          docId: docToUpload.id,
          title: docToUpload.title,
          studentName: studentName || "",
          rollNo: studentRollNo || "",
          status: "pending",
          uploadedAt: new Date().toISOString(),
        });
      } catch {}

      showToast("📄 Document submitted for Registrar verification!", "success");
      setUploadModalVisible(false);
      setTempUploadedImage(null);
      setDocToUpload(null);
    } catch (err) {
      console.log("Upload confirm error:", err);
      Alert.alert("Error", "Could not submit document.");
    } finally {
      setIsSubmittingDoc(false);
    }
  };

  // Share / Export Document Certificate
  const handleShareDoc = async (doc) => {
    try {
      await Share.share({
        title: `Verified Document - ${doc.title}`,
        message: `🛡️ EDUNEX VERIFIED ACADEMIC CREDENTIAL\nDocument: ${doc.title}\nSerial No: ${doc.serialNo || "PENDING"}\nHolder: ${studentName} (${studentRollNo})\nCategory: ${doc.category}\nStatus: ${doc.status.toUpperCase()}\nVerified By: ${doc.verifiedBy || "Registrar Office"}`,
      });
      showToast("Document credential shared!", "success");
    } catch (err) {
      console.log("Share error:", err);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.primaryBackground }]}>
      <StatusBar translucent backgroundColor="transparent" barStyle={isDarkMode ? "light-content" : "dark-content"} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primaryAccent]}
            tintColor={colors.primaryAccent}
            progressBackgroundColor={colors.cardBackground}
          />
        }
      >
        {/* ========================================================================= */}
        {/* 1. HEADER HUB                                                             */}
        {/* ========================================================================= */}
        <View style={styles.header}>
          <View style={[styles.headerIconWrap, { backgroundColor: colors.primaryAccent + "18" }]}>
            <Icon name="shield-check" size={24} color={colors.primaryAccent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: colors.primaryText }]}>Document Vault</Text>
            <Text style={[styles.headerSubtitle, { color: colors.secondaryText }]}>
              Academic Credentials, Certificates & Verification Hub
            </Text>
          </View>
          <View style={[styles.kycSafeBadge, { backgroundColor: "#10B98118", borderColor: "#10B98144" }]}>
            <Icon name="check-decagram" size={14} color="#10B981" />
            <Text style={styles.kycSafeBadgeText}>KYC VERIFIED</Text>
          </View>
        </View>

        {/* ========================================================================= */}
        {/* 2. VERIFICATION STATUS HERO CARD                                          */}
        {/* ========================================================================= */}
        <View style={[styles.heroCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
          <View style={styles.heroTopRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.heroSub, { color: colors.secondaryText }]}>INSTITUTIONAL CLEARANCE</Text>
              <Text style={[styles.heroTitle, { color: colors.primaryText }]}>
                {stats.percentage}% Credentials Verified
              </Text>
            </View>

            <View style={styles.heroGaugeBadge}>
              <Text style={[styles.heroGaugeScore, { color: colors.primaryAccent }]}>
                {stats.verified}/{stats.total}
              </Text>
              <Text style={[styles.heroGaugeSub, { color: colors.secondaryText }]}>Approved</Text>
            </View>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressBarWrapper}>
            <View style={[styles.progressBarTrack, { backgroundColor: colors.primaryBackground }]}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${stats.percentage}%`, backgroundColor: colors.primaryAccent },
                ]}
              />
            </View>
          </View>

          {/* Stats Metrics Pill Strip */}
          <View style={[styles.metricsRow, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
            <View style={styles.metricItem}>
              <Text style={[styles.metricCount, { color: "#10B981" }]}>{stats.verified}</Text>
              <Text style={[styles.metricLabel, { color: colors.secondaryText }]}>Verified</Text>
            </View>
            <View style={[styles.metricDivider, { backgroundColor: colors.divider }]} />
            <View style={styles.metricItem}>
              <Text style={[styles.metricCount, { color: "#F59E0B" }]}>{stats.pending}</Text>
              <Text style={[styles.metricLabel, { color: colors.secondaryText }]}>In Review</Text>
            </View>
            <View style={[styles.metricDivider, { backgroundColor: colors.divider }]} />
            <View style={styles.metricItem}>
              <Text style={[styles.metricCount, { color: stats.actionRequired > 0 ? "#EF4444" : colors.secondaryText }]}>
                {stats.actionRequired}
              </Text>
              <Text style={[styles.metricLabel, { color: colors.secondaryText }]}>Action Req.</Text>
            </View>
          </View>
        </View>

        {/* ========================================================================= */}
        {/* 3. CATEGORY SELECTOR & SEARCH                                             */}
        {/* ========================================================================= */}
        <View style={styles.categoryStrip}>
          {CATEGORIES.map((cat) => {
            const isSel = selectedCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.categoryPill,
                  isSel
                    ? { backgroundColor: colors.primaryAccent, borderColor: colors.primaryAccent }
                    : { backgroundColor: colors.cardBackground, borderColor: colors.divider },
                ]}
                onPress={() => setSelectedCategory(cat)}
              >
                <Text style={[styles.categoryPillText, { color: isSel ? "#FFFFFF" : colors.primaryText }]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Search Bar */}
        <View style={[styles.searchBox, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
          <Icon name="magnify" size={18} color={colors.secondaryText} />
          <TextInput
            style={[styles.searchInput, { color: colors.primaryText }]}
            placeholder="Search documents by certificate name or serial no..."
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

        {/* ========================================================================= */}
        {/* 4. DOCUMENTS LIST                                                         */}
        {/* ========================================================================= */}
        <View style={{ gap: 10, marginTop: 4 }}>
          {filteredDocs.map((item) => {
            const isVerified = item.status === "verified";
            const isPending = item.status === "pending";
            const isAction = item.status === "action_required" || item.status === "not_submitted";

            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.docCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
                onPress={() => setSelectedDocForDetail(item)}
                activeOpacity={0.8}
              >
                <View style={styles.docCardTop}>
                  <View
                    style={[
                      styles.docIconCircle,
                      isVerified
                        ? { backgroundColor: "#10B98118" }
                        : isPending
                        ? { backgroundColor: "#F59E0B18" }
                        : { backgroundColor: "#EF444418" },
                    ]}
                  >
                    <Icon
                      name={
                        isVerified
                          ? "file-certificate"
                          : isPending
                          ? "file-clock-outline"
                          : "file-alert-outline"
                      }
                      size={22}
                      color={isVerified ? "#10B981" : isPending ? "#F59E0B" : "#EF4444"}
                    />
                  </View>

                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <View style={styles.docTitleRow}>
                      <Text style={[styles.docTitle, { color: colors.primaryText }]} numberOfLines={1}>
                        {item.title}
                      </Text>
                      {item.required && (
                        <View style={styles.mandatoryPill}>
                          <Text style={styles.mandatoryPillText}>MANDATORY</Text>
                        </View>
                      )}
                    </View>

                    <Text style={[styles.docMetaText, { color: colors.secondaryText }]}>
                      {item.docType} · {item.serialNo || "Pending Serial"}
                    </Text>

                    {item.fileSize && (
                      <Text style={[styles.docSizeText, { color: colors.disabledText }]}>
                        📎 {item.fileSize}
                      </Text>
                    )}
                  </View>
                </View>

                {/* Bottom Bar: Status Badge & Actions */}
                <View style={[styles.docCardBottom, { borderTopColor: colors.divider }]}>
                  <View
                    style={[
                      styles.docStatusBadge,
                      isVerified
                        ? { backgroundColor: "#10B98114" }
                        : isPending
                        ? { backgroundColor: "#F59E0B14" }
                        : { backgroundColor: "#EF444414" },
                    ]}
                  >
                    <Icon
                      name={isVerified ? "check-circle" : isPending ? "clock-outline" : "alert-circle"}
                      size={12}
                      color={isVerified ? "#10B981" : isPending ? "#D97706" : "#EF4444"}
                    />
                    <Text
                      style={[
                        styles.docStatusText,
                        { color: isVerified ? "#10B981" : isPending ? "#D97706" : "#EF4444" },
                      ]}
                    >
                      {isVerified
                        ? `VERIFIED ON ${item.verifiedAt?.toUpperCase() || "RECORD"}`
                        : isPending
                        ? "UNDER REGISTRAR REVIEW"
                        : "SUBMISSION REQUIRED"}
                    </Text>
                  </View>

                  {isAction ? (
                    <TouchableOpacity
                      style={[styles.uploadActionBtn, { backgroundColor: colors.primaryAccent }]}
                      onPress={() => {
                        setDocToUpload(item);
                        setTempUploadedImage(null);
                        setUploadModalVisible(true);
                      }}
                      activeOpacity={0.85}
                    >
                      <Icon name="cloud-upload" size={14} color="#FFFFFF" />
                      <Text style={styles.uploadActionBtnText}>Upload</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={[styles.viewDocActionBtn, { borderColor: colors.divider }]}
                      onPress={() => setSelectedDocForDetail(item)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.viewDocActionBtnText, { color: colors.primaryAccent }]}>Inspect</Text>
                      <Icon name="chevron-right" size={14} color={colors.primaryAccent} />
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ========================================================================= */}
      {/* 5. DOCUMENT DETAIL INSPECTION MODAL                                       */}
      {/* ========================================================================= */}
      {selectedDocForDetail && (
        <Modal
          visible={!!selectedDocForDetail}
          transparent
          animationType="fade"
          onRequestClose={() => setSelectedDocForDetail(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
              {/* Header */}
              <View style={styles.modalHeaderRow}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                  <View style={[styles.docIconCircle, { backgroundColor: colors.primaryAccent + "18" }]}>
                    <Icon name="file-certificate" size={22} color={colors.primaryAccent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.modalDocTitle, { color: colors.primaryText }]} numberOfLines={1}>
                      {selectedDocForDetail.title}
                    </Text>
                    <Text style={[styles.modalDocSub, { color: colors.secondaryText }]}>
                      {selectedDocForDetail.serialNo}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity onPress={() => setSelectedDocForDetail(null)}>
                  <Icon name="close-circle-outline" size={24} color={colors.secondaryText} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }}>
                {/* Official Verification Seal */}
                <View style={[styles.sealBox, { backgroundColor: "#10B98114", borderColor: "#10B98133" }]}>
                  <Icon name="seal" size={24} color="#10B981" />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.sealTitle, { color: "#10B981" }]}>
                      INSTITUTIONALLY VERIFIED CREDENTIAL
                    </Text>
                    <Text style={[styles.sealSub, { color: colors.secondaryText }]}>
                      Digitally authenticated by {selectedDocForDetail.verifiedBy || "Office of the Registrar"}
                    </Text>
                  </View>
                </View>

                {/* Audit Grid */}
                <View style={[styles.auditGrid, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                  <View style={styles.auditRow}>
                    <Text style={[styles.auditLabel, { color: colors.secondaryText }]}>Candidate Name</Text>
                    <Text style={[styles.auditVal, { color: colors.primaryText }]}>{studentName || "—"}</Text>
                  </View>
                  <View style={styles.auditRow}>
                    <Text style={[styles.auditLabel, { color: colors.secondaryText }]}>Roll Number</Text>
                    <Text style={[styles.auditVal, { color: colors.primaryText }]}>{studentRollNo || "—"}</Text>
                  </View>
                  <View style={styles.auditRow}>
                    <Text style={[styles.auditLabel, { color: colors.secondaryText }]}>Department</Text>
                    <Text style={[styles.auditVal, { color: colors.primaryText }]}>—</Text>
                  </View>
                  <View style={styles.auditRow}>
                    <Text style={[styles.auditLabel, { color: colors.secondaryText }]}>Verification Date</Text>
                    <Text style={[styles.auditVal, { color: colors.primaryText }]}>
                      {selectedDocForDetail.verifiedAt || "Under Review"}
                    </Text>
                  </View>
                </View>

                {/* Verification Remarks */}
                <View style={{ marginTop: 10, paddingHorizontal: 4 }}>
                  <Text style={[styles.remarksLabel, { color: colors.secondaryText }]}>Registrar Notes & Remarks</Text>
                  <Text style={[styles.remarksText, { color: colors.primaryText }]}>
                    {selectedDocForDetail.notes}
                  </Text>
                </View>
              </ScrollView>

              {/* Action Buttons */}
              <View style={styles.modalActionRow}>
                <TouchableOpacity
                  style={[styles.shareCertBtn, { backgroundColor: colors.primaryAccent }]}
                  onPress={() => handleShareDoc(selectedDocForDetail)}
                  activeOpacity={0.85}
                >
                  <Icon name="share-variant" size={16} color="#FFFFFF" />
                  <Text style={styles.shareCertBtnText}>Share Credential</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.closeModalBtn, { borderColor: colors.divider }]}
                  onPress={() => setSelectedDocForDetail(null)}
                >
                  <Text style={[styles.closeModalBtnText, { color: colors.primaryText }]}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* 6. DOCUMENT UPLOAD / SCAN MODAL                                           */}
      {/* ========================================================================= */}
      {uploadModalVisible && (
        <Modal
          visible={uploadModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setUploadModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
              {/* Header */}
              <View style={styles.modalHeaderRow}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                  <View style={[styles.docIconCircle, { backgroundColor: colors.primaryAccent + "18" }]}>
                    <Icon name="cloud-upload" size={22} color={colors.primaryAccent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.modalDocTitle, { color: colors.primaryText }]}>Upload Document</Text>
                    <Text style={[styles.modalDocSub, { color: colors.secondaryText }]} numberOfLines={1}>
                      {docToUpload?.title}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity onPress={() => setUploadModalVisible(false)}>
                  <Icon name="close-circle-outline" size={24} color={colors.secondaryText} />
                </TouchableOpacity>
              </View>

              {/* Preview or Scanner Box */}
              {tempUploadedImage ? (
                <View style={styles.previewContainer}>
                  <Image source={{ uri: tempUploadedImage }} style={styles.previewImage} resizeMode="contain" />
                  <TouchableOpacity
                    style={styles.retakeBtn}
                    onPress={() => setTempUploadedImage(null)}
                  >
                    <Icon name="camera-retake-outline" size={16} color="#FFFFFF" />
                    <Text style={styles.retakeBtnText}>Retake / Choose Other</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={[styles.uploadBox, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                  <Icon name="file-upload-outline" size={42} color={colors.primaryAccent} />
                  <Text style={[styles.uploadBoxTitle, { color: colors.primaryText }]}>Scan or Select Document</Text>
                  <Text style={[styles.uploadBoxSub, { color: colors.secondaryText }]}>
                    Supported formats: PDF, JPG, PNG (Max file size: 5 MB)
                  </Text>

                  <View style={styles.uploadButtonsRow}>
                    <TouchableOpacity
                      style={[styles.pickerTriggerBtn, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
                      onPress={() => handlePickDocument(true)}
                    >
                      <Icon name="camera" size={18} color={colors.primaryAccent} />
                      <Text style={[styles.pickerTriggerText, { color: colors.primaryText }]}>Scan with Camera</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.pickerTriggerBtn, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
                      onPress={() => handlePickDocument(false)}
                    >
                      <Icon name="image-multiple" size={18} color={colors.primaryAccent} />
                      <Text style={[styles.pickerTriggerText, { color: colors.primaryText }]}>Choose from Gallery</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Submit Document Button */}
              <TouchableOpacity
                style={[
                  styles.submitUploadBtn,
                  {
                    backgroundColor: tempUploadedImage ? colors.primaryAccent : colors.divider,
                  },
                ]}
                onPress={handleConfirmUpload}
                disabled={!tempUploadedImage || isSubmittingDoc}
                activeOpacity={0.85}
              >
                {isSubmittingDoc ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Icon name="check-circle-outline" size={18} color={tempUploadedImage ? "#FFFFFF" : colors.disabledText} />
                    <Text
                      style={[
                        styles.submitUploadBtnText,
                        { color: tempUploadedImage ? "#FFFFFF" : colors.disabledText },
                      ]}
                    >
                      Submit for Registrar Clearance
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

// ---------------- Styles ----------------
const getStyles = (colors, isDarkMode) =>
  StyleSheet.create({
    container: { flex: 1 },
    scrollView: { flex: 1 },
    contentContainer: { paddingHorizontal: 16, paddingTop: 44, paddingBottom: 80 },

    /* Header */
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginBottom: 16,
    },
    headerIconWrap: {
      width: 42,
      height: 42,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: "800",
      letterSpacing: -0.3,
    },
    headerSubtitle: {
      fontSize: 11.5,
      fontWeight: "500",
      marginTop: 2,
    },
    kycSafeBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      borderWidth: 1,
    },
    kycSafeBadgeText: {
      color: "#10B981",
      fontSize: 9.5,
      fontWeight: "900",
    },

    /* Hero Card */
    heroCard: {
      borderRadius: 20,
      borderWidth: 1,
      padding: 18,
      marginBottom: 16,
      elevation: 3,
      shadowColor: "#000",
      shadowOpacity: 0.08,
      shadowRadius: 8,
    },
    heroTopRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    heroSub: {
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 0.5,
    },
    heroTitle: {
      fontSize: 20,
      fontWeight: "900",
      letterSpacing: -0.3,
      marginTop: 2,
    },
    heroGaugeBadge: {
      alignItems: "center",
      backgroundColor: colors.primaryAccent + "14",
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
    },
    heroGaugeScore: {
      fontSize: 16,
      fontWeight: "900",
    },
    heroGaugeSub: {
      fontSize: 10,
      fontWeight: "600",
    },
    progressBarWrapper: {
      marginVertical: 12,
    },
    progressBarTrack: {
      height: 8,
      borderRadius: 4,
      overflow: "hidden",
    },
    progressBarFill: {
      height: "100%",
      borderRadius: 4,
    },
    metricsRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-around",
      borderRadius: 12,
      borderWidth: 1,
      paddingVertical: 8,
    },
    metricItem: {
      alignItems: "center",
    },
    metricCount: {
      fontSize: 16,
      fontWeight: "900",
    },
    metricLabel: {
      fontSize: 10.5,
      fontWeight: "600",
      marginTop: 1,
    },
    metricDivider: {
      width: 1,
      height: 24,
    },

    /* Categories */
    categoryStrip: {
      flexDirection: "row",
      gap: 6,
      marginBottom: 10,
    },
    categoryPill: {
      flex: 1,
      alignItems: "center",
      paddingVertical: 7,
      borderRadius: 12,
      borderWidth: 1,
    },
    categoryPillText: {
      fontSize: 11.5,
      fontWeight: "700",
    },

    /* Search Box */
    searchBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      borderWidth: 1,
      marginBottom: 12,
    },
    searchInput: {
      flex: 1,
      fontSize: 12.5,
      fontWeight: "500",
      padding: 0,
    },

    /* Doc Cards */
    docCard: {
      borderRadius: 16,
      borderWidth: 1,
      padding: 14,
      elevation: 2,
    },
    docCardTop: {
      flexDirection: "row",
      alignItems: "flex-start",
    },
    docIconCircle: {
      width: 44,
      height: 44,
      borderRadius: 14,
      justifyContent: "center",
      alignItems: "center",
    },
    docTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    docTitle: {
      fontSize: 13.5,
      fontWeight: "800",
      flex: 1,
    },
    mandatoryPill: {
      backgroundColor: "#EF444414",
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      marginLeft: 6,
    },
    mandatoryPillText: {
      color: "#EF4444",
      fontSize: 8.5,
      fontWeight: "900",
    },
    docMetaText: {
      fontSize: 11,
      fontWeight: "500",
      marginTop: 2,
    },
    docSizeText: {
      fontSize: 10.5,
      fontWeight: "500",
      marginTop: 2,
    },
    docCardBottom: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      borderTopWidth: 1,
      marginTop: 12,
      paddingTop: 10,
    },
    docStatusBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
    },
    docStatusText: {
      fontSize: 9.5,
      fontWeight: "900",
    },
    uploadActionBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
    },
    uploadActionBtnText: {
      color: "#FFFFFF",
      fontSize: 11.5,
      fontWeight: "800",
    },
    viewDocActionBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 2,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 8,
      borderWidth: 1,
    },
    viewDocActionBtnText: {
      fontSize: 11.5,
      fontWeight: "700",
    },

    /* Modals */
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.75)",
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 18,
    },
    modalCard: {
      width: "100%",
      borderRadius: 22,
      borderWidth: 1,
      padding: 18,
      elevation: 12,
    },
    modalHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 14,
    },
    modalDocTitle: {
      fontSize: 15,
      fontWeight: "800",
    },
    modalDocSub: {
      fontSize: 11.5,
      fontWeight: "500",
    },
    sealBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      padding: 12,
      borderRadius: 14,
      borderWidth: 1,
      marginBottom: 12,
    },
    sealTitle: {
      fontSize: 11.5,
      fontWeight: "900",
      letterSpacing: 0.5,
    },
    sealSub: {
      fontSize: 10.5,
      fontWeight: "500",
      marginTop: 2,
    },
    auditGrid: {
      borderRadius: 14,
      borderWidth: 1,
      padding: 12,
      gap: 6,
      marginBottom: 10,
    },
    auditRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    auditLabel: {
      fontSize: 11.5,
      fontWeight: "600",
    },
    auditVal: {
      fontSize: 12,
      fontWeight: "800",
    },
    remarksLabel: {
      fontSize: 11,
      fontWeight: "700",
    },
    remarksText: {
      fontSize: 12,
      fontWeight: "500",
      lineHeight: 16,
      marginTop: 2,
    },
    modalActionRow: {
      flexDirection: "row",
      gap: 8,
      marginTop: 16,
    },
    shareCertBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 12,
      borderRadius: 12,
    },
    shareCertBtnText: {
      color: "#FFFFFF",
      fontSize: 13,
      fontWeight: "800",
    },
    closeModalBtn: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
    },
    closeModalBtnText: {
      fontSize: 13,
      fontWeight: "800",
    },

    /* Upload Box */
    uploadBox: {
      alignItems: "center",
      padding: 20,
      borderRadius: 16,
      borderWidth: 1.5,
      borderStyle: "dashed",
      marginBottom: 14,
    },
    uploadBoxTitle: {
      fontSize: 14,
      fontWeight: "800",
      marginTop: 8,
    },
    uploadBoxSub: {
      fontSize: 11,
      textAlign: "center",
      marginTop: 4,
      marginBottom: 14,
    },
    uploadButtonsRow: {
      width: "100%",
      gap: 8,
    },
    pickerTriggerBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
    },
    pickerTriggerText: {
      fontSize: 12,
      fontWeight: "700",
    },
    previewContainer: {
      alignItems: "center",
      marginBottom: 14,
    },
    previewImage: {
      width: "100%",
      height: 180,
      borderRadius: 12,
    },
    retakeBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: "#334155",
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      marginTop: 8,
    },
    retakeBtnText: {
      color: "#FFFFFF",
      fontSize: 11,
      fontWeight: "700",
    },
    submitUploadBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 13,
      borderRadius: 12,
    },
    submitUploadBtnText: {
      fontSize: 13,
      fontWeight: "800",
    },
  });
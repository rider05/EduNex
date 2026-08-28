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

// ---------------- Standard DocSpace Verified Dataset ----------------
const INITIAL_DOCUMENTS = [
  {
    id: "doc_1",
    title: "Class 10th / SSLC Marks Statement",
    category: "Academic",
    status: "verified",
    serialNo: "SSLC-TN-849201",
    issuer: "State Board of Secondary Education",
    issuedDate: "15 May 2021",
    verifiedBy: "Registrar Office · Anna University",
    fileSize: "1.4 MB · Digital Verified",
    icon: "file-certificate",
    color: "#4F46E5",
    remarks: "Original statement verified and securely archived in DigiLocker vault.",
  },
  {
    id: "doc_2",
    title: "Class 12th / Higher Secondary Marksheet",
    category: "Academic",
    status: "verified",
    serialNo: "HSC-TN-992144",
    issuer: "Department of Government Examinations",
    issuedDate: "20 Jun 2023",
    verifiedBy: "Dean of Admissions",
    fileSize: "1.8 MB · Digital Verified",
    icon: "school",
    color: "#2563EB",
    remarks: "Cut-off marks validated for B.Tech AI & DS admission clearance.",
  },
  {
    id: "doc_3",
    title: "TNEA Engineering Allotment Order",
    category: "Academic",
    status: "verified",
    serialNo: "TNEA-2023-AI041",
    issuer: "Directorate of Technical Education (DOTE)",
    issuedDate: "12 Aug 2023",
    verifiedBy: "Admission Office",
    fileSize: "980 KB · Digital Verified",
    icon: "file-document-check",
    color: "#0D9488",
    remarks: "Government quota allocation confirmed for AI & DS department.",
  },
  {
    id: "doc_4",
    title: "Transfer & Conduct Certificate (TC)",
    category: "Academic",
    status: "verified",
    serialNo: "TC-2023-0182",
    issuer: "Higher Secondary School Principal",
    issuedDate: "10 Jul 2023",
    verifiedBy: "Student Affairs Section",
    fileSize: "1.1 MB · Digital Verified",
    icon: "card-account-details-outline",
    color: "#7C3AED",
    remarks: "Original TC deposited during matriculation.",
  },
  {
    id: "doc_5",
    title: "National Aadhaar Identity Card",
    category: "Identity",
    status: "verified",
    serialNo: "UIDAI-XXXX-9102",
    issuer: "Unique Identification Authority of India",
    issuedDate: "Verified Online",
    verifiedBy: "KYC Automated Security",
    fileSize: "750 KB · e-KYC Verified",
    icon: "smart-card-outline",
    color: "#10B981",
    remarks: "Biometric and demographic data matched with institutional ledger.",
  },
  {
    id: "doc_6",
    title: "Permanent Community Certificate",
    category: "Identity",
    status: "verified",
    serialNo: "CC-REV-74920",
    issuer: "Revenue Department / Tahsildar",
    issuedDate: "05 Mar 2021",
    verifiedBy: "Scholarship & Welfare Section",
    fileSize: "1.3 MB · Digital Verified",
    icon: "shield-account",
    color: "#DB2777",
    remarks: "Welfare scheme eligibility verified.",
  },
  {
    id: "doc_7",
    title: "Institutional Anti-Ragging Affidavit",
    category: "Affidavits",
    status: "pending",
    serialNo: "AFF-2025-004",
    issuer: "UGC / Anti-Ragging Cell",
    issuedDate: "Awaiting Verification",
    verifiedBy: "Proctorial Board",
    fileSize: "1.2 MB · Submitted",
    icon: "gavel",
    color: "#F59E0B",
    remarks: "Annual student undertaking uploaded for odd semester.",
  },
  {
    id: "doc_8",
    title: "Medical Fitness & Blood Group Record",
    category: "Identity",
    status: "verified",
    serialNo: "MED-EDX-2023",
    issuer: "Campus Health Centre Medical Officer",
    issuedDate: "01 Aug 2023",
    verifiedBy: "Chief Medical Officer",
    fileSize: "620 KB · Verified",
    icon: "medical-bag",
    color: "#EF4444",
    remarks: "Blood Group: O+ve · Emergency medical profile registered.",
  },
];

const CATEGORIES = ["All", "Academic", "Identity", "Affidavits"];

export default function DocSpaceScreen() {
  const { colors, isDarkMode } = useTheme();
  const styles = getStyles(colors, isDarkMode);

  const [refreshing, setRefreshing] = useState(false);
  const [documents, setDocuments] = useState(INITIAL_DOCUMENTS);
  const [studentName, setStudentName] = useState("Karthik Raja M");
  const [studentRollNo, setStudentRollNo] = useState("25ACSE001");

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
      const raw = await AsyncStorage.getItem("student_verified_documents_v3");
      if (raw) {
        setDocuments(JSON.parse(raw));
      } else {
        setDocuments(INITIAL_DOCUMENTS);
      }
      const student = await getStudentData().catch(() => null);
      if (student) {
        setStudentName(student.name || "Karthik Raja M");
        setStudentRollNo(student.rollNo || "25ACSE001");
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
            remarks: "Uploaded by student. Pending Registrar verification.",
          };
        }
        return doc;
      });

      setDocuments(updatedList);
      await AsyncStorage.setItem("student_verified_documents_v3", JSON.stringify(updatedList));

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

      showToast("📄 Document submitted to DocSpace for verification!", "success");
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
        title: `DocSpace Credential - ${doc.title}`,
        message: `🛡️ EDUNEX DOCSPACE DIGITAL CREDENTIAL\nDocument: ${doc.title}\nSerial No: ${doc.serialNo || "PENDING"}\nHolder: ${studentName} (${studentRollNo})\nCategory: ${doc.category}\nStatus: ${doc.status.toUpperCase()}\nVerified By: ${doc.verifiedBy || "Registrar Office"}\nSecured via EduNex Cryptographic Vault.`,
      });
      showToast("DocSpace credential shared!", "success");
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
            <Icon name="folder-account" size={24} color={colors.primaryAccent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: colors.primaryText }]}>DocSpace</Text>
            <Text style={[styles.headerSubtitle, { color: colors.secondaryText }]}>
              Academic Credentials, Certificates & Digital Vault
            </Text>
          </View>
          <View style={[styles.kycSafeBadge, { backgroundColor: "#10B98118", borderColor: "#10B98144" }]}>
            <Icon name="check-decagram" size={14} color="#10B981" />
            <Text style={styles.kycSafeBadgeText}>DOCS VERIFIED</Text>
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
                  {
                    width: `${stats.percentage}%`,
                    backgroundColor: stats.percentage >= 80 ? "#10B981" : colors.primaryAccent,
                  },
                ]}
              />
            </View>
          </View>

          {/* KPI Mini Strip */}
          <View style={[styles.kpiRow, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
            <View style={styles.kpiItem}>
              <Text style={[styles.kpiVal, { color: "#10B981" }]}>{stats.verified}</Text>
              <Text style={[styles.kpiLbl, { color: colors.secondaryText }]}>Verified</Text>
            </View>
            <View style={[styles.kpiDivider, { backgroundColor: colors.divider }]} />
            <View style={styles.kpiItem}>
              <Text style={[styles.kpiVal, { color: "#F59E0B" }]}>{stats.pending}</Text>
              <Text style={[styles.kpiLbl, { color: colors.secondaryText }]}>Pending</Text>
            </View>
            <View style={[styles.kpiDivider, { backgroundColor: colors.divider }]} />
            <View style={styles.kpiItem}>
              <Text style={[styles.kpiVal, { color: "#64748B" }]}>{stats.actionRequired}</Text>
              <Text style={[styles.kpiLbl, { color: colors.secondaryText }]}>Required</Text>
            </View>
          </View>
        </View>

        {/* ========================================================================= */}
        {/* 3. CATEGORY SELECTOR & SEARCH                                             */}
        {/* ========================================================================= */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: colors.primaryText }]}>
            Document Records ({filteredDocs.length})
          </Text>
        </View>

        {/* Category Pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 10 }}>
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
                activeOpacity={0.8}
              >
                <Text style={[styles.categoryPillText, { color: isSel ? "#FFFFFF" : colors.primaryText }]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Search Input */}
        <View style={[styles.searchBox, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
          <Icon name="magnify" size={18} color={colors.secondaryText} />
          <TextInput
            style={[styles.searchInput, { color: colors.primaryText }]}
            placeholder="Search document name, serial no..."
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
        {/* 4. DOCUMENT VAULT CARDS                                                   */}
        {/* ========================================================================= */}
        <View style={{ gap: 10 }}>
          {filteredDocs.map((doc) => {
            const isVerified = doc.status === "verified";
            const isPending = doc.status === "pending";

            return (
              <TouchableOpacity
                key={doc.id}
                style={[styles.docCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
                onPress={() => setSelectedDocForDetail(doc)}
                activeOpacity={0.85}
              >
                <View style={styles.docCardTop}>
                  <View style={[styles.docIconCircle, { backgroundColor: doc.color + "18" }]}>
                    <Icon name={doc.icon || "file-certificate"} size={22} color={doc.color} />
                  </View>

                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <Text style={[styles.docCategoryBadge, { color: doc.color }]}>{doc.category.toUpperCase()}</Text>
                      <View
                        style={[
                          styles.statusPill,
                          isVerified
                            ? { backgroundColor: "#10B98118" }
                            : isPending
                            ? { backgroundColor: "#F59E0B18" }
                            : { backgroundColor: "#EF444418" },
                        ]}
                      >
                        <Icon
                          name={isVerified ? "check-decagram" : isPending ? "clock-outline" : "alert-circle-outline"}
                          size={11}
                          color={isVerified ? "#10B981" : isPending ? "#F59E0B" : "#EF4444"}
                        />
                        <Text
                          style={[
                            styles.statusPillText,
                            { color: isVerified ? "#10B981" : isPending ? "#D97706" : "#EF4444" },
                          ]}
                        >
                          {doc.status.toUpperCase()}
                        </Text>
                      </View>
                    </View>

                    <Text style={[styles.docTitle, { color: colors.primaryText }]} numberOfLines={1}>
                      {doc.title}
                    </Text>

                    <Text style={[styles.docMeta, { color: colors.secondaryText }]}>
                      Serial: {doc.serialNo || "—"} · {doc.fileSize}
                    </Text>
                  </View>
                </View>

                {/* Footer Action Strip */}
                <View style={styles.docCardFooter}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, flex: 1 }}>
                    <Icon name="shield-check-outline" size={13} color={colors.secondaryText} />
                    <Text style={[styles.verifiedByText, { color: colors.secondaryText }]} numberOfLines={1}>
                      {doc.verifiedBy || doc.issuer}
                    </Text>
                  </View>

                  {isVerified ? (
                    <TouchableOpacity
                      style={[styles.miniShareBtn, { backgroundColor: colors.primaryBackground }]}
                      onPress={() => handleShareDoc(doc)}
                    >
                      <Icon name="share-variant-outline" size={13} color={colors.primaryAccent} />
                      <Text style={[styles.miniShareText, { color: colors.primaryAccent }]}>Share</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={[styles.miniUploadBtn, { backgroundColor: colors.primaryAccent }]}
                      onPress={() => {
                        setDocToUpload(doc);
                        setUploadModalVisible(true);
                      }}
                    >
                      <Icon name="upload" size={13} color="#FFFFFF" />
                      <Text style={styles.miniUploadText}>Upload</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ========================================================================= */}
      {/* 5. DOCUMENT DETAIL & CREDENTIAL CERTIFICATE MODAL                          */}
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
              {/* Modal Top */}
              <View style={styles.modalTopRow}>
                <View style={[styles.modalIconWrap, { backgroundColor: selectedDocForDetail.color + "18" }]}>
                  <Icon name={selectedDocForDetail.icon} size={24} color={selectedDocForDetail.color} />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.modalCategory, { color: selectedDocForDetail.color }]}>
                    {selectedDocForDetail.category} Credential
                  </Text>
                  <Text style={[styles.modalTitle, { color: colors.primaryText }]}>
                    {selectedDocForDetail.title}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setSelectedDocForDetail(null)}>
                  <Icon name="close-circle-outline" size={24} color={colors.secondaryText} />
                </TouchableOpacity>
              </View>

              {/* Status Banner */}
              <View
                style={[
                  styles.modalStatusBanner,
                  selectedDocForDetail.status === "verified"
                    ? { backgroundColor: "#10B98118", borderColor: "#10B98144" }
                    : { backgroundColor: "#F59E0B18", borderColor: "#F59E0B44" },
                ]}
              >
                <Icon
                  name={selectedDocForDetail.status === "verified" ? "check-decagram" : "clock-alert-outline"}
                  size={16}
                  color={selectedDocForDetail.status === "verified" ? "#10B981" : "#F59E0B"}
                />
                <Text
                  style={[
                    styles.modalStatusBannerText,
                    { color: selectedDocForDetail.status === "verified" ? "#10B981" : "#D97706" },
                  ]}
                >
                  {selectedDocForDetail.status === "verified"
                    ? "DIGITALLY VERIFIED CREDENTIAL"
                    : "SUBMISSION PENDING VERIFICATION"}
                </Text>
              </View>

              {/* Identity Grid */}
              <View style={[styles.modalGrid, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                <View style={styles.modalGridItem}>
                  <Text style={[styles.modalGridKey, { color: colors.secondaryText }]}>Holder Name</Text>
                  <Text style={[styles.modalGridVal, { color: colors.primaryText }]}>{studentName}</Text>
                </View>
                <View style={styles.modalGridItem}>
                  <Text style={[styles.modalGridKey, { color: colors.secondaryText }]}>Roll Number</Text>
                  <Text style={[styles.modalGridVal, { color: colors.primaryText }]}>{studentRollNo}</Text>
                </View>
                <View style={styles.modalGridItem}>
                  <Text style={[styles.modalGridKey, { color: colors.secondaryText }]}>Serial Identifier</Text>
                  <Text style={[styles.modalGridVal, { color: selectedDocForDetail.color }]}>
                    {selectedDocForDetail.serialNo || "PENDING"}
                  </Text>
                </View>
                <View style={styles.modalGridItem}>
                  <Text style={[styles.modalGridKey, { color: colors.secondaryText }]}>Issuing Authority</Text>
                  <Text style={[styles.modalGridVal, { color: colors.primaryText }]}>{selectedDocForDetail.issuer}</Text>
                </View>
              </View>

              {/* Remarks Box */}
              {selectedDocForDetail.remarks && (
                <View style={[styles.modalRemarksBox, { backgroundColor: colors.primaryBackground }]}>
                  <Text style={[styles.modalRemarksText, { color: colors.secondaryText }]}>
                    📌 {selectedDocForDetail.remarks}
                  </Text>
                </View>
              )}

              {/* Modal Actions */}
              <View style={styles.modalActionsRow}>
                <TouchableOpacity
                  style={[styles.modalShareBtn, { backgroundColor: colors.primaryAccent }]}
                  onPress={() => handleShareDoc(selectedDocForDetail)}
                >
                  <Icon name="share-variant" size={16} color="#FFFFFF" />
                  <Text style={styles.modalShareBtnText}>Share Credential</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalCloseBtn, { borderColor: colors.divider }]}
                  onPress={() => setSelectedDocForDetail(null)}
                >
                  <Text style={[styles.modalCloseBtnText, { color: colors.primaryText }]}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* 6. SCAN / UPLOAD DOCUMENT MODAL                                           */}
      {/* ========================================================================= */}
      {uploadModalVisible && docToUpload && (
        <Modal
          visible={uploadModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setUploadModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
              <View style={styles.modalTopRow}>
                <Icon name="cloud-upload" size={24} color={colors.primaryAccent} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.modalTitle, { color: colors.primaryText }]}>Upload to DocSpace</Text>
                  <Text style={[styles.modalCategory, { color: colors.secondaryText }]}>{docToUpload.title}</Text>
                </View>
                <TouchableOpacity onPress={() => setUploadModalVisible(false)}>
                  <Icon name="close-circle-outline" size={24} color={colors.secondaryText} />
                </TouchableOpacity>
              </View>

              {/* Picker Triggers */}
              <View style={{ flexDirection: "row", gap: 10, marginVertical: 14 }}>
                <TouchableOpacity
                  style={[styles.pickMethodBtn, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}
                  onPress={() => handlePickDocument(true)}
                >
                  <Icon name="camera" size={24} color={colors.primaryAccent} />
                  <Text style={[styles.pickMethodText, { color: colors.primaryText }]}>Take Photo</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.pickMethodBtn, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}
                  onPress={() => handlePickDocument(false)}
                >
                  <Icon name="image-multiple" size={24} color={colors.primaryAccent} />
                  <Text style={[styles.pickMethodText, { color: colors.primaryText }]}>From Gallery</Text>
                </TouchableOpacity>
              </View>

              {/* Preview Image */}
              {tempUploadedImage && (
                <View style={styles.imagePreviewWrap}>
                  <Image source={{ uri: tempUploadedImage }} style={styles.previewImage} />
                  <Text style={[styles.imageReadyText, { color: "#10B981" }]}>✓ File ready for encryption & upload</Text>
                </View>
              )}

              {/* Action Buttons */}
              <View style={styles.modalActionsRow}>
                <TouchableOpacity
                  style={[styles.modalShareBtn, { backgroundColor: colors.primaryAccent }]}
                  onPress={handleConfirmUpload}
                  disabled={isSubmittingDoc}
                >
                  {isSubmittingDoc ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Icon name="shield-lock" size={16} color="#FFFFFF" />
                      <Text style={styles.modalShareBtnText}>Upload & Verify</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalCloseBtn, { borderColor: colors.divider }]}
                  onPress={() => setUploadModalVisible(false)}
                >
                  <Text style={[styles.modalCloseBtnText, { color: colors.primaryText }]}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

// ---------------- Styles ----------------
const getStyles = (colors, _isDarkMode) =>
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
      fontSize: 11,
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
      borderRadius: 18,
      borderWidth: 1,
      padding: 16,
      marginBottom: 16,
      elevation: 2,
    },
    heroTopRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    heroSub: {
      fontSize: 10.5,
      fontWeight: "800",
      letterSpacing: 0.5,
    },
    heroTitle: {
      fontSize: 18,
      fontWeight: "900",
      marginTop: 2,
    },
    heroGaugeBadge: {
      alignItems: "flex-end",
    },
    heroGaugeScore: {
      fontSize: 20,
      fontWeight: "900",
    },
    heroGaugeSub: {
      fontSize: 10,
      fontWeight: "600",
    },
    progressBarWrapper: {
      marginTop: 12,
    },
    progressBarTrack: {
      height: 7,
      borderRadius: 4,
      overflow: "hidden",
    },
    progressBarFill: {
      height: "100%",
      borderRadius: 4,
    },
    kpiRow: {
      flexDirection: "row",
      justifyContent: "space-around",
      borderRadius: 12,
      borderWidth: 1,
      paddingVertical: 8,
      marginTop: 12,
    },
    kpiItem: {
      alignItems: "center",
    },
    kpiVal: {
      fontSize: 15,
      fontWeight: "900",
    },
    kpiLbl: {
      fontSize: 10,
      fontWeight: "600",
      marginTop: 1,
    },
    kpiDivider: {
      width: 1,
      height: 22,
      alignSelf: "center",
    },

    /* Category & Search */
    sectionHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
    },
    sectionTitle: {
      fontSize: 14.5,
      fontWeight: "800",
    },
    categoryPill: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 10,
      borderWidth: 1,
    },
    categoryPillText: {
      fontSize: 11.5,
      fontWeight: "700",
    },
    searchBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      borderRadius: 12,
      borderWidth: 1,
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginBottom: 12,
    },
    searchInput: {
      flex: 1,
      fontSize: 12,
      padding: 0,
    },

    /* Doc Cards */
    docCard: {
      borderRadius: 16,
      borderWidth: 1,
      padding: 12,
    },
    docCardTop: {
      flexDirection: "row",
      alignItems: "center",
    },
    docIconCircle: {
      width: 42,
      height: 42,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
    },
    docCategoryBadge: {
      fontSize: 9.5,
      fontWeight: "800",
      letterSpacing: 0.5,
    },
    statusPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    statusPillText: {
      fontSize: 9,
      fontWeight: "900",
    },
    docTitle: {
      fontSize: 13.5,
      fontWeight: "800",
      marginTop: 2,
    },
    docMeta: {
      fontSize: 11,
      fontWeight: "500",
      marginTop: 2,
    },
    docCardFooter: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 10,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: "rgba(150,150,150,0.15)",
    },
    verifiedByText: {
      fontSize: 11,
      fontWeight: "600",
    },
    miniShareBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
    },
    miniShareText: {
      fontSize: 11,
      fontWeight: "700",
    },
    miniUploadBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 6,
    },
    miniUploadText: {
      color: "#FFFFFF",
      fontSize: 11,
      fontWeight: "800",
    },

    /* Modal Overlay & Card */
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.75)",
      justifyContent: "center",
      alignItems: "center",
      padding: 16,
    },
    modalCard: {
      width: "100%",
      borderRadius: 20,
      borderWidth: 1,
      padding: 18,
      elevation: 10,
    },
    modalTopRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 12,
    },
    modalIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 10,
      justifyContent: "center",
      alignItems: "center",
    },
    modalCategory: {
      fontSize: 10.5,
      fontWeight: "800",
    },
    modalTitle: {
      fontSize: 14.5,
      fontWeight: "800",
      marginTop: 1,
    },
    modalStatusBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
      marginBottom: 12,
    },
    modalStatusBannerText: {
      fontSize: 10.5,
      fontWeight: "900",
      letterSpacing: 0.5,
    },
    modalGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      borderRadius: 12,
      borderWidth: 1,
      padding: 10,
      marginBottom: 10,
    },
    modalGridItem: {
      flexBasis: "50%",
      padding: 4,
    },
    modalGridKey: {
      fontSize: 10,
      fontWeight: "600",
    },
    modalGridVal: {
      fontSize: 11.5,
      fontWeight: "800",
      marginTop: 1,
    },
    modalRemarksBox: {
      padding: 8,
      borderRadius: 8,
      marginBottom: 12,
    },
    modalRemarksText: {
      fontSize: 11,
      fontWeight: "500",
      fontStyle: "italic",
    },
    modalActionsRow: {
      flexDirection: "row",
      gap: 10,
    },
    modalShareBtn: {
      flex: 1.2,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 10,
      borderRadius: 10,
    },
    modalShareBtnText: {
      color: "#FFFFFF",
      fontSize: 12,
      fontWeight: "800",
    },
    modalCloseBtn: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
    },
    modalCloseBtnText: {
      fontSize: 12,
      fontWeight: "700",
    },

    /* Upload Dialog */
    pickMethodBtn: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 16,
      borderRadius: 12,
      borderWidth: 1,
      gap: 6,
    },
    pickMethodText: {
      fontSize: 12,
      fontWeight: "700",
    },
    imagePreviewWrap: {
      alignItems: "center",
      marginVertical: 10,
    },
    previewImage: {
      width: "100%",
      height: 160,
      borderRadius: 10,
      resizeMode: "cover",
    },
    imageReadyText: {
      fontSize: 11,
      fontWeight: "700",
      marginTop: 6,
    },
  });

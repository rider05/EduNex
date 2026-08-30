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
import * as DocumentPicker from "expo-document-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "../../context/ThemeContext";
import {
  getRequiredDocuments,
  getStudentDocuments,
  uploadStudentDocument,
  updateStudentDocument,
  getStudentData,
} from "../../services/dataService";
import { resolveIdentity } from "../../services/identityService";
import { showToast } from "../../utils/toastService";

// ---------------- Fallback Required Doc Definitions ----------------
const DEFAULT_REQUIRED_DOCS = [
  {
    id: "REQ-001",
    code: "DOC_SSLC",
    title: "Class 10th / SSLC Marks Statement",
    category: "Academic",
    isMandatory: true,
    description: "Original state board or central board secondary school completion certificate.",
    issuer: "State Board of Secondary Education",
    icon: "file-certificate",
    color: "#4F46E5",
    instructions: "Scan clear color copy showing student name, register number, and board seal.",
  },
  {
    id: "REQ-002",
    code: "DOC_HSC",
    title: "Class 12th / Higher Secondary Marksheet",
    category: "Academic",
    isMandatory: true,
    description: "Higher Secondary / Diploma final statement of marks for admission clearance.",
    issuer: "Department of Government Examinations",
    icon: "school",
    color: "#2563EB",
    instructions: "Ensure PCM cutoff marks and practical scores are legible.",
  },
  {
    id: "REQ-003",
    code: "DOC_ALLOTMENT",
    title: "TNEA Engineering Allotment Order",
    category: "Academic",
    isMandatory: true,
    description: "Government quota seat allocation order issued by DOTE / TNEA.",
    issuer: "Directorate of Technical Education (DOTE)",
    icon: "file-document-check",
    color: "#0D9488",
    instructions: "Upload signed allotment memo with round allocation details.",
  },
  {
    id: "REQ-004",
    code: "DOC_TC",
    title: "Transfer & Conduct Certificate (TC)",
    category: "Academic",
    isMandatory: true,
    description: "Original TC issued by previous school / college principal.",
    issuer: "Higher Secondary School Principal",
    icon: "card-account-details-outline",
    color: "#7C3AED",
    instructions: "Upload original scanned copy with institution seal.",
  },
  {
    id: "REQ-005",
    code: "DOC_AADHAAR",
    title: "National Aadhaar Identity Card",
    category: "Identity",
    isMandatory: true,
    description: "Government of India UIDAI identity credential.",
    issuer: "Unique Identification Authority of India",
    icon: "smart-card-outline",
    color: "#10B981",
    instructions: "Upload front and back or e-Aadhaar PDF copy.",
  },
  {
    id: "REQ-006",
    code: "DOC_COMMUNITY",
    title: "Permanent Community Certificate",
    category: "Identity",
    isMandatory: true,
    description: "Digital community certificate issued by Revenue Department / Tahsildar.",
    issuer: "Revenue Department / Tahsildar",
    icon: "shield-account",
    color: "#DB2777",
    instructions: "Must have valid digital signature and QR verification code.",
  },
  {
    id: "REQ-007",
    code: "DOC_ANTIRAGGING",
    title: "Institutional Anti-Ragging Affidavit",
    category: "Affidavits",
    isMandatory: true,
    description: "Mandatory annual UGC anti-ragging student & parent undertaking.",
    issuer: "UGC / Anti-Ragging Cell",
    icon: "gavel",
    color: "#F59E0B",
    instructions: "Sign the undertaking and upload the stamped / notarized affidavit.",
  },
  {
    id: "REQ-008",
    code: "DOC_MEDICAL",
    title: "Medical Fitness & Blood Group Record",
    category: "Identity",
    isMandatory: false,
    description: "Physical fitness certificate and blood group report by certified practitioner.",
    issuer: "Campus Health Centre Medical Officer",
    icon: "medical-bag",
    color: "#EF4444",
    instructions: "Issued by registered medical practitioner (MBBS minimum).",
  },
  {
    id: "REQ-009",
    code: "DOC_INCOME",
    title: "Income & Asset Certificate",
    category: "Scholarship",
    isMandatory: false,
    description: "Annual family income certificate for scholarship and fee concession.",
    issuer: "Revenue Department / Tahsildar",
    icon: "cash-multiple",
    color: "#059669",
    instructions: "Valid for current financial year.",
  },
];

const CATEGORIES = ["All", "Academic", "Identity", "Affidavits", "Scholarship"];

function getCategoryColor(cat) {
  switch (cat) {
    case "Academic":
      return "#4F46E5";
    case "Identity":
      return "#10B981";
    case "Affidavits":
      return "#F59E0B";
    case "Scholarship":
      return "#059669";
    default:
      return "#6366F1";
  }
}

function getCategoryIcon(cat) {
  switch (cat) {
    case "Academic":
      return "file-certificate";
    case "Identity":
      return "smart-card-outline";
    case "Affidavits":
      return "gavel";
    case "Scholarship":
      return "cash-multiple";
    default:
      return "file-document-outline";
  }
}

export default function DocSpaceScreen() {
  const { colors, isDarkMode } = useTheme();
  const styles = getStyles(colors, isDarkMode);

  const [refreshing, setRefreshing] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [studentName, setStudentName] = useState("Velu");
  const [studentRollNo, setStudentRollNo] = useState("25ACSE001");
  const [studentDept, setStudentDept] = useState("Computer Science & Engineering");
  const [studentYear, setStudentYear] = useState("II Year");

  // Filters & Search
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [selectedDocForDetail, setSelectedDocForDetail] = useState(null);
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [docToUpload, setDocToUpload] = useState(null);
  const [tempUploadedFile, setTempUploadedFile] = useState(null);
  const [isSubmittingDoc, setIsSubmittingDoc] = useState(false);

  // Load from MongoDB backend (Required Docs + Student Uploads)
  const loadDocuments = useCallback(async () => {
    try {
      // 1. Resolve Student Identity
      const identity = await resolveIdentity("student").catch(() => null);
      const student = await getStudentData().catch(() => null);

      const roll = student?.rollNo || identity?.rollNo || "25ACSE001";
      const name = student?.name || identity?.name || "Velu";
      const dept = student?.department || student?.class || "Computer Science & Engineering";
      const year = student?.year || "II Year";

      setStudentRollNo(roll);
      setStudentName(name);
      setStudentDept(dept);
      setStudentYear(year);

      // 2. Fetch live data from MongoDB
      const [reqDocsRes, studentDocsRes] = await Promise.all([
        getRequiredDocuments().catch(() => []),
        getStudentDocuments(roll).catch(() => []),
      ]);

      const reqDocs = reqDocsRes && reqDocsRes.length > 0 ? reqDocsRes : DEFAULT_REQUIRED_DOCS;
      const uploadedDocs = Array.isArray(studentDocsRes) ? studentDocsRes : [];

      // 3. Merge Required Checklist with Student Uploads
      const mergedList = reqDocs.map((req) => {
        const docCode = req.code || req.id;
        const uploaded = uploadedDocs.find(
          (u) =>
            (u.docCode && u.docCode === docCode) ||
            (u.title && u.title.toLowerCase().trim() === req.title.toLowerCase().trim())
        );

        if (uploaded) {
          return {
            id: uploaded.id || req.id,
            mongoDocId: uploaded.id || uploaded._id,
            docCode: docCode,
            title: req.title || uploaded.title,
            category: req.category || uploaded.category || "Academic",
            status: uploaded.status || "pending",
            serialNo: uploaded.serialNo || `EDX-${docCode.replace("DOC_", "")}-${roll.slice(-3)}`,
            issuer: req.issuer || uploaded.issuer || "Institutional Authority",
            issuedDate: uploaded.verifiedAt
              ? new Date(uploaded.verifiedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
              : uploaded.uploadedAt
              ? new Date(uploaded.uploadedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
              : "Pending Verification",
            verifiedBy: uploaded.verifiedBy || (uploaded.status === "verified" ? "Registrar Office" : null),
            fileSize: uploaded.fileSize || "1.4 MB · Digital Verified",
            fileUri: uploaded.fileUri || uploaded.fileUrl || null,
            fileName: uploaded.fileName || `${req.title}.pdf`,
            mimeType: uploaded.mimeType || "application/pdf",
            icon: req.icon || getCategoryIcon(req.category),
            color: req.color || getCategoryColor(req.category),
            remarks: uploaded.remarks || uploaded.rejectionReason || req.description,
            rejectionReason: uploaded.rejectionReason || null,
            isMandatory: req.isMandatory !== false,
            instructions: req.instructions || req.description,
            isUploaded: true,
          };
        }

        return {
          id: req.id || docCode,
          mongoDocId: null,
          docCode: docCode,
          title: req.title,
          category: req.category || "Academic",
          status: "not_submitted",
          serialNo: "NOT SUBMITTED",
          issuer: req.issuer || "Institutional Authority",
          issuedDate: "Upload Required",
          verifiedBy: null,
          fileSize: `Max ${req.maxSizeMB || 5} MB · ${req.allowedFormats?.join("/") || "PDF/PNG"}`,
          fileUri: null,
          fileName: null,
          mimeType: null,
          icon: req.icon || getCategoryIcon(req.category),
          color: req.color || getCategoryColor(req.category),
          remarks: req.instructions || req.description || "Mandatory document submission for institutional clearance.",
          rejectionReason: null,
          isMandatory: req.isMandatory !== false,
          instructions: req.instructions || req.description,
          isUploaded: false,
        };
      });

      // Add any additional uploaded docs by student that weren't in the default checklist
      uploadedDocs.forEach((u) => {
        const alreadyMerged = mergedList.some((m) => m.mongoDocId === u.id || m.title === u.title);
        if (!alreadyMerged) {
          mergedList.push({
            id: u.id,
            mongoDocId: u.id,
            docCode: u.docCode || u.id,
            title: u.title || "Custom Certificate",
            category: u.category || "Academic",
            status: u.status || "pending",
            serialNo: u.serialNo || u.id,
            issuer: u.issuer || "Verified Issuer",
            issuedDate: u.uploadedAt
              ? new Date(u.uploadedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
              : "Recent",
            verifiedBy: u.verifiedBy || null,
            fileSize: u.fileSize || "1.0 MB",
            fileUri: u.fileUri || null,
            fileName: u.fileName || `${u.title}.pdf`,
            mimeType: u.mimeType || "application/pdf",
            icon: getCategoryIcon(u.category),
            color: getCategoryColor(u.category),
            remarks: u.remarks || u.rejectionReason || "Uploaded Document",
            rejectionReason: u.rejectionReason || null,
            isMandatory: false,
            instructions: "",
            isUploaded: true,
          });
        }
      });

      setDocuments(mergedList);
      await AsyncStorage.setItem("student_verified_documents_v4", JSON.stringify(mergedList));
    } catch (err) {
      console.warn("DocSpace loadDocuments error:", err);
    }
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
    const rejected = documents.filter((d) => d.status === "rejected").length;
    const notSubmitted = documents.filter((d) => d.status === "not_submitted" || d.status === "action_required").length;
    const actionRequired = rejected + notSubmitted;
    const percentage = total > 0 ? Math.round((verified / total) * 100) : 0;
    return { total, verified, pending, rejected, notSubmitted, actionRequired, percentage };
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

  // Pick Document (Camera, Gallery, or PDF Files)
  const handlePickDocument = async (method = "gallery") => {
    try {
      if (method === "camera") {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== "granted") {
          Alert.alert("Permission Required", "Camera permission is required to scan document.");
          return;
        }
        const result = await ImagePicker.launchCameraAsync({
          quality: 0.7,
          base64: true,
          allowsEditing: true,
        });

        if (!result.canceled && result.assets && result.assets[0]) {
          const asset = result.assets[0];
          const base64Data = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
          setTempUploadedFile({
            uri: asset.uri,
            dataUrl: base64Data,
            name: `${docToUpload?.title || "Document"}_Scan.jpg`,
            size: `${((asset.fileSize || 800000) / (1024 * 1024)).toFixed(1)} MB`,
            mimeType: "image/jpeg",
          });
        }
      } else if (method === "gallery") {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
          Alert.alert("Permission Required", "Media library permission is required to select document.");
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.7,
          base64: true,
          allowsEditing: true,
        });

        if (!result.canceled && result.assets && result.assets[0]) {
          const asset = result.assets[0];
          const base64Data = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
          setTempUploadedFile({
            uri: asset.uri,
            dataUrl: base64Data,
            name: asset.fileName || `${docToUpload?.title || "Document"}.jpg`,
            size: `${((asset.fileSize || 950000) / (1024 * 1024)).toFixed(1)} MB`,
            mimeType: "image/jpeg",
          });
        }
      } else if (method === "file") {
        const result = await DocumentPicker.getDocumentAsync({
          type: ["application/pdf", "image/*"],
          copyToCacheDirectory: true,
        });

        if (!result.canceled && result.assets && result.assets[0]) {
          const file = result.assets[0];
          setTempUploadedFile({
            uri: file.uri,
            dataUrl: file.uri,
            name: file.name || `${docToUpload?.title || "Document"}.pdf`,
            size: `${((file.size || 1024000) / (1024 * 1024)).toFixed(1)} MB`,
            mimeType: file.mimeType || "application/pdf",
          });
        }
      }
    } catch (err) {
      console.log("Document picker error:", err);
      showToast("Could not select document file", "error");
    }
  };

  // Submit Uploaded Document to MongoDB
  const handleConfirmUpload = async () => {
    if (!tempUploadedFile || !docToUpload) {
      Alert.alert("Document Required", "Please scan, select a photo, or choose a PDF file to proceed.");
      return;
    }

    setIsSubmittingDoc(true);
    try {
      const docPayload = {
        studentId: studentRollNo,
        rollNo: studentRollNo,
        studentName: studentName,
        department: studentDept,
        year: studentYear,
        docCode: docToUpload.docCode || docToUpload.code || docToUpload.id,
        title: docToUpload.title,
        category: docToUpload.category,
        serialNo: docToUpload.serialNo && docToUpload.serialNo !== "NOT SUBMITTED"
          ? docToUpload.serialNo
          : `EDX-${(docToUpload.docCode || "DOC").replace("DOC_", "")}-${studentRollNo.slice(-3)}`,
        issuer: docToUpload.issuer || "Institutional Authority",
        fileUri: tempUploadedFile.dataUrl || tempUploadedFile.uri,
        fileName: tempUploadedFile.name,
        fileSize: tempUploadedFile.size,
        mimeType: tempUploadedFile.mimeType,
        status: "pending",
        uploadedAt: new Date().toISOString(),
        rejectionReason: null,
        remarks: "Uploaded by student via DocSpace. Pending verification.",
      };

      if (docToUpload.mongoDocId) {
        await updateStudentDocument(docToUpload.mongoDocId, docPayload);
      } else {
        await uploadStudentDocument(docPayload);
      }

      showToast("📄 Document submitted to DocSpace in MongoDB!", "success");
      setUploadModalVisible(false);
      setTempUploadedFile(null);
      setDocToUpload(null);

      // Re-fetch live data
      await loadDocuments();
    } catch (err) {
      console.log("Upload confirm error:", err);
      Alert.alert("Upload Error", "Could not upload document to database. Please try again.");
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
                    : selectedDocForDetail.status === "rejected"
                    ? { backgroundColor: "#EF444418", borderColor: "#EF444444" }
                    : { backgroundColor: "#F59E0B18", borderColor: "#F59E0B44" },
                ]}
              >
                <Icon
                  name={
                    selectedDocForDetail.status === "verified"
                      ? "check-decagram"
                      : selectedDocForDetail.status === "rejected"
                      ? "alert-octagon"
                      : "clock-alert-outline"
                  }
                  size={16}
                  color={
                    selectedDocForDetail.status === "verified"
                      ? "#10B981"
                      : selectedDocForDetail.status === "rejected"
                      ? "#EF4444"
                      : "#F59E0B"
                  }
                />
                <Text
                  style={[
                    styles.modalStatusBannerText,
                    {
                      color:
                        selectedDocForDetail.status === "verified"
                          ? "#10B981"
                          : selectedDocForDetail.status === "rejected"
                          ? "#EF4444"
                          : "#D97706",
                    },
                  ]}
                >
                  {selectedDocForDetail.status === "verified"
                    ? "DIGITALLY VERIFIED CREDENTIAL"
                    : selectedDocForDetail.status === "rejected"
                    ? "SUBMISSION REJECTED — ACTION REQUIRED"
                    : selectedDocForDetail.status === "not_submitted"
                    ? "UPLOAD REQUIRED FOR VERIFICATION"
                    : "SUBMISSION PENDING VERIFICATION"}
                </Text>
              </View>

              {/* Rejection Alert Box */}
              {selectedDocForDetail.status === "rejected" && selectedDocForDetail.rejectionReason && (
                <View style={[styles.rejectionBox, { backgroundColor: "#EF444412", borderColor: "#EF444433" }]}>
                  <Text style={[styles.rejectionHeader, { color: "#EF4444" }]}>⚠️ Staff Feedback / Reason:</Text>
                  <Text style={[styles.rejectionText, { color: colors.primaryText }]}>
                    {selectedDocForDetail.rejectionReason}
                  </Text>
                </View>
              )}

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

              {/* Document Scan/Image Preview if available */}
              {selectedDocForDetail.fileUri && selectedDocForDetail.fileUri.startsWith("data:image") && (
                <View style={{ marginVertical: 8, alignItems: "center" }}>
                  <Image
                    source={{ uri: selectedDocForDetail.fileUri }}
                    style={{ width: "100%", height: 140, borderRadius: 10, resizeMode: "cover" }}
                  />
                  <Text style={{ fontSize: 11, color: colors.secondaryText, marginTop: 4 }}>
                    📄 {selectedDocForDetail.fileName || "Uploaded Document Scan"}
                  </Text>
                </View>
              )}

              {/* Modal Actions */}
              <View style={styles.modalActionsRow}>
                {selectedDocForDetail.status === "rejected" || selectedDocForDetail.status === "not_submitted" ? (
                  <TouchableOpacity
                    style={[styles.modalShareBtn, { backgroundColor: colors.primaryAccent }]}
                    onPress={() => {
                      const doc = selectedDocForDetail;
                      setSelectedDocForDetail(null);
                      setDocToUpload(doc);
                      setUploadModalVisible(true);
                    }}
                  >
                    <Icon name="cloud-upload" size={16} color="#FFFFFF" />
                    <Text style={styles.modalShareBtnText}>Upload Now</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.modalShareBtn, { backgroundColor: colors.primaryAccent }]}
                    onPress={() => handleShareDoc(selectedDocForDetail)}
                  >
                    <Icon name="share-variant" size={16} color="#FFFFFF" />
                    <Text style={styles.modalShareBtnText}>Share Credential</Text>
                  </TouchableOpacity>
                )}

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

              {/* Instructions / Allowed Formats */}
              {docToUpload.instructions ? (
                <View style={[styles.instructionsBox, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                  <Text style={[styles.instructionsText, { color: colors.secondaryText }]}>
                    ℹ️ {docToUpload.instructions}
                  </Text>
                </View>
              ) : null}

              {/* Picker Triggers - 3 Source Options */}
              <View style={{ flexDirection: "row", gap: 8, marginVertical: 14 }}>
                <TouchableOpacity
                  style={[styles.pickMethodBtn, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}
                  onPress={() => handlePickDocument("camera")}
                >
                  <Icon name="camera" size={22} color={colors.primaryAccent} />
                  <Text style={[styles.pickMethodText, { color: colors.primaryText }]}>Camera</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.pickMethodBtn, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}
                  onPress={() => handlePickDocument("gallery")}
                >
                  <Icon name="image-multiple" size={22} color={colors.primaryAccent} />
                  <Text style={[styles.pickMethodText, { color: colors.primaryText }]}>Gallery</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.pickMethodBtn, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}
                  onPress={() => handlePickDocument("file")}
                >
                  <Icon name="file-pdf-box" size={22} color={colors.primaryAccent} />
                  <Text style={[styles.pickMethodText, { color: colors.primaryText }]}>PDF / File</Text>
                </TouchableOpacity>
              </View>

              {/* Preview Selected File */}
              {tempUploadedFile && (
                <View style={[styles.imagePreviewWrap, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                  {tempUploadedFile.mimeType?.startsWith("image") && tempUploadedFile.uri ? (
                    <Image source={{ uri: tempUploadedFile.uri }} style={styles.previewImage} />
                  ) : (
                    <View style={{ padding: 14, alignItems: "center", gap: 6 }}>
                      <Icon name="file-document-check" size={36} color={colors.primaryAccent} />
                      <Text style={{ fontSize: 13, fontWeight: "700", color: colors.primaryText }}>
                        {tempUploadedFile.name}
                      </Text>
                      <Text style={{ fontSize: 11, color: colors.secondaryText }}>{tempUploadedFile.size}</Text>
                    </View>
                  )}
                  <Text style={[styles.imageReadyText, { color: "#10B981" }]}>✓ File ready for encryption & upload</Text>
                </View>
              )}

              {/* Action Buttons */}
              <View style={styles.modalActionsRow}>
                <TouchableOpacity
                  style={[styles.modalShareBtn, { backgroundColor: colors.primaryAccent }]}
                  onPress={handleConfirmUpload}
                  disabled={isSubmittingDoc || !tempUploadedFile}
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
                  onPress={() => {
                    setUploadModalVisible(false);
                    setTempUploadedFile(null);
                  }}
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
    rejectionBox: {
      padding: 10,
      borderRadius: 8,
      borderWidth: 1,
      marginBottom: 10,
    },
    rejectionHeader: {
      fontSize: 11,
      fontWeight: "800",
      marginBottom: 2,
    },
    rejectionText: {
      fontSize: 11.5,
      fontWeight: "600",
    },
    instructionsBox: {
      padding: 8,
      borderRadius: 8,
      borderWidth: 1,
      marginBottom: 8,
    },
    instructionsText: {
      fontSize: 11,
      fontWeight: "500",
      lineHeight: 15,
    },
  });

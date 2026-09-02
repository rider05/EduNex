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
  Alert,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { secureGet, secureSet } from "../../services/secureStorage";
import { useTheme } from "../../context/ThemeContext";
import {
  getRequiredDocuments,
  getStudentDocuments,
  uploadStudentDocument,
  updateStudentDocument,
  deleteStudentDocument,
  getStudentData,
} from "../../services/dataService";
import { resolveIdentity } from "../../services/identityService";
import { showToast } from "../../utils/toastService";
import { shareDocSpaceCertificatePdf } from "../../utils/pdfGenerator";
import { SkeletonDocSpaceScreen } from "../../components/common/SkeletonLoader";

// ---------------- Fallback Required Doc Definitions ----------------
const DEFAULT_REQUIRED_DOCS = [
  {
    id: "REQ-001",
    code: "DOC_SSLC",
    title: "Class 10th / SSLC Marks Statement",
    category: "Academic",
    isMandatory: true,
    maxSizeMB: 5,
    allowedFormats: ["PDF", "PNG", "JPEG"],
    instructions: "Original government issued SSLC mark card or attested copy with seal.",
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
  const [studentRollNo, setStudentRollNo] = useState("STU-2024-AIDS01");
  const [studentDept, setStudentDept] = useState("Artificial Intelligence & Data Science");
  const [studentYear, setStudentYear] = useState("III Year");

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
      const cached = await secureGet("student_verified_documents_v4");
      if (cached && Array.isArray(cached) && cached.length > 0) {
        setDocuments(cached);
      }

      // 1. Resolve student identity
      const identity = await resolveIdentity().catch(() => null);
      const student = await getStudentData().catch(() => null);
      const roll = student?.rollNo || identity?.rollNo || "STU-2024-AIDS01";
      const name = student?.name || identity?.name || "Velu";
      const dept = student?.department || student?.class || "Artificial Intelligence & Data Science";
      const year = student?.year || "III Year";

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
      await secureSet("student_verified_documents_v4", mergedList);
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
          let base64Data = null;
          try {
            const b64 = await FileSystem.readAsStringAsync(file.uri, {
              encoding: "base64",
            });
            const mime = file.mimeType || (file.name?.endsWith(".pdf") ? "application/pdf" : "image/jpeg");
            base64Data = `data:${mime};base64,${b64}`;
          } catch (b64Err) {
            console.warn("Base64 conversion fallback:", b64Err);
            base64Data = file.uri;
          }

          setTempUploadedFile({
            uri: file.uri,
            dataUrl: base64Data,
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

  // Cancel Submission / Reset Verification
  const handleCancelSubmission = (doc) => {
    if (!doc) return;
    Alert.alert(
      "Cancel Verification / Remove",
      `Are you sure you want to cancel the submission for "${doc.title}"? This will remove the uploaded scan from the database and allow you to re-upload.`,
      [
        { text: "Keep Document", style: "cancel" },
        {
          text: "✕ Cancel & Remove",
          style: "destructive",
          onPress: async () => {
            try {
              if (doc.mongoDocId) {
                await deleteStudentDocument(doc.mongoDocId);
              }
              showToast("✕ Document submission cancelled", "info");
              setSelectedDocForDetail(null);
              await loadDocuments();
            } catch (err) {
              console.warn("Cancel submission error:", err);
              Alert.alert("Error", "Could not cancel document submission. Please try again.");
            }
          },
        },
      ]
    );
  };

  // Share / Export Document Certificate
  const handleShareDoc = async (doc) => {
    try {
      await shareDocSpaceCertificatePdf({
        doc,
        student: {
          name: studentName,
          rollNo: studentRollNo,
          department: "Artificial Intelligence & Data Science",
          year: "III Year",
        },
      });
      showToast("Official DocSpace PDF certificate generated!", "success");
    } catch (err) {
      console.log("Share error:", err);
      showToast("Could not generate DocSpace PDF", "error");
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
        {isLoading ? (
          <SkeletonDocSpaceScreen />
        ) : (
          <>
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
                    <Icon
                      name={isVerified ? "shield-check" : isPending ? "clock-outline" : "information-outline"}
                      size={13}
                      color={isVerified ? "#10B981" : isPending ? "#F59E0B" : colors.secondaryText}
                    />
                    <Text
                      style={[
                        styles.verifiedByText,
                        { color: isVerified ? "#10B981" : isPending ? "#D97706" : colors.secondaryText },
                      ]}
                      numberOfLines={1}
                    >
                      {isVerified
                        ? (doc.verifiedBy || "Verified Credential")
                        : isPending
                        ? "Awaiting Admin Approval"
                        : doc.status === "rejected"
                        ? "Action Required · Rejected"
                        : (doc.issuer || "Upload Required")}
                    </Text>
                  </View>

                  {isVerified ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <TouchableOpacity
                        style={[styles.miniCancelBtn, { backgroundColor: "#EF444412", borderColor: "#EF444433" }]}
                        onPress={() => handleCancelSubmission(doc)}
                        title="Cancel Verification"
                      >
                        <Icon name="close" size={11} color="#EF4444" />
                        <Text style={[styles.miniCancelText, { color: "#EF4444" }]}>✕ Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.miniPreviewBtn, { backgroundColor: "#10B98115", borderColor: "#10B98144" }]}
                        onPress={() => setSelectedDocForDetail(doc)}
                      >
                        <Icon name="eye-check-outline" size={13} color="#10B981" />
                        <Text style={[styles.miniPreviewText, { color: "#10B981" }]}>Preview</Text>
                      </TouchableOpacity>
                    </View>
                  ) : isPending ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <TouchableOpacity
                        style={[styles.miniCancelBtn, { backgroundColor: "#EF444412", borderColor: "#EF444433" }]}
                        onPress={() => handleCancelSubmission(doc)}
                        title="Cancel Submission"
                      >
                        <Icon name="close" size={11} color="#EF4444" />
                        <Text style={[styles.miniCancelText, { color: "#EF4444" }]}>✕ Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.miniPreviewBtn, { backgroundColor: "#F59E0B15", borderColor: "#F59E0B44" }]}
                        onPress={() => setSelectedDocForDetail(doc)}
                      >
                        <Icon name="eye-outline" size={13} color="#D97706" />
                        <Text style={[styles.miniPreviewText, { color: "#D97706" }]}>Preview</Text>
                      </TouchableOpacity>
                    </View>
                  ) : doc.status === "rejected" ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <TouchableOpacity
                        style={[styles.miniCancelBtn, { backgroundColor: "#EF444412", borderColor: "#EF444433" }]}
                        onPress={() => handleCancelSubmission(doc)}
                        title="Remove Submission"
                      >
                        <Icon name="close" size={11} color="#EF4444" />
                        <Text style={[styles.miniCancelText, { color: "#EF4444" }]}>✕ Remove</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.miniUploadBtn, { backgroundColor: "#EF4444" }]}
                        onPress={() => {
                          setDocToUpload(doc);
                          setTempUploadedFile(null);
                          setUploadModalVisible(true);
                        }}
                      >
                        <Icon name="reload" size={13} color="#FFFFFF" />
                        <Text style={styles.miniUploadText}>Re-Upload</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[styles.miniUploadBtn, { backgroundColor: colors.primaryAccent }]}
                      onPress={() => {
                        setDocToUpload(doc);
                        setTempUploadedFile(null);
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
          </>
        )}
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
                    : selectedDocForDetail.status === "pending"
                    ? { backgroundColor: "#F59E0B18", borderColor: "#F59E0B44" }
                    : { backgroundColor: "#64748B18", borderColor: "#64748B44" },
                ]}
              >
                <Icon
                  name={
                    selectedDocForDetail.status === "verified"
                      ? "check-decagram"
                      : selectedDocForDetail.status === "rejected"
                      ? "alert-octagon"
                      : selectedDocForDetail.status === "pending"
                      ? "clock-alert-outline"
                      : "information-outline"
                  }
                  size={16}
                  color={
                    selectedDocForDetail.status === "verified"
                      ? "#10B981"
                      : selectedDocForDetail.status === "rejected"
                      ? "#EF4444"
                      : selectedDocForDetail.status === "pending"
                      ? "#F59E0B"
                      : "#64748B"
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
                          : selectedDocForDetail.status === "pending"
                          ? "#D97706"
                          : "#64748B",
                    },
                  ]}
                >
                  {selectedDocForDetail.status === "verified"
                    ? "DIGITALLY VERIFIED CREDENTIAL"
                    : selectedDocForDetail.status === "rejected"
                    ? "SUBMISSION REJECTED — ACTION REQUIRED"
                    : selectedDocForDetail.status === "pending"
                    ? "SUBMISSION PENDING ADMINISTRATIVE VERIFICATION"
                    : "UPLOAD REQUIRED FOR VERIFICATION"}
                </Text>
              </View>

              {/* Locked Notice when Pending Review */}
              {selectedDocForDetail.status === "pending" && (
                <View style={[styles.lockedReviewBox, { backgroundColor: "#F59E0B10", borderColor: "#F59E0B33" }]}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 3 }}>
                    <Icon name="lock" size={14} color="#D97706" />
                    <Text style={[styles.lockedReviewHeader, { color: "#D97706" }]}>Under Review (Upload Locked)</Text>
                  </View>
                  <Text style={[styles.lockedReviewText, { color: colors.secondaryText }]}>
                    This document is currently awaiting verification by institutional staff. You can view the submitted scan below. Upload is disabled until status updates.
                  </Text>
                </View>
              )}

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
              {selectedDocForDetail.fileUri && selectedDocForDetail.fileUri.startsWith("data:image") ? (
                <View style={{ marginVertical: 8, alignItems: "center" }}>
                  <Image
                    source={{ uri: selectedDocForDetail.fileUri }}
                    style={{ width: "100%", height: 140, borderRadius: 10, resizeMode: "cover" }}
                  />
                  <Text style={{ fontSize: 11, color: colors.secondaryText, marginTop: 4 }}>
                    📄 {selectedDocForDetail.fileName || "Uploaded Document Scan"}
                  </Text>
                </View>
              ) : selectedDocForDetail.isUploaded && selectedDocForDetail.fileName ? (
                <View style={[styles.detailPdfCard, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                  <Icon name="file-pdf-box" size={32} color="#EF4444" />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[styles.detailPdfTitle, { color: colors.primaryText }]} numberOfLines={1}>
                      {selectedDocForDetail.fileName}
                    </Text>
                    <Text style={[styles.detailPdfMeta, { color: colors.secondaryText }]}>
                      {selectedDocForDetail.fileSize || "Secured Vault Document"}
                    </Text>
                  </View>
                </View>
              ) : null}

              {/* Modal Actions */}
              <View style={styles.modalActionsRow}>
                {selectedDocForDetail.isUploaded && (
                  <TouchableOpacity
                    style={[styles.modalCancelBtn, { backgroundColor: "#EF444415", borderColor: "#EF444433" }]}
                    onPress={() => {
                      const doc = selectedDocForDetail;
                      handleCancelSubmission(doc);
                    }}
                  >
                    <Icon name="close-circle-outline" size={15} color="#EF4444" />
                    <Text style={[styles.modalCancelBtnText, { color: "#EF4444" }]}>✕ Cancel</Text>
                  </TouchableOpacity>
                )}

                {selectedDocForDetail.status === "rejected" || selectedDocForDetail.status === "not_submitted" ? (
                  <TouchableOpacity
                    style={[styles.modalShareBtn, { backgroundColor: colors.primaryAccent }]}
                    onPress={() => {
                      const doc = selectedDocForDetail;
                      setSelectedDocForDetail(null);
                      setDocToUpload(doc);
                      setTempUploadedFile(null);
                      setUploadModalVisible(true);
                    }}
                  >
                    <Icon name={selectedDocForDetail.status === "rejected" ? "reload" : "cloud-upload"} size={16} color="#FFFFFF" />
                    <Text style={styles.modalShareBtnText}>
                      {selectedDocForDetail.status === "rejected" ? "Re-Upload Document" : "Upload Document"}
                    </Text>
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
      {/* 6. REDESIGNED SCAN / UPLOAD DOCUMENT MODAL                                 */}
      {/* ========================================================================= */}
      {uploadModalVisible && docToUpload && (
        <Modal
          visible={uploadModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setUploadModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, styles.uploadModalRedesign, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
              {/* Modal Header */}
              <View style={styles.uploadModalHeader}>
                <View style={[styles.uploadIconBadge, { backgroundColor: (docToUpload.color || colors.primaryAccent) + "18" }]}>
                  <Icon name={docToUpload.icon || "cloud-upload"} size={22} color={docToUpload.color || colors.primaryAccent} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={[styles.uploadHeaderTag, { color: docToUpload.color || colors.primaryAccent }]}>
                      {docToUpload.category ? docToUpload.category.toUpperCase() : "CREDENTIAL"}
                    </Text>
                    {docToUpload.isMandatory && (
                      <Text style={styles.uploadMandatoryBadge}>MANDATORY</Text>
                    )}
                  </View>
                  <Text style={[styles.uploadModalTitle, { color: colors.primaryText }]} numberOfLines={1}>
                    {docToUpload.title}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.uploadCloseBtn}
                  onPress={() => {
                    setUploadModalVisible(false);
                    setTempUploadedFile(null);
                  }}
                >
                  <Icon name="close" size={20} color={colors.secondaryText} />
                </TouchableOpacity>
              </View>

              {/* Requirement & Guidelines Box */}
              <View style={[styles.uploadGuidelinesCard, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <Icon name="file-check-outline" size={15} color={colors.primaryAccent} />
                  <Text style={[styles.guidelineHeading, { color: colors.primaryText }]}>Upload Guidelines</Text>
                  <View style={styles.guidelineFormatBadge}>
                    <Text style={styles.guidelineFormatText}>PDF / JPG / PNG · Max 5MB</Text>
                  </View>
                </View>
                {docToUpload.instructions ? (
                  <Text style={[styles.guidelineText, { color: colors.secondaryText }]}>
                    ℹ️ {docToUpload.instructions}
                  </Text>
                ) : (
                  <Text style={[styles.guidelineText, { color: colors.secondaryText }]}>
                    Please ensure the document name, serial number, and institutional seal are clear and legible.
                  </Text>
                )}
              </View>

              {/* Source Option Title */}
              <Text style={[styles.uploadSectionTitle, { color: colors.secondaryText }]}>
                CHOOSE UPLOAD METHOD
              </Text>

              {/* 3 Source Options Strip */}
              <View style={styles.uploadOptionsGrid}>
                <TouchableOpacity
                  style={[styles.uploadTile, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}
                  onPress={() => handlePickDocument("camera")}
                  activeOpacity={0.8}
                >
                  <View style={[styles.tileIconCircle, { backgroundColor: "#4F46E518" }]}>
                    <Icon name="camera" size={20} color="#4F46E5" />
                  </View>
                  <Text style={[styles.tileTitle, { color: colors.primaryText }]}>Camera</Text>
                  <Text style={[styles.tileSub, { color: colors.secondaryText }]}>Scan photo</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.uploadTile, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}
                  onPress={() => handlePickDocument("gallery")}
                  activeOpacity={0.8}
                >
                  <View style={[styles.tileIconCircle, { backgroundColor: "#10B98118" }]}>
                    <Icon name="image-multiple" size={20} color="#10B981" />
                  </View>
                  <Text style={[styles.tileTitle, { color: colors.primaryText }]}>Gallery</Text>
                  <Text style={[styles.tileSub, { color: colors.secondaryText }]}>Photo library</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.uploadTile, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}
                  onPress={() => handlePickDocument("file")}
                  activeOpacity={0.8}
                >
                  <View style={[styles.tileIconCircle, { backgroundColor: "#EF444418" }]}>
                    <Icon name="file-pdf-box" size={20} color="#EF4444" />
                  </View>
                  <Text style={[styles.tileTitle, { color: colors.primaryText }]}>PDF / File</Text>
                  <Text style={[styles.tileSub, { color: colors.secondaryText }]}>E-Document</Text>
                </TouchableOpacity>
              </View>

              {/* Selected File Preview Strip */}
              {tempUploadedFile ? (
                <View style={[styles.selectedFileBox, { backgroundColor: colors.primaryBackground, borderColor: "#10B98155" }]}>
                  {tempUploadedFile.mimeType?.startsWith("image") && tempUploadedFile.uri ? (
                    <Image source={{ uri: tempUploadedFile.uri }} style={styles.selectedFileThumbnail} />
                  ) : (
                    <View style={styles.selectedPdfThumb}>
                      <Icon name="file-pdf-box" size={28} color="#EF4444" />
                    </View>
                  )}
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[styles.selectedFileName, { color: colors.primaryText }]} numberOfLines={1}>
                      {tempUploadedFile.name}
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
                      <Text style={[styles.selectedFileSize, { color: colors.secondaryText }]}>
                        {tempUploadedFile.size}
                      </Text>
                      <Text style={styles.readyBadge}>✓ Ready to Submit</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.changeFileBtn}
                    onPress={() => setTempUploadedFile(null)}
                  >
                    <Icon name="close-circle" size={20} color={colors.secondaryText} />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={[styles.emptyFileBox, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                  <Icon name="cloud-upload-outline" size={24} color={colors.disabledText} />
                  <Text style={[styles.emptyFileText, { color: colors.disabledText }]}>
                    Select a photo or PDF to preview before submitting
                  </Text>
                </View>
              )}

              {/* Security Banner */}
              <View style={styles.securityTrustRow}>
                <Icon name="shield-lock-outline" size={13} color="#10B981" />
                <Text style={[styles.securityTrustText, { color: colors.secondaryText }]}>
                  Secured with 256-bit encryption · Stored in MongoDB Vault
                </Text>
              </View>

              {/* Modal Action Buttons */}
              <View style={styles.modalActionsRow}>
                <TouchableOpacity
                  style={[
                    styles.modalSubmitBtn,
                    {
                      backgroundColor: tempUploadedFile ? colors.primaryAccent : colors.disabledText,
                    },
                  ]}
                  onPress={handleConfirmUpload}
                  disabled={isSubmittingDoc || !tempUploadedFile}
                >
                  {isSubmittingDoc ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Icon name="cloud-check" size={18} color="#FFFFFF" />
                      <Text style={styles.modalSubmitBtnText}>Upload & Submit</Text>
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
    miniPreviewBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      borderWidth: 1,
    },
    miniPreviewText: {
      fontSize: 11,
      fontWeight: "800",
    },
    miniCancelBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      paddingHorizontal: 7,
      paddingVertical: 4,
      borderRadius: 6,
      borderWidth: 1,
    },
    miniCancelText: {
      fontSize: 10.5,
      fontWeight: "800",
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
    lockedReviewBox: {
      padding: 10,
      borderRadius: 10,
      borderWidth: 1,
      marginBottom: 12,
    },
    lockedReviewHeader: {
      fontSize: 11.5,
      fontWeight: "800",
    },
    lockedReviewText: {
      fontSize: 11,
      lineHeight: 15,
      fontWeight: "500",
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
      marginBottom: 10,
    },
    modalRemarksText: {
      fontSize: 11,
      fontWeight: "500",
      fontStyle: "italic",
    },
    detailPdfCard: {
      flexDirection: "row",
      alignItems: "center",
      padding: 10,
      borderRadius: 10,
      borderWidth: 1,
      marginVertical: 8,
    },
    detailPdfTitle: {
      fontSize: 12,
      fontWeight: "700",
    },
    detailPdfMeta: {
      fontSize: 10.5,
      marginTop: 2,
    },
    modalActionsRow: {
      flexDirection: "row",
      gap: 10,
      marginTop: 6,
    },
    modalShareBtn: {
      flex: 1.2,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 11,
      borderRadius: 12,
    },
    modalShareBtnText: {
      color: "#FFFFFF",
      fontSize: 12,
      fontWeight: "800",
    },
    modalCancelBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
      paddingVertical: 11,
      borderRadius: 12,
      borderWidth: 1,
    },
    modalCancelBtnText: {
      fontSize: 12,
      fontWeight: "800",
    },
    modalCloseBtn: {
      flex: 0.8,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 11,
      borderRadius: 12,
      borderWidth: 1,
    },
    modalCloseBtnText: {
      fontSize: 12,
      fontWeight: "700",
    },

    /* ========================================================================= */
    /* REDESIGNED UPLOAD MODAL STYLES                                            */
    /* ========================================================================= */
    uploadModalRedesign: {
      padding: 16,
      borderRadius: 22,
    },
    uploadModalHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 12,
    },
    uploadIconBadge: {
      width: 44,
      height: 44,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
    },
    uploadHeaderTag: {
      fontSize: 10,
      fontWeight: "900",
      letterSpacing: 0.5,
    },
    uploadMandatoryBadge: {
      fontSize: 9,
      fontWeight: "900",
      backgroundColor: "#EF444418",
      color: "#EF4444",
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderRadius: 4,
    },
    uploadModalTitle: {
      fontSize: 14,
      fontWeight: "800",
      marginTop: 2,
    },
    uploadCloseBtn: {
      padding: 6,
    },
    uploadGuidelinesCard: {
      padding: 10,
      borderRadius: 10,
      borderWidth: 1,
      marginBottom: 12,
    },
    guidelineHeading: {
      fontSize: 11.5,
      fontWeight: "800",
      flex: 1,
    },
    guidelineFormatBadge: {
      backgroundColor: "rgba(99, 102, 241, 0.12)",
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    guidelineFormatText: {
      fontSize: 9.5,
      fontWeight: "800",
      color: "#6366F1",
    },
    guidelineText: {
      fontSize: 11,
      lineHeight: 15,
      fontWeight: "500",
    },
    uploadSectionTitle: {
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 0.8,
      marginBottom: 8,
      marginLeft: 2,
    },
    uploadOptionsGrid: {
      flexDirection: "row",
      gap: 8,
      marginBottom: 12,
    },
    uploadTile: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 12,
      paddingHorizontal: 4,
      borderRadius: 12,
      borderWidth: 1,
    },
    tileIconCircle: {
      width: 38,
      height: 38,
      borderRadius: 19,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 6,
    },
    tileTitle: {
      fontSize: 11.5,
      fontWeight: "800",
    },
    tileSub: {
      fontSize: 9.5,
      fontWeight: "500",
      marginTop: 1,
    },
    selectedFileBox: {
      flexDirection: "row",
      alignItems: "center",
      padding: 10,
      borderRadius: 12,
      borderWidth: 1.5,
      marginBottom: 10,
    },
    selectedFileThumbnail: {
      width: 44,
      height: 44,
      borderRadius: 8,
      resizeMode: "cover",
    },
    selectedPdfThumb: {
      width: 44,
      height: 44,
      borderRadius: 8,
      backgroundColor: "#EF444415",
      justifyContent: "center",
      alignItems: "center",
    },
    selectedFileName: {
      fontSize: 12,
      fontWeight: "800",
    },
    selectedFileSize: {
      fontSize: 10.5,
      fontWeight: "500",
    },
    readyBadge: {
      fontSize: 10,
      fontWeight: "800",
      color: "#10B981",
    },
    changeFileBtn: {
      padding: 4,
    },
    emptyFileBox: {
      paddingVertical: 14,
      paddingHorizontal: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderStyle: "dashed",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      marginBottom: 10,
    },
    emptyFileText: {
      fontSize: 11,
      fontWeight: "600",
      textAlign: "center",
    },
    securityTrustRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
      marginBottom: 12,
    },
    securityTrustText: {
      fontSize: 10,
      fontWeight: "600",
    },
    modalSubmitBtn: {
      flex: 1.2,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 12,
      borderRadius: 12,
    },
    modalSubmitBtnText: {
      color: "#FFFFFF",
      fontSize: 12,
      fontWeight: "800",
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

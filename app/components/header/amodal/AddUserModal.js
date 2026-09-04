import React, { useState, useEffect, useRef } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Switch,
  Animated,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import * as DocumentPicker from "expo-document-picker";
import * as XLSX from "xlsx";
import SuccessAnimation from "../../../utils/SuccessAnimation";
import { api } from "../../../services/api";
import { useTheme } from "../../../context/ThemeContext";
import { showToast } from "../../../utils/toastService";
import AddressAutocompleteInput from "../../common/AddressAutocompleteInput";

/* ---------- Static lists & mappings ---------- */
const ROLES = [
  { value: "student", label: "Student", icon: "school-outline" },
  { value: "staff", label: "Faculty", icon: "account-tie-outline" },
  { value: "parent", label: "Parent", icon: "human-male-female-child" },
  { value: "admin", label: "Admin", icon: "shield-account-outline" },
];

const DEPARTMENTS = [
  { label: "Computer Science & Eng (CSE)", value: "CSE", short: "CSE" },
  { label: "Artificial Intelligence & DS (AI-DS)", value: "AI-DS", short: "AD" },
  { label: "Information Technology (IT)", value: "IT", short: "IT" },
  { label: "Electronics & Comm (ECE)", value: "ECE", short: "ECE" },
  { label: "Electrical & Electronics (EEE)", value: "EEE", short: "EEE" },
  { label: "Mechanical Engineering (MECH)", value: "Mechanical", short: "ME" },
  { label: "Civil Engineering (CIVIL)", value: "Civil", short: "CE" },
];

const STAFF_POSITIONS = [
  { label: "Head of Department (HOD)", value: "HOD", short: "HD" },
  { label: "Professor", value: "Professor", short: "PR" },
  { label: "Associate Professor", value: "Associate Professor", short: "AP" },
  { label: "Assistant Professor", value: "Assistant Professor", short: "AS" },
  { label: "Lab Instructor", value: "Lab Instructor", short: "LI" },
  { label: "Department Coordinator", value: "Coordinator", short: "CD" },
  { label: "Administrative Officer", value: "Officer", short: "AO" },
  { label: "Warden", value: "Warden", short: "WD" },
];

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];
const GENDERS = ["Male", "Female", "Other"];
const YEARS = ["I Year", "II Year", "III Year", "IV Year"];
const SEMESTERS = ["Sem I", "Sem II", "Sem III", "Sem IV", "Sem V", "Sem VI", "Sem VII", "Sem VIII"];
const SECTIONS = ["A", "B", "C"];
const RELATIONS = ["Father", "Mother", "Guardian"];

const ADMIN_ROLES = [
  { label: "Super Administrator", value: "super_admin" },
  { label: "Academic Director", value: "academic_manager" },
  { label: "Attendance & Exam Controller", value: "controller" },
  { label: "Finance & Accounts Head", value: "finance_manager" },
];

const PERMISSIONS_LIST = [
  { label: "Create & Edit Users", value: "manage_users" },
  { label: "Manage Attendance Records", value: "manage_attendance" },
  { label: "Enter & Publish Grades", value: "manage_exams" },
  { label: "Manage Fee Invoices", value: "manage_fees" },
  { label: "Broadcast Campus Notices", value: "manage_notices" },
  { label: "System Config & Backups", value: "system_config" },
];

/* Sample Multi-Role CSV Template for quick load */
const SAMPLE_CSV_TEXT = `name,email,phone,role,password`;

/* Helper: find highest sequence for IDs */
async function getNextSequence(collectionName, prefix) {
  try {
    const res = await api.get(`/${collectionName}`);
    const list = res?.data || [];
    let maxSeq = 0;
    list.forEach((d) => {
      const id = (d.id || d.roll || d.rollNo || d.staffId || d.adminId || d.parentId || "").toString();
      if (id.startsWith(prefix)) {
        const remain = id.slice(prefix.length);
        const match = remain.match(/\d+$/);
        if (match) {
          const n = parseInt(match[0], 10);
          if (!isNaN(n) && n > maxSeq) maxSeq = n;
        }
      }
    });
    return maxSeq + 1;
  } catch (e) {
    console.warn("getNextSequence error", e);
    return 1;
  }
}

const twoDigitYear = () => String(new Date().getFullYear()).slice(-2);
const padNumber = (n, length = 3) => String(n).padStart(length, "0");

const generateStudentId = async (section, deptShort, isLateral) => {
  const yy = twoDigitYear();
  const sec = section || "A";
  const ds = deptShort || "CSE";
  if (isLateral) {
    const prefix = `${yy}${sec}${ds}L`;
    const next = await getNextSequence("students", prefix);
    return `${prefix}${String(next).padStart(2, "0")}`;
  } else {
    const prefix = `${yy}${sec}${ds}`;
    const next = await getNextSequence("students", prefix);
    return `${prefix}${padNumber(next, 3)}`;
  }
};

const generateStaffId = async (staffDeptShort, positionShort) => {
  const ds = staffDeptShort || "CSE";
  const ps = positionShort || "AP";
  const prefix = `STF${ds}${ps}`;
  const next = await getNextSequence("staff", prefix);
  return `${prefix}${padNumber(next, 3)}`;
};

const generateAdminId = async () => {
  const yy = twoDigitYear();
  const prefix = `ADM${yy}`;
  const next = await getNextSequence("admins", prefix);
  return `${prefix}${padNumber(next, 3)}`;
};

const generateParentId = async (studentId) => {
  const cleanRoll = (studentId || "STD").trim().replace(/[^a-zA-Z0-9]/g, "");
  const prefix = `PAR${cleanRoll}`;
  const next = await getNextSequence("parents", prefix);
  return `${prefix}${next}`;
};

export default function AddUserModal({ visible, onClose }) {
  const { colors } = useTheme();

  // Mode: "single" | "bulk"
  const [activeTab, setActiveTab] = useState("single");

  // Single Role Selection
  const [role, setRole] = useState("student");

  // Common User Info
  const [name, setName] = useState("");
  const [customId, setCustomId] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("edunex123");
  const [createLoginAccount, setCreateLoginAccount] = useState(true);
  const [gender, setGender] = useState("Male");
  const [bloodGroup, setBloodGroup] = useState("O+");
  const [address, setAddress] = useState("");

  // Student Specific
  const [dept, setDept] = useState("CSE");
  const [deptShort, setDeptShort] = useState("CSE");
  const [year, setYear] = useState("I Year");
  const [semester, setSemester] = useState("Sem I");
  const [section, setSection] = useState("A");
  const [dob, setDob] = useState("2006-05-15");
  const [isLateral, setIsLateral] = useState(false);
  const [isHostel, setIsHostel] = useState(false);

  // Staff Specific
  const [staffDept, setStaffDept] = useState("CSE");
  const [staffDeptShort, setStaffDeptShort] = useState("CSE");
  const [position, setPosition] = useState("Assistant Professor");
  const [positionShort, setPositionShort] = useState("AS");
  const [qualification, setQualification] = useState("M.Tech, Ph.D");
  const [specialization, setSpecialization] = useState("Machine Learning & Cloud");

  // Parent Specific
  const [wardRoll, setWardRoll] = useState("");
  const [relation, setRelation] = useState("Father");
  const [occupation, setOccupation] = useState("");

  // Admin Specific
  const [adminRole, setAdminRole] = useState("academic_manager");
  const [permissions, setPermissions] = useState(["manage_users", "manage_attendance", "manage_exams"]);

  // Picker States
  const [pickerModal, setPickerModal] = useState({ visible: false, title: "", options: [], onSelect: null });

  // Processing state
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  /* ----------------- BULK IMPORT STATES ----------------- */
  const [bulkFileName, setBulkFileName] = useState("");
  const [parsedRows, setParsedRows] = useState([]);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0, successCount: 0, failCount: 0 });
  const [pastedCsvText, setPastedCsvText] = useState("");
  const [showPasteBox, setShowPasteBox] = useState(false);
  const [defaultBulkPassword, setDefaultBulkPassword] = useState("edunex123");

  // Sync Dept & Position short codes
  useEffect(() => {
    const d = DEPARTMENTS.find((x) => x.value === dept);
    setDeptShort(d ? d.short : "CSE");
  }, [dept]);

  useEffect(() => {
    const d = DEPARTMENTS.find((x) => x.value === staffDept);
    setStaffDeptShort(d ? d.short : "CSE");
  }, [staffDept]);

  useEffect(() => {
    const p = STAFF_POSITIONS.find((x) => x.value === position);
    setPositionShort(p ? p.short : "AS");
  }, [position]);

  // Animation hooks for role pills and form transitions
  const rolePillScales = useRef({
    student: new Animated.Value(1),
    staff: new Animated.Value(1),
    parent: new Animated.Value(1),
    admin: new Animated.Value(1),
  }).current;

  const roleTransitionFade = useRef(new Animated.Value(1)).current;
  const roleTransitionTranslateY = useRef(new Animated.Value(0)).current;
  const roleTransitionScale = useRef(new Animated.Value(1)).current;

  const tabTransitionFade = useRef(new Animated.Value(1)).current;
  const tabTransitionTranslateY = useRef(new Animated.Value(0)).current;

  const handleRoleSelect = (selectedRole) => {
    if (selectedRole === role) return;

    const scaleAnim = rolePillScales[selectedRole];
    if (scaleAnim) {
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 0.86, duration: 80, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, friction: 3.5, tension: 70, useNativeDriver: true }),
      ]).start();
    }

    roleTransitionFade.setValue(0);
    roleTransitionTranslateY.setValue(14);
    roleTransitionScale.setValue(0.96);
    setRole(selectedRole);

    Animated.parallel([
      Animated.timing(roleTransitionFade, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(roleTransitionTranslateY, { toValue: 0, friction: 6, tension: 55, useNativeDriver: true }),
      Animated.spring(roleTransitionScale, { toValue: 1, friction: 6, tension: 55, useNativeDriver: true }),
    ]).start();
  };

  const handleTabSwitch = (tab) => {
    if (tab === activeTab) return;
    tabTransitionFade.setValue(0);
    tabTransitionTranslateY.setValue(10);
    setActiveTab(tab);
    Animated.parallel([
      Animated.timing(tabTransitionFade, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.spring(tabTransitionTranslateY, { toValue: 0, friction: 6, tension: 60, useNativeDriver: true }),
    ]).start();
  };

  const openPicker = (title, options, onSelect) => {
    setPickerModal({ visible: true, title, options, onSelect });
  };

  const togglePermission = (perm) => {
    setPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  };

  const clearForm = () => {
    setName("");
    setCustomId("");
    setEmail("");
    setMobile("");
    setPassword("edunex123");
    setAddress("");
    setWardRoll("");
    setOccupation("");
  };

  const validate = () => {
    if (!name.trim()) {
      showToast("Please enter user's full name", "warning");
      return false;
    }
    if (!email.trim() || !email.includes("@")) {
      showToast("Please enter a valid email address", "warning");
      return false;
    }
    if (!mobile.trim()) {
      showToast("Please enter mobile phone number", "warning");
      return false;
    }
    if (role === "parent" && !wardRoll.trim()) {
      showToast("Please enter the Ward's Student Roll Number", "warning");
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);

    try {
      let finalId = customId.trim();

      /* 1. STUDENT */
      if (role === "student") {
        if (!finalId) finalId = await generateStudentId(section, deptShort, isLateral);

        await api.post("/students", {
          id: finalId,
          roll: finalId,
          rollNo: finalId,
          name: name.trim(),
          email: email.trim().toLowerCase(),
          mobile: mobile.trim(),
          phone: mobile.trim(),
          address: address.trim(),
          gender,
          bloodGroup,
          dob,
          dept,
          department: dept,
          deptShort,
          year,
          semester,
          section,
          lateral: isLateral,
          hostel: isHostel,
          status: "active",
        });
      }

      /* 2. STAFF / FACULTY */
      else if (role === "staff") {
        if (!finalId) finalId = await generateStaffId(staffDeptShort, positionShort);

        await api.post("/staff", {
          id: finalId,
          staffId: finalId,
          name: name.trim(),
          email: email.trim().toLowerCase(),
          mobile: mobile.trim(),
          phone: mobile.trim(),
          address: address.trim(),
          gender,
          bloodGroup,
          staffDept,
          department: staffDept,
          staffDeptShort,
          position,
          designation: position,
          positionShort,
          qualification,
          specialization,
          status: "active",
        });
      }

      /* 3. PARENT */
      else if (role === "parent") {
        if (!finalId) finalId = await generateParentId(wardRoll.trim());

        await api.post("/parents", {
          id: finalId,
          parentId: finalId,
          name: name.trim(),
          email: email.trim().toLowerCase(),
          mobile: mobile.trim(),
          phone: mobile.trim(),
          address: address.trim(),
          studentID: wardRoll.trim().toUpperCase(),
          wardRollNo: wardRoll.trim().toUpperCase(),
          relation,
          occupation,
          status: "active",
        });
      }

      /* 4. ADMIN */
      else if (role === "admin") {
        if (!finalId) finalId = await generateAdminId();

        await api.post("/admins", {
          id: finalId,
          adminId: finalId,
          name: name.trim(),
          email: email.trim().toLowerCase(),
          mobile: mobile.trim(),
          phone: mobile.trim(),
          adminRole,
          permissions,
          status: "active",
        });
      }

      /* 5. AUTO-PROVISION LOGIN CREDENTIALS IN MONGODB */
      if (createLoginAccount) {
        try {
          const authRole = role === "student" ? "student" : role === "staff" ? "staff" : role === "parent" ? "parent" : "admin";
          await api.post("/auth/register", {
            username: finalId.toLowerCase(),
            password: password.trim() || "edunex123",
            role: authRole,
            email: email.trim().toLowerCase(),
            profile: {
              name: name.trim(),
              mobile: mobile.trim(),
              gender,
              department: role === "student" ? dept : role === "staff" ? staffDept : undefined,
            },
          });
        } catch (authErr) {
          console.log("Auto-provision login info:", authErr?.message || authErr);
        }
      }

      setLoading(false);
      setSuccess(true);
      showToast(`User created: ${name} (${finalId})`, "success");
      clearForm();

      setTimeout(() => {
        setSuccess(false);
        if (onClose) onClose();
      }, 1200);
    } catch (e) {
      setLoading(false);
      console.log("AddUserModal submission error:", e);
      showToast(e?.message || "Failed to create user record", "error");
    }
  };

  /* ----------------- BULK EXCEL / CSV PARSING LOGIC ----------------- */
  const normalizeParsedRows = (rawList) => {
    return rawList
      .map((r, index) => {
        // Look up key variations case-insensitively
        const getVal = (...keys) => {
          for (const k of keys) {
            for (const rowKey of Object.keys(r)) {
              if (rowKey.toLowerCase().replace(/[^a-z0-9]/g, "") === k.toLowerCase().replace(/[^a-z0-9]/g, "")) {
                return String(r[rowKey] || "").trim();
              }
            }
          }
          return "";
        };

        const rawRole = getVal("role", "userrole", "type").toLowerCase();
        let normalizedRole = "student";
        if (rawRole.includes("staff") || rawRole.includes("fac") || rawRole.includes("prof") || rawRole.includes("teach")) {
          normalizedRole = "staff";
        } else if (rawRole.includes("par")) {
          normalizedRole = "parent";
        } else if (rawRole.includes("adm")) {
          normalizedRole = "admin";
        }

        const rawName = getVal("name", "fullname", "studentname", "staffname", "username") || `User ${index + 1}`;
        const rawEmail = getVal("email", "mail", "emailaddress") || `${rawName.toLowerCase().replace(/[^a-z0-9]/g, "")}@edunex.edu`;
        const rawMobile = getVal("mobile", "phone", "contact", "mobilenumber", "phonenumber") || "";
        const rawId = getVal("id", "roll", "rollno", "staffid", "adminid", "parentid", "userid");
        const rawDept = getVal("department", "dept", "branch") || "CSE";
        const rawYear = getVal("year", "academicyear") || "I Year";
        const rawSem = getVal("semester", "sem") || "Sem I";
        const rawSec = getVal("section", "sec") || "A";
        const rawPos = getVal("position", "designation") || "Assistant Professor";
        const rawWard = getVal("wardroll", "wardrollno", "ward", "studentid");
        const rawRel = getVal("relation", "relationship") || "Parent";
        const rawPass = getVal("password", "pass") || defaultBulkPassword || "edunex123";

        return {
          key: `row_${index}_${Date.now()}`,
          name: rawName,
          role: normalizedRole,
          email: rawEmail,
          mobile: rawMobile,
          id: rawId,
          dept: rawDept,
          year: rawYear,
          semester: rawSem,
          section: rawSec,
          position: rawPos,
          wardRoll: rawWard,
          relation: rawRel,
          password: rawPass,
          valid: Boolean(rawName && rawEmail),
        };
      })
      .filter((r) => r.name.trim().length > 0);
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "application/vnd.ms-excel",
          "text/csv",
          "text/comma-separated-values",
          "text/plain",
          "*/*",
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const asset = result.assets[0];
      setBulkFileName(asset.name || "spreadsheet.xlsx");

      const response = await fetch(asset.uri);
      const blob = await response.blob();

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: "array" });
          const firstSheetName = workbook.SheetNames[0];
          const rawJson = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName], { defval: "" });

          const normalized = normalizeParsedRows(rawJson);
          setParsedRows(normalized);
          showToast(`Parsed ${normalized.length} rows from ${asset.name}`, "success");
        } catch (parseErr) {
          console.log("XLSX parse error:", parseErr);
          showToast("Failed to parse sheet. Please ensure valid Excel/CSV format.", "error");
        }
      };
      reader.readAsArrayBuffer(blob);
    } catch (e) {
      console.log("DocumentPicker error:", e);
      showToast("Error picking file", "error");
    }
  };

  const handleParsePastedCsv = () => {
    if (!pastedCsvText.trim()) {
      showToast("Please paste CSV data or load sample", "warning");
      return;
    }
    try {
      const workbook = XLSX.read(pastedCsvText.trim(), { type: "string" });
      const firstSheetName = workbook.SheetNames[0];
      const rawJson = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName], { defval: "" });
      const normalized = normalizeParsedRows(rawJson);
      setParsedRows(normalized);
      setBulkFileName("Pasted Data Sheet");
      setShowPasteBox(false);
      showToast(`Parsed ${normalized.length} user records from CSV!`, "success");
    } catch (err) {
      console.log("Parse pasted CSV err:", err);
      showToast("Error reading pasted CSV text", "error");
    }
  };

  const handleLoadSampleData = () => {
    setPastedCsvText(SAMPLE_CSV_TEXT);
    const workbook = XLSX.read(SAMPLE_CSV_TEXT, { type: "string" });
    const firstSheetName = workbook.SheetNames[0];
    const rawJson = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName], { defval: "" });
    const normalized = normalizeParsedRows(rawJson);
    setParsedRows(normalized);
    setBulkFileName("Sample_MultiRole_Template.csv");
    setShowPasteBox(false);
    showToast("Loaded sample dataset with Students, Faculty, Parents & Admin!", "info");
  };

  /* ----------------- BATCH SUBMISSION TO MONGODB ----------------- */
  const handleBatchImport = async () => {
    if (!parsedRows || parsedRows.length === 0) {
      showToast("No user records to import", "warning");
      return;
    }

    setBulkImporting(true);
    setBulkProgress({ current: 0, total: parsedRows.length, successCount: 0, failCount: 0 });

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < parsedRows.length; i++) {
      const item = parsedRows[i];
      setBulkProgress((prev) => ({ ...prev, current: i + 1 }));

      try {
        let finalId = item.id ? item.id.trim().toUpperCase() : "";

        /* 1. Insert into MongoDB collection based on role */
        if (item.role === "student") {
          if (!finalId) finalId = await generateStudentId(item.section, item.dept, false);
          await api.post("/students", {
            id: finalId,
            roll: finalId,
            rollNo: finalId,
            name: item.name,
            email: item.email.toLowerCase(),
            mobile: item.mobile,
            phone: item.mobile,
            dept: item.dept,
            department: item.dept,
            year: item.year,
            semester: item.semester,
            section: item.section,
            status: "active",
          });
        } else if (item.role === "staff") {
          if (!finalId) finalId = await generateStaffId(item.dept, "AS");
          await api.post("/staff", {
            id: finalId,
            staffId: finalId,
            name: item.name,
            email: item.email.toLowerCase(),
            mobile: item.mobile,
            phone: item.mobile,
            staffDept: item.dept,
            department: item.dept,
            position: item.position,
            designation: item.position,
            status: "active",
          });
        } else if (item.role === "parent") {
          if (!finalId) finalId = await generateParentId(item.wardRoll || "STD");
          await api.post("/parents", {
            id: finalId,
            parentId: finalId,
            name: item.name,
            email: item.email.toLowerCase(),
            mobile: item.mobile,
            phone: item.mobile,
            studentID: (item.wardRoll || "").toUpperCase(),
            wardRollNo: (item.wardRoll || "").toUpperCase(),
            relation: item.relation || "Parent",
            status: "active",
          });
        } else if (item.role === "admin") {
          if (!finalId) finalId = await generateAdminId();
          await api.post("/admins", {
            id: finalId,
            adminId: finalId,
            name: item.name,
            email: item.email.toLowerCase(),
            mobile: item.mobile,
            phone: item.mobile,
            adminRole: "academic_manager",
            permissions: ["manage_users", "manage_attendance", "manage_exams"],
            status: "active",
          });
        }

        /* 2. Provision Auth Login in MongoDB (/auth/register) */
        try {
          await api.post("/auth/register", {
            username: finalId.toLowerCase(),
            password: item.password || defaultBulkPassword || "edunex123",
            role: item.role,
            email: item.email.toLowerCase(),
            profile: {
              name: item.name,
              mobile: item.mobile,
              department: item.dept,
            },
          });
        } catch (authErr) {
          console.log("Auth user provision note:", authErr?.message || authErr);
        }

        successCount++;
        setBulkProgress((prev) => ({ ...prev, successCount }));
      } catch (rowErr) {
        console.log(`Failed importing ${item.name}:`, rowErr?.message || rowErr);
        failCount++;
        setBulkProgress((prev) => ({ ...prev, failCount }));
      }
    }

    setBulkImporting(false);
    showToast(`✅ Bulk Import Completed: ${successCount} added, ${failCount} failed`, "success");
    setSuccess(true);

    setTimeout(() => {
      setSuccess(false);
      setParsedRows([]);
      setBulkFileName("");
      if (onClose) onClose();
    }, 1500);
  };

  /* Role Summary Counters for Preview */
  const studentCount = parsedRows.filter((r) => r.role === "student").length;
  const staffCount = parsedRows.filter((r) => r.role === "staff").length;
  const parentCount = parsedRows.filter((r) => r.role === "parent").length;
  const adminCount = parsedRows.filter((r) => r.role === "admin").length;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.modalCard, { backgroundColor: colors.cardBackground }]}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.headerTitleWrap}>
              <View style={[styles.iconCircle, { backgroundColor: colors.primaryAccent + "18" }]}>
                <Icon
                  name={activeTab === "single" ? "account-plus-outline" : "file-excel-box"}
                  size={24}
                  color={colors.primaryAccent}
                />
              </View>
              <View>
                <Text style={[styles.modalHeading, { color: colors.primaryText }]}>
                  {activeTab === "single" ? "Add Single Campus User" : "Bulk Excel / CSV Import"}
                </Text>
                <Text style={[styles.modalSub, { color: colors.secondaryText }]}>
                  Multi-role user creation & MongoDB database insertion
                </Text>
              </View>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Icon name="close-circle" size={26} color={colors.secondaryText} />
            </TouchableOpacity>
          </View>

          {/* Mode Switch Tabs: Single vs Bulk Excel */}
          <View style={[styles.tabSelectorRow, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
            <TouchableOpacity
              style={[
                styles.tabBtn,
                activeTab === "single" && { backgroundColor: colors.primaryAccent, elevation: 2 },
              ]}
              onPress={() => handleTabSwitch("single")}
              activeOpacity={0.8}
            >
              <Icon name="account-plus" size={16} color={activeTab === "single" ? "#fff" : colors.secondaryText} />
              <Text style={[styles.tabBtnText, { color: activeTab === "single" ? "#fff" : colors.secondaryText }]}>
                Single Form
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tabBtn,
                activeTab === "bulk" && { backgroundColor: colors.primaryAccent, elevation: 2 },
              ]}
              onPress={() => handleTabSwitch("bulk")}
              activeOpacity={0.8}
            >
              <Icon name="file-excel-box" size={16} color={activeTab === "bulk" ? "#fff" : colors.secondaryText} />
              <Text style={[styles.tabBtnText, { color: activeTab === "bulk" ? "#fff" : colors.secondaryText }]}>
                Excel / CSV Sheet Import
              </Text>
            </TouchableOpacity>
          </View>

          {/* ========================================================================= */}
          {/* TAB 1: SINGLE USER CREATION FORM                                          */}
          {/* ========================================================================= */}
          {activeTab === "single" ? (
            <Animated.View style={{ flex: 1, opacity: tabTransitionFade, transform: [{ translateY: tabTransitionTranslateY }] }}>
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollBody}
                keyboardShouldPersistTaps="handled"
              >
                {/* 🎯 PROMINENT ROLE SELECTION HEADER */}
                <View style={styles.roleHeaderSection}>
                  <Text style={[styles.sectionTitle, { color: colors.primaryAccent }]}>
                    Select User Role:
                  </Text>
                  <View style={[styles.roleBar, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                    {ROLES.map((r) => {
                      const active = role === r.value;
                      return (
                        <Animated.View
                          key={r.value}
                          style={{
                            flex: 1,
                            transform: [{ scale: rolePillScales[r.value] || 1 }],
                          }}
                        >
                          <TouchableOpacity
                            onPress={() => handleRoleSelect(r.value)}
                            style={[
                              styles.rolePill,
                              active
                                ? { backgroundColor: colors.primaryAccent, elevation: 3 }
                                : { backgroundColor: colors.cardBackground, borderWidth: 1, borderColor: colors.divider },
                            ]}
                            activeOpacity={0.8}
                          >
                            <Icon
                              name={r.icon}
                              size={16}
                              color={active ? "#FFFFFF" : colors.primaryAccent}
                            />
                            <Text
                              style={[
                                styles.rolePillText,
                                { color: active ? "#FFFFFF" : colors.primaryText },
                              ]}
                              numberOfLines={1}
                            >
                              {r.label}
                            </Text>
                          </TouchableOpacity>
                        </Animated.View>
                      );
                    })}
                  </View>
                </View>

                {/* SECTION 1: PERSONAL & CONTACT */}
                <Text style={[styles.sectionTitle, { color: colors.primaryAccent }]}>1. Profile & Contact Info</Text>

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: colors.primaryText }]}>Full Name *</Text>
                  <View style={[styles.inputRow, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                    <Icon name="account-outline" size={20} color={colors.secondaryText} />
                    <TextInput
                      style={[styles.input, { color: colors.primaryText }]}
                      placeholder="e.g. Adarsh Sharma"
                      placeholderTextColor={colors.secondaryText}
                      value={name}
                      onChangeText={setName}
                    />
                  </View>
                </View>

                <View style={styles.twoColRow}>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={[styles.inputLabel, { color: colors.primaryText }]}>Email Address *</Text>
                    <View style={[styles.inputRow, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                      <Icon name="email-outline" size={18} color={colors.secondaryText} />
                      <TextInput
                        style={[styles.input, { color: colors.primaryText }]}
                        placeholder="user@edunex.edu"
                        placeholderTextColor={colors.secondaryText}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        value={email}
                        onChangeText={setEmail}
                      />
                    </View>
                  </View>

                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={[styles.inputLabel, { color: colors.primaryText }]}>Mobile Number *</Text>
                    <View style={[styles.inputRow, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                      <Icon name="phone-outline" size={18} color={colors.secondaryText} />
                      <TextInput
                        style={[styles.input, { color: colors.primaryText }]}
                        placeholder="9876543210"
                        placeholderTextColor={colors.secondaryText}
                        keyboardType="phone-pad"
                        value={mobile}
                        onChangeText={setMobile}
                      />
                    </View>
                  </View>
                </View>

                <View style={styles.twoColRow}>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={[styles.inputLabel, { color: colors.primaryText }]}>Gender</Text>
                    <TouchableOpacity
                      style={[styles.inputRow, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}
                      onPress={() => openPicker("Select Gender", GENDERS, setGender)}
                    >
                      <Icon name="gender-male-female" size={18} color={colors.secondaryText} />
                      <Text style={[styles.inputText, { color: colors.primaryText }]}>{gender}</Text>
                      <Icon name="chevron-down" size={18} color={colors.secondaryText} />
                    </TouchableOpacity>
                  </View>

                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={[styles.inputLabel, { color: colors.primaryText }]}>Blood Group</Text>
                    <TouchableOpacity
                      style={[styles.inputRow, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}
                      onPress={() => openPicker("Select Blood Group", BLOOD_GROUPS, setBloodGroup)}
                    >
                      <Icon name="water-outline" size={18} color="#EF4444" />
                      <Text style={[styles.inputText, { color: colors.primaryText }]}>{bloodGroup}</Text>
                      <Icon name="chevron-down" size={18} color={colors.secondaryText} />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: colors.primaryText }]}>Residential Address</Text>
                  <AddressAutocompleteInput
                    value={address}
                    onChangeText={setAddress}
                    placeholder="Type street, area, city or pincode..."
                  />
                </View>

                {/* SECTION 2: ROLE-SPECIFIC ATTRIBUTES */}
                <Animated.View
                  style={{
                    opacity: roleTransitionFade,
                    transform: [
                      { translateY: roleTransitionTranslateY },
                      { scale: roleTransitionScale },
                    ],
                  }}
                >
                  {role === "student" && (
                    <>
                      <Text style={[styles.sectionTitle, { color: colors.primaryAccent, marginTop: 14 }]}>
                        2. Student Academic Details
                      </Text>

                    <View style={styles.inputGroup}>
                      <Text style={[styles.inputLabel, { color: colors.primaryText }]}>Department *</Text>
                      <TouchableOpacity
                        style={[styles.inputRow, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}
                        onPress={() =>
                          openPicker(
                            "Select Department",
                            DEPARTMENTS.map((d) => d.label),
                            (selectedLabel) => {
                              const item = DEPARTMENTS.find((d) => d.label === selectedLabel);
                              if (item) setDept(item.value);
                            }
                          )
                        }
                      >
                        <Icon name="office-building" size={18} color={colors.primaryAccent} />
                        <Text style={[styles.inputText, { color: colors.primaryText, flex: 1 }]}>
                          {DEPARTMENTS.find((d) => d.value === dept)?.label || dept}
                        </Text>
                        <Icon name="chevron-down" size={18} color={colors.secondaryText} />
                      </TouchableOpacity>
                    </View>

                    <View style={styles.twoColRow}>
                      <View style={[styles.inputGroup, { flex: 1 }]}>
                        <Text style={[styles.inputLabel, { color: colors.primaryText }]}>Academic Year</Text>
                        <TouchableOpacity
                          style={[styles.inputRow, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}
                          onPress={() => openPicker("Select Academic Year", YEARS, setYear)}
                        >
                          <Text style={[styles.inputText, { color: colors.primaryText }]}>{year}</Text>
                          <Icon name="chevron-down" size={18} color={colors.secondaryText} />
                        </TouchableOpacity>
                      </View>

                      <View style={[styles.inputGroup, { flex: 1 }]}>
                        <Text style={[styles.inputLabel, { color: colors.primaryText }]}>Semester</Text>
                        <TouchableOpacity
                          style={[styles.inputRow, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}
                          onPress={() => openPicker("Select Semester", SEMESTERS, setSemester)}
                        >
                          <Text style={[styles.inputText, { color: colors.primaryText }]}>{semester}</Text>
                          <Icon name="chevron-down" size={18} color={colors.secondaryText} />
                        </TouchableOpacity>
                      </View>

                      <View style={[styles.inputGroup, { flex: 1 }]}>
                        <Text style={[styles.inputLabel, { color: colors.primaryText }]}>Section</Text>
                        <TouchableOpacity
                          style={[styles.inputRow, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}
                          onPress={() => openPicker("Select Section", SECTIONS, setSection)}
                        >
                          <Text style={[styles.inputText, { color: colors.primaryText }]}>{section}</Text>
                          <Icon name="chevron-down" size={18} color={colors.secondaryText} />
                        </TouchableOpacity>
                      </View>
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={[styles.inputLabel, { color: colors.primaryText }]}>Date of Birth (YYYY-MM-DD)</Text>
                      <View style={[styles.inputRow, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                        <Icon name="calendar-month-outline" size={18} color={colors.primaryAccent} />
                        <TextInput
                          style={[styles.input, { color: colors.primaryText }]}
                          placeholder="YYYY-MM-DD (e.g. 2006-05-15)"
                          placeholderTextColor={colors.secondaryText}
                          value={dob}
                          onChangeText={setDob}
                        />
                      </View>
                    </View>

                    <View style={styles.switchRow}>
                      <View style={styles.switchLeft}>
                        <Icon name="ray-start-arrow" size={18} color={colors.primaryAccent} />
                        <View>
                          <Text style={[styles.switchTitle, { color: colors.primaryText }]}>Lateral Entry Student</Text>
                          <Text style={[styles.switchSub, { color: colors.secondaryText }]}>Joined directly in 2nd year</Text>
                        </View>
                      </View>
                      <Switch
                        value={isLateral}
                        onValueChange={setIsLateral}
                        trackColor={{ true: colors.primaryAccent, false: colors.divider }}
                      />
                    </View>

                    <View style={[styles.switchRow, { borderBottomWidth: 0 }]}>
                      <View style={styles.switchLeft}>
                        <Icon name="bed-outline" size={18} color={colors.primaryAccent} />
                        <View>
                          <Text style={[styles.switchTitle, { color: colors.primaryText }]}>Hostel Resident</Text>
                          <Text style={[styles.switchSub, { color: colors.secondaryText }]}>Enrolled in campus hostel</Text>
                        </View>
                      </View>
                      <Switch
                        value={isHostel}
                        onValueChange={setIsHostel}
                        trackColor={{ true: colors.primaryAccent, false: colors.divider }}
                      />
                    </View>
                  </>
                )}

                {role === "staff" && (
                  <>
                    <Text style={[styles.sectionTitle, { color: colors.primaryAccent, marginTop: 14 }]}>
                      2. Faculty & Position Details
                    </Text>

                    <View style={styles.inputGroup}>
                      <Text style={[styles.inputLabel, { color: colors.primaryText }]}>Department *</Text>
                      <TouchableOpacity
                        style={[styles.inputRow, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}
                        onPress={() =>
                          openPicker(
                            "Select Staff Department",
                            DEPARTMENTS.map((d) => d.label),
                            (selectedLabel) => {
                              const item = DEPARTMENTS.find((d) => d.label === selectedLabel);
                              if (item) setStaffDept(item.value);
                            }
                          )
                        }
                      >
                        <Icon name="office-building" size={18} color={colors.primaryAccent} />
                        <Text style={[styles.inputText, { color: colors.primaryText, flex: 1 }]}>
                          {DEPARTMENTS.find((d) => d.value === staffDept)?.label || staffDept}
                        </Text>
                        <Icon name="chevron-down" size={18} color={colors.secondaryText} />
                      </TouchableOpacity>
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={[styles.inputLabel, { color: colors.primaryText }]}>Designation / Position *</Text>
                      <TouchableOpacity
                        style={[styles.inputRow, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}
                        onPress={() =>
                          openPicker(
                            "Select Position",
                            STAFF_POSITIONS.map((p) => p.label),
                            (selectedLabel) => {
                              const item = STAFF_POSITIONS.find((p) => p.label === selectedLabel);
                              if (item) setPosition(item.value);
                            }
                          )
                        }
                      >
                        <Icon name="badge-account-outline" size={18} color={colors.primaryAccent} />
                        <Text style={[styles.inputText, { color: colors.primaryText, flex: 1 }]}>
                          {STAFF_POSITIONS.find((p) => p.value === position)?.label || position}
                        </Text>
                        <Icon name="chevron-down" size={18} color={colors.secondaryText} />
                      </TouchableOpacity>
                    </View>

                    <View style={styles.twoColRow}>
                      <View style={[styles.inputGroup, { flex: 1 }]}>
                        <Text style={[styles.inputLabel, { color: colors.primaryText }]}>Qualifications</Text>
                        <View style={[styles.inputRow, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                          <TextInput
                            style={[styles.input, { color: colors.primaryText }]}
                            placeholder="e.g. M.Tech, Ph.D"
                            placeholderTextColor={colors.secondaryText}
                            value={qualification}
                            onChangeText={setQualification}
                          />
                        </View>
                      </View>

                      <View style={[styles.inputGroup, { flex: 1 }]}>
                        <Text style={[styles.inputLabel, { color: colors.primaryText }]}>Specialization</Text>
                        <View style={[styles.inputRow, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                          <TextInput
                            style={[styles.input, { color: colors.primaryText }]}
                            placeholder="e.g. Deep Learning"
                            placeholderTextColor={colors.secondaryText}
                            value={specialization}
                            onChangeText={setSpecialization}
                          />
                        </View>
                      </View>
                    </View>
                  </>
                )}

                {role === "parent" && (
                  <>
                    <Text style={[styles.sectionTitle, { color: colors.primaryAccent, marginTop: 14 }]}>
                      2. Parent & Ward Association
                    </Text>

                    <View style={styles.inputGroup}>
                      <Text style={[styles.inputLabel, { color: colors.primaryText }]}>
                        {"Ward's Student Roll Number *"}
                      </Text>
                      <View style={[styles.inputRow, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                        <Icon name="school" size={18} color={colors.primaryAccent} />
                        <TextInput
                          style={[styles.input, { color: colors.primaryText }]}
                          placeholder="e.g. 23CSE042"
                          placeholderTextColor={colors.secondaryText}
                          autoCapitalize="characters"
                          value={wardRoll}
                          onChangeText={setWardRoll}
                        />
                      </View>
                    </View>

                    <View style={styles.twoColRow}>
                      <View style={[styles.inputGroup, { flex: 1 }]}>
                        <Text style={[styles.inputLabel, { color: colors.primaryText }]}>Relationship</Text>
                        <TouchableOpacity
                          style={[styles.inputRow, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}
                          onPress={() => openPicker("Select Relationship", RELATIONS, setRelation)}
                        >
                          <Text style={[styles.inputText, { color: colors.primaryText }]}>{relation}</Text>
                          <Icon name="chevron-down" size={18} color={colors.secondaryText} />
                        </TouchableOpacity>
                      </View>

                      <View style={[styles.inputGroup, { flex: 1 }]}>
                        <Text style={[styles.inputLabel, { color: colors.primaryText }]}>Occupation</Text>
                        <View style={[styles.inputRow, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                          <TextInput
                            style={[styles.input, { color: colors.primaryText }]}
                            placeholder="e.g. Engineer / Doctor"
                            placeholderTextColor={colors.secondaryText}
                            value={occupation}
                            onChangeText={setOccupation}
                          />
                        </View>
                      </View>
                    </View>
                  </>
                )}

                {role === "admin" && (
                  <>
                    <Text style={[styles.sectionTitle, { color: colors.primaryAccent, marginTop: 14 }]}>
                      2. Administrative Privileges
                    </Text>

                    <View style={styles.inputGroup}>
                      <Text style={[styles.inputLabel, { color: colors.primaryText }]}>Admin Role Tier</Text>
                      <TouchableOpacity
                        style={[styles.inputRow, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}
                        onPress={() =>
                          openPicker(
                            "Select Admin Tier",
                            ADMIN_ROLES.map((a) => a.label),
                            (selectedLabel) => {
                              const item = ADMIN_ROLES.find((a) => a.label === selectedLabel);
                              if (item) setAdminRole(item.value);
                            }
                          )
                        }
                      >
                        <Icon name="shield-crown-outline" size={18} color={colors.primaryAccent} />
                        <Text style={[styles.inputText, { color: colors.primaryText, flex: 1 }]}>
                          {ADMIN_ROLES.find((a) => a.value === adminRole)?.label || adminRole}
                        </Text>
                        <Icon name="chevron-down" size={18} color={colors.secondaryText} />
                      </TouchableOpacity>
                    </View>

                    <Text style={[styles.inputLabel, { color: colors.primaryText, marginTop: 8 }]}>
                      Granular Permissions
                    </Text>
                    <View style={styles.permGrid}>
                      {PERMISSIONS_LIST.map((p) => {
                        const selected = permissions.includes(p.value);
                        return (
                          <TouchableOpacity
                            key={p.value}
                            style={[
                              styles.permBadge,
                              {
                                backgroundColor: selected ? colors.primaryAccent + "20" : colors.primaryBackground,
                                borderColor: selected ? colors.primaryAccent : colors.divider,
                              },
                            ]}
                            onPress={() => togglePermission(p.value)}
                          >
                            <Icon
                              name={selected ? "checkbox-marked-circle" : "checkbox-blank-circle-outline"}
                              size={16}
                              color={selected ? colors.primaryAccent : colors.secondaryText}
                            />
                            <Text
                              style={[
                                styles.permText,
                                { color: selected ? colors.primaryAccent : colors.primaryText },
                              ]}
                            >
                              {p.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </>
                )}
                </Animated.View>

                {/* SECTION 3: SYSTEM ID & AUTHENTICATION */}
                <Text style={[styles.sectionTitle, { color: colors.primaryAccent, marginTop: 16 }]}>
                  3. System ID & Login Account
                </Text>

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: colors.primaryText }]}>
                    Custom User ID (Optional — auto-generated if empty)
                  </Text>
                  <View style={[styles.inputRow, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                    <Icon name="barcode-scan" size={18} color={colors.secondaryText} />
                    <TextInput
                      style={[styles.input, { color: colors.primaryText }]}
                      placeholder={`Auto-generated (e.g. ${role === "student" ? "25ACSE001" : role === "staff" ? "STFCSEAS001" : "ADM25001"})`}
                      placeholderTextColor={colors.secondaryText}
                      value={customId}
                      onChangeText={setCustomId}
                      autoCapitalize="characters"
                    />
                  </View>
                </View>

                <View style={[styles.switchRow, { borderBottomWidth: 0, paddingVertical: 8 }]}>
                  <View style={styles.switchLeft}>
                    <Icon name="account-key-outline" size={20} color={colors.primaryAccent} />
                    <View>
                      <Text style={[styles.switchTitle, { color: colors.primaryText }]}>Provision MongoDB Login</Text>
                      <Text style={[styles.switchSub, { color: colors.secondaryText }]}>
                        Allows user to immediately log in to the mobile app
                      </Text>
                    </View>
                  </View>
                  <Switch
                    value={createLoginAccount}
                    onValueChange={setCreateLoginAccount}
                    trackColor={{ true: colors.primaryAccent, false: colors.divider }}
                  />
                </View>

                {createLoginAccount && (
                  <View style={styles.inputGroup}>
                    <Text style={[styles.inputLabel, { color: colors.primaryText }]}>Default Initial Password</Text>
                    <View style={[styles.inputRow, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                      <Icon name="lock-outline" size={18} color={colors.secondaryText} />
                      <TextInput
                        style={[styles.input, { color: colors.primaryText }]}
                        placeholder="edunex123"
                        placeholderTextColor={colors.secondaryText}
                        secureTextEntry
                        value={password}
                        onChangeText={setPassword}
                      />
                    </View>
                  </View>
                )}

                {/* Action Submit */}
                <TouchableOpacity
                  style={[styles.submitBtn, { backgroundColor: colors.primaryAccent }]}
                  onPress={handleSubmit}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Icon name="check-bold" size={20} color="#fff" />
                      <Text style={styles.submitBtnText}>Create {ROLES.find((r) => r.value === role)?.label} Record</Text>
                    </>
                  )}
                </TouchableOpacity>

                <View style={{ height: 40 }} />
              </ScrollView>
            </Animated.View>
          ) : (
            /* ========================================================================= */
            /* TAB 2: EXCEL / CSV BULK USER IMPORT                                       */
            /* ========================================================================= */
            <Animated.View style={{ flex: 1, opacity: tabTransitionFade, transform: [{ translateY: tabTransitionTranslateY }] }}>
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollBody}
                keyboardShouldPersistTaps="handled"
              >
              {/* Upload Drop Zone Card */}
              <View style={[styles.excelUploadCard, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                <Icon name="file-excel" size={44} color="#10B981" style={{ marginBottom: 8 }} />
                <Text style={[styles.uploadCardTitle, { color: colors.primaryText }]}>
                  Upload Excel or CSV File
                </Text>
                <Text style={[styles.uploadCardSub, { color: colors.secondaryText }]}>
                  Supports .xlsx, .xls, and .csv with Students, Faculty, Parents & Admins in one sheet
                </Text>

                <View style={styles.uploadActionRow}>
                  <TouchableOpacity
                    style={[styles.chooseFileBtn, { backgroundColor: "#10B981" }]}
                    onPress={handlePickDocument}
                    activeOpacity={0.85}
                  >
                    <Icon name="file-upload" size={18} color="#fff" />
                    <Text style={styles.chooseFileText}>Pick Spreadsheet File</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.sampleBtn, { backgroundColor: colors.primaryAccent + "18", borderColor: colors.primaryAccent }]}
                    onPress={handleLoadSampleData}
                    activeOpacity={0.85}
                  >
                    <Icon name="download-box-outline" size={18} color={colors.primaryAccent} />
                    <Text style={[styles.sampleBtnText, { color: colors.primaryAccent }]}>Load Sample Template</Text>
                  </TouchableOpacity>
                </View>

                {/* Paste Option toggle */}
                <TouchableOpacity
                  style={{ marginTop: 12 }}
                  onPress={() => setShowPasteBox(!showPasteBox)}
                >
                  <Text style={[styles.togglePasteText, { color: colors.primaryAccent }]}>
                    {showPasteBox ? "▲ Hide CSV Paste Area" : "▼ Or Paste Raw CSV / TSV Data Directly"}
                  </Text>
                </TouchableOpacity>

                {showPasteBox && (
                  <View style={{ width: "100%", marginTop: 10 }}>
                    <TextInput
                      style={[
                        styles.pasteTextArea,
                        { color: colors.primaryText, borderColor: colors.divider, backgroundColor: colors.cardBackground },
                      ]}
                      placeholder="Paste columns: Name, Role, Email, Mobile, ID, Department, ..."
                      placeholderTextColor={colors.secondaryText}
                      multiline
                      numberOfLines={5}
                      value={pastedCsvText}
                      onChangeText={setPastedCsvText}
                    />
                    <TouchableOpacity
                      style={[styles.parsePasteBtn, { backgroundColor: colors.primaryAccent }]}
                      onPress={handleParsePastedCsv}
                    >
                      <Text style={styles.parsePasteBtnText}>Parse Pasted CSV Data</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Password Config for Bulk */}
              <View style={[styles.inputGroup, { marginTop: 12 }]}>
                <Text style={[styles.inputLabel, { color: colors.primaryText }]}>
                  Default Password for Bulk-Created Auth Accounts
                </Text>
                <View style={[styles.inputRow, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                  <Icon name="lock-outline" size={18} color={colors.secondaryText} />
                  <TextInput
                    style={[styles.input, { color: colors.primaryText }]}
                    placeholder="edunex123"
                    placeholderTextColor={colors.secondaryText}
                    value={defaultBulkPassword}
                    onChangeText={setDefaultBulkPassword}
                  />
                </View>
              </View>

              {/* Parsed Summary & Preview */}
              {parsedRows.length > 0 && (
                <View style={{ marginTop: 14 }}>
                  <View style={styles.previewHeaderRow}>
                    <View>
                      <Text style={[styles.sectionTitle, { color: colors.primaryAccent, marginBottom: 2 }]}>
                        Parsed Data Preview ({parsedRows.length} Users)
                      </Text>
                      {bulkFileName ? (
                        <Text style={[styles.fileBadge, { color: colors.secondaryText }]}>
                          File: {bulkFileName}
                        </Text>
                      ) : null}
                    </View>
                    <TouchableOpacity
                      onPress={() => {
                        setParsedRows([]);
                        setBulkFileName("");
                      }}
                    >
                      <Text style={{ color: "#EF4444", fontWeight: "700", fontSize: 12 }}>Clear Table</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Multi-role Counter Badges */}
                  <View style={styles.counterRow}>
                    <View style={[styles.counterPill, { backgroundColor: "#3B82F618" }]}>
                      <Icon name="school" size={14} color="#3B82F6" />
                      <Text style={[styles.counterPillText, { color: "#3B82F6" }]}>
                        {studentCount} Students
                      </Text>
                    </View>
                    <View style={[styles.counterPill, { backgroundColor: "#10B98118" }]}>
                      <Icon name="account-tie" size={14} color="#10B981" />
                      <Text style={[styles.counterPillText, { color: "#10B981" }]}>
                        {staffCount} Faculty
                      </Text>
                    </View>
                    <View style={[styles.counterPill, { backgroundColor: "#F59E0B18" }]}>
                      <Icon name="human-male-female-child" size={14} color="#F59E0B" />
                      <Text style={[styles.counterPillText, { color: "#F59E0B" }]}>
                        {parentCount} Parents
                      </Text>
                    </View>
                    <View style={[styles.counterPill, { backgroundColor: "#8B5CF618" }]}>
                      <Icon name="shield-check" size={14} color="#8B5CF6" />
                      <Text style={[styles.counterPillText, { color: "#8B5CF6" }]}>
                        {adminCount} Admins
                      </Text>
                    </View>
                  </View>

                  {/* Preview Items */}
                  <View style={[styles.previewListBox, { borderColor: colors.divider, backgroundColor: colors.primaryBackground }]}>
                    {parsedRows.slice(0, 8).map((row, idx) => (
                      <View
                        key={row.key}
                        style={[
                          styles.previewRowItem,
                          idx !== Math.min(parsedRows.length, 8) - 1 && { borderBottomColor: colors.divider, borderBottomWidth: 1 },
                        ]}
                      >
                        <View style={styles.previewRowLeft}>
                          <View
                            style={[
                              styles.rowRoleBadge,
                              {
                                backgroundColor:
                                  row.role === "student"
                                    ? "#3B82F620"
                                    : row.role === "staff"
                                    ? "#10B98120"
                                    : row.role === "parent"
                                    ? "#F59E0B20"
                                    : "#8B5CF620",
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.rowRoleBadgeText,
                                {
                                  color:
                                    row.role === "student"
                                      ? "#3B82F6"
                                      : row.role === "staff"
                                      ? "#10B981"
                                      : row.role === "parent"
                                      ? "#F59E0B"
                                      : "#8B5CF6",
                                },
                              ]}
                            >
                              {row.role.toUpperCase()}
                            </Text>
                          </View>
                          <View>
                            <Text style={[styles.rowNameText, { color: colors.primaryText }]}>{row.name}</Text>
                            <Text style={[styles.rowEmailText, { color: colors.secondaryText }]}>
                              {row.email} {row.id ? `• ${row.id}` : `• ${row.dept}`}
                            </Text>
                          </View>
                        </View>
                        <Icon name="check-circle" size={18} color="#10B981" />
                      </View>
                    ))}
                    {parsedRows.length > 8 && (
                      <Text style={[styles.moreRowsText, { color: colors.secondaryText }]}>
                        + {parsedRows.length - 8} more user records in sheet
                      </Text>
                    )}
                  </View>

                  {/* Progress Indicator when importing */}
                  {bulkImporting && (
                    <View style={styles.progressBox}>
                      <Text style={[styles.progressText, { color: colors.primaryText }]}>
                        Importing to MongoDB: {bulkProgress.current} of {bulkProgress.total} records...
                      </Text>
                      <View style={[styles.progressBarTrack, { backgroundColor: colors.divider }]}>
                        <View
                          style={[
                            styles.progressBarFill,
                            {
                              width: `${(bulkProgress.current / Math.max(bulkProgress.total, 1)) * 100}%`,
                              backgroundColor: colors.primaryAccent,
                            },
                          ]}
                        />
                      </View>
                    </View>
                  )}

                  {/* Submit Batch Button */}
                  <TouchableOpacity
                    style={[styles.submitBtn, { backgroundColor: "#10B981" }]}
                    onPress={handleBatchImport}
                    disabled={bulkImporting}
                    activeOpacity={0.85}
                  >
                    {bulkImporting ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Icon name="cloud-upload" size={20} color="#fff" />
                        <Text style={styles.submitBtnText}>
                          Insert {parsedRows.length} Users into MongoDB
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}

              <View style={{ height: 40 }} />
            </ScrollView>
          </Animated.View>
        )}
        </View>
      </View>

      {/* Dropdown Options Modal */}
      <Modal visible={pickerModal.visible} transparent animationType="fade">
        <View style={styles.pickerOverlay}>
          <View style={[styles.pickerBox, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.pickerTitle, { color: colors.primaryText }]}>{pickerModal.title}</Text>
            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
              {pickerModal.options.map((opt, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.pickerItem, { borderBottomColor: colors.divider }]}
                  onPress={() => {
                    if (pickerModal.onSelect) pickerModal.onSelect(opt);
                    setPickerModal({ visible: false, title: "", options: [], onSelect: null });
                  }}
                >
                  <Text style={[styles.pickerItemText, { color: colors.primaryText }]}>{opt}</Text>
                  <Icon name="chevron-right" size={18} color={colors.secondaryText} />
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={[styles.pickerCancelBtn, { backgroundColor: colors.divider }]}
              onPress={() => setPickerModal({ visible: false, title: "", options: [], onSelect: null })}
            >
              <Text style={[styles.pickerCancelText, { color: colors.primaryText }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Success Modal */}
      {success && (
        <Modal visible={success} transparent animationType="fade">
          <View style={styles.successOverlay}>
            <View style={[styles.successBox, { backgroundColor: colors.cardBackground }]}>
              <SuccessAnimation isVisible={success} onFinish={() => setSuccess(false)} />
              <Text style={[styles.successTitle, { color: colors.primaryText }]}>
                {activeTab === "single" ? "User Added Successfully!" : "Bulk Import Successful!"}
              </Text>
              <Text style={[styles.successSub, { color: colors.secondaryText }]}>
                Campus database updated & auth credentials active in MongoDB.
              </Text>
            </View>
          </View>
        </Modal>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "flex-end",
  },
  modalCard: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 18,
    paddingTop: 16,
    height: "90%",
    maxHeight: "94%",
    elevation: 20,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 15,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  headerTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
  },
  modalHeading: {
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  modalSub: {
    fontSize: 11.5,
    marginTop: 2,
    fontWeight: "500",
  },
  closeBtn: {
    padding: 6,
  },

  /* Tabs Switch */
  tabSelectorRow: {
    flexDirection: "row",
    padding: 3,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    borderRadius: 11,
  },
  tabBtnText: {
    fontSize: 12.5,
    fontWeight: "700",
  },

  /* Role Selection Bar */
  roleHeaderSection: {
    marginBottom: 14,
  },
  roleBar: {
    flexDirection: "row",
    gap: 6,
    padding: 4,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 6,
  },
  rolePill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 9,
    paddingHorizontal: 2,
    borderRadius: 10,
  },
  rolePillText: {
    fontSize: 12,
    fontWeight: "800",
  },

  scrollBody: {
    paddingBottom: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },

  inputGroup: {
    marginBottom: 10,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 5,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  input: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: "600",
    padding: 0,
  },
  inputText: {
    fontSize: 13.5,
    fontWeight: "600",
  },
  twoColRow: {
    flexDirection: "row",
    gap: 10,
  },

  /* Switch rows */
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  switchLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    paddingRight: 10,
  },
  switchTitle: {
    fontSize: 13,
    fontWeight: "700",
  },
  switchSub: {
    fontSize: 11.5,
    marginTop: 1,
  },

  /* Permissions Grid */
  permGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
    marginBottom: 8,
  },
  permBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  permText: {
    fontSize: 11.5,
    fontWeight: "700",
  },

  /* Submit button */
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 16,
    elevation: 3,
  },
  submitBtnText: {
    color: "#fff",
    fontSize: 14.5,
    fontWeight: "800",
  },

  /* Excel Upload Card Styles */
  excelUploadCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    borderStyle: "dashed",
    padding: 18,
    alignItems: "center",
    marginBottom: 10,
  },
  uploadCardTitle: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 4,
  },
  uploadCardSub: {
    fontSize: 12,
    textAlign: "center",
    lineHeight: 17,
    marginBottom: 14,
    paddingHorizontal: 10,
  },
  uploadActionRow: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
  },
  chooseFileBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
  },
  chooseFileText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
  },
  sampleBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  sampleBtnText: {
    fontWeight: "700",
    fontSize: 13,
  },
  togglePasteText: {
    fontSize: 12,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  pasteTextArea: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    fontSize: 12,
    textAlignVertical: "top",
  },
  parsePasteBtn: {
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 8,
  },
  parsePasteBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
  },

  /* Preview Header & Counter Pills */
  previewHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 8,
  },
  fileBadge: {
    fontSize: 11.5,
    fontWeight: "600",
  },
  counterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 10,
  },
  counterPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  counterPillText: {
    fontSize: 11,
    fontWeight: "700",
  },

  /* Preview List */
  previewListBox: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  previewRowItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 9,
  },
  previewRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  rowRoleBadge: {
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 6,
  },
  rowRoleBadgeText: {
    fontSize: 9.5,
    fontWeight: "800",
  },
  rowNameText: {
    fontSize: 13,
    fontWeight: "700",
  },
  rowEmailText: {
    fontSize: 11,
    marginTop: 1,
  },
  moreRowsText: {
    textAlign: "center",
    fontSize: 12,
    fontWeight: "600",
    paddingVertical: 8,
  },

  /* Progress Box */
  progressBox: {
    marginTop: 14,
    marginBottom: 6,
  },
  progressText: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 6,
    textAlign: "center",
  },
  progressBarTrack: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
    width: "100%",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 4,
  },

  /* Picker Overlay */
  pickerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  pickerBox: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 20,
    padding: 18,
    elevation: 10,
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 12,
  },
  pickerItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  pickerItemText: {
    fontSize: 14,
    fontWeight: "600",
  },
  pickerCancelBtn: {
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 12,
  },
  pickerCancelText: {
    fontSize: 14,
    fontWeight: "700",
  },

  /* Success Overlay */
  successOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  successBox: {
    width: "100%",
    maxWidth: 340,
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    elevation: 12,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: "800",
    marginTop: 12,
    textAlign: "center",
  },
  successSub: {
    fontSize: 13,
    marginTop: 6,
    textAlign: "center",
    lineHeight: 18,
  },
});
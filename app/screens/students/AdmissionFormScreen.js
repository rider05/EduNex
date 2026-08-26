// AdmissionFormScreen.js
import React, { useRef, useEffect, useState, useCallback } from "react";
import {
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
  Alert,
  KeyboardAvoidingView,
  Image,
  ActivityIndicator,
  StatusBar,
  RefreshControl,
} from "react-native";
import DropDownPicker from "react-native-dropdown-picker";
import { Checkbox } from "expo-checkbox";
import * as ImagePicker from "expo-image-picker";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useTheme } from "../../context/ThemeContext";
import { api } from "../../services/api"; // REST backend (replaces Firestore)
import AsyncStorage from "@react-native-async-storage/async-storage";
import Toast from "react-native-toast-message";
import { useNavigation } from "@react-navigation/native";

const screenHeight = Dimensions.get("window").height;
const STORAGE_KEY = "@admission_form_progress_v1";

const formatDateToDisplay = (date) => {
  if (!(date instanceof Date) || isNaN(date)) return "";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const getStyles = (colors) =>
  StyleSheet.create({
    outerContainer: {
      flex: 1,
      backgroundColor: colors.primaryBackground,
      paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight || 24) + 10 : 100,
    },
    scrollContent: {
      paddingBottom: 30,
      minHeight: screenHeight * 0.9,
      paddingHorizontal: 15,
      paddingTop: 20,
    },
    progressContainer: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 20,
      paddingHorizontal: 10,
    },
    progressDot: {
      width: 42,
      height: 42,
      borderRadius: 21,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 2,
    },
    progressDotActive: {
      backgroundColor: (/** colors param used at runtime */) => null,
    },
    progressDotCompleted: {
      backgroundColor: (/** colors param used at runtime */) => null,
    },
    progressDotInactive: {
      backgroundColor: (/** colors param used at runtime */) => null,
    },
    progressDotText: {
      fontSize: 16,
      fontWeight: "700",
    },
    progressDotTextActive: {
      color: "#FFFFFF",
    },
    progressDotTextInactive: {
      color: "#999999",
    },
    progressLine: {
      height: 2,
      width: 42,
      marginHorizontal: 5,
    },
    formCard: {
      marginBottom: 60,
      marginTop: 4,
      padding: 20,
      backgroundColor: (/** colors param used at runtime */) => null,
      borderRadius: 15,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.08,
      shadowRadius: 10,
      elevation: 8,
      zIndex: 10,
    },
    formTitle: {
      fontSize: 26,
      fontWeight: "bold",
      textAlign: "center",
      marginBottom: 10,
    },
    stepSubtitle: {
      fontSize: 20,
      fontWeight: "700",
      marginBottom: 12,
      paddingBottom: 5,
      borderBottomWidth: 1,
    },
    label: {
      fontSize: 16,
      marginBottom: 8,
      fontWeight: "600",
    },
    input: {
      borderWidth: 1,
      borderRadius: 8,
      paddingHorizontal: 15,
      paddingVertical: 12,
      fontSize: 16,
      marginBottom: 15,
    },
    textArea: {
      minHeight: 80,
      textAlignVertical: "top",
    },
    dateInputContainer: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderRadius: 8,
      marginBottom: 15,
    },
    dateInput: {
      flex: 1,
      paddingHorizontal: 15,
      paddingVertical: 12,
      fontSize: 16,
    },
    calendarIconWrapper: {
      padding: 12,
    },
    dropdownPicker: {
      borderRadius: 8,
      minHeight: 50,
      marginBottom: 15,
    },
    dropdownMenu: {
      borderRadius: 8,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 5,
      elevation: 5,
    },
    dropdownMenuMaxHeight: {
      maxHeight: 250,
    },
    dropdownText: {
      fontSize: 16,
    },
    checkboxContainer: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 12,
    },
    checkboxLabel: {
      fontSize: 15,
      marginLeft: 8,
      flexShrink: 1,
    },
    navButtonContainer: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 18,
      alignItems: "center",
    },
    backButton: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 10,
      paddingHorizontal: 15,
      borderRadius: 10,
      borderWidth: 1,
      minWidth: 120,
      justifyContent: "center",
    },
    backButtonText: {
      fontSize: 16,
      fontWeight: "bold",
      marginLeft: 8,
    },
    nextButton: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 10,
      paddingHorizontal: 15,
      borderRadius: 10,
      minWidth: 120,
      justifyContent: "center",
    },
    nextButtonText: {
      fontSize: 16,
      fontWeight: "bold",
      marginRight: 8,
    },
    submitButton: {
      paddingVertical: 14,
      borderRadius: 10,
      alignItems: "center",
      minWidth: 160,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 5,
      elevation: 6,
      flexDirection: "row",
      justifyContent: "center",
    },
    submitButtonText: {
      fontSize: 16,
      fontWeight: "bold",
      marginLeft: 8,
    },
    submitButtonDisabled: {
      opacity: 0.6,
    },
    successBox: {
      padding: 25,
      borderRadius: 15,
      borderWidth: 1,
      alignItems: "center",
      marginTop: 30,
    },
    successText: {
      fontSize: 22,
      fontWeight: "700",
      textAlign: "center",
      marginBottom: 10,
    },
    successSubtext: {
      fontSize: 16,
      textAlign: "center",
    },
    successTickCircle: {
      width: 140,
      height: 140,
      borderRadius: 70,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 18,
      // backgroundColor will be assigned dynamically
    },
    applyNewTextBtn: {
      marginTop: 18,
    },
    applyNewText: {
      textDecorationLine: "underline",
      fontWeight: "700",
    },
    chooseFileButton: {
      paddingVertical: 12,
      paddingHorizontal: 15,
      borderRadius: 7,
      marginRight: 10,
      alignSelf: "stretch",
      justifyContent: "center",
    },
    chooseFileButtonText: {
      fontSize: 16,
      fontWeight: "bold",
    },
    fileNameText: {
      flex: 1,
      fontSize: 14,
      marginTop: 15,
      textAlign: "center",
    },
    imagePreview: {
      width: 120,
      height: 120,
      borderRadius: 10,
      marginTop: 10,
      alignSelf: "center",
    },
    loadingOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0, 0, 0, 0.7)",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 9999,
    },
    loadingText: {
      color: "#FFFFFF",
      fontSize: 16,
      marginTop: 10,
    },
  });

export default function AdmissionFormScreen() {
  const { colors } = useTheme();
  const stylesBase = getStyles(colors);

  // Because some style props are dynamic functions in getStyles above, we need to compose runtime styles here:
  const styles = StyleSheet.create({
    ...Object.keys(stylesBase).reduce((acc, key) => {
      const val = stylesBase[key];
      // if the style value is a function (we used placeholder pattern), call it
      if (typeof val === "function") {
        if (key === "progressDotActive") acc[key] = { ...stylesBase.progressDot, backgroundColor: colors.primary };
        else if (key === "progressDotCompleted") acc[key] = { ...stylesBase.progressDot, backgroundColor: colors.success || "#28a745", borderColor: colors.success || "#28a745" };
        else if (key === "progressDotInactive") acc[key] = { ...stylesBase.progressDot, backgroundColor: colors.inputBackground, borderColor: colors.divider };
        else if (key === "formCard") acc[key] = { padding: 20, backgroundColor: colors.cardBackground, borderRadius: 15 };
        else acc[key] = {};
      } else {
        acc[key] = val;
      }
      return acc;
    }, {}),
    // override/add runtime small styles:
    progressLabel: {
      fontSize: 10,
      marginTop: 5,
      textAlign: "center",
      color: colors.secondaryText,
    },
    progressLabelActive: {
      color: colors.primary,
      fontWeight: "700",
    },
    progressLineActive: {
      backgroundColor: colors.primary,
    },
    progressLineCompleted: {
      backgroundColor: colors.success || "#28a745",
    },
    progressLineInactive: {
      backgroundColor: colors.divider,
    },
    progressDotTextActive: {
      color: "#FFFFFF",
    },
    progressDotTextInactive: {
      color: colors.disabledText,
    },
  });

  const navigation = useNavigation();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 4;
  const [completedSteps, setCompletedSteps] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 800);
  }, []);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dob, setDob] = useState("");
  const [dobDate, setDobDate] = useState(new Date());

  const [isGenderOpen, setIsGenderOpen] = useState(false);
  const [isBloodGroupOpen, setIsBloodGroupOpen] = useState(false);
  const [isCourseOpen, setIsCourseOpen] = useState(false);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [isReligionOpen, setIsReligionOpen] = useState(false);
  const [isNationalityOpen, setIsNationalityOpen] = useState(false);

  // Personal Information
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [gender, setGender] = useState(null);
  const [bloodGroup, setBloodGroup] = useState(null);
  const [nationality, setNationality] = useState(null);
  const [religion, setReligion] = useState(null);
  const [category, setCategory] = useState(null);
  const [aadharNumber, setAadharNumber] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");

  // Academic Information
  const [courseApplying, setCourseApplying] = useState(null);
  const [tenthSchool, setTenthSchool] = useState("");
  const [tenthBoard, setTenthBoard] = useState("");
  const [tenthPercentage, setTenthPercentage] = useState("");
  const [tenthYearOfPassing, setTenthYearOfPassing] = useState("");
  const [twelfthSchool, setTwelfthSchool] = useState("");
  const [twelfthBoard, setTwelfthBoard] = useState("");
  const [twelfthPercentage, setTwelfthPercentage] = useState("");
  const [twelfthYearOfPassing, setTwelfthYearOfPassing] = useState("");

  // Parent/Guardian Information
  const [fatherName, setFatherName] = useState("");
  const [fatherOccupation, setFatherOccupation] = useState("");
  const [fatherPhone, setFatherPhone] = useState("");
  const [motherName, setMotherName] = useState("");
  const [motherOccupation, setMotherOccupation] = useState("");
  const [motherPhone, setMotherPhone] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [guardianRelation, setGuardianRelation] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [annualIncome, setAnnualIncome] = useState("");

  // Documents & Consent
  const [photoUri, setPhotoUri] = useState(null);
  const [photoFileName, setPhotoFileName] = useState("No file chosen");
  const [consentTerms, setConsentTerms] = useState(false);
  const [consentAccuracy, setConsentAccuracy] = useState(false);
  const [formSubmitted, setFormSubmitted] = useState(false);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  // Load saved progress
  useEffect(() => {
    const loadProgress = async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const saved = JSON.parse(raw);
          setFirstName(saved.firstName ?? "");
          setLastName(saved.lastName ?? "");
          setDob(saved.dob ?? "");
          setDobDate(saved.dobDate ? new Date(saved.dobDate) : new Date());
          setGender(saved.gender ?? null);
          setBloodGroup(saved.bloodGroup ?? null);
          setNationality(saved.nationality ?? null);
          setReligion(saved.religion ?? null);
          setCategory(saved.category ?? null);
          setAadharNumber(saved.aadharNumber ?? "");
          setEmail(saved.email ?? "");
          setPhone(saved.phone ?? "");
          setAddress(saved.address ?? "");
          setCity(saved.city ?? "");
          setState(saved.state ?? "");
          setPincode(saved.pincode ?? "");

          setCourseApplying(saved.courseApplying ?? null);
          setTenthSchool(saved.tenthSchool ?? "");
          setTenthBoard(saved.tenthBoard ?? "");
          setTenthPercentage(saved.tenthPercentage ?? "");
          setTenthYearOfPassing(saved.tenthYearOfPassing ?? "");
          setTwelfthSchool(saved.twelfthSchool ?? "");
          setTwelfthBoard(saved.twelfthBoard ?? "");
          setTwelfthPercentage(saved.twelfthPercentage ?? "");
          setTwelfthYearOfPassing(saved.twelfthYearOfPassing ?? "");

          setFatherName(saved.fatherName ?? "");
          setFatherOccupation(saved.fatherOccupation ?? "");
          setFatherPhone(saved.fatherPhone ?? "");
          setMotherName(saved.motherName ?? "");
          setMotherOccupation(saved.motherOccupation ?? "");
          setMotherPhone(saved.motherPhone ?? "");
          setGuardianName(saved.guardianName ?? "");
          setGuardianRelation(saved.guardianRelation ?? "");
          setGuardianPhone(saved.guardianPhone ?? "");
          setParentEmail(saved.parentEmail ?? "");
          setAnnualIncome(saved.annualIncome ?? "");

          setPhotoUri(saved.photoUri ?? null);
          setPhotoFileName(saved.photoFileName ?? "No file chosen");
          setConsentTerms(saved.consentTerms ?? false);
          setConsentAccuracy(saved.consentAccuracy ?? false);

          setCompletedSteps(saved.completedSteps ?? []);
          setCurrentStep(saved.currentStep ?? 1);
        }
      } catch (e) {
        console.warn("Failed to load saved progress", e);
      }
    };
    loadProgress();
  }, []);

  // Save progress to AsyncStorage
  useEffect(() => {
    const saveProgress = async () => {
      try {
        const payload = {
          firstName,
          lastName,
          dob,
          dobDate: dobDate ? dobDate.toISOString() : null,
          gender,
          bloodGroup,
          nationality,
          religion,
          category,
          aadharNumber,
          email,
          phone,
          address,
          city,
          state,
          pincode,

          courseApplying,
          tenthSchool,
          tenthBoard,
          tenthPercentage,
          tenthYearOfPassing,
          twelfthSchool,
          twelfthBoard,
          twelfthPercentage,
          twelfthYearOfPassing,

          fatherName,
          fatherOccupation,
          fatherPhone,
          motherName,
          motherOccupation,
          motherPhone,
          guardianName,
          guardianRelation,
          guardianPhone,
          parentEmail,
          annualIncome,

          photoUri,
          photoFileName,
          consentTerms,
          consentAccuracy,

          completedSteps,
          currentStep,
        };
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      } catch (_e) {
        // silent fail
      }
    };
    saveProgress();
  }, [
    firstName,
    lastName,
    dob,
    dobDate,
    gender,
    bloodGroup,
    nationality,
    religion,
    category,
    aadharNumber,
    email,
    phone,
    address,
    city,
    state,
    pincode,
    courseApplying,
    tenthSchool,
    tenthBoard,
    tenthPercentage,
    tenthYearOfPassing,
    twelfthSchool,
    twelfthBoard,
    twelfthPercentage,
    twelfthYearOfPassing,
    fatherName,
    fatherOccupation,
    fatherPhone,
    motherName,
    motherOccupation,
    motherPhone,
    guardianName,
    guardianRelation,
    guardianPhone,
    parentEmail,
    annualIncome,
    photoUri,
    photoFileName,
    consentTerms,
    consentAccuracy,
    completedSteps,
    currentStep,
  ]);

  const genderItems = [
    { label: "Male", value: "Male" },
    { label: "Female", value: "Female" },
    { label: "Other", value: "Other" },
  ];
  const bloodGroupItems = [
    { label: "A+", value: "A+" },
    { label: "A-", value: "A-" },
    { label: "B+", value: "B+" },
    { label: "B-", value: "B-" },
    { label: "AB+", value: "AB+" },
    { label: "AB-", value: "AB-" },
    { label: "O+", value: "O+" },
    { label: "O-", value: "O-" },
  ];
  const courseItems = [
    { label: "B.E Civil Engineering", value: "BE_CE" },
    { label: "B.E Computer Science Engineering", value: "BE_CSE" },
    { label: "B.E Mechanical Engineering", value: "BE_MECH" },
    { label: "B.E Electrical & Electronics Engineering", value: "BE_EEE" },
    { label: "B.E Electronics & Communication Engineering", value: "BE_ECE" },
  ];
  const categoryItems = [
    { label: "General", value: "General" },
    { label: "OBC", value: "OBC" },
    { label: "SC", value: "SC" },
    { label: "ST", value: "ST" },
    { label: "EWS", value: "EWS" },
  ];
  const religionItems = [
    { label: "Hindu", value: "Hindu" },
    { label: "Muslim", value: "Muslim" },
    { label: "Christian", value: "Christian" },
    { label: "Sikh", value: "Sikh" },
    { label: "Buddhist", value: "Buddhist" },
    { label: "Other", value: "Other" },
  ];
  const nationalityItems = [
    { label: "Indian", value: "Indian" },
    { label: "Other", value: "Other" },
  ];

  const onChangeDate = (event, selectedDate) => {
    const currentDate = selectedDate || dobDate;
    setShowDatePicker(Platform.OS === "ios");
    setDobDate(currentDate);
    setDob(formatDateToDisplay(currentDate));
  };
  const showDatePickerModal = () => setShowDatePicker(true);

  const onToggleDropdown = (setter) => {
    if (setter !== setIsGenderOpen) setIsGenderOpen(false);
    if (setter !== setIsBloodGroupOpen) setIsBloodGroupOpen(false);
    if (setter !== setIsCourseOpen) setIsCourseOpen(false);
    if (setter !== setIsCategoryOpen) setIsCategoryOpen(false);
    if (setter !== setIsReligionOpen) setIsReligionOpen(false);
    if (setter !== setIsNationalityOpen) setIsNationalityOpen(false);
    setter((prev) => !prev);
  };

  const handleChooseFile = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
      });
      if (!result.canceled) {
        setPhotoUri(result.assets[0].uri);
        setPhotoFileName(result.assets[0].uri.split("/").pop());
        Toast.show({ type: "success", text1: "File selected", text2: result.assets[0].uri.split("/").pop() });
      }
    } catch (_err) {
      Alert.alert("Error", "Failed to pick image");
    }
  };

  const validateStep = () => {
    switch (currentStep) {
      case 1:
        if (!firstName || !lastName || !dob || !gender || !email || !phone || !address || !city || !state || !pincode) {
          Alert.alert("Validation Error", "Please fill all required fields in Personal Information.");
          return false;
        }
        if (phone.length < 10) {
          Alert.alert("Validation Error", "Please enter a valid 10-digit phone number.");
          return false;
        }
        if (pincode.length !== 6) {
          Alert.alert("Validation Error", "Please enter a valid 6-digit pincode.");
          return false;
        }
        return true;
      case 2:
        if (!courseApplying || !tenthSchool || !tenthBoard || !tenthPercentage || !tenthYearOfPassing || !twelfthSchool || !twelfthBoard || !twelfthPercentage || !twelfthYearOfPassing) {
          Alert.alert("Validation Error", "Please fill all required fields in Academic Information.");
          return false;
        }
        return true;
      case 3:
        if (!fatherName || !fatherOccupation || !fatherPhone || !motherName || !motherOccupation || !motherPhone || !parentEmail) {
          Alert.alert("Validation Error", "Please fill all required Parent/Guardian details.");
          return false;
        }
        if (fatherPhone.length < 10 || motherPhone.length < 10) {
          Alert.alert("Validation Error", "Please enter valid parent phone numbers.");
          return false;
        }
        return true;
      case 4:
        if (!consentTerms || !consentAccuracy) {
          Alert.alert("Consent Required", "You must agree to all terms and conditions.");
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const markStepCompleted = (stepNum) => {
    setCompletedSteps((prev) => (prev.includes(stepNum) ? prev : [...prev, stepNum]));
  };

  const handleNext = () => {
    if (validateStep()) {
      markStepCompleted(currentStep);
      Toast.show({ type: "success", text1: `Step ${currentStep} completed` });
      setCurrentStep((prev) => Math.min(prev + 1, totalSteps));
    }
  };
  const handleBack = () => setCurrentStep((prev) => Math.max(prev - 1, 1));

  // Reset everything & clear storage
  const resetAll = async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
      await AsyncStorage.removeItem("@admissions_local");
    } catch (_e) {
      // ignore
    }

    // Reset all local state
    setCurrentStep(1);
    setCompletedSteps([]);
    setIsSubmitting(false);

    setDob("");
    setDobDate(new Date());
    setIsGenderOpen(false);
    setIsBloodGroupOpen(false);
    setIsCourseOpen(false);
    setIsCategoryOpen(false);
    setIsReligionOpen(false);
    setIsNationalityOpen(false);

    setFirstName("");
    setLastName("");
    setGender(null);
    setBloodGroup(null);
    setNationality(null);
    setReligion(null);
    setCategory(null);
    setAadharNumber("");
    setEmail("");
    setPhone("");
    setAddress("");
    setCity("");
    setState("");
    setPincode("");

    setCourseApplying(null);
    setTenthSchool("");
    setTenthBoard("");
    setTenthPercentage("");
    setTenthYearOfPassing("");
    setTwelfthSchool("");
    setTwelfthBoard("");
    setTwelfthPercentage("");
    setTwelfthYearOfPassing("");

    setFatherName("");
    setFatherOccupation("");
    setFatherPhone("");
    setMotherName("");
    setMotherOccupation("");
    setMotherPhone("");
    setGuardianName("");
    setGuardianRelation("");
    setGuardianPhone("");
    setParentEmail("");
    setAnnualIncome("");

    setPhotoUri(null);
    setPhotoFileName("No file chosen");
    setConsentTerms(false);
    setConsentAccuracy(false);
    setFormSubmitted(false);

    Toast.show({ type: "success", text1: "Reset complete", text2: "You can apply a new form now." });
  };

  // Submission (no firebase image upload)
  const handleSubmit = async () => {
    if (!validateStep()) return;
    setIsSubmitting(true);

    try {
      const admissionData = {
        personalInfo: {
          firstName,
          lastName,
          dateOfBirth: dob,
          gender,
          bloodGroup,
          nationality,
          religion,
          category,
          aadharNumber,
          email,
          phone,
          address,
          city,
          state,
          pincode,
        },
        academicInfo: {
          courseApplying,
          tenth: {
            school: tenthSchool,
            board: tenthBoard,
            percentage: tenthPercentage,
            yearOfPassing: tenthYearOfPassing,
          },
          twelfth: {
            school: twelfthSchool,
            board: twelfthBoard,
            percentage: twelfthPercentage,
            yearOfPassing: twelfthYearOfPassing,
          },
        },
        parentInfo: {
          father: { name: fatherName, occupation: fatherOccupation, phone: fatherPhone },
          mother: { name: motherName, occupation: motherOccupation, phone: motherPhone },
          guardian: { name: guardianName, relation: guardianRelation, phone: guardianPhone },
          parentEmail,
          annualIncome,
        },
        documents: { photoUri, photoFileName },
        submittedAt: new Date().toISOString(),
        status: "Pending",
      };

      try {
        await api.post("/admissions", admissionData);
      } catch (apiErr) {
        console.warn("Admission POST failed, saving locally:", apiErr?.message || apiErr);
        const savedApplicationsRaw = await AsyncStorage.getItem("@admissions_local");
        const savedApplications = savedApplicationsRaw ? JSON.parse(savedApplicationsRaw) : [];
        await AsyncStorage.setItem("@admissions_local", JSON.stringify([...savedApplications, admissionData]));
      }

      setCompletedSteps([1, 2, 3, 4]);
      setFormSubmitted(true);
      setIsSubmitting(false);
      await AsyncStorage.removeItem(STORAGE_KEY);

      Toast.show({ type: "success", text1: "Application submitted", text2: "Your application has been received." });

      // Try navigate to Dashboard (non-blocking)
      try {
        navigation.navigate("Dashboard");
      } catch (_e) {
        // ignore if route doesn't exist
      }
    } catch (error) {
      setIsSubmitting(false);
      console.error("Submission error:", error);
      Toast.show({ type: "error", text1: "Submission failed", text2: "Please try again." });
      Alert.alert("Error", "Failed to submit application. Please try again.");
    }
  };

  const renderProgressIndicator = () => {
    const steps = [
      { num: 1, label: "Personal" },
      { num: 2, label: "Academic" },
      { num: 3, label: "Parent" },
      { num: 4, label: "Documents" },
    ];

    return (
      <View>
        <View style={styles.progressContainer}>
          {steps.map((step, index) => {
            const isActive = currentStep === step.num;
            const isCompleted = completedSteps.includes(step.num);
            const dotStyle = isCompleted
              ? { backgroundColor: colors.success, borderColor: colors.success }
              : isActive
              ? { backgroundColor: colors.primary, borderColor: colors.primary }
              : { backgroundColor: colors.inputBackground, borderColor: colors.divider };

            return (
              <React.Fragment key={step.num}>
                <View style={{ alignItems: "center" }}>
                  <View style={[styles.progressDot, dotStyle]}>
                    {isCompleted && !isActive ? (
                      <Icon name="check" size={20} color="#FFFFFF" />
                    ) : (
                      <Text style={[styles.progressDotText, isActive || isCompleted ? { color: "#FFFFFF" } : { color: colors.disabledText }]}>
                        {step.num}
                      </Text>
                    )}
                  </View>
                  <Text style={[styles.progressLabel, isActive && styles.progressLabelActive]}>{step.label}</Text>
                </View>
                {index < steps.length - 1 && (
                  <View
                    style={[
                      styles.progressLine,
                      isCompleted ? { backgroundColor: colors.success } : currentStep > step.num ? { backgroundColor: colors.primary } : { backgroundColor: colors.divider },
                    ]}
                  />
                )}
              </React.Fragment>
            );
          })}
        </View>
      </View>
    );
  };

  const renderStep1 = () => (
    <View>
      <Text style={[styles.stepSubtitle, { color: colors.primaryText }]}>Personal Information</Text>

      <Text style={[styles.label, { color: colors.primaryText }]}>First Name *</Text>
      <TextInput style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.divider, color: colors.primaryText }]} value={firstName} onChangeText={setFirstName} placeholder="Enter First Name" placeholderTextColor={colors.disabledText} />

      <Text style={[styles.label, { color: colors.primaryText }]}>Last Name *</Text>
      <TextInput style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.divider, color: colors.primaryText }]} value={lastName} onChangeText={setLastName} placeholder="Enter Last Name" placeholderTextColor={colors.disabledText} />

      <Text style={[styles.label, { color: colors.primaryText }]}>Date of Birth (DD/MM/YYYY) *</Text>
      <View style={[styles.dateInputContainer, { backgroundColor: colors.inputBackground, borderColor: colors.divider }]}>
        <TextInput
          style={[styles.dateInput, { color: colors.primaryText }]}
          value={dob}
          onChangeText={(input) => {
            let numericValue = input.replace(/[^0-9]/g, "");
            if (numericValue.length > 8) numericValue = numericValue.substring(0, 8);
            let formattedValue = "";
            for (let i = 0; i < numericValue.length; i++) {
              if (i === 2 || i === 4) formattedValue += "/";
              formattedValue += numericValue[i];
            }
            setDob(formattedValue);
          }}
          placeholder="DD/MM/YYYY"
          placeholderTextColor={colors.disabledText}
          keyboardType="numeric"
          maxLength={10}
        />
        <TouchableOpacity style={styles.calendarIconWrapper} onPress={showDatePickerModal}>
          <Icon name="calendar" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>
      {showDatePicker && <DateTimePicker value={dobDate} mode="date" display={Platform.OS === "ios" ? "spinner" : "default"} onChange={onChangeDate} maximumDate={new Date()} />}

      <Text style={[styles.label, { color: colors.primaryText }]}>Gender *</Text>
      <DropDownPicker
        open={isGenderOpen}
        value={gender}
        items={genderItems}
        setOpen={() => onToggleDropdown(setIsGenderOpen)}
        setValue={setGender}
        placeholder="Select Gender"
        style={[styles.dropdownPicker, { backgroundColor: colors.inputBackground, borderColor: colors.divider }]}
        dropDownContainerStyle={[styles.dropdownMenu, styles.dropdownMenuMaxHeight, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
        textStyle={[styles.dropdownText, { color: colors.primaryText }]}
        zIndex={6000}
        listMode="SCROLLVIEW"
        placeholderStyle={{ color: colors.disabledText }}
      />

      <Text style={[styles.label, { color: colors.primaryText }]}>Blood Group</Text>
      <DropDownPicker
        open={isBloodGroupOpen}
        value={bloodGroup}
        items={bloodGroupItems}
        setOpen={() => onToggleDropdown(setIsBloodGroupOpen)}
        setValue={setBloodGroup}
        placeholder="Select Blood Group"
        style={[styles.dropdownPicker, { backgroundColor: colors.inputBackground, borderColor: colors.divider }]}
        dropDownContainerStyle={[styles.dropdownMenu, styles.dropdownMenuMaxHeight, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
        textStyle={[styles.dropdownText, { color: colors.primaryText }]}
        zIndex={5000}
        listMode="SCROLLVIEW"
        placeholderStyle={{ color: colors.disabledText }}
      />

      <Text style={[styles.label, { color: colors.primaryText }]}>Nationality *</Text>
      <DropDownPicker
        open={isNationalityOpen}
        value={nationality}
        items={nationalityItems}
        setOpen={() => onToggleDropdown(setIsNationalityOpen)}
        setValue={setNationality}
        placeholder="Select Nationality"
        style={[styles.dropdownPicker, { backgroundColor: colors.inputBackground, borderColor: colors.divider }]}
        dropDownContainerStyle={[styles.dropdownMenu, styles.dropdownMenuMaxHeight, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
        textStyle={[styles.dropdownText, { color: colors.primaryText }]}
        zIndex={4000}
        listMode="SCROLLVIEW"
        placeholderStyle={{ color: colors.disabledText }}
      />

      <Text style={[styles.label, { color: colors.primaryText }]}>Religion</Text>
      <DropDownPicker
        open={isReligionOpen}
        value={religion}
        items={religionItems}
        setOpen={() => onToggleDropdown(setIsReligionOpen)}
        setValue={setReligion}
        placeholder="Select Religion"
        style={[styles.dropdownPicker, { backgroundColor: colors.inputBackground, borderColor: colors.divider }]}
        dropDownContainerStyle={[styles.dropdownMenu, styles.dropdownMenuMaxHeight, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
        textStyle={[styles.dropdownText, { color: colors.primaryText }]}
        zIndex={3000}
        listMode="SCROLLVIEW"
        placeholderStyle={{ color: colors.disabledText }}
      />

      <Text style={[styles.label, { color: colors.primaryText }]}>Category</Text>
      <DropDownPicker
        open={isCategoryOpen}
        value={category}
        items={categoryItems}
        setOpen={() => onToggleDropdown(setIsCategoryOpen)}
        setValue={setCategory}
        placeholder="Select Category"
        style={[styles.dropdownPicker, { backgroundColor: colors.inputBackground, borderColor: colors.divider }]}
        dropDownContainerStyle={[styles.dropdownMenu, styles.dropdownMenuMaxHeight, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
        textStyle={[styles.dropdownText, { color: colors.primaryText }]}
        zIndex={2000}
        listMode="SCROLLVIEW"
        placeholderStyle={{ color: colors.disabledText }}
      />

      <Text style={[styles.label, { color: colors.primaryText }]}>Aadhar Number</Text>
      <TextInput
        style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.divider, color: colors.primaryText }]}
        value={aadharNumber}
        onChangeText={(text) => {
          const numOnly = text.replace(/[^0-9]/g, "");
          if (numOnly.length <= 12) setAadharNumber(numOnly);
        }}
        placeholder="Enter 12-digit Aadhar Number"
        placeholderTextColor={colors.disabledText}
        keyboardType="numeric"
        maxLength={12}
      />

      <Text style={[styles.label, { color: colors.primaryText }]}>Email *</Text>
      <TextInput style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.divider, color: colors.primaryText }]} value={email} onChangeText={setEmail} placeholder="Enter Email Address" placeholderTextColor={colors.disabledText} keyboardType="email-address" autoCapitalize="none" />

      <Text style={[styles.label, { color: colors.primaryText }]}>Phone Number *</Text>
      <TextInput
        style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.divider, color: colors.primaryText }]}
        value={phone}
        onChangeText={(text) => {
          const numOnly = text.replace(/[^0-9]/g, "");
          if (numOnly.length <= 10) setPhone(numOnly);
        }}
        placeholder="Enter 10-digit Phone Number"
        placeholderTextColor={colors.disabledText}
        keyboardType="phone-pad"
        maxLength={10}
      />

      <Text style={[styles.label, { color: colors.primaryText }]}>Address *</Text>
      <TextInput style={[styles.input, styles.textArea, { backgroundColor: colors.inputBackground, borderColor: colors.divider, color: colors.primaryText }]} value={address} onChangeText={setAddress} placeholder="Enter Full Address" placeholderTextColor={colors.disabledText} multiline numberOfLines={3} />

      <Text style={[styles.label, { color: colors.primaryText }]}>City *</Text>
      <TextInput style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.divider, color: colors.primaryText }]} value={city} onChangeText={setCity} placeholder="Enter City" placeholderTextColor={colors.disabledText} />

      <Text style={[styles.label, { color: colors.primaryText }]}>State *</Text>
      <TextInput style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.divider, color: colors.primaryText }]} value={state} onChangeText={setState} placeholder="Enter State" placeholderTextColor={colors.disabledText} />

      <Text style={[styles.label, { color: colors.primaryText }]}>Pincode *</Text>
      <TextInput
        style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.divider, color: colors.primaryText }]}
        value={pincode}
        onChangeText={(text) => {
          const numOnly = text.replace(/[^0-9]/g, "");
          if (numOnly.length <= 6) setPincode(numOnly);
        }}
        placeholder="Enter 6-digit Pincode"
        placeholderTextColor={colors.disabledText}
        keyboardType="numeric"
        maxLength={6}
      />
    </View>
  );

  const renderStep2 = () => (
    <View>
      <Text style={[styles.stepSubtitle, { color: colors.primaryText }]}>Academic Information</Text>

      <Text style={[styles.label, { color: colors.primaryText }]}>Course Applying For *</Text>
      <DropDownPicker
        open={isCourseOpen}
        value={courseApplying}
        items={courseItems}
        setOpen={() => onToggleDropdown(setIsCourseOpen)}
        setValue={setCourseApplying}
        placeholder="Select Course"
        style={[styles.dropdownPicker, { backgroundColor: colors.inputBackground, borderColor: colors.divider }]}
        dropDownContainerStyle={[styles.dropdownMenu, styles.dropdownMenuMaxHeight, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
        textStyle={[styles.dropdownText, { color: colors.primaryText }]}
        zIndex={4000}
        listMode="SCROLLVIEW"
        placeholderStyle={{ color: colors.disabledText }}
      />

      <Text style={[styles.stepSubtitle, { marginTop: 20, fontSize: 18, color: colors.primaryText }]}>10th Standard Details</Text>
      <Text style={[styles.label, { color: colors.primaryText }]}>School Name *</Text>
      <TextInput style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.divider, color: colors.primaryText }]} value={tenthSchool} onChangeText={setTenthSchool} placeholder="Enter School Name" placeholderTextColor={colors.disabledText} />

      <Text style={[styles.label, { color: colors.primaryText }]}>Board *</Text>
      <TextInput style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.divider, color: colors.primaryText }]} value={tenthBoard} onChangeText={setTenthBoard} placeholder="e.g., CBSE, State Board" placeholderTextColor={colors.disabledText} />

      <Text style={[styles.label, { color: colors.primaryText }]}>Percentage/CGPA *</Text>
      <TextInput style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.divider, color: colors.primaryText }]} value={tenthPercentage} onChangeText={setTenthPercentage} placeholder="Enter Percentage or CGPA" placeholderTextColor={colors.disabledText} keyboardType="decimal-pad" />

      <Text style={[styles.label, { color: colors.primaryText }]}>Year of Passing *</Text>
      <TextInput
        style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.divider, color: colors.primaryText }]}
        value={tenthYearOfPassing}
        onChangeText={(text) => {
          const numOnly = text.replace(/[^0-9]/g, "");
          if (numOnly.length <= 4) setTenthYearOfPassing(numOnly);
        }}
        placeholder="e.g., 2022"
        placeholderTextColor={colors.disabledText}
        keyboardType="numeric"
        maxLength={4}
      />

      <Text style={[styles.stepSubtitle, { marginTop: 20, fontSize: 18, color: colors.primaryText }]}>12th Standard Details</Text>
      <Text style={[styles.label, { color: colors.primaryText }]}>School Name *</Text>
      <TextInput style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.divider, color: colors.primaryText }]} value={twelfthSchool} onChangeText={setTwelfthSchool} placeholder="Enter School Name" placeholderTextColor={colors.disabledText} />

      <Text style={[styles.label, { color: colors.primaryText }]}>Board *</Text>
      <TextInput style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.divider, color: colors.primaryText }]} value={twelfthBoard} onChangeText={setTwelfthBoard} placeholder="e.g., CBSE, State Board" placeholderTextColor={colors.disabledText} />

      <Text style={[styles.label, { color: colors.primaryText }]}>Percentage/CGPA *</Text>
      <TextInput style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.divider, color: colors.primaryText }]} value={twelfthPercentage} onChangeText={setTwelfthPercentage} placeholder="Enter Percentage or CGPA" placeholderTextColor={colors.disabledText} keyboardType="decimal-pad" />

      <Text style={[styles.label, { color: colors.primaryText }]}>Year of Passing *</Text>
      <TextInput
        style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.divider, color: colors.primaryText }]}
        value={twelfthYearOfPassing}
        onChangeText={(text) => {
          const numOnly = text.replace(/[^0-9]/g, "");
          if (numOnly.length <= 4) setTwelfthYearOfPassing(numOnly);
        }}
        placeholder="e.g., 2024"
        placeholderTextColor={colors.disabledText}
        keyboardType="numeric"
        maxLength={4}
      />
    </View>
  );

  const renderStep3 = () => (
    <View>
      <Text style={[styles.stepSubtitle, { color: colors.primaryText }]}>Parent/Guardian Information</Text>

      <Text style={[styles.label, { color: colors.primaryText }]}>{"Father's Name *"}</Text>
      <TextInput style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.divider, color: colors.primaryText }]} value={fatherName} onChangeText={setFatherName} placeholder="Enter Father's Full Name" placeholderTextColor={colors.disabledText} />

      <Text style={[styles.label, { color: colors.primaryText }]}>Occupation *</Text>
      <TextInput style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.divider, color: colors.primaryText }]} value={fatherOccupation} onChangeText={setFatherOccupation} placeholder="Enter Occupation" placeholderTextColor={colors.disabledText} />

      <Text style={[styles.label, { color: colors.primaryText }]}>Phone Number *</Text>
      <TextInput
        style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.divider, color: colors.primaryText }]}
        value={fatherPhone}
        onChangeText={(text) => {
          const numOnly = text.replace(/[^0-9]/g, "");
          if (numOnly.length <= 10) setFatherPhone(numOnly);
        }}
        placeholder="Enter 10-digit Phone Number"
        placeholderTextColor={colors.disabledText}
        keyboardType="phone-pad"
        maxLength={10}
      />

      <Text style={[styles.label, { color: colors.primaryText }]}>{"Mother's Name *"}</Text>
      <TextInput style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.divider, color: colors.primaryText }]} value={motherName} onChangeText={setMotherName} placeholder="Enter Mother's Full Name" placeholderTextColor={colors.disabledText} />

      <Text style={[styles.label, { color: colors.primaryText }]}>Occupation *</Text>
      <TextInput style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.divider, color: colors.primaryText }]} value={motherOccupation} onChangeText={setMotherOccupation} placeholder="Enter Occupation" placeholderTextColor={colors.disabledText} />

      <Text style={[styles.label, { color: colors.primaryText }]}>Phone Number *</Text>
      <TextInput
        style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.divider, color: colors.primaryText }]}
        value={motherPhone}
        onChangeText={(text) => {
          const numOnly = text.replace(/[^0-9]/g, "");
          if (numOnly.length <= 10) setMotherPhone(numOnly);
        }}
        placeholder="Enter 10-digit Phone Number"
        placeholderTextColor={colors.disabledText}
        keyboardType="phone-pad"
        maxLength={10}
      />

      <Text style={[styles.label, { color: colors.primaryText }]}>{"Guardian's Name"}</Text>
      <TextInput style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.divider, color: colors.primaryText }]} value={guardianName} onChangeText={setGuardianName} placeholder="Enter Guardian's Name" placeholderTextColor={colors.disabledText} />

      <Text style={[styles.label, { color: colors.primaryText }]}>Relation</Text>
      <TextInput style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.divider, color: colors.primaryText }]} value={guardianRelation} onChangeText={setGuardianRelation} placeholder="e.g., Uncle, Aunt" placeholderTextColor={colors.disabledText} />

      <Text style={[styles.label, { color: colors.primaryText }]}>Phone Number</Text>
      <TextInput
        style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.divider, color: colors.primaryText }]}
        value={guardianPhone}
        onChangeText={(text) => {
          const numOnly = text.replace(/[^0-9]/g, "");
          if (numOnly.length <= 10) setGuardianPhone(numOnly);
        }}
        placeholder="Enter 10-digit Phone Number"
        placeholderTextColor={colors.disabledText}
        keyboardType="phone-pad"
        maxLength={10}
      />

      <Text style={[styles.label, { color: colors.primaryText }]}>Parent Email *</Text>
      <TextInput style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.divider, color: colors.primaryText }]} value={parentEmail} onChangeText={setParentEmail} placeholder="Enter Parent Email Address" placeholderTextColor={colors.disabledText} keyboardType="email-address" autoCapitalize="none" />

      <Text style={[styles.label, { color: colors.primaryText }]}>Annual Family Income</Text>
      <TextInput style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.divider, color: colors.primaryText }]} value={annualIncome} onChangeText={setAnnualIncome} placeholder="Enter Annual Income (Optional)" placeholderTextColor={colors.disabledText} keyboardType="numeric" />
    </View>
  );

  const renderStep4 = () => (
    <View>
      <Text style={[styles.stepSubtitle, { color: colors.primaryText }]}>Upload Photo</Text>
      <View style={{ flexDirection: "row", marginBottom: 10 }}>
        <TouchableOpacity
          style={[styles.chooseFileButton, { backgroundColor: colors.fileButtonBg || colors.inputBackground, borderColor: colors.divider }]}
          onPress={handleChooseFile}
        >
          <Text style={[styles.chooseFileButtonText, { color: colors.primaryText }]}>Choose File</Text>
        </TouchableOpacity>
      </View>

      {photoUri && <Image source={{ uri: photoUri }} style={styles.imagePreview} />}
      <Text style={[styles.fileNameText, { color: colors.secondaryText }]}>{photoFileName}</Text>

      <Text style={[styles.stepSubtitle, { marginTop: 20, color: colors.primaryText }]}>Declaration & Consent</Text>

      <View style={styles.checkboxContainer}>
        <Checkbox value={consentTerms} onValueChange={setConsentTerms} color={consentTerms ? colors.primary : colors.disabledText} />
        <Text style={[styles.checkboxLabel, { color: colors.primaryText }]}>
          I agree to the terms and conditions of the institution and understand that providing false information may lead to disqualification. *
        </Text>
      </View>

      <View style={styles.checkboxContainer}>
        <Checkbox value={consentAccuracy} onValueChange={setConsentAccuracy} color={consentAccuracy ? colors.primary : colors.disabledText} />
        <Text style={[styles.checkboxLabel, { color: colors.primaryText }]}>
          I certify that all information provided in this application is accurate and complete to the best of my knowledge. *
        </Text>
      </View>
    </View>
  );

  if (formSubmitted) {
    return (
      <View style={[styles.outerContainer, { backgroundColor: colors.primaryBackground }]}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Animated.View style={[{ opacity: fadeAnim }]}>
            <View style={[styles.formCard, { backgroundColor: colors.cardBackground }]}>
              <View style={[styles.successBox, { backgroundColor: colors.successBg || "#E9F7EF", borderColor: colors.success || "#28a745" }]}>
                <View style={[styles.successTickCircle, { backgroundColor: colors.success || "#28a745" }]}>
                  <Icon name="check" size={64} color="#FFFFFF" />
                </View>
                <Text style={[styles.successText, { color: colors.success || "#28a745" }]}>Application Submitted Successfully!</Text>
                <Text style={[styles.successSubtext, { color: colors.primaryText }]}>
                  Your admission application has been received. You will receive a confirmation email shortly.
                </Text>
                <Text style={[styles.successSubtext, { marginTop: 12, fontWeight: "700", color: colors.primaryText }]}>
                  Application ID will be sent to your email.
                </Text>

                <TouchableOpacity style={styles.applyNewTextBtn} onPress={resetAll}>
                  <Text style={[styles.applyNewText, { color: colors.primary }]}>Apply New Form</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        </ScrollView>
        <Toast />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={[styles.outerContainer, { backgroundColor: colors.primaryBackground }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
            progressBackgroundColor={colors.cardBackground}
          />
        }
      >
        <Animated.View style={{ opacity: fadeAnim }}>
          <Text style={[styles.formTitle, { color: colors.primary }]}>{/* Title */}College Admission Form</Text>

          {renderProgressIndicator()}

          <View style={[styles.formCard, { backgroundColor: colors.cardBackground }]}>
            {currentStep === 1 && renderStep1()}
            {currentStep === 2 && renderStep2()}
            {currentStep === 3 && renderStep3()}
            {currentStep === 4 && renderStep4()}

            <View style={styles.navButtonContainer}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                {currentStep > 1 && (
                  <TouchableOpacity
                    style={[
                      styles.backButton,
                      { borderColor: colors.primary, backgroundColor: colors.cardBackground },
                    ]}
                    onPress={handleBack}
                  >
                    <Icon name="arrow-left" size={18} color={colors.primary} />
                    <Text style={[styles.backButtonText, { color: colors.primary }]}>Back</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={{ flexDirection: "row", alignItems: "center" }}>
                {currentStep < totalSteps ? (
                  <TouchableOpacity
                    style={[
                      styles.nextButton,
                      { backgroundColor: colors.primary, borderColor: colors.primary },
                    ]}
                    onPress={handleNext}
                  >
                    <Text style={[styles.nextButtonText, { color: colors.cardBackground }]}>Next</Text>
                    <Icon name="arrow-right" size={18} color={colors.cardBackground} />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[
                      styles.submitButton,
                      { backgroundColor: colors.primary, borderColor: colors.primary },
                      !(consentTerms && consentAccuracy) ? styles.submitButtonDisabled : null,
                    ]}
                    onPress={handleSubmit}
                    disabled={isSubmitting || !(consentTerms && consentAccuracy)}
                  >
                    {isSubmitting ? (
                      <>
                        <ActivityIndicator size="small" color={colors.cardBackground} />
                        <Text style={[styles.submitButtonText, { color: colors.cardBackground, marginLeft: 10 }]}>Submitting...</Text>
                      </>
                    ) : (
                      <>
                        <Icon name="send" size={18} color={colors.cardBackground} />
                        <Text style={[styles.submitButtonText, { color: colors.cardBackground }]}>Submit Application</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </Animated.View>
      </ScrollView>

      {isSubmitting && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.loadingText}>Submitting Application...</Text>
        </View>
      )}

      <Toast />
    </KeyboardAvoidingView>
  );
}
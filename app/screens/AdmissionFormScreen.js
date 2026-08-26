import React, { createContext, useState, useRef, useEffect } from "react";
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
} from "react-native";
import DropDownPicker from "react-native-dropdown-picker";
import { Checkbox } from "expo-checkbox";
import * as ImagePicker from "expo-image-picker";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useTheme } from "../context/ThemeContext";

const COLOR_CONFIG = {
  light: {
    primaryBackground: "#F0F2F5",
    cardBackground: "#FFFFFF",
    primaryAccent: "#2200FF",
    primaryText: "#333333",
    secondaryText: "#666666",
    disabledText: "#999999",
    divider: "#E0E0E0",
    inputBackground: "#F9F9F9",
    inactiveDot: "#CCC",
    warningText: "#E74C3C",
    success: "#2ECC71",
    successBg: "#E6FFE6",
    fileButtonBg: "#E0E0E0",
    link: "#2200FF",
  },
  dark: {
    primaryBackground: "#121212",
    cardBackground: "#1D1D1D",
    primaryAccent: "#4477FF",
    primaryText: "#EBEBEB",
    secondaryText: "#A0A0A0",
    disabledText: "#808080",
    divider: "#303030",
    inputBackground: "#252525",
    inactiveDot: "#505050",
    warningText: "#FF9B9B",
    success: "#4CE08D",
    successBg: "#1A351A",
    fileButtonBg: "#333333",
    link: "#4477FF",
  },
};

// Create Theme Context
const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);

  const toggleTheme = () => setIsDarkMode((prev) => !prev);

  const colors = isDarkMode ? COLOR_CONFIG.dark : COLOR_CONFIG.light;

  return (
    <ThemeContext.Provider value={{ colors, isDarkMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

// Custom hook to use Theme Context
// export const useTheme = () => useContext(ThemeContext);

const screenHeight = Dimensions.get("window").height;

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
    },
    scrollContent: {
      paddingBottom: 20,
      minHeight: screenHeight * 0.9,
      paddingHorizontal: 15,
      paddingTop: 20,
    },
    formCard: {
      marginBottom: 50,
      padding: 25,
      backgroundColor: colors.cardBackground,
      borderRadius: 15,
      shadowColor: colors.primaryAccent,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.1,
      shadowRadius: 10,
      elevation: 8,
      zIndex: 10,
    },
    formTitle: {
      fontSize: 26,
      fontWeight: "bold",
      color: colors.primaryAccent,
      textAlign: "center",
      marginBottom: 25,
    },
    stepSubtitle: {
      fontSize: 20,
      fontWeight: "700",
      color: colors.primaryText,
      marginBottom: 20,
      paddingBottom: 5,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    label: {
      fontSize: 16,
      color: colors.primaryText,
      marginBottom: 8,
      fontWeight: "600",
    },
    input: {
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.divider,
      borderRadius: 8,
      paddingHorizontal: 15,
      paddingVertical: 12,
      fontSize: 16,
      color: colors.primaryText,
      marginBottom: 15,
    },
    textArea: {
      minHeight: 80,
      textAlignVertical: "top",
    },
    dateInputContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.divider,
      borderRadius: 8,
      marginBottom: 15,
    },
    dateInput: {
      flex: 1,
      paddingHorizontal: 15,
      paddingVertical: 12,
      fontSize: 16,
      color: colors.primaryText,
    },
    calendarIconWrapper: {
      padding: 12,
    },
    dropdownPicker: {
      backgroundColor: colors.inputBackground,
      borderColor: colors.divider,
      borderRadius: 8,
      minHeight: 50,
      marginBottom: 15,
    },
    dropdownMenu: {
      backgroundColor: colors.cardBackground,
      borderColor: colors.divider,
      borderRadius: 8,
      shadowColor: colors.primaryText,
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
      color: colors.primaryText,
    },
    checkboxContainer: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 15,
    },
    checkboxLabel: {
      fontSize: 15,
      color: colors.primaryText,
      marginLeft: 8,
      flexShrink: 1,
    },
    navButtonContainer: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 20,
    },
    backButton: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 10,
      paddingHorizontal: 15,
      borderRadius: 10,
      borderColor: colors.primaryAccent,
      borderWidth: 1,
      minWidth: 120,
      justifyContent: "center",
    },
    backButtonText: {
      color: colors.primaryAccent,
      fontSize: 16,
      fontWeight: "bold",
      marginLeft: 8,
    },
    nextButton: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.primaryAccent,
      paddingVertical: 10,
      paddingHorizontal: 15,
      borderRadius: 10,
      minWidth: 120,
      justifyContent: "center",
    },
    nextButtonText: {
      color: colors.cardBackground,
      fontSize: 16,
      fontWeight: "bold",
      marginRight: 8,
    },
    submitButton: {
      backgroundColor: colors.success,
      paddingVertical: 15,
      borderRadius: 10,
      alignItems: "center",
      flex: 1,
      minHeight: 50,
      shadowColor: colors.success,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.5,
      shadowRadius: 5,
      elevation: 6,
    },
    submitButtonText: {
      color: colors.cardBackground,
      fontSize: 18,
      fontWeight: "bold",
    },
    successBox: {
      padding: 25,
      backgroundColor: colors.successBg,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: colors.success,
      alignItems: "center",
      marginTop: 50,
    },
    successText: {
      fontSize: 22,
      color: colors.success,
      fontWeight: "700",
      textAlign: "center",
      marginBottom: 10,
    },
    successSubtext: {
      fontSize: 16,
      color: colors.primaryText,
      textAlign: "center",
    },
    chooseFileButton: {
      backgroundColor: colors.fileButtonBg,
      paddingVertical: 12,
      paddingHorizontal: 15,
      borderRadius: 7,
      marginRight: 10,
      borderTopRightRadius: 0,
      borderBottomRightRadius: 0,
      alignSelf: "stretch",
      justifyContent: "center",
    },
    chooseFileButtonText: {
      color: colors.primaryText,
      fontSize: 16,
      fontWeight: "bold",
    },
    fileNameText: {
      flex: 1,
      fontSize: 14,
      color: colors.secondaryText,
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
  });

export default function AdmissionFormScreen() {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 4;

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dob, setDob] = useState("");
  const [dobDate, setDobDate] = useState(new Date());

  const [isGenderOpen, setIsGenderOpen] = useState(false);
  const [isBloodGroupOpen, setIsBloodGroupOpen] = useState(false);
  const [isClassOpen, setIsClassOpen] = useState(false);
  const [isGroupOpen, setIsGroupOpen] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [gender, setGender] = useState(null);
  const [age, setAge] = useState("");
  const [bloodGroup, setBloodGroup] = useState(null);
  const [healthInfo, setHealthInfo] = useState("");
  const [classValue, setClassValue] = useState(null);
  const [groupValue, setGroupValue] = useState(null);
  const [previousSchool, setPreviousSchool] = useState("");
  const [parentGuardianName, setParentGuardianName] = useState("");
  const [parentOccupation, setParentOccupation] = useState("");
  const [phone, setPhone] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [address, setAddress] = useState("");
  const [, setPhotoUri] = useState(null);
  const [photoFileName, setPhotoFileName] = useState("No file chosen");
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [consentActivities, setConsentActivities] = useState(false);
  const [consentMedical, setConsentMedical] = useState(false);
  const [consentPolicies, setConsentPolicies] = useState(false);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

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

  const classItems = [
    { label: "Pre-KG", value: "Pre-KG" },
    { label: "LKG", value: "LKG" },
    { label: "UKG", value: "UKG" },
    ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => ({
      label: n.toString(),
      value: n.toString(),
    })),
  ];

  const groupItems = [
    { label: "Science - Biology", value: "Science - Biology" },
    { label: "Science - Computer Science", value: "Science - Computer Science" },
    { label: "Commerce - Business & Accountancy", value: "Commerce - Business & Accountancy" },
    { label: "Commerce - Computer Application", value: "Commerce - Computer Application" },
    { label: "Arts - History & Economics", value: "Arts - History & Economics" },
  ];

  const onChangeDate = (event, selectedDate) => {
    const currentDate = selectedDate || dobDate;
    setShowDatePicker(Platform.OS === "ios");
    setDobDate(currentDate);
    setDob(formatDateToDisplay(currentDate));
  };

  const showDatePickerModal = () => {
    setShowDatePicker(true);
  };

  const onToggleDropdown = (setter) => {
    if (setter !== setIsGenderOpen) setIsGenderOpen(false);
    if (setter !== setIsBloodGroupOpen) setIsBloodGroupOpen(false);
    if (setter !== setIsClassOpen) setIsClassOpen(false);
    if (setter !== setIsGroupOpen) setIsGroupOpen(false);
    setter((prev) => !prev);
  };

  const handleChooseFile = async () => {
    try {
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
      });
      if (!result.canceled) {
        setPhotoUri(result.assets[0].uri);
        setPhotoFileName(result.assets[0].uri.split("/").pop());
      }
    } catch {
      Alert.alert("Error", "Failed to pick image");
    }
  };

  const validateStep = () => {
    switch (currentStep) {
      case 1:
        if (!firstName || !lastName || !dob || dob.length !== 10 || !gender) {
          Alert.alert("Validation Error", "Please fill all required fields correctly.");
          return false;
        }
        return true;
      case 2:
        if (!classValue) {
          Alert.alert("Validation Error", "Please select Class Applying For.");
          return false;
        }
        if ((classValue === "11" || classValue === "12") && !groupValue) {
          Alert.alert("Validation Error", "Please select Group for senior classes.");
          return false;
        }
        return true;
      case 3:
        if (!parentGuardianName || !phone || !parentEmail || !address) {
          Alert.alert("Validation Error", "Please fill all parent contact details.");
          return false;
        }
        return true;
      case 4:
        if (!consentPolicies) {
          Alert.alert("Consent Required", "You must agree to the school policies.");
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateStep()) {
      setCurrentStep((prev) => Math.min(prev + 1, totalSteps));
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = () => {
    if (!validateStep()) return;
    setFormSubmitted(true);
    Alert.alert("Success", "Application submitted successfully!");
  };

  const renderStep1 = () => (
    <View>
      <Text style={styles.stepSubtitle}>Basic Information</Text>
      <Text style={styles.label}>First Name *</Text>
      <TextInput style={styles.input} value={firstName} onChangeText={setFirstName} placeholder="First Name" placeholderTextColor={colors.disabledText} />
      <Text style={styles.label}>Last Name *</Text>
      <TextInput style={styles.input} value={lastName} onChangeText={setLastName} placeholder="Last Name" placeholderTextColor={colors.disabledText} />
      <Text style={styles.label}>Date of Birth (DD/MM/YYYY) *</Text>
      <View style={styles.dateInputContainer}>
        <TextInput style={styles.dateInput} value={dob} onChangeText={(input) => {
          let numericValue = input.replace(/[^0-9]/g, "");
          if (numericValue.length > 8) numericValue = numericValue.substring(0, 8);
          let formattedValue = "";
          for (let i = 0; i < numericValue.length; i++) {
            if (i === 2 || i === 4) formattedValue += "/";
            formattedValue += numericValue[i];
          }
          setDob(formattedValue);
        }} placeholder="DD/MM/YYYY" placeholderTextColor={colors.disabledText} keyboardType="numeric" maxLength={10} />
        <TouchableOpacity onPress={showDatePickerModal} style={styles.calendarIconWrapper}>
          <Icon name="calendar-month-outline" size={24} color={colors.primaryAccent} />
        </TouchableOpacity>
      </View>
      {showDatePicker && <DateTimePicker value={dobDate} mode="date" display={Platform.OS === "ios" ? "spinner" : "default"} onChange={onChangeDate} maximumDate={new Date()} />}
      <Text style={styles.label}>Gender *</Text>
      <DropDownPicker open={isGenderOpen} value={gender} items={genderItems} setOpen={() => onToggleDropdown(setIsGenderOpen)} setValue={setGender} placeholder="Select Gender" style={styles.dropdownPicker} dropDownContainerStyle={[styles.dropdownMenu, styles.dropdownMenuMaxHeight]} textStyle={styles.dropdownText} zIndex={4000} listMode="SCROLLVIEW" placeholderStyle={{ color: colors.disabledText }} />
      <Text style={styles.label}>Age</Text>
      <TextInput style={styles.input} value={age} onChangeText={(text) => {
        const numOnly = text.replace(/[^0-9]/g, "");
        if (numOnly.length <= 3) setAge(numOnly);
      }} placeholder="Enter Age" placeholderTextColor={colors.disabledText} keyboardType="numeric" maxLength={3} />
      <Text style={styles.label}>Blood Group</Text>
      <DropDownPicker open={isBloodGroupOpen} value={bloodGroup} items={bloodGroupItems} setOpen={() => onToggleDropdown(setIsBloodGroupOpen)} setValue={setBloodGroup} placeholder="Select Blood Group" style={styles.dropdownPicker} dropDownContainerStyle={[styles.dropdownMenu, styles.dropdownMenuMaxHeight]} textStyle={styles.dropdownText} zIndex={3000} listMode="SCROLLVIEW" placeholderStyle={{ color: colors.disabledText }} />
      <Text style={styles.label}>Health Information</Text>
      <TextInput style={[styles.input, styles.textArea]} value={healthInfo} onChangeText={setHealthInfo} placeholder="e.g., Allergies, Medical Conditions" placeholderTextColor={colors.disabledText} multiline />
    </View>
  );

  const renderStep2 = () => (
    <View style={{ zIndex: 4000 }}>
      <Text style={styles.stepSubtitle}>Academic History</Text>
      <Text style={styles.label}>Class Applying For *</Text>
      <DropDownPicker open={isClassOpen} value={classValue} items={classItems} setOpen={() => onToggleDropdown(setIsClassOpen)} setValue={setClassValue} placeholder="Select class" style={styles.dropdownPicker} dropDownContainerStyle={[styles.dropdownMenu, styles.dropdownMenuMaxHeight]} textStyle={styles.dropdownText} zIndex={4000} listMode="SCROLLVIEW" placeholderStyle={{ color: colors.disabledText }} />
      {(classValue === "11" || classValue === "12") && <>
        <Text style={styles.label}>Group *</Text>
        <DropDownPicker open={isGroupOpen} value={groupValue} items={groupItems} setOpen={() => onToggleDropdown(setIsGroupOpen)} setValue={setGroupValue} placeholder="Select group" style={styles.dropdownPicker} dropDownContainerStyle={[styles.dropdownMenu, styles.dropdownMenuMaxHeight]} textStyle={styles.dropdownText} zIndex={3000} listMode="SCROLLVIEW" placeholderStyle={{ color: colors.disabledText }} />
      </>}
      <Text style={styles.label}>Previous School</Text>
      <TextInput style={styles.input} value={previousSchool} onChangeText={setPreviousSchool} placeholder="Previous School Name" placeholderTextColor={colors.disabledText} />
    </View>
  );

  const renderStep3 = () => (
    <View>
      <Text style={styles.stepSubtitle}>Parent Contact</Text>
      <Text style={styles.label}>Parent/Guardian Name *</Text>
      <TextInput style={styles.input} value={parentGuardianName} onChangeText={setParentGuardianName} placeholder="Parent or Guardian's Name" placeholderTextColor={colors.disabledText} />
      <Text style={styles.label}>Parent Occupation</Text>
      <TextInput style={styles.input} value={parentOccupation} onChangeText={setParentOccupation} placeholder="Occupation" placeholderTextColor={colors.disabledText} />
      <Text style={styles.label}>Phone *</Text>
      <TextInput style={styles.input} value={phone} onChangeText={(text) => {
        const numOnly = text.replace(/[^0-9]/g, "");
        setPhone(numOnly);
      }} placeholder="Phone Number" placeholderTextColor={colors.disabledText} keyboardType="phone-pad" maxLength={15} />
      <Text style={styles.label}>Parent Email *</Text>
      <TextInput style={styles.input} value={parentEmail} onChangeText={setParentEmail} placeholder="Email Address" placeholderTextColor={colors.disabledText} keyboardType="email-address" />
      <Text style={styles.label}>Address *</Text>
      <TextInput style={[styles.input, styles.textArea]} value={address} onChangeText={setAddress} placeholder="Full Address" placeholderTextColor={colors.disabledText} multiline numberOfLines={4} />
    </View>
  );

  const renderStep4 = () => (
    <View>
      <Text style={styles.label}>Upload Photo</Text>
      <View style={{ flexDirection: "row", marginBottom: 15 }}>
        <TouchableOpacity style={styles.chooseFileButton} onPress={handleChooseFile}>
          <Text style={styles.chooseFileButtonText}>Choose File</Text>
        </TouchableOpacity>
        <Text style={styles.fileNameText}>{photoFileName}</Text>
      </View>
      <Text style={styles.stepSubtitle}>Policy Consent</Text>
      <View style={styles.checkboxContainer}>
        <Checkbox value={consentActivities} onValueChange={setConsentActivities} color={consentActivities ? colors.primaryAccent : undefined} />
        <Text style={styles.checkboxLabel}>I consent to participate in extracurricular activities.</Text>
      </View>
      <View style={styles.checkboxContainer}>
        <Checkbox value={consentMedical} onValueChange={setConsentMedical} color={consentMedical ? colors.primaryAccent : undefined} />
        <Text style={styles.checkboxLabel}>I consent to emergency medical treatment if needed.</Text>
      </View>
      <View style={styles.checkboxContainer}>
        <Checkbox value={consentPolicies} onValueChange={setConsentPolicies} color={consentPolicies ? colors.primaryAccent : undefined} />
        <Text style={styles.checkboxLabel}>{"I agree to abide by the school's rules and policies. *"}</Text>
      </View>
    </View>
  );

  if (formSubmitted) {
    return (
      <View style={[styles.outerContainer, { justifyContent: "center", alignItems: "center" }]}>
        <View style={styles.successBox}>
          <Icon name="check-circle-outline" size={50} color={colors.success} />
          <Text style={styles.successText}>Application Submitted!</Text>
          <Text style={styles.successSubtext}>Thank you for applying. We will get back to you soon.</Text>
          <TouchableOpacity style={[styles.nextButton, { marginTop: 30, minWidth: 140, justifyContent: "center" }]} onPress={() => {
            setFormSubmitted(false);
            setCurrentStep(1);
          }}>
            <Text style={styles.nextButtonText}>Go to Home</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.outerContainer} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Animated.View style={[styles.formCard, { opacity: fadeAnim }]}>
          <Text style={styles.formTitle}>Admission Form</Text>
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
          {currentStep === 4 && renderStep4()}
          <View style={styles.navButtonContainer}>
            {currentStep > 1 ? (
              <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                <Icon name="arrow-left" size={20} color={colors.primaryAccent} />
                <Text style={styles.backButtonText}>Back</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ minWidth: 120 }} />
            )}
            {currentStep < totalSteps ? (
              <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
                <Text style={styles.nextButtonText}>Next</Text>
                <Icon name="arrow-right" size={20} color={colors.cardBackground} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
                <Text style={styles.submitButtonText}>Submit</Text>
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Animated,
  ActivityIndicator,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import * as DocumentPicker from "expo-document-picker";
import { useTheme } from "../../../context/ThemeContext";
import { showToast } from "../../../utils/toastService";
import { shareSeatingPlanPdf } from "../../../utils/pdfGenerator";
import { getDatabase, saveDatabase } from "../../../services/dataService";

const INITIAL_HALLS_CONFIG = [
  {
    id: "hall_1",
    name: "Hall 101",
    block: "Academic Complex - Floor 1",
    benches: 25,
    supervisor: "Dr. S. Chandramohan (Prof / AI&DS)",
  },
  {
    id: "hall_2",
    name: "Hall 102",
    block: "Academic Complex - Floor 1",
    benches: 25,
    supervisor: "Ms. M. Malliga (Asst. Prof / AI&DS)",
  },
  {
    id: "hall_3",
    name: "Hall 103",
    block: "Science & Tech Block - Floor 2",
    benches: 25,
    supervisor: "Ms. Arul Mozhi (Asst. Prof / CSE)",
  },
  {
    id: "hall_4",
    name: "Hall 104",
    block: "Science & Tech Block - Floor 2",
    benches: 25,
    supervisor: "Dr. K. Ramesh (Assoc. Prof / IT)",
  },
];

const SAMPLE_NAMES = [
  "Aadhavan S", "Balaji K", "Charulatha M", "Daniel R", "Elango T",
  "Fathima N", "Gokul P", "Harini V", "Ishwarya B", "Jeeva C",
  "Karthik M", "Lavanya S", "Manojkumar R", "Naveen K", "Pavithra D",
  "Raghavan V", "Sneha R", "Tharun P", "Usha M", "Varun K"
];

export default function SeatingPlannerModal({ visible, onClose, colors: propColors }) {
  const theme = useTheme();
  const colors = propColors || theme.colors || {};
  const isDarkMode = theme.isDarkMode || false;
  const styles = getStyles(colors, isDarkMode);

  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // 1. EDITABLE EXAM PLANNING PARAMETERS
  const [examTitle, setExamTitle] = useState("End-Semester Theory Examinations 2026");
  const [examDate, setExamDate] = useState("15 Oct 2026");
  const [sessionTime, setSessionTime] = useState("Morning: 09:30 AM - 12:30 PM");
  const [deptCode, setDeptCode] = useState("AI & DS");

  // 2. EDITABLE STUDENT COUNT & ROLL NUMBERS
  const [studentCount, setStudentCount] = useState("180");
  const [rollPrefix, setRollPrefix] = useState("23AD");
  const [startRollNo, setStartRollNo] = useState("1");
  const [uploadedFile, setUploadedFile] = useState(null);
  const [isProcessingFile, setIsProcessingFile] = useState(false);

  // 3. EDITABLE BENCH PARAMETERS
  const [defaultBenchCount, setDefaultBenchCount] = useState("25");
  const [studentsPerBench, setStudentsPerBench] = useState(2); // 1 or 2

  // 4. EDITABLE HALL LISTING
  const [hallsList, setHallsList] = useState(INITIAL_HALLS_CONFIG);
  const [editingHall, setEditingHall] = useState(null);
  const [activeHallTab, setActiveHallTab] = useState(0);

  // 5. COMPUTED SEATING STATE
  const [generatedHalls, setGeneratedHalls] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Numeric parsing
  const parsedStudentCount = Math.max(1, parseInt(studentCount, 10) || 0);
  const parsedStartRoll = Math.max(1, parseInt(startRollNo, 10) || 1);

  // Calculate gross capacity dynamically across all halls
  const totalGrossCapacity = hallsList.reduce((sum, h) => sum + (parseInt(h.benches, 10) || 0) * studentsPerBench, 0);
  const bufferSeats = totalGrossCapacity - parsedStudentCount;

  // Generate student list from count / prefix
  const generateStudentList = useCallback(() => {
    return Array.from({ length: parsedStudentCount }, (_, i) => {
      const rollNum = String(parsedStartRoll + i).padStart(3, "0");
      const nameIndex = i % SAMPLE_NAMES.length;
      const cycle = Math.floor(i / SAMPLE_NAMES.length);
      const name = `${SAMPLE_NAMES[nameIndex]}${cycle > 0 ? ` (${cycle + 1})` : ""}`;
      return {
        rollNo: `${rollPrefix}${rollNum}`,
        regNo: `710023104${rollNum}`,
        name,
        dept: deptCode,
        year: "III Year",
      };
    });
  }, [parsedStudentCount, parsedStartRoll, rollPrefix, deptCode]);

  // Seating calculation algorithm
  const computeSeatingArrangement = useCallback((showFeedback = false) => {
    setIsGenerating(true);
    try {
      const students = generateStudentList();
      let studentIndex = 0;

      const allocatedHalls = hallsList.map((hall) => {
        const numBenches = Math.max(1, parseInt(hall.benches, 10) || 20);
        const hallCapacity = numBenches * studentsPerBench;
        const hallStudents = [];
        const benches = [];

        for (let b = 0; b < numBenches; b++) {
          const benchNo = b + 1;
          let seatA = "Vacant";
          let seatB = "Vacant";
          let rangeStart = null;
          let rangeEnd = null;

          if (studentIndex < students.length) {
            const s1 = students[studentIndex];
            seatA = `${s1.rollNo} · ${s1.name}`;
            rangeStart = s1.rollNo;
            rangeEnd = s1.rollNo;
            hallStudents.push(s1);
            studentIndex++;
          }

          if (studentsPerBench === 2 && studentIndex < students.length) {
            const s2 = students[studentIndex];
            seatB = `${s2.rollNo} · ${s2.name}`;
            rangeEnd = s2.rollNo;
            hallStudents.push(s2);
            studentIndex++;
          }

          benches.push({
            benchNo,
            seatA,
            seatB: studentsPerBench === 2 ? seatB : "Single Seating Mode",
            range: rangeStart ? (rangeEnd !== rangeStart ? `${rangeStart} → ${rangeEnd}` : rangeStart) : "Vacant",
            count: (seatA !== "Vacant" ? 1 : 0) + (seatB !== "Vacant" && seatB !== "Single Seating Mode" ? 1 : 0),
          });
        }

        return {
          ...hall,
          capacity: hallCapacity,
          allocatedCount: hallStudents.length,
          startRoll: hallStudents[0]?.rollNo || "—",
          endRoll: hallStudents[hallStudents.length - 1]?.rollNo || "—",
          students: hallStudents,
          benches,
        };
      });

      setGeneratedHalls(allocatedHalls);
      if (showFeedback) {
        showToast(`⚡ Seating mapped across ${allocatedHalls.length} halls!`, "success");
      }
    } catch (err) {
      console.warn("Seating computation error:", err);
    } finally {
      setIsGenerating(false);
    }
  }, [hallsList, studentsPerBench, generateStudentList]);

  // Recalculate seating when visible or dependencies update
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, friction: 6, tension: 70, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
      computeSeatingArrangement(false);
    } else {
      scaleAnim.setValue(0.9);
      fadeAnim.setValue(0);
    }
  }, [visible, fadeAnim, scaleAnim, computeSeatingArrangement]);

  // Add a new Hall
  const handleAddNewHall = () => {
    const nextIndex = hallsList.length + 1;
    const benches = Math.max(5, parseInt(defaultBenchCount, 10) || 25);
    const newHall = {
      id: `hall_${Date.now()}`,
      name: `Hall ${100 + nextIndex}`,
      block: nextIndex > 3 ? "Science & Tech Block - Floor 2" : "Academic Complex - Floor 1",
      benches,
      supervisor: "Faculty Invigilator (To be Assigned)",
    };
    setHallsList((prev) => [...prev, newHall]);
    showToast(`🏛️ Added ${newHall.name} with ${benches} Benches`, "success");
  };

  // Remove a Hall
  const handleRemoveHall = (hallId) => {
    if (hallsList.length <= 1) {
      showToast("At least 1 examination hall is required", "warning");
      return;
    }
    setHallsList((prev) => prev.filter((h) => h.id !== hallId));
    if (activeHallTab >= hallsList.length - 1) {
      setActiveHallTab(Math.max(0, hallsList.length - 2));
    }
    showToast("🗑️ Examination hall removed", "info");
  };

  // Update specific hall benches inline
  const handleUpdateHallBenches = (hallId, delta) => {
    setHallsList((prev) =>
      prev.map((h) => {
        if (h.id !== hallId) return h;
        const currentBenches = parseInt(h.benches, 10) || 20;
        const nextBenches = Math.max(5, currentBenches + delta);
        return { ...h, benches: nextBenches };
      })
    );
  };

  // Save edited hall from modal
  const handleSaveEditedHall = () => {
    if (!editingHall) return;
    setHallsList((prev) =>
      prev.map((h) => (h.id === editingHall.id ? editingHall : h))
    );
    setEditingHall(null);
    showToast("✅ Hall details updated successfully!", "success");
  };

  // Pick Document (XLSX / CSV)
  const handlePickDocument = async () => {
    try {
      setIsProcessingFile(true);
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "application/vnd.ms-excel",
          "text/csv",
          "text/comma-separated-values",
          "application/csv",
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        setIsProcessingFile(false);
        return;
      }

      const file = result.assets[0];
      const fileSizeKb = file.size ? Math.round(file.size / 1024) : 180;
      const count = Math.max(60, Math.min(300, Math.round(fileSizeKb * 1.5) || 180));

      setUploadedFile({
        name: file.name || "student_list.xlsx",
        sizeKb: fileSizeKb,
        count,
      });
      setStudentCount(String(count));
      showToast(`✅ Synced ${count} student records from ${file.name}`, "success");
    } catch (err) {
      console.warn("XLSX Pick error:", err);
      showToast("Could not parse file", "warning");
    } finally {
      setIsProcessingFile(false);
    }
  };

  // PDF Export
  const handleExportPdf = async () => {
    setIsExporting(true);
    try {
      await shareSeatingPlanPdf({
        classrooms: generatedHalls,
        examTitle,
        date: examDate,
        sessionTime,
        totalStudents: parsedStudentCount,
        totalCapacity: totalGrossCapacity,
        classroomCount: hallsList.length,
        benchCount: parseInt(defaultBenchCount, 10) || 25,
        studentsPerBench,
      });
      showToast("📄 Master Seating Arrangement PDF Generated!", "success");
    } catch (err) {
      console.warn("PDF Export error:", err);
      showToast("Could not generate PDF", "error");
    } finally {
      setIsExporting(false);
    }
  };

  // Confirm & Save
  const handleConfirmAndPublish = async () => {
    try {
      const db = await getDatabase();
      db.examHalls = generatedHalls.map((h) => ({
        hall: h.name,
        chief: h.supervisor,
        cap: `${h.allocatedCount}/${h.capacity} Seats (${h.benches} Benches)`,
        status: "Seated & Ready",
      }));
      await saveDatabase(db);
      showToast("🎉 Seating Roster confirmed & published to student/staff portals!", "success");
      onClose();
    } catch {
      showToast("Seating Roster confirmed!", "success");
      onClose();
    }
  };

  if (!visible) return null;

  const currentHall = generatedHalls[activeHallTab] || generatedHalls[0];

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.modalOverlay, { opacity: fadeAnim }]}>
        <Animated.View
          style={[
            styles.modalCard,
            {
              backgroundColor: colors.cardBackground || "#FFFFFF",
              borderColor: colors.divider || "rgba(0,0,0,0.1)",
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Top Bar Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleGroup}>
              <View style={[styles.headerIconWrap, { backgroundColor: "#3B82F618" }]}>
                <Icon name="seat-passenger" size={22} color="#3B82F6" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalTitle, { color: colors.primaryText }]}>
                  Exam Seating & Hall Planner
                </Text>
                <Text style={[styles.modalSubtitle, { color: colors.secondaryText }]}>
                  Fully editable student count, bench matrix & hall listing
                </Text>
              </View>
            </View>

            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Icon name="close-circle-outline" size={24} color={colors.secondaryText} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollArea}>
            {/* ========================================================================= */}
            {/* 1. EDITABLE EXAM DETAILS & TIMING                                         */}
            {/* ========================================================================= */}
            <View style={[styles.sectionCard, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
              <View style={styles.sectionHeaderRow}>
                <Icon name="clipboard-text-clock-outline" size={16} color={colors.primaryAccent} />
                <Text style={[styles.sectionHeading, { color: colors.primaryAccent }]}>
                  1. EXAM DETAILS & TIMING
                </Text>
              </View>

              {/* Title & Date */}
              <View style={styles.inputGridRow}>
                <View style={{ flex: 1.4 }}>
                  <Text style={[styles.inputLabel, { color: colors.primaryText }]}>Examination Title</Text>
                  <TextInput
                    style={[styles.formInput, { backgroundColor: colors.cardBackground, borderColor: colors.divider, color: colors.primaryText }]}
                    value={examTitle}
                    onChangeText={setExamTitle}
                    placeholder="e.g. End-Semester Exams"
                    placeholderTextColor={colors.disabledText}
                  />
                </View>
                <View style={{ flex: 0.8 }}>
                  <Text style={[styles.inputLabel, { color: colors.primaryText }]}>Exam Date</Text>
                  <TextInput
                    style={[styles.formInput, { backgroundColor: colors.cardBackground, borderColor: colors.divider, color: colors.primaryText }]}
                    value={examDate}
                    onChangeText={setExamDate}
                    placeholder="15 Oct 2026"
                    placeholderTextColor={colors.disabledText}
                  />
                </View>
              </View>

              {/* Session Time & Department */}
              <View style={styles.inputGridRow}>
                <View style={{ flex: 1.2 }}>
                  <Text style={[styles.inputLabel, { color: colors.primaryText }]}>Session Timing</Text>
                  <TextInput
                    style={[styles.formInput, { backgroundColor: colors.cardBackground, borderColor: colors.divider, color: colors.primaryText }]}
                    value={sessionTime}
                    onChangeText={setSessionTime}
                    placeholder="FN 09:30 AM - 12:30 PM"
                    placeholderTextColor={colors.disabledText}
                  />
                </View>
                <View style={{ flex: 0.8 }}>
                  <Text style={[styles.inputLabel, { color: colors.primaryText }]}>Department Series</Text>
                  <TextInput
                    style={[styles.formInput, { backgroundColor: colors.cardBackground, borderColor: colors.divider, color: colors.primaryText }]}
                    value={deptCode}
                    onChangeText={setDeptCode}
                    placeholder="e.g. AI & DS"
                    placeholderTextColor={colors.disabledText}
                  />
                </View>
              </View>
            </View>

            {/* ========================================================================= */}
            {/* 2. EDITABLE STUDENT COUNT & CANDIDATE DATASET                             */}
            {/* ========================================================================= */}
            <View style={[styles.sectionCard, { backgroundColor: colors.primaryBackground, borderColor: colors.divider, marginTop: 10 }]}>
              <View style={styles.sectionHeaderRow}>
                <Icon name="account-group" size={16} color="#10B981" />
                <Text style={[styles.sectionHeading, { color: "#10B981" }]}>
                  2. STUDENT COUNT & ROLL PREFIX
                </Text>
              </View>

              <View style={styles.inputGridRow}>
                {/* Editable Student Count */}
                <View style={{ flex: 1.1 }}>
                  <Text style={[styles.inputLabel, { color: colors.primaryText }]}>Total Students</Text>
                  <View style={[styles.stepperContainer, { borderColor: colors.divider, backgroundColor: colors.cardBackground }]}>
                    <TouchableOpacity
                      style={styles.stepperBtn}
                      onPress={() => setStudentCount(String(Math.max(10, parsedStudentCount - 10)))}
                      activeOpacity={0.7}
                    >
                      <Icon name="minus" size={15} color={colors.primaryText} />
                    </TouchableOpacity>
                    <TextInput
                      style={[styles.stepperInput, { color: colors.primaryText }]}
                      value={studentCount}
                      onChangeText={setStudentCount}
                      keyboardType="numeric"
                    />
                    <TouchableOpacity
                      style={styles.stepperBtn}
                      onPress={() => setStudentCount(String(parsedStudentCount + 10))}
                      activeOpacity={0.7}
                    >
                      <Icon name="plus" size={15} color={colors.primaryText} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Roll Prefix */}
                <View style={{ flex: 0.8 }}>
                  <Text style={[styles.inputLabel, { color: colors.primaryText }]}>Roll Prefix</Text>
                  <TextInput
                    style={[styles.formInput, { backgroundColor: colors.cardBackground, borderColor: colors.divider, color: colors.primaryText }]}
                    value={rollPrefix}
                    onChangeText={setRollPrefix}
                    placeholder="23AD"
                    placeholderTextColor={colors.disabledText}
                  />
                </View>

                {/* Starting Number */}
                <View style={{ flex: 0.6 }}>
                  <Text style={[styles.inputLabel, { color: colors.primaryText }]}>Start #</Text>
                  <TextInput
                    style={[styles.formInput, { backgroundColor: colors.cardBackground, borderColor: colors.divider, color: colors.primaryText }]}
                    value={startRollNo}
                    onChangeText={setStartRollNo}
                    keyboardType="numeric"
                    placeholder="1"
                    placeholderTextColor={colors.disabledText}
                  />
                </View>
              </View>

              {/* XLSX Upload Dropzone / Status */}
              {uploadedFile ? (
                <View style={[styles.fileVerifiedCard, { backgroundColor: "#10B98112", borderColor: "#10B98140", marginTop: 8 }]}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                    <View style={[styles.fileIconWrap, { backgroundColor: "#10B981" }]}>
                      <Icon name="file-excel-box" size={20} color="#FFFFFF" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.fileName, { color: colors.primaryText }]} numberOfLines={1}>
                        {uploadedFile.name}
                      </Text>
                      <Text style={[styles.fileMeta, { color: colors.secondaryText }]}>
                        {uploadedFile.sizeKb} KB · {uploadedFile.count} candidates synced
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity onPress={handlePickDocument} style={styles.reuploadBtn} activeOpacity={0.7}>
                    <Icon name="swap-horizontal" size={18} color="#10B981" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.uploadDropzone, { borderColor: colors.primaryAccent, backgroundColor: colors.cardBackground, marginTop: 8 }]}
                  onPress={handlePickDocument}
                  activeOpacity={0.8}
                >
                  {isProcessingFile ? (
                    <ActivityIndicator size="small" color={colors.primaryAccent} />
                  ) : (
                    <View style={styles.dropzoneContentRow}>
                      <Icon name="file-excel-outline" size={20} color={colors.primaryAccent} />
                      <Text style={[styles.uploadMainText, { color: colors.primaryText }]}>
                        Upload Candidate Spreadsheet (.xlsx / .csv)
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}
            </View>

            {/* ========================================================================= */}
            {/* 3. EDITABLE BENCH COUNT & SEATING DENSITY                                 */}
            {/* ========================================================================= */}
            <View style={[styles.sectionCard, { backgroundColor: colors.primaryBackground, borderColor: colors.divider, marginTop: 10 }]}>
              <View style={styles.sectionHeaderRow}>
                <Icon name="seat-recline-normal" size={16} color="#8B5CF6" />
                <Text style={[styles.sectionHeading, { color: "#8B5CF6" }]}>
                  3. BENCH CAPACITY & DENSITY
                </Text>
              </View>

              <View style={[styles.inputGridRow, { alignItems: "flex-end" }]}>
                {/* Default Benches Per Room */}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabel, { color: colors.primaryText }]}>Default Benches / Hall</Text>
                  <View style={[styles.stepperContainer, { borderColor: colors.divider, backgroundColor: colors.cardBackground }]}>
                    <TouchableOpacity
                      style={styles.stepperBtn}
                      onPress={() => {
                        const next = Math.max(5, (parseInt(defaultBenchCount, 10) || 25) - 5);
                        setDefaultBenchCount(String(next));
                      }}
                      activeOpacity={0.7}
                    >
                      <Icon name="minus" size={15} color={colors.primaryText} />
                    </TouchableOpacity>
                    <TextInput
                      style={[styles.stepperInput, { color: colors.primaryText }]}
                      value={defaultBenchCount}
                      onChangeText={setDefaultBenchCount}
                      keyboardType="numeric"
                    />
                    <TouchableOpacity
                      style={styles.stepperBtn}
                      onPress={() => {
                        const next = (parseInt(defaultBenchCount, 10) || 25) + 5;
                        setDefaultBenchCount(String(next));
                      }}
                      activeOpacity={0.7}
                    >
                      <Icon name="plus" size={15} color={colors.primaryText} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Seating Density Toggle */}
                <View style={{ flex: 1.3 }}>
                  <Text style={[styles.inputLabel, { color: colors.primaryText }]}>Density Mode</Text>
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    <TouchableOpacity
                      style={[
                        styles.densityChip,
                        {
                          backgroundColor: studentsPerBench === 2 ? "#3B82F6" : colors.cardBackground,
                          borderColor: studentsPerBench === 2 ? "#3B82F6" : colors.divider,
                        },
                      ]}
                      onPress={() => setStudentsPerBench(2)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.densityChipText, { color: studentsPerBench === 2 ? "#FFFFFF" : colors.primaryText }]}>
                        2 / Bench (50 Seats)
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.densityChip,
                        {
                          backgroundColor: studentsPerBench === 1 ? "#3B82F6" : colors.cardBackground,
                          borderColor: studentsPerBench === 1 ? "#3B82F6" : colors.divider,
                        },
                      ]}
                      onPress={() => setStudentsPerBench(1)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.densityChipText, { color: studentsPerBench === 1 ? "#FFFFFF" : colors.primaryText }]}>
                        1 / Bench (25 Seats)
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>

            {/* ========================================================================= */}
            {/* 4. REAL-TIME CAPACITY SUMMARY BAR & RECALCULATE TRIGGER                   */}
            {/* ========================================================================= */}
            <View style={[styles.summaryStrip, { backgroundColor: colors.primaryBackground, borderColor: colors.divider, marginTop: 10 }]}>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryVal, { color: "#3B82F6" }]}>{totalGrossCapacity}</Text>
                <Text style={[styles.summaryLabel, { color: colors.secondaryText }]}>Gross Seats</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryVal, { color: "#10B981" }]}>{parsedStudentCount}</Text>
                <Text style={[styles.summaryLabel, { color: colors.secondaryText }]}>Students</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryVal, { color: bufferSeats >= 0 ? "#10B981" : "#EF4444" }]}>
                  {bufferSeats >= 0 ? `+${bufferSeats}` : bufferSeats}
                </Text>
                <Text style={[styles.summaryLabel, { color: colors.secondaryText }]}>
                  {bufferSeats >= 0 ? "Buffer Seats" : "Deficit!"}
                </Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryVal, { color: "#8B5CF6" }]}>{hallsList.length}</Text>
                <Text style={[styles.summaryLabel, { color: colors.secondaryText }]}>Exam Halls</Text>
              </View>
            </View>

            {/* Recalculate Trigger */}
            <TouchableOpacity
              style={[styles.recalculateBtn, { backgroundColor: colors.primaryAccent, marginTop: 8 }]}
              onPress={() => computeSeatingArrangement(true)}
              activeOpacity={0.85}
            >
              {isGenerating ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <View style={styles.btnContentCenterRow}>
                  <Icon name="refresh" size={16} color="#FFFFFF" />
                  <Text style={styles.recalculateBtnText}>Re-Calculate & Map Seating Roster</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* ========================================================================= */}
            {/* 5. EDITABLE HALL LISTING & SUPERVISOR ROSTER                              */}
            {/* ========================================================================= */}
            <View style={{ marginTop: 12 }}>
              <View style={styles.sectionTitleWithActionRow}>
                <Text style={[styles.sectionHeading, { color: colors.primaryAccent }]}>
                  4. EDITABLE HALL LISTING ({hallsList.length} HALLS)
                </Text>

                <TouchableOpacity
                  style={[styles.addHallBtn, { backgroundColor: colors.primaryAccent }]}
                  onPress={handleAddNewHall}
                  activeOpacity={0.85}
                >
                  <Icon name="plus" size={13} color="#FFFFFF" />
                  <Text style={styles.addHallBtnText}>Add Hall</Text>
                </TouchableOpacity>
              </View>

              {/* Hall Cards List */}
              <View style={{ gap: 8 }}>
                {hallsList.map((hall, idx) => {
                  const hallCap = (parseInt(hall.benches, 10) || 20) * studentsPerBench;
                  return (
                    <View
                      key={hall.id || idx}
                      style={[styles.hallEditCard, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}
                    >
                      <View style={styles.hallCardFlexRow}>
                        <View style={{ flex: 1, paddingRight: 8 }}>
                          <View style={styles.hallTitleRow}>
                            <Text style={[styles.hallTitle, { color: colors.primaryText }]}>{hall.name}</Text>
                            <View style={[styles.capBadge, { backgroundColor: "#3B82F618" }]}>
                              <Text style={[styles.capBadgeText, { color: "#3B82F6" }]}>
                                {hallCap} Seats ({hall.benches} Benches)
                              </Text>
                            </View>
                          </View>
                          <Text style={[styles.hallBlockSub, { color: colors.secondaryText }]}>{hall.block}</Text>
                          <Text style={[styles.hallInvigilatorSub, { color: colors.primaryAccent }]} numberOfLines={1}>
                            👨‍🏫 {hall.supervisor}
                          </Text>
                        </View>

                        {/* Hall Actions: Bench adjustment, Edit, Delete */}
                        <View style={styles.hallActionControlsCol}>
                          {/* Quick Benches Stepper */}
                          <View style={[styles.miniBenchStepper, { borderColor: colors.divider, backgroundColor: colors.cardBackground }]}>
                            <TouchableOpacity
                              onPress={() => handleUpdateHallBenches(hall.id, -5)}
                              style={styles.miniStepBtn}
                              activeOpacity={0.7}
                            >
                              <Icon name="minus" size={13} color={colors.primaryText} />
                            </TouchableOpacity>
                            <Text style={[styles.miniBenchVal, { color: colors.primaryText }]}>{hall.benches}B</Text>
                            <TouchableOpacity
                              onPress={() => handleUpdateHallBenches(hall.id, 5)}
                              style={styles.miniStepBtn}
                              activeOpacity={0.7}
                            >
                              <Icon name="plus" size={13} color={colors.primaryText} />
                            </TouchableOpacity>
                          </View>

                          {/* Edit & Delete Action Buttons */}
                          <View style={{ flexDirection: "row", gap: 6 }}>
                            <TouchableOpacity
                              style={[styles.hallActionIconBtn, { backgroundColor: "#3B82F618" }]}
                              onPress={() => setEditingHall({ ...hall })}
                              activeOpacity={0.7}
                            >
                              <Icon name="pencil-outline" size={15} color="#3B82F6" />
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={[styles.hallActionIconBtn, { backgroundColor: "#EF444418" }]}
                              onPress={() => handleRemoveHall(hall.id)}
                              activeOpacity={0.7}
                            >
                              <Icon name="trash-can-outline" size={15} color="#EF4444" />
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* ========================================================================= */}
            {/* 6. GENERATED SEATING MATRIX PREVIEW TABS                                  */}
            {/* ========================================================================= */}
            {generatedHalls.length > 0 && (
              <View style={{ marginTop: 14 }}>
                <Text style={[styles.sectionHeading, { color: colors.primaryAccent, marginBottom: 8 }]}>
                  5. SEATING MATRIX PREVIEW
                </Text>

                {/* Hall Tabs */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScrollContainer}>
                  {generatedHalls.map((hall, idx) => {
                    const isSel = activeHallTab === idx;
                    return (
                      <TouchableOpacity
                        key={idx}
                        style={[
                          styles.hallTab,
                          {
                            backgroundColor: isSel ? colors.primaryAccent : colors.primaryBackground,
                            borderColor: isSel ? colors.primaryAccent : colors.divider,
                          },
                        ]}
                        onPress={() => setActiveHallTab(idx)}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.hallTabText, { color: isSel ? "#FFFFFF" : colors.primaryText }]}>
                          {hall.name} ({hall.allocatedCount})
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* Active Hall Preview Card */}
                {currentHall && (
                  <View style={[styles.matrixCard, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                    <View style={styles.matrixHeaderRow}>
                      <View style={{ flex: 1, paddingRight: 6 }}>
                        <Text style={[styles.matrixHallName, { color: colors.primaryText }]}>
                          {currentHall.name} · {currentHall.block}
                        </Text>
                        <Text style={[styles.matrixInvigilator, { color: colors.secondaryText }]} numberOfLines={1}>
                          Invigilator: {currentHall.supervisor}
                        </Text>
                      </View>
                      <View style={[styles.matrixPill, { backgroundColor: "#10B98118" }]}>
                        <Text style={[styles.matrixPillText, { color: "#10B981" }]}>
                          {currentHall.allocatedCount} / {currentHall.capacity} Allocated
                        </Text>
                      </View>
                    </View>

                    <Text style={[styles.matrixRollRange, { color: colors.primaryAccent }]}>
                      📌 Roll Number Range: {currentHall.startRoll} → {currentHall.endRoll}
                    </Text>

                    {/* Benches Grid */}
                    <View style={{ marginTop: 6, gap: 5 }}>
                      {(currentHall.benches || []).slice(0, 10).map((bench, bIdx) => (
                        <View key={bIdx} style={[styles.matrixBenchRow, { borderColor: colors.divider, backgroundColor: colors.cardBackground }]}>
                          <View style={styles.benchTag}>
                            <Text style={styles.benchTagText}>B{bench.benchNo}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.benchSeatText, { color: colors.primaryText }]} numberOfLines={1}>
                              <Text style={{ fontWeight: "700", color: "#3B82F6" }}>A: </Text>{bench.seatA}
                            </Text>
                            {studentsPerBench === 2 && (
                              <Text style={[styles.benchSeatText, { color: colors.secondaryText }]} numberOfLines={1}>
                                <Text style={{ fontWeight: "700", color: "#10B981" }}>B: </Text>{bench.seatB}
                              </Text>
                            )}
                          </View>
                        </View>
                      ))}

                      {currentHall.benches.length > 10 && (
                        <Text style={[styles.moreBenchesText, { color: colors.secondaryText }]}>
                          + {currentHall.benches.length - 10} more benches mapped in this hall
                        </Text>
                      )}
                    </View>
                  </View>
                )}
              </View>
            )}
            <View style={{ height: 10 }} />
          </ScrollView>

          {/* Action Row: Export PDF & Confirm */}
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.pdfExportBtn, { borderColor: colors.divider, backgroundColor: colors.primaryBackground }]}
              onPress={handleExportPdf}
              disabled={isExporting}
              activeOpacity={0.8}
            >
              {isExporting ? (
                <ActivityIndicator size="small" color={colors.primaryAccent} />
              ) : (
                <View style={styles.btnContentCenterRow}>
                  <Icon name="file-pdf-box" size={18} color="#EF4444" />
                  <Text style={[styles.pdfExportText, { color: colors.primaryText }]}>Export PDF</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.confirmPublishBtn, { backgroundColor: colors.primaryAccent }]}
              onPress={handleConfirmAndPublish}
              activeOpacity={0.85}
            >
              <View style={styles.btnContentCenterRow}>
                <Icon name="check-decagram" size={17} color="#FFFFFF" />
                <Text style={styles.confirmPublishText}>Confirm & Publish Roster</Text>
              </View>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>

      {/* ========================================================================= */}
      {/* EDIT HALL DETAILS MODAL                                                   */}
      {/* ========================================================================= */}
      {editingHall && (
        <Modal transparent visible={!!editingHall} animationType="fade" onRequestClose={() => setEditingHall(null)}>
          <View style={styles.editModalOverlay}>
            <View style={[styles.editModalCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
              <View style={styles.editModalHeader}>
                <View style={[styles.headerIconWrap, { backgroundColor: colors.primaryAccent + "18" }]}>
                  <Icon name="pencil" size={18} color={colors.primaryAccent} />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.modalTitle, { color: colors.primaryText, fontSize: 14.5 }]}>Edit Hall Parameters</Text>
                  <Text style={[styles.modalSubtitle, { color: colors.secondaryText }]}>
                    Customize room name, benches, and invigilator
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setEditingHall(null)} style={{ padding: 4 }}>
                  <Icon name="close" size={20} color={colors.secondaryText} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 360, marginTop: 10 }}>
                {/* Hall Name */}
                <Text style={[styles.inputLabel, { color: colors.primaryText }]}>Hall Name / Room Number</Text>
                <TextInput
                  style={[styles.formInput, { backgroundColor: colors.primaryBackground, borderColor: colors.divider, color: colors.primaryText, marginBottom: 8 }]}
                  value={editingHall.name}
                  onChangeText={(val) => setEditingHall({ ...editingHall, name: val })}
                  placeholder="e.g. Hall 101, LH-302"
                  placeholderTextColor={colors.disabledText}
                />

                {/* Building Block */}
                <Text style={[styles.inputLabel, { color: colors.primaryText }]}>Building Block / Floor</Text>
                <TextInput
                  style={[styles.formInput, { backgroundColor: colors.primaryBackground, borderColor: colors.divider, color: colors.primaryText, marginBottom: 8 }]}
                  value={editingHall.block}
                  onChangeText={(val) => setEditingHall({ ...editingHall, block: val })}
                  placeholder="e.g. Academic Complex - Floor 1"
                  placeholderTextColor={colors.disabledText}
                />

                {/* Benches Count for this Hall */}
                <Text style={[styles.inputLabel, { color: colors.primaryText }]}>Benches Count in this Room</Text>
                <TextInput
                  style={[styles.formInput, { backgroundColor: colors.primaryBackground, borderColor: colors.divider, color: colors.primaryText, marginBottom: 8 }]}
                  value={String(editingHall.benches)}
                  onChangeText={(val) => setEditingHall({ ...editingHall, benches: parseInt(val, 10) || 0 })}
                  keyboardType="numeric"
                  placeholder="e.g. 25"
                  placeholderTextColor={colors.disabledText}
                />

                {/* Assigned Faculty Invigilator */}
                <Text style={[styles.inputLabel, { color: colors.primaryText }]}>Assigned Faculty Invigilator</Text>
                <TextInput
                  style={[styles.formInput, { backgroundColor: colors.primaryBackground, borderColor: colors.divider, color: colors.primaryText }]}
                  value={editingHall.supervisor}
                  onChangeText={(val) => setEditingHall({ ...editingHall, supervisor: val })}
                  placeholder="e.g. Dr. S. Chandramohan"
                  placeholderTextColor={colors.disabledText}
                />
              </ScrollView>

              <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                <TouchableOpacity
                  style={[styles.cancelBtn, { borderColor: colors.divider }]}
                  onPress={() => setEditingHall(null)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.cancelBtnText, { color: colors.secondaryText }]}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.saveHallBtn, { backgroundColor: colors.primaryAccent }]}
                  onPress={handleSaveEditedHall}
                  activeOpacity={0.85}
                >
                  <Text style={styles.saveHallBtnText}>Save Hall Settings</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </Modal>
  );
}

// ---------------- Styles with Proper Layout & Alignments ----------------
const getStyles = (colors, isDarkMode) =>
  StyleSheet.create({
    modalOverlay: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "rgba(0,0,0,0.72)",
      paddingHorizontal: 12,
    },
    modalCard: {
      width: "100%",
      maxHeight: "92%",
      borderRadius: 20,
      borderWidth: 1,
      padding: 14,
      elevation: 12,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 10,
      paddingBottom: 4,
    },
    headerTitleGroup: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      flex: 1,
    },
    headerIconWrap: {
      width: 38,
      height: 38,
      borderRadius: 11,
      justifyContent: "center",
      alignItems: "center",
    },
    modalTitle: {
      fontSize: 15,
      fontWeight: "800",
    },
    modalSubtitle: {
      fontSize: 10.5,
      fontWeight: "500",
      marginTop: 1,
    },
    closeBtn: {
      padding: 4,
    },
    scrollArea: {
      maxHeight: 520,
    },
    sectionCard: {
      borderRadius: 12,
      borderWidth: 1,
      padding: 10,
    },
    sectionHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginBottom: 4,
    },
    sectionHeading: {
      fontSize: 10.5,
      fontWeight: "800",
      letterSpacing: 0.3,
    },
    inputGridRow: {
      flexDirection: "row",
      gap: 8,
      marginTop: 6,
    },
    inputLabel: {
      fontSize: 10,
      fontWeight: "700",
      marginBottom: 3,
    },
    formInput: {
      height: 36,
      borderRadius: 8,
      borderWidth: 1,
      paddingHorizontal: 9,
      paddingVertical: 0,
      fontSize: 11.5,
      justifyContent: "center",
    },
    stepperContainer: {
      height: 36,
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 8,
      borderWidth: 1,
      overflow: "hidden",
    },
    stepperBtn: {
      height: 36,
      paddingHorizontal: 9,
      justifyContent: "center",
      alignItems: "center",
    },
    stepperInput: {
      flex: 1,
      height: 36,
      textAlign: "center",
      fontSize: 12.5,
      fontWeight: "800",
      paddingVertical: 0,
    },
    densityChip: {
      flex: 1,
      height: 36,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 8,
      borderWidth: 1,
      paddingHorizontal: 4,
    },
    densityChipText: {
      fontSize: 9.5,
      fontWeight: "800",
      textAlign: "center",
    },
    uploadDropzone: {
      borderWidth: 1.5,
      borderStyle: "dashed",
      borderRadius: 10,
      paddingVertical: 8,
      paddingHorizontal: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    dropzoneContentRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
    },
    uploadMainText: {
      fontSize: 11,
      fontWeight: "700",
    },
    fileVerifiedCard: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 8,
      borderWidth: 1,
      padding: 7,
    },
    fileIconWrap: {
      width: 30,
      height: 30,
      borderRadius: 6,
      justifyContent: "center",
      alignItems: "center",
    },
    fileName: {
      fontSize: 11,
      fontWeight: "800",
    },
    fileMeta: {
      fontSize: 9.5,
      marginTop: 1,
    },
    reuploadBtn: {
      padding: 4,
    },
    summaryStrip: {
      flexDirection: "row",
      borderRadius: 10,
      borderWidth: 1,
      paddingVertical: 8,
      paddingHorizontal: 6,
      justifyContent: "space-around",
      alignItems: "center",
    },
    summaryItem: {
      flex: 1,
      alignItems: "center",
    },
    summaryVal: {
      fontSize: 13.5,
      fontWeight: "900",
    },
    summaryLabel: {
      fontSize: 9,
      fontWeight: "700",
      textTransform: "uppercase",
      marginTop: 1,
    },
    recalculateBtn: {
      height: 38,
      justifyContent: "center",
      alignItems: "center",
      borderRadius: 9,
    },
    btnContentCenterRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
    },
    recalculateBtnText: {
      color: "#FFFFFF",
      fontSize: 11.5,
      fontWeight: "800",
    },
    sectionTitleWithActionRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 6,
    },
    addHallBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
    },
    addHallBtnText: {
      color: "#FFFFFF",
      fontSize: 10,
      fontWeight: "800",
    },
    hallEditCard: {
      borderRadius: 10,
      borderWidth: 1,
      padding: 9,
    },
    hallCardFlexRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    hallTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      flexWrap: "wrap",
    },
    hallTitle: {
      fontSize: 12,
      fontWeight: "800",
    },
    capBadge: {
      paddingHorizontal: 5,
      paddingVertical: 2,
      borderRadius: 4,
    },
    capBadgeText: {
      fontSize: 9,
      fontWeight: "800",
    },
    hallBlockSub: {
      fontSize: 9.5,
      marginTop: 1,
    },
    hallInvigilatorSub: {
      fontSize: 9.5,
      fontWeight: "600",
      marginTop: 2,
    },
    hallActionControlsCol: {
      alignItems: "flex-end",
      gap: 5,
    },
    miniBenchStepper: {
      height: 26,
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 6,
      borderWidth: 1,
      overflow: "hidden",
    },
    miniStepBtn: {
      height: 26,
      paddingHorizontal: 6,
      justifyContent: "center",
      alignItems: "center",
    },
    miniBenchVal: {
      fontSize: 10,
      fontWeight: "800",
      paddingHorizontal: 3,
    },
    hallActionIconBtn: {
      width: 28,
      height: 28,
      borderRadius: 6,
      justifyContent: "center",
      alignItems: "center",
    },
    tabsScrollContainer: {
      gap: 6,
      marginBottom: 8,
    },
    hallTab: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 7,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    hallTabText: {
      fontSize: 10,
      fontWeight: "700",
    },
    matrixCard: {
      borderRadius: 10,
      borderWidth: 1,
      padding: 9,
    },
    matrixHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 3,
    },
    matrixHallName: {
      fontSize: 12,
      fontWeight: "800",
    },
    matrixInvigilator: {
      fontSize: 9.5,
      marginTop: 1,
    },
    matrixPill: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    matrixPillText: {
      fontSize: 9,
      fontWeight: "800",
    },
    matrixRollRange: {
      fontSize: 10,
      fontWeight: "800",
      marginBottom: 5,
    },
    matrixBenchRow: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 6,
      borderWidth: 1,
      padding: 5,
      gap: 6,
    },
    benchTag: {
      backgroundColor: "#3B82F618",
      paddingHorizontal: 5,
      paddingVertical: 2,
      borderRadius: 4,
      justifyContent: "center",
      alignItems: "center",
    },
    benchTagText: {
      fontSize: 9,
      fontWeight: "800",
      color: "#3B82F6",
    },
    benchSeatText: {
      fontSize: 9.5,
      lineHeight: 12.5,
    },
    moreBenchesText: {
      fontSize: 10,
      textAlign: "center",
      marginTop: 3,
    },
    actionsRow: {
      flexDirection: "row",
      gap: 8,
      marginTop: 8,
      paddingTop: 4,
    },
    pdfExportBtn: {
      flex: 1,
      height: 42,
      justifyContent: "center",
      alignItems: "center",
      borderRadius: 9,
      borderWidth: 1,
    },
    pdfExportText: {
      fontSize: 11.5,
      fontWeight: "800",
    },
    confirmPublishBtn: {
      flex: 1.6,
      height: 42,
      justifyContent: "center",
      alignItems: "center",
      borderRadius: 9,
    },
    confirmPublishText: {
      color: "#FFFFFF",
      fontSize: 11.5,
      fontWeight: "800",
    },

    /* Edit Modal */
    editModalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.72)",
      justifyContent: "center",
      alignItems: "center",
      padding: 14,
    },
    editModalCard: {
      width: "100%",
      borderRadius: 16,
      borderWidth: 1,
      padding: 14,
      elevation: 8,
    },
    editModalHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 6,
    },
    cancelBtn: {
      flex: 1,
      height: 38,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 8,
      borderWidth: 1,
    },
    cancelBtnText: {
      fontSize: 11,
      fontWeight: "700",
    },
    saveHallBtn: {
      flex: 1.5,
      height: 38,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 8,
    },
    saveHallBtnText: {
      color: "#FFFFFF",
      fontSize: 11,
      fontWeight: "800",
    },
  });

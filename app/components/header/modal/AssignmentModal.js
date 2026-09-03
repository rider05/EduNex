import React, { useRef, useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Animated,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { useTheme } from "../../../context/ThemeContext";
import { showToast } from "../../../utils/toastService";
import { api } from "../../../services/api";
import {
  getFacultyData,
  getFacultyAssignedSubjects,
  createAssignment,
  deleteAssignment,
} from "../../../services/dataService";
import { shareAssignmentBriefPdf } from "../../../utils/pdfGenerator";

export default function AssignmentModal({ visible, onClose, colors: propColors }) {
  const theme = useTheme();
  const colors = propColors || theme.colors || {};
  const isDarkMode = theme.isDarkMode || false;
  const styles = getStyles(colors, isDarkMode);

  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const [isLoading, setIsLoading] = useState(true);
  const [faculty, setFaculty] = useState(null);
  const [assignedSubjects, setAssignedSubjects] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  // Create Assignment Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSubject, setNewSubject] = useState(null);
  const [newDueDate, setNewDueDate] = useState("15 Sep 2026");
  const [newMarks, setNewMarks] = useState("50");
  const [newClass, setNewClass] = useState("III AI & DS - A");
  const [newDescription, setNewDescription] = useState("");

  // Delete Confirmation Dialog State
  const [deletingAsg, setDeletingAsg] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const facData = await getFacultyData();
      setFaculty(facData);
      const subjects = await getFacultyAssignedSubjects(facData);
      setAssignedSubjects(subjects);

      if (!newSubject && subjects.length > 0) {
        setNewSubject(subjects[0]);
      }

      // Fetch all raw assignments
      const res = await api.get("/assignments", { limit: 100 }).catch(() => null);
      const rawList = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];

      // Scoping: Staff member ONLY accesses their given / assigned subjects
      const scopedList = rawList.filter((a) => {
        const asgSubName = String(a.subject || a.course || a.courseName || "").toLowerCase();
        const asgSubCode = String(a.subjectCode || a.code || "").toLowerCase();
        const assignedBy = String(a.assignedBy || "").toLowerCase();
        const facName = String(facData?.name || "").toLowerCase();
        const facId = String(facData?.staffId || "").toLowerCase();

        // 1. Matches faculty by name/ID
        if (facName && assignedBy && (assignedBy.includes(facName) || facName.includes(assignedBy))) return true;
        if (facId && String(a.facultyId || "").toLowerCase() === facId) return true;

        // 2. Matches one of the faculty's assigned subjects
        return subjects.some((sub) => {
          const sName = String(sub.name || "").toLowerCase();
          const sCode = String(sub.code || "").toLowerCase();
          if (sCode && asgSubCode && (sCode === asgSubCode || asgSubCode.includes(sCode))) return true;
          if (sName && asgSubName && (asgSubName.includes(sName) || sName.includes(asgSubName))) return true;
          return false;
        });
      });

      const mapped = scopedList.map((a, i) => ({
        id: a._id || a.id || `asg_${i + 1}`,
        course: a.subject || a.course || a.courseName || "Course Core",
        code: a.subjectCode || a.code || "AD-506",
        title: a.title || a.name || "Course Assignment",
        desc: a.description || "",
        submitted: a.submitted || (a.status === "Submitted" ? 42 : 18),
        pending: a.pending || (a.status === "Submitted" ? 18 : 42),
        totalStudents: 60,
        dueDate: a.dueDate || a.deadline || "Due this week",
        marks: a.totalMarks || a.marks || 50,
        color: ["#4F46E5", "#0D9488", "#7C3AED", "#DB2777"][i % 4],
      }));

      setAssignments(mapped);
    } catch (err) {
      console.warn("Load assignments error:", err);
      setAssignments([]);
    } finally {
      setIsLoading(false);
    }
  }, [newSubject]);

  useEffect(() => {
    if (visible) loadData();
  }, [visible, loadData]);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 6,
          tension: 80,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0.85);
      fadeAnim.setValue(0);
    }
  }, [visible, fadeAnim, scaleAnim]);

  if (!visible) return null;

  // Filter assignments by selected subject and search
  const filteredAssignments = assignments.filter((a) => {
    if (selectedSubjectFilter !== "All") {
      const match =
        a.course.toLowerCase().includes(selectedSubjectFilter.toLowerCase()) ||
        a.code.toLowerCase().includes(selectedSubjectFilter.toLowerCase());
      if (!match) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchQ =
        a.title.toLowerCase().includes(q) ||
        a.course.toLowerCase().includes(q) ||
        a.code.toLowerCase().includes(q) ||
        a.desc.toLowerCase().includes(q);
      if (!matchQ) return false;
    }
    return true;
  });

  const totalSubmitted = filteredAssignments.reduce((sum, a) => sum + (a.submitted || 0), 0);
  const totalPending = filteredAssignments.reduce((sum, a) => sum + (a.pending || 0), 0);
  const totalStudents = totalSubmitted + totalPending || 1;
  const submissionRate = Math.round((totalSubmitted / totalStudents) * 100);

  // Handle Creating New Assignment
  const handleCreateAssignment = async () => {
    if (!newTitle.trim()) {
      showToast("Please enter an assignment title", "warning");
      return;
    }
    if (!newSubject) {
      showToast("Please select an assigned subject", "warning");
      return;
    }

    setIsCreating(true);
    try {
      const created = await createAssignment({
        title: newTitle.trim(),
        subject: newSubject.name,
        subjectCode: newSubject.code,
        dueDate: newDueDate.trim() || "15 Sep 2026",
        totalMarks: Number(newMarks) || 50,
        class: newClass.trim() || "III AI & DS - A",
        description: newDescription.trim(),
        assignedBy: faculty?.name || "Course Faculty",
        facultyId: faculty?.staffId || "STF001",
      });

      const newMapped = {
        id: created.id,
        course: created.subject,
        code: created.subjectCode,
        title: created.title,
        desc: created.description,
        submitted: 0,
        pending: 60,
        totalStudents: 60,
        dueDate: created.dueDate,
        marks: created.totalMarks,
        color: "#4F46E5",
      };

      setAssignments((prev) => [newMapped, ...prev]);
      setShowCreateModal(false);
      setNewTitle("");
      setNewDescription("");
      showToast(`✅ Assignment published for ${newSubject.name}!`, "success");
    } catch (err) {
      console.warn("Create assignment error:", err);
      showToast("Could not publish assignment, please retry", "error");
    } finally {
      setIsCreating(false);
    }
  };

  // Handle Deleting Assignment
  const confirmDeleteAssignment = async () => {
    if (!deletingAsg) return;
    setIsDeleting(true);
    try {
      await deleteAssignment(deletingAsg.id);
      setAssignments((prev) => prev.filter((a) => a.id !== deletingAsg.id));
      showToast("🗑️ Assignment removed from active coursework", "info");
      setDeletingAsg(null);
    } catch (err) {
      console.warn("Delete assignment error:", err);
      showToast("Failed to remove assignment", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleShare = async () => {
    try {
      const firstAsg = filteredAssignments[0] || {
        id: "ASG-001",
        title: "Coursework & Laboratory Problem Sets",
        subject: assignedSubjects.map((s) => s.name).join(", ") || "Assigned Subjects",
        dueDate: "15 Sep 2026",
        description: assignments.map((a) => `• ${a.code} ${a.course}: ${a.title} (Due: ${a.dueDate})`).join("\n"),
      };
      await shareAssignmentBriefPdf({
        assignment: firstAsg,
        student: {
          name: "III Year AI & DS Cohort",
          department: faculty?.department || "Artificial Intelligence & Data Science",
          year: "III Year",
        },
      });
      showToast("Official Coursework Brief PDF generated!", "success");
    } catch (err) {
      console.log("Share error:", err);
      showToast("Could not generate Assignment PDF", "error");
    }
  };

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <Animated.View
          style={[
            styles.cardContainer,
            {
              backgroundColor: colors.cardBackground || "#FFFFFF",
              borderColor: colors.divider || "rgba(0,0,0,0.1)",
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
              <View style={[styles.iconWrap, { backgroundColor: "#4F46E518" }]}>
                <Icon name="file-document-edit-outline" size={24} color="#4F46E5" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { color: colors.primaryText }]}>Coursework & Assignments</Text>
                <Text style={[styles.subtitle, { color: colors.secondaryText }]}>
                  Manage & grade coursework for your assigned subjects
                </Text>
              </View>
            </View>

            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Icon name="close-circle-outline" size={24} color={colors.secondaryText} />
            </TouchableOpacity>
          </View>

          {/* Quick Stats Strip */}
          <View style={[styles.statsStrip, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
            <View style={styles.statItem}>
              <Text style={[styles.statVal, { color: "#10B981" }]}>{submissionRate}%</Text>
              <Text style={[styles.statLabel, { color: colors.secondaryText }]}>Submission Rate</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statVal, { color: colors.primaryAccent }]}>{totalSubmitted}</Text>
              <Text style={[styles.statLabel, { color: colors.secondaryText }]}>Submitted</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statVal, { color: "#F59E0B" }]}>{totalPending}</Text>
              <Text style={[styles.statLabel, { color: colors.secondaryText }]}>Pending</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statVal, { color: "#8B5CF6" }]}>{filteredAssignments.length}</Text>
              <Text style={[styles.statLabel, { color: colors.secondaryText }]}>Active Tasks</Text>
            </View>
          </View>

          {/* Subject Filter Chips & Add Action Row */}
          <View style={{ marginBottom: 10 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <Text style={[styles.sectionLabel, { color: colors.secondaryText }]}>
                ASSIGNED SUBJECTS ({assignedSubjects.length})
              </Text>
              <TouchableOpacity
                style={[styles.addBtn, { backgroundColor: colors.primaryAccent }]}
                onPress={() => setShowCreateModal(true)}
                activeOpacity={0.85}
              >
                <Icon name="plus" size={14} color="#FFFFFF" />
                <Text style={styles.addBtnText}>Add Coursework</Text>
              </TouchableOpacity>
            </View>

            {/* Subject Filters */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: selectedSubjectFilter === "All" ? colors.primaryAccent : colors.primaryBackground,
                    borderColor: selectedSubjectFilter === "All" ? colors.primaryAccent : colors.divider,
                  },
                ]}
                onPress={() => setSelectedSubjectFilter("All")}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    { color: selectedSubjectFilter === "All" ? "#FFFFFF" : colors.primaryText },
                  ]}
                >
                  All My Subjects ({assignments.length})
                </Text>
              </TouchableOpacity>

              {assignedSubjects.map((sub, idx) => {
                const isSel = selectedSubjectFilter === sub.name;
                const count = assignments.filter((a) =>
                  a.course.toLowerCase().includes(sub.name.toLowerCase()) || a.code.toLowerCase().includes(sub.code.toLowerCase())
                ).length;

                return (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      styles.filterChip,
                      {
                        backgroundColor: isSel ? colors.primaryAccent : colors.primaryBackground,
                        borderColor: isSel ? colors.primaryAccent : colors.divider,
                      },
                    ]}
                    onPress={() => setSelectedSubjectFilter(sub.name)}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        { color: isSel ? "#FFFFFF" : colors.primaryText },
                      ]}
                    >
                      {sub.code ? `${sub.code} - ` : ""}{sub.name} ({count})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Search Box */}
          <View style={[styles.searchBox, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
            <Icon name="magnify" size={16} color={colors.secondaryText} />
            <TextInput
              style={[styles.searchInput, { color: colors.primaryText }]}
              placeholder="Search coursework by title or code..."
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

          {/* Assignment Cards List */}
          {isLoading ? (
            <View style={{ paddingVertical: 40, alignItems: "center" }}>
              <ActivityIndicator size="large" color={colors.primaryAccent} />
              <Text style={{ fontSize: 12, color: colors.secondaryText, marginTop: 10 }}>Loading assignments...</Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
              {filteredAssignments.map((item) => (
                <View
                  key={item.id}
                  style={[styles.assignmentCard, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
                      <View style={[styles.codeBadge, { backgroundColor: item.color + "18" }]}>
                        <Text style={[styles.codeBadgeText, { color: item.color }]}>{item.code}</Text>
                      </View>
                      <Text style={[styles.courseName, { color: colors.primaryText }]} numberOfLines={1}>
                        {item.course}
                      </Text>
                    </View>

                    {/* Delete Assignment Action */}
                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => setDeletingAsg(item)}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Icon name="trash-can-outline" size={18} color="#EF4444" />
                    </TouchableOpacity>
                  </View>

                  <Text style={[styles.taskTitle, { color: colors.primaryText }]} numberOfLines={2}>
                    {item.title}
                  </Text>
                  {item.desc ? (
                    <Text style={[styles.taskDesc, { color: colors.secondaryText }]} numberOfLines={2}>
                      {item.desc}
                    </Text>
                  ) : null}

                  {/* Metrics & Due Date Footer */}
                  <View style={styles.cardFooterRow}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text style={[styles.dueDateText, { color: colors.secondaryText }]}>
                        📅 Due: {item.dueDate}
                      </Text>
                      <Text style={{ fontSize: 11, color: colors.disabledText }}>·</Text>
                      <Text style={[styles.marksText, { color: colors.primaryAccent }]}>
                        {item.marks} Marks
                      </Text>
                    </View>

                    <View style={styles.subStatsPill}>
                      <Text style={[styles.subStatsText, { color: "#10B981" }]}>
                        {item.submitted} Done
                      </Text>
                      <Text style={[styles.subStatsText, { color: "#F59E0B" }]}>
                        · {item.pending} Left
                      </Text>
                    </View>
                  </View>
                </View>
              ))}

              {filteredAssignments.length === 0 && (
                <View style={{ alignItems: "center", paddingVertical: 30 }}>
                  <Icon name="file-document-outline" size={40} color={colors.secondaryText} />
                  <Text style={{ fontSize: 14, fontWeight: "700", color: colors.primaryText, marginTop: 8 }}>
                    No assignments found
                  </Text>
                  <Text style={{ fontSize: 11.5, color: colors.secondaryText, marginTop: 2, textAlign: "center" }}>
                    Tap &quot;Add Coursework&quot; above to publish a new problem set for your class.
                  </Text>
                </View>
              )}
            </ScrollView>
          )}

          {/* Action Row */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.shareBtn, { backgroundColor: colors.primaryAccent }]}
              onPress={handleShare}
              activeOpacity={0.85}
            >
              <Icon name="file-pdf-box" size={16} color="#FFFFFF" />
              <Text style={styles.shareBtnText}>Export Task Brief</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.closeBtnFooter, { borderColor: colors.divider }]}
              onPress={onClose}
            >
              <Text style={[styles.closeBtnFooterText, { color: colors.primaryText }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>

      {/* ========================================================================= */}
      {/* CREATE NEW ASSIGNMENT MODAL (SCOPED STRICTLY TO ASSIGNED SUBJECTS)          */}
      {/* ========================================================================= */}
      <Modal transparent visible={showCreateModal} animationType="fade" onRequestClose={() => setShowCreateModal(false)}>
        <View style={styles.createModalOverlay}>
          <View style={[styles.createModalCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
            <View style={styles.createModalHeader}>
              <View style={[styles.createIconWrap, { backgroundColor: colors.primaryAccent + "18" }]}>
                <Icon name="file-plus-outline" size={22} color={colors.primaryAccent} />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={[styles.createModalTitle, { color: colors.primaryText }]}>Publish New Assignment</Text>
                <Text style={[styles.createModalSub, { color: colors.secondaryText }]}>
                  Assigned only to your authorized subjects
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <Icon name="close" size={20} color={colors.secondaryText} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380, marginTop: 10 }}>
              {/* Select Assigned Subject */}
              <Text style={[styles.inputLabel, { color: colors.primaryText }]}>Authorized Course / Subject</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                {assignedSubjects.map((sub, i) => {
                  const isSel = newSubject?.name === sub.name;
                  return (
                    <TouchableOpacity
                      key={i}
                      style={[
                        styles.subjectPickChip,
                        {
                          backgroundColor: isSel ? colors.primaryAccent : colors.primaryBackground,
                          borderColor: isSel ? colors.primaryAccent : colors.divider,
                        },
                      ]}
                      onPress={() => setNewSubject(sub)}
                    >
                      <Icon
                        name={isSel ? "check-circle" : "book-outline"}
                        size={14}
                        color={isSel ? "#FFFFFF" : colors.secondaryText}
                      />
                      <Text style={[styles.subjectPickChipText, { color: isSel ? "#FFFFFF" : colors.primaryText }]}>
                        {sub.code ? `${sub.code} · ` : ""}{sub.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Assignment Title */}
              <Text style={[styles.inputLabel, { color: colors.primaryText }]}>Assignment Title / Topic</Text>
              <TextInput
                style={[styles.formInput, { backgroundColor: colors.primaryBackground, borderColor: colors.divider, color: colors.primaryText }]}
                placeholder="e.g. Neural Network Backpropagation Implementation"
                placeholderTextColor={colors.disabledText}
                value={newTitle}
                onChangeText={setNewTitle}
              />

              {/* Due Date & Total Marks Row */}
              <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                <View style={{ flex: 1.2 }}>
                  <Text style={[styles.inputLabel, { color: colors.primaryText }]}>Submission Deadline</Text>
                  <TextInput
                    style={[styles.formInput, { backgroundColor: colors.primaryBackground, borderColor: colors.divider, color: colors.primaryText }]}
                    placeholder="e.g. 15 Sep 2026"
                    placeholderTextColor={colors.disabledText}
                    value={newDueDate}
                    onChangeText={setNewDueDate}
                  />
                </View>

                <View style={{ flex: 0.8 }}>
                  <Text style={[styles.inputLabel, { color: colors.primaryText }]}>Total Marks</Text>
                  <TextInput
                    style={[styles.formInput, { backgroundColor: colors.primaryBackground, borderColor: colors.divider, color: colors.primaryText }]}
                    placeholder="50"
                    placeholderTextColor={colors.disabledText}
                    keyboardType="numeric"
                    value={newMarks}
                    onChangeText={setNewMarks}
                  />
                </View>
              </View>

              {/* Target Class */}
              <Text style={[styles.inputLabel, { color: colors.primaryText, marginTop: 10 }]}>Target Class / Batch</Text>
              <TextInput
                style={[styles.formInput, { backgroundColor: colors.primaryBackground, borderColor: colors.divider, color: colors.primaryText }]}
                placeholder="e.g. III AI & DS - A"
                placeholderTextColor={colors.disabledText}
                value={newClass}
                onChangeText={setNewClass}
              />

              {/* Description / Instructions */}
              <Text style={[styles.inputLabel, { color: colors.primaryText, marginTop: 10 }]}>Instructions / Problem Brief</Text>
              <TextInput
                style={[styles.formInputMultiline, { backgroundColor: colors.primaryBackground, borderColor: colors.divider, color: colors.primaryText }]}
                placeholder="Add problem statement, datasets, and report formatting instructions..."
                placeholderTextColor={colors.disabledText}
                value={newDescription}
                onChangeText={setNewDescription}
                multiline
                numberOfLines={3}
              />
            </ScrollView>

            {/* Actions */}
            <View style={styles.createActionsRow}>
              <TouchableOpacity
                style={[styles.cancelBtn, { borderColor: colors.divider }]}
                onPress={() => setShowCreateModal(false)}
                disabled={isCreating}
              >
                <Text style={[styles.cancelBtnText, { color: colors.secondaryText }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.submitCreateBtn, { backgroundColor: colors.primaryAccent }]}
                onPress={handleCreateAssignment}
                disabled={isCreating}
                activeOpacity={0.85}
              >
                {isCreating ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Icon name="check-bold" size={15} color="#FFFFFF" />
                    <Text style={styles.submitCreateBtnText}>Publish Coursework</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* DELETE ASSIGNMENT CONFIRMATION DIALOG                                      */}
      {/* ========================================================================= */}
      {deletingAsg && (
        <Modal transparent visible={!!deletingAsg} animationType="fade" onRequestClose={() => setDeletingAsg(null)}>
          <View style={styles.createModalOverlay}>
            <View style={[styles.deleteConfirmCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
              <View style={[styles.deleteIconWrap, { backgroundColor: "#EF444418" }]}>
                <Icon name="trash-can-outline" size={28} color="#EF4444" />
              </View>
              <Text style={[styles.deleteTitle, { color: colors.primaryText }]}>Remove Assignment?</Text>
              <Text style={[styles.deleteSub, { color: colors.secondaryText }]}>
                Are you sure you want to remove &quot;{deletingAsg.title}&quot; for {deletingAsg.course}? This cannot be undone.
              </Text>

              <View style={styles.createActionsRow}>
                <TouchableOpacity
                  style={[styles.cancelBtn, { borderColor: colors.divider }]}
                  onPress={() => setDeletingAsg(null)}
                  disabled={isDeleting}
                >
                  <Text style={[styles.cancelBtnText, { color: colors.secondaryText }]}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.deleteConfirmBtn, { backgroundColor: "#EF4444" }]}
                  onPress={confirmDeleteAssignment}
                  disabled={isDeleting}
                  activeOpacity={0.85}
                >
                  {isDeleting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.deleteConfirmBtnText}>Delete Coursework</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </Modal>
  );
}

// ---------------- Styles ----------------
const getStyles = (colors, isDarkMode) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "rgba(0,0,0,0.75)",
      paddingHorizontal: 16,
    },
    cardContainer: {
      width: "100%",
      maxHeight: "90%",
      borderRadius: 22,
      borderWidth: 1,
      padding: 18,
      paddingTop: 20,
      elevation: 12,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 14,
    },
    iconWrap: {
      width: 40,
      height: 40,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
    },
    title: {
      fontSize: 15.5,
      fontWeight: "800",
      letterSpacing: -0.2,
    },
    subtitle: {
      fontSize: 10.5,
      fontWeight: "500",
      marginTop: 1,
    },
    closeBtn: {
      padding: 4,
    },
    statsStrip: {
      flexDirection: "row",
      borderRadius: 12,
      borderWidth: 1,
      padding: 10,
      marginBottom: 10,
      justifyContent: "space-around",
    },
    statItem: {
      alignItems: "center",
    },
    statVal: {
      fontSize: 14.5,
      fontWeight: "900",
    },
    statLabel: {
      fontSize: 9.5,
      fontWeight: "600",
      marginTop: 1,
    },
    sectionLabel: {
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 0.5,
    },
    addBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
    },
    addBtnText: {
      color: "#FFFFFF",
      fontSize: 11,
      fontWeight: "800",
    },
    filterChip: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 8,
      borderWidth: 1,
    },
    filterChipText: {
      fontSize: 11,
      fontWeight: "700",
    },
    searchBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 10,
      borderWidth: 1,
      marginBottom: 8,
    },
    searchInput: {
      flex: 1,
      fontSize: 11.5,
      padding: 0,
    },
    assignmentCard: {
      borderRadius: 14,
      borderWidth: 1,
      padding: 12,
    },
    codeBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    codeBadgeText: {
      fontSize: 10,
      fontWeight: "800",
    },
    courseName: {
      fontSize: 12.5,
      fontWeight: "800",
      flex: 1,
    },
    deleteBtn: {
      padding: 4,
    },
    taskTitle: {
      fontSize: 12.5,
      fontWeight: "700",
      marginTop: 4,
    },
    taskDesc: {
      fontSize: 11,
      lineHeight: 15,
      marginTop: 2,
    },
    cardFooterRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 8,
      paddingTop: 6,
      borderTopWidth: 0.5,
      borderTopColor: "rgba(100,116,139,0.2)",
    },
    dueDateText: {
      fontSize: 10.5,
      fontWeight: "600",
    },
    marksText: {
      fontSize: 10.5,
      fontWeight: "800",
    },
    subStatsPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 2,
    },
    subStatsText: {
      fontSize: 10.5,
      fontWeight: "700",
    },
    actionRow: {
      flexDirection: "row",
      gap: 8,
      marginTop: 10,
    },
    shareBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 10,
      borderRadius: 10,
    },
    shareBtnText: {
      color: "#FFFFFF",
      fontSize: 12,
      fontWeight: "800",
    },
    closeBtnFooter: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
    },
    closeBtnFooterText: {
      fontSize: 12,
      fontWeight: "800",
    },

    /* Create Assignment Modal */
    createModalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.75)",
      justifyContent: "center",
      alignItems: "center",
      padding: 16,
    },
    createModalCard: {
      width: "100%",
      borderRadius: 18,
      borderWidth: 1,
      padding: 16,
      elevation: 10,
    },
    createModalHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 6,
    },
    createIconWrap: {
      width: 38,
      height: 38,
      borderRadius: 10,
      justifyContent: "center",
      alignItems: "center",
    },
    createModalTitle: {
      fontSize: 15,
      fontWeight: "800",
    },
    createModalSub: {
      fontSize: 10.5,
      fontWeight: "500",
      marginTop: 1,
    },
    inputLabel: {
      fontSize: 11,
      fontWeight: "700",
      marginBottom: 4,
    },
    subjectPickChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: 8,
      borderWidth: 1,
    },
    subjectPickChipText: {
      fontSize: 11,
      fontWeight: "700",
    },
    formInput: {
      borderRadius: 8,
      borderWidth: 1,
      paddingHorizontal: 10,
      paddingVertical: 7,
      fontSize: 11.5,
    },
    formInputMultiline: {
      borderRadius: 8,
      borderWidth: 1,
      paddingHorizontal: 10,
      paddingVertical: 7,
      fontSize: 11.5,
      minHeight: 55,
      textAlignVertical: "top",
    },
    createActionsRow: {
      flexDirection: "row",
      gap: 8,
      marginTop: 12,
    },
    cancelBtn: {
      flex: 1,
      paddingVertical: 9,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 8,
      borderWidth: 1,
    },
    cancelBtnText: {
      fontSize: 11.5,
      fontWeight: "700",
    },
    submitCreateBtn: {
      flex: 1.5,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
      paddingVertical: 9,
      borderRadius: 8,
    },
    submitCreateBtnText: {
      color: "#FFFFFF",
      fontSize: 11.5,
      fontWeight: "800",
    },

    /* Delete Confirm Card */
    deleteConfirmCard: {
      width: "90%",
      borderRadius: 18,
      borderWidth: 1,
      padding: 18,
      alignItems: "center",
      elevation: 10,
    },
    deleteIconWrap: {
      width: 50,
      height: 50,
      borderRadius: 25,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 10,
    },
    deleteTitle: {
      fontSize: 16,
      fontWeight: "800",
      marginBottom: 4,
    },
    deleteSub: {
      fontSize: 12,
      textAlign: "center",
      marginBottom: 14,
      lineHeight: 16,
    },
    deleteConfirmBtn: {
      flex: 1.5,
      paddingVertical: 9,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 8,
    },
    deleteConfirmBtnText: {
      color: "#FFFFFF",
      fontSize: 11.5,
      fontWeight: "800",
    },
  });
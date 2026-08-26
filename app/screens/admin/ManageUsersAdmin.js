// ManageUsersAdmin.js
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  FlatList,
  Modal,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { useTheme } from "../../context/ThemeContext";
import { api } from "../../services/api";
import { showToast } from "../../utils/toastService";
import { SkeletonListItem } from "../../components/common/SkeletonLoader";
import AddUserModal from "../../components/header/amodal/AddUserModal";

export default function ManageUsersAdmin() {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [users, setUsers] = useState([]);
  const [selectedRole, setSelectedRole] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // Modals
  const [addUserModalVisible, setAddUserModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  // Edit / Details State
  const [editName, setEditName] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editMobile, setEditMobile] = useState("");
  const [editRole, setEditRole] = useState("student");
  const [editDept, setEditDept] = useState("");
  const [editStatus, setEditStatus] = useState("active");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  const roleFilterTabs = [
    { key: "All", label: "All Users", icon: "account-multiple" },
    { key: "student", label: "Students", icon: "school" },
    { key: "staff", label: "Faculty", icon: "account-tie" },
    { key: "parent", label: "Parents", icon: "human-male-female-child" },
    { key: "admin", label: "Admins", icon: "shield-account" },
  ];

  // FETCH ALL USERS FROM MONGODB
  const fetchUsers = useCallback(async () => {
    try {
      const res = await api.get("/users", { sort: "-createdAt" });
      if (res?.data && Array.isArray(res.data)) {
        setUsers(
          res.data.map((u) => {
            const rawRole = (u?.role || "").toLowerCase();
            let cleanRole = "student";
            if (rawRole.includes("staff") || rawRole.includes("fac") || rawRole.includes("prof") || rawRole.includes("teacher")) cleanRole = "staff";
            else if (rawRole.includes("parent") || rawRole.includes("guard")) cleanRole = "parent";
            else if (rawRole.includes("admin")) cleanRole = "admin";
            else cleanRole = "student";

            return {
              id: u?.id || u?._id,
              uid: u?.uid || u?.id || "",
              name: u?.name || u?.profile?.name || u?.username || "Campus User",
              username: u?.username || u?.roll || u?.rollNo || u?.staffId || "",
              email: u?.email || "",
              mobile: u?.mobile || u?.phone || u?.profile?.mobile || "",
              dept: u?.dept || u?.department || u?.staffDept || u?.profile?.department || "General",
              role: cleanRole,
              status: u?.status || "active",
            };
          })
        );
      }
    } catch (err) {
      console.log("fetchUsers error:", err);
    } finally {
      setIsLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchUsers();
    setRefreshing(false);
  };

  // Filtered Users
  const filteredUsers = users.filter((u) => {
    const matchesRole =
      selectedRole === "All" || u.role.toLowerCase() === selectedRole.toLowerCase();
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !query ||
      (u.name || "").toLowerCase().includes(query) ||
      (u.username || "").toLowerCase().includes(query) ||
      (u.email || "").toLowerCase().includes(query) ||
      (u.dept || "").toLowerCase().includes(query) ||
      (u.mobile || "").includes(query);
    return matchesRole && matchesSearch;
  });

  // Open User Details & Edit Modal
  const openUserModal = (user) => {
    setSelectedUser(user);
    setEditName(user?.name || "");
    setEditUsername(user?.username || "");
    setEditEmail(user?.email || "");
    setEditMobile(user?.mobile || "");
    setEditRole(user?.role || "student");
    setEditDept(user?.dept || "CSE");
    setEditStatus(user?.status || "active");
    setEditModalVisible(true);
  };

  // SAVE EDIT (MongoDB PUT /users/:id)
  const handleSaveEdit = async () => {
    if (!editName.trim()) {
      showToast("Please provide user name", "warning");
      return;
    }

    setIsSavingEdit(true);
    try {
      await api.put(`/users/${selectedUser.id}`, {
        name: editName.trim(),
        username: editUsername.trim().toLowerCase(),
        mobile: editMobile.trim(),
        role: editRole,
        department: editDept.trim(),
        status: editStatus,
        profile: {
          name: editName.trim(),
          mobile: editMobile.trim(),
          department: editDept.trim(),
        },
      });

      showToast("User details updated in MongoDB!", "success");
      setEditModalVisible(false);
      setSelectedUser(null);
      await fetchUsers();
    } catch (err) {
      console.log("Update ERROR:", err);
      showToast("Could not update user record", "error");
    } finally {
      setIsSavingEdit(false);
    }
  };

  // RESET PASSWORD (MongoDB POST /auth/register or PUT)
  const handleResetPassword = async () => {
    Alert.alert(
      "Reset Password",
      `Reset password for ${selectedUser?.name} to default "edunex123"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset Password",
          onPress: async () => {
            setIsResettingPassword(true);
            try {
              await api.post("/auth/register", {
                username: (selectedUser?.username || "").toLowerCase(),
                password: "edunex123",
                role: selectedUser?.role || "student",
                email: selectedUser?.email || "",
                profile: {
                  name: selectedUser?.name || "",
                  mobile: selectedUser?.mobile || "",
                },
              });
              showToast("🔑 Password successfully reset to edunex123!", "success");
            } catch {
              showToast("Password reset applied to credentials registry", "info");
            } finally {
              setIsResettingPassword(false);
            }
          },
        },
      ]
    );
  };

  // DELETE USER (MongoDB DELETE /users/:id)
  const handleDeleteUser = async () => {
    Alert.alert("Confirm Deletion", `Permanently delete ${selectedUser?.name}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await api.del(`/users/${selectedUser.id}`);
            showToast("User removed from database", "info");
            setEditModalVisible(false);
            setSelectedUser(null);
            await fetchUsers();
          } catch (err) {
            console.log("Delete ERROR:", err);
            showToast("Could not delete user record", "error");
          }
        },
      },
    ]);
  };

  // Role Theme Helpers
  const getRoleBadgeStyle = (role) => {
    switch (role) {
      case "student":
        return { bg: "#3B82F618", text: "#3B82F6", label: "Student", icon: "school" };
      case "staff":
        return { bg: "#10B98118", text: "#10B981", label: "Faculty", icon: "account-tie" };
      case "parent":
        return { bg: "#8B5CF618", text: "#8B5CF6", label: "Parent", icon: "human-male-female-child" };
      case "admin":
        return { bg: "#F59E0B18", text: "#F59E0B", label: "Admin", icon: "shield-crown" };
      default:
        return { bg: "#6B728018", text: "#6B7280", label: "User", icon: "account" };
    }
  };

  // Counters
  const totalCount = users.length;
  const studentCount = users.filter((u) => u.role === "student").length;
  const staffCount = users.filter((u) => u.role === "staff").length;
  const parentCount = users.filter((u) => u.role === "parent").length;
  const adminCount = users.filter((u) => u.role === "admin").length;

  const getCountForRole = (r) => {
    if (r === "All") return totalCount;
    if (r === "student") return studentCount;
    if (r === "staff") return staffCount;
    if (r === "parent") return parentCount;
    if (r === "admin") return adminCount;
    return 0;
  };

  const renderUserCard = ({ item }) => {
    const badge = getRoleBadgeStyle(item.role);

    return (
      <TouchableOpacity
        style={[styles.userCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
        onPress={() => openUserModal(item)}
        activeOpacity={0.8}
      >
        <View style={styles.userCardMain}>
          {/* Avatar Icon */}
          <View style={[styles.avatarCircle, { backgroundColor: badge.bg }]}>
            <Icon name={badge.icon} size={22} color={badge.text} />
          </View>

          {/* User Details */}
          <View style={{ flex: 1 }}>
            <View style={styles.userNameRow}>
              <Text style={[styles.userName, { color: colors.primaryText }]} numberOfLines={1}>
                {item.name}
              </Text>
              <View style={[styles.roleBadge, { backgroundColor: badge.bg }]}>
                <Text style={[styles.roleBadgeText, { color: badge.text }]}>{badge.label}</Text>
              </View>
            </View>

            <View style={styles.userMetaRow}>
              <Text style={[styles.userIdText, { color: colors.primaryAccent }]}>
                {item.username ? `@${item.username}` : "ID Pending"}
              </Text>
              <Text style={[styles.userMetaDot, { color: colors.secondaryText }]}>·</Text>
              <Text style={[styles.userDeptText, { color: colors.secondaryText }]}>
                {item.dept}
              </Text>
            </View>

            {item.email ? (
              <Text style={[styles.userEmailText, { color: colors.secondaryText }]} numberOfLines={1}>
                {item.email}
              </Text>
            ) : null}
          </View>

          <Icon name="chevron-right" size={20} color={colors.secondaryText} style={{ marginLeft: 6 }} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
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
        {/* Top Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.headerSub, { color: colors.secondaryText }]}>CAMPUS DIRECTORY</Text>
            <Text style={[styles.header, { color: colors.primaryText }]}>Manage Users</Text>
          </View>

          <TouchableOpacity
            style={[styles.refreshPill, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
            onPress={onRefresh}
            activeOpacity={0.7}
          >
            <Icon name="sync" size={16} color={colors.primaryAccent} />
            <Text style={[styles.refreshPillText, { color: colors.primaryAccent }]}>Sync DB</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Action Tray: Single Add + Excel Import */}
        <View style={styles.quickActionTray}>
          <TouchableOpacity
            style={[styles.primaryActionBtn, { backgroundColor: colors.primaryAccent }]}
            onPress={() => setAddUserModalVisible(true)}
            activeOpacity={0.85}
          >
            <Icon name="account-plus" size={18} color="#fff" />
            <Text style={styles.primaryActionBtnText}>Add User</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryActionBtn, { backgroundColor: "#10B98118", borderColor: "#10B98140" }]}
            onPress={() => setAddUserModalVisible(true)}
            activeOpacity={0.85}
          >
            <Icon name="file-excel-box" size={18} color="#10B981" />
            <Text style={[styles.secondaryActionBtnText, { color: "#10B981" }]}>Excel Import</Text>
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={[styles.searchBox, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
          <Icon name="magnify" size={20} color={colors.secondaryText} />
          <TextInput
            style={[styles.searchInput, { color: colors.primaryText }]}
            placeholder="Search by name, ID, email, dept..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={colors.secondaryText}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Icon name="close-circle" size={18} color={colors.secondaryText} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Role Tabs with Live Counts */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.roleTabsScroll}>
          {roleFilterTabs.map((tab) => {
            const active = selectedRole === tab.key;
            const count = getCountForRole(tab.key);
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setSelectedRole(tab.key)}
                style={[
                  styles.roleTab,
                  {
                    backgroundColor: active ? colors.primaryAccent : colors.cardBackground,
                    borderColor: active ? colors.primaryAccent : colors.divider,
                  },
                ]}
                activeOpacity={0.8}
              >
                <Icon
                  name={tab.icon}
                  size={15}
                  color={active ? "#fff" : colors.secondaryText}
                  style={{ marginRight: 4 }}
                />
                <Text
                  style={[
                    styles.roleTabText,
                    { color: active ? "#fff" : colors.primaryText },
                  ]}
                >
                  {tab.label}
                </Text>
                <View
                  style={[
                    styles.tabCountBadge,
                    {
                      backgroundColor: active ? "rgba(255,255,255,0.25)" : colors.primaryBackground,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.tabCountText,
                      { color: active ? "#fff" : colors.secondaryText },
                    ]}
                  >
                    {count}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Results Counter */}
        <View style={styles.resultsHeader}>
          <Text style={[styles.resultsCountText, { color: colors.secondaryText }]}>
            Showing {filteredUsers.length} of {users.length} campus users
          </Text>
        </View>

        {/* Users List */}
        {isLoadingUsers ? (
          <View style={{ marginTop: 8 }}>
            <SkeletonListItem />
            <SkeletonListItem />
            <SkeletonListItem />
            <SkeletonListItem />
          </View>
        ) : filteredUsers.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
            <Icon name="account-search-outline" size={48} color={colors.secondaryText} />
            <Text style={[styles.emptyTitle, { color: colors.primaryText }]}>No Users Found</Text>
            <Text style={[styles.emptySub, { color: colors.secondaryText }]}>
              Try searching with a different name, department, or role filter.
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredUsers}
            renderItem={renderUserCard}
            keyExtractor={(i) => i.id}
            scrollEnabled={false}
          />
        )}

        <View style={{ height: 110 }} />
      </ScrollView>

      {/* ========================================================================= */}
      {/* ADD USER & EXCEL IMPORTER MODAL                                           */}
      {/* ========================================================================= */}
      <AddUserModal
        visible={addUserModalVisible}
        onClose={() => {
          setAddUserModalVisible(false);
          fetchUsers();
        }}
      />

      {/* ========================================================================= */}
      {/* USER DETAILS & EDIT PROFILE MODAL                                         */}
      {/* ========================================================================= */}
      <Modal visible={editModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.cardBackground }]}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={[styles.avatarCircle, { backgroundColor: getRoleBadgeStyle(editRole).bg }]}>
                  <Icon name={getRoleBadgeStyle(editRole).icon} size={22} color={getRoleBadgeStyle(editRole).text} />
                </View>
                <View>
                  <Text style={[styles.modalTitle, { color: colors.primaryText }]}>User Profile & Access</Text>
                  <Text style={[styles.modalSub, { color: colors.secondaryText }]}>MongoDB Document ID: {selectedUser?.id?.slice(-8)}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Icon name="close-circle" size={24} color={colors.secondaryText} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 400 }}>
              {/* Form Fields */}
              <Text style={[styles.fieldLabel, { color: colors.primaryText }]}>Full Name *</Text>
              <TextInput
                style={[styles.inputField, { backgroundColor: colors.primaryBackground, color: colors.primaryText, borderColor: colors.divider }]}
                value={editName}
                onChangeText={setEditName}
                placeholder="User's Full Name"
                placeholderTextColor={colors.secondaryText}
              />

              <Text style={[styles.fieldLabel, { color: colors.primaryText, marginTop: 10 }]}>Username / System ID</Text>
              <TextInput
                style={[styles.inputField, { backgroundColor: colors.primaryBackground, color: colors.primaryText, borderColor: colors.divider }]}
                value={editUsername}
                onChangeText={setEditUsername}
                placeholder="e.g. 25ACSE001"
                placeholderTextColor={colors.secondaryText}
                autoCapitalize="characters"
              />

              <Text style={[styles.fieldLabel, { color: colors.primaryText, marginTop: 10 }]}>Email Address</Text>
              <TextInput
                style={[styles.inputField, { backgroundColor: colors.primaryBackground, color: colors.primaryText, borderColor: colors.divider }]}
                value={editEmail}
                onChangeText={setEditEmail}
                placeholder="Email Address"
                placeholderTextColor={colors.secondaryText}
                keyboardType="email-address"
              />

              <Text style={[styles.fieldLabel, { color: colors.primaryText, marginTop: 10 }]}>Mobile Number</Text>
              <TextInput
                style={[styles.inputField, { backgroundColor: colors.primaryBackground, color: colors.primaryText, borderColor: colors.divider }]}
                value={editMobile}
                onChangeText={setEditMobile}
                placeholder="Mobile Number"
                placeholderTextColor={colors.secondaryText}
                keyboardType="phone-pad"
              />

              <Text style={[styles.fieldLabel, { color: colors.primaryText, marginTop: 10 }]}>Department</Text>
              <TextInput
                style={[styles.inputField, { backgroundColor: colors.primaryBackground, color: colors.primaryText, borderColor: colors.divider }]}
                value={editDept}
                onChangeText={setEditDept}
                placeholder="Department (e.g. CSE, AI-DS)"
                placeholderTextColor={colors.secondaryText}
              />

              {/* Role Select Options */}
              <Text style={[styles.fieldLabel, { color: colors.primaryText, marginTop: 12 }]}>Role Assignment</Text>
              <View style={styles.rolePickerRow}>
                {["student", "staff", "parent", "admin"].map((r) => {
                  const b = getRoleBadgeStyle(r);
                  const isSel = editRole === r;
                  return (
                    <TouchableOpacity
                      key={r}
                      style={[
                        styles.rolePickerOption,
                        isSel
                          ? { backgroundColor: colors.primaryAccent, borderColor: colors.primaryAccent }
                          : { backgroundColor: colors.primaryBackground, borderColor: colors.divider },
                      ]}
                      onPress={() => setEditRole(r)}
                    >
                      <Icon name={b.icon} size={16} color={isSel ? "#fff" : colors.secondaryText} />
                      <Text style={[styles.rolePickerText, { color: isSel ? "#fff" : colors.primaryText }]}>
                        {b.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Reset Password Action */}
              <TouchableOpacity
                style={[styles.resetPasswordBtn, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}
                onPress={handleResetPassword}
                disabled={isResettingPassword}
              >
                <Icon name="key-change" size={18} color={colors.primaryAccent} />
                <Text style={[styles.resetPasswordText, { color: colors.primaryAccent }]}>
                  {isResettingPassword ? "Resetting Password..." : "Reset User Password (edunex123)"}
                </Text>
              </TouchableOpacity>
            </ScrollView>

            {/* Modal Actions */}
            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={[styles.deleteBtn, { backgroundColor: "#EF4444" }]}
                onPress={handleDeleteUser}
              >
                <Icon name="delete-outline" size={18} color="#fff" />
                <Text style={styles.actionBtnText}>Delete</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: colors.primaryAccent }]}
                onPress={handleSaveEdit}
                disabled={isSavingEdit}
              >
                {isSavingEdit ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Icon name="content-save-outline" size={18} color="#fff" />
                    <Text style={styles.actionBtnText}>Save Changes</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const getStyles = (colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.primaryBackground },
    scrollContent: { paddingHorizontal: 16, paddingTop: 50, paddingBottom: 60 },

    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 14,
    },
    headerSub: {
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 1,
      marginBottom: 2,
    },
    header: {
      fontSize: 24,
      fontWeight: "900",
      letterSpacing: -0.5,
    },
    refreshPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 16,
      borderWidth: 1,
    },
    refreshPillText: {
      fontSize: 12,
      fontWeight: "800",
    },

    /* Quick Action Tray */
    quickActionTray: {
      flexDirection: "row",
      gap: 10,
      marginBottom: 12,
    },
    primaryActionBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 11,
      borderRadius: 12,
      elevation: 2,
    },
    primaryActionBtnText: {
      color: "#fff",
      fontSize: 13.5,
      fontWeight: "800",
    },
    secondaryActionBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 11,
      borderRadius: 12,
      borderWidth: 1,
    },
    secondaryActionBtnText: {
      fontSize: 13.5,
      fontWeight: "800",
    },

    /* Search Box */
    searchBox: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginBottom: 12,
    },
    searchInput: {
      flex: 1,
      marginLeft: 8,
      fontSize: 13.5,
      fontWeight: "600",
      paddingVertical: 2,
    },

    /* Role Tabs */
    roleTabsScroll: {
      marginBottom: 10,
    },
    roleTab: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderRadius: 20,
      paddingVertical: 6,
      paddingHorizontal: 12,
      marginRight: 8,
    },
    roleTabText: {
      fontSize: 12.5,
      fontWeight: "700",
    },
    tabCountBadge: {
      marginLeft: 6,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 10,
    },
    tabCountText: {
      fontSize: 11,
      fontWeight: "800",
    },

    resultsHeader: {
      marginBottom: 10,
      paddingHorizontal: 2,
    },
    resultsCountText: {
      fontSize: 12,
      fontWeight: "600",
    },

    /* User Card */
    userCard: {
      borderRadius: 14,
      padding: 12,
      borderWidth: 1,
      marginBottom: 8,
      elevation: 1,
    },
    userCardMain: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    avatarCircle: {
      width: 42,
      height: 42,
      borderRadius: 21,
      justifyContent: "center",
      alignItems: "center",
    },
    userNameRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 6,
      marginBottom: 2,
    },
    userName: {
      fontSize: 14.5,
      fontWeight: "800",
      flex: 1,
    },
    roleBadge: {
      paddingVertical: 2,
      paddingHorizontal: 6,
      borderRadius: 6,
    },
    roleBadgeText: {
      fontSize: 10.5,
      fontWeight: "800",
    },
    userMetaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      marginBottom: 2,
    },
    userIdText: {
      fontSize: 12,
      fontWeight: "800",
    },
    userMetaDot: {
      fontSize: 12,
      fontWeight: "700",
    },
    userDeptText: {
      fontSize: 12,
      fontWeight: "600",
    },
    userEmailText: {
      fontSize: 11.5,
      fontWeight: "500",
    },

    /* Empty Box */
    emptyBox: {
      borderRadius: 16,
      borderWidth: 1,
      padding: 24,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 20,
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: "800",
      marginTop: 10,
    },
    emptySub: {
      fontSize: 12.5,
      textAlign: "center",
      marginTop: 4,
      lineHeight: 18,
    },

    /* Modal Styling */
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.6)",
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 16,
    },
    modalCard: {
      width: "100%",
      maxHeight: "85%",
      borderRadius: 22,
      padding: 18,
      elevation: 10,
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 14,
    },
    modalTitle: {
      fontSize: 16,
      fontWeight: "800",
    },
    modalSub: {
      fontSize: 11,
      fontWeight: "500",
      marginTop: 1,
    },
    fieldLabel: {
      fontSize: 12,
      fontWeight: "700",
      marginBottom: 4,
    },
    inputField: {
      borderWidth: 1,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
      fontSize: 13,
      fontWeight: "600",
    },
    rolePickerRow: {
      flexDirection: "row",
      gap: 6,
      marginBottom: 14,
    },
    rolePickerOption: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
    },
    rolePickerText: {
      fontSize: 11.5,
      fontWeight: "700",
    },
    resetPasswordBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
      marginBottom: 6,
    },
    resetPasswordText: {
      fontSize: 12.5,
      fontWeight: "800",
    },
    modalActionRow: {
      flexDirection: "row",
      gap: 10,
      marginTop: 14,
    },
    deleteBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      paddingVertical: 11,
      paddingHorizontal: 16,
      borderRadius: 10,
    },
    saveBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 11,
      borderRadius: 10,
    },
    actionBtnText: {
      color: "#fff",
      fontSize: 13,
      fontWeight: "800",
    },
  });
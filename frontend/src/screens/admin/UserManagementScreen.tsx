import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  SafeAreaView, Alert, Modal, TextInput, Switch, Platform
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Header } from "../../components/Header";
import { Toast } from "../../components/Toast";
import { adminAPI } from "../../api/client";
import { User } from "../../models/types";
import { theme } from "../../theme/theme";
import { useLanguage } from "../../context/LanguageContext";

export const UserManagementScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { t } = useLanguage();

  const [users, setUsers] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState<"all" | "disabled">("all");
  const [loading, setLoading] = useState<boolean>(true);

  // Modal State for Add / Edit
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [formUsername, setFormUsername] = useState("");
  const [formMobile, setFormMobile] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formRole, setFormRole] = useState<"USER" | "ADMIN">("USER");
  const [formIsActive, setFormIsActive] = useState(true);

  const [toastVisible, setToastVisible] = useState(false);
  const [toastMsg, setToastMsg] = useState("");

  useEffect(() => {
    loadUsers();
  }, [activeTab]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await adminAPI.getUsers(activeTab === "disabled" ? false : undefined);
      setUsers(data);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setModalMode("add");
    setCurrentUserId(null);
    setFormUsername("");
    setFormMobile("");
    setFormPassword("");
    setFormRole("USER");
    setFormIsActive(true);
    setModalVisible(true);
  };

  const handleOpenEdit = (user: User) => {
    setModalMode("edit");
    setCurrentUserId(user.id);
    setFormUsername(user.username);
    setFormMobile(user.mobile);
    setFormPassword(user.mobile); // display indicator
    setFormRole(user.role);
    setFormIsActive(user.is_active);
    setModalVisible(true);
  };

  const handleSaveModal = async () => {
    if (!formUsername || !formMobile) {
      Alert.alert("त्रुटी", "कृपया युझरनेम आणि मोबाईल नंबर भरा.");
      return;
    }

    if (modalMode === "add") {
      await adminAPI.createUser({
        fullName: formUsername,
        username: formUsername,
        mobileNumber: formMobile,
        password: formPassword || "user123",
        role: formRole,
        is_active: formIsActive
      });
      showToast("नवीन वापरकर्ता जोडला गेला!");
    } else if (currentUserId) {
      await adminAPI.updateUser(currentUserId, {
        fullName: formUsername,
        mobileNumber: formMobile,
        password: formPassword,
        role: formRole,
        accountStatus: formIsActive ? "ACTIVE" : "DISABLED"
      });
      showToast("वापरकर्ता माहिती अद्यतनित केली!");
    }

    setModalVisible(false);
    loadUsers();
  };

  const handleToggleStatus = async (user: User) => {
    await adminAPI.toggleUserStatus(user.id, !user.is_active);
    showToast(user.is_active ? "वापरकर्ता अक्षम (Disabled) केला!" : "वापरकर्ता सक्रिय केला!");
    loadUsers();
  };

  const handleTogglePermission = async (user: User) => {
    const current = user.permissions_granted ?? false;
    const nextVal = !current;
    try {
      await adminAPI.toggleUserPermission(user.id, nextVal);
      showToast(nextVal ? "परवानगी सक्रिय केली (Permissions Allowed)!" : "परवानगी नाकारली (Permissions Revoked)!");
      loadUsers();
    } catch (e) {
      showToast("परवानगी बदलताना त्रुटी आली.");
    }
  };

  const handleDelete = async (user: User) => {
    const confirmed = Platform.OS === "web"
      ? (typeof window !== "undefined" && window.confirm ? window.confirm(`तुम्हाला '${user.username}' वापरकर्ता हटवायचा आहे का?`) : true)
      : await new Promise(resolve => {
          Alert.alert(
            "खात्री करा",
            `तुम्हाला ${user.username} वापरकर्ता हटवायचा आहे का?`,
            [
              { text: "रद्द करा", style: "cancel", onPress: () => resolve(false) },
              { text: "हटवा", style: "destructive", onPress: () => resolve(true) }
            ]
          );
        });

    if (!confirmed) return;
    try {
      await adminAPI.deleteUser(user.id);
      showToast("वापरकर्ता हटवला गेला!");
      loadUsers();
    } catch (e) {
      showToast("वापरकर्ता हटवताना त्रुटी आली.");
    }
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setToastVisible(true);
  };

  const userList = Array.isArray(users) ? users : [];
  const allCount = userList.length;
  const disabledCount = userList.filter(u => !u.is_active).length;

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="User Management"
        showBack
        onBack={() => navigation.goBack()}
      />

      <View style={styles.container}>
        {/* Header Tabs: All (31) vs Disabled (0) (Matches Screenshot Page 1) */}
        <View style={styles.tabsRow}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === "all" && styles.activeTabBtn]}
            onPress={() => setActiveTab("all")}
          >
            <Text style={[styles.tabText, activeTab === "all" && styles.activeTabText]}>
              All ({allCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === "disabled" && styles.activeTabBtn]}
            onPress={() => setActiveTab("disabled")}
          >
            <Text style={[styles.tabText, activeTab === "disabled" && styles.activeTabText]}>
              Disabled ({disabledCount})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Users List (Matches Screenshot Page 1) */}
        <FlatList
          data={userList}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.userCard}>
              <View style={styles.cardTopRow}>
                <Text style={styles.userName}>{item.username}</Text>
                <View style={styles.rolePill}>
                  <Text style={styles.rolePillText}>{item.role}</Text>
                </View>
                <View style={[styles.statusBadge, !item.is_active && styles.disabledBadge]}>
                  <Text style={[styles.statusBadgeText, !item.is_active && styles.disabledBadgeText]}>
                    {item.is_active ? "Active" : "Disabled"}
                  </Text>
                </View>
              </View>

              <View style={styles.cardDetailsRow}>
                <View style={styles.detailItem}>
                  <Ionicons name="call-outline" size={14} color={theme.colors.textMuted} style={{ marginRight: 4 }} />
                  <Text style={styles.detailText}>{item.mobile || item.mobileNumber || "-"}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.permBadge, { backgroundColor: item.permissions_granted === true ? "#064E3B" : "#7F1D1D" }]}
                  onPress={() => handleTogglePermission(item)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={item.permissions_granted === true ? "shield-checkmark" : "shield-half"}
                    size={11}
                    color={item.permissions_granted === true ? "#34D399" : "#F87171"}
                    style={{ marginRight: 3 }}
                  />
                  <Text style={[styles.permBadgeText, { color: item.permissions_granted === true ? "#34D399" : "#F87171" }]}>
                    {item.permissions_granted === true ? "Perms Allowed" : "No Perms"}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.cardActionsRow}>
                <TouchableOpacity
                  style={styles.historyLink}
                  onPress={() => navigation.navigate("UserActivity", { user: item })}
                >
                  <Text style={styles.historyLinkText}>📞 Call • 💬 SMS • 📍 Location History →</Text>
                </TouchableOpacity>

                <View style={styles.buttonsGroup}>
                  {/* View Details & Activity Timeline Button */}
                  <TouchableOpacity
                    onPress={() => navigation.navigate("UserDetails", { userId: item.id })}
                    style={styles.iconActionBtn}
                    accessibilityLabel="View Details"
                  >
                    <Ionicons name="eye" size={18} color="#A78BFA" />
                  </TouchableOpacity>

                  {/* Edit User Button */}
                  <TouchableOpacity onPress={() => handleOpenEdit(item)} style={styles.iconActionBtn}>
                    <Ionicons name="pencil" size={18} color="#3B82F6" />
                  </TouchableOpacity>

                  {/* Disable User Button */}
                  <TouchableOpacity onPress={() => handleToggleStatus(item)} style={styles.iconActionBtn}>
                    <Ionicons name="ban" size={18} color="#F59E0B" />
                  </TouchableOpacity>

                  {/* Delete User Button */}
                  <TouchableOpacity onPress={() => handleDelete(item)} style={styles.iconActionBtn}>
                    <Ionicons name="trash" size={18} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
          contentContainerStyle={{ paddingBottom: 80 }}
        />

        {/* Floating Add User Button (+) (Matches Screenshot Page 1 & 5) */}
        <TouchableOpacity style={styles.fabButton} onPress={handleOpenAdd}>
          <Ionicons name="add" size={32} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Add / Edit User Modal Dialog (Matches Screenshot Page 5 & 6) */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Ionicons
                name={modalMode === "add" ? "add-circle-outline" : "pencil"}
                size={22}
                color={theme.colors.primaryLight}
                style={{ marginRight: 8 }}
              />
              <Text style={styles.modalTitle}>
                {modalMode === "add" ? "Add New User / Admin" : "Edit User / Admin"}
              </Text>
            </View>

            <View style={styles.modalField}>
              <Text style={styles.fieldLabel}>User Name</Text>
              <TextInput
                style={styles.modalInput}
                value={formUsername}
                onChangeText={setFormUsername}
                placeholder="उदा. रुपेश सर किंवा नाव"
                placeholderTextColor={theme.colors.textMuted}
              />
            </View>

            <View style={styles.modalField}>
              <Text style={styles.fieldLabel}>Mobile Number</Text>
              <TextInput
                style={styles.modalInput}
                value={formMobile}
                onChangeText={setFormMobile}
                placeholder="10 अंकी नंबर..."
                placeholderTextColor={theme.colors.textMuted}
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.modalField}>
              <Text style={styles.fieldLabel}>Password</Text>
              <TextInput
                style={styles.modalInput}
                value={formPassword}
                onChangeText={setFormPassword}
                placeholder="पासवर्ड प्रविष्ट करा..."
                placeholderTextColor={theme.colors.textMuted}
                secureTextEntry
              />
            </View>

            <View style={styles.roleSection}>
              <Text style={styles.fieldLabel}>Role:</Text>
              <View style={styles.roleButtons}>
                <TouchableOpacity
                  style={[styles.roleBtn, formRole === "USER" && styles.activeRoleBtn]}
                  onPress={() => setFormRole("USER")}
                >
                  <Text style={[styles.roleBtnText, formRole === "USER" && styles.activeRoleBtnText]}>USER</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.roleBtn, formRole === "ADMIN" && styles.activeRoleBtn]}
                  onPress={() => setFormRole("ADMIN")}
                >
                  <Text style={[styles.roleBtnText, formRole === "ADMIN" && styles.activeRoleBtnText]}>ADMIN</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.statusRow}>
              <Text style={styles.fieldLabel}>Account Status: {formIsActive ? "Active" : "Disabled"}</Text>
              <Switch
                value={formIsActive}
                onValueChange={setFormIsActive}
                trackColor={{ false: "#4B5563", true: "#10B981" }}
              />
            </View>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.cancelBtn}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={handleSaveModal} style={styles.confirmBtn}>
                <Text style={styles.confirmBtnText}>
                  {modalMode === "add" ? "Add User" : "Save Changes"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Toast message={toastMsg} visible={toastVisible} onDismiss={() => setToastVisible(false)} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
  },
  tabsRow: {
    flexDirection: "row",
    gap: 12,
    marginVertical: 14,
  },
  tabBtn: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  activeTabBtn: {
    backgroundColor: "#1E3A8A",
    borderColor: "#3B82F6",
  },
  tabText: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: "600",
  },
  activeTabText: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  userCard: {
    backgroundColor: "#1E293B", // Card matching screenshot page 1
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  userName: {
    color: theme.colors.textPrimary,
    fontSize: 15,
    fontWeight: "800",
  },
  rolePill: {
    backgroundColor: "#334155",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  rolePillText: {
    color: "#94A3B8",
    fontSize: 10,
    fontWeight: "700",
  },
  statusBadge: {
    marginLeft: "auto",
    backgroundColor: "#064E3B",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  statusBadgeText: {
    color: "#34D399",
    fontSize: 11,
    fontWeight: "700",
  },
  disabledBadge: {
    backgroundColor: "#7F1D1D",
  },
  disabledBadgeText: {
    color: "#F87171",
  },
  cardDetailsRow: {
    flexDirection: "row",
    gap: 20,
    marginTop: 8,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  detailText: {
    color: theme.colors.textMuted,
    fontSize: 12,
  },
  cardActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  historyLink: {
    flex: 1,
  },
  historyLinkText: {
    color: "#93C5FD",
    fontSize: 12,
    fontWeight: "600",
  },
  buttonsGroup: {
    flexDirection: "row",
    gap: 8,
  },
  iconActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  fabButton: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#065F46", // Dark green FAB matching screenshot page 1
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#34D399",
    elevation: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modalContent: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#1E293B",
    borderRadius: theme.borderRadius.lg,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  modalField: {
    marginBottom: 12,
  },
  fieldLabel: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    marginBottom: 4,
  },
  modalInput: {
    backgroundColor: "#0F172A",
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 12,
    height: 44,
    color: "#FFFFFF",
    fontSize: 14,
  },
  roleSection: {
    marginVertical: 10,
  },
  roleButtons: {
    flexDirection: "row",
    gap: 10,
  },
  roleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.md,
    backgroundColor: "#0F172A",
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  activeRoleBtn: {
    backgroundColor: "#065F46",
    borderColor: "#10B981",
  },
  roleBtnText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },
  activeRoleBtnText: {
    color: "#FFFFFF",
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 12,
  },
  modalBtnRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 18,
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  cancelBtnText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: "600",
  },
  confirmBtn: {
    backgroundColor: "#065F46",
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: "#10B981",
  },
  confirmBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  permBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  permBadgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
});

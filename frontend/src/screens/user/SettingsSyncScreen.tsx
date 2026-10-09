import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, ActivityIndicator, Modal, TextInput, Alert, Platform
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Header } from "../../components/Header";
import { Toast } from "../../components/Toast";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { theme } from "../../theme/theme";

export const SettingsSyncScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { user, isAdmin, activePanel, logout, switchPanel } = useAuth();
  const { theme, isDark, setThemeMode } = useTheme();

  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // Admin profile edit state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editFullName, setEditFullName] = useState(user?.fullName || user?.username || "");
  const [editMobile, setEditMobile] = useState(user?.mobile || "");
  const [editPassword, setEditPassword] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const handleOpenEditProfile = () => {
    setEditFullName(user?.fullName || user?.username || "");
    setEditMobile(user?.mobile || "");
    setEditPassword("");
    setEditModalVisible(true);
  };

  const handleSaveProfile = async () => {
    if (!editFullName.trim()) {
      Alert.alert("त्रुटी", "कृपया पूर्ण नाव भरा.");
      return;
    }
    setEditSaving(true);
    try {
      const { adminAPI } = await import("../../api/client");
      await adminAPI.updateUser(user?.id || "", {
        fullName: editFullName.trim(),
        mobileNumber: editMobile.trim(),
        ...(editPassword.trim() ? { password: editPassword.trim() } : {})
      });
      setEditModalVisible(false);
      setToastMessage("प्रोफाइल यशस्वीरित्या अद्यतनित केली!");
      setToastVisible(true);
    } catch (err: any) {
      Alert.alert("त्रुटी", err?.message || "प्रोफाइल अपडेट करताना अडचण आली.");
    } finally {
      setEditSaving(false);
    }
  };

  const handleLogout = () => {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && typeof window.confirm === "function") {
        if (window.confirm("तुम्हाला लॉगआउट करायचे आहे का? (Do you want to log out?)")) {
          logout();
        }
      } else {
        logout();
      }
    } else {
      Alert.alert(
        "लॉगआउट",
        "तुम्हाला लॉगआउट करायचे आहे का?",
        [
          { text: "रद्द करा", style: "cancel" },
          {
            text: "होय, लॉगआउट करा",
            style: "destructive",
            onPress: () => logout()
          }
        ]
      );
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <Header title={isAdmin && activePanel === "ADMIN" ? "System Administration" : "सेटिंग्ज (Settings)"} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* User Profile Card */}
        <View style={styles.userCard}>
          <View style={styles.userAvatar}>
            <Ionicons name={isAdmin ? "shield-checkmark" : "person"} size={26} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.userName}>{user?.fullName || user?.username || "User"}</Text>
            <Text style={styles.userMeta}>
              मोबाईल: {user?.mobile || "-"}
            </Text>
            <View style={styles.roleTag}>
              <Ionicons
                name={user?.role === "ADMIN" ? "shield-checkmark" : "person-circle"}
                size={12}
                color={user?.role === "ADMIN" ? "#34D399" : "#93C5FD"}
                style={{ marginRight: 4 }}
              />
              <Text style={[styles.roleTagText, { color: user?.role === "ADMIN" ? "#34D399" : "#93C5FD" }]}>
                {user?.role === "ADMIN" ? "System Administrator" : "Field Worker (User)"}
              </Text>
            </View>
            {user?.assignedVillages && user.assignedVillages.length > 0 && (
              <View style={styles.villageTag}>
                <Ionicons name="location" size={11} color="#FBBF24" style={{ marginRight: 4 }} />
                <Text style={styles.villageTagText}>
                  वाटप गावे: साखराळे
                </Text>
              </View>
            )}
          </View>
          {isAdmin && (
            <TouchableOpacity
              style={styles.editProfileBtn}
              onPress={handleOpenEditProfile}
              activeOpacity={0.7}
            >
              <Ionicons name="pencil" size={16} color="#60A5FA" />
            </TouchableOpacity>
          )}
        </View>

        {/* Admin-only: System Administration Info */}
        {isAdmin && activePanel === "ADMIN" && (
          <>
            <Text style={[styles.sectionHeading, { color: theme.colors.textPrimary }]}>🔧 System Administration</Text>
            <View style={[styles.adminInfoCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              <View style={styles.adminInfoRow}>
                <Ionicons name="server-outline" size={18} color="#60A5FA" style={{ marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.adminInfoLabel, { color: theme.colors.textMuted }]}>Backend Server</Text>
                  <Text style={[styles.adminInfoValue, { color: theme.colors.textPrimary }]}>localhost:8000 (FastAPI + MongoDB)</Text>
                </View>
                <View style={styles.statusDot} />
              </View>

              <View style={[styles.adminInfoRow, { borderTopWidth: 1, borderTopColor: theme.colors.border, marginTop: 8, paddingTop: 10 }]}>
                <Ionicons name="people-outline" size={18} color="#A78BFA" style={{ marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.adminInfoLabel, { color: theme.colors.textMuted }]}>Application Role</Text>
                  <Text style={[styles.adminInfoValue, { color: theme.colors.textPrimary }]}>Admin - Full Access</Text>
                </View>
              </View>

              <View style={[styles.adminInfoRow, { borderTopWidth: 1, borderTopColor: theme.colors.border, marginTop: 8, paddingTop: 10 }]}>
                <Ionicons name="location-outline" size={18} color="#34D399" style={{ marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.adminInfoLabel, { color: theme.colors.textMuted }]}>Data Scope</Text>
                  <Text style={[styles.adminInfoValue, { color: theme.colors.textPrimary }]}>साखराळे ग्राम (Sakharale Village) - वाळवा तालुका</Text>
                </View>
              </View>
            </View>
          </>
        )}

        {/* Panel Switch (Admin Only) */}
        {isAdmin && (
          <>
            <Text style={[styles.sectionHeading, { color: theme.colors.textPrimary }]}>पॅनल नियंत्रण (Panel Switch)</Text>
            <TouchableOpacity
              style={[styles.panelSwitchCard, { backgroundColor: theme.colors.card, borderColor: activePanel === "ADMIN" ? "#A78BFA" : "#3B82F6" }]}
              onPress={() => switchPanel(activePanel === "ADMIN" ? "USER" : "ADMIN")}
              activeOpacity={0.7}
            >
              <View style={[styles.panelIconWrap, { backgroundColor: activePanel === "ADMIN" ? "rgba(167, 139, 250, 0.15)" : "rgba(59, 130, 246, 0.15)" }]}>
                <Ionicons
                  name={activePanel === "ADMIN" ? "people" : "shield-checkmark"}
                  size={26}
                  color={activePanel === "ADMIN" ? "#A78BFA" : "#60A5FA"}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.panelSwitchTitle, { color: theme.colors.textPrimary }]}>
                  {activePanel === "ADMIN" ? "👤 User Panel वर जा" : "🛡️ Admin Panel वर जा"}
                </Text>
                <Text style={[styles.panelSwitchSubtitle, { color: theme.colors.textMuted }]}>
                  {activePanel === "ADMIN"
                    ? "साखराळे मतदार यादी, अहवाल पहा"
                    : "प्रशासक नियंत्रण, युझर मॅनेजमेंट आणि अपलोड स्टुडिओ"}
                </Text>
                <View style={styles.currentPanelBadge}>
                  <Text style={[styles.currentPanelText, { color: theme.colors.textSecondary }]}>
                    सध्या: {activePanel === "ADMIN" ? "Admin Panel" : "User Panel"}
                  </Text>
                </View>
              </View>
              <Ionicons name="arrow-forward-circle" size={28} color={activePanel === "ADMIN" ? "#A78BFA" : "#60A5FA"} />
            </TouchableOpacity>
          </>
        )}

        {/* App Theme (Dark & White Mode) */}
        <Text style={[styles.sectionHeading, { color: theme.colors.textPrimary }]}>ॲप्लिकेशन थीम (App Theme)</Text>
        <View style={[styles.themeCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <TouchableOpacity
            style={[
              styles.themeOptionBtn,
              isDark && styles.themeOptionActive,
              { borderColor: isDark ? "#6366F1" : theme.colors.border, backgroundColor: isDark ? "rgba(99, 102, 241, 0.15)" : "transparent" }
            ]}
            onPress={() => setThemeMode("dark")}
            activeOpacity={0.7}
          >
            <Ionicons name="moon" size={20} color={isDark ? "#A78BFA" : theme.colors.textMuted} />
            <Text style={[styles.themeOptionText, { color: isDark ? (theme.isDark ? "#FFFFFF" : "#0F172A") : theme.colors.textMuted, fontWeight: isDark ? "800" : "600" }]}>
              डार्क मोड (Dark Mode)
            </Text>
            {isDark && (
              <Ionicons name="checkmark-circle" size={18} color="#34D399" style={{ marginLeft: "auto" }} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.themeOptionBtn,
              !isDark && styles.themeOptionActive,
              { borderColor: !isDark ? "#F59E0B" : theme.colors.border, backgroundColor: !isDark ? "rgba(245, 158, 11, 0.15)" : "transparent" }
            ]}
            onPress={() => setThemeMode("light")}
            activeOpacity={0.7}
          >
            <Ionicons name="sunny" size={20} color={!isDark ? "#F59E0B" : theme.colors.textMuted} />
            <Text style={[styles.themeOptionText, { color: !isDark ? theme.colors.textPrimary : theme.colors.textMuted, fontWeight: !isDark ? "800" : "600" }]}>
              व्हाईट मोड (White / Light Mode)
            </Text>
            {!isDark && (
              <Ionicons name="checkmark-circle" size={18} color="#34D399" style={{ marginLeft: "auto" }} />
            )}
          </TouchableOpacity>
        </View>

        {/* Logout Button */}
        <Text style={[styles.sectionHeading, { color: theme.colors.textPrimary }]}>खाते (Account)</Text>
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.7}
        >
          <Ionicons name="log-out-outline" size={22} color="#EF4444" style={{ marginRight: 10 }} />
          <Text style={styles.logoutButtonText}>लॉगआउट (Logout)</Text>
        </TouchableOpacity>

        {/* App Info */}
        <View style={styles.appInfoCard}>
          <Text style={styles.appInfoTitle}>निवडणूक व्यवस्थापन अॅप</Text>
          <Text style={styles.appInfoText}>साखराळे ग्राम • वाळवा तालुका • सांगली जिल्हा</Text>
          <Text style={styles.appInfoVersion}>Version 2.0 • Powered by FastAPI + MongoDB</Text>
        </View>
      </ScrollView>

      {/* Admin Profile Edit Modal */}
      <Modal visible={editModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Ionicons name="person-circle-outline" size={22} color="#60A5FA" style={{ marginRight: 8 }} />
              <Text style={styles.modalTitle}>प्रोफाइल अद्यतनित करा (Edit Profile)</Text>
            </View>

            <View style={styles.modalField}>
              <Text style={styles.fieldLabel}>पूर्ण नाव (Full Name)</Text>
              <TextInput
                style={styles.modalInput}
                value={editFullName}
                onChangeText={setEditFullName}
                placeholder="पूर्ण नाव प्रविष्ट करा"
                placeholderTextColor={theme.colors.textMuted}
              />
            </View>

            <View style={styles.modalField}>
              <Text style={styles.fieldLabel}>मोबाईल नंबर (Mobile Number)</Text>
              <TextInput
                style={styles.modalInput}
                value={editMobile}
                onChangeText={setEditMobile}
                placeholder="10 अंकी मोबाईल नंबर"
                placeholderTextColor={theme.colors.textMuted}
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.modalField}>
              <Text style={styles.fieldLabel}>नवीन पासवर्ड (रिकामे ठेवल्यास बदलणार नाही)</Text>
              <TextInput
                style={styles.modalInput}
                value={editPassword}
                onChangeText={setEditPassword}
                placeholder="नवीन पासवर्ड..."
                placeholderTextColor={theme.colors.textMuted}
                secureTextEntry
              />
            </View>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                onPress={() => setEditModalVisible(false)}
                style={styles.cancelBtn}
              >
                <Text style={styles.cancelBtnText}>रद्द करा</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveProfile}
                style={styles.confirmBtn}
                disabled={editSaving}
              >
                {editSaving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.confirmBtnText}>सेव करा</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Toast
        message={toastMessage}
        visible={toastVisible}
        onDismiss={() => setToastVisible(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: 50,
  },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1E3A8A",
    padding: 16,
    borderRadius: theme.borderRadius.lg,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#3B82F6",
  },
  userAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  userName: {
    color: "#FFFFFF",
    fontSize: theme.typography.sizes.md,
    fontWeight: "800",
  },
  userMeta: {
    color: "#93C5FD",
    fontSize: 12,
    marginTop: 3,
  },
  roleTag: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 5,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  roleTagText: {
    fontSize: 10,
    fontWeight: "700",
  },
  villageTag: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    alignSelf: "flex-start",
  },
  villageTagText: {
    color: "#FBBF24",
    fontSize: 11,
    fontWeight: "600",
  },
  editProfileBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(96, 165, 250, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(96, 165, 250, 0.3)",
    marginLeft: 10,
  },
  sectionHeading: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 10,
    marginTop: 4,
  },
  adminInfoCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  adminInfoRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  adminInfoLabel: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  adminInfoValue: {
    color: theme.colors.textPrimary,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 2,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#10B981",
  },
  panelSwitchCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1.5,
  },
  panelIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  panelSwitchTitle: {
    color: theme.colors.textPrimary,
    fontSize: 15,
    fontWeight: "800",
  },
  panelSwitchSubtitle: {
    color: theme.colors.textMuted,
    fontSize: 11,
    marginTop: 3,
    lineHeight: 16,
  },
  currentPanelBadge: {
    marginTop: 6,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  currentPanelText: {
    color: theme.colors.textSecondary,
    fontSize: 10,
    fontWeight: "700",
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    paddingVertical: 16,
    borderRadius: theme.borderRadius.lg,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#EF4444",
  },
  logoutButtonText: {
    color: "#EF4444",
    fontSize: 15,
    fontWeight: "800",
  },
  appInfoCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.md,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 4,
  },
  appInfoTitle: {
    color: theme.colors.textPrimary,
    fontSize: 13,
    fontWeight: "700",
  },
  appInfoText: {
    color: theme.colors.textSecondary,
    fontSize: 11,
  },
  appInfoVersion: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontStyle: "italic",
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
    fontSize: 15,
    fontWeight: "800",
  },
  modalField: {
    marginBottom: 12,
  },
  fieldLabel: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    marginBottom: 4,
    fontWeight: "600",
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
  modalBtnRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 16,
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
    backgroundColor: "#1E3A8A",
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: "#3B82F6",
    minWidth: 80,
    alignItems: "center",
  },
  confirmBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  themeCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 8,
  },
  themeOptionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 12,
  },
  themeOptionActive: {
    borderWidth: 1.5,
  },
  themeOptionText: {
    fontSize: 14,
    fontWeight: "700",
  },
});

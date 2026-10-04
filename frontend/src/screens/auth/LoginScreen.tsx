import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  SafeAreaView, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Modal
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { theme } from "../../theme/theme";
import {
  getServerBaseUrl,
  setServerBaseUrl,
  testServerConnection,
  DEFAULT_API_BASE_URL
} from "../../api/client";

export const LoginScreen: React.FC = () => {
  const { login, demoLogin } = useAuth();
  const { language, toggleLanguage, t } = useLanguage();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Server Settings Modal State
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [serverUrlInput, setServerUrlInput] = useState(getServerBaseUrl());
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    setServerUrlInput(getServerBaseUrl());
  }, []);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      setErrorMessage(
        language === "mr"
          ? "कृपया युझरनेम आणि पासवर्ड दोन्ही प्रविष्ट करा."
          : "Please enter both username and password."
      );
      return;
    }
    setErrorMessage(null);
    setLoading(true);
    try {
      const ok = await login(username.trim(), password.trim());
      if (!ok) {
        setErrorMessage(
          language === "mr"
            ? "लॉगिन अयशस्वी: युझरनेम किंवा पासवर्ड चुकीचा आहे."
            : "Login failed: Invalid username or password."
        );
      }
    } catch (err: any) {
      setErrorMessage(err?.message || "सर्व्हरशी संपर्क होऊ शकला नाही. कृपया बॅकएंड चालू असल्याची खात्री करा.");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenSettings = () => {
    setServerUrlInput(getServerBaseUrl());
    setTestResult(null);
    setSettingsModalVisible(true);
  };

  const handleTestConnection = async () => {
    if (!serverUrlInput.trim()) return;
    setTestingConnection(true);
    setTestResult(null);
    try {
      const res = await testServerConnection(serverUrlInput.trim());
      setTestResult(res);
    } catch (e: any) {
      setTestResult({
        success: false,
        message: "जोडणी अयशस्वी. IP बरोबर आहे का आणि बॅकएंड चालू आहे का ते तपासा."
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSaveServerUrl = async () => {
    if (!serverUrlInput.trim()) return;
    const applied = await setServerBaseUrl(serverUrlInput.trim());
    setServerUrlInput(applied);
    setSettingsModalVisible(false);
    setErrorMessage(null);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.topBar}>
            <View style={styles.systemTag}>
              <Ionicons name="shield-checkmark" size={14} color="#10B981" style={{ marginRight: 4 }} />
              <Text style={styles.systemTagText}>सुरक्षित प्रणाली २०२६</Text>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              {/* Server Settings Button */}
              <TouchableOpacity
                onPress={handleOpenSettings}
                style={styles.serverSettingsBadge}
                activeOpacity={0.7}
              >
                <Ionicons name="server-outline" size={15} color="#93C5FD" style={{ marginRight: 4 }} />
                <Text style={styles.serverSettingsText}>सर्व्हर</Text>
              </TouchableOpacity>

              {/* Language Switcher */}
              <TouchableOpacity onPress={toggleLanguage} style={styles.langBadge} activeOpacity={0.7}>
                <Ionicons name="globe-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.langText}>{language === "mr" ? "English" : "मराठी"}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.content}>
            <View style={styles.logoCircle}>
              <Ionicons name="finger-print" size={44} color="#60A5FA" />
            </View>

            <Text style={styles.title}>{t("app_title")}</Text>
            <Text style={styles.subtitle}>
              {language === "mr"
                ? "मतदार व सभासद व्यवस्थापन प्रणाली २०२६ (साखराळे)"
                : "Voter and Member Management System 2026 (Sakharele)"}
            </Text>

            <View style={styles.formCard}>
              <View style={styles.cardHeader}>
                <View style={styles.lockIconCircle}>
                  <Ionicons name="lock-closed" size={20} color="#60A5FA" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.cardTitle}>
                    {language === "mr" ? "खात्यात प्रवेश करा" : "Sign In to Your Account"}
                  </Text>
                  <Text style={styles.cardSubtitle}>
                    {language === "mr"
                      ? "आपले युझरनेम व पासवर्ड प्रविष्ट करा"
                      : "Enter your credentials to continue"}
                  </Text>
                </View>
              </View>

              {errorMessage && (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={18} color="#EF4444" style={{ marginRight: 8, marginTop: 2 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.errorText}>{errorMessage}</Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8, alignItems: "center" }}>
                      <TouchableOpacity
                        onPress={handleOpenSettings}
                        style={{ alignSelf: "flex-start", marginRight: 4 }}
                      >
                        <Text style={{ color: "#93C5FD", fontSize: 12, fontWeight: "700", textDecorationLine: "underline" }}>
                          ⚙️ सर्व्हर IP बदला
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => demoLogin("ADMIN")}
                        style={{ backgroundColor: "#1E3A8A", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}
                        activeOpacity={0.8}
                      >
                        <Text style={{ color: "#BFDBFE", fontSize: 11, fontWeight: "700" }}>
                          ⚡ डेमो ॲडमिन
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => demoLogin("USER")}
                        style={{ backgroundColor: "#064E3B", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}
                        activeOpacity={0.8}
                      >
                        <Text style={{ color: "#6EE7B7", fontSize: 11, fontWeight: "700" }}>
                          ⚡ डेमो युझर (Permissions)
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              )}

              <View style={styles.field}>
                <Text style={styles.label}>
                  {language === "mr" ? "युझरनेम किंवा मोबाईल क्रमांक" : "Username or Mobile Number"}
                </Text>
                <View style={styles.inputBox}>
                  <Ionicons name="person-outline" size={18} color="#94A3B8" style={{ marginRight: 10 }} />
                  <TextInput
                    style={styles.textInput}
                    value={username}
                    onChangeText={(text) => { setUsername(text); setErrorMessage(null); }}
                    placeholder={language === "mr" ? "युझरनेम प्रविष्ट करा" : "Enter username"}
                    placeholderTextColor={theme.colors.textMuted}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {username.length > 0 && (
                    <TouchableOpacity onPress={() => setUsername("")}>
                      <Ionicons name="close-circle" size={16} color="#64748B" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>
                  {language === "mr" ? "पासवर्ड" : "Password"}
                </Text>
                <View style={styles.inputBox}>
                  <Ionicons name="lock-closed-outline" size={18} color="#94A3B8" style={{ marginRight: 10 }} />
                  <TextInput
                    style={styles.textInput}
                    value={password}
                    onChangeText={(text) => { setPassword(text); setErrorMessage(null); }}
                    placeholder="••••••••"
                    placeholderTextColor={theme.colors.textMuted}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ padding: 4 }}>
                    <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={18} color="#94A3B8" />
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
                onPress={handleLogin}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator color="#FFFFFF" size="small" style={{ marginRight: 8 }} />
                    <Text style={styles.loginBtnText}>
                      {language === "mr" ? "प्रमाणीकरण होत आहे..." : "Authenticating..."}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.loginBtnContent}>
                    <Ionicons name="log-in-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                    <Text style={styles.loginBtnText}>
                      {language === "mr" ? "लॉग इन करा" : "Log In"}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.footerInfo}>
              <Ionicons name="information-circle-outline" size={14} color="#475569" style={{ marginRight: 6 }} />
              <Text style={styles.footerInfoText}>
                {language === "mr" ? "प्रवेशासाठी ॲडमिनशी संपर्क करा" : "Contact your administrator for access"}
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Server Settings Modal */}
      <Modal visible={settingsModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Ionicons name="server" size={22} color="#60A5FA" style={{ marginRight: 8 }} />
                <Text style={styles.modalTitle}>बॅकएंड सर्व्हर सेटिंग</Text>
              </View>
              <TouchableOpacity onPress={() => setSettingsModalVisible(false)}>
                <Ionicons name="close" size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalDesc}>
              मोबाईल फोनवरून कनेक्ट करण्यासाठी आपल्या कॉम्प्युटरचा लोकल IP पत्ता प्रविष्ट करा (उदा. Wi-Fi IP).
            </Text>

            <View style={styles.serverInputGroup}>
              <Text style={styles.serverInputLabel}>सर्व्हर API URL:</Text>
              <TextInput
                style={styles.serverTextInput}
                value={serverUrlInput}
                onChangeText={(val) => {
                  setServerUrlInput(val);
                  setTestResult(null);
                }}
                placeholder="उदा. https://election-api.onrender.com/api"
                placeholderTextColor={theme.colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Quick preset buttons */}
            <View style={styles.presetRow}>
              <TouchableOpacity
                style={styles.presetBtn}
                onPress={() => {
                  setServerUrlInput("https://election-api.onrender.com/api");
                  setTestResult(null);
                }}
              >
                <Text style={styles.presetBtnText}>🌐 Production Server</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.presetBtn}
                onPress={() => {
                  setServerUrlInput("http://localhost:8000/api");
                  setTestResult(null);
                }}
              >
                <Text style={styles.presetBtnText}>💻 localhost (Dev)</Text>
              </TouchableOpacity>
            </View>

            {testResult && (
              <View style={[
                styles.testResultBox,
                testResult.success ? styles.testSuccessBox : styles.testErrorBox
              ]}>
                <Ionicons
                  name={testResult.success ? "checkmark-circle" : "close-circle"}
                  size={18}
                  color={testResult.success ? "#10B981" : "#EF4444"}
                  style={{ marginRight: 6 }}
                />
                <Text style={[
                  styles.testResultText,
                  testResult.success ? { color: "#6EE7B7" } : { color: "#FCA5A5" }
                ]}>
                  {testResult.message}
                </Text>
              </View>
            )}

            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={styles.testBtn}
                onPress={handleTestConnection}
                disabled={testingConnection}
              >
                {testingConnection ? (
                  <ActivityIndicator size="small" color="#93C5FD" />
                ) : (
                  <>
                    <Ionicons name="flash-outline" size={16} color="#93C5FD" style={{ marginRight: 4 }} />
                    <Text style={styles.testBtnText}>कनेक्शन तपासा</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.applyBtn}
                onPress={handleSaveServerUrl}
              >
                <Ionicons name="checkmark-outline" size={18} color="#FFFFFF" style={{ marginRight: 4 }} />
                <Text style={styles.applyBtnText}>सेव्ह करा</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.background },
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: "center", paddingBottom: 32 },
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  systemTag: { flexDirection: "row", alignItems: "center", backgroundColor: "#064E3B", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: "#059669" },
  systemTagText: { color: "#6EE7B7", fontSize: 11, fontWeight: "700" },
  serverSettingsBadge: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(59, 130, 246, 0.15)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: theme.borderRadius.full, borderWidth: 1, borderColor: "rgba(59, 130, 246, 0.3)" },
  serverSettingsText: { color: "#93C5FD", fontSize: 12, fontWeight: "700" },
  langBadge: { flexDirection: "row", alignItems: "center", backgroundColor: theme.colors.card, paddingHorizontal: 12, paddingVertical: 6, borderRadius: theme.borderRadius.full, borderWidth: 1, borderColor: theme.colors.border },
  langText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  content: { flex: 1, paddingHorizontal: 20, justifyContent: "center", alignItems: "center", maxWidth: 460, width: "100%", alignSelf: "center", marginTop: 10 },
  logoCircle: { width: 76, height: 76, borderRadius: 38, backgroundColor: "#1E293B", alignItems: "center", justifyContent: "center", marginBottom: 14, borderWidth: 2, borderColor: "#3B82F6", shadowColor: "#3B82F6", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  title: { color: theme.colors.textPrimary, fontSize: 22, fontWeight: "900", textAlign: "center" },
  subtitle: { color: theme.colors.textSecondary, fontSize: 13, marginTop: 4, marginBottom: 20, textAlign: "center", lineHeight: 18 },
  formCard: { width: "100%", backgroundColor: theme.colors.card, borderRadius: 16, padding: 22, borderWidth: 1, borderColor: theme.colors.border, shadowColor: "#000000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 8 },
  cardHeader: { flexDirection: "row", alignItems: "center", marginBottom: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  lockIconCircle: { width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(59, 130, 246, 0.15)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(59, 130, 246, 0.3)" },
  cardTitle: { color: theme.colors.textPrimary, fontSize: 15, fontWeight: "800" },
  cardSubtitle: { color: theme.colors.textMuted, fontSize: 11, marginTop: 2 },
  errorBox: { flexDirection: "row", alignItems: "flex-start", backgroundColor: "rgba(239, 68, 68, 0.12)", borderWidth: 1, borderColor: "rgba(239, 68, 68, 0.3)", paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, marginBottom: 14 },
  errorText: { color: "#FCA5A5", fontSize: 12, fontWeight: "600", lineHeight: 17 },
  field: { marginBottom: 16 },
  label: { color: theme.colors.textSecondary, fontSize: 12, fontWeight: "600", marginBottom: 6 },
  inputBox: { flexDirection: "row", alignItems: "center", backgroundColor: theme.colors.surface, borderRadius: 10, paddingHorizontal: 12, height: 48, borderWidth: 1, borderColor: theme.colors.border },
  textInput: { flex: 1, color: theme.colors.textPrimary, fontSize: 14 },
  loginBtn: { backgroundColor: theme.colors.primary, paddingVertical: 14, borderRadius: 10, alignItems: "center", justifyContent: "center", marginTop: 8, shadowColor: theme.colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  loginBtnDisabled: { opacity: 0.6 },
  loginBtnContent: { flexDirection: "row", alignItems: "center" },
  loadingRow: { flexDirection: "row", alignItems: "center" },
  loginBtnText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
  footerInfo: { flexDirection: "row", alignItems: "center", marginTop: 20, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: "rgba(71, 85, 105, 0.1)", borderRadius: 8, borderWidth: 1, borderColor: "rgba(71, 85, 105, 0.2)" },
  footerInfoText: { color: "#475569", fontSize: 12, fontWeight: "500" },

  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "center", alignItems: "center", padding: 20 },
  modalContent: { width: "100%", maxWidth: 440, backgroundColor: "#1E293B", borderRadius: 16, padding: 20, borderWidth: 1, borderColor: "#334155" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  modalTitle: { color: "#FFFFFF", fontSize: 17, fontWeight: "800" },
  modalDesc: { color: "#94A3B8", fontSize: 12, lineHeight: 18, marginBottom: 16 },
  serverInputGroup: { marginBottom: 12 },
  serverInputLabel: { color: "#CBD5E1", fontSize: 12, fontWeight: "700", marginBottom: 6 },
  serverTextInput: { backgroundColor: "#0F172A", borderRadius: 8, borderWidth: 1, borderColor: "#334155", color: "#FFFFFF", paddingHorizontal: 12, height: 44, fontSize: 13 },
  presetRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  presetBtn: { backgroundColor: "#334155", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  presetBtnText: { color: "#93C5FD", fontSize: 11, fontWeight: "600" },
  testResultBox: { flexDirection: "row", alignItems: "center", padding: 10, borderRadius: 8, marginBottom: 14 },
  testSuccessBox: { backgroundColor: "rgba(16, 185, 129, 0.15)", borderWidth: 1, borderColor: "rgba(16, 185, 129, 0.3)" },
  testErrorBox: { backgroundColor: "rgba(239, 68, 68, 0.15)", borderWidth: 1, borderColor: "rgba(239, 68, 68, 0.3)" },
  testResultText: { flex: 1, fontSize: 12, fontWeight: "600" },
  modalActionRow: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 8 },
  testBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(59, 130, 246, 0.15)", borderWidth: 1, borderColor: "#3B82F6", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8 },
  testBtnText: { color: "#93C5FD", fontSize: 13, fontWeight: "700" },
  applyBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#2563EB", paddingHorizontal: 18, paddingVertical: 10, borderRadius: 8 },
  applyBtnText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" }
});

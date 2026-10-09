import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Linking,
  ScrollView,
  Platform,
  AppState,
  Alert
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { theme } from "../../theme/theme";
import {
  checkCurrentPermissionsStatus,
  requestLocationPermission,
  requestCallHistoryPermission,
  requestSmsPermission,
  PermissionDetails,
  PermissionStateValue
} from "../../utils/devicePermissions";
import { authAPI, logUserActivity } from "../../api/client";

interface PermissionGateScreenProps {
  onPermissionsGranted: () => void;
}

export const PermissionGateScreen: React.FC<PermissionGateScreenProps> = ({
  onPermissionsGranted,
}) => {
  const { user, logout } = useAuth();
  const { theme, isDark } = useTheme();

  const [permsState, setPermsState] = useState<PermissionDetails>({
    location: false,
    callHistory: false,
    phoneCall: false,
    sms: false,
    allGranted: false,
    locationStatus: "UNDETERMINED",
    callStatus: "UNDETERMINED",
    smsStatus: "UNDETERMINED",
  });

  const [loading, setLoading] = useState<boolean>(true);
  const [processingPerms, setProcessingPerms] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<string | null>(null);

  /**
   * Directly verify physical device permissions.
   * Never bypass or rely on cached database flags.
   */
  const verifyDevicePermissions = useCallback(async (): Promise<boolean> => {
    try {
      const fresh = await checkCurrentPermissionsStatus();
      setPermsState(fresh);

      // Inform backend of current physical device permission state
      await authAPI.updateSelfPermissions(fresh.allGranted, {
        location: fresh.location,
        callHistory: fresh.callHistory,
        phoneCall: fresh.callHistory,
        sms: fresh.sms,
      }).catch(() => {});

      if (fresh.allGranted) {
        onPermissionsGranted();
        return true;
      }
      return false;
    } catch (e) {
      console.warn("Permission verification failed:", e);
      return false;
    } finally {
      setLoading(false);
    }
  }, [onPermissionsGranted]);

  // Initial check on mount
  useEffect(() => {
    verifyDevicePermissions();
  }, [verifyDevicePermissions]);

  // Recheck all permissions whenever the app returns to the foreground
  useEffect(() => {
    const subscription = AppState.addEventListener("change", async (nextAppState) => {
      if (nextAppState === "active") {
        await verifyDevicePermissions();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [verifyDevicePermissions]);

  /**
   * Request permissions SEQUENTIALLY:
   * 1. Location
   * 2. Call History
   * 3. SMS
   * 
   * Strict Access Rule: The user must NOT access the User Panel unless ALL THREE
   * required permissions are successfully granted and verified on the device.
   */
  const handleRequestSequentialPermissions = async () => {
    setProcessingPerms(true);
    try {
      // Step 1: Request Location
      setCurrentStep("location");
      const locRes = await requestLocationPermission();
      setPermsState((prev) => ({
        ...prev,
        location: locRes.granted,
        locationStatus: locRes.status,
      }));

      // Log location if granted (preserving real-time location check-in)
      if (locRes.granted && locRes.location) {
        const loc = locRes.location;
        const placeName = loc.placeName || loc.address || "साखराळे";
        const dateStr = loc.dateStr || new Date().toLocaleDateString("en-GB");
        const timeStr = loc.timeStr || new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });

        await logUserActivity({
          action: "LOCATION_CHECKIN",
          userId: user?.id,
          username: user?.username,
          details: `स्थान: ${placeName} (अक्षांश: ${loc.latitude.toFixed(5)}, रेखांश: ${loc.longitude.toFixed(5)}) • दिनांक: ${dateStr}, वेळ: ${timeStr}`,
          metadata: {
            latitude: loc.latitude,
            longitude: loc.longitude,
            accuracy: loc.accuracy,
            address: loc.address,
            placeName,
            city: loc.city,
            district: loc.district,
            date: dateStr,
            time: timeStr,
            trigger: "SEQUENTIAL_PERMISSION_FLOW",
          },
        }).catch(() => {});
      }

      // Step 2: Request Call History (READ_CALL_LOG)
      setCurrentStep("callHistory");
      const callRes = await requestCallHistoryPermission();
      setPermsState((prev) => ({
        ...prev,
        callHistory: callRes.granted,
        phoneCall: callRes.granted,
        callStatus: callRes.status,
      }));

      // Step 3: Request SMS (READ_SMS)
      setCurrentStep("sms");
      const smsRes = await requestSmsPermission();
      setPermsState((prev) => ({
        ...prev,
        sms: smsRes.granted,
        smsStatus: smsRes.status,
      }));

      setCurrentStep(null);

      // Final strict verification directly against physical device OS
      const verified = await checkCurrentPermissionsStatus();
      setPermsState(verified);

      await authAPI.updateSelfPermissions(verified.allGranted, {
        location: verified.location,
        callHistory: verified.callHistory,
        phoneCall: verified.callHistory,
        sms: verified.sms,
      }).catch(() => {});

      if (verified.allGranted) {
        onPermissionsGranted();
      } else {
        const deniedList: string[] = [];
        if (!verified.location) deniedList.push("स्थान (Location)");
        if (!verified.callHistory) deniedList.push("कॉल इतिहास (Call History)");
        if (!verified.sms) deniedList.push("एसएमएस (SMS)");

        Alert.alert(
          "परवानगी अपूर्ण (Permissions Incomplete)",
          `युझर पॅनेल उघडण्यासाठी खालील परवानग्या आवश्यक आहेत:\n\n• ${deniedList.join("\n• ")}\n\nकृपया सर्व परवानग्या द्या किंवा सेटिंग्जमधून सक्षम करा.`,
          [{ text: "समजले (OK)" }]
        );
      }
    } catch (err) {
      console.warn("Sequential request failed:", err);
    } finally {
      setCurrentStep(null);
      setProcessingPerms(false);
    }
  };

  /** Individual retry for location */
  const handleRetryLocation = async () => {
    const res = await requestLocationPermission();
    setPermsState((prev) => ({
      ...prev,
      location: res.granted,
      locationStatus: res.status,
    }));
    await verifyDevicePermissions();
  };

  /** Individual retry for call history */
  const handleRetryCallHistory = async () => {
    const res = await requestCallHistoryPermission();
    setPermsState((prev) => ({
      ...prev,
      callHistory: res.granted,
      phoneCall: res.granted,
      callStatus: res.status,
    }));
    await verifyDevicePermissions();
  };

  /** Individual retry for SMS */
  const handleRetrySms = async () => {
    const res = await requestSmsPermission();
    setPermsState((prev) => ({
      ...prev,
      sms: res.granted,
      smsStatus: res.status,
    }));
    await verifyDevicePermissions();
  };

  /** Open Android App Settings */
  const handleOpenSettings = () => {
    if (Platform.OS === "android" || Platform.OS === "ios") {
      Linking.openSettings().catch(() => {
        Alert.alert("त्रुटी", "सेटिंग्ज उघडणे शक्य झाले नाही.");
      });
    } else {
      Alert.alert("माहिती", "कृपया ब्राउझर सेटिंग्जमधून परवानग्या तपासा.");
    }
  };

  const renderBadge = (granted: boolean, status: PermissionStateValue, onPress: () => void) => {
    if (granted) {
      return (
        <View style={[styles.permToggleBtn, styles.permToggleBtnGranted]}>
          <Text style={[styles.permToggleBtnText, { color: "#FFFFFF" }]}>मंजूर ✓</Text>
        </View>
      );
    }

    if (status === "RESTRICTED") {
      return (
        <TouchableOpacity
          style={[styles.permToggleBtn, styles.permToggleBtnRestricted]}
          onPress={handleOpenSettings}
          activeOpacity={0.7}
        >
          <Text style={[styles.permToggleBtnText, { color: "#FFFFFF" }]}>प्रतिबंधित / सेटिंग्ज ⚙️</Text>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        style={[styles.permToggleBtn, styles.permToggleBtnPending]}
        onPress={onPress}
        disabled={processingPerms}
        activeOpacity={0.7}
      >
        <Text style={[styles.permToggleBtnText, { color: theme.colors.textPrimary }]}>परवानगी द्या</Text>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.colors.primaryLight} />
          <Text style={[styles.loadingText, { color: theme.colors.textMuted }]}>
            डिव्हाइस परवानग्या तपासत आहे...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const anyDeniedOrRestricted = !permsState.location || !permsState.callHistory || !permsState.sms;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.permissionCard,
              { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
            ]}
          >
            {/* Header Icon Circle */}
            <View
              style={[
                styles.permIconCircle,
                { backgroundColor: isDark ? "rgba(52, 211, 153, 0.15)" : "#E0F2FE" },
              ]}
            >
              <Ionicons
                name={anyDeniedOrRestricted ? "lock-closed" : "shield-checkmark"}
                size={32}
                color={anyDeniedOrRestricted ? "#F59E0B" : theme.colors.primaryLight}
              />
            </View>

            <Text style={[styles.permModalTitle, { color: theme.colors.textPrimary }]}>
              ॲप परवानग्या व्यवस्थापन
            </Text>

            <Text style={[styles.permModalSubtitle, { color: theme.colors.textMuted }]}>
              युझर पॅनेल उघडण्यासाठी खालील तिन्ही परवानग्या (स्थान, कॉल इतिहास आणि एसएमएस) आवश्यक आहेत. सर्व परवानग्या मंजूर झाल्याशिवाय प्रवेश बंद राहील:
            </Text>

            {/* Permission Features List */}
            <View style={styles.permFeatureList}>
              {/* 1. Location Permission */}
              <View
                style={[
                  styles.permFeatureItem,
                  {
                    backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
                    borderColor: theme.colors.border,
                  },
                ]}
              >
                <View
                  style={[
                    styles.permFeatureIconWrap,
                    {
                      backgroundColor: permsState.location
                        ? "rgba(16, 185, 129, 0.15)"
                        : "rgba(245, 158, 11, 0.15)",
                    },
                  ]}
                >
                  <Ionicons
                    name="navigate"
                    size={18}
                    color={permsState.location ? "#10B981" : "#F59E0B"}
                  />
                </View>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={[styles.permFeatureTitle, { color: theme.colors.textPrimary }]}>
                    📍 रिअल-टाईम स्थान (GPS Location)
                  </Text>
                  <Text style={[styles.permFeatureDesc, { color: theme.colors.textMuted }]}>
                    उपस्थिती व अचूक मतदार ठिकाण पडताळणीसाठी आवश्यक.
                  </Text>
                  <Text style={[styles.statusNote, { color: permsState.location ? "#34D399" : "#F87171" }]}>
                    स्थिती: {permsState.location ? "मंजूर (Granted)" : "नाकारले / प्रलंबित (Required)"}
                  </Text>
                </View>
                {renderBadge(permsState.location, permsState.locationStatus, handleRetryLocation)}
              </View>

              {/* 2. Call History Permission */}
              <View
                style={[
                  styles.permFeatureItem,
                  {
                    backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
                    borderColor: theme.colors.border,
                  },
                ]}
              >
                <View
                  style={[
                    styles.permFeatureIconWrap,
                    {
                      backgroundColor: permsState.callHistory
                        ? "rgba(16, 185, 129, 0.15)"
                        : "rgba(99, 102, 241, 0.15)",
                    },
                  ]}
                >
                  <Ionicons
                    name="call"
                    size={18}
                    color={permsState.callHistory ? "#10B981" : "#6366F1"}
                  />
                </View>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={[styles.permFeatureTitle, { color: theme.colors.textPrimary }]}>
                    📞 कॉल इतिहास (Call History)
                  </Text>
                  <Text style={[styles.permFeatureDesc, { color: theme.colors.textMuted }]}>
                    मतदार संपर्क पडताळणी व कॉल नोंदीसाठी आवश्यक.
                  </Text>
                  <Text style={[styles.statusNote, { color: permsState.callHistory ? "#34D399" : "#F87171" }]}>
                    स्थिती:{" "}
                    {permsState.callHistory
                      ? "मंजूर (Granted)"
                      : permsState.callStatus === "RESTRICTED"
                      ? "प्रतिबंधित / अनुपलब्ध (Restricted)"
                      : "नाकारले / प्रलंबित (Required)"}
                  </Text>
                </View>
                {renderBadge(permsState.callHistory, permsState.callStatus, handleRetryCallHistory)}
              </View>

              {/* 3. SMS Permission */}
              <View
                style={[
                  styles.permFeatureItem,
                  {
                    backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
                    borderColor: theme.colors.border,
                  },
                ]}
              >
                <View
                  style={[
                    styles.permFeatureIconWrap,
                    {
                      backgroundColor: permsState.sms
                        ? "rgba(16, 185, 129, 0.15)"
                        : "rgba(14, 165, 233, 0.15)",
                    },
                  ]}
                >
                  <Ionicons
                    name="chatbubbles"
                    size={18}
                    color={permsState.sms ? "#10B981" : "#0EA5E9"}
                  />
                </View>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={[styles.permFeatureTitle, { color: theme.colors.textPrimary }]}>
                    💬 एसएमएस संदेश (SMS Permission)
                  </Text>
                  <Text style={[styles.permFeatureDesc, { color: theme.colors.textMuted }]}>
                    मतदारांना मतदार स्लिप व माहिती पडताळणीसाठी आवश्यक.
                  </Text>
                  <Text style={[styles.statusNote, { color: permsState.sms ? "#34D399" : "#F87171" }]}>
                    स्थिती:{" "}
                    {permsState.sms
                      ? "मंजूर (Granted)"
                      : permsState.smsStatus === "RESTRICTED"
                      ? "प्रतिबंधित / अनुपलब्ध (Restricted)"
                      : "नाकारले / प्रलंबित (Required)"}
                  </Text>
                </View>
                {renderBadge(permsState.sms, permsState.smsStatus, handleRetrySms)}
              </View>
            </View>

            {/* Lock / Explanation Warning Box */}
            <View style={styles.lockWarningBox}>
              <Ionicons name="information-circle" size={18} color="#F59E0B" style={{ marginRight: 8, marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.lockWarningTitle}>कडक सुरक्षा नियम (Strict Rule):</Text>
                <Text style={styles.lockWarningText}>
                  केवळ स्थान परवानगी देऊन युझर पॅनेल उघडणार नाही. स्थान, कॉल इतिहास आणि एसएमएस अशा तिन्ही परवानग्या दिल्याशिवाय युझर पॅनेल पूर्णपणे लॉक राहील.
                </Text>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.buttonStack}>
              {/* Primary: Request Sequential or Retry */}
              <TouchableOpacity
                style={[styles.permAllowBtn, { backgroundColor: theme.colors.primary }]}
                onPress={handleRequestSequentialPermissions}
                disabled={processingPerms}
                activeOpacity={0.8}
              >
                {processingPerms ? (
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
                    <Text style={styles.permAllowBtnText}>
                      {currentStep === "location"
                        ? "स्थान परवानगी विचारत आहे..."
                        : currentStep === "callHistory"
                        ? "कॉल इतिहास परवानगी विचारत आहे..."
                        : currentStep === "sms"
                        ? "एसएमएस परवानगी विचारत आहे..."
                        : "परवानग्या तपासत आहे..."}
                    </Text>
                  </View>
                ) : (
                  <>
                    <Ionicons name="shield-checkmark" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.permAllowBtnText}>
                      तिन्ही परवानग्या क्रमाने द्या (Grant Permissions)
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Secondary: Open Android Settings if any denied or restricted */}
              {anyDeniedOrRestricted && (
                <TouchableOpacity
                  style={[styles.permSettingsBtn, { borderColor: theme.colors.border }]}
                  onPress={handleOpenSettings}
                  activeOpacity={0.7}
                >
                  <Ionicons name="settings-outline" size={17} color="#93C5FD" style={{ marginRight: 6 }} />
                  <Text style={styles.permSettingsBtnText}>
                    Android सेटिंग्ज उघडा (Open Settings)
                  </Text>
                </TouchableOpacity>
              )}

              {/* Logout Option */}
              <TouchableOpacity
                style={styles.permLogoutBtn}
                onPress={() => logout()}
                activeOpacity={0.7}
              >
                <Ionicons name="log-out-outline" size={16} color="#94A3B8" style={{ marginRight: 6 }} />
                <Text style={styles.permLogoutBtnText}>लॉग आऊट (Logout)</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: "600",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  permissionCard: {
    backgroundColor: "#0F172A",
    borderRadius: theme.borderRadius.xl,
    padding: 22,
    width: "100%",
    maxWidth: 440,
    borderWidth: 1,
    borderColor: "#334155",
  },
  permIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(52, 211, 153, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 14,
  },
  permModalTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 6,
  },
  permModalSubtitle: {
    color: theme.colors.textMuted,
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 18,
  },
  permFeatureList: {
    gap: 12,
    marginBottom: 16,
  },
  permFeatureItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  permFeatureIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  permFeatureTitle: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  permFeatureDesc: {
    color: theme.colors.textMuted,
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  statusNote: {
    fontSize: 10,
    fontWeight: "700",
    marginTop: 3,
  },
  lockWarningBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "rgba(245, 158, 11, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.3)",
    padding: 10,
    borderRadius: 10,
    marginBottom: 18,
  },
  lockWarningTitle: {
    color: "#FBBF24",
    fontSize: 11,
    fontWeight: "800",
    marginBottom: 2,
  },
  lockWarningText: {
    color: "#FDE68A",
    fontSize: 11,
    lineHeight: 15,
  },
  buttonStack: {
    gap: 10,
  },
  permAllowBtn: {
    paddingVertical: 13,
    borderRadius: theme.borderRadius.md,
    backgroundColor: "#059669",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  permAllowBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  permSettingsBtn: {
    paddingVertical: 11,
    borderRadius: theme.borderRadius.md,
    backgroundColor: "rgba(59, 130, 246, 0.15)",
    borderWidth: 1,
    borderColor: "#3B82F6",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  permSettingsBtnText: {
    color: "#93C5FD",
    fontSize: 12,
    fontWeight: "700",
  },
  permLogoutBtn: {
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  permLogoutBtnText: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "600",
  },
  permToggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  permToggleBtnGranted: {
    backgroundColor: "#10B981",
  },
  permToggleBtnPending: {
    backgroundColor: "#3B82F6",
  },
  permToggleBtnRestricted: {
    backgroundColor: "#D97706",
  },
  permToggleBtnText: {
    fontSize: 11,
    fontWeight: "700",
  },
});

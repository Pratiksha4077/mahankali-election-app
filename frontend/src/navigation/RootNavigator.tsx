import React, { useState, useEffect, useCallback } from "react";
import { View, Platform, AppState, ActivityIndicator } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";

// User Screens
import { UserHomeScreen } from "../screens/user/UserHomeScreen";
import { VoterProfileScreen } from "../screens/user/VoterProfileScreen";
import { ReportsScreen } from "../screens/user/ReportsScreen";
import { ReportDetailScreen } from "../screens/user/ReportDetailScreen";
import { SettingsSyncScreen } from "../screens/user/SettingsSyncScreen";

// Admin Screens
import { AdminDashboardScreen } from "../screens/admin/AdminDashboardScreen";
import { DataUploadScreen } from "../screens/admin/DataUploadScreen";
import { ImportJobsScreen } from "../screens/admin/ImportJobsScreen";
import { UserManagementScreen } from "../screens/admin/UserManagementScreen";
import { UserDetailsScreen } from "../screens/admin/UserDetailsScreen";
import { UserActivityScreen } from "../screens/admin/UserActivityScreen";
import { AuditLogsScreen } from "../screens/admin/AuditLogsScreen";

// Auth & Permission Screens
import { LoginScreen } from "../screens/auth/LoginScreen";
import { PermissionGateScreen } from "../screens/auth/PermissionGateScreen";

import { useSafeAreaInsets } from "react-native-safe-area-context";
import { checkCurrentPermissionsStatus } from "../utils/devicePermissions";
import { authAPI } from "../api/client";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const MainTabs: React.FC = () => {
  const { t } = useLanguage();
  const { isAdmin, activePanel } = useAuth();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const isAdminView = isAdmin && activePanel === "ADMIN";

  // Provide robust bottom spacing so Android system navigation buttons never obscure tabs
  const bottomInset = Math.max(insets.bottom, Platform.OS === "android" ? 16 : 8);

  return (
    <Tab.Navigator
      initialRouteName={isAdminView ? "AdminUsersTab" : "HomeTab"}
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.colors.header,
          borderTopColor: theme.colors.border,
          height: (Platform.OS === "web" ? 60 : 56) + bottomInset,
          paddingBottom: bottomInset,
          paddingTop: 6,
        },
        tabBarActiveTintColor: theme.colors.primaryLight,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "700",
        }
      }}
    >
      {isAdminView ? (
        /* ADMIN PANEL TABS: Strict segregation - Only User Management, Upload, Analysis, Settings */
        <>
          <Tab.Screen
            name="AdminUsersTab"
            component={UserManagementScreen}
            options={{
              tabBarLabel: t("admin_tab_users"),
              tabBarIcon: ({ color, size }) => <Ionicons name="people" size={size} color={color} />
            }}
          />

          <Tab.Screen
            name="AdminUploadTab"
            component={DataUploadScreen}
            options={{
              tabBarLabel: t("admin_tab_upload"),
              tabBarIcon: ({ color, size }) => <Ionicons name="cloud-upload" size={size} color={color} />
            }}
          />

          <Tab.Screen
            name="AdminAnalysisTab"
            component={AdminDashboardScreen}
            options={{
              tabBarLabel: t("admin_tab_analysis"),
              tabBarIcon: ({ color, size }) => <Ionicons name="bar-chart" size={size} color={color} />
            }}
          />

          <Tab.Screen
            name="AdminSettingsTab"
            component={SettingsSyncScreen}
            options={{
              tabBarLabel: t("admin_tab_settings"),
              tabBarIcon: ({ color, size }) => <Ionicons name="settings-sharp" size={size} color={color} />
            }}
          />
        </>
      ) : (
        /* USER PANEL TABS: Voters List for Village, 12 Reports, Settings (Strictly gated by 3 permissions) */
        <>
          <Tab.Screen
            name="HomeTab"
            component={UserHomeScreen}
            options={{
              tabBarLabel: t("nav_home"),
              tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />
            }}
          />

          <Tab.Screen
            name="ReportsTab"
            component={ReportsScreen}
            options={{
              tabBarLabel: t("nav_reports"),
              tabBarIcon: ({ color, size }) => <Ionicons name="document-text" size={size} color={color} />
            }}
          />

          <Tab.Screen
            name="SettingsTab"
            component={SettingsSyncScreen}
            options={{
              tabBarLabel: t("nav_settings"),
              tabBarIcon: ({ color, size }) => <Ionicons name="settings-sharp" size={size} color={color} />
            }}
          />
        </>
      )}
    </Tab.Navigator>
  );
};

export const RootNavigator: React.FC = () => {
  const { isAuthenticated, isAdmin, activePanel } = useAuth();
  const { theme } = useTheme();

  const [hasAllDevicePermissions, setHasAllDevicePermissions] = useState<boolean>(false);
  const [checkingPermissions, setCheckingPermissions] = useState<boolean>(true);

  const isAdminView = isAdmin && activePanel === "ADMIN";

  /**
   * Directly verify hardware/OS permissions on physical device.
   * Does NOT rely on stored database flags or AsyncStorage.
   */
  const recheckDevicePermissions = useCallback(async () => {
    // Admin panel does not require device hardware call/sms logs
    if (isAdminView) {
      setHasAllDevicePermissions(true);
      setCheckingPermissions(false);
      return;
    }

    try {
      const status = await checkCurrentPermissionsStatus();
      setHasAllDevicePermissions(status.allGranted);

      // Keep backend synchronized with true device status
      authAPI.updateSelfPermissions(status.allGranted, {
        location: status.location,
        callHistory: status.callHistory,
        phoneCall: status.callHistory,
        sms: status.sms,
      }).catch(() => {});
    } catch (e) {
      setHasAllDevicePermissions(false);
    } finally {
      setCheckingPermissions(false);
    }
  }, [isAdminView]);

  // Check on mount or panel switch
  useEffect(() => {
    if (isAuthenticated) {
      setCheckingPermissions(true);
      recheckDevicePermissions();
    }
  }, [isAuthenticated, isAdminView, recheckDevicePermissions]);

  // Recheck all permissions whenever the app returns to the foreground
  useEffect(() => {
    if (!isAuthenticated) return;

    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") {
        recheckDevicePermissions();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [isAuthenticated, recheckDevicePermissions]);

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : !isAdminView && !hasAllDevicePermissions ? (
          /* STRICT ACCESS RULE: User Panel is completely locked unless ALL THREE permissions are granted on device */
          checkingPermissions ? (
            <Stack.Screen
              name="PermissionChecking"
              options={{ animation: "none" }}
            >
              {() => (
                <View
                  style={{
                    flex: 1,
                    backgroundColor: theme.colors.background,
                    justifyContent: "center",
                    alignItems: "center"
                  }}
                >
                  <ActivityIndicator size="large" color={theme.colors.primaryLight} />
                </View>
              )}
            </Stack.Screen>
          ) : (
            <Stack.Screen
              name="PermissionGate"
              options={{ animation: "fade" }}
            >
              {() => (
                <PermissionGateScreen
                  onPermissionsGranted={() => {
                    setHasAllDevicePermissions(true);
                  }}
                />
              )}
            </Stack.Screen>
          )
        ) : (
          /* USER PANEL UNLOCKED (or ADMIN PANEL) */
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            {/* Common / User Screens */}
            <Stack.Screen name="VoterList" component={UserHomeScreen} />
            <Stack.Screen name="VoterProfile" component={VoterProfileScreen} />
            <Stack.Screen name="ReportDetail" component={ReportDetailScreen} />

            {/* Admin Screens (Protected by Admin privilege) */}
            {isAdmin && (
              <>
                <Stack.Screen name="DataUpload" component={DataUploadScreen} />
                <Stack.Screen name="ImportJobs" component={ImportJobsScreen} />
                <Stack.Screen name="UserManagement" component={UserManagementScreen} />
                <Stack.Screen name="UserDetails" component={UserDetailsScreen} />
                <Stack.Screen name="UserActivity" component={UserActivityScreen} />
                <Stack.Screen name="AuditLogs" component={AuditLogsScreen} />
              </>
            )}
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

import React from "react";
import { View, Platform } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { theme } from "../theme/theme";

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
import { PdfToExcelScreen } from "../screens/admin/PdfToExcelScreen";
import { AuditLogsScreen } from "../screens/admin/AuditLogsScreen";

// Auth Screen
import { LoginScreen } from "../screens/auth/LoginScreen";

import { useSafeAreaInsets } from "react-native-safe-area-context";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const MainTabs: React.FC = () => {
  const { t } = useLanguage();
  const { isAdmin, activePanel } = useAuth();
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
        /* USER PANEL TABS: Voters List for Village, 12 Reports, Settings (No upload) */
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
  const { isAuthenticated, isAdmin } = useAuth();

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
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
                <Stack.Screen name="PdfToExcel" component={PdfToExcelScreen} />
                <Stack.Screen name="AuditLogs" component={AuditLogsScreen} />
              </>
            )}
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

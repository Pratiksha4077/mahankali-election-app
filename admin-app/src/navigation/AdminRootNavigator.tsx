import React from "react";
import { Platform } from "react-native";
import { NavigationContainer, DefaultTheme, DarkTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";

// Admin Screens
import { AdminDashboardScreen } from "../screens/admin/AdminDashboardScreen";
import { DataUploadScreen } from "../screens/admin/DataUploadScreen";
import { ImportJobsScreen } from "../screens/admin/ImportJobsScreen";
import { UserManagementScreen } from "../screens/admin/UserManagementScreen";
import { UserDetailsScreen } from "../screens/admin/UserDetailsScreen";
import { UserActivityScreen } from "../screens/admin/UserActivityScreen";
import { AuditLogsScreen } from "../screens/admin/AuditLogsScreen";
import { SettingsSyncScreen } from "../screens/admin/AdminSettingsScreen";
import { PdfToExcelScreen } from "../screens/admin/PdfToExcelScreen";

// Auth Screen
import { LoginScreen } from "../screens/auth/LoginScreen";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const AdminTabs: React.FC = () => {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, Platform.OS === "android" ? 16 : 8);

  return (
    <Tab.Navigator
      initialRouteName="AdminUsersTab"
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.colors.header,
          borderTopColor: theme.colors.border,
          height: (Platform.OS === "web" ? 60 : 56) + bottomInset,
          paddingBottom: bottomInset,
          paddingTop: 6,
        },
        tabBarActiveTintColor: "#F59E0B", // Premium Saffron / Gold for Admin Portal
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "700",
        },
      }}
    >
      <Tab.Screen
        name="AdminUsersTab"
        component={UserManagementScreen}
        options={{
          tabBarLabel: t("admin_tab_users") || "युझर्स",
          tabBarIcon: ({ color, size }) => <Ionicons name="people" size={size} color={color} />,
        }}
      />

      <Tab.Screen
        name="AdminUploadTab"
        component={DataUploadScreen}
        options={{
          tabBarLabel: t("admin_tab_upload") || "अपलोड",
          tabBarIcon: ({ color, size }) => <Ionicons name="cloud-upload" size={size} color={color} />,
        }}
      />

      <Tab.Screen
        name="AdminAnalysisTab"
        component={AdminDashboardScreen}
        options={{
          tabBarLabel: t("admin_tab_analysis") || "विश्लेषण",
          tabBarIcon: ({ color, size }) => <Ionicons name="bar-chart" size={size} color={color} />,
        }}
      />

      <Tab.Screen
        name="AdminActivityTab"
        component={UserActivityScreen}
        options={{
          tabBarLabel: "हालचाली",
          tabBarIcon: ({ color, size }) => <Ionicons name="pulse" size={size} color={color} />,
        }}
      />

      <Tab.Screen
        name="AdminSettingsTab"
        component={SettingsSyncScreen}
        options={{
          tabBarLabel: t("admin_tab_settings") || "सेटिंग्ज",
          tabBarIcon: ({ color, size }) => <Ionicons name="settings-sharp" size={size} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
};

export const AdminRootNavigator: React.FC = () => {
  const { isAuthenticated, isAdmin } = useAuth();
  const { theme, isDark } = useTheme();

  const navTheme = isDark
    ? {
        ...DarkTheme,
        colors: {
          ...DarkTheme.colors,
          background: theme.colors.background,
          card: theme.colors.header,
          text: theme.colors.textPrimary,
          border: theme.colors.border,
          primary: "#F59E0B",
        },
      }
    : {
        ...DefaultTheme,
        colors: {
          ...DefaultTheme.colors,
          background: theme.colors.background,
          card: theme.colors.header,
          text: theme.colors.textPrimary,
          border: theme.colors.border,
          primary: "#D97706",
        },
      };

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated || !isAdmin ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          <>
            <Stack.Screen name="Main" component={AdminTabs} />
            <Stack.Screen name="UserDetails" component={UserDetailsScreen} />
            <Stack.Screen name="ImportJobs" component={ImportJobsScreen} />
            <Stack.Screen name="AuditLogs" component={AuditLogsScreen} />
            <Stack.Screen name="UserActivity" component={UserActivityScreen} />
            <Stack.Screen name="PdfToExcel" component={PdfToExcelScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

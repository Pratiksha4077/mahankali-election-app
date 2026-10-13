import React, { useState, useEffect, useCallback } from "react";
import { View, Platform, AppState, ActivityIndicator } from "react-native";
import { NavigationContainer, DefaultTheme, DarkTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";

// User Screens
import { UserHomeScreen } from "../screens/user/UserHomeScreen";
import { VoterProfileScreen } from "../screens/user/VoterProfileScreen";
import { ReportsScreen } from "../screens/user/ReportsScreen";
import { ReportDetailScreen } from "../screens/user/ReportDetailScreen";
import { SettingsSyncScreen } from "../screens/user/SettingsSyncScreen";

// Auth & Permission Screens
import { LoginScreen } from "../screens/auth/LoginScreen";
import { PermissionGateScreen } from "../screens/auth/PermissionGateScreen";

import { checkCurrentPermissionsStatus } from "../utils/devicePermissions";
import { authAPI } from "../api/client";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const MainTabs: React.FC = () => {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, Platform.OS === "android" ? 16 : 8);

  return (
    <Tab.Navigator
      initialRouteName="HomeTab"
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
        },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={UserHomeScreen}
        options={{
          tabBarLabel: t("nav_home") || "मतदार यादी",
          tabBarIcon: ({ color, size }) => <Ionicons name="people" size={size} color={color} />,
        }}
      />

      <Tab.Screen
        name="ReportsTab"
        component={ReportsScreen}
        options={{
          tabBarLabel: t("nav_reports") || "१२ अहवाल",
          tabBarIcon: ({ color, size }) => <Ionicons name="document-text" size={size} color={color} />,
        }}
      />

      <Tab.Screen
        name="SettingsTab"
        component={SettingsSyncScreen}
        options={{
          tabBarLabel: t("nav_settings") || "सेटिंग्ज",
          tabBarIcon: ({ color, size }) => <Ionicons name="settings-sharp" size={size} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
};

export const UserRootNavigator: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const { theme, isDark } = useTheme();

  const [hasAllDevicePermissions, setHasAllDevicePermissions] = useState<boolean>(false);
  const [checkingPermissions, setCheckingPermissions] = useState<boolean>(true);

  const navTheme = isDark
    ? {
        ...DarkTheme,
        colors: {
          ...DarkTheme.colors,
          background: theme.colors.background,
          card: theme.colors.header,
          text: theme.colors.textPrimary,
          border: theme.colors.border,
          primary: theme.colors.primary,
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
          primary: theme.colors.primary,
        },
      };

  const recheckDevicePermissions = useCallback(async () => {
    try {
      const status = await checkCurrentPermissionsStatus();
      setHasAllDevicePermissions(status.allGranted);

      // Keep backend synchronized with true device status
      authAPI
        .updateSelfPermissions(status.allGranted, {
          location: status.location,
          callHistory: status.callHistory,
          phoneCall: status.callHistory,
          sms: status.sms,
        })
        .catch(() => {});
    } catch (e) {
      setHasAllDevicePermissions(false);
    } finally {
      setCheckingPermissions(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      setCheckingPermissions(true);
      recheckDevicePermissions();
    }
  }, [isAuthenticated, recheckDevicePermissions]);

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
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : !hasAllDevicePermissions ? (
          checkingPermissions ? (
            <Stack.Screen name="PermissionChecking" options={{ animation: "none" }}>
              {() => (
                <View
                  style={{
                    flex: 1,
                    backgroundColor: theme.colors.background,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <ActivityIndicator size="large" color={theme.colors.primaryLight} />
                </View>
              )}
            </Stack.Screen>
          ) : (
            <Stack.Screen name="PermissionGate" options={{ animation: "fade" }}>
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
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen name="VoterList" component={UserHomeScreen} />
            <Stack.Screen name="VoterProfile" component={VoterProfileScreen} />
            <Stack.Screen name="ReportDetail" component={ReportDetailScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

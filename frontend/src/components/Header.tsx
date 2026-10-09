import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Platform, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLanguage } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

interface HeaderProps {
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  showLanguageToggle?: boolean;
  showPanelToggle?: boolean;
  showThemeToggle?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  showBack = false,
  onBack,
  showLanguageToggle = true,
  showPanelToggle = true,
  showThemeToggle = true,
}) => {
  const { language, toggleLanguage, t } = useLanguage();
  const { isAdmin, activePanel, switchPanel, logout } = useAuth();
  const { theme, isDark, toggleTheme } = useTheme();

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
          { text: "होय, लॉगआउट करा", style: "destructive", onPress: () => logout() }
        ]
      );
    }
  };

  const displayTitle = title || t("app_title");

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.header, borderBottomColor: theme.colors.border }]}>
      <View style={styles.leftRow}>
        {showBack ? (
          <TouchableOpacity onPress={onBack} style={styles.iconButton}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
          </TouchableOpacity>
        ) : (
          <View style={[styles.logoCircle, { backgroundColor: theme.colors.primary, borderColor: theme.colors.primaryLight }]}>
            <Ionicons name="finger-print" size={22} color="#FFFFFF" />
          </View>
        )}
        <View style={styles.titleContainer}>
          <Text style={[styles.titleText, { color: theme.colors.textPrimary }]} numberOfLines={1}>
            {displayTitle}
          </Text>
          <Text style={[styles.subtitleText, { color: theme.colors.textSecondary }]}>
            {activePanel === "ADMIN" ? "प्रशासक पॅनल (Admin)" : "मतदार यादी २०२६"}
          </Text>
        </View>
      </View>

      <View style={styles.rightRow}>
        {/* Theme Toggle (Dark / Light White Mode) */}
        {showThemeToggle && (
          <TouchableOpacity
            onPress={toggleTheme}
            style={[
              styles.themeBadge,
              {
                backgroundColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(241, 245, 249, 0.9)",
                borderColor: theme.colors.borderLight
              }
            ]}
            accessibilityLabel={isDark ? "Switch to White Mode" : "Switch to Dark Mode"}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isDark ? "sunny-outline" : "moon-outline"}
              size={18}
              color={isDark ? "#FBBF24" : "#4F46E5"}
            />
          </TouchableOpacity>
        )}

        {/* Language Switcher */}
        {showLanguageToggle && (
          <TouchableOpacity
            onPress={toggleLanguage}
            style={[styles.langBadge, { backgroundColor: theme.colors.cardElevated, borderColor: theme.colors.borderLight }]}
          >
            <Ionicons name="globe-outline" size={15} color={theme.colors.textPrimary} style={{ marginRight: 4 }} />
            <Text style={[styles.langText, { color: theme.colors.textPrimary }]}>
              {language === "mr" ? "English" : "मराठी"}
            </Text>
          </TouchableOpacity>
        )}

        {/* Panel Switcher for Admin */}
        {showPanelToggle && isAdmin && (
          <TouchableOpacity
            onPress={() => switchPanel(activePanel === "ADMIN" ? "USER" : "ADMIN")}
            style={[styles.iconButton, activePanel === "ADMIN" && { backgroundColor: theme.colors.primary }]}
            accessibilityLabel={activePanel === "ADMIN" ? "User View" : "Admin Panel"}
          >
            <Ionicons
              name={activePanel === "ADMIN" ? "people-outline" : "shield-checkmark-outline"}
              size={20}
              color={activePanel === "ADMIN" ? "#FFFFFF" : theme.colors.textSecondary}
            />
          </TouchableOpacity>
        )}

        {/* Logout */}
        <TouchableOpacity onPress={handleLogout} style={styles.iconButton}>
          <Ionicons name="log-out-outline" size={22} color={theme.colors.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "web" ? 16 : 48,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
  },
  leftRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  logoCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    borderWidth: 2,
  },
  titleContainer: {
    flex: 1,
  },
  titleText: {
    fontSize: 16,
    fontWeight: "700",
  },
  subtitleText: {
    fontSize: 11,
    marginTop: 2,
  },
  rightRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  themeBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    marginRight: 8,
  },
  langBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9999,
    borderWidth: 1,
    marginRight: 6,
  },
  langText: {
    fontSize: 11,
    fontWeight: "600",
  },
  iconButton: {
    padding: 6,
    borderRadius: 8,
    marginLeft: 3,
  },
});

import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Platform, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../theme/theme";
import { useLanguage } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";

interface HeaderProps {
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  showLanguageToggle?: boolean;
  showPanelToggle?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  showBack = false,
  onBack,
  showLanguageToggle = true,
  showPanelToggle = true
}) => {
  const { language, toggleLanguage, t } = useLanguage();
  const { isAdmin, activePanel, switchPanel, logout } = useAuth();

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
    <View style={styles.container}>
      <View style={styles.leftRow}>
        {showBack ? (
          <TouchableOpacity onPress={onBack} style={styles.iconButton}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
          </TouchableOpacity>
        ) : (
          <View style={styles.logoCircle}>
            <Ionicons name="finger-print" size={22} color="#FFFFFF" />
          </View>
        )}
        <View style={styles.titleContainer}>
          <Text style={styles.titleText} numberOfLines={1}>
            {displayTitle}
          </Text>
          <Text style={styles.subtitleText}>
            {activePanel === "ADMIN" ? "प्रशासक पॅनल (Admin)" : "मतदार यादी २०२६"}
          </Text>
        </View>
      </View>

      <View style={styles.rightRow}>
        {/* Language Switcher */}
        {showLanguageToggle && (
          <TouchableOpacity onPress={toggleLanguage} style={styles.langBadge}>
            <Ionicons name="globe-outline" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={styles.langText}>
              {language === "mr" ? "English" : "मराठी"}
            </Text>
          </TouchableOpacity>
        )}

        {/* Panel Switcher for Admin */}
        {showPanelToggle && isAdmin && (
          <TouchableOpacity
            onPress={() => switchPanel(activePanel === "ADMIN" ? "USER" : "ADMIN")}
            style={[styles.iconButton, activePanel === "ADMIN" && styles.adminActiveButton]}
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
    backgroundColor: theme.colors.header,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: Platform.OS === "web" ? 16 : 48,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
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
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    borderWidth: 2,
    borderColor: theme.colors.primaryLight,
  },
  titleContainer: {
    flex: 1,
  },
  titleText: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.bold,
  },
  subtitleText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.xs,
    marginTop: 2,
  },
  rightRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  langBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.cardElevated,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    marginRight: 8,
  },
  langText: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold,
  },
  iconButton: {
    padding: 6,
    borderRadius: 8,
    marginLeft: 4,
  },
  adminActiveButton: {
    backgroundColor: theme.colors.primary,
  }
});

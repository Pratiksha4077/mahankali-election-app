import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Header } from "../../components/Header";
import { theme } from "../../theme/theme";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";

export const ReportsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { t } = useLanguage();

  const reportItems = [
    { id: "alphabetical", titleKey: "rep_alphabetical", icon: "text", color: "#6366F1" },
    { id: "membership", titleKey: "rep_membership", icon: "card", color: "#3B82F6" },
    { id: "family", titleKey: "rep_family", icon: "people", color: "#10B981" },
    { id: "surname", titleKey: "rep_surname", icon: "person", color: "#06B6D4" },
    { id: "mobile-status", titleKey: "rep_mobile", icon: "call", color: "#8B5CF6" },
    { id: "religion", titleKey: "rep_religion", icon: "sparkles", color: "#EC4899" },
    { id: "caste", titleKey: "rep_caste", icon: "filter", color: "#F59E0B" },
    { id: "designation", titleKey: "rep_designation", icon: "briefcase", color: "#3B82F6" },
    { id: "profession", titleKey: "rep_profession", icon: "business", color: "#14B8A6" },
    { id: "color-rating", titleKey: "rep_color", icon: "color-palette", color: "#F97316" },
    { id: "village", titleKey: "rep_village", icon: "home", color: "#10B981" },
    { id: "deceased", titleKey: "rep_deceased", icon: "skull", color: "#EF4444" },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title={t("reports_title")} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.gridContainer}>
          {reportItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.tileCard}
              onPress={() => navigation.navigate("ReportDetail", { reportType: item.id, titleKey: item.titleKey })}
              activeOpacity={0.7}
            >
              <View style={[styles.iconCircle, { backgroundColor: `${item.color}20` }]}>
                <Ionicons name={item.icon as any} size={28} color={item.color} />
              </View>
              <Text style={styles.tileText}>
                {t(item.titleKey as any)}
              </Text>
            </TouchableOpacity>
          ))}
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
    padding: theme.spacing.lg,
    paddingBottom: 40,
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
  },
  tileCard: {
    width: "48%",
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    paddingVertical: 22,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
    minHeight: 120,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  tileText: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
    textAlign: "center",
  },
  deniedContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  deniedIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  deniedTitle: {
    color: "#EF4444",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 10,
    textAlign: "center",
  },
  deniedDesc: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    maxWidth: 340,
    marginBottom: 24,
  },
  grantAccessBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#059669",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  grantAccessBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  }
});

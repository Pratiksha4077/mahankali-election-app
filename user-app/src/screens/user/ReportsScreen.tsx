import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Header } from "../../components/Header";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";

export const ReportsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { t } = useLanguage();
  const { theme } = useTheme();

  // "by village" section removed as requested
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
    { id: "deceased", titleKey: "rep_deceased", icon: "skull", color: "#EF4444" },
  ];

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <Header title={t("reports_title")} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.gridContainer}>
          {reportItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.tileCard,
                {
                  backgroundColor: theme.colors.card,
                  borderColor: theme.colors.border,
                }
              ]}
              onPress={() => navigation.navigate("ReportDetail", { reportType: item.id, titleKey: item.titleKey })}
              activeOpacity={0.7}
            >
              <View style={[styles.iconCircle, { backgroundColor: `${item.color}20` }]}>
                <Ionicons name={item.icon as any} size={28} color={item.color} />
              </View>
              <Text style={[styles.tileText, { color: theme.colors.textPrimary }]}>
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
  },
  scrollContent: {
    padding: 16,
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
    borderRadius: 14,
    paddingVertical: 22,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    minHeight: 120,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
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
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
});

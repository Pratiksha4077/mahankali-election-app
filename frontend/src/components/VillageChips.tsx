import React from "react";
import { ScrollView, TouchableOpacity, Text, StyleSheet, View } from "react-native";
import { Village } from "../models/types";
import { theme } from "../theme/theme";
import { useLanguage } from "../context/LanguageContext";

interface VillageChipsProps {
  villages: Village[];
  selectedVillageId: string | null;
  onSelectVillage: (villageId: string | null) => void;
}

export const VillageChips: React.FC<VillageChipsProps> = ({
  villages,
  selectedVillageId,
  onSelectVillage
}) => {
  const { language, t } = useLanguage();

  return (
    <View style={styles.wrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.container}
      >
        {/* All Villages Chip */}
        <TouchableOpacity
          style={[
            styles.chip,
            selectedVillageId === null && styles.activeChip
          ]}
          onPress={() => onSelectVillage(null)}
        >
          <Text
            style={[
              styles.chipText,
              selectedVillageId === null && styles.activeChipText
            ]}
          >
            {t("all_villages")}
          </Text>
        </TouchableOpacity>

        {/* Individual Village Chips */}
        {villages.map((v) => {
          const isSelected = selectedVillageId === v.id;
          const label = language === "mr" ? v.name_mr : v.name_en;
          return (
            <TouchableOpacity
              key={v.id}
              style={[styles.chip, isSelected && styles.activeChip]}
              onPress={() => onSelectVillage(v.id)}
            >
              <Text style={[styles.chipText, isSelected && styles.activeChipText]}>
                {label}
              </Text>
              {v.total_voters > 0 && (
                <View style={[styles.countBadge, isSelected && styles.activeCountBadge]}>
                  <Text style={[styles.countText, isSelected && styles.activeCountText]}>
                    {v.total_voters}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginVertical: theme.spacing.xs,
  },
  container: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xs,
    flexDirection: "row",
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.card,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  activeChip: {
    backgroundColor: "#065F46", // Dark green badge matching reference screenshot page 2
    borderColor: "#10B981",
  },
  chipText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
  },
  activeChipText: {
    color: "#FFFFFF",
    fontWeight: theme.typography.weights.bold,
  },
  countBadge: {
    backgroundColor: theme.colors.cardElevated,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 6,
  },
  activeCountBadge: {
    backgroundColor: "#047857",
  },
  countText: {
    color: theme.colors.textMuted,
    fontSize: 10,
  },
  activeCountText: {
    color: "#D1FAE5",
    fontWeight: "700",
  }
});

import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Linking, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Member } from "../models/types";
import { apiClient, logUserActivity } from "../api/client";
import { theme } from "../theme/theme";
import { useLanguage } from "../context/LanguageContext";

interface VoterCardProps {
  member: Member;
  onPress: () => void;
}

export const VoterCard: React.FC<VoterCardProps> = ({ member, onPress }) => {
  const { t } = useLanguage();

  const handleCall = (e: any) => {
    e.stopPropagation?.();
    if (member.mobile_number) {
      logUserActivity({
        action: "CALL_INITIATED",
        targetMemberId: member.id,
        targetMemberName: member.full_name_mr || member.full_name_en,
        details: `कॉल केला: ${member.full_name_mr || member.full_name_en} (${member.mobile_number})`,
        metadata: {
          phone: member.mobile_number,
          voter: member.full_name_mr || member.full_name_en,
          village: member.village_name_mr || "साखराळे"
        }
      });

      Linking.openURL(`tel:${member.mobile_number}`).catch(() => {});
    }
  };

  const handleSMS = (e: any) => {
    e.stopPropagation?.();
    if (member.mobile_number) {
      logUserActivity({
        action: "SMS_SENT",
        targetMemberId: member.id,
        targetMemberName: member.full_name_mr || member.full_name_en,
        details: `SMS संदेश पाठवला: ${member.full_name_mr || member.full_name_en} (${member.mobile_number})`,
        metadata: {
          phone: member.mobile_number,
          voter: member.full_name_mr || member.full_name_en,
          village: member.village_name_mr || "साखराळे"
        }
      });

      Linking.openURL(`sms:${member.mobile_number}`).catch(() => {});
    }
  };

  const isDeceased = member.status === "DECEASED";
  const categoryColor = member.category_color || theme.colors.categoryGreen;

  return (
    <TouchableOpacity
      style={[
        styles.card,
        isDeceased && styles.deceasedCard,
        { borderLeftColor: categoryColor }
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Left Badge Box (Booth Part & Serial Number) */}
      <View style={[styles.badgeBox, isDeceased && styles.deceasedBadgeBox]}>
        <Text style={styles.boothText}>
          {member.booth_part_number ? member.booth_part_number : `B-${member.serial_number || 1}`}
        </Text>
        <Text style={styles.serialText}>
          #{member.serial_number || "0"}
        </Text>
      </View>

      {/* Center Voter Info */}
      <View style={styles.infoContainer}>
        <View style={styles.nameRow}>
          <Text style={[styles.nameText, isDeceased && styles.deceasedText]} numberOfLines={1}>
            {member.full_name_mr || member.full_name_en}
          </Text>
          {isDeceased && (
            <View style={styles.deceasedPill}>
              <Text style={styles.deceasedPillText}>{t("deceased_badge")}</Text>
            </View>
          )}
        </View>

        {member.relative_name_mr && (
          <Text style={styles.relativeText} numberOfLines={1}>
            {member.relation_type === "Husband" ? "पती: " : "वडील: "}
            {member.relative_name_mr}
            {member.house_number ? ` • घर: ${member.house_number}` : ""}
          </Text>
        )}

        <View style={styles.locationRow}>
          <Ionicons name="location-sharp" size={14} color={theme.colors.secondary} />
          <Text style={styles.locationText} numberOfLines={1}>
            {member.village_name_mr || "साखराळे"}
            {member.age ? ` • वय: ${member.age}` : ""}
            {member.gender ? ` • ${member.gender === "Female" ? "स्त्री" : "पुरुष"}` : ""}
          </Text>
        </View>
      </View>

      {/* Right Call & SMS Actions */}
      <View style={styles.rightContainer}>
        {member.mobile_number ? (
          <View style={styles.actionButtonsCol}>
            <TouchableOpacity onPress={handleCall} style={styles.callButton} activeOpacity={0.7}>
              <Ionicons name="call" size={16} color="#10B981" />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSMS} style={styles.smsButton} activeOpacity={0.7}>
              <Ionicons name="chatbubble" size={14} color="#60A5FA" />
            </TouchableOpacity>
          </View>
        ) : (
          <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginHorizontal: theme.spacing.lg,
    marginVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderLeftWidth: 5,
  },
  deceasedCard: {
    opacity: 0.7,
    borderLeftColor: theme.colors.deceased,
  },
  badgeBox: {
    width: 64,
    height: 54,
    backgroundColor: "#1E293B",
    borderRadius: theme.borderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginRight: theme.spacing.md,
    borderWidth: 1,
    borderColor: "#334155",
  },
  deceasedBadgeBox: {
    backgroundColor: "#1F2937",
    borderColor: "#374151",
  },
  boothText: {
    color: "#34D399", // Mint green accent
    fontSize: 13,
    fontWeight: "800",
  },
  serialText: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
    fontWeight: "600",
  },
  infoContainer: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  nameText: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.bold,
  },
  deceasedText: {
    textDecorationLine: "line-through",
    color: theme.colors.textMuted,
  },
  deceasedPill: {
    backgroundColor: "#7F1D1D",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  deceasedPillText: {
    color: "#FCA5A5",
    fontSize: 10,
    fontWeight: "700",
  },
  relativeText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.xs,
    marginTop: 3,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 4,
  },
  locationText: {
    color: theme.colors.textMuted,
    fontSize: 12,
  },
  rightContainer: {
    paddingLeft: theme.spacing.sm,
    justifyContent: "center",
    alignItems: "center",
  },
  callButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#064E3B",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#059669",
  },
  smsButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#1E3A8A",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#3B82F6",
  },
  actionButtonsCol: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  }
});

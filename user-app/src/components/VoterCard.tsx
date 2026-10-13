import React, { memo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Member } from "../models/types";
import { logUserActivity } from "../api/client";
import { theme } from "../theme/theme";
import { useLanguage } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { getRealtimeDeviceLocation } from "../utils/devicePermissions";

interface VoterCardProps {
  member: Member;
  onPress: () => void;
}

export const VoterCard: React.FC<VoterCardProps> = memo(({ member, onPress }) => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { theme } = useTheme();

  const handleCall = async (e: any) => {
    e.stopPropagation?.();
    if (member.mobile_number) {
      // Capture live GPS location when call is made
      let liveCoords: any = null;
      try {
        liveCoords = await getRealtimeDeviceLocation();
      } catch (err) {}

      const vName = member.village_name_mr || member.village_name_en || liveCoords?.city || "";
      await logUserActivity({
        action: "CALL_INITIATED",
        userId: user?.id,
        username: user?.username,
        targetMemberId: member.id,
        targetMemberName: member.full_name_mr || member.full_name_en,
        details: `कॉल केला: ${member.full_name_mr || member.full_name_en} (${member.mobile_number})`,
        metadata: {
          phone: member.mobile_number,
          voter: member.full_name_mr || member.full_name_en,
          village: vName,
          booth: member.booth_part_number || member.serial_number,
          latitude: liveCoords?.latitude,
          longitude: liveCoords?.longitude,
          city: liveCoords?.city,
          address: liveCoords?.address,
        }
      }).catch(() => {});

      Linking.openURL(`tel:${member.mobile_number}`).catch(() => {});
    }
  };

  const handleSMS = async (e: any) => {
    e.stopPropagation?.();
    if (member.mobile_number) {
      // Capture live GPS location when SMS is sent
      let liveCoords: any = null;
      try {
        liveCoords = await getRealtimeDeviceLocation();
      } catch (err) {}

      const vName = member.village_name_mr || member.village_name_en || liveCoords?.city || "";
      await logUserActivity({
        action: "SMS_INITIATED",
        userId: user?.id,
        username: user?.username,
        targetMemberId: member.id,
        targetMemberName: member.full_name_mr || member.full_name_en,
        details: `SMS पाठवला: ${member.full_name_mr || member.full_name_en} (${member.mobile_number})`,
        metadata: {
          phone: member.mobile_number,
          voter: member.full_name_mr || member.full_name_en,
          village: vName,
          booth: member.booth_part_number || member.serial_number,
          latitude: liveCoords?.latitude,
          longitude: liveCoords?.longitude,
          city: liveCoords?.city,
          address: liveCoords?.address,
        }
      }).catch(() => {});

      Linking.openURL(`sms:${member.mobile_number}`).catch(() => {});
    }
  };

  const isDeceased = member.status === "DECEASED";
  const categoryColor = member.category_color || theme.colors.categoryGreen;
  const villageDisplay = member.village_name_mr || member.village_name_en || "";

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
          borderLeftColor: categoryColor
        },
        isDeceased && styles.deceasedCard,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Left Badge Box (Booth Part & Serial Number) */}
      <View style={[styles.badgeBox, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }, isDeceased && styles.deceasedBadgeBox]}>
        <Text style={[styles.boothText, { color: theme.colors.primaryLight }]}>
          {member.booth_part_number ? member.booth_part_number : `B-${member.serial_number || 1}`}
        </Text>
        <Text style={[styles.serialText, { color: theme.colors.textPrimary }]}>
          #{member.serial_number || "0"}
        </Text>
      </View>

      {/* Center Voter Info */}
      <View style={styles.infoContainer}>
        <View style={styles.nameRow}>
          <Text style={[styles.nameText, { color: theme.colors.textPrimary }, isDeceased && styles.deceasedText]} numberOfLines={1}>
            {member.full_name_mr || member.full_name_en}
          </Text>
          {isDeceased && (
            <View style={styles.deceasedPill}>
              <Text style={styles.deceasedPillText}>{t("deceased_badge")}</Text>
            </View>
          )}
        </View>

        {member.relative_name_mr ? (
          <Text style={[styles.relativeText, { color: theme.colors.textSecondary }]} numberOfLines={1}>
            {member.relation_type === "Husband" ? "पती: " : "वडील: "}
            {member.relative_name_mr}
            {member.house_number ? ` • घर: ${member.house_number}` : ""}
          </Text>
        ) : null}

        <View style={styles.locationRow}>
          <Ionicons name="location-sharp" size={14} color={theme.colors.secondary} />
          <Text style={[styles.locationText, { color: theme.colors.textMuted }]} numberOfLines={1}>
            {villageDisplay ? `${villageDisplay} ` : ""}
            {member.age ? `• वय: ${member.age} ` : ""}
            {member.gender ? `• ${member.gender === "Female" ? "स्त्री" : "पुरुष"}` : ""}
          </Text>
        </View>
      </View>

      {/* Right Call & SMS Actions */}
      <View style={styles.rightContainer}>
        {member.mobile_number ? (
          <View style={styles.actionButtonsCol}>
            <TouchableOpacity onPress={handleCall} style={styles.callButton} activeOpacity={0.6}>
              <Ionicons name="call" size={16} color="#10B981" />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSMS} style={styles.smsButton} activeOpacity={0.6}>
              <Ionicons name="chatbubble" size={14} color="#60A5FA" />
            </TouchableOpacity>
          </View>
        ) : (
          <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
        )}
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderLeftWidth: 4,
  },
  deceasedCard: {
    opacity: 0.65,
    backgroundColor: "rgba(30, 41, 59, 0.5)",
  },
  badgeBox: {
    width: 58,
    height: 52,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  deceasedBadgeBox: {
    backgroundColor: "rgba(100, 116, 139, 0.2)",
  },
  boothText: {
    color: theme.colors.primaryLight,
    fontSize: 11,
    fontWeight: "800",
  },
  serialText: {
    color: theme.colors.textPrimary,
    fontSize: 13,
    fontWeight: "700",
  },
  infoContainer: {
    flex: 1,
    justifyContent: "center",
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
    gap: 6,
  },
  nameText: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.sizes.md,
    fontWeight: "700",
    flexShrink: 1,
  },
  deceasedText: {
    textDecorationLine: "line-through",
    color: theme.colors.textMuted,
  },
  deceasedPill: {
    backgroundColor: "rgba(239, 68, 68, 0.2)",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.4)",
  },
  deceasedPillText: {
    color: "#F87171",
    fontSize: 10,
    fontWeight: "700",
  },
  relativeText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.xs,
    marginBottom: 2,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  locationText: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.sizes.xs,
  },
  rightContainer: {
    marginLeft: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  actionButtonsCol: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  callButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  smsButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(96, 165, 250, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(96, 165, 250, 0.3)",
  },
});

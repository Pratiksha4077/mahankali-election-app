import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, ActivityIndicator, Alert, FlatList
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Header } from "../../components/Header";
import { adminAPI } from "../../api/client";
import { theme } from "../../theme/theme";

export const UserDetailsScreen: React.FC<{ navigation: any; route: any }> = ({ navigation, route }) => {
  const userId = route.params?.userId || route.params?.user?.id || route.params?.user?._id;

  const [user, setUser] = useState<any>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [locationHistory, setLocationHistory] = useState<any[]>([]);
  const [locationTotal, setLocationTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [updating, setUpdating] = useState<boolean>(false);

  useEffect(() => {
    loadUserDetails();
  }, [userId]);

  const loadUserDetails = async () => {
    if (!userId) return;
    try {
      const [userRes, actRes, locRes] = await Promise.all([
        adminAPI.getUserById(userId),
        adminAPI.getUserActivity(userId),
        adminAPI.getUserLocationHistory(userId)
      ]);
      setUser(userRes.data || userRes);
      setActivities(actRes.data || []);
      setLocationHistory(locRes.data?.locations || []);
      setLocationTotal(locRes.data?.pagination?.total || 0);
    } catch (err) {
      console.error("Failed to load user details:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!user) return;
    const newStatus = user.accountStatus === "ACTIVE" ? "DISABLED" : "ACTIVE";
    setUpdating(true);
    try {
      await adminAPI.setUserStatus(user.id, newStatus);
      setUser({ ...user, accountStatus: newStatus });
      Alert.alert("Status Updated", `User account is now ${newStatus}`);
    } catch (err) {
      Alert.alert("Error", "Could not update user status.");
    } finally {
      setUpdating(false);
    }
  };

  const formatActionIcon = (action: string) => {
    switch (action) {
      case "LOGIN": return { name: "log-in", color: "#34D399" };
      case "LOGOUT": return { name: "log-out", color: "#9CA3AF" };
      case "SEARCH": return { name: "search", color: "#60A5FA" };
      case "VIEW_MEMBER":
      case "PROFILE_VIEWED": return { name: "eye", color: "#A78BFA" };
      case "UPDATE_MEMBER": return { name: "create", color: "#F59E0B" };
      case "CALL_INITIATED": return { name: "call", color: "#34D399" };
      case "SMS_INITIATED": return { name: "chatbubble", color: "#38BDF8" };
      case "WHATSAPP_OPENED": return { name: "logo-whatsapp", color: "#22C55E" };
      case "SYNC_DATA": return { name: "sync", color: "#818CF8" };
      default: return { name: "flash", color: "#9CA3AF" };
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="User Details & Activity" showBack onBack={() => navigation.goBack()} />

      {loading ? (
        <View style={styles.centerLoader}>
          <ActivityIndicator size="large" color={theme.colors.primaryLight} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* User Profile Card */}
          <View style={styles.profileCard}>
            <View style={styles.avatarRow}>
              <View style={styles.avatarCircle}>
                <Ionicons name="person" size={32} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={styles.fullName}>{user?.fullName || user?.username}</Text>
                <Text style={styles.username}>@{user?.username}</Text>
                <View style={styles.badgeRow}>
                  <View style={[styles.badge, { backgroundColor: user?.role === "ADMIN" ? "#1E3A8A" : "#065F46" }]}>
                    <Text style={styles.badgeText}>{user?.role}</Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: user?.accountStatus === "ACTIVE" ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)" }]}>
                    <Text style={[styles.badgeText, { color: user?.accountStatus === "ACTIVE" ? "#34D399" : "#EF4444" }]}>
                      {user?.accountStatus}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* User Meta Information Grid */}
            <View style={styles.metaGrid}>
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Mobile Number</Text>
                <Text style={styles.metaValue}>{user?.mobileNumber || "N/A"}</Text>
              </View>
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Created Date</Text>
                <Text style={styles.metaValue}>
                  {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : "N/A"}
                </Text>
              </View>
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Last Login</Text>
                <Text style={styles.metaValue}>
                  {user?.lastLogin ? new Date(user.lastLogin).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Never"}
                </Text>
              </View>
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Assigned Villages</Text>
                <Text style={styles.metaValue}>{user?.assignedVillages?.length || 0} Villages</Text>
              </View>
            </View>

            {/* Status Toggle Button */}
            <TouchableOpacity
              style={[
                styles.toggleBtn,
                user?.accountStatus === "ACTIVE" ? styles.toggleBtnDisable : styles.toggleBtnEnable
              ]}
              onPress={handleToggleStatus}
              disabled={updating}
            >
              <Ionicons
                name={user?.accountStatus === "ACTIVE" ? "ban-outline" : "checkmark-circle-outline"}
                size={18}
                color="#FFFFFF"
                style={{ marginRight: 6 }}
              />
              <Text style={styles.toggleBtnText}>
                {user?.accountStatus === "ACTIVE" ? "Disable User Account" : "Enable User Account"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Section: Application Activity (Non-Surveillance Guarantee) */}
          <View style={styles.activityHeaderRow}>
            <View>
              <Text style={styles.sectionHeading}>Application Activity</Text>
              <Text style={styles.privacyNote}>Strictly tracks deliberate actions inside this app (zero device surveillance).</Text>
            </View>
          </View>

          {activities.length === 0 ? (
            <View style={styles.emptyActivity}>
              <Ionicons name="time-outline" size={36} color={theme.colors.textMuted} />
              <Text style={styles.emptyActivityText}>No activity recorded yet for this user.</Text>
            </View>
          ) : (
            activities.map((act, index) => {
              const icon = formatActionIcon(act.action);
              return (
                <View key={act.id || index} style={styles.activityItem}>
                  <View style={[styles.activityIconCircle, { backgroundColor: `${icon.color}20` }]}>
                    <Ionicons name={icon.name as any} size={18} color={icon.color} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.activityAction}>{act.action}</Text>
                    <Text style={styles.activityDetails}>{act.details || "In-app interaction"}</Text>
                    <Text style={styles.activityTime}>
                      {act.timestamp ? new Date(act.timestamp).toLocaleString() : ""}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
          {locationHistory.length > 0 && (
            <View style={{ marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.colors.border }}>
              <Text style={styles.sectionHeading}>Location History ({locationHistory.length})</Text>
              {locationHistory.map((loc, idx) => {
                const lat = loc.metadata?.latitude ?? loc.latitude;
                const lon = loc.metadata?.longitude ?? loc.longitude;
                const hasCoords = lat !== undefined && lon !== undefined;
                const locationName = loc.metadata?.address || 
                  loc.metadata?.village || 
                  loc.metadata?.city || 
                  "Location";

                return (
                  <View key={loc.id || idx} style={styles.activityItem}>
                    <View style={[styles.activityIconCircle, { backgroundColor: "#FBBF2420" }]}>
                      <Ionicons name="location" size={18} color="#FBBF24" />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.activityAction}>{locationName}</Text>
                      {hasCoords && (
                        <Text style={styles.activityDetails}>
                          📍 {lat.toFixed(4)}, {lon.toFixed(4)}
                        </Text>
                      )}
                      <Text style={styles.activityTime}>
                        {loc.timestamp ? new Date(loc.timestamp).toLocaleString() : ""}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  centerLoader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  profileCard: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
  },
  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  fullName: {
    color: theme.colors.textPrimary,
    fontSize: 17,
    fontWeight: "700",
  },
  username: {
    color: theme.colors.textMuted,
    fontSize: 13,
    marginTop: 1,
  },
  badgeRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
  },
  badge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 16,
    borderTopColor: theme.colors.border,
    borderTopWidth: 1,
    paddingTop: 12,
  },
  metaItem: {
    width: "50%",
    marginBottom: 12,
  },
  metaLabel: {
    color: theme.colors.textMuted,
    fontSize: 11,
  },
  metaValue: {
    color: theme.colors.textPrimary,
    fontSize: 13,
    fontWeight: "600",
    marginTop: 2,
  },
  toggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    paddingVertical: 10,
    marginTop: 8,
  },
  toggleBtnDisable: {
    backgroundColor: "rgba(239, 68, 68, 0.8)",
  },
  toggleBtnEnable: {
    backgroundColor: "rgba(16, 185, 129, 0.8)",
  },
  toggleBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  activityHeaderRow: {
    marginBottom: 12,
  },
  sectionHeading: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: "700",
  },
  privacyNote: {
    color: theme.colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  activityItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  activityIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  activityAction: {
    color: theme.colors.textPrimary,
    fontSize: 13,
    fontWeight: "700",
  },
  activityDetails: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    marginTop: 1,
  },
  activityTime: {
    color: theme.colors.textMuted,
    fontSize: 10,
    marginTop: 3,
  },
  emptyActivity: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyActivityText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    marginTop: 8,
  },
  locationHistorySection: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
});

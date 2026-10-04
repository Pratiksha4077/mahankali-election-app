import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, ActivityIndicator, RefreshControl
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Header } from "../../components/Header";
import { adminAPI } from "../../api/client";
import { theme } from "../../theme/theme";
import { useLanguage } from "../../context/LanguageContext";

export const UserActivityScreen: React.FC<{ route: any; navigation: any }> = ({ route, navigation }) => {
  const { user } = route.params || {
    user: { id: "u-2", username: "rupesh_sir", mobile: "9172474077", role: "USER" }
  };
  const { t } = useLanguage();

  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [expandedSection, setExpandedSection] = useState<"calls" | "sms" | "locations" | "timeline" | null>("calls");
  const [activityData, setActivityData] = useState<{
    calls: any[];
    sms: any[];
    locations: any[];
    timeline: any[];
    call_count: number;
    sms_count: number;
    location_count: number;
    timeline_count: number;
  }>({
    calls: [],
    sms: [],
    locations: [],
    timeline: [],
    call_count: 0,
    sms_count: 0,
    location_count: 0,
    timeline_count: 0
  });

  const loadUserActivities = useCallback(async () => {
    try {
      const res = await adminAPI.getUserActivity(user.id || user._id, user.username);
      const data = res?.data || res;
      if (data && (data.timeline || data.calls)) {
        const timeline: any[] = data.timeline || [];
        const calls = data.calls?.length
          ? data.calls
          : timeline.filter((d: any) => d.action?.includes("CALL"));
        const sms = data.sms?.length
          ? data.sms
          : timeline.filter((d: any) => d.action?.includes("SMS") || d.action?.includes("WHATSAPP"));
        const locations = data.locations?.length
          ? data.locations
          : timeline.filter((d: any) => d.action?.includes("LOCATION") || d.action?.includes("VILLAGE") || d.action?.includes("CHECKIN"));

        setActivityData({
          calls,
          sms,
          locations,
          timeline,
          call_count: data.call_count ?? calls.length,
          sms_count: data.sms_count ?? sms.length,
          location_count: data.location_count ?? locations.length,
          timeline_count: timeline.length,
        });
      } else if (Array.isArray(data)) {
        const calls = data.filter((d: any) => d.action?.includes("CALL"));
        const sms = data.filter((d: any) => d.action?.includes("SMS") || d.action?.includes("WHATSAPP"));
        const locations = data.filter((d: any) => d.action?.includes("LOCATION") || d.action?.includes("VILLAGE") || d.action?.includes("CHECKIN"));
        setActivityData({
          calls,
          sms,
          locations,
          timeline: data,
          call_count: calls.length,
          sms_count: sms.length,
          location_count: locations.length,
          timeline_count: data.length
        });
      }
    } catch (err) {
      console.error("Failed to load user activity:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user.id, user._id, user.username]);

  useEffect(() => {
    loadUserActivities();
  }, [loadUserActivities]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadUserActivities();
  };

  const toggleSection = (section: "calls" | "sms" | "locations" | "timeline") => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const [currentPerm, setCurrentPerm] = useState<boolean>(user.permissions_granted === true);

  const handleTogglePermAsAdmin = async () => {
    const nextVal = !currentPerm;
    try {
      await adminAPI.toggleUserPermission(user.id || user._id, nextVal);
      setCurrentPerm(nextVal);
      if (nextVal) {
        loadUserActivities();
      }
    } catch (e) {
      console.error("Toggle perm error:", e);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title={user.fullName || user.username}
        showBack
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.colors.primaryLight} />}
      >
        {/* User Badge Card */}
        <View style={styles.userBadgeCard}>
          <View style={styles.avatarCircle}>
            <Ionicons name="person" size={26} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.userName}>{user.fullName || user.username}</Text>
            <Text style={styles.userMobile}>मोबाईल: {user.mobileNumber || user.mobile || "-"}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4, gap: 6 }}>
              <TouchableOpacity
                onPress={handleTogglePermAsAdmin}
                activeOpacity={0.7}
                style={[styles.permBadge, { backgroundColor: currentPerm ? "#064E3B" : "#7F1D1D" }]}
              >
                <Ionicons
                  name={currentPerm ? "shield-checkmark" : "shield-half"}
                  size={12}
                  color={currentPerm ? "#34D399" : "#F87171"}
                  style={{ marginRight: 4 }}
                />
                <Text style={[styles.permBadgeText, { color: currentPerm ? "#34D399" : "#F87171" }]}>
                  {currentPerm ? "Permissions Allowed" : "Permissions Denied"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>{user.role}</Text>
          </View>
        </View>

        {/* Section Heading */}
        <Text style={styles.sectionHeading}>रिअल-टाईम वापरकर्ता इतिहास (Real-Time History):</Text>

        {!currentPerm ? (
          <View style={styles.noPermCard}>
            <Ionicons name="lock-closed" size={36} color="#F87171" />
            <Text style={styles.noPermTitle}>परवानगी नाकारली (Permission Denied)</Text>
            <Text style={styles.noPermText}>
              या वापरकर्त्याने अॅपला फोन कॉल, SMS आणि स्थान माहिती वापरण्याची परवानगी दिली नाही.
              म्हणून रिअल-टाईम इतिहास उपलब्ध नाही.
            </Text>
            <TouchableOpacity
              style={styles.grantAccessBtn}
              onPress={handleTogglePermAsAdmin}
              activeOpacity={0.8}
            >
              <Ionicons name="shield-checkmark" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.grantAccessBtnText}>परवानगी सक्रिय करा (Allow Access)</Text>
            </TouchableOpacity>
          </View>
        ) : loading ? (
          <ActivityIndicator size="large" color={theme.colors.primaryLight} style={{ marginVertical: 30 }} />
        ) : (
          <>
            {/* Summary Stats Row */}
            <View style={styles.statsRow}>
              <View style={[styles.statPill, { borderColor: "#34D399" }]}>
                <Ionicons name="call" size={16} color="#34D399" />
                <Text style={[styles.statNum, { color: "#34D399" }]}>{activityData.call_count}</Text>
                <Text style={styles.statLbl}>Calls</Text>
              </View>
              <View style={[styles.statPill, { borderColor: "#60A5FA" }]}>
                <Ionicons name="chatbubble" size={16} color="#60A5FA" />
                <Text style={[styles.statNum, { color: "#60A5FA" }]}>{activityData.sms_count}</Text>
                <Text style={styles.statLbl}>SMS</Text>
              </View>
              <View style={[styles.statPill, { borderColor: "#FBBF24" }]}>
                <Ionicons name="location" size={16} color="#FBBF24" />
                <Text style={[styles.statNum, { color: "#FBBF24" }]}>{activityData.location_count}</Text>
                <Text style={styles.statLbl}>Locations</Text>
              </View>
              <View style={[styles.statPill, { borderColor: "#A78BFA" }]}>
                <Ionicons name="time" size={16} color="#A78BFA" />
                <Text style={[styles.statNum, { color: "#A78BFA" }]}>{activityData.timeline_count}</Text>
                <Text style={styles.statLbl}>Timeline</Text>
              </View>
            </View>

            {/* Card 1: Call History */}
            <TouchableOpacity
              style={[styles.activityCard, expandedSection === "calls" && styles.activeCardBorder]}
              onPress={() => toggleSection("calls")}
              activeOpacity={0.7}
            >
              <View style={[styles.iconCircle, { backgroundColor: "#064E3B" }]}>
                <Ionicons name="call" size={22} color="#34D399" />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.cardTitleRow}>
                  <Text style={styles.cardTitle}>फोन कॉल इतिहास (Call History)</Text>
                  <View style={[styles.pillBadge, { backgroundColor: "#064E3B" }]}>
                    <Text style={[styles.pillText, { color: "#34D399" }]}>{activityData.call_count} Calls</Text>
                  </View>
                </View>
                <Text style={styles.cardSubtitle}>
                  {activityData.call_count > 0
                    ? `${activityData.call_count} कॉल्स नोंदवले गेले`
                    : "कोणताही कॉल नोंदवलेला नाही"}
                </Text>
              </View>
              <Ionicons
                name={expandedSection === "calls" ? "chevron-down" : "chevron-forward"}
                size={20}
                color={theme.colors.textMuted}
              />
            </TouchableOpacity>

            {expandedSection === "calls" && (
              <View style={styles.subListCard}>
                <Text style={styles.subListTitle}>कॉल रेकॉर्ड्स ({activityData.calls.length}):</Text>
                {activityData.calls.length === 0 ? (
                  <View style={styles.emptyDataBox}>
                    <Ionicons name="call-outline" size={28} color={theme.colors.textMuted} />
                    <Text style={styles.emptySubText}>कोणताही कॉल इतिहास उपलब्ध नाही</Text>
                  </View>
                ) : (
                  activityData.calls.map((c, idx) => (
                    <View key={c.id || idx} style={styles.subListItem}>
                      <View style={styles.itemIconWrap}>
                        <Ionicons name="call" size={16} color="#34D399" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.itemTitle}>{c.targetMemberName || c.metadata?.voter || "मतदार कॉल"}</Text>
                        <Text style={styles.itemDetail}>{c.details || `फोन: ${c.metadata?.phone || "-"}`}</Text>
                        <Text style={styles.itemTime}>{c.timestamp ? new Date(c.timestamp).toLocaleString("mr-IN") : "अलीकडे"}</Text>
                      </View>
                    </View>
                  ))
                )}
              </View>
            )}

            {/* Card 2: SMS History */}
            <TouchableOpacity
              style={[styles.activityCard, expandedSection === "sms" && styles.activeCardBorder]}
              onPress={() => toggleSection("sms")}
              activeOpacity={0.7}
            >
              <View style={[styles.iconCircle, { backgroundColor: "#1E3A8A" }]}>
                <Ionicons name="chatbubble" size={22} color="#60A5FA" />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.cardTitleRow}>
                  <Text style={styles.cardTitle}>SMS इतिहास (SMS History)</Text>
                  <View style={[styles.pillBadge, { backgroundColor: "#1E3A8A" }]}>
                    <Text style={[styles.pillText, { color: "#60A5FA" }]}>{activityData.sms_count} SMS</Text>
                  </View>
                </View>
                <Text style={styles.cardSubtitle}>
                  {activityData.sms_count > 0
                    ? `${activityData.sms_count} संदेश नोंदवले गेले`
                    : "कोणताही SMS नोंदवलेला नाही"}
                </Text>
              </View>
              <Ionicons
                name={expandedSection === "sms" ? "chevron-down" : "chevron-forward"}
                size={20}
                color={theme.colors.textMuted}
              />
            </TouchableOpacity>

            {expandedSection === "sms" && (
              <View style={styles.subListCard}>
                <Text style={styles.subListTitle}>SMS व संदेश रेकॉर्ड्स ({activityData.sms.length}):</Text>
                {activityData.sms.length === 0 ? (
                  <View style={styles.emptyDataBox}>
                    <Ionicons name="chatbubble-outline" size={28} color={theme.colors.textMuted} />
                    <Text style={styles.emptySubText}>कोणताही SMS इतिहास उपलब्ध नाही</Text>
                  </View>
                ) : (
                  activityData.sms.map((s, idx) => (
                    <View key={s.id || idx} style={styles.subListItem}>
                      <View style={styles.itemIconWrap}>
                        <Ionicons name="chatbubble" size={16} color="#60A5FA" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.itemTitle}>{s.targetMemberName || s.metadata?.voter || "SMS संदेश"}</Text>
                        <Text style={styles.itemDetail}>{s.details || `फोन: ${s.metadata?.phone || "-"}`}</Text>
                        <Text style={styles.itemTime}>{s.timestamp ? new Date(s.timestamp).toLocaleString("mr-IN") : "अलीकडे"}</Text>
                      </View>
                    </View>
                  ))
                )}
              </View>
            )}

            {/* Card 3: Location History */}
            <TouchableOpacity
              style={[styles.activityCard, expandedSection === "locations" && styles.activeCardBorder]}
              onPress={() => toggleSection("locations")}
              activeOpacity={0.7}
            >
              <View style={[styles.iconCircle, { backgroundColor: "#78350F" }]}>
                <Ionicons name="location" size={22} color="#FBBF24" />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.cardTitleRow}>
                  <Text style={styles.cardTitle}>स्थान इतिहास (Location History)</Text>
                  <View style={[styles.pillBadge, { backgroundColor: "#78350F" }]}>
                    <Text style={[styles.pillText, { color: "#FBBF24" }]}>{activityData.location_count} Loc</Text>
                  </View>
                </View>
                <Text style={styles.cardSubtitle}>
                  {activityData.location_count > 0
                    ? `${activityData.location_count} गाव/बूथ भेटी नोंदवल्या`
                    : "कोणतेही स्थान नोंदवलेले नाही"}
                </Text>
              </View>
              <Ionicons
                name={expandedSection === "locations" ? "chevron-down" : "chevron-forward"}
                size={20}
                color={theme.colors.textMuted}
              />
            </TouchableOpacity>

            {expandedSection === "locations" && (
              <View style={styles.subListCard}>
                <Text style={styles.subListTitle}>गाव व बूथ उपस्थिती ({activityData.locations.length}):</Text>
                {activityData.locations.length === 0 ? (
                  <View style={styles.emptyDataBox}>
                    <Ionicons name="location-outline" size={28} color={theme.colors.textMuted} />
                    <Text style={styles.emptySubText}>कोणतेही स्थान रेकॉर्ड उपलब्ध नाही</Text>
                  </View>
                ) : (
                  activityData.locations.map((loc, idx) => (
                    <View key={loc.id || idx} style={styles.subListItem}>
                      <View style={styles.itemIconWrap}>
                        <Ionicons name="location" size={16} color="#FBBF24" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.itemTitle}>{loc.metadata?.village || loc.details?.split(":")[1]?.trim() || "गाव भेट"}</Text>
                        <Text style={styles.itemDetail}>{loc.details || `तालुका: ${loc.metadata?.taluka || "वाळवा"}`}</Text>
                        <Text style={styles.itemTime}>{loc.timestamp ? new Date(loc.timestamp).toLocaleString("mr-IN") : "अलीकडे"}</Text>
                      </View>
                    </View>
                  ))
                )}
              </View>
            )}

            {/* Card 4: All Timeline / Audit Trail */}
            <TouchableOpacity
              style={[styles.activityCard, expandedSection === "timeline" && styles.activeCardBorder]}
              onPress={() => toggleSection("timeline")}
              activeOpacity={0.7}
            >
              <View style={[styles.iconCircle, { backgroundColor: "#312E81" }]}>
                <Ionicons name="time" size={22} color="#A78BFA" />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.cardTitleRow}>
                  <Text style={styles.cardTitle}>सर्व कृती इतिहास (Activity Timeline)</Text>
                  <View style={[styles.pillBadge, { backgroundColor: "#312E81" }]}>
                    <Text style={[styles.pillText, { color: "#A78BFA" }]}>{activityData.timeline_count} Events</Text>
                  </View>
                </View>
                <Text style={styles.cardSubtitle}>
                  {activityData.timeline_count > 0
                    ? `एकूण ${activityData.timeline_count} क्रिया/लॉग नोंदवले`
                    : "कोणतीही कृती नोंदवलेली नाही"}
                </Text>
              </View>
              <Ionicons
                name={expandedSection === "timeline" ? "chevron-down" : "chevron-forward"}
                size={20}
                color={theme.colors.textMuted}
              />
            </TouchableOpacity>

            {expandedSection === "timeline" && (
              <View style={styles.subListCard}>
                <Text style={styles.subListTitle}>सर्व कृती लॉग ({activityData.timeline.length}):</Text>
                {activityData.timeline.length === 0 ? (
                  <View style={styles.emptyDataBox}>
                    <Ionicons name="time-outline" size={28} color={theme.colors.textMuted} />
                    <Text style={styles.emptySubText}>कोणताही कृती इतिहास उपलब्ध नाही</Text>
                  </View>
                ) : (
                  activityData.timeline.map((act, idx) => {
                    const isCall = act.action?.includes("CALL");
                    const isSms = act.action?.includes("SMS") || act.action?.includes("WHATSAPP");
                    const isLoc = act.action?.includes("LOCATION") || act.action?.includes("CHECKIN");
                    const isEdit = act.action?.includes("UPDATE");
                    const isView = act.action?.includes("VIEW");
                    const isLogin = act.action?.includes("LOGIN");

                    const iconName = isCall ? "call" : isSms ? "chatbubble" : isLoc ? "location" : isEdit ? "create" : isView ? "eye" : isLogin ? "log-in" : "flash";
                    const iconColor = isCall ? "#34D399" : isSms ? "#60A5FA" : isLoc ? "#FBBF24" : isEdit ? "#F59E0B" : isView ? "#38BDF8" : isLogin ? "#A78BFA" : "#9CA3AF";

                    return (
                      <View key={act.id || idx} style={styles.subListItem}>
                        <View style={[styles.itemIconWrap, { backgroundColor: `${iconColor}22` }]}>
                          <Ionicons name={iconName as any} size={16} color={iconColor} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.itemTitle}>{act.details || act.action}</Text>
                          {act.targetMemberName ? (
                            <Text style={styles.itemDetail}>मतदार: {act.targetMemberName}</Text>
                          ) : null}
                          <Text style={styles.itemTime}>
                            {act.timestamp ? new Date(act.timestamp).toLocaleString("mr-IN") : "अलीकडे"}
                          </Text>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            )}
          </>
        )}
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
  userBadgeCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1E3A8A",
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#3B82F6",
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  userName: {
    color: "#FFFFFF",
    fontSize: theme.typography.sizes.md,
    fontWeight: "800",
  },
  userMobile: {
    color: "#93C5FD",
    fontSize: 12,
    marginTop: 2,
  },
  permBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  permBadgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  roleBadge: {
    backgroundColor: "#334155",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  roleBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  sectionHeading: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 14,
  },
  statsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  statPill: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.md,
    padding: 12,
    borderWidth: 1,
    gap: 4,
  },
  statNum: {
    fontSize: 20,
    fontWeight: "800",
  },
  statLbl: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontWeight: "600",
  },
  noPermCard: {
    backgroundColor: "rgba(127, 29, 29, 0.2)",
    borderRadius: theme.borderRadius.lg,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#7F1D1D",
    marginTop: 8,
  },
  noPermTitle: {
    color: "#F87171",
    fontSize: 16,
    fontWeight: "800",
    marginTop: 12,
    marginBottom: 8,
  },
  noPermText: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
  },
  activityCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  activeCardBorder: {
    borderColor: "#3B82F6",
    backgroundColor: "rgba(30, 58, 138, 0.25)",
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  cardTitle: {
    color: theme.colors.textPrimary,
    fontSize: 13,
    fontWeight: "700",
  },
  pillBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pillText: {
    fontSize: 11,
    fontWeight: "800",
  },
  cardSubtitle: {
    color: theme.colors.textMuted,
    fontSize: 11,
    marginTop: 3,
  },
  subListCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.md,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.35)",
  },
  subListTitle: {
    color: "#93C5FD",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 10,
  },
  emptyDataBox: {
    alignItems: "center",
    paddingVertical: 16,
    gap: 6,
  },
  emptySubText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontStyle: "italic",
  },
  subListItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  itemIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    marginTop: 2,
  },
  itemTitle: {
    color: theme.colors.textPrimary,
    fontSize: 13,
    fontWeight: "700",
  },
  itemDetail: {
    color: "#E2E8F0",
    fontSize: 11,
    marginTop: 2,
  },
  itemTime: {
    color: theme.colors.textMuted,
    fontSize: 10,
    marginTop: 2,
  },
  grantAccessBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#059669",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 14,
  },
  grantAccessBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
});

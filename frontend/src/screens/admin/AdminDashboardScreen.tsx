import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, ActivityIndicator, RefreshControl, FlatList
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Header } from "../../components/Header";
import { adminAPI, memberAPI } from "../../api/client";
import { DashboardStats } from "../../models/types";
import { theme } from "../../theme/theme";

type ActiveTab = "analysis" | "voters";

export const AdminDashboardScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState<ActiveTab>("analysis");
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Voters data state
  const [voters, setVoters] = useState<any[]>([]);
  const [votersLoading, setVotersLoading] = useState<boolean>(false);
  const [votersTotal, setVotersTotal] = useState<number>(0);
  const [votersPage, setVotersPage] = useState<number>(1);
  const [votersHasMore, setVotersHasMore] = useState<boolean>(true);
  const [votersLoadingMore, setVotersLoadingMore] = useState<boolean>(false);

  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
    if (activeTab === "voters" && voters.length === 0) {
      loadVoters(1, false);
    }
  }, [activeTab]);

  const loadDashboard = async () => {
    try {
      const data = await adminAPI.getDashboardStats();
      setStats(data);
    } catch (e) {
      console.error("Failed to load dashboard:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadVoters = async (pageToLoad: number = 1, append: boolean = false) => {
    if (pageToLoad === 1) setVotersLoading(true);
    else setVotersLoadingMore(true);

    try {
      const res = await memberAPI.getMembers({ page: pageToLoad, limit: 50 });
      const items = res.items || [];
      const total = res.total ?? items.length;
      setVotersTotal(total);
      if (append) {
        setVoters(prev => [...prev, ...items]);
      } else {
        setVoters(items);
      }
      setVotersHasMore(items.length === 50 && (pageToLoad * 50 < total));
      setVotersPage(pageToLoad);
    } catch (e) {
      console.error("Failed to load voters:", e);
    } finally {
      setVotersLoading(false);
      setVotersLoadingMore(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadDashboard();
    if (activeTab === "voters") {
      setVotersPage(1);
      setVotersHasMore(true);
      loadVoters(1, false);
    }
  };

  const handleLoadMoreVoters = () => {
    if (!votersLoading && !votersLoadingMore && votersHasMore) {
      loadVoters(votersPage + 1, true);
    }
  };

  // Vote analysis: calculate percentages and category totals
  const totalVoters = stats?.total_members || stats?.total_voters || 0;
  const activeVoters = stats?.active_members || stats?.active_voters || 0;
  const deceasedVoters = stats?.deceased_members || stats?.deceased_voters || 0;
  const categorized = stats?.categorized_voters || 0;
  const uncategorized = totalVoters - categorized;

  const categoryData = stats?.members_by_category || [];
  const villageData = stats?.members_by_village || [];

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Vote Analysis & Voters Data" />

      {/* Tab Switcher */}
      <View style={styles.tabsRow}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === "analysis" && styles.activeTabBtn]}
          onPress={() => setActiveTab("analysis")}
        >
          <Ionicons
            name="bar-chart"
            size={16}
            color={activeTab === "analysis" ? "#FFFFFF" : theme.colors.textMuted}
            style={{ marginRight: 6 }}
          />
          <Text style={[styles.tabText, activeTab === "analysis" && styles.activeTabText]}>
            Vote Analysis
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === "voters" && styles.activeTabBtn]}
          onPress={() => setActiveTab("voters")}
        >
          <Ionicons
            name="people"
            size={16}
            color={activeTab === "voters" ? "#FFFFFF" : theme.colors.textMuted}
            style={{ marginRight: 6 }}
          />
          <Text style={[styles.tabText, activeTab === "voters" && styles.activeTabText]}>
            Voters Data ({totalVoters})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Analysis Tab */}
      {activeTab === "analysis" && (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.colors.primaryLight} />
          }
        >
          {loading ? (
            <View style={styles.loaderCenter}>
              <ActivityIndicator size="large" color={theme.colors.primaryLight} />
              <Text style={styles.loaderText}>डेटा विश्लेषण लोड होत आहे...</Text>
            </View>
          ) : (
            <>
              {/* Quick Action Shortcuts */}
              <View style={styles.quickActionRow}>
                <TouchableOpacity
                  style={[styles.quickBtn, { backgroundColor: "#4F46E5" }]}
                  onPress={() => navigation.navigate("DataUpload")}
                >
                  <Ionicons name="cloud-upload" size={18} color="#A5B4FC" />
                  <Text style={styles.quickBtnText}>Upload Studio</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.quickBtn, { backgroundColor: "#065F46" }]}
                  onPress={() => navigation.navigate("UserManagement")}
                >
                  <Ionicons name="people" size={18} color="#34D399" />
                  <Text style={styles.quickBtnText}>User Management</Text>
                </TouchableOpacity>
              </View>

              {/* Summary Metric Cards */}
              <Text style={styles.sectionHeading}>मतदार सारांश (Voter Summary)</Text>
              <View style={styles.statsGrid}>
                <TouchableOpacity
                  style={[styles.statCard, { borderColor: "#3B82F6" }]}
                  onPress={() => setActiveTab("voters")}
                  activeOpacity={0.7}
                >
                  <View style={[styles.statIconWrap, { backgroundColor: "rgba(59,130,246,0.15)" }]}>
                    <Ionicons name="people-circle-outline" size={22} color="#60A5FA" />
                  </View>
                  <Text style={styles.statNumber}>{totalVoters.toLocaleString()}</Text>
                  <Text style={styles.statLabel}>एकूण मतदार</Text>
                  <Text style={styles.statSubLabel}>Tap to view list →</Text>
                </TouchableOpacity>

                <View style={[styles.statCard, { borderColor: "#10B981" }]}>
                  <View style={[styles.statIconWrap, { backgroundColor: "rgba(16,185,129,0.15)" }]}>
                    <Ionicons name="checkmark-done-circle-outline" size={22} color="#34D399" />
                  </View>
                  <Text style={[styles.statNumber, { color: "#34D399" }]}>{activeVoters.toLocaleString()}</Text>
                  <Text style={styles.statLabel}>सक्रिय मतदार</Text>
                  <Text style={styles.statSubLabel}>{totalVoters > 0 ? `${Math.round((activeVoters / totalVoters) * 100)}%` : "0%"}</Text>
                </View>

                <View style={[styles.statCard, { borderColor: "#EF4444" }]}>
                  <View style={[styles.statIconWrap, { backgroundColor: "rgba(239,68,68,0.15)" }]}>
                    <Ionicons name="skull-outline" size={22} color="#EF4444" />
                  </View>
                  <Text style={[styles.statNumber, { color: "#F87171" }]}>{deceasedVoters.toLocaleString()}</Text>
                  <Text style={styles.statLabel}>मयत नोंदी</Text>
                  <Text style={styles.statSubLabel}>{totalVoters > 0 ? `${Math.round((deceasedVoters / totalVoters) * 100)}%` : "0%"}</Text>
                </View>

                <View style={[styles.statCard, { borderColor: "#8B5CF6" }]}>
                  <View style={[styles.statIconWrap, { backgroundColor: "rgba(139,92,246,0.15)" }]}>
                    <Ionicons name="home-outline" size={22} color="#A78BFA" />
                  </View>
                  <Text style={[styles.statNumber, { color: "#A78BFA" }]}>{stats?.total_villages || 1}</Text>
                  <Text style={styles.statLabel}>गावे (Villages)</Text>
                  <Text style={styles.statSubLabel}>साखराळे</Text>
                </View>

                <TouchableOpacity
                  style={[styles.statCard, { borderColor: "#F59E0B" }]}
                  onPress={() => navigation.navigate("UserManagement")}
                  activeOpacity={0.7}
                >
                  <View style={[styles.statIconWrap, { backgroundColor: "rgba(245,158,11,0.15)" }]}>
                    <Ionicons name="person-outline" size={22} color="#FBBF24" />
                  </View>
                  <Text style={[styles.statNumber, { color: "#FBBF24" }]}>{stats?.total_users || 0}</Text>
                  <Text style={styles.statLabel}>App Users</Text>
                  <Text style={styles.statSubLabel}>{stats?.active_users || 0} active</Text>
                </TouchableOpacity>

                <View style={[styles.statCard, { borderColor: "#EC4899" }]}>
                  <View style={[styles.statIconWrap, { backgroundColor: "rgba(236,72,153,0.15)" }]}>
                    <Ionicons name="color-palette-outline" size={22} color="#F472B6" />
                  </View>
                  <Text style={[styles.statNumber, { color: "#F472B6" }]}>{categorized}</Text>
                  <Text style={styles.statLabel}>Color Tagged</Text>
                  <Text style={styles.statSubLabel}>{uncategorized} pending</Text>
                </View>
              </View>

              {/* Vote Analysis: Active vs Deceased Progress */}
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionHeading}>मतदार स्थिती विश्लेषण</Text>
                  <Ionicons name="analytics-outline" size={18} color={theme.colors.textSecondary} />
                </View>

                {totalVoters === 0 ? (
                  <View style={styles.noDataBox}>
                    <Ionicons name="bar-chart-outline" size={32} color={theme.colors.textMuted} />
                    <Text style={styles.noDataText}>डेटा अद्याप अपलोड केलेला नाही</Text>
                    <TouchableOpacity
                      style={styles.uploadNowBtn}
                      onPress={() => navigation.navigate("DataUpload")}
                    >
                      <Text style={styles.uploadNowText}>Upload Studio खोला →</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <>
                    {/* Active Voters Bar */}
                    <View style={styles.analysisRow}>
                      <View style={styles.analysisLabelRow}>
                        <View style={[styles.analysisDot, { backgroundColor: "#34D399" }]} />
                        <Text style={styles.analysisLabel}>सक्रिय मतदार (Active)</Text>
                        <Text style={styles.analysisCount}>{activeVoters} ({totalVoters > 0 ? Math.round((activeVoters / totalVoters) * 100) : 0}%)</Text>
                      </View>
                      <View style={styles.barTrack}>
                        <View style={[styles.barFill, { width: `${totalVoters > 0 ? Math.round((activeVoters / totalVoters) * 100) : 0}%`, backgroundColor: "#34D399" }]} />
                      </View>
                    </View>

                    {/* Deceased Bar */}
                    <View style={styles.analysisRow}>
                      <View style={styles.analysisLabelRow}>
                        <View style={[styles.analysisDot, { backgroundColor: "#EF4444" }]} />
                        <Text style={styles.analysisLabel}>मयत (Deceased)</Text>
                        <Text style={styles.analysisCount}>{deceasedVoters} ({totalVoters > 0 ? Math.round((deceasedVoters / totalVoters) * 100) : 0}%)</Text>
                      </View>
                      <View style={styles.barTrack}>
                        <View style={[styles.barFill, { width: `${totalVoters > 0 ? Math.round((deceasedVoters / totalVoters) * 100) : 0}%`, backgroundColor: "#EF4444" }]} />
                      </View>
                    </View>

                    {/* Categorized Bar */}
                    <View style={styles.analysisRow}>
                      <View style={styles.analysisLabelRow}>
                        <View style={[styles.analysisDot, { backgroundColor: "#F472B6" }]} />
                        <Text style={styles.analysisLabel}>रंग-टॅग केलेले (Tagged)</Text>
                        <Text style={styles.analysisCount}>{categorized} ({totalVoters > 0 ? Math.round((categorized / totalVoters) * 100) : 0}%)</Text>
                      </View>
                      <View style={styles.barTrack}>
                        <View style={[styles.barFill, { width: `${totalVoters > 0 ? Math.round((categorized / totalVoters) * 100) : 0}%`, backgroundColor: "#F472B6" }]} />
                      </View>
                    </View>
                  </>
                )}
              </View>

              {/* Color Tag Classification */}
              {categoryData.length > 0 && (
                <View style={styles.sectionCard}>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionHeading}>रंग श्रेणी वर्गीकरण</Text>
                    <Ionicons name="color-palette-outline" size={18} color={theme.colors.textSecondary} />
                  </View>
                  <View style={styles.catGrid}>
                    {categoryData.map((c) => (
                      <View key={c.category_id} style={[styles.catPill, { borderColor: c.color }]}>
                        <View style={[styles.catDot, { backgroundColor: c.color }]} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.catLabel}>{c.label}</Text>
                          <Text style={styles.catCount}>{c.count} मतदार</Text>
                        </View>
                        <Text style={[styles.catPct, { color: c.color }]}>
                          {totalVoters > 0 ? Math.round((c.count / totalVoters) * 100) : 0}%
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Village Distribution */}
              {villageData.length > 0 && (
                <View style={styles.sectionCard}>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionHeading}>गावनिहाय मतदार वितरण</Text>
                    <Ionicons name="bar-chart-outline" size={18} color={theme.colors.textSecondary} />
                  </View>
                  {villageData.map((v) => {
                    const pct = totalVoters > 0 ? Math.min(Math.round((v.count / totalVoters) * 100), 100) : 0;
                    return (
                      <TouchableOpacity
                        key={v.village_id}
                        style={styles.barItem}
                        onPress={() => setActiveTab("voters")}
                        activeOpacity={0.7}
                      >
                        <View style={styles.barLabelRow}>
                          <Text style={styles.barLabel}>{v.name_mr || v.name_en}</Text>
                          <Text style={styles.barCount}>{v.count} ({pct}%)</Text>
                        </View>
                        <View style={styles.barTrack}>
                          <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: theme.colors.primaryLight }]} />
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* Recent Activity */}
              {stats?.recent_activities && stats.recent_activities.length > 0 && (
                <View style={styles.sectionCard}>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionHeading}>अलीकडील क्रियाकलाप</Text>
                    <TouchableOpacity onPress={() => navigation.navigate("AuditLogs")}>
                      <Text style={styles.viewAllText}>सर्व पहा →</Text>
                    </TouchableOpacity>
                  </View>
                  {stats.recent_activities.slice(0, 5).map((act) => (
                    <View key={act.id} style={styles.activityRow}>
                      <View style={styles.actDot} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.actDetail}>{act.details || act.action}</Text>
                        <Text style={styles.actMeta}>
                          {act.username} • {act.timestamp ? new Date(act.timestamp).toLocaleString("mr-IN") : ""}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </>
          )}
        </ScrollView>
      )}

      {/* Voters Data Tab */}
      {activeTab === "voters" && (
        <View style={{ flex: 1 }}>
          {/* Header info bar */}
          <View style={styles.votersHeader}>
            <Text style={styles.votersHeaderText}>एकूण मतदार: {votersTotal.toLocaleString()}</Text>
            <TouchableOpacity
              style={styles.votersRefreshBtn}
              onPress={() => { setVotersPage(1); setVotersHasMore(true); loadVoters(1, false); }}
            >
              <Ionicons name="refresh" size={16} color="#60A5FA" />
            </TouchableOpacity>
          </View>

          {votersLoading ? (
            <View style={styles.loaderCenter}>
              <ActivityIndicator size="large" color={theme.colors.primaryLight} />
              <Text style={styles.loaderText}>मतदार यादी लोड होत आहे...</Text>
            </View>
          ) : (
            <FlatList
              data={voters}
              keyExtractor={(item, idx) => item.id || `${idx}`}
              renderItem={({ item, index }) => (
                <TouchableOpacity
                  style={styles.voterRow}
                  onPress={() => navigation.navigate("VoterProfile", { memberId: item.id })}
                  activeOpacity={0.7}
                >
                  <View style={styles.voterIndexBadge}>
                    <Text style={styles.voterIndexText}>{(votersPage - 1) * 50 + index + 1}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.voterName} numberOfLines={1}>
                      {item.full_name_mr || item.full_name_en || "-"}
                    </Text>
                    <Text style={styles.voterMeta}>
                      {item.epic_number ? `EPIC: ${item.epic_number}` : ""}{item.age ? ` • वय: ${item.age}` : ""}
                      {item.gender === "M" || item.gender === "Male" ? " • पुरुष" : item.gender === "F" || item.gender === "Female" ? " • महिला" : ""}
                    </Text>
                    {!!item.mobile_number && (
                      <Text style={styles.voterPhone}>📱 {item.mobile_number}</Text>
                    )}
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 4 }}>
                    {item.status === "DECEASED" && (
                      <View style={styles.deceasedPill}>
                        <Text style={styles.deceasedPillText}>मयत</Text>
                      </View>
                    )}
                    {!!item.category_id && (
                      <View style={[styles.catColorDot, { backgroundColor: getCategoryColor(item.category_id, categoryData) }]} />
                    )}
                    <Ionicons name="chevron-forward" size={14} color={theme.colors.textMuted} />
                  </View>
                </TouchableOpacity>
              )}
              contentContainerStyle={{ paddingBottom: 40 }}
              onEndReached={handleLoadMoreVoters}
              onEndReachedThreshold={0.4}
              ListEmptyComponent={
                <View style={styles.loaderCenter}>
                  <Ionicons name="people-outline" size={48} color={theme.colors.textMuted} />
                  <Text style={styles.noDataText}>मतदार डेटा उपलब्ध नाही</Text>
                </View>
              }
              ListFooterComponent={
                votersLoadingMore ? (
                  <View style={{ paddingVertical: 16, alignItems: "center" }}>
                    <ActivityIndicator size="small" color={theme.colors.primaryLight} />
                  </View>
                ) : !votersHasMore && voters.length > 0 ? (
                  <View style={{ paddingVertical: 14, alignItems: "center" }}>
                    <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
                      ✓ सर्व {votersTotal} मतदार लोड झाले
                    </Text>
                  </View>
                ) : null
              }
            />
          )}
        </View>
      )}
    </SafeAreaView>
  );
};

// Helper to get category color
function getCategoryColor(categoryId: string, categories: any[]): string {
  const colorMap: Record<string, string> = {
    "c-1": "#10B981",
    "c-2": "#84CC16",
    "c-3": "#F59E0B",
    "c-4": "#F97316",
    "c-5": "#EF4444",
  };
  if (colorMap[categoryId]) return colorMap[categoryId];
  const cat = categories.find(c => c.category_id === categoryId);
  return cat?.color || "#6B7280";
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  tabsRow: {
    flexDirection: "row",
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.header,
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  activeTabBtn: {
    backgroundColor: "#1E3A8A",
    borderColor: "#3B82F6",
  },
  tabText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },
  activeTabText: {
    color: "#FFFFFF",
  },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: 40,
  },
  loaderCenter: {
    flex: 1,
    padding: 60,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  loaderText: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    marginTop: 4,
  },
  quickActionRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  quickBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    gap: 8,
  },
  quickBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  sectionHeading: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 12,
    marginTop: 4,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    width: "48%",
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    padding: 14,
    borderWidth: 1.5,
    gap: 4,
  },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  statNumber: {
    color: theme.colors.textPrimary,
    fontSize: 22,
    fontWeight: "800",
  },
  statLabel: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    fontWeight: "600",
  },
  statSubLabel: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontStyle: "italic",
  },
  sectionCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 16,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  viewAllText: {
    color: theme.colors.primaryLight,
    fontSize: 12,
    fontWeight: "700",
  },
  noDataBox: {
    alignItems: "center",
    paddingVertical: 24,
    gap: 8,
  },
  noDataText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontStyle: "italic",
  },
  uploadNowBtn: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 6,
  },
  uploadNowText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  analysisRow: {
    marginBottom: 14,
  },
  analysisLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
    gap: 8,
  },
  analysisDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  analysisLabel: {
    flex: 1,
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
  },
  analysisCount: {
    color: theme.colors.textPrimary,
    fontSize: 12,
    fontWeight: "700",
  },
  barTrack: {
    height: 10,
    backgroundColor: theme.colors.surface,
    borderRadius: 5,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 5,
  },
  catGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  catPill: {
    width: "48%",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: 10,
    borderWidth: 1,
    gap: 8,
  },
  catDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  catLabel: {
    color: theme.colors.textPrimary,
    fontSize: 11,
    fontWeight: "700",
  },
  catCount: {
    color: theme.colors.textMuted,
    fontSize: 10,
  },
  catPct: {
    fontSize: 12,
    fontWeight: "800",
  },
  barItem: {
    marginBottom: 12,
  },
  barLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  barLabel: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
  },
  barCount: {
    color: theme.colors.textPrimary,
    fontSize: 12,
    fontWeight: "700",
  },
  activityRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    gap: 10,
  },
  actDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.secondary,
  },
  actDetail: {
    color: theme.colors.textPrimary,
    fontSize: 12,
    fontWeight: "600",
  },
  actMeta: {
    color: theme.colors.textMuted,
    fontSize: 10,
    marginTop: 2,
  },
  // Voters Tab Styles
  votersHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 10,
    backgroundColor: "#111827",
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  votersHeaderText: {
    color: theme.colors.textPrimary,
    fontSize: 13,
    fontWeight: "700",
  },
  votersRefreshBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: theme.colors.card,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  voterRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.card,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  voterIndexBadge: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  voterIndexText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
  },
  voterName: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: "700",
  },
  voterMeta: {
    color: theme.colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  voterPhone: {
    color: "#34D399",
    fontSize: 11,
    marginTop: 2,
    fontWeight: "600",
  },
  deceasedPill: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.4)",
  },
  deceasedPillText: {
    color: "#F87171",
    fontSize: 9,
    fontWeight: "700",
  },
  catColorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
});

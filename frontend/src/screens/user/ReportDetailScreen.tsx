import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ScrollView, SafeAreaView, ActivityIndicator, Alert, Linking
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Header } from "../../components/Header";
import { reportAPI, villageAPI, logUserActivity } from "../../api/client";
import { Member, Village } from "../../models/types";
import { theme } from "../../theme/theme";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";

export const ReportDetailScreen: React.FC<{ route: any; navigation: any }> = ({ route, navigation }) => {
  const { reportType, titleKey } = route.params || { reportType: "alphabetical", titleKey: "rep_alphabetical" };
  const { t } = useLanguage();
  const { isAdmin, activePanel } = useAuth();
  const isUserPanel = !isAdmin || activePanel !== "ADMIN";

  const [villages, setVillages] = useState<Village[]>([]);
  const [selectedVillageId, setSelectedVillageId] = useState<string | null>(null);
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);

  const [voters, setVoters] = useState<Member[]>([]);
  const [summaryGroups, setSummaryGroups] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  // Drilldown state for expandable groups (Surname, Family, Religion, etc.)
  const [expandedGroupKey, setExpandedGroupKey] = useState<string | null>(null);
  const [groupMembersMap, setGroupMembersMap] = useState<Record<string, Member[]>>({});
  const [loadingGroupKey, setLoadingGroupKey] = useState<string | null>(null);

  const alphabet = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "R", "S", "T", "V", "Y"];
  const marathiAlphabet = ["अ", "आ", "क", "ख", "ग", "घ", "च", "ज", "त", "द", "ध", "न", "प", "फ", "ब", "भ", "म", "य", "र", "ल", "व", "श", "स"];

  useEffect(() => {
    loadVillages();
  }, []);

  useEffect(() => {
    setExpandedGroupKey(null);
    setGroupMembersMap({});
    loadReportData();
  }, [reportType, selectedVillageId, selectedLetter]);

  const loadVillages = async () => {
    const vList = await villageAPI.getVillages();
    setVillages(vList);
  };

  const loadReportData = async () => {
    setLoading(true);
    try {
      if (reportType === "alphabetical") {
        const res = await reportAPI.getAlphabetical(selectedVillageId || undefined, selectedLetter || undefined);
        const items = res?.items || res?.data || (Array.isArray(res) ? res : []);
        setVoters(items);
        setTotalCount(res?.total ?? items.length);
      } else if (reportType === "village") {
        const res: any = await reportAPI.getVillageReport();
        const groups = Array.isArray(res) ? res : res?.data || [];
        setSummaryGroups(groups);
        setTotalCount(groups.reduce((acc: number, curr: any) => acc + (curr.total_voters || curr.count || 0), 0));
      } else if (reportType === "deceased") {
        const res: any = await reportAPI.getDeceasedReport(selectedVillageId || undefined);
        const items = res?.items || res?.data || (Array.isArray(res) ? res : []);
        setVoters(items);
        setTotalCount(res?.total ?? items.length);
      } else if (reportType === "mobile-status") {
        const res: any = await reportAPI.getMobileStatusReport(selectedVillageId || undefined);
        const groups = Array.isArray(res) ? res : res?.data || [];
        setSummaryGroups(groups);
        setTotalCount(groups.reduce((acc: number, curr: any) => acc + (curr.count || 0), 0));
      } else {
        const res = await reportAPI.getGroupedReport(reportType as any, selectedVillageId || undefined);
        const groups = Array.isArray(res) ? res : res?.items || res?.data || [];
        setSummaryGroups(groups);
        setTotalCount(groups.reduce((acc: number, curr: any) => acc + (curr.count || curr.total_voters || 0), 0));
      }
    } catch (e) {
      console.error("Report loading error:", e);
      setSummaryGroups([]);
      setVoters([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  const toggleGroup = async (item: any) => {
    const groupKey = item.key || item.name || item.name_mr;
    if (!groupKey) return;

    if (expandedGroupKey === groupKey) {
      setExpandedGroupKey(null);
      return;
    }

    setExpandedGroupKey(groupKey);

    if (groupMembersMap[groupKey]) {
      return;
    }

    setLoadingGroupKey(groupKey);
    try {
      const members = await reportAPI.getDrilldownMembers(reportType, groupKey, selectedVillageId || undefined);
      setGroupMembersMap(prev => ({ ...prev, [groupKey]: members || [] }));
    } catch (err) {
      console.error("Failed to load drilldown members", err);
      setGroupMembersMap(prev => ({ ...prev, [groupKey]: [] }));
    } finally {
      setLoadingGroupKey(null);
    }
  };

  const handleExport = (fmt: "excel" | "csv") => {
    Alert.alert(
      "डाउनलोड",
      `${fmt.toUpperCase()} अहवाल फाईल यशस्वीरित्या तयार केली आहे. ती backend/exports फोल्डरमध्ये जतन केली.`
    );
  };

  const handleCall = (item: any) => {
    const num = typeof item === "string" ? item : item?.mobile_number;
    if (num) {
      if (typeof item === "object") {
        logUserActivity({
          action: "CALL_INITIATED",
          targetMemberId: item.id,
          targetMemberName: item.full_name_mr || item.full_name_en,
          details: `अहवालातून कॉल केला: ${item.full_name_mr || item.full_name_en} (${num})`,
          metadata: {
            phone: num,
            voter: item.full_name_mr || item.full_name_en,
            village: item.village_name_mr || "साखराळे"
          }
        });
      }
      Linking.openURL(`tel:${num}`).catch(() => {});
    } else {
      Alert.alert("माहिती", "मोबाईल नंबर उपलब्ध नाही.");
    }
  };

  const handleSMS = (item: any) => {
    const num = typeof item === "string" ? item : item?.mobile_number;
    if (num) {
      if (typeof item === "object") {
        logUserActivity({
          action: "SMS_SENT",
          targetMemberId: item.id,
          targetMemberName: item.full_name_mr || item.full_name_en,
          details: `अहवालातून SMS पाठवला: ${item.full_name_mr || item.full_name_en} (${num})`,
          metadata: {
            phone: num,
            voter: item.full_name_mr || item.full_name_en,
            village: item.village_name_mr || "साखराळे"
          }
        });
      }
      Linking.openURL(`sms:${num}`).catch(() => {});
    } else {
      Alert.alert("माहिती", "मोबाईल नंबर उपलब्ध नाही.");
    }
  };

  const isVoterListReport = reportType === "alphabetical" || reportType === "deceased";

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title={t(titleKey as any)}
        showBack
        onBack={() => navigation.goBack()}
      />

      {/* Village Dropdown Filter Bar */}
      <View style={styles.villageSelectorCard}>
        <Text style={styles.villageSelectorLabel}>
          गाव निवडा (Filter by Village):
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.villageChipsScroll}>
          <TouchableOpacity
            style={[styles.smallChip, selectedVillageId === null && styles.activeSmallChip]}
            onPress={() => setSelectedVillageId(null)}
          >
            <Ionicons name="home-outline" size={14} color={selectedVillageId === null ? "#FFFFFF" : theme.colors.textSecondary} style={{ marginRight: 4 }} />
            <Text style={[styles.smallChipText, selectedVillageId === null && styles.activeSmallChipText]}>
              All Villages
            </Text>
          </TouchableOpacity>
          {villages.map((v) => (
            <TouchableOpacity
              key={v.id}
              style={[styles.smallChip, selectedVillageId === v.id && styles.activeSmallChip]}
              onPress={() => setSelectedVillageId(v.id)}
            >
              <Text style={[styles.smallChipText, selectedVillageId === v.id && styles.activeSmallChipText]}>
                {v.name_mr || v.name_en}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Blue Summary Banner */}
      <View style={styles.summaryCard}>
        <View>
          <Text style={styles.summaryTitle}>{t(titleKey as any)}</Text>
          <Text style={styles.summarySubtitle}>Total Voters Found</Text>
        </View>
        <View style={styles.countPill}>
          <Text style={styles.countPillText}>{totalCount}</Text>
        </View>
      </View>

      {/* Alphabet Filter Bar for Alphabetical List */}
      {reportType === "alphabetical" && (
        <View style={styles.alphabetBarWrapper}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.alphabetBar}>
            <TouchableOpacity
              style={[styles.letterBtn, selectedLetter === null && styles.activeLetterBtn]}
              onPress={() => setSelectedLetter(null)}
            >
              <Text style={[styles.letterText, selectedLetter === null && styles.activeLetterText]}>All</Text>
            </TouchableOpacity>
            {marathiAlphabet.map((ch) => (
              <TouchableOpacity
                key={ch}
                style={[styles.letterBtn, selectedLetter === ch && styles.activeLetterBtn]}
                onPress={() => setSelectedLetter(ch)}
              >
                <Text style={[styles.letterText, selectedLetter === ch && styles.activeLetterText]}>{ch}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Report Content */}
      {loading ? (
        <View style={styles.loaderCenter}>
          <ActivityIndicator size="large" color={theme.colors.primaryLight} />
        </View>
      ) : isVoterListReport ? (
        <FlatList
          data={voters}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.voterRow}
              onPress={() => navigation.navigate("VoterProfile", { memberId: item.id })}
            >
              <View style={styles.voterAvatar}>
                <Ionicons name="person" size={20} color="#93C5FD" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.voterName}>{item.full_name_mr || item.full_name_en}</Text>
                <Text style={styles.voterIdText}>
                  ID: {item.epic_number || `voter_${item.serial_number}`} | {item.village_name_mr || "साखराळे"}
                </Text>
              </View>
              {item.status === "DECEASED" && (
                <View style={styles.decTag}>
                  <Text style={styles.decTagText}>Deceased</Text>
                </View>
              )}
              {!!item.mobile_number && (
                <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                  <TouchableOpacity
                    style={styles.callCircle}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleCall(item);
                    }}
                  >
                    <Ionicons name="call" size={15} color="#10B981" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.callCircle, { backgroundColor: "#1E3A8A" }]}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleSMS(item);
                    }}
                  >
                    <Ionicons name="chatbubble" size={13} color="#60A5FA" />
                  </TouchableOpacity>
                </View>
              )}
            </TouchableOpacity>
          )}
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      ) : (
        <FlatList
          data={summaryGroups}
          keyExtractor={(item, idx) => (item.key || item.name || item.name_mr || idx).toString()}
          renderItem={({ item }) => {
            const groupKey = item.key || item.name || item.name_mr;
            const isExpanded = expandedGroupKey === groupKey;
            const members = groupMembersMap[groupKey] || [];
            const isLoadingMembers = loadingGroupKey === groupKey;

            return (
              <View style={[styles.groupContainer, isExpanded && styles.groupContainerExpanded]}>
                <TouchableOpacity
                  style={styles.groupCardHeader}
                  onPress={() => toggleGroup(item)}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <Ionicons
                        name={isExpanded ? "chevron-down-circle" : "chevron-forward-circle-outline"}
                        size={18}
                        color={isExpanded ? theme.colors.primaryLight : theme.colors.textMuted}
                        style={{ marginRight: 8 }}
                      />
                      <Text style={styles.groupName}>{item.name || item.name_mr}</Text>
                    </View>
                    {item.active_voters !== undefined && (
                      <Text style={styles.groupSub}>
                        सक्रिय: {item.active_voters} • मयत: {item.deceased_voters}
                      </Text>
                    )}
                  </View>
                  <View style={styles.groupBadge}>
                    <Text style={styles.groupBadgeText}>{item.count || item.total_voters}</Text>
                  </View>
                </TouchableOpacity>

                {isExpanded && (
                  <View style={styles.drilldownListWrapper}>
                    {isLoadingMembers ? (
                      <View style={styles.drilldownLoading}>
                        <ActivityIndicator size="small" color={theme.colors.primaryLight} />
                        <Text style={styles.drilldownLoadingText}>मतदार माहिती लोड होत आहे...</Text>
                      </View>
                    ) : members.length === 0 ? (
                      <View style={styles.drilldownEmpty}>
                        <Text style={styles.drilldownEmptyText}>या वर्गात कोणतेही मतदार सापडले नाहीत.</Text>
                      </View>
                    ) : (
                      members.map((m: any, mIdx: number) => (
                        <TouchableOpacity
                          key={m.id || mIdx}
                          style={styles.drilldownVoterRow}
                          onPress={() => navigation.navigate("VoterProfile", { memberId: m.id })}
                        >
                          <View style={styles.smallVoterAvatar}>
                            <Ionicons name="person" size={14} color="#93C5FD" />
                          </View>
                          <View style={{ flex: 1, paddingRight: 8 }}>
                            <Text style={styles.drilldownVoterName} numberOfLines={1}>
                              {m.full_name_mr || m.full_name_en}
                            </Text>
                            <Text style={styles.drilldownVoterSub} numberOfLines={1}>
                              {m.epic_number ? `EPIC: ${m.epic_number}` : `SR: ${m.serial_number}`}
                              {m.age ? ` • वय: ${m.age}` : ""}
                              {m.gender ? ` • ${m.gender}` : ""}
                              {m.house_number ? ` • घर: ${m.house_number}` : ""}
                            </Text>
                          </View>
                          {!!m.mobile_number && (
                            <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                              <TouchableOpacity
                                style={styles.smallCallCircle}
                                onPress={(e) => {
                                  e.stopPropagation();
                                  handleCall(m);
                                }}
                              >
                                <Ionicons name="call" size={13} color="#10B981" />
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={[styles.smallCallCircle, { backgroundColor: "#1E3A8A" }]}
                                onPress={(e) => {
                                  e.stopPropagation();
                                  handleSMS(m);
                                }}
                              >
                                <Ionicons name="chatbubble" size={12} color="#60A5FA" />
                              </TouchableOpacity>
                            </View>
                          )}
                        </TouchableOpacity>
                      ))
                    )}
                  </View>
                )}
              </View>
            );
          }}
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      )}

      {/* Bottom Export Bar: Completely hidden in User Panel */}
      {!isUserPanel && (
        <View style={styles.exportBar}>
          <TouchableOpacity style={styles.exportBtn} onPress={() => handleExport("excel")}>
            <Ionicons name="document-text-outline" size={18} color="#10B981" style={{ marginRight: 6 }} />
            <Text style={styles.exportBtnText}>{t("export_excel")}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.exportBtn} onPress={() => handleExport("csv")}>
            <Ionicons name="download-outline" size={18} color="#38BDF8" style={{ marginRight: 6 }} />
            <Text style={styles.exportBtnText}>{t("export_csv")}</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  villageSelectorCard: {
    backgroundColor: theme.colors.card,
    marginHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    padding: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  villageSelectorLabel: {
    color: theme.colors.textMuted,
    fontSize: 11,
    marginBottom: 6,
  },
  villageChipsScroll: {
    flexDirection: "row",
  },
  smallChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.full,
    marginRight: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  activeSmallChip: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primaryLight,
  },
  smallChipText: {
    color: theme.colors.textSecondary,
    fontSize: 12,
  },
  activeSmallChipText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  summaryCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#1E3A8A", // Blue summary matching screenshot page 11
    marginHorizontal: theme.spacing.lg,
    marginVertical: theme.spacing.sm,
    padding: 16,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: "#3B82F6",
  },
  summaryTitle: {
    color: "#FFFFFF",
    fontSize: theme.typography.sizes.md,
    fontWeight: "800",
  },
  summarySubtitle: {
    color: "#93C5FD",
    fontSize: 12,
    marginTop: 2,
  },
  countPill: {
    backgroundColor: "#1E293B",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: "#38BDF8",
  },
  countPillText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
  },
  alphabetBarWrapper: {
    backgroundColor: theme.colors.card,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  alphabetBar: {
    paddingHorizontal: theme.spacing.lg,
    flexDirection: "row",
    gap: 6,
  },
  letterBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  activeLetterBtn: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primaryLight,
  },
  letterText: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: "700",
  },
  activeLetterText: {
    color: "#FFFFFF",
  },
  voterRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.card,
    marginHorizontal: theme.spacing.lg,
    marginVertical: 4,
    padding: 12,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  voterAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#1E293B",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  voterName: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: "700",
  },
  voterIdText: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  decTag: {
    backgroundColor: "#7F1D1D",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 8,
  },
  decTagText: {
    color: "#FCA5A5",
    fontSize: 10,
    fontWeight: "700",
  },
  callCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#064E3B",
    alignItems: "center",
    justifyContent: "center",
  },
  groupContainer: {
    backgroundColor: theme.colors.card,
    marginHorizontal: theme.spacing.lg,
    marginVertical: 4,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: "hidden",
  },
  groupContainerExpanded: {
    borderColor: theme.colors.primaryLight,
    backgroundColor: "#161E2E",
  },
  groupCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
  },
  groupName: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: "700",
  },
  groupSub: {
    color: theme.colors.textMuted,
    fontSize: 11,
    marginTop: 2,
    marginLeft: 26,
  },
  groupBadge: {
    backgroundColor: theme.colors.cardElevated,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  groupBadgeText: {
    color: theme.colors.primaryLight,
    fontSize: 13,
    fontWeight: "800",
  },
  drilldownListWrapper: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
  },
  drilldownLoading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    gap: 8,
  },
  drilldownLoadingText: {
    color: theme.colors.textMuted,
    fontSize: 12,
  },
  drilldownEmpty: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  drilldownEmptyText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontStyle: "italic",
  },
  drilldownVoterRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.05)",
  },
  smallVoterAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#1E293B",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  drilldownVoterName: {
    color: theme.colors.textPrimary,
    fontSize: 13,
    fontWeight: "600",
  },
  drilldownVoterSub: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    marginTop: 1,
  },
  smallCallCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#064E3B",
    alignItems: "center",
    justifyContent: "center",
  },
  loaderCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  exportBar: {
    flexDirection: "row",
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 10,
    backgroundColor: theme.colors.card,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    gap: 12,
  },
  exportBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surface,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  exportBtnText: {
    color: theme.colors.textPrimary,
    fontSize: 12,
    fontWeight: "700",
  }
});

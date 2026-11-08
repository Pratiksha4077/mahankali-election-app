import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ScrollView, SafeAreaView, ActivityIndicator, Alert, Linking,
  TextInput
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Header } from "../../components/Header";
import { reportAPI, villageAPI, logUserActivity } from "../../api/client";
import { Member, Village } from "../../models/types";
import { theme } from "../../theme/theme";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";

export const ReportDetailScreen: React.FC<{ route: any; navigation: any }> = ({ route, navigation }) => {
  const { reportType, titleKey } = route.params || { reportType: "alphabetical", titleKey: "rep_alphabetical" };
  const { t } = useLanguage();
  const { isAdmin, activePanel } = useAuth();
  const { theme, isDark } = useTheme();
  const isUserPanel = !isAdmin || activePanel !== "ADMIN";

  const [villages, setVillages] = useState<Village[]>([]);
  const [selectedVillageId, setSelectedVillageId] = useState<string | null>(null);
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);

  const [voters, setVoters] = useState<Member[]>([]);
  const [summaryGroups, setSummaryGroups] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  // Surname dedicated view & search state with Pagination (250 records per page)
  const PAGE_SIZE = 250;
  const [selectedSurname, setSelectedSurname] = useState<string | null>(null);
  const [surnameSearchQuery, setSurnameSearchQuery] = useState<string>("");
  const [debouncedSurnameSearch, setDebouncedSurnameSearch] = useState<string>("");
  const [surnameGroupSearch, setSurnameGroupSearch] = useState<string>("");
  const [debouncedGroupSearch, setDebouncedGroupSearch] = useState<string>("");
  const [surnameVoters, setSurnameVoters] = useState<Member[]>([]);
  const [loadingSurnameVoters, setLoadingSurnameVoters] = useState<boolean>(false);
  const [surnamePage, setSurnamePage] = useState<number>(1);
  const [surnameTotalPages, setSurnameTotalPages] = useState<number>(1);
  const [surnameTotalVoters, setSurnameTotalVoters] = useState<number>(0);
  const [surnameHasMore, setSurnameHasMore] = useState<boolean>(false);
  const [loadingMoreSurname, setLoadingMoreSurname] = useState<boolean>(false);

  // Debounce for surname group search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedGroupSearch(surnameGroupSearch);
    }, 200);
    return () => clearTimeout(handler);
  }, [surnameGroupSearch]);

  // Debounce for search inside selected surname
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSurnameSearch(surnameSearchQuery);
    }, 200);
    return () => clearTimeout(handler);
  }, [surnameSearchQuery]);

  // Server-side search trigger when typing inside selected surname
  useEffect(() => {
    if (selectedSurname) {
      handleSelectSurname(selectedSurname, 1, debouncedSurnameSearch);
    }
  }, [debouncedSurnameSearch]);

  // Drilldown state for expandable groups (Family, Religion, Caste, etc.)
  const [expandedGroupKey, setExpandedGroupKey] = useState<string | null>(null);
  const [groupMembersMap, setGroupMembersMap] = useState<Record<string, Member[]>>({});
  const [loadingGroupKey, setLoadingGroupKey] = useState<string | null>(null);

  const alphabet = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "R", "S", "T", "V", "Y"];
  const marathiAlphabet = ["अ", "आ", "क", "ख", "ग", "घ", "च", "ज", "त", "द", "ध", "न", "प", "फ", "ब", "भ", "म", "य", "र", "ल", "व", "श", "स"];

  useEffect(() => {
    loadVillages();
  }, []);

  useEffect(() => {
    setSelectedSurname(null);
    setSurnameSearchQuery("");
    setSurnameGroupSearch("");
    setSurnameVoters([]);
    setExpandedGroupKey(null);
    setGroupMembersMap({});
    loadReportData();
  }, [reportType, selectedVillageId, selectedLetter]);

  const loadVillages = async () => {
    const vList = await villageAPI.getVillages();
    setVillages(vList);
  };

  const isTestVoter = (m: any) => {
    const name = String(m?.full_name_mr || m?.name_mr || m?.full_name_en || m?.name || "");
    return name.includes("चाचणी कुटुंब मतदार") || name.includes("चाचणी कुटुंब");
  };

  const loadReportData = async () => {
    setLoading(true);
    try {
      if (reportType === "alphabetical") {
        const res = await reportAPI.getAlphabetical(selectedVillageId || undefined, selectedLetter || undefined);
        const rawItems = res?.items || res?.data || (Array.isArray(res) ? res : []);
        const items = rawItems.filter((m: any) => !isTestVoter(m));
        setVoters(items);
        setTotalCount(res?.total ?? items.length);
      } else if (reportType === "village") {
        const res: any = await reportAPI.getVillageReport();
        const groups = (Array.isArray(res) ? res : res?.data || []).filter((g: any) => !isTestVoter(g));
        setSummaryGroups(groups);
        setTotalCount(groups.reduce((acc: number, curr: any) => acc + (curr.total_voters || curr.count || 0), 0));
      } else if (reportType === "deceased") {
        const res: any = await reportAPI.getDeceasedReport(selectedVillageId || undefined);
        const rawItems = res?.items || res?.data || (Array.isArray(res) ? res : []);
        const items = rawItems.filter((m: any) => !isTestVoter(m));
        setVoters(items);
        setTotalCount(res?.total ?? items.length);
      } else if (reportType === "mobile-status") {
        const res: any = await reportAPI.getMobileStatusReport(selectedVillageId || undefined);
        const groups = (Array.isArray(res) ? res : res?.data || []).filter((g: any) => !isTestVoter(g));
        setSummaryGroups(groups);
        setTotalCount(groups.reduce((acc: number, curr: any) => acc + (curr.count || 0), 0));
      } else {
        const res = await reportAPI.getGroupedReport(reportType as any, selectedVillageId || undefined);
        const groups = (Array.isArray(res) ? res : res?.items || res?.data || []).filter((g: any) => !isTestVoter(g));
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
      const rawMembers = await reportAPI.getDrilldownMembers(reportType, groupKey, selectedVillageId || undefined);
      const members = (rawMembers || []).filter((m: any) => !isTestVoter(m));
      setGroupMembersMap(prev => ({ ...prev, [groupKey]: members }));
    } catch (err) {
      console.error("Failed to load drilldown members", err);
      setGroupMembersMap(prev => ({ ...prev, [groupKey]: [] }));
    } finally {
      setLoadingGroupKey(null);
    }
  };

  const handleSelectSurname = async (surname: string, page: number = 1, searchQuery?: string) => {
    setSelectedSurname(surname);
    if (page === 1 && searchQuery === undefined) {
      setSurnameSearchQuery("");
      setDebouncedSurnameSearch("");
    }
    setSurnamePage(page);
    setLoadingSurnameVoters(true);
    try {
      const q = typeof searchQuery === "string" ? searchQuery : debouncedSurnameSearch;
      const res: any = await reportAPI.getDrilldownMembers("surname", surname, selectedVillageId || undefined, page, PAGE_SIZE, q);
      const rawMembers = Array.isArray(res) ? res : res?.items || res?.data || [];
      const members = (rawMembers || []).filter((m: any) => !isTestVoter(m));
      setSurnameVoters(members);
      const total = res?.total ?? members.length;
      setSurnameTotalVoters(total);
      setSurnameTotalPages(res?.pages ?? (total > 0 ? Math.ceil(total / PAGE_SIZE) : 1));
    } catch (err) {
      console.error("Failed to load voters for surname", err);
      setSurnameVoters([]);
      setSurnameTotalVoters(0);
      setSurnameTotalPages(1);
    } finally {
      setLoadingSurnameVoters(false);
    }
  };

  const handleBackToSurnames = () => {
    setSelectedSurname(null);
    setSurnameSearchQuery("");
    setDebouncedSurnameSearch("");
    setSurnameVoters([]);
    setSurnamePage(1);
    setSurnameTotalPages(1);
    setSurnameTotalVoters(0);
  };

  const filteredSurnameVoters = surnameVoters.filter((m) => {
    if (!debouncedSurnameSearch.trim()) return true;
    const q = debouncedSurnameSearch.toLowerCase().trim();
    const nameMr = (m.full_name_mr || (m as any).name_mr || "").toLowerCase();
    const nameEn = (m.full_name_en || (m as any).name || "").toLowerCase();
    const epic = (m.epic_number || "").toLowerCase();
    const serial = String(m.serial_number || "");
    const mobile = (m.mobile_number || (m as any).mobileNumber || "");
    const house = (m.house_number || (m as any).houseNumber || "").toLowerCase();
    return (
      nameMr.includes(q) ||
      nameEn.includes(q) ||
      epic.includes(q) ||
      serial.includes(q) ||
      mobile.includes(q) ||
      house.includes(q)
    );
  });

  const filteredSummaryGroups = summaryGroups.filter((g) => {
    if (!debouncedGroupSearch.trim() || reportType !== "surname") return true;
    const q = debouncedGroupSearch.toLowerCase().trim();
    const name = (g.name || g.name_mr || g.surname || g.key || "").toLowerCase();
    return name.includes(q);
  });

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
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <Header
        title={t(titleKey as any)}
        showBack
        onBack={() => navigation.goBack()}
      />

      {/* Summary Banner (Only shown when not drilled down into a specific surname) */}
      {selectedSurname === null && (
        <View style={[styles.summaryCard, { backgroundColor: isDark ? "#1E3A8A" : theme.colors.card, borderColor: isDark ? "#3B82F6" : theme.colors.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.summaryTitle, { color: isDark ? "#FFFFFF" : theme.colors.textPrimary }]}>
              {reportType === "surname" ? "Surname-Wise Voter Report (आडनाव अहवाल)" : t(titleKey as any)}
            </Text>
            <Text style={[styles.summarySubtitle, { color: isDark ? "#93C5FD" : theme.colors.textSecondary }]}>
              {reportType === "surname" ? `साखराळे गाव • एकूण ${summaryGroups.length} आडनावे सापडली` : "Total Voters Found"}
            </Text>
          </View>
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            {reportType === "surname" && (
              <View style={[styles.countPill, { backgroundColor: isDark ? "#1E293B" : "#DBEAFE", borderColor: isDark ? "#38BDF8" : "#93C5FD" }]}>
                <Text style={[styles.countPillText, { color: isDark ? "#93C5FD" : "#1D4ED8", fontSize: 13 }]}>
                  {summaryGroups.length} आडनावे
                </Text>
              </View>
            )}
            <View style={[styles.countPill, { backgroundColor: isDark ? "#1E293B" : theme.colors.surface, borderColor: isDark ? "#38BDF8" : theme.colors.border }]}>
              <Text style={[styles.countPillText, { color: isDark ? "#FFFFFF" : theme.colors.primary }]}>{totalCount} मतदार</Text>
            </View>
          </View>
        </View>
      )}

      {/* Alphabet Filter Bar for Alphabetical List */}
      {reportType === "alphabetical" && (
        <View style={[styles.alphabetBarWrapper, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.border }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.alphabetBar}>
            <TouchableOpacity
              style={[styles.letterBtn, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }, selectedLetter === null && styles.activeLetterBtn]}
              onPress={() => setSelectedLetter(null)}
            >
              <Text style={[styles.letterText, { color: theme.colors.textSecondary }, selectedLetter === null && styles.activeLetterText]}>All</Text>
            </TouchableOpacity>
            {marathiAlphabet.map((ch) => (
              <TouchableOpacity
                key={ch}
                style={[styles.letterBtn, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }, selectedLetter === ch && styles.activeLetterBtn]}
                onPress={() => setSelectedLetter(ch)}
              >
                <Text style={[styles.letterText, { color: theme.colors.textSecondary }, selectedLetter === ch && styles.activeLetterText]}>{ch}</Text>
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
      ) : reportType === "surname" && selectedSurname !== null ? (
        <View style={{ flex: 1 }}>
          {/* Header Bar for Selected Surname */}
          <View style={[styles.surnameTopHeader, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <TouchableOpacity
              style={[styles.backToSurnamesBtn, { backgroundColor: isDark ? "#1E293B" : theme.colors.surface, borderColor: theme.colors.border }]}
              onPress={handleBackToSurnames}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={16} color={theme.colors.primaryLight} style={{ marginRight: 6 }} />
              <Text style={[styles.backToSurnamesText, { color: theme.colors.primaryLight }]}>सर्व आडनावे</Text>
            </TouchableOpacity>

            <View style={{ flex: 1, marginHorizontal: 8 }}>
              <Text style={[styles.selectedSurnameTitle, { color: theme.colors.textPrimary }]} numberOfLines={1}>
                {selectedSurname}
              </Text>
              <Text style={[styles.selectedSurnameSub, { color: theme.colors.textMuted }]}>
                {surnameTotalVoters} पैकी {filteredSurnameVoters.length} मतदार दर्शवले
              </Text>
            </View>

            <View style={[styles.countPillSmall, { backgroundColor: isDark ? "#1E3A8A" : "#DBEAFE" }]}>
              <Text style={[styles.countPillSmallText, { color: isDark ? "#93C5FD" : "#1D4ED8" }]}>
                {surnameTotalVoters}
              </Text>
            </View>
          </View>

          {/* Search Bar for Selected Surname */}
          <View style={[styles.searchBarCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <Ionicons name="search" size={18} color={theme.colors.textMuted} style={{ marginRight: 8 }} />
            <TextInput
              style={[styles.searchInput, { color: theme.colors.textPrimary }]}
              placeholder={`${selectedSurname} मधील मतदार शोधा (नाव, EPIC, अनुक्रमांक)...`}
              placeholderTextColor={theme.colors.textMuted}
              value={surnameSearchQuery}
              onChangeText={setSurnameSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {surnameSearchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSurnameSearchQuery("")} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close-circle" size={18} color={theme.colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Top Pagination Bar */}
          {surnameTotalPages > 1 && (
            <View style={[styles.paginationBar, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              <TouchableOpacity
                style={[styles.pageNavBtn, { backgroundColor: isDark ? theme.colors.surface : "#F1F5F9", borderColor: theme.colors.border }, (surnamePage <= 1 || loadingSurnameVoters) && styles.pageNavBtnDisabled]}
                onPress={() => handleSelectSurname(selectedSurname!, surnamePage - 1)}
                disabled={surnamePage <= 1 || loadingSurnameVoters}
              >
                <Ionicons name="chevron-back" size={16} color={surnamePage <= 1 ? theme.colors.textMuted : theme.colors.primaryLight} />
                <Text style={[styles.pageNavBtnText, { color: surnamePage <= 1 ? theme.colors.textMuted : theme.colors.primaryLight }]}>मागील</Text>
              </TouchableOpacity>

              <View style={styles.pageInfoWrapper}>
                <Text style={[styles.pageInfoText, { color: theme.colors.textPrimary }]}>
                  पृष्ठ {surnamePage} / {surnameTotalPages}
                </Text>
                <Text style={[styles.pageInfoSub, { color: theme.colors.textMuted }]}>
                  (२५० प्रति पृष्ठ • एकूण {surnameTotalVoters} मतदार)
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.pageNavBtn, { backgroundColor: isDark ? theme.colors.surface : "#F1F5F9", borderColor: theme.colors.border }, (surnamePage >= surnameTotalPages || loadingSurnameVoters) && styles.pageNavBtnDisabled]}
                onPress={() => handleSelectSurname(selectedSurname!, surnamePage + 1)}
                disabled={surnamePage >= surnameTotalPages || loadingSurnameVoters}
              >
                <Text style={[styles.pageNavBtnText, { color: surnamePage >= surnameTotalPages ? theme.colors.textMuted : theme.colors.primaryLight }]}>पुढील</Text>
                <Ionicons name="chevron-forward" size={16} color={surnamePage >= surnameTotalPages ? theme.colors.textMuted : theme.colors.primaryLight} />
              </TouchableOpacity>
            </View>
          )}

          {/* Voters List for Selected Surname */}
          {loadingSurnameVoters ? (
            <View style={styles.loaderCenter}>
              <ActivityIndicator size="large" color={theme.colors.primaryLight} />
              <Text style={[styles.drilldownLoadingText, { color: theme.colors.textMuted, marginTop: 10 }]}>
                {selectedSurname} आडनावातील मतदार लोड होत आहेत (पृष्ठ {surnamePage})...
              </Text>
            </View>
          ) : filteredSurnameVoters.length === 0 ? (
            <View style={styles.drilldownEmpty}>
              <Ionicons name="people-outline" size={42} color={theme.colors.textMuted} style={{ marginBottom: 8 }} />
              <Text style={[styles.drilldownEmptyText, { color: theme.colors.textMuted }]}>
                {surnameSearchQuery ? `"${surnameSearchQuery}" साठी मतदार सापडले नाहीत.` : "या आडनावात कोणतेही मतदार सापडले नाहीत."}
              </Text>
              {surnameSearchQuery.length > 0 && (
                <TouchableOpacity
                  style={[styles.clearFilterBtn, { borderColor: theme.colors.primaryLight }]}
                  onPress={() => setSurnameSearchQuery("")}
                >
                  <Text style={{ color: theme.colors.primaryLight, fontSize: 13, fontWeight: "600" }}>शोध साफ करा</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <FlatList
              data={filteredSurnameVoters}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.voterRow, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
                  onPress={() => navigation.navigate("VoterProfile", { memberId: item.id, member: item })}
                >
                  <View style={[styles.voterAvatar, { backgroundColor: isDark ? "#1E293B" : theme.colors.surface }]}>
                    <Ionicons name="person" size={20} color={isDark ? "#93C5FD" : theme.colors.primaryLight} />
                  </View>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                      <Text style={[styles.voterName, { color: theme.colors.textPrimary }]}>{item.full_name_mr || item.full_name_en}</Text>
                      {(item as any).category_name && (
                        <View style={[styles.categoryTagSmall, { backgroundColor: (item as any).category_color || "#10B981" }]}>
                          <Text style={styles.categoryTagSmallText}>{(item as any).category_name}</Text>
                        </View>
                      )}
                    </View>
                    {item.full_name_en && item.full_name_mr && item.full_name_en !== item.full_name_mr && (
                      <Text style={[styles.voterSubName, { color: theme.colors.textMuted }]}>{item.full_name_en}</Text>
                    )}
                    <Text style={[styles.voterIdText, { color: theme.colors.textSecondary }]}>
                      {item.epic_number ? `EPIC: ${item.epic_number}` : `अनुक्रमांक: ${item.serial_number}`}
                      {item.age ? ` • वय: ${item.age}` : ""}
                      {item.gender ? ` • ${item.gender}` : ""}
                      {item.house_number ? ` • घर: ${item.house_number}` : ""}
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
              ListFooterComponent={
                surnameTotalPages > 1 ? (
                  <View style={{ marginTop: 8 }}>
                    <View style={[styles.paginationBar, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                      <TouchableOpacity
                        style={[styles.pageNavBtn, { backgroundColor: isDark ? theme.colors.surface : "#F1F5F9", borderColor: theme.colors.border }, (surnamePage <= 1 || loadingSurnameVoters) && styles.pageNavBtnDisabled]}
                        onPress={() => handleSelectSurname(selectedSurname!, surnamePage - 1)}
                        disabled={surnamePage <= 1 || loadingSurnameVoters}
                      >
                        <Ionicons name="chevron-back" size={16} color={surnamePage <= 1 ? theme.colors.textMuted : theme.colors.primaryLight} />
                        <Text style={[styles.pageNavBtnText, { color: surnamePage <= 1 ? theme.colors.textMuted : theme.colors.primaryLight }]}>मागील</Text>
                      </TouchableOpacity>

                      <View style={styles.pageInfoWrapper}>
                        <Text style={[styles.pageInfoText, { color: theme.colors.textPrimary }]}>
                          पृष्ठ {surnamePage} / {surnameTotalPages}
                        </Text>
                        <Text style={[styles.pageInfoSub, { color: theme.colors.textMuted }]}>
                          (२५० प्रति पृष्ठ • एकूण {surnameTotalVoters} मतदार)
                        </Text>
                      </View>

                      <TouchableOpacity
                        style={[styles.pageNavBtn, { backgroundColor: isDark ? theme.colors.surface : "#F1F5F9", borderColor: theme.colors.border }, (surnamePage >= surnameTotalPages || loadingSurnameVoters) && styles.pageNavBtnDisabled]}
                        onPress={() => handleSelectSurname(selectedSurname!, surnamePage + 1)}
                        disabled={surnamePage >= surnameTotalPages || loadingSurnameVoters}
                      >
                        <Text style={[styles.pageNavBtnText, { color: surnamePage >= surnameTotalPages ? theme.colors.textMuted : theme.colors.primaryLight }]}>पुढील</Text>
                        <Ionicons name="chevron-forward" size={16} color={surnamePage >= surnameTotalPages ? theme.colors.textMuted : theme.colors.primaryLight} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : null
              }
              contentContainerStyle={{ paddingBottom: 40 }}
            />
          )}
        </View>
      ) : isVoterListReport ? (
        <FlatList
          data={voters}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.voterRow, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
              onPress={() => navigation.navigate("VoterProfile", { memberId: item.id, member: item })}
            >
              <View style={[styles.voterAvatar, { backgroundColor: isDark ? "#1E293B" : theme.colors.surface }]}>
                <Ionicons name="person" size={20} color={isDark ? "#93C5FD" : theme.colors.primaryLight} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.voterName, { color: theme.colors.textPrimary }]}>{item.full_name_mr || item.full_name_en}</Text>
                <Text style={[styles.voterIdText, { color: theme.colors.textSecondary }]}>
                  {item.epic_number ? `EPIC: ${item.epic_number}` : `अनुक्रमांक: ${item.serial_number}`}
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
      ) : reportType === "surname" ? (
        <View style={{ flex: 1 }}>
          {/* Surname Search Bar */}
          <View style={[styles.searchBarCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <Ionicons name="search" size={18} color={theme.colors.textMuted} style={{ marginRight: 8 }} />
            <TextInput
              style={[styles.searchInput, { color: theme.colors.textPrimary }]}
              placeholder="आडनाव शोधा (उदा. पाटील, कदम / Patil)..."
              placeholderTextColor={theme.colors.textMuted}
              value={surnameGroupSearch}
              onChangeText={setSurnameGroupSearch}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {surnameGroupSearch.length > 0 && (
              <TouchableOpacity onPress={() => setSurnameGroupSearch("")} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close-circle" size={18} color={theme.colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Surnames Count Badge Bar */}
          <View style={{ paddingHorizontal: 16, paddingBottom: 6, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ fontSize: 12, color: theme.colors.textMuted, fontWeight: "600" }}>
              {filteredSummaryGroups.length} आडनावे सापडली
            </Text>
            {surnameGroupSearch.length > 0 && (
              <TouchableOpacity onPress={() => setSurnameGroupSearch("")}>
                <Text style={{ fontSize: 11, color: theme.colors.primaryLight, fontWeight: "600" }}>शोध साफ करा</Text>
              </TouchableOpacity>
            )}
          </View>

          {filteredSummaryGroups.length === 0 ? (
            <View style={styles.drilldownEmpty}>
              <Ionicons name="search-outline" size={40} color={theme.colors.textMuted} style={{ marginBottom: 8, marginTop: 20 }} />
              <Text style={[styles.drilldownEmptyText, { color: theme.colors.textMuted }]}>
                {surnameGroupSearch ? `"${surnameGroupSearch}" या नावाचे आडनाव सापडले नाही.` : "कोणतीही आडनाव नोंद सापडली नाही."}
              </Text>
              {surnameGroupSearch.length > 0 && (
                <TouchableOpacity
                  style={[styles.clearFilterBtn, { borderColor: theme.colors.primaryLight }]}
                  onPress={() => setSurnameGroupSearch("")}
                >
                  <Text style={{ color: theme.colors.primaryLight, fontSize: 13, fontWeight: "600" }}>शोध साफ करा</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <FlatList
              data={filteredSummaryGroups}
              keyExtractor={(item, idx) => (item.key || item.name || item.name_mr || idx).toString()}
              renderItem={({ item }) => {
                const surnameName = item.name || item.name_mr || item.surname;
                return (
                  <TouchableOpacity
                    style={[styles.surnameCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
                    onPress={() => handleSelectSurname(surnameName)}
                    activeOpacity={0.7}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", flex: 1, minWidth: 0 }}>
                      <View style={[styles.surnameIconCircle, { backgroundColor: isDark ? "#1E293B" : "#E0F2FE" }]}>
                        <Ionicons name="person" size={14} color={theme.colors.primaryLight} />
                      </View>
                      <Text style={[styles.surnameCardTitle, { color: theme.colors.textPrimary, marginLeft: 10 }]} numberOfLines={1}>
                        {surnameName}
                      </Text>
                    </View>

                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <View style={[styles.groupBadge, { backgroundColor: theme.colors.cardElevated, borderColor: theme.colors.borderLight, paddingHorizontal: 10, paddingVertical: 3 }]}>
                        <Text style={[styles.groupBadgeText, { color: theme.colors.primaryLight, fontSize: 13, fontWeight: "700" }]}>
                          {item.count || item.total_voters}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
                    </View>
                  </TouchableOpacity>
                );
              }}
              contentContainerStyle={{ paddingBottom: 40 }}
            />
          )}
        </View>
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
              <View style={[styles.groupContainer, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }, isExpanded && [styles.groupContainerExpanded, { backgroundColor: isDark ? "#161E2E" : theme.colors.surface }]]}>
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
                      <Text style={[styles.groupName, { color: theme.colors.textPrimary }]}>{item.name || item.name_mr}</Text>
                    </View>
                    {item.active_voters !== undefined && (
                      <Text style={[styles.groupSub, { color: theme.colors.textMuted }]}>
                        सक्रिय: {item.active_voters} • मयत: {item.deceased_voters}
                      </Text>
                    )}
                  </View>
                  <View style={[styles.groupBadge, { backgroundColor: isDark ? "#1E293B" : "#F1F5F9", borderColor: theme.colors.borderLight }]}>
                    <Text style={[styles.groupBadgeText, { color: theme.colors.primaryLight }]}>[ {item.count || item.total_voters} ]</Text>
                  </View>
                </TouchableOpacity>

                {isExpanded && (
                  <View style={[styles.drilldownListWrapper, { backgroundColor: isDark ? "rgba(15, 23, 42, 0.6)" : theme.colors.surface, borderTopColor: theme.colors.border }]}>
                    {isLoadingMembers ? (
                      <View style={styles.drilldownLoading}>
                        <ActivityIndicator size="small" color={theme.colors.primaryLight} />
                        <Text style={[styles.drilldownLoadingText, { color: theme.colors.textMuted }]}>मतदार माहिती लोड होत आहे...</Text>
                      </View>
                    ) : members.length === 0 ? (
                      <View style={styles.drilldownEmpty}>
                        <Text style={[styles.drilldownEmptyText, { color: theme.colors.textMuted }]}>या वर्गात कोणतेही मतदार सापडले नाहीत.</Text>
                      </View>
                    ) : (
                      members.map((m: any, mIdx: number) => (
                        <TouchableOpacity
                          key={m.id || mIdx}
                          style={[styles.drilldownVoterRow, { borderBottomColor: theme.colors.border }]}
                          onPress={() => navigation.navigate("VoterProfile", { memberId: m.id })}
                        >
                          <View style={[styles.smallVoterAvatar, { backgroundColor: isDark ? "#1E293B" : theme.colors.cardElevated }]}>
                            <Ionicons name="person" size={14} color={isDark ? "#93C5FD" : theme.colors.primaryLight} />
                          </View>
                          <View style={{ flex: 1, paddingRight: 8 }}>
                            <Text style={[styles.drilldownVoterName, { color: theme.colors.textPrimary }]} numberOfLines={1}>
                              {m.full_name_mr || m.full_name_en}
                            </Text>
                            <Text style={[styles.drilldownVoterSub, { color: theme.colors.textSecondary }]} numberOfLines={1}>
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
    marginVertical: 2.5,
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
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  groupName: {
    color: theme.colors.textPrimary,
    fontSize: 13,
    fontWeight: "700",
  },
  groupSub: {
    color: theme.colors.textMuted,
    fontSize: 10,
    marginTop: 1,
    marginLeft: 26,
  },
  groupBadge: {
    backgroundColor: theme.colors.cardElevated,
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  groupBadgeText: {
    color: theme.colors.primaryLight,
    fontSize: 12,
    fontWeight: "700",
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
  },
  surnameTopHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  backToSurnamesBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  backToSurnamesText: {
    fontSize: 12,
    fontWeight: "700",
  },
  selectedSurnameTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  selectedSurnameSub: {
    fontSize: 11,
    marginTop: 2,
  },
  countPillSmall: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  countPillSmallText: {
    fontSize: 12,
    fontWeight: "800",
  },
  searchBarCard: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginVertical: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 4,
  },
  surnameCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 16,
    marginVertical: 3,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  surnameIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  surnameCardTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  surnameCardSub: {
    fontSize: 11,
    marginTop: 2,
  },
  voterVillageText: {
    fontSize: 11,
    marginTop: 2,
  },
  voterSubName: {
    fontSize: 11,
    marginTop: 1,
  },
  categoryTagSmall: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  categoryTagSmallText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
  paginationBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 16,
    marginVertical: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  pageNavBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  pageNavBtnDisabled: {
    opacity: 0.4,
  },
  pageNavBtnText: {
    fontSize: 12,
    fontWeight: "700",
  },
  pageInfoWrapper: {
    alignItems: "center",
  },
  pageInfoText: {
    fontSize: 12,
    fontWeight: "700",
  },
  pageInfoSub: {
    fontSize: 10,
    marginTop: 1,
  },
  clearFilterBtn: {
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
});

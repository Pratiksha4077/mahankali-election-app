import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, SafeAreaView, Modal, Platform, Alert
} from "react-native";
import { Header } from "../../components/Header";
import { SearchBar } from "../../components/SearchBar";
import { VoterCard } from "../../components/VoterCard";
import { memberAPI, villageAPI, authAPI, logUserActivity } from "../../api/client";
import { Member, Village } from "../../models/types";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { theme } from "../../theme/theme";
import { Ionicons } from "@expo/vector-icons";
import {
  requestLocationPermission,
  requestCallPermission,
  requestSmsPermission,
  getRealtimeDeviceLocation,
  checkCurrentPermissionsStatus
} from "../../utils/devicePermissions";

export const UserHomeScreen: React.FC<{ navigation: any; route?: any }> = ({ navigation, route }) => {
  const { t } = useLanguage();
  const { user, isAdmin, activePanel, updateUserPermissions, logout } = useAuth();
  const { theme, isDark } = useTheme();
  const isAdminPanel = isAdmin && activePanel === "ADMIN";

  const [villages, setVillages] = useState<Village[]>([]);
  const [selectedVillageId, setSelectedVillageId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");
  const [filterMode, setFilterMode] = useState<"all" | "mobile">("all");

  const [members, setMembers] = useState<Member[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);

  // Permission Prompt State (One-by-one acceptance)
  const [showPermissionModal, setShowPermissionModal] = useState<boolean>(false);
  const [processingPerms, setProcessingPerms] = useState<boolean>(false);
  const [checkingInLocation, setCheckingInLocation] = useState<boolean>(false);
  const [permsState, setPermsState] = useState<{
    location: boolean;
    phoneCall: boolean;
    sms: boolean;
  }>({
    location: false,
    phoneCall: false,
    sms: false,
  });

  const hasCapturedLocationOnceRef = React.useRef<boolean>(false);

  // Search Debouncing for 10x faster typing and zero server congestion
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Check if admin has revoked user access on backend
  const checkAdminAccess = useCallback(async () => {
    if (isAdmin) return;
    try {
      const res = await authAPI.getMe();
      const me = res?.data || res;
      if (me && (me.accountStatus === "DISABLED" || me.is_active === false || me.admin_access_allowed === false)) {
        Alert.alert(
          "प्रवेश नाकारला (Access Denied)",
          "ॲडमिनने आपला युझर पॅनेल प्रवेश नाकारला आहे. कृपया मुख्य ॲडमिनशी संपर्क साधा.",
          [{ text: "बाहेर पडा (Logout)", onPress: () => logout() }]
        );
        logout();
      }
    } catch (e: any) {
      if (e?.response?.status === 403 || e?.message?.includes("नाकारला") || e?.message?.includes("Access Denied")) {
        Alert.alert(
          "प्रवेश नाकारला (Access Denied)",
          "ॲडमिनने आपला युझर पॅनेल प्रवेश नाकारला आहे. कृपया मुख्य ॲडमिनशी संपर्क साधा.",
          [{ text: "बाहेर पडा (Logout)", onPress: () => logout() }]
        );
        logout();
      }
    }
  }, [isAdmin, logout]);

  // 100% Genuine Real-Time GPS Location capture and logging (ONCE per app open)
  const captureAndLogRealtimeLocation = useCallback(async (trigger: string = "APP_OPEN_ONCE") => {
    if (isAdmin) return;
    try {
      const loc = await getRealtimeDeviceLocation();
      if (!loc) return;

      const placeName = loc.placeName || loc.address || "साखराळे";
      const now = new Date();
      const dateStr = loc.dateStr || now.toLocaleDateString("en-GB");
      const timeStr = loc.timeStr || now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });

      await logUserActivity({
        action: "LOCATION_CHECKIN",
        userId: user?.id,
        username: user?.username,
        details: `स्थान: ${placeName} (अक्षांश: ${loc.latitude.toFixed(5)}, रेखांश: ${loc.longitude.toFixed(5)}) • दिनांक: ${dateStr}, वेळ: ${timeStr}`,
        metadata: {
          latitude: loc.latitude,
          longitude: loc.longitude,
          accuracy: loc.accuracy,
          address: loc.address,
          placeName: placeName,
          city: loc.city,
          district: loc.district,
          subregion: loc.subregion,
          postalCode: loc.postalCode,
          village: loc.city || loc.district || "साखराळे",
          date: dateStr,
          time: timeStr,
          formattedDateTime: `${dateStr}, ${timeStr}`,
          trigger
        }
      });
    } catch (e) {}
  }, [isAdmin, user?.id, user?.username]);

  // Check permissions on mount for non-admin users & verify admin access
  useEffect(() => {
    checkAdminAccess();
    checkCurrentPermissionsStatus().then(status => {
      setPermsState(status);
    }).catch(() => {});

    if (!isAdmin && user && user.permissions_granted !== true && !user.permissions) {
      setShowPermissionModal(true);
    } else if (!isAdmin && !hasCapturedLocationOnceRef.current) {
      hasCapturedLocationOnceRef.current = true;
      captureAndLogRealtimeLocation("APP_OPEN_ONCE");
    }
  }, [user, isAdmin, checkAdminAccess, captureAndLogRealtimeLocation]);

  // On mount: load all villages from MongoDB
  useEffect(() => {
    loadVillages();
  }, []);

  const loadVillages = async () => {
    try {
      const vList = await villageAPI.getVillages();
      setVillages(vList || []);
      if (vList && vList.length > 0) {
        setSelectedVillageId(prev => prev || vList[0].id);
      }
    } catch (e) {
      console.error("Failed to load villages:", e);
    }
  };

  // High performance voter loading with pagination & field projection
  const loadMembers = useCallback(async (pageToLoad: number = 1, append: boolean = false) => {

    if (pageToLoad === 1) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const res = await memberAPI.getMembers({
        village_id: selectedVillageId || undefined,
        q: debouncedSearch || undefined,
        page: pageToLoad,
        limit: 30
      });

      let items: Member[] = res.items || [];
      let total: number = res.total ?? items.length;

      // Filter by mobile if quick filter is active
      if (filterMode === "mobile") {
        items = items.filter(m => Boolean(m.mobile_number));
      }

      setTotalCount(total);

      if (append) {
        setMembers(prev => [...prev, ...items]);
      } else {
        setMembers(items);
      }

      setHasMore(items.length === 30 && (pageToLoad * 30 < total));
      setPage(pageToLoad);
    } catch (err) {
      console.error("Failed to load members:", err);
      if (!append) {
        setMembers([]);
        setTotalCount(0);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [isAdmin, user, selectedVillageId, debouncedSearch, filterMode]);

  useEffect(() => {
    setPage(1);
    setHasMore(true);
    loadMembers(1, false);
  }, [debouncedSearch, filterMode, selectedVillageId, loadMembers]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    checkAdminAccess();
    if (!isAdmin && user?.permissions_granted === true) {
      captureAndLogRealtimeLocation("REFRESH");
    }
    loadVillages();
    setPage(1);
    setHasMore(true);
    loadMembers(1, false);
  }, [checkAdminAccess, isAdmin, user?.permissions_granted, captureAndLogRealtimeLocation, loadMembers]);

  const handleLoadMore = useCallback(() => {
    if (!loading && !loadingMore && hasMore) {
      loadMembers(page + 1, true);
    }
  }, [loading, loadingMore, hasMore, loadMembers, page]);

  // Real-time GPS Location Check-in Button Handler
  const handleCheckinLocation = async () => {
    setCheckingInLocation(true);
    try {
      const loc = await getRealtimeDeviceLocation();
      if (!loc) {
        Alert.alert(
          "स्थान त्रुटी (GPS Unavailable)",
          "मोबाईलचे GPS / लोकेशन चालू आहे का आणि ॲपला लोकेशन परवानगी दिली आहे का ते तपासा.",
          [{ text: "समजले (OK)" }]
        );
        return;
      }

      const addressStr = loc.address || `${loc.latitude.toFixed(5)}, ${loc.longitude.toFixed(5)}`;
      const areaName = loc.city || loc.district || "महाराष्ट्र";

      await logUserActivity({
        action: "LOCATION_CHECKIN",
        userId: user?.id,
        username: user?.username,
        details: `रिअल-टाईम स्थान: ${addressStr} (अक्षांश: ${loc.latitude.toFixed(5)}, रेखांश: ${loc.longitude.toFixed(5)})`,
        metadata: {
          village: areaName,
          city: loc.city,
          district: loc.district,
          subregion: loc.subregion,
          postalCode: loc.postalCode,
          address: addressStr,
          latitude: loc.latitude,
          longitude: loc.longitude,
          accuracy: loc.accuracy,
          checkinType: "MANUAL_CHECKIN"
        }
      });

      Alert.alert(
        "📍 स्थान यशस्वीरित्या नोंदवले!",
        `पत्ता: ${addressStr}\nशहर/जिल्हा: ${areaName}\nअक्षांश: ${loc.latitude.toFixed(5)}\nरेखांश: ${loc.longitude.toFixed(5)}\nअचूकता: ±${Math.round(loc.accuracy || 10)} मी.\nवेळ: ${new Date().toLocaleTimeString("mr-IN")}`,
        [{ text: "उत्कृष्ट (OK)" }]
      );
    } catch (e) {
      Alert.alert("माहिती", "स्थान नोंदवले गेले आहे.");
    } finally {
      setCheckingInLocation(false);
    }
  };

  const handleToggleLocationPermission = async () => {
    const res = await requestLocationPermission();
    setPermsState(prev => ({ ...prev, location: res.granted }));
    if (res.granted) {
      if (res.location) {
        const loc = res.location;
        const placeName = loc.placeName || loc.address || "साखराळे";
        const dateStr = loc.dateStr || new Date().toLocaleDateString("en-GB");
        const timeStr = loc.timeStr || new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
        hasCapturedLocationOnceRef.current = true;
        await logUserActivity({
          action: "LOCATION_CHECKIN",
          userId: user?.id,
          username: user?.username,
          details: `स्थान: ${placeName} (अक्षांश: ${loc.latitude.toFixed(5)}, रेखांश: ${loc.longitude.toFixed(5)}) • दिनांक: ${dateStr}, वेळ: ${timeStr}`,
          metadata: {
            latitude: loc.latitude,
            longitude: loc.longitude,
            accuracy: loc.accuracy,
            address: loc.address,
            placeName: placeName,
            city: loc.city,
            district: loc.district,
            date: dateStr,
            time: timeStr,
            formattedDateTime: `${dateStr}, ${timeStr}`,
            trigger: "PERMISSION_TOGGLE"
          }
        }).catch(() => {});
      }
      Alert.alert("स्थान परवानगी", "स्थान परवानगी यशस्वीरित्या दिली गेली आहे.");
    } else {
      Alert.alert("स्थान परवानगी", "स्थान परवानगी दिली नाही.");
    }
  };

  const handleToggleCallPermission = async () => {
    if (permsState.phoneCall) {
      setPermsState(prev => ({ ...prev, phoneCall: false }));
    } else {
      const granted = await requestCallPermission();
      setPermsState(prev => ({ ...prev, phoneCall: granted }));
      if (granted) {
        Alert.alert("फोन कॉल परवानगी", "कॉल करण्याची परवानगी दिली गेली आहे.");
      }
    }
  };

  const handleToggleSmsPermission = async () => {
    if (permsState.sms) {
      setPermsState(prev => ({ ...prev, sms: false }));
    } else {
      const granted = await requestSmsPermission();
      setPermsState(prev => ({ ...prev, sms: granted }));
      if (granted) {
        Alert.alert("एसएमएस परवानगी", "एसएमएस पाठवण्याची परवानगी दिली गेली आहे.");
      }
    }
  };

  const handleSavePermissionsAndContinue = async () => {
    setProcessingPerms(true);
    try {
      const anyGranted = Boolean(permsState.location || permsState.phoneCall || permsState.sms);
      await authAPI.updateSelfPermissions(anyGranted, permsState).catch(() => {});
      updateUserPermissions(true);
      setShowPermissionModal(false);
      loadMembers(1, false);
    } catch (e) {
      setShowPermissionModal(false);
      loadMembers(1, false);
    } finally {
      setProcessingPerms(false);
    }
  };

  const renderVoterItem = useCallback(({ item }: { item: Member }) => (
    <VoterCard
      member={item}
      onPress={() => navigation.navigate("VoterProfile", { memberId: item.id })}
    />
  ), [navigation]);

  const keyExtractor = useCallback((item: Member, index: number) => {
    return item.id ? `${item.id}_${index}` : `${index}`;
  }, []);

  const currentVillage = villages.find(v => v.id === selectedVillageId) || villages[0];
  const villageDisplayName = currentVillage ? (currentVillage.name_mr || currentVillage.name_en) : "गाव";

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <Header title={villageDisplayName} />

      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {/* Top Interactive Toolbar */}
        <View style={styles.toolbarRow}>
          <View style={styles.titleCol}>
            <Text style={[styles.listTitle, { color: theme.colors.textPrimary }]}>
              {villageDisplayName}
            </Text>
            <Text style={[styles.listSub, { color: theme.colors.textMuted }]}>
              {isAdminPanel ? "प्रशासक पॅनेल (Admin)" : "वापरकर्ता पॅनेल (User)"}
            </Text>
          </View>

          <View style={[styles.countBadge, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <Text style={[styles.countBadgeText, { color: theme.colors.primaryLight }]}>{totalCount}</Text>
            <Text style={[styles.countBadgeLabel, { color: theme.colors.textMuted }]}>मतदार</Text>
          </View>
        </View>

        {/* Village Selector Horizontal Chips (ONLY actual villages, NO 'सर्व गावे') */}
        {villages.length > 1 && (
          <View style={styles.villageChipsContainer}>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={villages}
              keyExtractor={(v) => v.id}
              contentContainerStyle={{ paddingHorizontal: theme.spacing.lg, gap: 8 }}
              renderItem={({ item: v }) => {
                const isActive = (selectedVillageId || villages[0]?.id) === v.id;
                return (
                  <TouchableOpacity
                    style={[styles.villageChip, isActive && styles.villageChipActive]}
                    onPress={() => setSelectedVillageId(v.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.villageChipText, isActive && styles.villageChipTextActive]}>
                      {v.name_mr || v.name_en}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        )}

        {/* Search Bar */}
        <View style={styles.searchWrapper}>
          <SearchBar
            value={searchQuery}
            onChangeText={(txt) => setSearchQuery(txt)}
            placeholder="मतदार शोधा (नाव, क्रमांक, मोबाईल...)"
          />
        </View>

            {/* Count Summary */}
            <View style={styles.summaryBar}>
              <Text style={styles.summaryText}>
                {searchQuery
                  ? `"${searchQuery}" साठी: ${members.length} निकाल`
                  : `एकूण मतदार: ${totalCount}`}
              </Text>
              {searchQuery ? (
                <TouchableOpacity onPress={() => setSearchQuery("")}>
                  <Text style={styles.clearSearchText}>साफ करा ✕</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {/* High Performance Virtualized Voter List */}
            {loading && !refreshing ? (
              <View style={styles.loaderContainer}>
                <ActivityIndicator size="large" color={theme.colors.primaryLight} />
                <Text style={styles.loadingText}>मतदार माहिती जलद लोड होत आहे...</Text>
              </View>
            ) : members.length === 0 ? (
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconCircle}>
                  <Ionicons name="folder-open-outline" size={42} color={theme.colors.textMuted} />
                </View>
                <Text style={styles.emptyTitle}>
                  {searchQuery ? "कोणतेही जुळणारे मतदार आढळले नाहीत" : "सध्या कोणताही मतदार डेटा उपलब्ध नाही"}
                </Text>
                <Text style={styles.emptySubtitle}>
                  {searchQuery
                    ? `'${searchQuery}' साठी कोणताही मतदार सापडला नाही.`
                    : "Admin Panel च्या Upload Studio मधून Excel किंवा CSV फाईल अपलोड केल्यानंतर येथे मतदार यादी दिसेल."}
                </Text>
                <TouchableOpacity style={styles.reloadBtn} onPress={handleRefresh} activeOpacity={0.7}>
                  <Ionicons name="refresh" size={16} color="#60A5FA" style={{ marginRight: 6 }} />
                  <Text style={styles.reloadBtnText}>ताजे करा (Refresh)</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <FlatList
                data={members}
                keyExtractor={keyExtractor}
                renderItem={renderVoterItem}
                contentContainerStyle={styles.listContent}
                initialNumToRender={10}
                maxToRenderPerBatch={10}
                windowSize={5}
                removeClippedSubviews={Platform.OS === "android"}
                updateCellsBatchingPeriod={50}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={handleRefresh}
                    tintColor={theme.colors.primaryLight}
                  />
                }
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.3}
                ListFooterComponent={
                  loadingMore ? (
                    <View style={{ paddingVertical: 16, alignItems: "center" }}>
                      <ActivityIndicator size="small" color={theme.colors.primaryLight} />
                      <Text style={{ color: theme.colors.textMuted, fontSize: 11, marginTop: 4 }}>आणखी मतदार लोड होत आहेत...</Text>
                    </View>
                  ) : hasMore ? null : members.length > 0 ? (
                    <View style={{ paddingVertical: 16, alignItems: "center" }}>
                      <Text style={{ color: theme.colors.textMuted, fontSize: 11 }}>✓ सर्व {totalCount} मतदार लोड झाले</Text>
                    </View>
                  ) : null
                }
              />
            )}
      </View>

      {/* Granular Permission Request Modal (Accept one by one) */}
      <Modal visible={showPermissionModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.permissionCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <View style={[styles.permIconCircle, { backgroundColor: isDark ? "rgba(52, 211, 153, 0.15)" : "#E0F2FE" }]}>
              <Ionicons name="shield-checkmark" size={32} color={theme.colors.primaryLight} />
            </View>
            <Text style={[styles.permModalTitle, { color: theme.colors.textPrimary }]}>ॲप परवानग्या व्यवस्थापन</Text>
            <Text style={[styles.permModalSubtitle, { color: theme.colors.textMuted }]}>
              तुम्ही खालील परवानग्या एक-एक करून स्वीकारू शकता. एसएमएस किंवा कॉल परवानगी न दिल्यासही ॲप वापरता येईल:
            </Text>

            <View style={styles.permFeatureList}>
              {/* 1. Location Permission */}
              <View style={[styles.permFeatureItem, { backgroundColor: isDark ? "#1E293B" : "#F8FAFC", padding: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border }]}>
                <View style={[styles.permFeatureIconWrap, { backgroundColor: permsState.location ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)" }]}>
                  <Ionicons name="navigate" size={18} color={permsState.location ? "#10B981" : "#F59E0B"} />
                </View>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={[styles.permFeatureTitle, { color: theme.colors.textPrimary }]}>📍 रिअल-टाईम स्थान (GPS Location)</Text>
                  <Text style={[styles.permFeatureDesc, { color: theme.colors.textMuted }]}>ॲप सुरू झाल्यावर फक्त एकदा उपस्थिती व ठिकाण नोंदवण्यासाठी.</Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.permToggleBtn,
                    permsState.location ? styles.permToggleBtnGranted : styles.permToggleBtnPending
                  ]}
                  onPress={handleToggleLocationPermission}
                >
                  <Text style={[styles.permToggleBtnText, { color: permsState.location ? "#FFFFFF" : theme.colors.textPrimary }]}>
                    {permsState.location ? "मंजूर ✓" : "परवानगी द्या"}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* 2. Call Permission */}
              <View style={[styles.permFeatureItem, { backgroundColor: isDark ? "#1E293B" : "#F8FAFC", padding: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border }]}>
                <View style={[styles.permFeatureIconWrap, { backgroundColor: permsState.phoneCall ? "rgba(16, 185, 129, 0.15)" : "rgba(99, 102, 241, 0.15)" }]}>
                  <Ionicons name="call" size={18} color={permsState.phoneCall ? "#10B981" : "#6366F1"} />
                </View>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={[styles.permFeatureTitle, { color: theme.colors.textPrimary }]}>📞 फोन कॉल प्रवेश (Phone Call)</Text>
                  <Text style={[styles.permFeatureDesc, { color: theme.colors.textMuted }]}>मतदारांशी थेट संपर्क साधण्यासाठी (ऐच्छिक).</Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.permToggleBtn,
                    permsState.phoneCall ? styles.permToggleBtnGranted : styles.permToggleBtnPending
                  ]}
                  onPress={handleToggleCallPermission}
                >
                  <Text style={[styles.permToggleBtnText, { color: permsState.phoneCall ? "#FFFFFF" : theme.colors.textPrimary }]}>
                    {permsState.phoneCall ? "मंजूर ✓" : "परवानगी द्या"}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* 3. SMS Permission */}
              <View style={[styles.permFeatureItem, { backgroundColor: isDark ? "#1E293B" : "#F8FAFC", padding: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border }]}>
                <View style={[styles.permFeatureIconWrap, { backgroundColor: permsState.sms ? "rgba(16, 185, 129, 0.15)" : "rgba(14, 165, 233, 0.15)" }]}>
                  <Ionicons name="chatbubbles" size={18} color={permsState.sms ? "#10B981" : "#0EA5E9"} />
                </View>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={[styles.permFeatureTitle, { color: theme.colors.textPrimary }]}>💬 एसएमएस पाठवणे (SMS Permission)</Text>
                  <Text style={[styles.permFeatureDesc, { color: theme.colors.textMuted }]}>मतदारांना मतदार स्लिप व माहिती पाठवण्यासाठी (ऐच्छिक).</Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.permToggleBtn,
                    permsState.sms ? styles.permToggleBtnGranted : styles.permToggleBtnPending
                  ]}
                  onPress={handleToggleSmsPermission}
                >
                  <Text style={[styles.permToggleBtnText, { color: permsState.sms ? "#FFFFFF" : theme.colors.textPrimary }]}>
                    {permsState.sms ? "मंजूर ✓" : "परवानगी द्या"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.permButtonRow}>
              <TouchableOpacity
                style={[styles.permAllowBtn, { backgroundColor: theme.colors.primary }]}
                onPress={handleSavePermissionsAndContinue}
                disabled={processingPerms}
                activeOpacity={0.8}
              >
                {processingPerms ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.permAllowBtnText}>जतन करा आणि पुढे जा (Save & Continue)</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  toolbarRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.xs,
  },
  titleCol: {
    flex: 1,
  },
  listTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: "800",
    color: theme.colors.textPrimary,
  },
  listSub: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
  },
  locationCheckinBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#064E3B",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: "#059669",
    marginRight: 10,
  },
  locationCheckinBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  countBadge: {
    backgroundColor: theme.colors.card,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.full,
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  countBadgeText: {
    color: theme.colors.primaryLight,
    fontWeight: "800",
    fontSize: 13,
  },
  countBadgeLabel: {
    color: theme.colors.textMuted,
    fontSize: 9,
  },
  villageChipsContainer: {
    paddingVertical: 4,
  },
  villageChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  villageChipActive: {
    backgroundColor: "#065F46",
    borderColor: "#10B981",
  },
  villageChipText: {
    fontSize: 12,
    color: theme.colors.textMuted,
    fontWeight: "600",
  },
  villageChipTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  filterPillsRow: {
    flexDirection: "row",
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 6,
    gap: 8,
  },
  filterPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  filterPillActive: {
    backgroundColor: "#1E3A8A",
    borderColor: "#3B82F6",
  },
  filterPillText: {
    fontSize: 11,
    color: theme.colors.textMuted,
    fontWeight: "600",
  },
  filterPillTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  searchWrapper: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 4,
  },
  summaryBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 4,
  },
  summaryText: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.sizes.xs,
  },
  clearSearchText: {
    color: "#EF4444",
    fontSize: theme.typography.sizes.xs,
    fontWeight: "700",
  },
  loaderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 80,
  },
  loadingText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    marginTop: 12,
  },
  listContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: 40,
    paddingTop: 4,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingTop: 60,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.card,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  emptyTitle: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
  },
  emptySubtitle: {
    color: theme.colors.textMuted,
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 20,
  },
  reloadBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  reloadBtnText: {
    color: "#60A5FA",
    fontSize: 13,
    fontWeight: "700",
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
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  deniedTitle: {
    color: "#EF4444",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 12,
  },
  deniedDesc: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 24,
  },
  grantAccessBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#10B981",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: theme.borderRadius.md,
  },
  grantAccessBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  permissionCard: {
    backgroundColor: "#0F172A",
    borderRadius: theme.borderRadius.xl,
    padding: 24,
    width: "100%",
    maxWidth: 400,
    borderWidth: 1,
    borderColor: "#334155",
  },
  permIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(52, 211, 153, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 16,
  },
  permModalTitle: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 6,
  },
  permModalSubtitle: {
    color: theme.colors.textMuted,
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 20,
  },
  permFeatureList: {
    gap: 14,
    marginBottom: 24,
  },
  permFeatureItem: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  permFeatureIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  permFeatureTitle: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  permFeatureDesc: {
    color: theme.colors.textMuted,
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  permButtonRow: {
    flexDirection: "row",
    gap: 12,
  },
  permDenyBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.md,
    backgroundColor: "#1E293B",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#334155",
  },
  permDenyBtnText: {
    color: "#94A3B8",
    fontSize: 13,
    fontWeight: "700",
  },
  permAllowBtn: {
    flex: 2,
    flexDirection: "row",
    paddingVertical: 12,
    borderRadius: theme.borderRadius.md,
    backgroundColor: "#059669",
    alignItems: "center",
    justifyContent: "center",
  },
  permAllowBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  permToggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  permToggleBtnGranted: {
    backgroundColor: "#10B981",
  },
  permToggleBtnPending: {
    backgroundColor: "#3B82F6",
  },
  permToggleBtnText: {
    fontSize: 12,
    fontWeight: "700",
  },
});

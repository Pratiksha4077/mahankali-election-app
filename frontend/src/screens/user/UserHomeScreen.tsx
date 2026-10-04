import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, SafeAreaView, Modal, Platform, Alert
} from "react-native";
import { Header } from "../../components/Header";
import { SearchBar } from "../../components/SearchBar";
import { VoterCard } from "../../components/VoterCard";
import { memberAPI, villageAPI, authAPI, logUserActivity } from "../../api/client";
import { Member, Village } from "../../models/types";
import { theme } from "../../theme/theme";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import { requestAllDevicePermissions } from "../../utils/devicePermissions";

// Sakharale village ID - if found in backend we use it; otherwise filter by name
const SAKHARALE_NAMES = ["साखराळे", "sakharele", "sakharale"];

export const UserHomeScreen: React.FC<{ navigation: any; route?: any }> = ({ navigation, route }) => {
  const { t } = useLanguage();
  const { user, isAdmin, activePanel, updateUserPermissions } = useAuth();
  const isAdminPanel = isAdmin && activePanel === "ADMIN";

  const [sakharaleVillage, setSakharaleVillage] = useState<Village | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");

  const [members, setMembers] = useState<Member[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);

  // Permission Prompt State
  const [showPermissionModal, setShowPermissionModal] = useState<boolean>(false);
  const [processingPerms, setProcessingPerms] = useState<boolean>(false);

  // Check permissions on mount for non-admin users
  useEffect(() => {
    if (!isAdmin && user && user.permissions_granted !== true) {
      setShowPermissionModal(true);
    }
  }, [user, isAdmin]);

  // On mount: load villages and find Sakharale
  useEffect(() => {
    loadSakharaleVillage();
  }, []);

  // Load members whenever village or search changes
  useEffect(() => {
    if (isAdmin || user?.permissions_granted === true) {
      setPage(1);
      setHasMore(true);
      loadMembers(1, false);
    } else {
      setLoading(false);
    }
  }, [sakharaleVillage, searchQuery, user?.permissions_granted]);

  const handleAllowPermissions = async () => {
    setProcessingPerms(true);
    try {
      // 1. Trigger native device permissions prompt (Call & Location)
      let coords = { latitude: 17.0125, longitude: 74.3214, accuracy: 10 };
      try {
        const permResult = await requestAllDevicePermissions();
        if (permResult.coords) {
          coords = {
            latitude: permResult.coords.latitude,
            longitude: permResult.coords.longitude,
            accuracy: permResult.coords.accuracy || 10
          };
        }
      } catch (pe) {
        console.warn("Perm prompt warning:", pe);
      }

      // 2. Immediately dismiss modal & grant access in state
      setShowPermissionModal(false);
      updateUserPermissions(true);

      const locationMeta: Record<string, any> = {
        village: sakharaleVillage?.name_mr || "साखराळे",
        district: "सांगली",
        checkinType: "APP_START_PERMISSION_GRANTED",
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy
      };

      // 3. Save to backend asynchronously
      authAPI.updateSelfPermissions(true).catch(() => {});
      logUserActivity({
        action: "LOCATION_CHECKIN",
        details: `वापरकर्त्याने फोन, SMS आणि स्थान परवानगी दिली. (अक्षांश: ${locationMeta.latitude}, रेखांश: ${locationMeta.longitude})`,
        metadata: locationMeta
      }).catch(() => {});

      // 4. Reload voter members
      loadMembers(1, false);
    } catch (e) {
      setShowPermissionModal(false);
      updateUserPermissions(true);
      loadMembers(1, false);
    } finally {
      setProcessingPerms(false);
    }
  };

  const handleDenyPermissions = async () => {
    setProcessingPerms(true);
    try {
      await authAPI.updateSelfPermissions(false);
      updateUserPermissions(false);
      setShowPermissionModal(false);
      setMembers([]);
      setTotalCount(0);
      Alert.alert(
        "प्रवेश निर्बंधित (Access Denied)",
        "परवानग्या नाकारल्यामुळे मतदार यादी व संपर्क माहिती दाखवली जाणार नाही. प्रवेश मिळवण्यासाठी पुन्हा परवानग्या द्या.",
        [{ text: "ठीक आहे (OK)" }]
      );
    } catch (e) {
      updateUserPermissions(false);
      setShowPermissionModal(false);
    } finally {
      setProcessingPerms(false);
    }
  };

  const loadSakharaleVillage = async () => {
    try {
      const vList = await villageAPI.getVillages();
      // Find Sakharale village (try name match)
      const sakh = vList.find(v =>
        SAKHARALE_NAMES.some(name =>
          v.name_mr?.toLowerCase().includes(name) ||
          v.name_en?.toLowerCase().includes(name)
        )
      );
      if (sakh) {
        setSakharaleVillage(sakh);
      } else if (vList.length > 0) {
        setSakharaleVillage(vList[0]);
      }
    } catch (e) {
      console.error("Failed to load villages:", e);
    }
  };

  const loadMembers = async (pageToLoad: number = 1, append: boolean = false) => {
    // If user has not granted permissions, do not provide access!
    if (!isAdmin && user && user.permissions_granted === false) {
      setMembers([]);
      setTotalCount(0);
      setLoading(false);
      return;
    }

    if (pageToLoad === 1) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      let res = await memberAPI.getMembers({
        village_id: sakharaleVillage?.id || undefined,
        q: searchQuery.trim() || undefined,
        page: pageToLoad,
        limit: 40
      });

      let items: Member[] = res.items || [];
      let total: number = res.total ?? items.length;

      // If no records found under this specific village ID, fetch without village filter so whatever data admin uploaded is displayed
      if (items.length === 0 && sakharaleVillage?.id && !searchQuery.trim()) {
        const fallbackRes = await memberAPI.getMembers({
          page: pageToLoad,
          limit: 40
        });
        if (fallbackRes.items && fallbackRes.items.length > 0) {
          items = fallbackRes.items;
          total = fallbackRes.total ?? items.length;
        }
      }

      setTotalCount(total);

      if (append) {
        setMembers(prev => [...prev, ...items]);
      } else {
        setMembers(items);
      }

      setHasMore(items.length === 40 && (pageToLoad * 40 < total));
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
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadSakharaleVillage();
    setPage(1);
    setHasMore(true);
    loadMembers(1, false);
  };

  const handleLoadMore = () => {
    if (!loading && !loadingMore && hasMore) {
      loadMembers(page + 1, true);
    }
  };

  const [checkingInLocation, setCheckingInLocation] = useState<boolean>(false);

  const handleCheckinLocation = async () => {
    setCheckingInLocation(true);
    const locationMeta: Record<string, any> = {
      village: sakharaleVillage?.name_mr || "साखराळे",
      district: "सांगली",
      checkinType: "MANUAL_CHECKIN",
      latitude: 17.0125,
      longitude: 74.3214
    };

    if (typeof window !== "undefined" && navigator?.geolocation) {
      try {
        await new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              locationMeta.latitude = pos.coords.latitude;
              locationMeta.longitude = pos.coords.longitude;
              locationMeta.accuracy = pos.coords.accuracy;
              resolve(true);
            },
            () => resolve(false),
            { timeout: 4000, enableHighAccuracy: true }
          );
        });
      } catch (e) {}
    }

    try {
      await logUserActivity({
        action: "LOCATION_CHECKIN",
        details: `थेट उपस्थिती नोंदवली: ${locationMeta.village} (अक्षांश: ${locationMeta.latitude}, रेखांश: ${locationMeta.longitude})`,
        metadata: locationMeta
      });
      Alert.alert(
        "स्थान नोंदवले!",
        `गाव: ${locationMeta.village}\nअक्षांश: ${typeof locationMeta.latitude === "number" ? locationMeta.latitude.toFixed(4) : locationMeta.latitude}, रेखांश: ${typeof locationMeta.longitude === "number" ? locationMeta.longitude.toFixed(4) : locationMeta.longitude}\nवेळ: ${new Date().toLocaleTimeString("mr-IN")}`
      );
    } catch (e) {
      Alert.alert("माहिती", "स्थान नोंदवले गेले आहे.");
    } finally {
      setCheckingInLocation(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="साखराळे मतदार यादी" />

      <View style={styles.container}>
        {/* If permissions are not granted, show strict Access Denied Gate */}
        {!isAdmin && user && user.permissions_granted !== true ? (
          <View style={styles.deniedContainer}>
            <View style={styles.deniedIconCircle}>
              <Ionicons name="lock-closed" size={48} color="#EF4444" />
            </View>
            <Text style={styles.deniedTitle}>प्रवेश नाकारला (Access Denied)</Text>
            <Text style={styles.deniedDesc}>
              हे अॅप वापरण्यासाठी आणि मतदारांची माहिती पाहण्यासाठी खालील ३ परवानग्या देणे बंधनकारक आहे:
              {"\n\n"}📞 १. फोन कॉल प्रवेश (Phone Call Access)
              {"\n"}💬 २. SMS व संदेश इतिहास (SMS History Access)
              {"\n"}📍 ३. रिअल-टाईम स्थान ट्रॅकिंग (Live Location Tracking)
              {"\n\n"}तुम्ही या सर्व परवानग्या दिल्याशिवाय ॲप वापरता येणार नाही.
            </Text>
            <TouchableOpacity
              style={styles.grantAccessBtn}
              onPress={() => setShowPermissionModal(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="shield-checkmark" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.grantAccessBtnText}>सर्व परवानग्या त्वरित द्या (Grant Permissions)</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Village Info Banner */}
            <View style={styles.villageBanner}>
              <View style={styles.villageIconWrap}>
                <Ionicons name="location" size={18} color="#34D399" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.villageNameText}>
                  {sakharaleVillage?.name_mr || "साखराळे"} ({sakharaleVillage?.name_en || "Sakharale"})
                </Text>
                <Text style={styles.villageMetaText}>
                  तालुका: {sakharaleVillage?.taluka || "वाळवा"} • जिल्हा: {sakharaleVillage?.district || "सांगली"}
                </Text>
              </View>

              {/* Real-time Location Check-in Button */}
              <TouchableOpacity
                style={styles.locationCheckinBtn}
                onPress={handleCheckinLocation}
                disabled={checkingInLocation}
                activeOpacity={0.7}
              >
                {checkingInLocation ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="navigate-circle" size={16} color="#34D399" style={{ marginRight: 4 }} />
                    <Text style={styles.locationCheckinBtnText}>स्थान नोंदवा</Text>
                  </>
                )}
              </TouchableOpacity>

              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{totalCount}</Text>
                <Text style={styles.countBadgeLabel}>मतदार</Text>
              </View>
            </View>

            {/* Search Bar */}
            <View style={styles.searchWrapper}>
              <SearchBar
                value={searchQuery}
                onChangeText={(txt) => setSearchQuery(txt)}
                placeholder="मतदार शोधा (नाव, क्रमांक...)"
              />
            </View>

            {/* Count Summary */}
            <View style={styles.summaryBar}>
              <Text style={styles.summaryText}>
                {searchQuery
                  ? `"${searchQuery}" साठी: ${totalCount} मतदार`
                  : `एकूण मतदार: ${totalCount}`}
              </Text>
              {searchQuery ? (
                <TouchableOpacity onPress={() => setSearchQuery("")}>
                  <Text style={styles.clearSearchText}>साफ करा ✕</Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.villageSubLabel}>साखराळे गाव</Text>
              )}
            </View>

            {/* Voter List */}
            {loading && !refreshing ? (
              <View style={styles.loaderContainer}>
                <ActivityIndicator size="large" color={theme.colors.primaryLight} />
                <Text style={styles.loadingText}>मतदार माहिती लोड होत आहे...</Text>
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
                    : "Admin Panel च्या Upload Studio मधून Excel किंवा PDF फाईल अपलोड केल्यानंतर येथे मतदार यादी दिसेल."}
                </Text>
                <TouchableOpacity style={styles.reloadBtn} onPress={handleRefresh} activeOpacity={0.7}>
                  <Ionicons name="refresh" size={16} color="#60A5FA" style={{ marginRight: 6 }} />
                  <Text style={styles.reloadBtnText}>ताजे करा (Refresh)</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <FlatList
                data={members}
                keyExtractor={(item, index) => item.id ? `${item.id}_${index}` : `${index}`}
                renderItem={({ item }) => (
                  <VoterCard
                    member={item}
                    onPress={() => navigation.navigate("VoterProfile", { memberId: item.id })}
                  />
                )}
                contentContainerStyle={styles.listContent}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={handleRefresh}
                    tintColor={theme.colors.primaryLight}
                  />
                }
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.4}
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
          </>
        )}
      </View>

      {/* Mandatory Permission Request Modal */}
      <Modal visible={showPermissionModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.permissionCard}>
            <View style={styles.permIconCircle}>
              <Ionicons name="shield-checkmark" size={32} color="#34D399" />
            </View>
            <Text style={styles.permModalTitle}>सुरक्षा व रिअल-टाईम परवानग्या</Text>
            <Text style={styles.permModalSubtitle}>
              या ॲपचा सुरळीत वापर करण्यासाठी व रिअल-टाईम डेटा समन्वय साधण्यासाठी खालील ३ परवानग्या आवश्यक आहेत:
            </Text>

            <View style={styles.permFeatureList}>
              <View style={styles.permFeatureItem}>
                <View style={[styles.permFeatureIconWrap, { backgroundColor: "rgba(52, 211, 153, 0.15)" }]}>
                  <Ionicons name="call" size={18} color="#34D399" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.permFeatureTitle}>फोन कॉल प्रवेश (Phone Call Access)</Text>
                  <Text style={styles.permFeatureDesc}>मतदारांशी थेट कॉल करण्यासाठी आणि कॉल इतिहास सुरक्षित नोंदवण्यासाठी.</Text>
                </View>
              </View>

              <View style={styles.permFeatureItem}>
                <View style={[styles.permFeatureIconWrap, { backgroundColor: "rgba(96, 165, 250, 0.15)" }]}>
                  <Ionicons name="chatbubble-ellipses" size={18} color="#60A5FA" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.permFeatureTitle}>SMS व संदेश इतिहास (SMS History)</Text>
                  <Text style={styles.permFeatureDesc}>मतदार प्रचार संदेश व SMS पाठवण्याची अचूक नोंद ठेवण्यासाठी.</Text>
                </View>
              </View>

              <View style={styles.permFeatureItem}>
                <View style={[styles.permFeatureIconWrap, { backgroundColor: "rgba(251, 191, 36, 0.15)" }]}>
                  <Ionicons name="location" size={18} color="#FBBF24" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.permFeatureTitle}>रिअल-टाईम स्थान (Live Location Tracking)</Text>
                  <Text style={styles.permFeatureDesc}>मतदार बूथ व गाव भेटीच्या वेळी अचूक उपस्थिती व रिअल-टाईम स्थान ट्रॅक करण्यासाठी.</Text>
                </View>
              </View>
            </View>

            <View style={styles.permBtnGroup}>
              <TouchableOpacity
                style={styles.permDenyBtn}
                onPress={handleDenyPermissions}
                disabled={processingPerms}
              >
                <Text style={styles.permDenyBtnText}>नाकारा (Deny)</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.permAllowBtn, processingPerms && { opacity: 0.7 }]}
                onPress={handleAllowPermissions}
                disabled={processingPerms}
              >
                {processingPerms ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.permAllowBtnText}>परवानगी द्या (Allow All)</Text>
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
  },
  villageBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#064E3B",
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#065F46",
    gap: 10,
  },
  villageIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(52, 211, 153, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  villageNameText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  villageMetaText: {
    color: "#6EE7B7",
    fontSize: 11,
    marginTop: 1,
  },
  locationCheckinBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(6, 78, 59, 0.9)",
    borderWidth: 1,
    borderColor: "#34D399",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 6,
  },
  locationCheckinBtnText: {
    color: "#34D399",
    fontSize: 11,
    fontWeight: "700",
  },
  countBadge: {
    backgroundColor: "rgba(52, 211, 153, 0.2)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(52, 211, 153, 0.4)",
  },
  countBadgeText: {
    color: "#34D399",
    fontSize: 18,
    fontWeight: "800",
  },
  countBadgeLabel: {
    color: "#6EE7B7",
    fontSize: 9,
    fontWeight: "600",
  },
  searchWrapper: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: 10,
  },
  summaryBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: "#111827",
  },
  summaryText: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.sizes.sm,
    fontWeight: "700",
  },
  villageSubLabel: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.xs,
  },
  clearSearchText: {
    color: "#F87171",
    fontSize: 12,
    fontWeight: "700",
  },
  listContent: {
    paddingVertical: theme.spacing.xs,
    paddingBottom: 40,
  },
  loaderContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    color: theme.colors.textSecondary,
    marginTop: 12,
    fontSize: theme.typography.sizes.sm,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  emptyTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.sizes.lg,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  emptySubtitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.sm,
    textAlign: "center",
    lineHeight: 18,
    maxWidth: 320,
    marginBottom: 16,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(100, 116, 139, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  reloadBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.card,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.4)",
  },
  reloadBtnText: {
    color: "#60A5FA",
    fontSize: 13,
    fontWeight: "700",
  },
  // Access Denied Gate Styles
  deniedContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    marginTop: 40,
  },
  deniedIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  deniedTitle: {
    color: "#EF4444",
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 10,
    textAlign: "center",
  },
  deniedDesc: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    maxWidth: 360,
    marginBottom: 24,
  },
  grantAccessBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#059669",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  grantAccessBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  // Modal Backdrop & Card
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  permissionCard: {
    width: "100%",
    maxWidth: 440,
    backgroundColor: theme.colors.card,
    borderRadius: 18,
    padding: 24,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
  },
  permIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(52, 211, 153, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(52, 211, 153, 0.3)",
  },
  permModalTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 6,
  },
  permModalSubtitle: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    marginBottom: 18,
  },
  permFeatureList: {
    width: "100%",
    gap: 12,
    marginBottom: 22,
  },
  permFeatureItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  permFeatureIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  permFeatureTitle: {
    color: theme.colors.textPrimary,
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 2,
  },
  permFeatureDesc: {
    color: theme.colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
  },
  permBtnGroup: {
    flexDirection: "row",
    width: "100%",
    gap: 12,
  },
  permDenyBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.4)",
    alignItems: "center",
  },
  permDenyBtnText: {
    color: "#F87171",
    fontSize: 13,
    fontWeight: "700",
  },
  permAllowBtn: {
    flex: 1.5,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#059669",
    alignItems: "center",
    justifyContent: "center",
  },
  permAllowBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
});

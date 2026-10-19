import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, ActivityIndicator, RefreshControl, Alert,
  TextInput, FlatList
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Header } from "../../components/Header";
import { adminAPI } from "../../api/client";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import { theme } from "../../theme/theme";

export const UserActivityScreen: React.FC<{ route: any; navigation: any }> = ({ route, navigation }) => {
  const routeUser = route.params?.user;
  const { t } = useLanguage();
  const { theme, isDark } = useTheme();

  // User selection state: if opened from bottom tab without user, allow selecting any worker
  const [currentUser, setCurrentUser] = useState<any>(routeUser || null);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState<boolean>(false);
  const [userSearchText, setUserSearchText] = useState<string>("");

  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [updatingAccess, setUpdatingAccess] = useState<boolean>(false);
  const [expandedSection, setExpandedSection] = useState<"calls" | "sms" | "locations" | null>("calls");

  // Selection & Deletion State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // User state synchronized with live database
  const [isAccessAllowed, setIsAccessAllowed] = useState<boolean>(
    routeUser ? (routeUser.is_active !== false && routeUser.accountStatus !== "DISABLED") : true
  );
  const [hasDevicePerms, setHasDevicePerms] = useState<boolean>(
    routeUser ? routeUser.permissions_granted === true : false
  );

  const [activityData, setActivityData] = useState<{
    calls: any[];
    sms: any[];
    locations: any[];
    call_count: number;
    sms_count: number;
    location_count: number;
    call_status?: string;
    sms_status?: string;
    last_telephony_sync?: string | null;
  }>({
    calls: [],
    sms: [],
    locations: [],
    call_count: 0,
    sms_count: 0,
    location_count: 0,
    call_status: "UNKNOWN",
    sms_status: "UNKNOWN",
    last_telephony_sync: null,
  });

  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const data = await adminAPI.getUsers();
      const workers = (Array.isArray(data) ? data : []).filter((u: any) => u.role !== "ADMIN");
      setUsersList(workers.length > 0 ? workers : data);
    } catch (e) {
      console.warn("[UserActivityScreen] Failed to fetch users list:", e);
      setUsersList([]);
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    if (route.params?.user) {
      setCurrentUser(route.params.user);
    } else if (!currentUser) {
      fetchUsers();
    }
  }, [route.params?.user, fetchUsers]);

  const loadUserActivities = useCallback(async () => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    try {
      const uid = String(currentUser.id || currentUser._id || "");
      const uUsername = currentUser.username || "";

      // 1. Fetch live user details to synchronize real-time access and permission status
      let freshUserData: any = null;
      try {
        const freshUser = await adminAPI.getUserById(uid);
        if (freshUser) {
          const uData = freshUser.data || freshUser;
          freshUserData = uData;
          setCurrentUser(uData);
          const allowed = (uData.accountStatus !== "DISABLED") && (uData.is_active !== false) && (uData.admin_access_allowed !== false);
          setIsAccessAllowed(allowed);
          setHasDevicePerms(Boolean(uData.permissions_granted));
        }
      } catch (ue) {}

      // 2. Fetch recorded user real-time activities (Calls, SMS, Locations)
      const res = await adminAPI.getUserActivity(uid, uUsername);
      const data = res?.data || res;
      if (data) {
        const calls = Array.isArray(data.calls) ? data.calls : [];
        const sms = Array.isArray(data.sms) ? data.sms : [];
        const locations = Array.isArray(data.locations) ? data.locations : [];

        const cStatus = (data.call_status && data.call_status !== "UNKNOWN")
          ? data.call_status
          : (freshUserData?.telephony_status?.callStatus || (freshUserData?.permissions?.callHistory ? "GRANTED" : "DENIED"));
        const sStatus = (data.sms_status && data.sms_status !== "UNKNOWN")
          ? data.sms_status
          : (freshUserData?.telephony_status?.smsStatus || (freshUserData?.permissions?.sms ? "GRANTED" : "DENIED"));

        console.log(
          `[UserActivityScreen] User ${uid} (${uUsername}) loaded: ${calls.length} calls (call_status: ${cStatus}), ` +
          `${sms.length} SMS (sms_status: ${sStatus}), ${locations.length} locations.`
        );

        setActivityData({
          calls,
          sms,
          locations,
          call_count: data.call_count ?? calls.length,
          sms_count: data.sms_count ?? sms.length,
          location_count: data.location_count ?? locations.length,
          call_status: cStatus,
          sms_status: sStatus,
          last_telephony_sync: data.last_telephony_sync || null,
        });
      }
    } catch (err) {
      console.error("[UserActivityScreen] Failed to load user activity:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      loadUserActivities();
    }
  }, [currentUser, loadUserActivities]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadUserActivities();
  };

  const toggleSection = (section: "calls" | "sms" | "locations") => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  // Admin denies or restores User Panel access based on real-time history
  const handleToggleUserAccess = async () => {
    if (!currentUser) return;
    const uid = String(currentUser.id || currentUser._id || "");
    const willDeny = isAccessAllowed;

    if (willDeny) {
      Alert.alert(
        "प्रवेश नाकारायचा आहे का? (Deny Access)",
        `तुम्हाला '${currentUser.fullName || currentUser.username}' चा युझर पॅनेल प्रवेश नाकारायचा आहे का?\n\nप्रवेश नाकारल्यानंतर हा वापरकर्ता ॲपमध्ये लॉगिन करू शकणार नाही.`,
        [
          { text: "रद्द करा (Cancel)", style: "cancel" },
          {
            text: "प्रवेश नाकारा (Deny Access)",
            style: "destructive",
            onPress: async () => {
              setUpdatingAccess(true);
              try {
                await adminAPI.setUserPanelAccess(uid, false, "Admin denied access based on real-time history");
                setIsAccessAllowed(false);
                Alert.alert("प्रवेश नाकारला", "वापरकर्त्याचा प्रवेश यशस्वीरित्या नाकारला गेला आहे. हा वापरकर्ता आता युझर पॅनेलमध्ये लॉगिन करू शकणार नाही.");
                loadUserActivities();
              } catch (e) {
                Alert.alert("त्रुटी", "प्रवेश स्थिती बदलताना त्रुटी आली.");
              } finally {
                setUpdatingAccess(false);
              }
            }
          }
        ]
      );
    } else {
      Alert.alert(
        "प्रवेश मंजूर करायचा आहे का? (Restore Access)",
        `तुम्हाला '${currentUser.fullName || currentUser.username}' चा युझर पॅनेल प्रवेश पुन्हा सुरू करायचा आहे का?`,
        [
          { text: "रद्द करा (Cancel)", style: "cancel" },
          {
            text: "प्रवेश मंजूर करा (Allow Access)",
            onPress: async () => {
              setUpdatingAccess(true);
              try {
                await adminAPI.setUserPanelAccess(uid, true, "Admin restored panel access");
                setIsAccessAllowed(true);
                Alert.alert("प्रवेश मंजूर", "वापरकर्त्याचा प्रवेश पूर्ववत केला आहे. आता वापरकर्ता लॉगिन करू शकतो.");
                loadUserActivities();
              } catch (e) {
                Alert.alert("त्रुटी", "प्रवेश स्थिती बदलताना त्रुटी आली.");
              } finally {
                setUpdatingAccess(false);
              }
            }
          }
        ]
      );
    }
  };

  const toggleSelectItem = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDeleteSingle = (activityId: string, itemTitle: string) => {
    Alert.alert(
      "नोंद हटवा (Soft Delete)",
      `'${itemTitle}' ही नोंद ॲडमिन पॅनेलवरून हटवायची आहे का? (डेटाबेसमध्ये ही नोंद सुरक्षित राहील)`,
      [
        { text: "रद्द करा", style: "cancel" },
        {
          text: "हटवा",
          style: "destructive",
          onPress: async () => {
            const uid = String(currentUser?.id || currentUser?._id || "");
            setIsDeleting(true);
            try {
              await adminAPI.deleteSingleActivity(uid, activityId);
              loadUserActivities();
            } catch (e) {
              Alert.alert("त्रुटी", "नोंद हटवताना अडचण आली.");
            } finally {
              setIsDeleting(false);
            }
          }
        }
      ]
    );
  };

  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) return;
    Alert.alert(
      "निवडलेल्या नोंदी हटवा (Soft Delete)",
      `तुम्ही निवडलेल्या ${selectedIds.size} नोंदी ॲडमिन पॅनेलवरून हटवायच्या आहेत का? (डेटाबेसमध्ये नोंदी सुरक्षित राहतील)`,
      [
        { text: "रद्द करा", style: "cancel" },
        {
          text: "हटवा",
          style: "destructive",
          onPress: async () => {
            const uid = String(currentUser?.id || currentUser?._id || "");
            setIsDeleting(true);
            try {
              await adminAPI.deleteBatchActivities(uid, Array.from(selectedIds));
              setSelectedIds(new Set());
              setSelectionMode(false);
              loadUserActivities();
            } catch (e) {
              Alert.alert("त्रुटी", "नोंदी हटवताना अडचण आली.");
            } finally {
              setIsDeleting(false);
            }
          }
        }
      ]
    );
  };

  const handleClearSection = (section: "calls" | "sms" | "locations") => {
    const secName = section === "calls" ? "कॉल इतिहास" : section === "sms" ? "एसएमएस इतिहास" : "लोकेशन इतिहास";
    Alert.alert(
      `${secName} साफ करा (Soft Delete)`,
      `या विभागातील नोंदी ॲडमिन पॅनेलवरून हटवल्या जातील (डेटाबेसमधून कायमच्या नष्ट होणार नाहीत). खात्री करा?`,
      [
        { text: "रद्द करा", style: "cancel" },
        {
          text: "सर्व हटवा",
          style: "destructive",
          onPress: async () => {
            const uid = String(currentUser?.id || currentUser?._id || "");
            setIsDeleting(true);
            try {
              await adminAPI.clearUserActivities(uid, section.toUpperCase());
              setSelectedIds(new Set());
              loadUserActivities();
            } catch (e) {
              Alert.alert("त्रुटी", "इतिहास हटवताना अडचण आली.");
            } finally {
              setIsDeleting(false);
            }
          }
        }
      ]
    );
  };

  const filteredUsers = usersList.filter((u) => {
    if (!userSearchText.trim()) return true;
    const q = userSearchText.toLowerCase().trim();
    const name = (u.fullName || u.username || "").toLowerCase();
    const uname = (u.username || "").toLowerCase();
    const mob = (u.mobileNumber || u.mobile || "").toLowerCase();
    return name.includes(q) || uname.includes(q) || mob.includes(q);
  });

  if (!currentUser) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
        <Header
          title="कार्यकर्त्यांच्या हालचाली (Worker Activities)"
          showBack={navigation.canGoBack()}
          onBack={() => navigation.goBack()}
        />

        {/* Search Bar for Workers */}
        <View style={[styles.workerSearchCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <Ionicons name="search" size={18} color={theme.colors.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            style={[styles.workerSearchInput, { color: theme.colors.textPrimary }]}
            placeholder="कार्यकर्ता शोधा (नाव, युझरनेम, फोन)..."
            placeholderTextColor={theme.colors.textMuted}
            value={userSearchText}
            onChangeText={setUserSearchText}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {userSearchText.length > 0 && (
            <TouchableOpacity onPress={() => setUserSearchText("")} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close-circle" size={18} color={theme.colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Info Banner */}
        <View style={[styles.workerInfoCard, { backgroundColor: isDark ? "#1E293B" : "#EFF6FF", borderColor: isDark ? "#3B82F6" : "#BFDBFE" }]}>
          <Ionicons name="pulse" size={20} color={isDark ? "#60A5FA" : "#2563EB"} style={{ marginRight: 10 }} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.workerInfoTitle, { color: isDark ? "#FFFFFF" : "#1E40AF" }]}>
              कार्यकर्त्यांची निवड करा
            </Text>
            <Text style={[styles.workerInfoSub, { color: isDark ? "#93C5FD" : "#3B82F6" }]}>
              ज्या कार्यकर्त्याचे कॉल्स, एसएमएस, लोकेशन व परवानग्या पाहायच्या आहेत त्याच्या नावावर टॅप करा.
            </Text>
          </View>
        </View>

        {/* Workers List */}
        {loadingUsers ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={theme.colors.primaryLight} />
            <Text style={[styles.loadingText, { color: theme.colors.textMuted }]}>कार्यकर्ते लोड होत आहेत...</Text>
          </View>
        ) : filteredUsers.length === 0 ? (
          <View style={styles.centerContainer}>
            <Ionicons name="people-outline" size={48} color={theme.colors.textMuted} />
            <Text style={styles.emptyTitle}>कोणताही कार्यकर्ता सापडला नाही</Text>
            <Text style={styles.emptySubText}>
              {userSearchText ? `"${userSearchText}" साठी परिणाम नाही.` : "सिस्टममध्ये अद्याप कोणतेही कार्यकर्ते नोंदवलेले नाहीत."}
            </Text>
            <TouchableOpacity style={styles.backBtn} onPress={fetchUsers}>
              <Text style={styles.backBtnText}>रिफ्रेश करा (Refresh)</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={filteredUsers}
            keyExtractor={(item) => String(item.id || item._id)}
            renderItem={({ item }) => {
              const uName = item.fullName || item.username;
              const uMob = item.mobileNumber || item.mobile || "-";
              const isActive = item.accountStatus !== "DISABLED" && item.is_active !== false;
              const hasPerms = Boolean(item.permissions_granted);

              return (
                <TouchableOpacity
                  style={[styles.workerRowCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
                  onPress={() => {
                    setCurrentUser(item);
                    setIsAccessAllowed(isActive);
                    setHasDevicePerms(hasPerms);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.workerAvatarCircle, { backgroundColor: isDark ? "#1E3A8A" : "#EEF2FF" }]}>
                    <Ionicons name="person" size={20} color={isDark ? "#93C5FD" : "#4F46E5"} />
                  </View>

                  <View style={{ flex: 1, marginHorizontal: 12 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                      <Text style={[styles.workerRowName, { color: theme.colors.textPrimary }]} numberOfLines={1}>
                        {uName}
                      </Text>
                      <View style={[styles.statusBadgeSmall, { backgroundColor: isActive ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)" }]}>
                        <Text style={[styles.statusBadgeSmallText, { color: isActive ? "#10B981" : "#EF4444" }]}>
                          {isActive ? "सक्रिय" : "बंद"}
                        </Text>
                      </View>
                    </View>

                    <Text style={[styles.workerRowSub, { color: theme.colors.textSecondary }]}>
                      मोबाईल: {uMob} • {item.username}
                    </Text>

                    {/* Permissions Mini Row */}
                    <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
                      <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <Ionicons name="navigate" size={12} color={item.permissions?.location ? "#10B981" : "#EF4444"} style={{ marginRight: 2 }} />
                        <Text style={{ fontSize: 11, color: theme.colors.textMuted }}>स्थान</Text>
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <Ionicons name="call" size={12} color={(item.permissions?.callHistory ?? item.permissions?.phoneCall) ? "#10B981" : "#EF4444"} style={{ marginRight: 2 }} />
                        <Text style={{ fontSize: 11, color: theme.colors.textMuted }}>कॉल</Text>
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <Ionicons name="chatbubble" size={12} color={item.permissions?.sms ? "#10B981" : "#EF4444"} style={{ marginRight: 2 }} />
                        <Text style={{ fontSize: 11, color: theme.colors.textMuted }}>SMS</Text>
                      </View>
                    </View>
                  </View>

                  <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
                </TouchableOpacity>
              );
            }}
            contentContainerStyle={{ paddingBottom: 40 }}
            refreshControl={<RefreshControl refreshing={loadingUsers} onRefresh={fetchUsers} tintColor={theme.colors.primaryLight} />}
          />
        )}
      </SafeAreaView>
    );
  }

  const displayName = currentUser?.fullName || currentUser?.username || "-";
  const displayMobile = currentUser?.mobileNumber || currentUser?.mobile || "-";

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <Header
        title={displayName}
        showBack
        onBack={() => {
          if (route.params?.user && navigation.canGoBack()) {
            navigation.goBack();
          } else {
            setCurrentUser(null);
          }
        }}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.colors.primaryLight} />}
      >
        {/* Switch Worker Button */}
        <TouchableOpacity
          style={[styles.switchWorkerBtn, { backgroundColor: isDark ? "#1E293B" : "#F1F5F9", borderColor: theme.colors.border }]}
          onPress={() => setCurrentUser(null)}
          activeOpacity={0.7}
        >
          <Ionicons name="people-outline" size={16} color={theme.colors.primaryLight} style={{ marginRight: 6 }} />
          <Text style={[styles.switchWorkerBtnText, { color: theme.colors.primaryLight }]}>
            ← सर्व कार्यकर्ते / दुसरा कार्यकर्ता निवडा (Change Worker)
          </Text>
        </TouchableOpacity>
        {/* User Badge Card */}
        <View style={[styles.userBadgeCard, { backgroundColor: isDark ? "#1E3A8A" : "#FFFFFF", borderColor: isDark ? "#3B82F6" : "#E2E8F0" }]}>
          <View style={[styles.avatarCircle, { backgroundColor: isDark ? "rgba(255,255,255,0.2)" : "rgba(79, 70, 229, 0.12)" }]}>
            <Ionicons name="person" size={26} color={isDark ? "#FFFFFF" : theme.colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.userName, { color: isDark ? "#FFFFFF" : "#0F172A" }]}>{displayName}</Text>
            <Text style={[styles.userMobile, { color: isDark ? "#93C5FD" : "#475569" }]}>मोबाईल: {displayMobile}</Text>

            {/* Granular Device Permissions Display */}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              {/* Location Badge */}
              <View
                style={[
                  styles.devicePermBadge,
                  { backgroundColor: currentUser?.permissions?.location ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)" }
                ]}
              >
                <Ionicons
                  name="navigate"
                  size={11}
                  color={currentUser?.permissions?.location ? "#10B981" : "#EF4444"}
                  style={{ marginRight: 3 }}
                />
                <Text style={[styles.devicePermText, { color: currentUser?.permissions?.location ? (isDark ? "#34D399" : "#059669") : "#EF4444" }]}>
                  स्थान: {currentUser?.permissions?.location ? "मंजूर" : "नाकारले"}
                </Text>
              </View>

              {/* Call Badge */}
              <View
                style={[
                  styles.devicePermBadge,
                  { backgroundColor: (currentUser?.permissions?.callHistory ?? currentUser?.permissions?.phoneCall) ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)" }
                ]}
              >
                <Ionicons
                  name="call"
                  size={11}
                  color={(currentUser?.permissions?.callHistory ?? currentUser?.permissions?.phoneCall) ? "#10B981" : "#EF4444"}
                  style={{ marginRight: 3 }}
                />
                <Text style={[styles.devicePermText, { color: (currentUser?.permissions?.callHistory ?? currentUser?.permissions?.phoneCall) ? (isDark ? "#34D399" : "#059669") : "#EF4444" }]}>
                  कॉल: {(currentUser?.permissions?.callHistory ?? currentUser?.permissions?.phoneCall) ? "मंजूर" : "नाकारले"}
                </Text>
              </View>

              {/* SMS Badge */}
              <View
                style={[
                  styles.devicePermBadge,
                  { backgroundColor: currentUser?.permissions?.sms ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)" }
                ]}
              >
                <Ionicons
                  name="chatbubbles"
                  size={11}
                  color={currentUser?.permissions?.sms ? "#10B981" : "#EF4444"}
                  style={{ marginRight: 3 }}
                />
                <Text style={[styles.devicePermText, { color: currentUser?.permissions?.sms ? (isDark ? "#34D399" : "#059669") : "#EF4444" }]}>
                  SMS: {currentUser?.permissions?.sms ? "मंजूर" : "नाकारले"}
                </Text>
              </View>
            </View>
          </View>
          <View style={[styles.roleBadge, { backgroundColor: isDark ? "#334155" : "#F1F5F9" }]}>
            <Text style={[styles.roleBadgeText, { color: isDark ? "#FFFFFF" : "#334155" }]}>{currentUser?.role || "USER"}</Text>
          </View>
        </View>

        {/* Admin Access Control Card (Deny or Allow User Panel Access) */}
        <View
          style={[
            styles.accessControlCard,
            {
              backgroundColor: isDark
                ? (isAccessAllowed ? "#064E3B" : "#1C1117")
                : (isAccessAllowed ? "#F0FDF4" : "#FEF2F2"),
              borderColor: isDark
                ? (isAccessAllowed ? "#059669" : "#EF4444")
                : (isAccessAllowed ? "#86EFAC" : "#FCA5A5")
            }
          ]}
        >
          <View style={styles.accessControlHeader}>
            <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
              <Ionicons
                name={isAccessAllowed ? "shield-checkmark" : "ban"}
                size={22}
                color={isAccessAllowed ? "#10B981" : "#EF4444"}
                style={{ marginRight: 8 }}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.accessControlTitle, { color: isDark ? "#FFFFFF" : "#0F172A" }]}>ॲडमिन प्रवेश नियंत्रण (Admin Access Control)</Text>
                <Text style={[styles.accessStatusText, { color: isAccessAllowed ? (isDark ? "#34D399" : "#059669") : "#DC2626" }]}>
                  {isAccessAllowed ? "● युझर पॅनेल प्रवेश मंजूर (Access Allowed)" : "● प्रवेश नाकारला आहे (Access Denied)"}
                </Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.accessActionBtn,
              isAccessAllowed ? styles.denyBtn : styles.allowBtn
            ]}
            onPress={handleToggleUserAccess}
            disabled={updatingAccess}
            activeOpacity={0.8}
          >
            {updatingAccess ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons
                  name={isAccessAllowed ? "ban-outline" : "checkmark-circle-outline"}
                  size={18}
                  color="#FFFFFF"
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.accessActionBtnText}>
                  {isAccessAllowed ? "युझर पॅनेल प्रवेश नाकारा (Deny Access)" : "युझर पॅनेल प्रवेश पुन्हा सुरू करा (Restore Access)"}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Global Multi-select / Batch Actions Bar */}
        {selectedIds.size > 0 && (
          <View style={[styles.bulkActionBar, { backgroundColor: isDark ? "#1E293B" : "#F8FAFC", borderColor: isDark ? "#3B82F6" : "#BFDBFE" }]}>
            <Text style={[styles.bulkActionText, { color: isDark ? "#FFFFFF" : "#0F172A" }]}>
              {selectedIds.size} नोंदी निवडल्या
            </Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TouchableOpacity
                style={[styles.bulkCancelBtn, { backgroundColor: isDark ? "#334155" : "#E2E8F0" }]}
                onPress={() => setSelectedIds(new Set())}
              >
                <Text style={[styles.bulkCancelBtnText, { color: isDark ? "#CBD5E1" : "#475569" }]}>रद्द करा</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.bulkDeleteBtn}
                onPress={handleDeleteSelected}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="trash" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                    <Text style={styles.bulkDeleteBtnText}>हटवा ({selectedIds.size})</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Section Heading & Refresh */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <Text style={[styles.sectionHeading, { color: isDark ? "#FFFFFF" : "#0F172A", marginBottom: 0 }]}>
            रिअल-टाईम वापरकर्ता इतिहास (Real-Time History):
          </Text>
          <TouchableOpacity
            onPress={handleRefresh}
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: isDark ? "rgba(96, 165, 250, 0.12)" : "#EFF6FF",
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: isDark ? "rgba(96, 165, 250, 0.3)" : "#BFDBFE"
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="sync-outline" size={13} color={isDark ? "#60A5FA" : "#2563EB"} style={{ marginRight: 4 }} />
            <Text style={{ fontSize: 11, color: isDark ? "#60A5FA" : "#2563EB", fontWeight: "600" }}>ताजे करा</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={theme.colors.primaryLight} style={{ marginVertical: 30 }} />
        ) : (
          <>
            {/* Summary Stats Row */}
            <View style={styles.statsRow}>
              <TouchableOpacity
                style={[
                  styles.statPill,
                  {
                    backgroundColor: expandedSection === "calls"
                      ? (isDark ? "rgba(52, 211, 153, 0.2)" : "#ECFDF5")
                      : (isDark ? theme.colors.surface : "#FFFFFF"),
                    borderColor: expandedSection === "calls" ? "#10B981" : (isDark ? "rgba(52, 211, 153, 0.4)" : "#A7F3D0")
                  }
                ]}
                onPress={() => toggleSection("calls")}
                activeOpacity={0.7}
              >
                <Ionicons name="call" size={16} color={isDark ? "#34D399" : "#059669"} />
                <Text style={[styles.statNum, { color: isDark ? "#34D399" : "#059669" }]}>{activityData.call_count}</Text>
                <Text style={[styles.statLbl, { color: isDark ? theme.colors.textMuted : "#64748B" }]}>Calls</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.statPill,
                  {
                    backgroundColor: expandedSection === "sms"
                      ? (isDark ? "rgba(96, 165, 250, 0.2)" : "#EFF6FF")
                      : (isDark ? theme.colors.surface : "#FFFFFF"),
                    borderColor: expandedSection === "sms" ? "#3B82F6" : (isDark ? "rgba(96, 165, 250, 0.4)" : "#BFDBFE")
                  }
                ]}
                onPress={() => toggleSection("sms")}
                activeOpacity={0.7}
              >
                <Ionicons name="chatbubble" size={16} color={isDark ? "#60A5FA" : "#2563EB"} />
                <Text style={[styles.statNum, { color: isDark ? "#60A5FA" : "#2563EB" }]}>{activityData.sms_count}</Text>
                <Text style={[styles.statLbl, { color: isDark ? theme.colors.textMuted : "#64748B" }]}>SMS/WA</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.statPill,
                  {
                    backgroundColor: expandedSection === "locations"
                      ? (isDark ? "rgba(251, 191, 36, 0.2)" : "#FEF3C7")
                      : (isDark ? theme.colors.surface : "#FFFFFF"),
                    borderColor: expandedSection === "locations" ? "#F59E0B" : (isDark ? "rgba(251, 191, 36, 0.4)" : "#FDE68A")
                  }
                ]}
                onPress={() => toggleSection("locations")}
                activeOpacity={0.7}
              >
                <Ionicons name="location" size={16} color={isDark ? "#FBBF24" : "#D97706"} />
                <Text style={[styles.statNum, { color: isDark ? "#FBBF24" : "#D97706" }]}>{activityData.location_count}</Text>
                <Text style={[styles.statLbl, { color: isDark ? theme.colors.textMuted : "#64748B" }]}>Locations</Text>
              </TouchableOpacity>
            </View>

            {/* Card 1: Call History */}
            <TouchableOpacity
              style={[
                styles.activityCard,
                {
                  backgroundColor: isDark ? theme.colors.card : "#FFFFFF",
                  borderColor: expandedSection === "calls"
                    ? (isDark ? "#34D399" : "#10B981")
                    : (isDark ? theme.colors.border : "#E2E8F0")
                }
              ]}
              onPress={() => toggleSection("calls")}
              activeOpacity={0.7}
            >
              <View style={[styles.iconCircle, { backgroundColor: isDark ? "#064E3B" : "#ECFDF5" }]}>
                <Ionicons name="call" size={22} color={isDark ? "#34D399" : "#059669"} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.cardTitleRow}>
                  <Text style={[styles.cardTitle, { color: isDark ? "#FFFFFF" : "#0F172A" }]}>फोन कॉल इतिहास (Call History)</Text>
                  <View style={[styles.pillBadge, { backgroundColor: isDark ? "#064E3B" : "#D1FAE5" }]}>
                    <Text style={[styles.pillText, { color: isDark ? "#34D399" : "#059669" }]}>{activityData.call_count} Calls</Text>
                  </View>
                </View>
                <Text style={[styles.cardSubtitle, { color: isDark ? theme.colors.textMuted : "#64748B" }]}>
                  {activityData.call_count > 0
                    ? `एकूण ${activityData.call_count} प्रत्यक्ष कॉल नोंदवले`
                    : activityData.call_status === "RESTRICTED"
                    ? "डिव्हाइस ॲक्सेस प्रतिबंधित (Restricted by Policy)"
                    : activityData.call_status === "DENIED"
                    ? "कॉल इतिहास परवानगी नाकारली (Permission Denied)"
                    : activityData.call_status === "UNAVAILABLE"
                    ? "कॉल मॉड्यूल उपलब्ध नाही (Module Unavailable)"
                    : "डिव्हाइसवर कॉल इतिहास आढळला नाही (0 Calls)"}
                </Text>
              </View>
              <Ionicons
                name={expandedSection === "calls" ? "chevron-down" : "chevron-forward"}
                size={20}
                color={isDark ? theme.colors.textMuted : "#94A3B8"}
              />
            </TouchableOpacity>

            {expandedSection === "calls" && (
              <View style={[styles.subListCard, { backgroundColor: isDark ? theme.colors.card : "#FFFFFF", borderColor: isDark ? theme.colors.border : "#E2E8F0" }]}>
                <View style={styles.subListHeaderRow}>
                  <Text style={[styles.subListTitle, { color: isDark ? "#FFFFFF" : "#0F172A" }]}>कॉल इतिहास ({activityData.calls.length}):</Text>
                  {activityData.calls.length > 0 && (
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <TouchableOpacity
                        style={[styles.sectionActionBtn, { borderColor: isDark ? "#3B82F6" : "#93C5FD", backgroundColor: isDark ? "transparent" : "#EFF6FF" }]}
                        onPress={() => {
                          const ids = activityData.calls.map(c => c.id).filter(Boolean);
                          const allSelected = ids.every(id => selectedIds.has(id));
                          setSelectedIds(prev => {
                            const next = new Set(prev);
                            ids.forEach(id => (allSelected ? next.delete(id) : next.add(id)));
                            return next;
                          });
                        }}
                      >
                        <Ionicons name="checkbox-outline" size={14} color={isDark ? "#60A5FA" : "#2563EB"} />
                        <Text style={[styles.sectionActionBtnText, { color: isDark ? "#60A5FA" : "#2563EB" }]}>सर्व निवडा</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.sectionActionBtn, { borderColor: "#EF4444", backgroundColor: isDark ? "transparent" : "#FEF2F2" }]}
                        onPress={() => handleClearSection("calls")}
                      >
                        <Ionicons name="trash-outline" size={14} color="#EF4444" />
                        <Text style={[styles.sectionActionBtnText, { color: "#EF4444" }]}>सर्व हटवा</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {activityData.calls.length === 0 ? (
                  <View style={styles.emptyDataBox}>
                    <Ionicons
                      name={
                        activityData.call_status === "RESTRICTED"
                          ? "shield-outline"
                          : activityData.call_status === "DENIED"
                          ? "close-circle-outline"
                          : "call-outline"
                      }
                      size={28}
                      color={
                        activityData.call_status === "RESTRICTED"
                          ? "#F59E0B"
                          : activityData.call_status === "DENIED"
                          ? "#EF4444"
                          : (isDark ? theme.colors.textMuted : "#94A3B8")
                      }
                    />
                    <Text style={[
                      styles.emptySubText,
                      { color: isDark ? theme.colors.textMuted : "#64748B" },
                      activityData.call_status === "RESTRICTED" && { color: isDark ? "#FBBF24" : "#D97706" },
                      activityData.call_status === "DENIED" && { color: "#EF4444" }
                    ]}>
                      {activityData.call_status === "RESTRICTED"
                        ? "डिव्हाइस ॲक्सेस प्रतिबंधित (Restricted by Android / Google Play Policy)\nगुगल प्ले किंवा ओएस धोरणानुसार कॉल लॉग मर्यादित आहे. बनावट नोंदी तयार केल्या जात नाहीत."
                        : activityData.call_status === "DENIED"
                        ? "परवानगी नाकारली (Permission Denied on Device)\nवापरकर्त्याने डिव्हाइसवर कॉल लॉग वाचण्याची परवानगी नाकारली आहे."
                        : activityData.call_status === "UNAVAILABLE"
                        ? "कॉल मॉड्यूल उपलब्ध नाही (Native Module Unavailable)\nडिव्हाइस बिल्डमध्ये कॉल लॉग इंटिग्रेशन उपलब्ध नाही."
                        : "डिव्हाइसवर कॉल इतिहास आढळला नाही (0 Calls)\nपरवानगी मंजूर आहे, परंतु फोनवर कॉल नोंदी उपलब्ध नाहीत."}
                    </Text>
                  </View>
                ) : (
                  activityData.calls.map((call, idx) => {
                    const cid = call.id || `call_${idx}`;
                    const isSelected = selectedIds.has(cid);
                    const callTitle = call.targetMemberName || call.metadata?.name || call.metadata?.voter || "फोन कॉल";
                    const callPhone = call.metadata?.phone || call.metadata?.phoneNumber || call.details || "फोन नंबर उपलब्ध नाही";
                    const callTypeStr = call.metadata?.callTypeMarathi || call.metadata?.callType || "कॉल";

                    return (
                      <View
                        key={cid}
                        style={[
                          styles.subListItem,
                          { borderBottomColor: isDark ? theme.colors.border : "#F1F5F9" },
                          isSelected && (isDark ? styles.subListItemSelected : { backgroundColor: "#EFF6FF", borderRadius: 6, paddingHorizontal: 6 })
                        ]}
                      >
                        <TouchableOpacity
                          style={styles.checkboxTouch}
                          onPress={() => toggleSelectItem(cid)}
                        >
                          <Ionicons
                            name={isSelected ? "checkbox" : "square-outline"}
                            size={20}
                            color={isSelected ? "#3B82F6" : (isDark ? theme.colors.textMuted : "#94A3B8")}
                          />
                        </TouchableOpacity>

                        <View style={[styles.itemIconWrap, { backgroundColor: isDark ? "#064E3B" : "#ECFDF5" }]}>
                          <Ionicons name="call" size={16} color={isDark ? "#34D399" : "#059669"} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                            <Text style={[styles.itemTitle, { color: isDark ? "#FFFFFF" : "#0F172A" }]}>{callTitle}</Text>
                            <View style={{ backgroundColor: isDark ? "rgba(52, 211, 153, 0.15)" : "#D1FAE5", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                              <Text style={{ fontSize: 10, color: isDark ? "#34D399" : "#059669", fontWeight: "600" }}>{callTypeStr}</Text>
                            </View>
                          </View>
                          <Text style={[styles.itemDetail, { color: isDark ? theme.colors.textSecondary : "#475569" }]}>
                            {callPhone}
                            {call.metadata?.duration !== undefined && call.metadata?.duration > 0 ? ` • कालावधी: ${call.metadata.duration} से.` : ""}
                            {call.metadata?.village ? ` • गाव: ${call.metadata.village}` : ""}
                          </Text>
                          <Text style={[styles.itemTime, { color: isDark ? "#64748B" : "#94A3B8" }]}>
                            {call.timestamp ? new Date(call.timestamp).toLocaleString("mr-IN") : "अलीकडे"}
                          </Text>
                        </View>

                        <TouchableOpacity
                          style={styles.deleteSingleBtn}
                          onPress={() => handleDeleteSingle(cid, callTitle)}
                        >
                          <Ionicons name="trash-outline" size={18} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    );
                  })
                )}
              </View>
            )}

            {/* Card 2: SMS & WhatsApp History */}
            <TouchableOpacity
              style={[
                styles.activityCard,
                {
                  backgroundColor: isDark ? theme.colors.card : "#FFFFFF",
                  borderColor: expandedSection === "sms"
                    ? (isDark ? "#60A5FA" : "#3B82F6")
                    : (isDark ? theme.colors.border : "#E2E8F0")
                }
              ]}
              onPress={() => toggleSection("sms")}
              activeOpacity={0.7}
            >
              <View style={[styles.iconCircle, { backgroundColor: isDark ? "#1E3A8A" : "#EFF6FF" }]}>
                <Ionicons name="chatbubbles" size={22} color={isDark ? "#60A5FA" : "#2563EB"} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.cardTitleRow}>
                  <Text style={[styles.cardTitle, { color: isDark ? "#FFFFFF" : "#0F172A" }]}>एसएमएस व व्हॉट्सॲप इतिहास (SMS History)</Text>
                  <View style={[styles.pillBadge, { backgroundColor: isDark ? "#1E3A8A" : "#DBEAFE" }]}>
                    <Text style={[styles.pillText, { color: isDark ? "#60A5FA" : "#1D4ED8" }]}>{activityData.sms_count} Messages</Text>
                  </View>
                </View>
                <Text style={[styles.cardSubtitle, { color: isDark ? theme.colors.textMuted : "#64748B" }]}>
                  {activityData.sms_count > 0
                    ? `एकूण ${activityData.sms_count} संदेश/मेटाडेटा नोंदवले`
                    : activityData.sms_status === "RESTRICTED"
                    ? "डिव्हाइस ॲक्सेस प्रतिबंधित (Restricted by Policy)"
                    : activityData.sms_status === "DENIED"
                    ? "एसएमएस परवानगी नाकारली (Permission Denied)"
                    : activityData.sms_status === "UNAVAILABLE"
                    ? "एसएमएस मॉड्यूल उपलब्ध नाही (Module Unavailable)"
                    : "डिव्हाइसवर संदेश इतिहास आढळला नाही (0 Messages)"}
                </Text>
              </View>
              <Ionicons
                name={expandedSection === "sms" ? "chevron-down" : "chevron-forward"}
                size={20}
                color={isDark ? theme.colors.textMuted : "#94A3B8"}
              />
            </TouchableOpacity>

            {expandedSection === "sms" && (
              <View style={[styles.subListCard, { backgroundColor: isDark ? theme.colors.card : "#FFFFFF", borderColor: isDark ? theme.colors.border : "#E2E8F0" }]}>
                <View style={styles.subListHeaderRow}>
                  <Text style={[styles.subListTitle, { color: isDark ? "#FFFFFF" : "#0F172A" }]}>एसएमएस व व्हॉट्सॲप ({activityData.sms.length}):</Text>
                  {activityData.sms.length > 0 && (
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <TouchableOpacity
                        style={[styles.sectionActionBtn, { borderColor: isDark ? "#3B82F6" : "#93C5FD", backgroundColor: isDark ? "transparent" : "#EFF6FF" }]}
                        onPress={() => {
                          const ids = activityData.sms.map(s => s.id).filter(Boolean);
                          const allSelected = ids.every(id => selectedIds.has(id));
                          setSelectedIds(prev => {
                            const next = new Set(prev);
                            ids.forEach(id => (allSelected ? next.delete(id) : next.add(id)));
                            return next;
                          });
                        }}
                      >
                        <Ionicons name="checkbox-outline" size={14} color={isDark ? "#60A5FA" : "#2563EB"} />
                        <Text style={[styles.sectionActionBtnText, { color: isDark ? "#60A5FA" : "#2563EB" }]}>सर्व निवडा</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.sectionActionBtn, { borderColor: "#EF4444", backgroundColor: isDark ? "transparent" : "#FEF2F2" }]}
                        onPress={() => handleClearSection("sms")}
                      >
                        <Ionicons name="trash-outline" size={14} color="#EF4444" />
                        <Text style={[styles.sectionActionBtnText, { color: "#EF4444" }]}>सर्व हटवा</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {activityData.sms.length === 0 ? (
                  <View style={styles.emptyDataBox}>
                    <Ionicons
                      name={
                        activityData.sms_status === "RESTRICTED"
                          ? "shield-outline"
                          : activityData.sms_status === "DENIED"
                          ? "close-circle-outline"
                          : "chatbubble-outline"
                      }
                      size={28}
                      color={
                        activityData.sms_status === "RESTRICTED"
                          ? "#F59E0B"
                          : activityData.sms_status === "DENIED"
                          ? "#EF4444"
                          : (isDark ? theme.colors.textMuted : "#94A3B8")
                      }
                    />
                    <Text style={[
                      styles.emptySubText,
                      { color: isDark ? theme.colors.textMuted : "#64748B" },
                      activityData.sms_status === "RESTRICTED" && { color: isDark ? "#FBBF24" : "#D97706" },
                      activityData.sms_status === "DENIED" && { color: "#EF4444" }
                    ]}>
                      {activityData.sms_status === "RESTRICTED"
                        ? "डिव्हाइस ॲक्सेस प्रतिबंधित (Restricted by Android / Google Play Policy)\nएसएमएस धोरणानुसार ॲक्सेस प्रतिबंधित आहे. बनावट संदेश नोंदी तयार केल्या जात नाहीत."
                        : activityData.sms_status === "DENIED"
                        ? "परवानगी नाकारली (Permission Denied on Device)\nवापरकर्त्याने डिव्हाइसवर एसएमएस परवानगी नाकारली आहे."
                        : activityData.sms_status === "UNAVAILABLE"
                        ? "एसएमएस मॉड्यूल उपलब्ध नाही (Native Module Unavailable)\nडिव्हाइस बिल्डमध्ये एसएमएस इंटिग्रेशन उपलब्ध नाही."
                        : "डिव्हाइसवर संदेश इतिहास आढळला नाही (0 Messages)\nपरवानगी मंजूर आहे, परंतु फोनवर संदेश उपलब्ध नाहीत."}
                    </Text>
                  </View>
                ) : (
                  activityData.sms.map((msg, idx) => {
                    const mid = msg.id || `sms_${idx}`;
                    const isSelected = selectedIds.has(mid);
                    const msgTitle = msg.targetMemberName || msg.metadata?.voter || msg.metadata?.address || msg.metadata?.phone || "मतदार संदेश";
                    const fullSmsBody = msg.metadata?.body || msg.metadata?.message || msg.metadata?.preview || (msg.details !== "संदेश पाठवला" ? msg.details : null);

                    return (
                      <View
                        key={mid}
                        style={[
                          styles.subListItem,
                          { borderBottomColor: isDark ? theme.colors.border : "#F1F5F9" },
                          isSelected && (isDark ? styles.subListItemSelected : { backgroundColor: "#EFF6FF", borderRadius: 6, paddingHorizontal: 6 })
                        ]}
                      >
                        <TouchableOpacity
                          style={styles.checkboxTouch}
                          onPress={() => toggleSelectItem(mid)}
                        >
                          <Ionicons
                            name={isSelected ? "checkbox" : "square-outline"}
                            size={20}
                            color={isSelected ? "#3B82F6" : (isDark ? theme.colors.textMuted : "#94A3B8")}
                          />
                        </TouchableOpacity>

                        <View style={[styles.itemIconWrap, { backgroundColor: isDark ? "#1E3A8A" : "#EFF6FF" }]}>
                          <Ionicons
                            name={msg.action?.includes("WHATSAPP") ? "logo-whatsapp" : "chatbubble"}
                            size={16}
                            color={msg.action?.includes("WHATSAPP") ? "#22C55E" : (isDark ? "#60A5FA" : "#2563EB")}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                            <Text style={[styles.itemTitle, { color: isDark ? "#FFFFFF" : "#0F172A" }]}>{msgTitle}</Text>
                            {msg.metadata?.type ? (
                              <View style={{ backgroundColor: isDark ? "rgba(96, 165, 250, 0.15)" : "#EFF6FF", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                                <Text style={{ fontSize: 10, color: isDark ? "#93C5FD" : "#2563EB", fontWeight: "600" }}>{msg.metadata.type}</Text>
                              </View>
                            ) : null}
                          </View>

                          {/* Full SMS Body text bubble */}
                          {fullSmsBody ? (
                            <View
                              style={{
                                backgroundColor: isDark ? "rgba(30, 58, 138, 0.25)" : "#F8FAFC",
                                borderColor: isDark ? "rgba(96, 165, 250, 0.3)" : "#E2E8F0",
                                borderWidth: 1,
                                borderRadius: 8,
                                padding: 8,
                                marginVertical: 5
                              }}
                            >
                              <Text style={{ fontSize: 10, fontWeight: "700", color: isDark ? "#93C5FD" : "#475569", marginBottom: 2 }}>
                                {msg.action?.includes("WHATSAPP") ? "व्हॉट्सॲप संदेश मजकूर (WhatsApp Message):" : "एसएमएस मजकूर (SMS Body):"}
                              </Text>
                              <Text
                                style={{ fontSize: 12, color: isDark ? "#F1F5F9" : "#1E293B", lineHeight: 18 }}
                                selectable
                              >
                                {fullSmsBody}
                              </Text>
                            </View>
                          ) : null}

                          <Text style={[styles.itemDetail, { color: isDark ? theme.colors.textSecondary : "#475569" }]}>
                            {msg.metadata?.phone ? `मोबाईल: ${msg.metadata.phone}` : (msg.details || "संदेश पाठवला")}
                            {msg.metadata?.date ? ` • तारीख: ${msg.metadata.date}` : ""}
                          </Text>
                          <Text style={[styles.itemTime, { color: isDark ? "#64748B" : "#94A3B8" }]}>
                            {msg.timestamp ? new Date(msg.timestamp).toLocaleString("mr-IN") : "अलीकडे"}
                          </Text>
                        </View>

                        <TouchableOpacity
                          style={styles.deleteSingleBtn}
                          onPress={() => handleDeleteSingle(mid, msgTitle)}
                        >
                          <Ionicons name="trash-outline" size={18} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    );
                  })
                )}
              </View>
            )}

            {/* Card 3: Location History */}
            <TouchableOpacity
              style={[
                styles.activityCard,
                {
                  backgroundColor: isDark ? theme.colors.card : "#FFFFFF",
                  borderColor: expandedSection === "locations"
                    ? (isDark ? "#FBBF24" : "#F59E0B")
                    : (isDark ? theme.colors.border : "#E2E8F0")
                }
              ]}
              onPress={() => toggleSection("locations")}
              activeOpacity={0.7}
            >
              <View style={[styles.iconCircle, { backgroundColor: isDark ? "#78350F" : "#FEF3C7" }]}>
                <Ionicons name="location" size={22} color={isDark ? "#FBBF24" : "#D97706"} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.cardTitleRow}>
                  <Text style={[styles.cardTitle, { color: isDark ? "#FFFFFF" : "#0F172A" }]}>स्थान / लोकेशन इतिहास (Location History)</Text>
                  <View style={[styles.pillBadge, { backgroundColor: isDark ? "#78350F" : "#FEF3C7" }]}>
                    <Text style={[styles.pillText, { color: isDark ? "#FBBF24" : "#B45309" }]}>{activityData.location_count} Check-ins</Text>
                  </View>
                </View>
                <Text style={[styles.cardSubtitle, { color: isDark ? theme.colors.textMuted : "#64748B" }]}>
                  {activityData.location_count > 0
                    ? `एकूण ${activityData.location_count} रिअल-टाईम स्थान नोंदी`
                    : "कोणतीही लोकेशन नोंद उपलब्ध नाही"}
                </Text>
              </View>
              <Ionicons
                name={expandedSection === "locations" ? "chevron-down" : "chevron-forward"}
                size={20}
                color={isDark ? theme.colors.textMuted : "#94A3B8"}
              />
            </TouchableOpacity>

            {expandedSection === "locations" && (
              <View style={[styles.subListCard, { backgroundColor: isDark ? theme.colors.card : "#FFFFFF", borderColor: isDark ? theme.colors.border : "#E2E8F0" }]}>
                <View style={styles.subListHeaderRow}>
                  <Text style={[styles.subListTitle, { color: isDark ? "#FFFFFF" : "#0F172A" }]}>लोकेशन इतिहास ({activityData.locations.length}):</Text>
                  {activityData.locations.length > 0 && (
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <TouchableOpacity
                        style={[styles.sectionActionBtn, { borderColor: isDark ? "#3B82F6" : "#93C5FD", backgroundColor: isDark ? "transparent" : "#EFF6FF" }]}
                        onPress={() => {
                          const ids = activityData.locations.map(l => l.id).filter(Boolean);
                          const allSelected = ids.every(id => selectedIds.has(id));
                          setSelectedIds(prev => {
                            const next = new Set(prev);
                            ids.forEach(id => (allSelected ? next.delete(id) : next.add(id)));
                            return next;
                          });
                        }}
                      >
                        <Ionicons name="checkbox-outline" size={14} color={isDark ? "#60A5FA" : "#2563EB"} />
                        <Text style={[styles.sectionActionBtnText, { color: isDark ? "#60A5FA" : "#2563EB" }]}>सर्व निवडा</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.sectionActionBtn, { borderColor: "#EF4444", backgroundColor: isDark ? "transparent" : "#FEF2F2" }]}
                        onPress={() => handleClearSection("locations")}
                      >
                        <Ionicons name="trash-outline" size={14} color="#EF4444" />
                        <Text style={[styles.sectionActionBtnText, { color: "#EF4444" }]}>सर्व हटवा</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {activityData.locations.length === 0 ? (
                  <View style={styles.emptyDataBox}>
                    <Ionicons name="location-outline" size={28} color={isDark ? theme.colors.textMuted : "#94A3B8"} />
                    <Text style={[styles.emptySubText, { color: isDark ? theme.colors.textMuted : "#64748B" }]}>कोणतीही लोकेशन नोंद उपलब्ध नाही</Text>
                  </View>
                ) : (
                  activityData.locations.map((loc, idx) => {
                    const lid = loc.id || `loc_${idx}`;
                    const isSelected = selectedIds.has(lid);
                    const lat = loc.metadata?.latitude ?? loc.latitude;
                    const lon = loc.metadata?.longitude ?? loc.longitude;
                    const isGenericName = (s?: string | null): boolean => {
                      if (!s) return true;
                      const clean = s.trim().toLowerCase();
                      if (clean === "" || clean === "null" || clean === "undefined") return true;
                      if (clean === "road" || clean === "street" || clean === "lane" || clean === "rasta" || clean === "मार्ग" || clean === "रस्ता") return true;
                      if (clean.includes("division") || clean.includes("विभाग")) return true;
                      if (clean.includes("unnamed") || clean.includes("बिननावाचा")) return true;
                      if (clean === "maharashtra" || clean === "india" || clean === "महाराष्ट्र" || clean === "भारत") return true;
                      return false;
                    };

                    const rawPlace = loc.metadata?.placeName || loc.metadata?.village || loc.metadata?.city;
                    const fullAddress = loc.metadata?.address;
                    let displayPlace = "";

                    if (rawPlace && !isGenericName(rawPlace)) {
                      displayPlace = rawPlace;
                    } else if (fullAddress) {
                      const parts = fullAddress.split(",").map(p => p.trim()).filter(p => !isGenericName(p) && !p.includes("पिन:") && !p.toLowerCase().includes("maharashtra") && !p.toLowerCase().includes("महाराष्ट्र"));
                      if (parts.length > 0) {
                        displayPlace = parts[0];
                      }
                    }

                    if (!displayPlace || isGenericName(displayPlace)) {
                      displayPlace = (loc.details?.includes(":") ? loc.details.split(":")[1]?.trim() : loc.details) || (hasCoords ? `GPS (${typeof lat === 'number' ? lat.toFixed(4) : lat}, ${typeof lon === 'number' ? lon.toFixed(4) : lon})` : "नोंदवलेले स्थान");
                    }

                    const placeName = displayPlace;
                    const locTitle = placeName;
                    const dateStr = loc.metadata?.date || (loc.timestamp ? new Date(loc.timestamp).toLocaleDateString("en-GB") : "-");
                    const timeStr = loc.metadata?.time || (loc.timestamp ? new Date(loc.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }) : "-");

                    return (
                      <View
                        key={lid}
                        style={[
                          styles.subListItem,
                          { borderBottomColor: isDark ? theme.colors.border : "#F1F5F9" },
                          isSelected && (isDark ? styles.subListItemSelected : { backgroundColor: "#EFF6FF", borderRadius: 6, paddingHorizontal: 6 })
                        ]}
                      >
                        <TouchableOpacity
                          style={styles.checkboxTouch}
                          onPress={() => toggleSelectItem(lid)}
                        >
                          <Ionicons
                            name={isSelected ? "checkbox" : "square-outline"}
                            size={20}
                            color={isSelected ? "#3B82F6" : (isDark ? theme.colors.textMuted : "#94A3B8")}
                          />
                        </TouchableOpacity>

                        <View style={[styles.itemIconWrap, { backgroundColor: isDark ? "#78350F" : "#FEF3C7" }]}>
                          <Ionicons name="navigate" size={16} color={isDark ? "#FBBF24" : "#D97706"} />
                        </View>
                        <View style={{ flex: 1 }}>
                          {/* Name of Place */}
                          <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, marginBottom: 3 }}>
                            <Text style={[styles.itemTitle, { color: isDark ? "#FFFFFF" : "#0F172A" }]}>📍 {placeName}</Text>
                            <View style={{ backgroundColor: isDark ? "rgba(245, 158, 11, 0.2)" : "#FEF3C7", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                              <Text style={{ color: isDark ? "#FBBF24" : "#B45309", fontSize: 10, fontWeight: "700" }}>ठिकाण</Text>
                            </View>
                          </View>

                          {/* Latitude and Longitude */}
                          {hasCoords ? (
                            <Text style={[styles.coordsText, { color: isDark ? "#FBBF24" : "#D97706" }]}>
                              🌐 अक्षांश: {typeof lat === "number" ? lat.toFixed(5) : lat}, रेखांश: {typeof lon === "number" ? lon.toFixed(5) : lon}
                              {loc.metadata?.accuracy ? ` (±${Math.round(loc.metadata.accuracy)} मी.)` : ""}
                            </Text>
                          ) : null}

                          {/* Date and Time Correctly */}
                          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 3 }}>
                            <Ionicons name="calendar-outline" size={12} color={isDark ? "#94A3B8" : "#64748B"} style={{ marginRight: 4 }} />
                            <Text style={{ color: isDark ? "#94A3B8" : "#64748B", fontSize: 11, fontWeight: "600" }}>
                              दिनांक: {dateStr}  •  वेळ: {timeStr}
                            </Text>
                          </View>

                          {/* Full address if available */}
                          {fullAddress && fullAddress !== placeName ? (
                            <Text style={[styles.itemDetail, { color: isDark ? theme.colors.textSecondary : "#475569" }]}>
                              🏠 {fullAddress}
                            </Text>
                          ) : null}
                        </View>

                        <TouchableOpacity
                          style={styles.deleteSingleBtn}
                          onPress={() => handleDeleteSingle(lid, locTitle)}
                        >
                          <Ionicons name="trash-outline" size={18} color="#EF4444" />
                        </TouchableOpacity>
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
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  emptyTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    marginTop: 12,
  },
  emptySubText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    textAlign: "center",
    marginTop: 6,
  },
  backBtn: {
    marginTop: 20,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  backBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  userBadgeCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1E3A8A",
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    marginBottom: 12,
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
  devicePermBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  devicePermText: {
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
  permissionInfoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "rgba(30, 58, 138, 0.3)",
    padding: 12,
    borderRadius: theme.borderRadius.md,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.3)",
  },
  permissionInfoText: {
    flex: 1,
    color: "#BFDBFE",
    fontSize: 11,
    lineHeight: 16,
  },
  accessControlCard: {
    backgroundColor: "#0F172A",
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: "#10B981",
  },
  accessDeniedCard: {
    borderColor: "#EF4444",
    backgroundColor: "#1C1117",
  },
  accessControlHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  accessControlTitle: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  accessStatusText: {
    fontSize: 12,
    fontWeight: "800",
    marginTop: 2,
  },
  accessDescription: {
    color: theme.colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
    marginBottom: 12,
  },
  accessActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: theme.borderRadius.md,
  },
  denyBtn: {
    backgroundColor: "#DC2626",
  },
  allowBtn: {
    backgroundColor: "#059669",
  },
  accessActionBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  sectionHeading: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 14,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  statPill: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  activePill: {
    backgroundColor: "#1E293B",
  },
  statNum: {
    fontSize: 16,
    fontWeight: "800",
    marginTop: 4,
  },
  statLbl: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontWeight: "600",
    marginTop: 2,
  },
  activityCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  activeCardBorder: {
    borderColor: theme.colors.primaryLight,
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
    justifyContent: "space-between",
    marginBottom: 4,
    marginRight: 6,
  },
  cardTitle: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: "700",
    flex: 1,
  },
  cardSubtitle: {
    color: theme.colors.textMuted,
    fontSize: 12,
  },
  pillBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  pillText: {
    fontSize: 11,
    fontWeight: "700",
  },
  subListCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.md,
    padding: 14,
    marginBottom: 14,
    marginTop: -4,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  subListTitle: {
    color: theme.colors.textPrimary,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 10,
  },
  subListItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  itemIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
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
    color: theme.colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  coordsText: {
    color: "#FBBF24",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },
  itemTime: {
    color: "#64748B",
    fontSize: 10,
    marginTop: 4,
  },
  emptyDataBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
  },
  bulkActionBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#1E293B",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#3B82F6",
  },
  bulkActionText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  bulkCancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#334155",
  },
  bulkCancelBtnText: {
    color: "#CBD5E1",
    fontSize: 12,
    fontWeight: "600",
  },
  bulkDeleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#EF4444",
  },
  bulkDeleteBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  subListHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  sectionActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#3B82F6",
    gap: 4,
  },
  sectionActionBtnText: {
    color: "#60A5FA",
    fontSize: 11,
    fontWeight: "700",
  },
  checkboxTouch: {
    paddingRight: 8,
    paddingTop: 4,
  },
  subListItemSelected: {
    backgroundColor: "rgba(59, 130, 246, 0.08)",
    borderRadius: 6,
    paddingHorizontal: 6,
  },
  deleteSingleBtn: {
    padding: 6,
    marginLeft: 6,
    alignSelf: "center",
  },
  workerSearchCard: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  workerSearchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 4,
  },
  workerInfoCard: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  workerInfoTitle: {
    fontSize: 13,
    fontWeight: "700",
  },
  workerInfoSub: {
    fontSize: 11,
    marginTop: 2,
  },
  workerRowCard: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginVertical: 4,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  workerAvatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  workerRowName: {
    fontSize: 15,
    fontWeight: "700",
    flex: 1,
  },
  workerRowSub: {
    fontSize: 12,
    marginTop: 2,
  },
  statusBadgeSmall: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 6,
  },
  statusBadgeSmallText: {
    fontSize: 11,
    fontWeight: "700",
  },
  switchWorkerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 4,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
  },
  switchWorkerBtnText: {
    fontSize: 12,
    fontWeight: "700",
  },
  loadingText: {
    fontSize: 13,
    marginTop: 10,
  },
});


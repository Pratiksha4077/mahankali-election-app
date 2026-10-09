import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, ActivityIndicator, RefreshControl, Alert
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Header } from "../../components/Header";
import { adminAPI } from "../../api/client";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import { theme } from "../../theme/theme";

export const UserActivityScreen: React.FC<{ route: any; navigation: any }> = ({ route, navigation }) => {
  const user = route.params?.user;
  const { t } = useLanguage();
  const { theme } = useTheme();

  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [updatingAccess, setUpdatingAccess] = useState<boolean>(false);
  const [expandedSection, setExpandedSection] = useState<"calls" | "sms" | "locations" | null>("calls");

  // Selection & Deletion State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // User state synchronized with live database
  const [currentUser, setCurrentUser] = useState<any>(user || null);
  const [isAccessAllowed, setIsAccessAllowed] = useState<boolean>(
    user ? (user.is_active !== false && user.accountStatus !== "DISABLED") : true
  );
  const [hasDevicePerms, setHasDevicePerms] = useState<boolean>(
    user ? user.permissions_granted === true : false
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

  const loadUserActivities = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const uid = String(user.id || user._id || "");

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
      const res = await adminAPI.getUserActivity(uid, user.username);
      const data = res?.data || res;
      if (data) {
        const calls = Array.isArray(data.calls) ? data.calls : [];
        const sms = Array.isArray(data.sms) ? data.sms : [];
        const locations = Array.isArray(data.locations) ? data.locations : [];

        const cStatus = data.call_status || (freshUserData?.permissions?.callHistory ? "GRANTED" : "DENIED");
        const sStatus = data.sms_status || (freshUserData?.permissions?.sms ? "GRANTED" : "DENIED");

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
      console.error("Failed to load user activity:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    loadUserActivities();
  }, [loadUserActivities]);

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
    const uid = String(currentUser.id || currentUser._id || user?.id || user?._id || "");
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
            const uid = String(currentUser?.id || user?.id || "");
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
            const uid = String(currentUser?.id || user?.id || "");
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
            const uid = String(currentUser?.id || user?.id || "");
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

  if (!user) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header title="User Activity" showBack onBack={() => navigation.goBack()} />
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={theme.colors.error} />
          <Text style={styles.emptyTitle}>कोणताही वापरकर्ता निवडलेला नाही</Text>
          <Text style={styles.emptySubText}>कृपया वापरकर्ता यादीमधून वापरकर्ता निवडा.</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backBtnText}>मागे जा (Go Back)</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const displayName = currentUser?.fullName || currentUser?.username || user.fullName || user.username;
  const displayMobile = currentUser?.mobileNumber || currentUser?.mobile || user.mobileNumber || user.mobile || "-";

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title={displayName}
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
            <Text style={styles.userName}>{displayName}</Text>
            <Text style={styles.userMobile}>मोबाईल: {displayMobile}</Text>

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
                <Text style={[styles.devicePermText, { color: currentUser?.permissions?.location ? "#34D399" : "#F87171" }]}>
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
                <Text style={[styles.devicePermText, { color: (currentUser?.permissions?.callHistory ?? currentUser?.permissions?.phoneCall) ? "#34D399" : "#F87171" }]}>
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
                <Text style={[styles.devicePermText, { color: currentUser?.permissions?.sms ? "#34D399" : "#F87171" }]}>
                  SMS: {currentUser?.permissions?.sms ? "मंजूर" : "नाकारले"}
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>{currentUser?.role || user.role}</Text>
          </View>
        </View>

        {/* Admin Access Control Card (Deny or Allow User Panel Access) */}
        <View style={[styles.accessControlCard, !isAccessAllowed && styles.accessDeniedCard]}>
          <View style={styles.accessControlHeader}>
            <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
              <Ionicons
                name={isAccessAllowed ? "shield-checkmark" : "ban"}
                size={22}
                color={isAccessAllowed ? "#10B981" : "#EF4444"}
                style={{ marginRight: 8 }}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.accessControlTitle}>ॲडमिन प्रवेश नियंत्रण (Admin Access Control)</Text>
                <Text style={[styles.accessStatusText, { color: isAccessAllowed ? "#34D399" : "#F87171" }]}>
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
          <View style={styles.bulkActionBar}>
            <Text style={styles.bulkActionText}>
              {selectedIds.size} नोंदी निवडल्या
            </Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TouchableOpacity
                style={styles.bulkCancelBtn}
                onPress={() => setSelectedIds(new Set())}
              >
                <Text style={styles.bulkCancelBtnText}>रद्द करा</Text>
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
          <Text style={[styles.sectionHeading, { marginBottom: 0 }]}>रिअल-टाईम वापरकर्ता इतिहास (Real-Time History):</Text>
          <TouchableOpacity
            onPress={handleRefresh}
            style={{ flexDirection: "row", alignItems: "center", backgroundColor: "rgba(96, 165, 250, 0.12)", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: "rgba(96, 165, 250, 0.3)" }}
            activeOpacity={0.7}
          >
            <Ionicons name="sync-outline" size={13} color="#60A5FA" style={{ marginRight: 4 }} />
            <Text style={{ fontSize: 11, color: "#60A5FA", fontWeight: "600" }}>ताजे करा</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={theme.colors.primaryLight} style={{ marginVertical: 30 }} />
        ) : (
          <>
            {/* Summary Stats Row */}
            <View style={styles.statsRow}>
              <TouchableOpacity
                style={[styles.statPill, { borderColor: "#34D399" }, expandedSection === "calls" && styles.activePill]}
                onPress={() => toggleSection("calls")}
                activeOpacity={0.7}
              >
                <Ionicons name="call" size={16} color="#34D399" />
                <Text style={[styles.statNum, { color: "#34D399" }]}>{activityData.call_count}</Text>
                <Text style={styles.statLbl}>Calls</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.statPill, { borderColor: "#60A5FA" }, expandedSection === "sms" && styles.activePill]}
                onPress={() => toggleSection("sms")}
                activeOpacity={0.7}
              >
                <Ionicons name="chatbubble" size={16} color="#60A5FA" />
                <Text style={[styles.statNum, { color: "#60A5FA" }]}>{activityData.sms_count}</Text>
                <Text style={styles.statLbl}>SMS/WA</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.statPill, { borderColor: "#FBBF24" }, expandedSection === "locations" && styles.activePill]}
                onPress={() => toggleSection("locations")}
                activeOpacity={0.7}
              >
                <Ionicons name="location" size={16} color="#FBBF24" />
                <Text style={[styles.statNum, { color: "#FBBF24" }]}>{activityData.location_count}</Text>
                <Text style={styles.statLbl}>Locations</Text>
              </TouchableOpacity>
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
                color={theme.colors.textMuted}
              />
            </TouchableOpacity>

            {expandedSection === "calls" && (
              <View style={styles.subListCard}>
                <View style={styles.subListHeaderRow}>
                  <Text style={styles.subListTitle}>कॉल इतिहास ({activityData.calls.length}):</Text>
                  {activityData.calls.length > 0 && (
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <TouchableOpacity
                        style={styles.sectionActionBtn}
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
                        <Ionicons name="checkbox-outline" size={14} color="#60A5FA" />
                        <Text style={styles.sectionActionBtnText}>सर्व निवडा</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.sectionActionBtn, { borderColor: "#EF4444" }]}
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
                          : theme.colors.textMuted
                      }
                    />
                    <Text style={[
                      styles.emptySubText,
                      activityData.call_status === "RESTRICTED" && { color: "#FBBF24" },
                      activityData.call_status === "DENIED" && { color: "#F87171" }
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
                      <View key={cid} style={[styles.subListItem, isSelected && styles.subListItemSelected]}>
                        <TouchableOpacity
                          style={styles.checkboxTouch}
                          onPress={() => toggleSelectItem(cid)}
                        >
                          <Ionicons
                            name={isSelected ? "checkbox" : "square-outline"}
                            size={20}
                            color={isSelected ? "#60A5FA" : theme.colors.textMuted}
                          />
                        </TouchableOpacity>

                        <View style={[styles.itemIconWrap, { backgroundColor: "#064E3B" }]}>
                          <Ionicons name="call" size={16} color="#34D399" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                            <Text style={styles.itemTitle}>{callTitle}</Text>
                            <View style={{ backgroundColor: "rgba(52, 211, 153, 0.15)", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                              <Text style={{ fontSize: 10, color: "#34D399", fontWeight: "600" }}>{callTypeStr}</Text>
                            </View>
                          </View>
                          <Text style={styles.itemDetail}>
                            {callPhone}
                            {call.metadata?.duration !== undefined && call.metadata?.duration > 0 ? ` • कालावधी: ${call.metadata.duration} से.` : ""}
                            {call.metadata?.village ? ` • गाव: ${call.metadata.village}` : ""}
                          </Text>
                          <Text style={styles.itemTime}>
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
              style={[styles.activityCard, expandedSection === "sms" && styles.activeCardBorder]}
              onPress={() => toggleSection("sms")}
              activeOpacity={0.7}
            >
              <View style={[styles.iconCircle, { backgroundColor: "#1E3A8A" }]}>
                <Ionicons name="chatbubbles" size={22} color="#60A5FA" />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.cardTitleRow}>
                  <Text style={styles.cardTitle}>एसएमएस व व्हॉट्सॲप इतिहास (SMS History)</Text>
                  <View style={[styles.pillBadge, { backgroundColor: "#1E3A8A" }]}>
                    <Text style={[styles.pillText, { color: "#60A5FA" }]}>{activityData.sms_count} Messages</Text>
                  </View>
                </View>
                <Text style={styles.cardSubtitle}>
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
                color={theme.colors.textMuted}
              />
            </TouchableOpacity>

            {expandedSection === "sms" && (
              <View style={styles.subListCard}>
                <View style={styles.subListHeaderRow}>
                  <Text style={styles.subListTitle}>एसएमएस व व्हॉट्सॲप ({activityData.sms.length}):</Text>
                  {activityData.sms.length > 0 && (
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <TouchableOpacity
                        style={styles.sectionActionBtn}
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
                        <Ionicons name="checkbox-outline" size={14} color="#60A5FA" />
                        <Text style={styles.sectionActionBtnText}>सर्व निवडा</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.sectionActionBtn, { borderColor: "#EF4444" }]}
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
                          : theme.colors.textMuted
                      }
                    />
                    <Text style={[
                      styles.emptySubText,
                      activityData.sms_status === "RESTRICTED" && { color: "#FBBF24" },
                      activityData.sms_status === "DENIED" && { color: "#F87171" }
                    ]}>
                      {activityData.sms_status === "RESTRICTED"
                        ? "डिव्हाइस ॲक्सेस प्रतिबंधित (Restricted by Android / Google Play Policy)\nएसएमएस धोरणानुसार ॲक्सेस प्रतिबंधित आहे. संदेश मजकूर सुरक्षिततेसाठी गोळा केला जात नाही."
                        : activityData.sms_status === "DENIED"
                        ? "परवानगी नाकारली (Permission Denied on Device)\nवापरकर्त्याने डिव्हाइसवर एसएमएस परवानगी नाकारली आहे."
                        : activityData.sms_status === "UNAVAILABLE"
                        ? "एसएमएस मॉड्यूल उपलब्ध नाही (Native Module Unavailable)\nडिव्हाइस बिल्डमध्ये एसएमएस इंटिग्रेशन उपलब्ध नाही."
                        : "डिव्हाइसवर संदेश इतिहास आढळला नाही (0 Messages)\nपरवानगी मंजूर आहे, परंतु फोनवर संदेश मेटाडेटा उपलब्ध नाही."}
                    </Text>
                  </View>
                ) : (
                  activityData.sms.map((msg, idx) => {
                    const mid = msg.id || `sms_${idx}`;
                    const isSelected = selectedIds.has(mid);
                    const msgTitle = msg.targetMemberName || msg.metadata?.voter || "मतदार संदेश";

                    return (
                      <View key={mid} style={[styles.subListItem, isSelected && styles.subListItemSelected]}>
                        <TouchableOpacity
                          style={styles.checkboxTouch}
                          onPress={() => toggleSelectItem(mid)}
                        >
                          <Ionicons
                            name={isSelected ? "checkbox" : "square-outline"}
                            size={20}
                            color={isSelected ? "#60A5FA" : theme.colors.textMuted}
                          />
                        </TouchableOpacity>

                        <View style={[styles.itemIconWrap, { backgroundColor: "#1E3A8A" }]}>
                          <Ionicons
                            name={msg.action?.includes("WHATSAPP") ? "logo-whatsapp" : "chatbubble"}
                            size={16}
                            color={msg.action?.includes("WHATSAPP") ? "#22C55E" : "#60A5FA"}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.itemTitle}>{msgTitle}</Text>
                          <Text style={styles.itemDetail}>
                            {msg.details || (msg.metadata?.phone ? `मोबाईल: ${msg.metadata.phone}` : "संदेश पाठवला")}
                          </Text>
                          <Text style={styles.itemTime}>
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
              style={[styles.activityCard, expandedSection === "locations" && styles.activeCardBorder]}
              onPress={() => toggleSection("locations")}
              activeOpacity={0.7}
            >
              <View style={[styles.iconCircle, { backgroundColor: "#78350F" }]}>
                <Ionicons name="location" size={22} color="#FBBF24" />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.cardTitleRow}>
                  <Text style={styles.cardTitle}>स्थान / लोकेशन इतिहास (Location History)</Text>
                  <View style={[styles.pillBadge, { backgroundColor: "#78350F" }]}>
                    <Text style={[styles.pillText, { color: "#FBBF24" }]}>{activityData.location_count} Check-ins</Text>
                  </View>
                </View>
                <Text style={styles.cardSubtitle}>
                  {activityData.location_count > 0
                    ? `एकूण ${activityData.location_count} रिअल-टाईम स्थान नोंदी`
                    : "कोणतीही लोकेशन नोंद उपलब्ध नाही"}
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
                <View style={styles.subListHeaderRow}>
                  <Text style={styles.subListTitle}>लोकेशन इतिहास ({activityData.locations.length}):</Text>
                  {activityData.locations.length > 0 && (
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <TouchableOpacity
                        style={styles.sectionActionBtn}
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
                        <Ionicons name="checkbox-outline" size={14} color="#60A5FA" />
                        <Text style={styles.sectionActionBtnText}>सर्व निवडा</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.sectionActionBtn, { borderColor: "#EF4444" }]}
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
                    <Ionicons name="location-outline" size={28} color={theme.colors.textMuted} />
                    <Text style={styles.emptySubText}>कोणतीही लोकेशन नोंद उपलब्ध नाही</Text>
                  </View>
                ) : (
                  activityData.locations.map((loc, idx) => {
                    const lid = loc.id || `loc_${idx}`;
                    const isSelected = selectedIds.has(lid);
                    const lat = loc.metadata?.latitude ?? loc.latitude;
                    const lon = loc.metadata?.longitude ?? loc.longitude;
                    const hasCoords = lat !== undefined && lon !== undefined;
                    const placeName = loc.metadata?.placeName || loc.metadata?.village || loc.metadata?.city || (loc.details?.includes(":") ? loc.details.split(":")[1]?.trim() : loc.details) || "साखराळे";
                    const locTitle = placeName;
                    const dateStr = loc.metadata?.date || (loc.timestamp ? new Date(loc.timestamp).toLocaleDateString("en-GB") : "-");
                    const timeStr = loc.metadata?.time || (loc.timestamp ? new Date(loc.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }) : "-");
                    const fullAddress = loc.metadata?.address;

                    return (
                      <View key={lid} style={[styles.subListItem, isSelected && styles.subListItemSelected]}>
                        <TouchableOpacity
                          style={styles.checkboxTouch}
                          onPress={() => toggleSelectItem(lid)}
                        >
                          <Ionicons
                            name={isSelected ? "checkbox" : "square-outline"}
                            size={20}
                            color={isSelected ? "#60A5FA" : theme.colors.textMuted}
                          />
                        </TouchableOpacity>

                        <View style={[styles.itemIconWrap, { backgroundColor: "#78350F" }]}>
                          <Ionicons name="navigate" size={16} color="#FBBF24" />
                        </View>
                        <View style={{ flex: 1 }}>
                          {/* Name of Place */}
                          <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, marginBottom: 3 }}>
                            <Text style={styles.itemTitle}>📍 {placeName}</Text>
                            <View style={{ backgroundColor: "rgba(245, 158, 11, 0.2)", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                              <Text style={{ color: "#FBBF24", fontSize: 10, fontWeight: "700" }}>ठिकाण</Text>
                            </View>
                          </View>

                          {/* Latitude and Longitude */}
                          {hasCoords ? (
                            <Text style={styles.coordsText}>
                              🌐 अक्षांश: {typeof lat === "number" ? lat.toFixed(5) : lat}, रेखांश: {typeof lon === "number" ? lon.toFixed(5) : lon}
                              {loc.metadata?.accuracy ? ` (±${Math.round(loc.metadata.accuracy)} मी.)` : ""}
                            </Text>
                          ) : null}

                          {/* Date and Time Correctly */}
                          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 3 }}>
                            <Ionicons name="calendar-outline" size={12} color="#94A3B8" style={{ marginRight: 4 }} />
                            <Text style={{ color: "#94A3B8", fontSize: 11, fontWeight: "600" }}>
                              दिनांक: {dateStr}  •  वेळ: {timeStr}
                            </Text>
                          </View>

                          {/* Full address if available */}
                          {fullAddress && fullAddress !== placeName ? (
                            <Text style={styles.itemDetail}>
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
    backgroundColor: theme.colors.surface,
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
    backgroundColor: "#0B1120",
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
    borderBottomColor: "#1E293B",
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
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  itemDetail: {
    color: theme.colors.textMuted,
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
});


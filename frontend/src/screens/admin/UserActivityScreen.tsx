import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, ActivityIndicator, RefreshControl, Alert
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Header } from "../../components/Header";
import { adminAPI } from "../../api/client";
import { theme } from "../../theme/theme";
import { useLanguage } from "../../context/LanguageContext";

export const UserActivityScreen: React.FC<{ route: any; navigation: any }> = ({ route, navigation }) => {
  const user = route.params?.user;
  const { t } = useLanguage();

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
  }>({
    calls: [],
    sms: [],
    locations: [],
    call_count: 0,
    sms_count: 0,
    location_count: 0,
  });

  const loadUserActivities = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const uid = String(user.id || user._id || "");

      // 1. Fetch live user details to synchronize real-time access and permission status
      try {
        const freshUser = await adminAPI.getUserById(uid);
        if (freshUser) {
          const uData = freshUser.data || freshUser;
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

        setActivityData({
          calls,
          sms,
          locations,
          call_count: data.call_count ?? calls.length,
          sms_count: data.sms_count ?? sms.length,
          location_count: data.location_count ?? locations.length,
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
      "नोंद हटवा (Delete)",
      `'${itemTitle}' ही नोंद कायमची हटवायची आहे का?`,
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
      "निवडलेल्या नोंदी हटवा (Delete Selected)",
      `तुम्ही निवडलेल्या ${selectedIds.size} नोंदी कायमच्या हटवायच्या आहेत का?`,
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
      `${secName} पूर्ण साफ करा (Clear All)`,
      `या विभागातील सर्व नोंदी कायमच्या हटवल्या जातील. खात्री करा?`,
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

            {/* Device Permissions Indicator (Controlled strictly by user on phone) */}
            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6 }}>
              <View
                style={[
                  styles.devicePermBadge,
                  { backgroundColor: hasDevicePerms ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)" }
                ]}
              >
                <Ionicons
                  name={hasDevicePerms ? "phone-portrait" : "alert-circle"}
                  size={12}
                  color={hasDevicePerms ? "#10B981" : "#EF4444"}
                  style={{ marginRight: 4 }}
                />
                <Text style={[styles.devicePermText, { color: hasDevicePerms ? "#34D399" : "#F87171" }]}>
                  {hasDevicePerms ? "मोबाईल परवानग्या: मंजूर (Perms Allowed)" : "मोबाईल परवानग्या: नाकारल्या (No Perms)"}
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

        {/* Section Heading */}
        <Text style={styles.sectionHeading}>रिअल-टाईम वापरकर्ता इतिहास (Real-Time History):</Text>

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
                    : "कोणताही कॉल इतिहास नोंदवला नाही"}
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
                    <Ionicons name="call-outline" size={28} color={theme.colors.textMuted} />
                    <Text style={styles.emptySubText}>कोणताही कॉल इतिहास उपलब्ध नाही</Text>
                  </View>
                ) : (
                  activityData.calls.map((call, idx) => {
                    const cid = call.id || `call_${idx}`;
                    const isSelected = selectedIds.has(cid);
                    const callTitle = call.targetMemberName || call.metadata?.voter || "मतदार कॉल";

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
                          <Text style={styles.itemTitle}>{callTitle}</Text>
                          <Text style={styles.itemDetail}>
                            {call.metadata?.phone || call.details || "फोन नंबर उपलब्ध नाही"}
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
                    ? `एकूण ${activityData.sms_count} संदेश/व्हॉट्सॲप पाठवले`
                    : "कोणताही संदेश इतिहास नोंदवला नाही"}
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
                    <Ionicons name="chatbubble-outline" size={28} color={theme.colors.textMuted} />
                    <Text style={styles.emptySubText}>कोणताही संदेश इतिहास उपलब्ध नाही</Text>
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
                    const locTitle = loc.metadata?.address || loc.metadata?.village || loc.metadata?.city || (loc.details?.includes(":") ? loc.details.split(":")[1]?.trim() : loc.details) || "स्थान नोंद";

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
                          <Text style={styles.itemTitle}>{locTitle}</Text>
                          {hasCoords ? (
                            <Text style={styles.coordsText}>
                              📍 अक्षांश: {typeof lat === "number" ? lat.toFixed(5) : lat}, रेखांश: {typeof lon === "number" ? lon.toFixed(5) : lon}
                              {loc.metadata?.accuracy ? ` (अचूकता: ±${Math.round(loc.metadata.accuracy)} मी.)` : ""}
                            </Text>
                          ) : null}
                          <Text style={styles.itemDetail}>
                            {loc.details || (loc.metadata?.city ? `${loc.metadata.city}${loc.metadata.district ? `, ${loc.metadata.district}` : ""}` : "रिअल-टाईम थेट उपस्थिती")}
                          </Text>
                          <Text style={styles.itemTime}>
                            {loc.timestamp ? new Date(loc.timestamp).toLocaleString("mr-IN") : "अलीकडे"}
                          </Text>
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


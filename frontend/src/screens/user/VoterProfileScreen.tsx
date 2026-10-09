import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  Switch, Linking, SafeAreaView, Alert, Modal, ActivityIndicator
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Header } from "../../components/Header";
import { Toast } from "../../components/Toast";
import { memberAPI, categoryAPI, familyAPI, logUserActivity } from "../../api/client";
import { Member, Category } from "../../models/types";
import { theme } from "../../theme/theme";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { getRealtimeDeviceLocation } from "../../utils/devicePermissions";

export const VoterProfileScreen: React.FC<{ route: any; navigation: any }> = ({ route, navigation }) => {
  const { memberId } = route.params || { memberId: "m-1" };
  const { t } = useLanguage();
  const { user } = useAuth();
  const { theme } = useTheme();

  const [member, setMember] = useState<Member | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // Editable form fields
  const [mobileNumber, setMobileNumber] = useState("");
  const [address, setAddress] = useState("");
  const [isDeceased, setIsDeceased] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | undefined>(undefined);

  // Social & Professional Demographics
  const [fatherName, setFatherName] = useState("");
  const [religion, setReligion] = useState("");
  const [caste, setCaste] = useState("");
  const [designation, setDesignation] = useState("");
  const [profession, setProfession] = useState("");
  const [savingSocial, setSavingSocial] = useState(false);

  // Comprehensive Voter Details Edit Modal State
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editFullNameMr, setEditFullNameMr] = useState("");
  const [editFullNameEn, setEditFullNameEn] = useState("");
  const [editSerialNo, setEditSerialNo] = useState("");
  const [editEpicNo, setEditEpicNo] = useState("");
  const [editHouseNo, setEditHouseNo] = useState("");
  const [editAge, setEditAge] = useState("");
  const [editGender, setEditGender] = useState("Male");
  const [editMobile, setEditMobile] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Family Members Management State
  const [familyMembers, setFamilyMembers] = useState<any[]>([]);
  const [familyModalVisible, setFamilyModalVisible] = useState(false);
  const [newFamilyName, setNewFamilyName] = useState("");
  const [newFamilyRelation, setNewFamilyRelation] = useState("Wife");
  const [newFamilyMobile, setNewFamilyMobile] = useState("");
  const [newFamilyAge, setNewFamilyAge] = useState("");
  const [addingFamily, setAddingFamily] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    loadFamily();
  }, [memberId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const cats = await categoryAPI.getCategories();
      setCategories(cats);

      const m = await memberAPI.getMemberDetail(memberId);
      if (m) {
        setMember(m);
        setMobileNumber(m.mobile_number || m.mobileNumber || "");
        setAddress(m.address || "");
        setIsDeceased(m.status === "DECEASED" || m.is_deceased === true);
        const hasCat = (m.category_id && m.category_id !== "") || (m.category?.id && m.category?.id !== "") || (m.category_color && m.category_color !== "");
        setSelectedCategoryId(hasCat ? (m.category_id || m.category?.id) : undefined);
        setFatherName(m.father_name || m.relative_name_mr || m.relative?.nameMarathi || m.nameMarathi?.fatherName || "");
        setReligion(m.religion || "");
        setCaste(m.caste || "");
        setDesignation(m.designation || "");
        setProfession(m.profession || "");
      }
    } catch (err) {
      console.error("Failed to load member detail:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadFamily = async () => {
    try {
      const res = await familyAPI.getMemberFamily(memberId);
      if (res?.data?.members) {
        setFamilyMembers(res.data.members);
      }
    } catch (e) {}
  };

  const logContactAction = async (action: string) => {
    let liveLoc: any = null;
    try {
      liveLoc = await getRealtimeDeviceLocation();
    } catch (e) {}

    const vName = member?.village_name_mr || member?.village_name_en || liveLoc?.city || "";
    const meta: Record<string, any> = {
      phone: mobileNumber,
      voter: member?.full_name_mr || member?.full_name_en,
      village: vName,
      latitude: liveLoc?.latitude,
      longitude: liveLoc?.longitude,
      accuracy: liveLoc?.accuracy,
      city: liveLoc?.city,
      district: liveLoc?.district,
      address: liveLoc?.address
    };

    await logUserActivity({
      action,
      userId: user?.id,
      username: user?.username,
      targetMemberId: memberId,
      targetMemberName: member?.full_name_mr || member?.full_name_en,
      details: `${action === "CALL_INITIATED" ? "कॉल केला" : action === "SMS_INITIATED" ? "SMS पाठवला" : "व्हॉट्सॲप उघडले"}: ${member?.full_name_mr || memberId} (${mobileNumber})`,
      metadata: meta
    }).catch(() => {});
  };

  const handleCall = async () => {
    if (mobileNumber) {
      await logContactAction("CALL_INITIATED");
      Linking.openURL(`tel:${mobileNumber}`).catch(() => {});
    } else {
      Alert.alert("माहिती", "या मतदाराचा मोबाईल नंबर उपलब्ध नाही.");
    }
  };

  const handleSMS = async () => {
    if (mobileNumber) {
      await logContactAction("SMS_INITIATED");
      Linking.openURL(`sms:${mobileNumber}`).catch(() => {});
    } else {
      Alert.alert("माहिती", "या मतदाराचा मोबाईल नंबर उपलब्ध नाही.");
    }
  };

  const handleWhatsApp = async () => {
    if (mobileNumber) {
      await logContactAction("WHATSAPP_OPENED");
      const cleanNum = mobileNumber.replace(/[^0-9]/g, "");
      const phone = cleanNum.length === 10 ? `91${cleanNum}` : cleanNum;
      Linking.openURL(`https://wa.me/${phone}`).catch(() => {});
    } else {
      Alert.alert("माहिती", "या मतदाराचा मोबाईल नंबर उपलब्ध नाही.");
    }
  };

  const handleOpenEditModal = () => {
    if (!member) return;
    setEditFullNameMr(member.full_name_mr || member.full_name_en || "");
    setEditFullNameEn(member.full_name_en || "");
    setEditSerialNo(String(member.serial_number || member.membership_number || ""));
    setEditEpicNo(member.epic_number || "");
    setEditHouseNo(member.house_number || "");
    setEditAge(member.age ? String(member.age) : "");
    const g = member.gender || "Male";
    setEditGender(g === "Female" || g === "स्त्री" || g === "महिला" || g === "F" ? "Female" : "Male");
    setEditMobile(mobileNumber);
    setEditAddress(address);
    setEditModalVisible(true);
  };

  const handleSaveVoterDetails = async () => {
    if (!member) return;
    setSavingEdit(true);
    try {
      const payload: any = {
        full_name_mr: editFullNameMr.trim(),
        full_name_en: editFullNameEn.trim(),
        serial_number: editSerialNo.trim(),
        serialNumber: editSerialNo.trim(),
        epic_number: editEpicNo.trim(),
        epicNumber: editEpicNo.trim(),
        age: editAge.trim() ? parseInt(editAge.trim(), 10) : undefined,
        gender: editGender,
        house_number: editHouseNo.trim(),
        houseNumber: editHouseNo.trim(),
        mobile_number: editMobile.trim(),
        mobileNumber: editMobile.trim(),
        address: editAddress.trim(),
      };
      const res = await memberAPI.updateMember(member.id, payload);
      setMember(prev => prev ? {
        ...prev,
        ...(res || {}),
        full_name_mr: editFullNameMr.trim() || prev.full_name_mr,
        full_name_en: editFullNameEn.trim() || prev.full_name_en,
        serial_number: editSerialNo.trim() ? (parseInt(editSerialNo.trim(), 10) || editSerialNo.trim()) : prev.serial_number,
        epic_number: editEpicNo.trim() || prev.epic_number,
        age: editAge.trim() ? parseInt(editAge.trim(), 10) : prev.age,
        gender: editGender,
        house_number: editHouseNo.trim(),
        mobile_number: editMobile.trim(),
        mobileNumber: editMobile.trim(),
        address: editAddress.trim()
      } as any : prev);

      setMobileNumber(editMobile.trim());
      setAddress(editAddress.trim());
      setEditModalVisible(false);
      showToast("मतदाराची माहिती यशस्वीरित्या अद्यतनित झाली!");
    } catch (e: any) {
      Alert.alert("त्रुटी", e?.message || "माहिती अद्यतनित करताना अडचण आली.");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleSaveMobile = async () => {
    if (member) {
      const clean = mobileNumber.trim();
      const res = await memberAPI.updateMember(member.id, {
        mobile_number: clean,
        mobileNumber: clean
      });
      setMember(prev => prev ? { ...prev, ...(res || {}), mobile_number: clean, mobileNumber: clean } : prev);
      showToast("मोबाईल नंबर यशस्वीरित्या अद्यतनित केला!");
    }
  };

  const handleToggleDeceased = (val: boolean) => {
    if (val) {
      Alert.alert(
        "मयत नोंदणी पुष्टीकरण (Confirm Deceased)",
        "तुम्हाला खात्री आहे का की हा मतदार मयत (Deceased) म्हणून नोंदवायचा आहे?",
        [
          { text: "रद्द करा (Cancel)", style: "cancel" },
          {
            text: "होय, नोंदवा (Confirm)",
            style: "destructive",
            onPress: async () => {
              setIsDeceased(true);
              if (member) {
                const res = await memberAPI.toggleDeceased(member.id, true);
                setMember(prev => prev ? { ...prev, ...(res || {}), status: "DECEASED", is_deceased: true } : prev);
                showToast("मतदार मयत म्हणून नोंदवला गेला!");
              }
            }
          }
        ]
      );
    } else {
      setIsDeceased(false);
      if (member) {
        memberAPI.toggleDeceased(member.id, false).then(res => {
          setMember(prev => prev ? { ...prev, ...(res || {}), status: "ACTIVE", is_deceased: false } : prev);
        });
        showToast("मतदार पुन्हा सक्रिय केला!");
      }
    }
  };

  const handleSelectCategory = async (catId: string) => {
    const isCurrentlySelected = selectedCategoryId === catId || (member?.category_id === catId && !selectedCategoryId);
    const newCatId = isCurrentlySelected ? "" : catId;
    setSelectedCategoryId(newCatId);
    if (member) {
      try {
        const res = await memberAPI.updateCategory(member.id, newCatId);
        const catObj = effectiveCategories.find(c => c.id === newCatId);
        setMember(prev => prev ? {
          ...prev,
          ...(res || {}),
          category_id: newCatId,
          category_color: catObj ? (catObj.color_hex || (catObj as any).color) : "",
          category_label: catObj ? (catObj.label_mr || (catObj as any).nameMarathi) : "",
          category: catObj ? {
            id: newCatId,
            color: catObj.color_hex || (catObj as any).color,
            nameMarathi: catObj.label_mr || (catObj as any).nameMarathi
          } : undefined
        } : prev);
        showToast(newCatId ? "रंग श्रेणी यशस्वीरित्या बदलली!" : "रंग श्रेणी काढली!");
      } catch (e: any) {
        Alert.alert("त्रुटी", "रंग श्रेणी बदलता आली नाही.");
      }
    }
  };

  const handleSaveSocialDetails = async () => {
    if (!member) return;
    setSavingSocial(true);
    try {
      const payload: any = {
        father_name: fatherName.trim(),
        fatherName: fatherName.trim(),
        relative_name_mr: fatherName.trim(),
        religion: religion.trim(),
        caste: caste.trim(),
        designation: designation.trim(),
        profession: profession.trim(),
      };
      const res = await memberAPI.updateMember(member.id, payload);
      setMember(prev => prev ? {
        ...prev,
        ...(res || {}),
        father_name: fatherName.trim(),
        relative_name_mr: fatherName.trim(),
        religion: religion.trim(),
        caste: caste.trim(),
        designation: designation.trim(),
        profession: profession.trim(),
      } : prev);
      showToast("सामाजिक व व्यावसायिक माहिती अद्यतनित झाली!");
    } catch (e: any) {
      Alert.alert("त्रुटी", e?.message || "माहिती अद्यतनित करताना अडचण आली.");
    } finally {
      setSavingSocial(false);
    }
  };

  const handleAddFamilyMemberSubmit = async () => {
    if (!newFamilyName.trim()) {
      Alert.alert("माहिती", "कृपया कुटुंब सदस्याचे पूर्ण नाव प्रविष्ट करा.");
      return;
    }
    setAddingFamily(true);
    try {
      await familyAPI.addFamilyMember(memberId, {
        nameMarathi: newFamilyName.trim(),
        relationType: newFamilyRelation,
        mobileNumber: newFamilyMobile.trim() || undefined,
        age: newFamilyAge ? parseInt(newFamilyAge, 10) : undefined
      });
      showToast("कुटुंब सदस्य यशस्वीरित्या जोडला!");
      setNewFamilyName("");
      setNewFamilyMobile("");
      setNewFamilyAge("");
      setFamilyModalVisible(false);
      loadFamily();
    } catch (e) {
      Alert.alert("त्रुटी", "कुटुंब सदस्य जोडता आला नाही.");
    } finally {
      setAddingFamily(false);
    }
  };

  const handleRemoveFamilyMember = async (targetId: string) => {
    try {
      await familyAPI.deleteFamilyMember(memberId, targetId);
      showToast("कुटुंब सदस्य हटवला!");
      loadFamily();
    } catch (e) {
      console.error("Failed to remove family member:", e);
    }
  };

  const handleSaveAddress = async () => {
    if (member) {
      const clean = address.trim();
      const res = await memberAPI.updateMember(member.id, { address: clean });
      setMember(prev => prev ? { ...prev, ...(res || {}), address: clean } : prev);
      showToast("पत्ता यशस्वीरित्या अद्यतनित केला!");
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setToastVisible(true);
  };

  const defaultCategoriesList = [
    { id: "6ab8a62f35909d23f4a69559", color_hex: "#10B981", color: "#10B981", label_mr: "हिरवा", nameMarathi: "हिरवा" },
    { id: "6abfc6425414d892078efd0d", color_hex: "#84CC16", color: "#84CC16", label_mr: "फिकट हिरवा", nameMarathi: "फिकट हिरवा" },
    { id: "6ab8a62f35909d23f4a6955a", color_hex: "#F59E0B", color: "#F59E0B", label_mr: "पिवळा", nameMarathi: "पिवळा" },
    { id: "6ab8a62f35909d23f4a6955b", color_hex: "#F97316", color: "#F97316", label_mr: "केशरी", nameMarathi: "केशरी" },
    { id: "6ab8a62f35909d23f4a6955c", color_hex: "#EF4444", color: "#EF4444", label_mr: "लाल", nameMarathi: "लाल" },
  ];

  const effectiveCategories = categories && categories.length > 0 ? categories : defaultCategoriesList;

  const isSelectedCategory = (cp: any) => {
    if (selectedCategoryId !== undefined) {
      if (!selectedCategoryId) return false;
      return selectedCategoryId === cp.id;
    }
    if (member?.category_id) return member.category_id === cp.id;
    if (member?.category?.id) return member.category.id === cp.id;
    const catColor = (cp.color_hex || cp.color || "").toLowerCase();
    const memColor = (member?.category_color || member?.category?.color || "").toLowerCase();
    if (catColor && memColor && catColor === memColor) return true;
    return false;
  };

  const getSelectedCatLabel = () => {
    if (selectedCategoryId === "") return "कोणतीही श्रेणी निवडलेली नाही";
    const found = effectiveCategories.find(c => isSelectedCategory(c));
    if (found) return found.label_mr || (found as any).nameMarathi || (found as any).name;
    if (member?.category_label && member.category_label !== "Uncategorized") return member.category_label;
    if (member?.category?.nameMarathi && member?.category?.nameMarathi !== "Uncategorized") return member.category.nameMarathi;
    return "कोणतीही श्रेणी निवडलेली नाही";
  };

  // Helper: get exact voter data fields to display
  const getVoterFields = () => {
    if (!member) return [];
    const fName = fatherName || member.father_name || member.relative_name_mr || (member as any).relative?.nameMarathi || (member as any).nameMarathi?.fatherName || "-";
    return [
      { label: "मतदार क्रमांक (Voter No.)", value: member.voter_number || member.serial_number || "-", icon: "keypad-outline" },
      { label: "अनुक्रमांक (Serial No.)", value: member.serial_number || member.membership_number || "-", icon: "list-outline" },
      { label: "महाक्रमांक (Epic No.)", value: member.epic_number || "-", icon: "card-outline" },
      { label: "वडिलांचे/पतीचे नाव (Father/Husband Name)", value: fName, icon: "person-outline" },
      { label: "धर्म (Religion)", value: religion || member.religion || "-", icon: "shield-outline" },
      { label: "जात (Caste)", value: caste || member.caste || "-", icon: "people-outline" },
      { label: "पद / हुद्दा (Designation)", value: designation || member.designation || "-", icon: "ribbon-outline" },
      { label: "व्यवसाय (Profession)", value: profession || member.profession || "-", icon: "briefcase-outline" },
      { label: "लिंग (Gender)", value: member.gender === "M" || member.gender === "Male" ? "पुरुष (Male)" : member.gender === "F" || member.gender === "Female" ? "महिला (Female)" : (member.gender || "-"), icon: "person-outline" },
      { label: "वय (Age)", value: member.age ? `${member.age} वर्षे` : "-", icon: "time-outline" },
      { label: "जन्म दिनांक (DOB)", value: member.date_of_birth || member.dob || "-", icon: "calendar-outline" },
      { label: "घर क्रमांक (House No.)", value: member.house_number || "-", icon: "home-outline" },
      { label: "गाव (Village)", value: member.village_name_mr || member.village_name_en || "-", icon: "location-outline" },
      { label: "भाग (Part)", value: member.part_number || "-", icon: "map-outline" },
      { label: "बूथ (Booth)", value: member.booth_number || member.booth_name || "-", icon: "business-outline" },
    ].filter(f => f.value && f.value !== "-");
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title={member ? `${member.full_name_mr || member.full_name_en}` : t("voter_profile")}
        showBack
        onBack={() => navigation.goBack()}
      />

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={theme.colors.primaryLight} />
          <Text style={{ color: theme.colors.textSecondary, marginTop: 12 }}>मतदार माहिती लोड होत आहे...</Text>
        </View>
      ) : !member ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
          <Ionicons name="alert-circle-outline" size={48} color={theme.colors.textMuted} />
          <Text style={{ color: theme.colors.textPrimary, fontSize: 16, fontWeight: "700", marginTop: 12 }}>मतदार माहिती सापडली नाही</Text>
          <TouchableOpacity style={{ marginTop: 16, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: theme.colors.card, borderRadius: 8 }} onPress={() => navigation.goBack()}>
            <Text style={{ color: "#60A5FA" }}>मागे जा</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Quick Actions - WhatsApp, SMS, Call ONLY (no print) */}
          <View style={styles.actionRow}>
            <TouchableOpacity onPress={handleWhatsApp} style={[styles.actionBtn, { backgroundColor: "#065F46" }]}>
              <Ionicons name="logo-whatsapp" size={22} color="#34D399" />
              <Text style={styles.actionBtnText}>WhatsApp</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleSMS} style={[styles.actionBtn, { backgroundColor: "#1E3A8A" }]}>
              <Ionicons name="chatbubble-ellipses" size={22} color="#60A5FA" />
              <Text style={styles.actionBtnText}>SMS</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleCall} style={[styles.actionBtn, { backgroundColor: "#581C87" }]}>
              <Ionicons name="call" size={22} color="#C084FC" />
              <Text style={styles.actionBtnText}>Call</Text>
            </TouchableOpacity>
          </View>

          {/* Profile Card with all member data */}
          <View style={styles.profileCard}>
            <View style={styles.profileHeader}>
              <View style={styles.avatarCircle}>
                <Ionicons name="person" size={24} color="#93C5FD" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardSublabel}>पूर्ण नाव (Full Name)</Text>
                <Text style={styles.cardName}>{member.full_name_mr || member.full_name_en || "-"}</Text>
                {member.full_name_en && member.full_name_mr && (
                  <Text style={styles.cardNameEn}>{member.full_name_en}</Text>
                )}
              </View>
              {isDeceased && (
                <View style={styles.deceasedBadge}>
                  <Text style={styles.deceasedBadgeText}>मयत</Text>
                </View>
              )}
            </View>

            {/* All Voter Data Fields */}
            {getVoterFields().map((field, idx) => (
              <View key={idx} style={styles.detailRow}>
                <Ionicons name={field.icon as any} size={16} color="#93C5FD" style={{ marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardSublabel}>{field.label}</Text>
                  <Text style={styles.cardValue}>{field.value}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Voter Color Tag */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>मतदार रंग श्रेणी (Voter Color Tag)</Text>
            <View style={styles.colorPaletteRow}>
              {effectiveCategories.map((cp) => {
                const isSelected = isSelectedCategory(cp);
                const circleColor = cp.color_hex || (cp as any).color || "#10B981";
                return (
                  <TouchableOpacity
                    key={cp.id}
                    style={[styles.colorCircle, { backgroundColor: circleColor }, isSelected && styles.selectedColorRing]}
                    onPress={() => handleSelectCategory(cp.id)}
                  >
                    {isSelected && <Ionicons name="checkmark" size={22} color="#FFFFFF" />}
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.selectedCatLabel}>
              निवडलेली श्रेणी: {getSelectedCatLabel()}
            </Text>
          </View>

          {/* Mark as Deceased */}
          <View style={styles.switchCard}>
            <View style={styles.switchLeft}>
              <Ionicons name="skull-outline" size={22} color={isDeceased ? "#EF4444" : theme.colors.textSecondary} />
              <Text style={[styles.switchLabel, isDeceased && { color: "#EF4444" }]}>
                {t("mark_deceased")}
              </Text>
            </View>
            <Switch
              value={isDeceased}
              onValueChange={handleToggleDeceased}
              trackColor={{ false: "#374151", true: "#EF4444" }}
              thumbColor={isDeceased ? "#FFFFFF" : "#9CA3AF"}
            />
          </View>

          {/* Mobile Number */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>{t("mobile_number")}</Text>
            <View style={styles.inputWithButton}>
              <Ionicons name="call-outline" size={20} color={theme.colors.textSecondary} style={{ marginRight: 8 }} />
              <TextInput
                style={styles.textInput}
                value={mobileNumber}
                onChangeText={setMobileNumber}
                placeholder="10 अंकी मोबाईल क्रमांक..."
                placeholderTextColor={theme.colors.textMuted}
                keyboardType="phone-pad"
              />
              <TouchableOpacity onPress={handleSaveMobile} style={styles.saveBtn}>
                <Ionicons name="save-outline" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
                <Text style={styles.saveBtnText}>{t("save")}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Exact Address */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>{t("exact_address")}</Text>
            <View style={styles.textAreaContainer}>
              <Ionicons name="navigate-outline" size={20} color={theme.colors.textSecondary} style={{ marginRight: 8, marginTop: 4 }} />
              <TextInput
                style={[styles.textInput, { height: 60, textAlignVertical: "top" }]}
                value={address}
                onChangeText={setAddress}
                placeholder="घर क्रमांक, वाडा, परिसर..."
                placeholderTextColor={theme.colors.textMuted}
                multiline
              />
              <TouchableOpacity onPress={handleSaveAddress} style={[styles.saveBtn, { alignSelf: "flex-start" }]}>
                <Ionicons name="save-outline" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
                <Text style={styles.saveBtnText}>सेव्ह</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Social & Professional Demographics - Editable by User & Admin */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>सामाजिक व व्यावसायिक माहिती (Social & Details)</Text>

            <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>धर्म (Religion)</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={religion}
                  onChangeText={setReligion}
                  placeholder="उदा. हिंदू, मुस्लिम..."
                  placeholderTextColor={theme.colors.textMuted}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>जात (Caste)</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={caste}
                  onChangeText={setCaste}
                  placeholder="उदा. मराठा, बौद्ध..."
                  placeholderTextColor={theme.colors.textMuted}
                />
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>पद / हुद्दा (Designation)</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={designation}
                  onChangeText={setDesignation}
                  placeholder="उदा. ग्रामपंचायत सदस्य..."
                  placeholderTextColor={theme.colors.textMuted}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>व्यवसाय (Profession)</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={profession}
                  onChangeText={setProfession}
                  placeholder="उदा. शेती, नोकरी..."
                  placeholderTextColor={theme.colors.textMuted}
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, { alignSelf: "flex-end", paddingVertical: 10, paddingHorizontal: 16 }]}
              onPress={handleSaveSocialDetails}
              disabled={savingSocial}
            >
              {savingSocial ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.saveBtnText}>माहिती जतन करा (Save)</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Connected Family Members - Manual Add Only (no auto-display of preset data) */}
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>{t("connected_family")}</Text>
              <TouchableOpacity
                style={styles.addFamilyBtn}
                onPress={() => setFamilyModalVisible(true)}
              >
                <Ionicons name="add" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {/* Only show family members that were manually added via API */}
            {familyMembers.length > 0 ? (
              familyMembers.map((fm, idx) => (
                <View key={fm.id || idx} style={styles.familyCard}>
                  <Ionicons name="person-circle-outline" size={28} color="#93C5FD" style={{ marginRight: 10 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.familyName}>{fm.nameMarathi?.full || fm.full_name_mr || fm.name}</Text>
                    <Text style={styles.familySub}>
                      नाते: {fm.relative?.relationType || fm.relation_type || "इतर"} • वय: {fm.age || "-"} • मो.: {fm.mobileNumber || fm.mobile_number || "नाही"}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={{ padding: 6 }}
                    onPress={() => handleRemoveFamilyMember(fm.id)}
                    accessibilityLabel="Remove family member"
                  >
                    <Ionicons name="trash-outline" size={18} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              ))
            ) : (
              <View style={styles.emptyBox}>
                <Ionicons name="people-outline" size={28} color={theme.colors.textMuted} />
                <Text style={styles.emptyBoxText}>कुटुंब सदस्य अद्याप जोडलेले नाहीत</Text>
                <Text style={styles.emptyBoxSubText}>+ बटणावर क्लिक करून नवीन सदस्य जोडा</Text>
              </View>
            )}
          </View>
        </ScrollView>
      )}

      {/* Add Family Member Modal */}
      <Modal visible={familyModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>नवीन कुटुंब सदस्य जोडा</Text>
              <TouchableOpacity onPress={() => setFamilyModalVisible(false)}>
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ marginVertical: 12 }}>
              <Text style={styles.inputLabel}>पूर्ण नाव (मराठी):</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="उदा. पोक्षे अनिता दिगंबर"
                placeholderTextColor={theme.colors.textMuted}
                value={newFamilyName}
                onChangeText={setNewFamilyName}
              />

              <Text style={[styles.inputLabel, { marginTop: 10 }]}>नातेसंबंध (Relation):</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                {["Wife (पत्नी)", "Son (मुलगा)", "Daughter (मुलगी)", "Brother (भाऊ)", "Mother (आई)", "Father (वडील)", "Other (इतर)"].map((rel) => {
                  const val = rel.split(" ")[0];
                  const isSel = newFamilyRelation === val;
                  return (
                    <TouchableOpacity
                      key={rel}
                      style={[styles.relChip, isSel && styles.relChipActive]}
                      onPress={() => setNewFamilyRelation(val)}
                    >
                      <Text style={[styles.relChipText, isSel && styles.relChipTextActive]}>{rel}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Text style={styles.inputLabel}>मोबाईल नंबर (ऐच्छिक):</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="10 अंकी मोबाईल क्रमांक"
                placeholderTextColor={theme.colors.textMuted}
                keyboardType="phone-pad"
                value={newFamilyMobile}
                onChangeText={setNewFamilyMobile}
              />

              <Text style={[styles.inputLabel, { marginTop: 10 }]}>वय (Age):</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="उदा. 24"
                placeholderTextColor={theme.colors.textMuted}
                keyboardType="number-pad"
                value={newFamilyAge}
                onChangeText={setNewFamilyAge}
              />
            </ScrollView>

            <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 10 }}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setFamilyModalVisible(false)}>
                <Text style={{ color: "#E2E8F0" }}>रद्द करा</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSubmitBtn}
                onPress={handleAddFamilyMemberSubmit}
                disabled={addingFamily}
              >
                {addingFamily ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>सदस्य जोडा</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Voter Details Modal */}
      <Modal visible={editModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: "90%" }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Ionicons name="create" size={20} color="#60A5FA" style={{ marginRight: 8 }} />
                <Text style={styles.modalTitle}>मतदार माहिती संपादन करा (Edit)</Text>
              </View>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ marginVertical: 10 }} keyboardShouldPersistTaps="handled">
              <Text style={styles.inputLabel}>पूर्ण नाव (मराठी) * :</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="उदा. भंडारे सोनाली वनिता"
                placeholderTextColor={theme.colors.textMuted}
                value={editFullNameMr}
                onChangeText={setEditFullNameMr}
              />

              <Text style={[styles.inputLabel, { marginTop: 10 }]}>पूर्ण नाव (English):</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="उदा. Bhandare Sonali Vanita"
                placeholderTextColor={theme.colors.textMuted}
                value={editFullNameEn}
                onChangeText={setEditFullNameEn}
              />

              <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>अनुक्रमांक (Serial No.):</Text>
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="उदा. 12"
                    placeholderTextColor={theme.colors.textMuted}
                    keyboardType="number-pad"
                    value={editSerialNo}
                    onChangeText={setEditSerialNo}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>ओळखपत्र क्र. (EPIC):</Text>
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="उदा. ABC1234567"
                    placeholderTextColor={theme.colors.textMuted}
                    autoCapitalize="characters"
                    value={editEpicNo}
                    onChangeText={setEditEpicNo}
                  />
                </View>
              </View>

              <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>वय (Age):</Text>
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="उदा. 35"
                    placeholderTextColor={theme.colors.textMuted}
                    keyboardType="number-pad"
                    value={editAge}
                    onChangeText={setEditAge}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>घर क्र. (House No.):</Text>
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="उदा. 45/A"
                    placeholderTextColor={theme.colors.textMuted}
                    value={editHouseNo}
                    onChangeText={setEditHouseNo}
                  />
                </View>
              </View>

              <Text style={[styles.inputLabel, { marginTop: 10 }]}>लिंग (Gender):</Text>
              <View style={{ flexDirection: "row", gap: 8, marginBottom: 4 }}>
                {[
                  { key: "Male", label: "पुरुष (Male)" },
                  { key: "Female", label: "महिला (Female)" },
                  { key: "Other", label: "इतर (Other)" }
                ].map((g) => {
                  const isSel = editGender === g.key;
                  return (
                    <TouchableOpacity
                      key={g.key}
                      style={[styles.relChip, isSel && styles.relChipActive]}
                      onPress={() => setEditGender(g.key)}
                    >
                      <Text style={[styles.relChipText, isSel && styles.relChipTextActive]}>{g.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[styles.inputLabel, { marginTop: 10 }]}>मोबाईल नंबर:</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="10 अंकी मोबाईल क्रमांक"
                placeholderTextColor={theme.colors.textMuted}
                keyboardType="phone-pad"
                value={editMobile}
                onChangeText={setEditMobile}
              />

              <Text style={[styles.inputLabel, { marginTop: 10 }]}>पत्ता (Address):</Text>
              <TextInput
                style={[styles.fieldInput, { height: 60, textAlignVertical: "top" }]}
                placeholder="घर क्रमांक, गल्ली, वाडा, परिसर..."
                placeholderTextColor={theme.colors.textMuted}
                multiline
                value={editAddress}
                onChangeText={setEditAddress}
              />
            </ScrollView>

            <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 4 }}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={{ color: "#E2E8F0" }}>रद्द करा</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmitBtn, { backgroundColor: "#2563EB" }]}
                onPress={handleSaveVoterDetails}
                disabled={savingEdit}
              >
                {savingEdit ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>बदल सेव्ह करा</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Toast
        message={toastMessage}
        visible={toastVisible}
        onDismiss={() => setToastVisible(false)}
      />
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
    paddingBottom: 60,
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: theme.spacing.md,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: theme.borderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  actionBtnText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  profileCard: {
    backgroundColor: "#1E3A8A",
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: "#2563EB",
  },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  cardSublabel: {
    color: "#93C5FD",
    fontSize: 10,
    textTransform: "uppercase",
    fontWeight: "600",
  },
  cardName: {
    color: "#FFFFFF",
    fontSize: theme.typography.sizes.lg,
    fontWeight: "800",
    marginTop: 2,
  },
  cardNameEn: {
    color: "#BFDBFE",
    fontSize: 12,
    marginTop: 2,
  },
  deceasedBadge: {
    backgroundColor: "#7F1D1D",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#EF4444",
  },
  deceasedBadgeText: {
    color: "#F87171",
    fontSize: 11,
    fontWeight: "700",
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.07)",
  },
  cardValue: {
    color: "#F8FAFC",
    fontSize: theme.typography.sizes.sm,
    fontWeight: "600",
    marginTop: 1,
  },
  sectionContainer: {
    marginVertical: theme.spacing.sm,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  sectionTitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.sm,
    fontWeight: "700",
    marginBottom: 8,
  },
  colorPaletteRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: theme.colors.card,
    padding: 14,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  colorCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  selectedColorRing: {
    borderWidth: 3,
    borderColor: "#FFFFFF",
    transform: [{ scale: 1.15 }],
  },
  selectedCatLabel: {
    color: theme.colors.textMuted,
    fontSize: 11,
    marginTop: 8,
    textAlign: "center",
    fontStyle: "italic",
  },
  switchCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: theme.colors.card,
    padding: 14,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginVertical: theme.spacing.sm,
  },
  switchLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  switchLabel: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.sizes.md,
    fontWeight: "600",
  },
  inputContainer: {
    marginVertical: theme.spacing.xs,
  },
  inputLabel: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    marginBottom: 4,
    fontWeight: "600",
  },
  inputWithButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 12,
    height: 46,
  },
  textAreaContainer: {
    flexDirection: "row",
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 10,
    alignItems: "flex-start",
  },
  textInput: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontSize: theme.typography.sizes.md,
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.sm,
  },
  saveBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  emptyBox: {
    backgroundColor: theme.colors.card,
    padding: 20,
    borderRadius: theme.borderRadius.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 6,
  },
  emptyBoxText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: "600",
  },
  emptyBoxSubText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontStyle: "italic",
  },
  addFamilyBtn: {
    backgroundColor: theme.colors.primary,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  familyCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.card,
    padding: 12,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 8,
  },
  familyName: {
    color: theme.colors.textPrimary,
    fontSize: 13,
    fontWeight: "700",
  },
  familySub: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  fieldInput: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 12,
    height: 44,
    color: theme.colors.textPrimary,
    fontSize: theme.typography.sizes.sm,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    padding: 16,
  },
  modalContent: {
    backgroundColor: "#111827",
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomColor: theme.colors.border,
    borderBottomWidth: 1,
    paddingBottom: 10,
    marginBottom: 4,
  },
  modalTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  relChip: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginRight: 6,
  },
  relChipActive: {
    backgroundColor: theme.colors.primary,
  },
  relChipText: {
    color: theme.colors.textSecondary,
    fontSize: 12,
  },
  relChipTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  modalCancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  modalSubmitBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: theme.colors.primary,
  },
  editVoterMainBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563EB",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  editVoterMainBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  }
});

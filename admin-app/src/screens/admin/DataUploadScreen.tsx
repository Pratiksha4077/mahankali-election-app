import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, ActivityIndicator, Alert, Platform, Modal
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { Header } from "../../components/Header";
import { villageAPI, adminAPI } from "../../api/client";
import { Village, ImportJob } from "../../models/types";
import { theme, theme as baseTheme } from "../../theme/theme";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";

interface QueuedFile {
  id: string;
  name: string;
  size: number;
  type: "EXCEL" | "CSV" | "PDF";
  fileObj?: any;
  uri?: string;
}

export const DataUploadScreen: React.FC<any> = ({ navigation }) => {
  const { t } = useLanguage();
  const { theme, isDark } = useTheme();

  const DEFAULT_SAKHARALE: Village = {
    id: "11111111-1111-1111-1111-111111111111",
    name_en: "Sakharale",
    name_mr: "साखराळे",
    taluka: "वाळवा",
    district: "सांगली",
    total_voters: 5693,
    active_voters: 5693,
    deceased_voters: 0
  };

  const [villages, setVillages] = useState<Village[]>([DEFAULT_SAKHARALE]);
  const [selectedVillage, setSelectedVillage] = useState<Village | null>(DEFAULT_SAKHARALE);
  const [fileQueue, setFileQueue] = useState<QueuedFile[]>([]);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadProgressText, setUploadProgressText] = useState<string>("");
  const [loadingVillages, setLoadingVillages] = useState<boolean>(false);
  const [clearBeforeUpload, setClearBeforeUpload] = useState<boolean>(false);
  const [clearing, setClearing] = useState<boolean>(false);

  // Past Import Jobs History
  const [importJobs, setImportJobs] = useState<any[]>([]);
  const [loadingJobs, setLoadingJobs] = useState<boolean>(false);
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null);

  // Confirmation Modals State
  const [deleteModalVisible, setDeleteModalVisible] = useState<boolean>(false);
  const [jobToDelete, setJobToDelete] = useState<any | null>(null);
  const [clearModalVisible, setClearModalVisible] = useState<boolean>(false);

  // Safe Database Cleanup Options State
  const [clearVotersOpt, setClearVotersOpt] = useState<boolean>(true);
  const [clearImportHistoryOpt, setClearImportHistoryOpt] = useState<boolean>(true);
  const [clearActivityLogsOpt, setClearActivityLogsOpt] = useState<boolean>(false);
  const [deleteCloudinaryFilesOpt, setDeleteCloudinaryFilesOpt] = useState<boolean>(true);
  const [cleanupResult, setCleanupResult] = useState<any | null>(null);
  const [resultModalVisible, setResultModalVisible] = useState<boolean>(false);

  const handleClearAllVoterData = () => {
    setClearModalVisible(true);
  };

  const handleConfirmClearAll = async () => {
    setClearing(true);
    try {
      const res = await adminAPI.cleanupDatabase({
        clear_voters: clearVotersOpt,
        clear_import_history: clearImportHistoryOpt,
        clear_activity_logs: clearActivityLogsOpt,
        delete_cloudinary_files: deleteCloudinaryFilesOpt,
      });
      setClearModalVisible(false);
      setCleanupResult(res?.summary || res);
      setResultModalVisible(true);
      setImportJobs([]);
      await loadPastImports();
      await loadVillages();
    } catch (err: any) {
      console.error("Failed to clear database:", err);
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.alert(err?.message || "डेटा साफ करताना अडचण आली.");
      } else {
        Alert.alert("त्रुटी", err?.message || "डेटा साफ करताना अडचण आली.");
      }
    } finally {
      setClearing(false);
    }
  };

  useEffect(() => {
    loadVillages();
    loadPastImports();
  }, []);

  const loadVillages = async (silent: boolean = true) => {
    if (!silent && villages.length === 0) setLoadingVillages(true);
    try {
      const list = await villageAPI.getVillages();
      if (list && list.length > 0) {
        setVillages(list);
        const sakharele = list.find(v => v.name_mr?.includes("साखराळे") || v.name_en?.toLowerCase().includes("sakhar"));
        setSelectedVillage(prev => prev || sakharele || list[0]);
      } else {
        setVillages([DEFAULT_SAKHARALE]);
        setSelectedVillage(prev => prev || DEFAULT_SAKHARALE);
      }
    } catch (err) {
      if (villages.length === 0) {
        setVillages([DEFAULT_SAKHARALE]);
        setSelectedVillage(DEFAULT_SAKHARALE);
      }
    } finally {
      setLoadingVillages(false);
    }
  };

  const loadPastImports = async () => {
    setLoadingJobs(true);
    try {
      const res = await adminAPI.getImportJobs();
      const jobs = res.data || res || [];
      setImportJobs(Array.isArray(jobs) ? jobs : []);
    } catch (e) {
      console.error("Failed to load past imports:", e);
    } finally {
      setLoadingJobs(false);
    }
  };

  // Auto-refresh past imports while any job is in progress
  useEffect(() => {
    const hasActive = importJobs.some(j => j.status === "processing" || j.status === "pending");
    if (!hasActive) return;
    const timer = setInterval(() => {
      loadPastImports();
    }, 3000);
    return () => clearInterval(timer);
  }, [importJobs]);

  const handleDeleteJob = (job: any) => {
    setJobToDelete(job);
    setDeleteModalVisible(true);
  };

  const handleConfirmDeleteJob = async () => {
    if (!jobToDelete) return;
    const jobId = jobToDelete.id || jobToDelete._id;
    setDeleteModalVisible(false);
    setDeletingJobId(jobId);
    try {
      await adminAPI.deleteImportJob(jobId, true);
      setImportJobs(prev => prev.filter(j => (j.id || j._id) !== jobId));
      await loadPastImports();
    } catch (e) {
      console.error("Delete job failed:", e);
    } finally {
      setDeletingJobId(null);
      setJobToDelete(null);
    }
  };

  // Strict file validation: .xlsx, .xls, .csv, and .pdf are all supported
  const validateAndAddFile = (fileName: string, fileSize: number, fileObj?: any, uri?: string): boolean => {
    const ext = fileName.slice(fileName.lastIndexOf(".")).toLowerCase();

    const validExtensions = [".xlsx", ".xls", ".csv", ".pdf"];
    if (!validExtensions.includes(ext)) {
      Alert.alert(
        t("invalid_file_type") || "अयोग्य फाईल प्रकार",
        `'${fileName}' हा अयोग्य फाईल प्रकार आहे. फक्त .xlsx, .xls, .csv आणि .pdf फाईल्स निवडा.`
      );
      return false;
    }

    const fileType: "EXCEL" | "CSV" | "PDF" = ext === ".pdf" ? "PDF" : (ext === ".csv" ? "CSV" : "EXCEL");
    const newFile: QueuedFile = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      name: fileName,
      size: fileSize,
      type: fileType,
      fileObj,
      uri
    };

    setFileQueue(prev => {
      // Prevent duplicates by filename
      if (prev.some(f => f.name === fileName)) {
        Alert.alert("माहिती", `'${fileName}' आधीच निवडलेली आहे.`);
        return prev;
      }
      return [...prev, newFile];
    });

    return true;
  };

  const handlePickFiles = async () => {
    try {
      if (Platform.OS === "web") {
        const input = document.createElement("input");
        input.type = "file";
        input.multiple = true;
        input.accept = ".xlsx,.xls,.csv,.pdf,application/pdf";
        input.onchange = (e: any) => {
          const files: FileList = e.target.files;
          if (files && files.length > 0) {
            let addedCount = 0;
            for (let i = 0; i < files.length; i++) {
              const file = files[i];
              if (validateAndAddFile(file.name, file.size, file)) {
                addedCount++;
              }
            }
            if (addedCount > 0) {
              Alert.alert("यशस्वी", `${addedCount} फाईल्स यादीत जोडल्या गेल्या.`);
            }
          }
        };
        input.click();
      } else {
        // Native device document picker (Android & iOS)
        const result = await DocumentPicker.getDocumentAsync({
          type: [
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.ms-excel",
            "text/csv",
            "text/comma-separated-values",
            "application/csv",
            "application/pdf"
          ],
          multiple: true,
          copyToCacheDirectory: true
        });

        if (result.canceled) return;

        if (result.assets && result.assets.length > 0) {
          let addedCount = 0;
          for (const asset of result.assets) {
            const fileObj = (asset as any).file || null;
            if (validateAndAddFile(asset.name, asset.size || 0, fileObj, asset.uri)) {
              addedCount++;
            }
          }
          if (addedCount > 0) {
            Alert.alert("यशस्वी", `${addedCount} फाईल्स यादीत जोडल्या गेल्या.`);
          }
        }
      }
    } catch (err: any) {
      console.error("Document picker error:", err);
      Alert.alert("त्रुटी", "फाईल निवडताना अडचण आली: " + (err?.message || ""));
    }
  };

  const handleRemoveFile = (id: string) => {
    setFileQueue(prev => prev.filter(f => f.id !== id));
  };

  const handleClearAll = () => {
    setFileQueue([]);
  };

  const handleStartUpload = async () => {
    if (!selectedVillage) {
      Alert.alert("गाव निवडा", "कृपया प्रथम लक्ष्यित गाव निवडा.");
      return;
    }
    if (fileQueue.length === 0) {
      Alert.alert("फाईल्स निवडा", t("no_files_selected"));
      return;
    }

    setUploading(true);
    let successCount = 0;
    const errors: string[] = [];

    try {
      if (clearBeforeUpload) {
        setUploadProgressText("आधीचा जुना मतदार डेटा साफ होत आहे...");
        try {
          await adminAPI.clearAllVoters();
        } catch (e) {
          console.warn("Clear error before upload:", e);
        }
      }

      for (let i = 0; i < fileQueue.length; i++) {
        const item = fileQueue[i];
        setUploadProgressText(`अपलोड व प्रक्रिया होत आहे (${i + 1}/${fileQueue.length}): ${item.name}`);

        const formData = new FormData();
        const vId = selectedVillage?.id || DEFAULT_SAKHARALE.id;
        formData.append("village_id", vId);
        formData.append("auto_commit", "true");
        formData.append("clear_previous", "false");

        let mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        const lowerName = item.name.toLowerCase();
        if (lowerName.endsWith(".pdf")) {
          mimeType = "application/pdf";
        } else if (lowerName.endsWith(".csv")) {
          mimeType = "text/csv";
        } else if (lowerName.endsWith(".xls")) {
          mimeType = "application/vnd.ms-excel";
        }

        if (Platform.OS === "web" && item.fileObj) {
          formData.append("file", item.fileObj);
        } else {
          formData.append("file", {
            uri: item.uri || "",
            name: item.name,
            type: mimeType
          } as any);
        }

        try {
          await adminAPI.uploadFile(formData);
          successCount++;
        } catch (err: any) {
          const detail = err?.message || err?.response?.data?.detail || "अपलोड त्रुटी";
          console.error("Upload file error for", item.name, detail);
          errors.push(`${item.name} (${detail})`);
        }
      }

      setFileQueue([]);
      adminAPI.invalidateDashboardCache();
      await loadPastImports();

      const vName = selectedVillage?.name_mr || selectedVillage?.name_en || "साखराळे";
      if (errors.length === 0) {
        Alert.alert(
          t("upload_success_title"),
          `'${vName}' गावासाठी ${successCount} फाईल्स यशस्वीरित्या समाविष्ट केल्या आहेत!`
        );
      } else {
        Alert.alert(
          "काही फाईल्स अपलोड अयशस्वी",
          `${successCount} फाईल्स अपलोड झाल्या, पण या फाईल्समध्ये त्रुटी आली: ${errors.join(", ")}`
        );
      }
    } finally {
      setUploading(false);
      setUploadProgressText("");
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <Header title={t("upload_studio_title")} showBack onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Info Banner */}
        <View style={[styles.bannerCard, { backgroundColor: isDark ? "rgba(37, 99, 235, 0.12)" : "#EFF6FF", borderColor: isDark ? "rgba(59, 130, 246, 0.3)" : "#BFDBFE" }]}>
          <Ionicons name="cloud-upload" size={24} color={isDark ? "#60A5FA" : "#2563EB"} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.bannerTitle, { color: isDark ? "#93C5FD" : "#1D4ED8" }]}>Admin Excel/CSV Upload Studio</Text>
            <Text style={[styles.bannerText, { color: isDark ? "#94A3B8" : "#475569" }]}>
              प्रथम गाव निवडा, त्यानंतर त्या गावाच्या एक्सेल किंवा सीएसव्ही फाईल्स (.xlsx, .xls, .csv) जोडून अपलोड करा.
            </Text>
          </View>
        </View>

        {/* RESET & CLEAN VOTER DATA CARD */}
        <View style={[styles.dangerActionCard, { backgroundColor: isDark ? "rgba(239, 68, 68, 0.08)" : "#FEF2F2", borderColor: isDark ? "rgba(239, 68, 68, 0.25)" : "#FECACA" }]}>
          <View style={styles.dangerHeaderRow}>
            <View style={[styles.dangerIconCircle, { backgroundColor: isDark ? "rgba(239, 68, 68, 0.15)" : "#FEE2E2" }]}>
              <Ionicons name="trash-bin-outline" size={20} color="#EF4444" />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={[styles.dangerTitle, { color: isDark ? "#FCA5A5" : "#991B1B" }]}>डेटाबेस साफ करा (Clear All Voter Data)</Text>
              <Text style={[styles.dangerSubtitle, { color: isDark ? theme.colors.textMuted : "#64748B" }]}>
                नवीन Excel/CSV अपलोड करण्यापूर्वी जुना मतदार डेटा साफ करा जेणेकरून ॲपमध्ये फक्त नवीन रिअल-टाईम डेटा राहील.
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.dangerBtn, clearing && { opacity: 0.6 }]}
            onPress={handleClearAllVoterData}
            disabled={clearing || uploading}
            activeOpacity={0.8}
          >
            {clearing ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Ionicons name="trash" size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.dangerBtnText}>सर्व मतदार डेटा साफ करा (Clear Database)</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* STEP 1: Target Village Selection */}
        <Text style={[styles.sectionHeading, { color: theme.colors.textPrimary }]}>{t("target_village_selection")}</Text>
        {loadingVillages && villages.length === 0 ? (
          <ActivityIndicator color={theme.colors.primaryLight} style={{ marginVertical: 12 }} />
        ) : (
          <View style={[styles.villagePickerCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <Text style={[styles.label, { color: theme.colors.textMuted }]}>{t("choose_village")}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
              {villages.map((v) => {
                const isSelected = selectedVillage?.id === v.id;
                return (
                  <TouchableOpacity
                    key={v.id}
                    style={[
                      styles.villageChip,
                      { backgroundColor: isDark ? theme.colors.surface : "#F1F5F9", borderColor: theme.colors.border },
                      isSelected && styles.villageChipActive
                    ]}
                    onPress={() => setSelectedVillage(v)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="location"
                      size={16}
                      color={isSelected ? "#FFFFFF" : theme.colors.primaryLight}
                      style={{ marginRight: 6 }}
                    />
                    <Text style={[
                      styles.villageChipText,
                      { color: theme.colors.textSecondary },
                      isSelected && styles.villageChipTextActive
                    ]}>
                      {v.name_mr || v.name_en}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            {selectedVillage && (
              <View style={[styles.selectedVillageDetail, { backgroundColor: isDark ? "rgba(99, 102, 241, 0.1)" : "#EEF2FF" }]}>
                <Ionicons name="checkmark-circle" size={16} color="#34D399" style={{ marginRight: 6 }} />
                <Text style={[styles.selectedVillageText, { color: theme.colors.textPrimary }]}>
                  निवडलेले गाव: <Text style={{ fontWeight: "800", color: isDark ? "#60A5FA" : "#2563EB" }}>{selectedVillage.name_mr || selectedVillage.name_en}</Text> ({selectedVillage.taluka || "वाळवा"}, {selectedVillage.district || "सांगली"})
                </Text>
              </View>
            )}
          </View>
        )}

        {/* STEP 2: File Picker Dropzone (Multiple Files) */}
        <Text style={[styles.sectionHeading, { color: theme.colors.textPrimary }]}>{t("select_documents")}</Text>
        <TouchableOpacity
          style={[styles.dropzone, { backgroundColor: theme.colors.card, borderColor: isDark ? "rgba(99, 102, 241, 0.4)" : "#CBD5E1" }]}
          onPress={handlePickFiles}
          activeOpacity={0.7}
        >
          <View style={[styles.dropzoneIconCircle, { backgroundColor: isDark ? "rgba(99, 102, 241, 0.12)" : "#EEF2FF" }]}>
            <Ionicons name="folder-open-outline" size={36} color={isDark ? theme.colors.primaryLight : "#4F46E5"} />
          </View>
          <Text style={[styles.dropzoneTitle, { color: theme.colors.textPrimary }]}>
            एक्सेल, सीएसव्ही किंवा पीडीएफ फाईल्स निवडा
          </Text>
          <Text style={[styles.dropzoneSub, { color: theme.colors.textMuted }]}>
            मतदार यादी .xlsx, .xls, .csv किंवा .pdf फाईल्स स्वीकारल्या जातात (एकाधिक फाईल्स निवडा)
          </Text>
          <View style={styles.browseBtn}>
            <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.browseBtnText}>{t("browse_files")}</Text>
          </View>
        </TouchableOpacity>

        {/* Selected Files Queue */}
        {fileQueue.length > 0 && (
          <View style={[styles.queueContainer, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <View style={[styles.queueHeader, { borderBottomColor: theme.colors.border }]}>
              <Text style={[styles.queueTitle, { color: theme.colors.textPrimary }]}>
                {t("selected_files_queue")} ({fileQueue.length})
              </Text>
              <TouchableOpacity onPress={handleClearAll}>
                <Text style={styles.clearAllText}>सर्व काढा (Clear All)</Text>
              </TouchableOpacity>
            </View>

            {fileQueue.map((file) => (
              <View key={file.id} style={[styles.fileItemCard, { backgroundColor: isDark ? theme.colors.surface : "#FFFFFF", borderColor: theme.colors.border, borderWidth: 1 }]}>
                <View style={[styles.fileTypeBadge, { backgroundColor: file.type === "PDF" ? "#EF4444" : (file.type === "CSV" ? "#3B82F6" : "#10B981") }]}>
                  <Text style={styles.fileTypeBadgeText}>{file.type}</Text>
                </View>

                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.fileNameText, { color: theme.colors.textPrimary }]} numberOfLines={1}>{file.name}</Text>
                  <Text style={[styles.fileSizeText, { color: theme.colors.textMuted }]}>
                    {formatFileSize(file.size)} • {selectedVillage?.name_mr || "साखराळे"} साठी सज्ज
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.removeBtn}
                  onPress={() => handleRemoveFile(file.id)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="trash-outline" size={18} color="#EF4444" />
                </TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity style={styles.addMoreBtn} onPress={handlePickFiles}>
              <Ionicons name="add" size={18} color={isDark ? "#60A5FA" : "#2563EB"} style={{ marginRight: 6 }} />
              <Text style={[styles.addMoreBtnText, { color: isDark ? "#60A5FA" : "#2563EB" }]}>{t("add_more_files")}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Option to auto-clear before this upload */}
        {fileQueue.length > 0 && (
          <TouchableOpacity
            style={[styles.clearOptionRow, { backgroundColor: isDark ? "rgba(239, 68, 68, 0.06)" : "#FEF2F2", borderColor: isDark ? "rgba(239, 68, 68, 0.2)" : "#FECACA" }]}
            onPress={() => setClearBeforeUpload(!clearBeforeUpload)}
            activeOpacity={0.8}
          >
            <Ionicons
              name={clearBeforeUpload ? "checkbox" : "square-outline"}
              size={20}
              color={clearBeforeUpload ? "#EF4444" : theme.colors.textMuted}
              style={{ marginRight: 8 }}
            />
            <Text style={[styles.clearOptionText, { color: theme.colors.textSecondary }, clearBeforeUpload && { color: isDark ? "#FCA5A5" : "#991B1B", fontWeight: "700" }]}>
              नवीन डेटा अपलोड करताना आधीचा सर्व जुना डेटा आपोआप हटवा (Clear old data before import)
            </Text>
          </TouchableOpacity>
        )}

        {/* STEP 3: Start Upload Button */}
        <TouchableOpacity
          style={[styles.uploadSubmitBtn, (fileQueue.length === 0 || uploading) && { opacity: 0.5 }]}
          onPress={handleStartUpload}
          disabled={fileQueue.length === 0 || uploading}
          activeOpacity={0.8}
        >
          {uploading ? (
            <View style={{ alignItems: "center" }}>
              <ActivityIndicator color="#FFFFFF" />
              <Text style={styles.uploadingProgressText}>{uploadProgressText}</Text>
            </View>
          ) : (
            <>
              <Ionicons name="cloud-upload" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.uploadSubmitBtnText}>
                {t("start_upload")} ({fileQueue.length} फाईल्स)
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* STEP 4: Past Import Files & History */}
        <View style={styles.pastImportsHeaderRow}>
          <Text style={[styles.sectionHeading, { color: theme.colors.textPrimary }]}>{t("past_import_history")}</Text>
          <TouchableOpacity onPress={loadPastImports} style={styles.refreshJobsBtn}>
            <Ionicons name="refresh" size={16} color={isDark ? "#60A5FA" : "#2563EB"} style={{ marginRight: 4 }} />
            <Text style={[styles.refreshJobsText, { color: isDark ? "#60A5FA" : "#2563EB" }]}>ताजे करा (Refresh)</Text>
          </TouchableOpacity>
        </View>

        {loadingJobs ? (
          <ActivityIndicator color={theme.colors.primaryLight} style={{ marginVertical: 20 }} />
        ) : importJobs.length === 0 ? (
          <View style={[styles.emptyJobsCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <Ionicons name="documents-outline" size={32} color={theme.colors.textMuted} />
            <Text style={[styles.emptyJobsText, { color: theme.colors.textMuted }]}>{t("no_past_imports")}</Text>
          </View>
        ) : (
          importJobs.map((job) => {
            const isCompleted = job.status === "COMPLETED";
            const dateStr = job.createdAt ? new Date(job.createdAt).toLocaleString("mr-IN") : "अलीकडे";
            const isDeleting = deletingJobId === job.id;
            return (
              <View key={job.id} style={[styles.jobCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                <TouchableOpacity
                  style={{ flex: 1, flexDirection: "row", alignItems: "center" }}
                  onPress={() => navigation.navigate("ImportJobs", { jobId: job.id })}
                  activeOpacity={0.7}
                >
                  <View style={[styles.jobIconCircle, { backgroundColor: job.fileType === "PDF" ? "rgba(239, 68, 68, 0.15)" : "rgba(16, 185, 129, 0.15)" }]}>
                    <Ionicons
                      name={job.fileType === "PDF" ? "document-text" : "grid"}
                      size={22}
                      color={job.fileType === "PDF" ? "#EF4444" : "#10B981"}
                    />
                  </View>

                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.jobFileName, { color: theme.colors.textPrimary }]} numberOfLines={1}>{job.fileName}</Text>
                    <View style={styles.jobMetaRow}>
                      <View style={[styles.villageTag, { backgroundColor: isDark ? "rgba(99, 102, 241, 0.15)" : "#EEF2FF" }]}>
                        <Text style={[styles.villageTagText, { color: isDark ? theme.colors.primaryLight : "#4F46E5" }]}>{job.villageName || "साखराळे"}</Text>
                      </View>
                      <Text style={[styles.jobRecordsText, { color: theme.colors.textMuted }]}>
                        {job.metrics?.totalRecords ? `${job.metrics.totalRecords.toLocaleString()} मतदार` : "प्रक्रिया सुरू"}
                      </Text>
                    </View>
                    <Text style={[styles.jobDateText, { color: theme.colors.textMuted }]}>{dateStr}</Text>
                  </View>

                  <View style={[styles.jobStatusPill, { backgroundColor: isCompleted ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)" }]}>
                    <Text style={[styles.jobStatusPillText, { color: isCompleted ? "#34D399" : "#FBBF24" }]}>
                      {isCompleted ? "पूर्ण" : "चालू"}
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Delete Job Button */}
                <TouchableOpacity
                  style={styles.deleteJobBtn}
                  onPress={() => handleDeleteJob(job)}
                  disabled={isDeleting}
                  activeOpacity={0.7}
                >
                  {isDeleting ? (
                    <ActivityIndicator size="small" color="#EF4444" />
                  ) : (
                    <Ionicons name="trash-outline" size={18} color="#EF4444" />
                  )}
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Delete Import Job Confirmation Modal */}
      <Modal visible={deleteModalVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <View style={[styles.modalIconCircle, { backgroundColor: isDark ? "rgba(239, 68, 68, 0.15)" : "#FEE2E2" }]}>
              <Ionicons name="trash" size={28} color="#EF4444" />
            </View>
            <Text style={[styles.modalTitle, { color: theme.colors.textPrimary }]}>इम्पोर्ट रेकॉर्ड हटवा</Text>
            <Text style={[styles.modalDesc, { color: theme.colors.textSecondary }]}>
              {`'${jobToDelete?.fileName || "हा फाईल"}' चा इम्पोर्ट रेकॉर्ड आणि त्याद्वारे डेटाबेसमध्ये जोडलेला सर्व मतदार डेटा हटवायचा आहे का?`}
            </Text>
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { backgroundColor: isDark ? theme.colors.surface : "#F1F5F9", borderColor: theme.colors.border }]}
                onPress={() => { setDeleteModalVisible(false); setJobToDelete(null); }}
              >
                <Text style={[styles.modalCancelText, { color: theme.colors.textPrimary }]}>रद्द करा</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, { backgroundColor: "#EF4444" }]}
                onPress={handleConfirmDeleteJob}
              >
                <Text style={styles.modalConfirmText}>होय, हटवा</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Clear Database Options Modal */}
      <Modal visible={clearModalVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, maxWidth: 460 }]}>
            <View style={[styles.modalIconCircle, { backgroundColor: isDark ? "rgba(239, 68, 68, 0.15)" : "#FEE2E2" }]}>
              <Ionicons name="trash-bin" size={28} color="#EF4444" />
            </View>
            <Text style={[styles.modalTitle, { color: theme.colors.textPrimary }]}>डेटाबेस स्वच्छता (Safe Database Cleanup)</Text>
            <Text style={[styles.modalDesc, { color: theme.colors.textSecondary, marginBottom: 12 }]}>
              कोणता डेटा साफ करायचा आहे ते निवडा. ही प्रक्रिया Supabase आणि Cloudinary वर सुरक्षितपणे चालवली जाईल.
            </Text>

            {/* Safeguard Notice */}
            <View style={[styles.safeguardBanner, { backgroundColor: isDark ? "#064E3B" : "#D1FAE5", borderColor: "#10B981" }]}>
              <Ionicons name="shield-checkmark" size={18} color="#10B981" style={{ marginRight: 8 }} />
              <Text style={{ flex: 1, fontSize: 12, color: isDark ? "#A7F3D0" : "#065F46", fontWeight: "600" }}>
                सुरक्षितता हमी: Admin खाती (Admin, Karan, Prajakta, Sushant) आणि साखराळे गावाचा डेटा कधीही हटवला जाणार नाही.
              </Text>
            </View>

            {/* Cleanup Options Checkboxes */}
            <View style={{ width: "100%", marginVertical: 12, gap: 10 }}>
              {/* Option 1: Voters Data */}
              <TouchableOpacity
                style={[styles.cleanupOptionCard, { backgroundColor: isDark ? theme.colors.surface : "#F8FAFC", borderColor: clearVotersOpt ? theme.colors.primaryLight : theme.colors.border }]}
                onPress={() => setClearVotersOpt(!clearVotersOpt)}
                activeOpacity={0.7}
              >
                <View style={[styles.cleanupCheckbox, { borderColor: clearVotersOpt ? theme.colors.primaryLight : theme.colors.textMuted, backgroundColor: clearVotersOpt ? theme.colors.primaryLight : "transparent" }]}>
                  {clearVotersOpt && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.cleanupOptionTitle, { color: theme.colors.textPrimary }]}>सर्व मतदार नोंदी (Voters Data)</Text>
                  <Text style={[styles.cleanupOptionSub, { color: theme.colors.textMuted }]}>Supabase मधील सर्व मतदार डेटा साफ केला जाईल</Text>
                </View>
              </TouchableOpacity>

              {/* Option 2: Import History */}
              <TouchableOpacity
                style={[styles.cleanupOptionCard, { backgroundColor: isDark ? theme.colors.surface : "#F8FAFC", borderColor: clearImportHistoryOpt ? theme.colors.primaryLight : theme.colors.border }]}
                onPress={() => setClearImportHistoryOpt(!clearImportHistoryOpt)}
                activeOpacity={0.7}
              >
                <View style={[styles.cleanupCheckbox, { borderColor: clearImportHistoryOpt ? theme.colors.primaryLight : theme.colors.textMuted, backgroundColor: clearImportHistoryOpt ? theme.colors.primaryLight : "transparent" }]}>
                  {clearImportHistoryOpt && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.cleanupOptionTitle, { color: theme.colors.textPrimary }]}>इम्पोर्ट इतिहास (Import Jobs History)</Text>
                  <Text style={[styles.cleanupOptionSub, { color: theme.colors.textMuted }]}>मागील सर्व एक्सेल इम्पोर्ट जॉब्स नोंदी साफ केल्या जातील</Text>
                </View>
              </TouchableOpacity>

              {/* Option 3: Activity Logs */}
              <TouchableOpacity
                style={[styles.cleanupOptionCard, { backgroundColor: isDark ? theme.colors.surface : "#F8FAFC", borderColor: clearActivityLogsOpt ? theme.colors.primaryLight : theme.colors.border }]}
                onPress={() => setClearActivityLogsOpt(!clearActivityLogsOpt)}
                activeOpacity={0.7}
              >
                <View style={[styles.cleanupCheckbox, { borderColor: clearActivityLogsOpt ? theme.colors.primaryLight : theme.colors.textMuted, backgroundColor: clearActivityLogsOpt ? theme.colors.primaryLight : "transparent" }]}>
                  {clearActivityLogsOpt && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.cleanupOptionTitle, { color: theme.colors.textPrimary }]}>युझर ॲक्टिव्हिटी लॉग्स (Activity Logs)</Text>
                  <Text style={[styles.cleanupOptionSub, { color: theme.colors.textMuted }]}>वापरकर्त्यांच्या कॉल, एसएमएस व लॉगिन नोंदी स्वच्छ करा</Text>
                </View>
              </TouchableOpacity>

              {/* Option 4: Cloudinary Files */}
              <TouchableOpacity
                style={[styles.cleanupOptionCard, { backgroundColor: isDark ? theme.colors.surface : "#F8FAFC", borderColor: deleteCloudinaryFilesOpt ? "#EF4444" : theme.colors.border }]}
                onPress={() => setDeleteCloudinaryFilesOpt(!deleteCloudinaryFilesOpt)}
                activeOpacity={0.7}
              >
                <View style={[styles.cleanupCheckbox, { borderColor: deleteCloudinaryFilesOpt ? "#EF4444" : theme.colors.textMuted, backgroundColor: deleteCloudinaryFilesOpt ? "#EF4444" : "transparent" }]}>
                  {deleteCloudinaryFilesOpt && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.cleanupOptionTitle, { color: theme.colors.textPrimary }]}>Cloudinary वरील मूळ फाईल्स (Stored Files)</Text>
                  <Text style={[styles.cleanupOptionSub, { color: theme.colors.textMuted }]}>क्लाउड स्टोरेजमधील सेव्ह केलेल्या मूळ एक्सेल फाईल्स हटवा</Text>
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { backgroundColor: isDark ? theme.colors.surface : "#F1F5F9", borderColor: theme.colors.border }]}
                onPress={() => setClearModalVisible(false)}
                disabled={clearing}
              >
                <Text style={[styles.modalCancelText, { color: theme.colors.textPrimary }]}>रद्द करा</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, { backgroundColor: "#EF4444" }, clearing && { opacity: 0.6 }]}
                onPress={handleConfirmClearAll}
                disabled={clearing || (!clearVotersOpt && !clearImportHistoryOpt && !clearActivityLogsOpt && !deleteCloudinaryFilesOpt)}
              >
                {clearing ? (
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <ActivityIndicator color="#FFFFFF" size="small" style={{ marginRight: 8 }} />
                    <Text style={styles.modalConfirmText}>डेटा साफ होत आहे...</Text>
                  </View>
                ) : (
                  <Text style={styles.modalConfirmText}>निवडलेला डेटा साफ करा</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Verified Cleanup Result Dialog */}
      <Modal visible={resultModalVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, maxWidth: 440 }]}>
            <View style={[styles.modalIconCircle, { backgroundColor: isDark ? "rgba(16, 185, 129, 0.15)" : "#D1FAE5" }]}>
              <Ionicons name="checkmark-done" size={30} color="#10B981" />
            </View>
            <Text style={[styles.modalTitle, { color: theme.colors.textPrimary }]}>डेटाबेस स्वच्छता पूर्ण!</Text>
            <Text style={[styles.modalDesc, { color: theme.colors.textSecondary, marginBottom: 14 }]}>
              निवडलेला सर्व डेटा Supabase व Cloudinary मधून सुरक्षितपणे काढण्यात आला आणि पडताळणी झाली आहे.
            </Text>

            {/* Result Metrics Card */}
            <View style={[styles.resultMetricsCard, { backgroundColor: isDark ? theme.colors.surface : "#F8FAFC", borderColor: theme.colors.border }]}>
              <View style={styles.resultMetricRow}>
                <Ionicons name="cloud-done" size={16} color="#3B82F6" />
                <Text style={[styles.resultMetricLabel, { color: theme.colors.textPrimary }]}>Supabase मतदार नोंदी:</Text>
                <Text style={[styles.resultMetricValue, { color: "#10B981" }]}>
                  {cleanupResult?.supabase_voters_deleted ?? cleanupResult?.voters_deleted ?? 0} हटवले (उर्वरित: {cleanupResult?.supabase_voters_remaining ?? cleanupResult?.voters_remaining ?? 0} ✓)
                </Text>
              </View>

              {cleanupResult?.jobs_deleted !== undefined && cleanupResult.jobs_deleted > 0 && (
                <View style={styles.resultMetricRow}>
                  <Ionicons name="list" size={16} color="#8B5CF6" />
                  <Text style={[styles.resultMetricLabel, { color: theme.colors.textPrimary }]}>इम्पोर्ट इतिहास जॉब्स:</Text>
                  <Text style={[styles.resultMetricValue, { color: theme.colors.textPrimary }]}>{cleanupResult.jobs_deleted} हटवले</Text>
                </View>
              )}

              {cleanupResult?.cloudinary_files_deleted !== undefined && cleanupResult.cloudinary_files_deleted > 0 && (
                <View style={styles.resultMetricRow}>
                  <Ionicons name="cloud-offline" size={16} color="#EF4444" />
                  <Text style={[styles.resultMetricLabel, { color: theme.colors.textPrimary }]}>Cloudinary फाईल्स:</Text>
                  <Text style={[styles.resultMetricValue, { color: theme.colors.textPrimary }]}>{cleanupResult.cloudinary_files_deleted} हटवले</Text>
                </View>
              )}

              <View style={styles.resultMetricRow}>
                <Ionicons name="flash" size={16} color="#F59E0B" />
                <Text style={[styles.resultMetricLabel, { color: theme.colors.textPrimary }]}>सिस्टम व रिपोर्ट कॅश:</Text>
                <Text style={[styles.resultMetricValue, { color: "#10B981" }]}>पूर्णपणे रिफ्रेश (Cleared)</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.resultModalOkBtn}
              onPress={() => setResultModalVisible(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.resultModalOkBtnText}>समजले (OK)</Text>
            </TouchableOpacity>
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
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  bannerCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(37, 99, 235, 0.12)",
    padding: 14,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.3)",
    marginBottom: 20,
  },
  bannerTitle: {
    color: "#93C5FD",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 2,
  },
  bannerText: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    lineHeight: 16,
  },
  sectionHeading: {
    color: theme.colors.textPrimary,
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 10,
    marginTop: 10,
  },
  villagePickerCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 16,
  },
  label: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 8,
  },
  chipScroll: {
    flexDirection: "row",
    marginBottom: 8,
  },
  villageChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  villageChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primaryLight,
  },
  villageChipText: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: "600",
  },
  villageChipTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  selectedVillageDetail: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(99, 102, 241, 0.1)",
    padding: 10,
    borderRadius: theme.borderRadius.md,
    marginTop: 6,
  },
  selectedVillageText: {
    color: theme.colors.textPrimary,
    fontSize: 12,
  },
  dropzone: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 2,
    borderColor: "rgba(99, 102, 241, 0.4)",
    borderStyle: "dashed",
    paddingVertical: 28,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  dropzoneIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(99, 102, 241, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  dropzoneTitle: {
    color: theme.colors.textPrimary,
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 4,
    textAlign: "center",
  },
  dropzoneSub: {
    color: theme.colors.textMuted,
    fontSize: 12,
    textAlign: "center",
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  browseBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.md,
  },
  browseBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  queueContainer: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 16,
  },
  queueHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  queueTitle: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: "700",
  },
  clearAllText: {
    color: "#EF4444",
    fontSize: 12,
    fontWeight: "600",
  },
  fileItemCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    padding: 10,
    borderRadius: theme.borderRadius.md,
    marginBottom: 8,
  },
  fileTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  fileTypeBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },
  fileNameText: {
    color: theme.colors.textPrimary,
    fontSize: 13,
    fontWeight: "600",
  },
  fileSizeText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  removeBtn: {
    padding: 8,
  },
  addMoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    marginTop: 4,
  },
  addMoreBtnText: {
    color: "#60A5FA",
    fontSize: 13,
    fontWeight: "600",
  },
  uploadSubmitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#10B981",
    paddingVertical: 14,
    borderRadius: theme.borderRadius.lg,
    marginBottom: 24,
  },
  uploadSubmitBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  uploadingProgressText: {
    color: "#FFFFFF",
    fontSize: 12,
    marginTop: 6,
  },
  pastImportsHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 10,
  },
  refreshJobsBtn: {
    flexDirection: "row",
    alignItems: "center",
  },
  refreshJobsText: {
    color: "#60A5FA",
    fontSize: 12,
    fontWeight: "600",
  },
  emptyJobsCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  emptyJobsText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    marginTop: 8,
  },
  jobCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  jobIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  jobFileName: {
    color: theme.colors.textPrimary,
    fontSize: 13,
    fontWeight: "700",
  },
  jobMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 8,
  },
  villageTag: {
    backgroundColor: "rgba(99, 102, 241, 0.15)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  villageTagText: {
    color: theme.colors.primaryLight,
    fontSize: 10,
    fontWeight: "700",
  },
  jobRecordsText: {
    color: theme.colors.textMuted,
    fontSize: 11,
  },
  jobDateText: {
    color: theme.colors.textMuted,
    fontSize: 10,
    marginTop: 3,
  },
  jobStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  jobStatusPillText: {
    fontSize: 11,
    fontWeight: "700",
  },
  dangerActionCard: {
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.25)",
    borderRadius: theme.borderRadius.lg,
    padding: 14,
    marginBottom: 20,
  },
  dangerHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  dangerIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  dangerTitle: {
    color: "#FCA5A5",
    fontSize: 14,
    fontWeight: "800",
  },
  dangerSubtitle: {
    color: theme.colors.textMuted,
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  dangerBtn: {
    backgroundColor: "#DC2626",
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
  },
  dangerBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  clearOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(239, 68, 68, 0.06)",
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.2)",
  },
  clearOptionText: {
    flex: 1,
    color: theme.colors.textSecondary,
    fontSize: 12,
  },
  deleteJobBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: theme.colors.card,
    borderRadius: 16,
    padding: 22,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
  },
  modalIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  modalTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 8,
  },
  modalDesc: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    marginBottom: 20,
  },
  modalBtnRow: {
    flexDirection: "row",
    width: "100%",
    gap: 12,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
  },
  modalCancelText: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: "700",
  },
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  modalConfirmText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  safeguardBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    width: "100%",
    marginBottom: 8,
  },
  cleanupOptionCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    width: "100%",
  },
  cleanupCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  cleanupOptionTitle: {
    fontSize: 13,
    fontWeight: "700",
  },
  cleanupOptionSub: {
    fontSize: 11,
    marginTop: 2,
  },
  resultMetricsCard: {
    width: "100%",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  resultMetricRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  resultMetricLabel: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
  },
  resultMetricValue: {
    fontSize: 12,
    fontWeight: "700",
  },
  resultModalOkBtn: {
    width: "100%",
    height: 48,
    backgroundColor: "#10B981",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
    elevation: 3,
  },
  resultModalOkBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
});

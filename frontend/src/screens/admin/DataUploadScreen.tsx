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
import { theme } from "../../theme/theme";
import { useLanguage } from "../../context/LanguageContext";

interface QueuedFile {
  id: string;
  name: string;
  size: number;
  type: "EXCEL" | "CSV";
  fileObj?: any;
  uri?: string;
}

export const DataUploadScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { t } = useLanguage();

  const [villages, setVillages] = useState<Village[]>([]);
  const [selectedVillage, setSelectedVillage] = useState<Village | null>(null);
  const [fileQueue, setFileQueue] = useState<QueuedFile[]>([]);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadProgressText, setUploadProgressText] = useState<string>("");
  const [loadingVillages, setLoadingVillages] = useState<boolean>(true);
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

  const handleClearAllVoterData = () => {
    setClearModalVisible(true);
  };

  const handleConfirmClearAll = async () => {
    setClearing(true);
    setClearModalVisible(false);
    try {
      await adminAPI.clearAllVoters();
      setImportJobs([]);
      await loadPastImports();
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.alert("सर्व मतदार डेटा यशस्वीरित्या साफ केला गेला.");
      } else {
        Alert.alert("यशस्वी (Success)", "सर्व मतदार डेटा यशस्वीरित्या साफ केला गेला.");
      }
    } catch (err: any) {
      console.error("Failed to clear voters:", err);
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

  const loadVillages = async () => {
    try {
      const list = await villageAPI.getVillages();
      setVillages(list);
      if (list.length > 0) {
        // Default to Sakharele if available, else first village
        const sakharele = list.find(v => v.name_mr?.includes("साखराळे") || v.name_en?.toLowerCase().includes("sakharele"));
        setSelectedVillage(sakharele || list[0]);
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

  // Strict file validation: Only .xlsx, .xls, .csv are allowed. PDF is rejected.
  const validateAndAddFile = (fileName: string, fileSize: number, fileObj?: any, uri?: string): boolean => {
    const ext = fileName.slice(fileName.lastIndexOf(".")).toLowerCase();

    if (ext === ".pdf") {
      Alert.alert(
        "पीडीएफ समर्थित नाही (PDF Not Allowed)",
        `'${fileName}' ही पीडीएफ फाईल आहे. कृपया मतदार यादी एक्सेल (.xlsx, .xls) किंवा सीएसव्ही (.csv) फाईल स्वरूपात निवडा.`
      );
      return false;
    }

    const validExtensions = [".xlsx", ".xls", ".csv"];
    if (!validExtensions.includes(ext)) {
      Alert.alert(
        t("invalid_file_type") || "अयोग्य फाईल प्रकार",
        `'${fileName}' हा अयोग्य फाईल प्रकार आहे. फक्त .xlsx, .xls आणि .csv फाईल्स निवडा.`
      );
      return false;
    }

    const fileType: "EXCEL" | "CSV" = ext === ".csv" ? "CSV" : "EXCEL";
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
        input.accept = ".xlsx,.xls,.csv";
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
            "application/csv"
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
        formData.append("village_id", selectedVillage.id);
        formData.append("auto_commit", "true");

        if (Platform.OS === "web" && item.fileObj) {
          formData.append("file", item.fileObj);
        } else {
          formData.append("file", {
            uri: item.uri || "",
            name: item.name,
            type: item.name.toLowerCase().endsWith(".csv")
              ? "text/csv"
              : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          } as any);
        }

        try {
          await adminAPI.uploadExcel(formData);
          successCount++;
        } catch (err: any) {
          errors.push(item.name);
        }
      }

      setFileQueue([]);
      await loadPastImports();

      if (errors.length === 0) {
        Alert.alert(
          t("upload_success_title"),
          `'${selectedVillage.name_mr || selectedVillage.name_en}' गावासाठी ${successCount} फाईल्स यशस्वीरित्या पाठवल्या आहेत!`
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
    <SafeAreaView style={styles.safeArea}>
      <Header title={t("upload_studio_title")} showBack onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Info Banner */}
        <View style={styles.bannerCard}>
          <Ionicons name="cloud-upload" size={24} color="#60A5FA" />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.bannerTitle}>Admin Excel/CSV Upload Studio</Text>
            <Text style={styles.bannerText}>
              प्रथम गाव निवडा, त्यानंतर त्या गावाच्या एक्सेल किंवा सीएसव्ही फाईल्स (.xlsx, .xls, .csv) जोडून अपलोड करा.
            </Text>
          </View>
        </View>

        {/* RESET & CLEAN VOTER DATA CARD */}
        <View style={styles.dangerActionCard}>
          <View style={styles.dangerHeaderRow}>
            <View style={styles.dangerIconCircle}>
              <Ionicons name="trash-bin-outline" size={20} color="#EF4444" />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.dangerTitle}>डेटाबेस साफ करा (Clear All Voter Data)</Text>
              <Text style={styles.dangerSubtitle}>
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
        <Text style={styles.sectionHeading}>{t("target_village_selection")}</Text>
        {loadingVillages ? (
          <ActivityIndicator color={theme.colors.primaryLight} style={{ marginVertical: 12 }} />
        ) : (
          <View style={styles.villagePickerCard}>
            <Text style={styles.label}>{t("choose_village")}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
              {villages.map((v) => {
                const isSelected = selectedVillage?.id === v.id;
                return (
                  <TouchableOpacity
                    key={v.id}
                    style={[styles.villageChip, isSelected && styles.villageChipActive]}
                    onPress={() => setSelectedVillage(v)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="location"
                      size={16}
                      color={isSelected ? "#FFFFFF" : theme.colors.primaryLight}
                      style={{ marginRight: 6 }}
                    />
                    <Text style={[styles.villageChipText, isSelected && styles.villageChipTextActive]}>
                      {v.name_mr || v.name_en}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            {selectedVillage && (
              <View style={styles.selectedVillageDetail}>
                <Ionicons name="checkmark-circle" size={16} color="#34D399" style={{ marginRight: 6 }} />
                <Text style={styles.selectedVillageText}>
                  निवडलेले गाव: <Text style={{ fontWeight: "800", color: "#60A5FA" }}>{selectedVillage.name_mr || selectedVillage.name_en}</Text> ({selectedVillage.taluka || "वाळवा"}, {selectedVillage.district || "सांगली"})
                </Text>
              </View>
            )}
          </View>
        )}

        {/* STEP 2: File Picker Dropzone (Multiple Files) */}
        <Text style={styles.sectionHeading}>{t("select_documents")}</Text>
        <TouchableOpacity style={styles.dropzone} onPress={handlePickFiles} activeOpacity={0.7}>
          <View style={styles.dropzoneIconCircle}>
            <Ionicons name="folder-open-outline" size={36} color={theme.colors.primaryLight} />
          </View>
          <Text style={styles.dropzoneTitle}>
            एक्सेल किंवा सीएसव्ही फाईल्स निवडा
          </Text>
          <Text style={styles.dropzoneSub}>
            फक्त मतदार यादी .xlsx, .xls किंवा .csv फाईल्स स्वीकारल्या जातात (पीडीएफ फाईल्स समर्थित नाहीत)
          </Text>
          <View style={styles.browseBtn}>
            <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.browseBtnText}>{t("browse_files")}</Text>
          </View>
        </TouchableOpacity>

        {/* Selected Files Queue */}
        {fileQueue.length > 0 && (
          <View style={styles.queueContainer}>
            <View style={styles.queueHeader}>
              <Text style={styles.queueTitle}>
                {t("selected_files_queue")} ({fileQueue.length})
              </Text>
              <TouchableOpacity onPress={handleClearAll}>
                <Text style={styles.clearAllText}>सर्व काढा (Clear All)</Text>
              </TouchableOpacity>
            </View>

            {fileQueue.map((file) => (
              <View key={file.id} style={styles.fileItemCard}>
                <View style={[styles.fileTypeBadge, { backgroundColor: file.type === "CSV" ? "#3B82F6" : "#10B981" }]}>
                  <Text style={styles.fileTypeBadgeText}>{file.type}</Text>
                </View>

                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.fileNameText} numberOfLines={1}>{file.name}</Text>
                  <Text style={styles.fileSizeText}>
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
              <Ionicons name="add" size={18} color="#60A5FA" style={{ marginRight: 6 }} />
              <Text style={styles.addMoreBtnText}>{t("add_more_files")}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Option to auto-clear before this upload */}
        {fileQueue.length > 0 && (
          <TouchableOpacity
            style={styles.clearOptionRow}
            onPress={() => setClearBeforeUpload(!clearBeforeUpload)}
            activeOpacity={0.8}
          >
            <Ionicons
              name={clearBeforeUpload ? "checkbox" : "square-outline"}
              size={20}
              color={clearBeforeUpload ? "#EF4444" : theme.colors.textMuted}
              style={{ marginRight: 8 }}
            />
            <Text style={[styles.clearOptionText, clearBeforeUpload && { color: "#FCA5A5", fontWeight: "700" }]}>
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
          <Text style={styles.sectionHeading}>{t("past_import_history")}</Text>
          <TouchableOpacity onPress={loadPastImports} style={styles.refreshJobsBtn}>
            <Ionicons name="refresh" size={16} color="#60A5FA" style={{ marginRight: 4 }} />
            <Text style={styles.refreshJobsText}>ताजे करा (Refresh)</Text>
          </TouchableOpacity>
        </View>

        {loadingJobs ? (
          <ActivityIndicator color={theme.colors.primaryLight} style={{ marginVertical: 20 }} />
        ) : importJobs.length === 0 ? (
          <View style={styles.emptyJobsCard}>
            <Ionicons name="documents-outline" size={32} color={theme.colors.textMuted} />
            <Text style={styles.emptyJobsText}>{t("no_past_imports")}</Text>
          </View>
        ) : (
          importJobs.map((job) => {
            const isCompleted = job.status === "COMPLETED";
            const dateStr = job.createdAt ? new Date(job.createdAt).toLocaleString("mr-IN") : "अलीकडे";
            const isDeleting = deletingJobId === job.id;
            return (
              <View key={job.id} style={styles.jobCard}>
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
                    <Text style={styles.jobFileName} numberOfLines={1}>{job.fileName}</Text>
                    <View style={styles.jobMetaRow}>
                      <View style={styles.villageTag}>
                        <Text style={styles.villageTagText}>{job.villageName || "साखराळे"}</Text>
                      </View>
                      <Text style={styles.jobRecordsText}>
                        {job.metrics?.totalRecords ? `${job.metrics.totalRecords.toLocaleString()} मतदार` : "प्रक्रिया सुरू"}
                      </Text>
                    </View>
                    <Text style={styles.jobDateText}>{dateStr}</Text>
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
          <View style={styles.modalCard}>
            <View style={[styles.modalIconCircle, { backgroundColor: "rgba(239, 68, 68, 0.15)" }]}>
              <Ionicons name="trash" size={28} color="#EF4444" />
            </View>
            <Text style={styles.modalTitle}>इम्पोर्ट रेकॉर्ड हटवा</Text>
            <Text style={styles.modalDesc}>
              {`'${jobToDelete?.fileName || "हा फाईल"}' चा इम्पोर्ट रेकॉर्ड आणि त्याद्वारे डेटाबेसमध्ये जोडलेला सर्व मतदार डेटा हटवायचा आहे का?`}
            </Text>
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => { setDeleteModalVisible(false); setJobToDelete(null); }}
              >
                <Text style={styles.modalCancelText}>रद्द करा</Text>
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

      {/* Clear Database Confirmation Modal */}
      <Modal visible={clearModalVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={[styles.modalIconCircle, { backgroundColor: "rgba(239, 68, 68, 0.15)" }]}>
              <Ionicons name="warning" size={28} color="#EF4444" />
            </View>
            <Text style={styles.modalTitle}>सावधान! डेटाबेस साफ करा</Text>
            <Text style={styles.modalDesc}>
              आपण आधीचा सर्व मतदार डेटा व इम्पोर्ट इतिहास हटवू इच्छिता का? या कृतीमुळे सर्व मतदार नोंदी साफ केल्या जातील जेणेकरून आपण नवीन फाईल्स अपलोड करून फ्रेश मतदार डेटा वापरू शकता.
            </Text>
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setClearModalVisible(false)}
                disabled={clearing}
              >
                <Text style={styles.modalCancelText}>रद्द करा</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, { backgroundColor: "#EF4444" }, clearing && { opacity: 0.6 }]}
                onPress={handleConfirmClearAll}
                disabled={clearing}
              >
                {clearing ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.modalConfirmText}>होय, डेटा साफ करा</Text>
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
});

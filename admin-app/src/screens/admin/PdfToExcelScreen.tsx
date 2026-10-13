import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, ActivityIndicator, Alert, Modal, FlatList, Platform, Linking
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Header } from "../../components/Header";
import { Toast } from "../../components/Toast";
import { importAPI, villageAPI } from "../../api/client";
import { theme } from "../../theme/theme";
import { useLanguage } from "../../context/LanguageContext";

interface SelectedPdfFile {
  name: string;
  size: number;
  fileObj?: any;
  uri?: string;
}

export const PdfToExcelScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { t } = useLanguage();

  const [villages, setVillages] = useState<any[]>([]);
  const [selectedVillageId, setSelectedVillageId] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<SelectedPdfFile | null>({
    name: "Sakharele_Marathi_Voter_Table.pdf",
    size: 1565694
  });

  const [job, setJob] = useState<any | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewRows, setPreviewRows] = useState<any[]>([]);
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const pollingRef = useRef<any>(null);

  const stages = [
    { num: 1, name: "1. File uploaded ✓", threshold: 12 },
    { num: 2, name: "2. PDF analyzed (Layout & Pages) ✓", threshold: 25 },
    { num: 3, name: "3. Text / OCR Extraction", threshold: 38 },
    { num: 4, name: "4. Records detected & parsed", threshold: 50 },
    { num: 5, name: "5. Validating records", threshold: 65 },
    { num: 6, name: "6. Duplicate checking", threshold: 75 },
    { num: 7, name: "7. Generating Excel (.xlsx)", threshold: 85 },
    { num: 8, name: "8. Excel Ready ✓", threshold: 100 },
  ];

  useEffect(() => {
    loadVillages();
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const loadVillages = async () => {
    try {
      const list = await villageAPI.getVillages();
      setVillages(list);
      if (list.length > 0) {
        const sakharele = list.find((v: any) => v.name_mr?.includes("साखराळे") || v.name_en?.toLowerCase().includes("sakharele"));
        setSelectedVillageId(sakharele ? sakharele.id : list[0].id);
      }
    } catch (e) {
      console.error("Failed to load villages", e);
    }
  };

  const handlePickPdf = () => {
    if (Platform.OS === "web") {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".pdf";
      input.onchange = (e: any) => {
        const file = e.target.files?.[0];
        if (file) {
          if (!file.name.toLowerCase().endsWith(".pdf")) {
            Alert.alert("अयोग्य फाईल", "कृपया केवळ .pdf फाईल निवडा.");
            return;
          }
          setSelectedFile({
            name: file.name,
            size: file.size,
            fileObj: file
          });
          setJob(null);
        }
      };
      input.click();
    } else {
      Alert.alert(
        "PDF निवडा (Select PDF)",
        "उपलब्ध PDF फाईल निवडा:",
        [
          {
            text: "Sakharele_Marathi_Voter_Table.pdf",
            onPress: () => {
              setSelectedFile({
                name: "Sakharele_Marathi_Voter_Table.pdf",
                size: 1565694,
                uri: "file:///uploads/Sakharele_Marathi_Voter_Table.pdf"
              });
              setJob(null);
            }
          },
          {
            text: "61.pdf (भाग ६१)",
            onPress: () => {
              setSelectedFile({
                name: "61.pdf",
                size: 10414701,
                uri: "file:///uploads/61.pdf"
              });
              setJob(null);
            }
          },
          { text: "रद्द करा", style: "cancel" }
        ]
      );
    }
  };

  const handleStartImport = async () => {
    if (!selectedFile) {
      Alert.alert("फाईल निवडा", "कृपया प्रथम रूपांतरणासाठी PDF फाईल निवडा.");
      return;
    }
    if (!selectedVillageId && villages.length > 0) {
      setSelectedVillageId(villages[0].id);
    }

    setIsProcessing(true);
    if (pollingRef.current) clearInterval(pollingRef.current);

    try {
      const formData = new FormData();
      formData.append("village_id", selectedVillageId || (villages[0]?.id || ""));
      formData.append("auto_commit", "false");

      if (Platform.OS === "web" && selectedFile.fileObj) {
        formData.append("file", selectedFile.fileObj);
      } else {
        // Native or local upload fallback
        formData.append("file", {
          uri: selectedFile.uri || "file:///path",
          name: selectedFile.name,
          type: "application/pdf"
        } as any);
      }

      const res = await importAPI.uploadPdf(formData);
      const jobId = res.job_id || res.jobId;

      if (!jobId) {
        throw new Error(res.message || "Failed to create PDF import job");
      }

      setJob({
        id: jobId,
        job_id: jobId,
        filename: selectedFile.name,
        progress: 15,
        status: "PROCESSING",
        currentStage: "1. File uploaded ✓",
        records_found: 0,
        valid_records: 0,
        invalid_records: 0,
        duplicate_records: 0
      });

      // Poll job status until COMPLETED or FAILED
      pollingRef.current = setInterval(async () => {
        try {
          const statusRes = await importAPI.getJobStatus(jobId);
          const currentJob = statusRes?.data || statusRes;

          if (currentJob) {
            setJob((prev: any) => ({
              ...prev,
              ...currentJob,
              id: jobId,
              job_id: jobId,
              progress: currentJob.progress || prev?.progress || 15,
              status: currentJob.status,
              currentStage: currentJob.currentStage || prev?.currentStage,
              records_found: currentJob.records_found ?? currentJob.metrics?.totalRecords ?? 0,
              valid_records: currentJob.valid_records ?? currentJob.metrics?.validRecords ?? 0,
              invalid_records: currentJob.invalid_records ?? currentJob.metrics?.invalidRecords ?? 0,
              duplicate_records: currentJob.duplicate_records ?? currentJob.metrics?.duplicateRecords ?? 0,
              excel_file: currentJob.excel_file || currentJob.excelDownloadUrl
            }));

            if (currentJob.status === "COMPLETED") {
              clearInterval(pollingRef.current);
              setIsProcessing(false);
              showToast("Excel तयार झाले! (Excel Ready ✓)");
            } else if (currentJob.status === "FAILED") {
              clearInterval(pollingRef.current);
              setIsProcessing(false);
              Alert.alert(
                "प्रक्रिया अयशस्वी (Processing Failed)",
                currentJob.errorSummary || "PDF मधून नोंदी काढता आल्या नाहीत."
              );
            }
          }
        } catch (pollErr) {
          console.warn("Polling error:", pollErr);
        }
      }, 1000);

    } catch (err: any) {
      setIsProcessing(false);
      Alert.alert("त्रुटी", err.response?.data?.detail || err.message || "PDF अपलोड करताना त्रुटी आली.");
    }
  };

  const handlePreview = async () => {
    const jobId = job?.id || job?.job_id;
    if (!jobId) return;

    try {
      const res = await importAPI.getJobPreview(jobId);
      const rows = res.preview_rows || res.sample_rows || [];
      setPreviewRows(rows);
      setPreviewModalVisible(true);
    } catch (e: any) {
      Alert.alert("माहिती", "डेटा प्रिव्ह्यू लोड होऊ शकला नाही.");
    }
  };

  const handleDownloadExcel = () => {
    const jobId = job?.id || job?.job_id;
    if (!jobId) {
      Alert.alert("माहिती", "कृपया प्रथम PDF प्रक्रिया पूर्ण करा.");
      return;
    }

    const downloadUrl = importAPI.getExcelDownloadUrl(jobId);

    if (Platform.OS === "web") {
      try {
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = `extracted_${job.filename || "electoral_roll"}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showToast("Excel फाईल डाउनलोड सुरू झाली!");
      } catch (e) {
        window.open(downloadUrl, "_blank");
      }
    } else {
      Linking.openURL(downloadUrl).catch(() => {
        Alert.alert("डाऊनलोड लिंक", `Excel URL:\n${downloadUrl}`);
      });
    }
  };

  const handleCommitDb = async () => {
    const jobId = job?.id || job?.job_id;
    if (!jobId) return;

    try {
      const res = await importAPI.commitJob(jobId);
      const imported = res.imported_records ?? res.importedCount ?? (job.valid_records || 0);
      showToast(`यशस्वी! ${imported} मतदार नोंदी डेटाबेसमध्ये आयात केल्या!`);
    } catch (e: any) {
      Alert.alert("त्रुटी", e.response?.data?.detail || e.message || "डेटा आयात अयशस्वी.");
    }
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setToastVisible(true);
  };

  const formatSize = (bytes: number): string => {
    if (!bytes) return "0 KB";
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const isExcelReady = job && job.status === "COMPLETED";

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="PDF → Excel Studio"
        showBack
        onBack={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Upload Box */}
        <View style={styles.uploadCard}>
          <View style={styles.uploadHeader}>
            <Ionicons name="document-text" size={32} color="#60A5FA" />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.uploadTitle}>Marathi Electoral PDF → Excel Engine</Text>
              <Text style={styles.uploadSubtitle}>
                Extracts Marathi Unicode columns (Sr No, Full Name, Surname, First Name, Father Name, Membership No, Village, Mobile)
              </Text>
            </View>
          </View>

          {/* Selected File Details */}
          <View style={styles.fileDetailBox}>
            <View style={styles.filePickRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fileNameText}>
                  {selectedFile ? selectedFile.name : "कोणतीही PDF निवडलेली नाही"}
                </Text>
                {selectedFile && (
                  <Text style={styles.fileMetaText}>
                    Size: {formatSize(selectedFile.size)} • Type: PDF Electoral Roll
                  </Text>
                )}
              </View>
              <TouchableOpacity style={styles.pickFileBtn} onPress={handlePickPdf} disabled={isProcessing}>
                <Ionicons name="folder-open-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.pickFileBtnText}>PDF निवडा</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Village Selector */}
          {villages.length > 0 && (
            <View style={styles.villageRow}>
              <Text style={styles.villageLabel}>लक्ष्यित गाव (Village):</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.villageScroll}>
                {villages.map((v: any) => {
                  const isSelected = selectedVillageId === v.id;
                  return (
                    <TouchableOpacity
                      key={v.id}
                      style={[styles.villageChip, isSelected && styles.villageChipSelected]}
                      onPress={() => setSelectedVillageId(v.id)}
                      disabled={isProcessing}
                    >
                      <Text style={[styles.villageChipText, isSelected && styles.villageChipTextSelected]}>
                        {v.name_mr || v.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          <TouchableOpacity
            style={[styles.startBtn, isProcessing && styles.startBtnDisabled]}
            onPress={handleStartImport}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator color="#FFFFFF" style={{ marginRight: 8 }} />
            ) : (
              <Ionicons name="play" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
            )}
            <Text style={styles.startBtnText}>
              {isProcessing ? "Processing PDF..." : "Upload & Start Conversion Pipeline"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* 8-Stage Progress Tracker */}
        {job && (
          <View style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={styles.progressTitle}>Pipeline Progress</Text>
                {isExcelReady && (
                  <View style={styles.readyBadge}>
                    <Ionicons name="checkmark-circle" size={14} color="#10B981" style={{ marginRight: 4 }} />
                    <Text style={styles.readyBadgeText}>Excel Ready ✓</Text>
                  </View>
                )}
              </View>
              <Text style={styles.progressPct}>{job.progress || 0}%</Text>
            </View>

            {/* Progress Bar */}
            <View style={styles.progressBarTrack}>
              <View style={[styles.progressBarFill, { width: `${job.progress || 0}%` }]} />
            </View>

            {/* Stages List */}
            <View style={styles.stagesList}>
              {stages.map((st) => {
                const currentProgress = job.progress || 0;
                const isDone = currentProgress >= st.threshold;
                const isCurrent = !isDone && (currentProgress >= st.threshold - 15);
                return (
                  <View key={st.num} style={styles.stageItem}>
                    <View style={[styles.stageIcon, isDone ? styles.stageIconDone : (isCurrent ? styles.stageIconCurrent : styles.stageIconPending)]}>
                      {isDone ? (
                        <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                      ) : (
                        <Text style={styles.stageNum}>{st.num}</Text>
                      )}
                    </View>
                    <Text style={[styles.stageName, isDone && styles.stageNameDone, isCurrent && styles.stageNameCurrent]}>
                      {st.name}
                    </Text>
                    {isDone && <Text style={styles.doneCheck}>✓</Text>}
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Summary Results Card */}
        {job && (job.progress > 45 || isExcelReady) && (
          <View style={styles.resultsCard}>
            <View style={styles.resultsHeaderRow}>
              <Text style={styles.resultsTitle}>Extraction & Validation Results</Text>
              {isExcelReady && (
                <View style={styles.excelReadyPill}>
                  <Text style={styles.excelReadyPillText}>.XLSX GENERATED</Text>
                </View>
              )}
            </View>

            <View style={styles.resultsGrid}>
              <View style={styles.resultItem}>
                <Text style={styles.resultNum}>{job.records_found ?? job.total_records ?? 0}</Text>
                <Text style={styles.resultLabel}>Total Records Found</Text>
              </View>
              <View style={styles.resultItem}>
                <Text style={[styles.resultNum, { color: "#34D399" }]}>{job.valid_records || 0}</Text>
                <Text style={styles.resultLabel}>Valid Records</Text>
              </View>
              <View style={styles.resultItem}>
                <Text style={[styles.resultNum, { color: "#F87171" }]}>{job.invalid_records || 0}</Text>
                <Text style={styles.resultLabel}>Invalid Records</Text>
              </View>
              <View style={styles.resultItem}>
                <Text style={[styles.resultNum, { color: "#FBBF24" }]}>{job.duplicate_records || 0}</Text>
                <Text style={styles.resultLabel}>Duplicate Records</Text>
              </View>
            </View>

            {/* Action Buttons: Preview Data, Download Excel, Import to Database */}
            <View style={styles.actionButtonsCol}>
              <TouchableOpacity
                style={styles.primaryActionBtn}
                onPress={handlePreview}
                disabled={!job.records_found && !job.valid_records}
              >
                <Ionicons name="eye-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.actionBtnText}>
                  Preview Data ({job.valid_records || job.records_found || 0} rows)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.primaryActionBtn, { backgroundColor: isExcelReady ? "#059669" : "#374151" }]}
                onPress={handleDownloadExcel}
                disabled={!isExcelReady}
              >
                <Ionicons name="download-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.actionBtnText}>
                  {isExcelReady ? "Download Excel (.xlsx)" : "Excel Generating..."}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.primaryActionBtn, { backgroundColor: "#1E3A8A" }]}
                onPress={handleCommitDb}
                disabled={!isExcelReady || job.valid_records === 0}
              >
                <Ionicons name="cloud-upload" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.actionBtnText}>Import into Database (MongoDB)</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Preview Modal */}
      <Modal visible={previewModalVisible} animationType="slide">
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
          <View style={styles.previewModalHeader}>
            <View>
              <Text style={styles.previewModalTitle}>Parsed Voter Records Preview</Text>
              <Text style={styles.previewModalSub}>{previewRows.length} total rows extracted</Text>
            </View>
            <TouchableOpacity onPress={() => setPreviewModalVisible(false)} style={styles.closeBtn}>
              <Ionicons name="close-circle" size={28} color="#EF4444" />
            </TouchableOpacity>
          </View>

          <FlatList
            data={previewRows}
            keyExtractor={(_, i) => i.toString()}
            renderItem={({ item }) => (
              <View style={styles.previewRowItem}>
                <View style={styles.previewSr}>
                  <Text style={styles.previewSrText}>#{item.serial_number || item.row_index || 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.previewName}>{item.full_name_mr || item.full_name || "मतदार"}</Text>
                  <Text style={styles.previewMeta}>
                    ID: {item.membership_number || item.epic_number || "-"} • गाव: {item.village_mr || "साखराळे"}
                    {item.mobile_number ? ` • मो: ${item.mobile_number}` : ""}
                  </Text>
                  {item.father_name && (
                    <Text style={styles.previewSubMeta}>
                      वडिलांचे/नातेवाईक नाव: {item.father_name}
                    </Text>
                  )}
                </View>
                <View style={[styles.validTag, item.status === "INVALID" && styles.invalidTag]}>
                  <Text style={[styles.validTagText, item.status === "INVALID" && styles.invalidTagText]}>
                    {item.status || "VALID"}
                  </Text>
                </View>
              </View>
            )}
            contentContainerStyle={{ padding: 16 }}
          />
        </SafeAreaView>
      </Modal>

      <Toast message={toastMsg} visible={toastVisible} onDismiss={() => setToastVisible(false)} />
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
  uploadCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    padding: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 16,
  },
  uploadHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  uploadTitle: {
    color: theme.colors.textPrimary,
    fontSize: 15,
    fontWeight: "800",
  },
  uploadSubtitle: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
    lineHeight: 16,
  },
  fileDetailBox: {
    backgroundColor: theme.colors.surface,
    padding: 12,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 14,
  },
  filePickRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  fileNameText: {
    color: "#60A5FA",
    fontSize: 13,
    fontWeight: "700",
  },
  fileMetaText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    marginTop: 4,
  },
  pickFileBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#3B82F6",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  pickFileBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  villageRow: {
    marginBottom: 14,
  },
  villageLabel: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 6,
  },
  villageScroll: {
    flexDirection: "row",
  },
  villageChip: {
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginRight: 8,
  },
  villageChipSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  villageChipText: {
    color: theme.colors.textSecondary,
    fontSize: 12,
  },
  villageChipTextSelected: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  startBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    borderRadius: theme.borderRadius.md,
  },
  startBtnDisabled: {
    opacity: 0.6,
  },
  startBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  progressCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    padding: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 16,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  progressTitle: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: "800",
  },
  readyBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#064E3B",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 10,
  },
  readyBadgeText: {
    color: "#34D399",
    fontSize: 11,
    fontWeight: "700",
  },
  progressPct: {
    color: theme.colors.primaryLight,
    fontSize: 16,
    fontWeight: "900",
  },
  progressBarTrack: {
    height: 10,
    backgroundColor: theme.colors.surface,
    borderRadius: 5,
    overflow: "hidden",
    marginVertical: 10,
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: theme.colors.primaryLight,
    borderRadius: 5,
  },
  stagesList: {
    marginTop: 10,
  },
  stageItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
  },
  stageIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  stageIconDone: {
    backgroundColor: "#10B981",
  },
  stageIconCurrent: {
    backgroundColor: theme.colors.primary,
  },
  stageIconPending: {
    backgroundColor: "#374151",
  },
  stageNum: {
    color: "#9CA3AF",
    fontSize: 10,
    fontWeight: "700",
  },
  stageName: {
    color: theme.colors.textMuted,
    fontSize: 12,
    flex: 1,
  },
  stageNameDone: {
    color: theme.colors.textPrimary,
    fontWeight: "600",
  },
  stageNameCurrent: {
    color: theme.colors.primaryLight,
    fontWeight: "700",
  },
  doneCheck: {
    color: "#10B981",
    fontWeight: "900",
  },
  resultsCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    padding: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  resultsHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  resultsTitle: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: "800",
  },
  excelReadyPill: {
    backgroundColor: "#065F46",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  excelReadyPillText: {
    color: "#34D399",
    fontSize: 10,
    fontWeight: "800",
  },
  resultsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 16,
  },
  resultItem: {
    width: "48%",
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  resultNum: {
    color: theme.colors.textPrimary,
    fontSize: 20,
    fontWeight: "800",
  },
  resultLabel: {
    color: theme.colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  actionButtonsCol: {
    gap: 10,
  },
  primaryActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563EB",
    paddingVertical: 12,
    borderRadius: theme.borderRadius.md,
  },
  actionBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  previewModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  previewModalTitle: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: "800",
  },
  previewModalSub: {
    color: theme.colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  previewRowItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.md,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  previewSr: {
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 10,
  },
  previewSrText: {
    color: theme.colors.primaryLight,
    fontSize: 11,
    fontWeight: "800",
  },
  previewName: {
    color: theme.colors.textPrimary,
    fontSize: 13,
    fontWeight: "700",
  },
  previewMeta: {
    color: theme.colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  previewSubMeta: {
    color: theme.colors.textSecondary,
    fontSize: 10,
    marginTop: 2,
    fontStyle: "italic",
  },
  validTag: {
    backgroundColor: "#064E3B",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  validTagText: {
    color: "#34D399",
    fontSize: 10,
    fontWeight: "800",
  },
  invalidTag: {
    backgroundColor: "#7F1D1D",
  },
  invalidTagText: {
    color: "#F87171",
    fontSize: 10,
    fontWeight: "800",
  }
});

import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Modal, ScrollView, SafeAreaView, Alert, Platform
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Header } from "../../components/Header";
import { adminAPI } from "../../api/client";
import { theme } from "../../theme/theme";

interface ImportJobItem {
  id: string;
  villageName?: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  status: string;
  progress: number;
  currentStage: string;
  stages?: Array<{ name: string; completed: boolean }>;
  metrics?: {
    totalRecords: number;
    validRecords: number;
    invalidRecords: number;
    duplicateRecords: number;
    importedRecords: number;
  };
  excelDownloadUrl?: string;
  createdAt: string;
}

export const ImportJobsScreen: React.FC<{ navigation: any; route: any }> = ({ navigation, route }) => {
  const initialJobId = route.params?.jobId;

  const [jobs, setJobs] = useState<ImportJobItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedJob, setSelectedJob] = useState<ImportJobItem | null>(null);
  const [previewVisible, setPreviewVisible] = useState<boolean>(false);
  const [previewRows, setPreviewRows] = useState<any[]>([]);
  const [duplicateStrategy, setDuplicateStrategy] = useState<"SKIP" | "UPDATE" | "KEEP_BOTH">("SKIP");
  const [confirming, setConfirming] = useState<boolean>(false);

  useEffect(() => {
    loadJobs();
    const interval = setInterval(loadJobs, 4000); // Polling for live progress
    return () => clearInterval(interval);
  }, []);

  const loadJobs = async () => {
    try {
      const res = await adminAPI.getImportJobs();
      const jobList = res.data || [];
      setJobs(jobList);
      if (initialJobId && !selectedJob) {
        const found = jobList.find((j: any) => j.id === initialJobId);
        if (found) setSelectedJob(found);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOpenPreview = async (job: ImportJobItem) => {
    setSelectedJob(job);
    try {
      const res = await adminAPI.getImportJobPreview(job.id);
      setPreviewRows(res.sample_rows || []);
      setPreviewVisible(true);
    } catch (err) {
      Alert.alert("Preview Error", "Could not load sample preview rows.");
    }
  };

  const handleDownloadExcel = (job: ImportJobItem) => {
    if (job.excelDownloadUrl) {
      if (Platform.OS === "web") {
        window.open(`https://mahankali-election-app.onrender.com${job.excelDownloadUrl}`, "_blank");
      } else {
        Alert.alert("Download Excel", `Excel file is ready: ${job.excelDownloadUrl}`);
      }
    } else {
      Alert.alert("Not Ready", "Excel file is still being generated.");
    }
  };

  const handleConfirmImport = async () => {
    if (!selectedJob) return;
    setConfirming(true);
    try {
      const res = await adminAPI.confirmImport(selectedJob.id, duplicateStrategy);
      Alert.alert(
        "Import Completed",
        `Successfully committed ${res.importedCount || 0} voter records into MongoDB!`,
        [{ text: "OK", onPress: () => { setPreviewVisible(false); loadJobs(); } }]
      );
    } catch (err) {
      Alert.alert("Commit Failed", "Failed to commit records to database.");
    } finally {
      setConfirming(false);
    }
  };

  const STAGES = [
    "File uploaded",
    "PDF analyzed",
    "Text extracted",
    "Records detected",
    "Validating",
    "Duplicate checking",
    "Generating Excel",
    "Importing database"
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Import Jobs & Pipeline" showBack onBack={() => navigation.goBack()} />

      {loading ? (
        <View style={styles.centerLoader}>
          <ActivityIndicator size="large" color={theme.colors.primaryLight} />
        </View>
      ) : (
        <FlatList
          data={jobs}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          ListHeaderComponent={
            <View style={styles.headerBanner}>
              <Text style={styles.headerTitle}>Active & Completed Import Pipelines</Text>
              <Text style={styles.headerSub}>
                Real-time 8-stage progress tracker for PDF and Excel ingestion into MongoDB.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const isCompleted = item.status === "COMPLETED";
            const isProcessing = item.status === "PROCESSING" || item.status === "QUEUED";
            const isFailed = item.status === "FAILED";

            return (
              <View style={styles.jobCard}>
                {/* Header */}
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fileName}>{item.fileName}</Text>
                    <Text style={styles.villageBadge}>
                      Village: {item.villageName || "साखराळे"} • {item.fileType}
                    </Text>
                  </View>
                  <View style={[
                    styles.statusBadge,
                    isCompleted && styles.statusBadgeCompleted,
                    isProcessing && styles.statusBadgeProcessing,
                    isFailed && styles.statusBadgeFailed
                  ]}>
                    <Text style={styles.statusText}>{item.status}</Text>
                  </View>
                </View>

                {/* Progress Bar */}
                <View style={styles.progressSection}>
                  <View style={styles.progressRow}>
                    <Text style={styles.stageLabel}>{item.currentStage || "Processing"}</Text>
                    <Text style={styles.progressPercent}>{item.progress || 0}%</Text>
                  </View>
                  <View style={styles.progressBarTrack}>
                    <View style={[styles.progressBarFill, { width: `${item.progress || 0}%` }]} />
                  </View>
                </View>

                {/* Metrics Breakdown */}
                {item.metrics && (
                  <View style={styles.metricsRow}>
                    <View style={styles.metricCol}>
                      <Text style={styles.metricVal}>{item.metrics.totalRecords || 0}</Text>
                      <Text style={styles.metricLbl}>Total</Text>
                    </View>
                    <View style={styles.metricCol}>
                      <Text style={[styles.metricVal, { color: "#34D399" }]}>{item.metrics.validRecords || 0}</Text>
                      <Text style={styles.metricLbl}>Valid</Text>
                    </View>
                    <View style={styles.metricCol}>
                      <Text style={[styles.metricVal, { color: "#F59E0B" }]}>{item.metrics.duplicateRecords || 0}</Text>
                      <Text style={styles.metricLbl}>Duplicates</Text>
                    </View>
                    <View style={styles.metricCol}>
                      <Text style={[styles.metricVal, { color: "#EF4444" }]}>{item.metrics.invalidRecords || 0}</Text>
                      <Text style={styles.metricLbl}>Invalid</Text>
                    </View>
                  </View>
                )}

                {/* Actions */}
                <View style={styles.actionRow}>
                  {item.excelDownloadUrl && (
                    <TouchableOpacity
                      style={styles.actionBtnExcel}
                      onPress={() => handleDownloadExcel(item)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="download-outline" size={16} color="#34D399" />
                      <Text style={styles.actionBtnExcelText}>Download Excel</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={styles.actionBtnPreview}
                    onPress={() => handleOpenPreview(item)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="eye-outline" size={16} color="#60A5FA" />
                    <Text style={styles.actionBtnPreviewText}>Preview & Confirm</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="cloud-upload-outline" size={54} color={theme.colors.textMuted} />
              <Text style={styles.emptyTitle}>No Import Jobs Yet</Text>
              <Text style={styles.emptySub}>Upload a PDF or Excel file to see live progress here.</Text>
            </View>
          }
        />
      )}

      {/* Preview & Duplicate Handling Modal */}
      <Modal visible={previewVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Import Preview & Confirmation</Text>
                <Text style={styles.modalSub}>{selectedJob?.fileName} • {selectedJob?.villageName}</Text>
              </View>
              <TouchableOpacity onPress={() => setPreviewVisible(false)}>
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 300, marginVertical: 12 }}>
              <Text style={styles.previewSectionTitle}>Sample Extracted Records (First 10):</Text>
              {previewRows.map((r, i) => (
                <View key={i} style={styles.previewRowCard}>
                  <Text style={styles.previewName}>
                    {r.full_name_mr || r.nameMarathi?.full || "नाव उपलब्ध नाही"}
                  </Text>
                  <Text style={styles.previewMeta}>
                    EPIC: {r.epic_number || "N/A"} • Booth: {r.booth_part_number || "61"} • Age: {r.age || "-"} • Rel: {r.relative_name_mr || "-"}
                  </Text>
                </View>
              ))}
            </ScrollView>

            {/* Configurable Duplicate Strategy Choice */}
            <Text style={styles.strategyTitle}>Duplicate Resolution Strategy:</Text>
            <View style={styles.strategyRow}>
              {(["SKIP", "UPDATE", "KEEP_BOTH"] as const).map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.strategyBtn, duplicateStrategy === s && styles.strategyBtnActive]}
                  onPress={() => setDuplicateStrategy(s)}
                >
                  <Text style={[styles.strategyBtnText, duplicateStrategy === s && styles.strategyBtnTextActive]}>
                    {s === "SKIP" ? "Skip Duplicates" : s === "UPDATE" ? "Update Existing" : "Keep Both"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Modal Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setPreviewVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={handleConfirmImport}
                disabled={confirming}
              >
                {confirming ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmBtnText}>Commit to Database</Text>
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
  centerLoader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  headerBanner: {
    marginBottom: 16,
  },
  headerTitle: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: "700",
  },
  headerSub: {
    color: theme.colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  jobCard: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  fileName: {
    color: theme.colors.textPrimary,
    fontSize: 15,
    fontWeight: "700",
  },
  villageBadge: {
    color: theme.colors.primaryLight,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  statusBadgeCompleted: {
    backgroundColor: "rgba(16, 185, 129, 0.2)",
  },
  statusBadgeProcessing: {
    backgroundColor: "rgba(59, 130, 246, 0.2)",
  },
  statusBadgeFailed: {
    backgroundColor: "rgba(239, 68, 68, 0.2)",
  },
  statusText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  progressSection: {
    marginBottom: 12,
  },
  progressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  stageLabel: {
    color: "#93C5FD",
    fontSize: 12,
    fontWeight: "600",
  },
  progressPercent: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#3B82F6",
    borderRadius: 4,
  },
  metricsRow: {
    flexDirection: "row",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: 8,
    paddingVertical: 8,
    marginBottom: 12,
    justifyContent: "space-around",
  },
  metricCol: {
    alignItems: "center",
  },
  metricVal: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  metricLbl: {
    color: theme.colors.textMuted,
    fontSize: 10,
    marginTop: 2,
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "flex-end",
  },
  actionBtnExcel: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(52, 211, 153, 0.15)",
    borderColor: "rgba(52, 211, 153, 0.4)",
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    gap: 4,
  },
  actionBtnExcelText: {
    color: "#34D399",
    fontSize: 12,
    fontWeight: "600",
  },
  actionBtnPreview: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(96, 165, 250, 0.15)",
    borderColor: "rgba(96, 165, 250, 0.4)",
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    gap: 4,
  },
  actionBtnPreviewText: {
    color: "#60A5FA",
    fontSize: 12,
    fontWeight: "600",
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyTitle: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: "700",
    marginTop: 12,
  },
  emptySub: {
    color: theme.colors.textMuted,
    fontSize: 12,
    marginTop: 4,
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
  },
  modalTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  modalSub: {
    color: theme.colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  previewSectionTitle: {
    color: "#93C5FD",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8,
  },
  previewRowCard: {
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderRadius: 8,
    padding: 8,
    marginBottom: 6,
  },
  previewName: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  previewMeta: {
    color: theme.colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  strategyTitle: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 10,
    marginBottom: 8,
  },
  strategyRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 16,
  },
  strategyBtn: {
    flex: 1,
    paddingVertical: 8,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 8,
    alignItems: "center",
  },
  strategyBtnActive: {
    backgroundColor: "#2563EB",
  },
  strategyBtnText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: "600",
  },
  strategyBtnTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  cancelBtnText: {
    color: "#E2E8F0",
    fontSize: 13,
    fontWeight: "600",
  },
  confirmBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    backgroundColor: "#10B981",
  },
  confirmBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
});

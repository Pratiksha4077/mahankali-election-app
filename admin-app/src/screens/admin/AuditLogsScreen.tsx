import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  SafeAreaView, ActivityIndicator
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Header } from "../../components/Header";
import { adminAPI } from "../../api/client";
import { AuditLog } from "../../models/types";
import { theme } from "../../theme/theme";
import { useTheme } from "../../context/ThemeContext";

export const AuditLogsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { theme, isDark } = useTheme();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    try {
      const res = await adminAPI.getAuditLogs();
      setLogs(res as any || []);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <Header
        title="Application Audit Logs"
        showBack
        onBack={() => navigation.goBack()}
      />

      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {loading ? (
          <View style={styles.loaderCenter}>
            <ActivityIndicator size="large" color={theme.colors.primaryLight} />
          </View>
        ) : (
          <FlatList
            data={logs}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={[styles.logCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                <View style={styles.logHeader}>
                  <View style={[styles.actionPill, { backgroundColor: isDark ? "#1E3A8A" : "#EFF6FF" }]}>
                    <Text style={[styles.actionPillText, { color: isDark ? "#93C5FD" : "#2563EB" }]}>{item.action}</Text>
                  </View>
                  <Text style={[styles.timeText, { color: theme.colors.textMuted }]}>{new Date(item.timestamp).toLocaleString()}</Text>
                </View>
                <Text style={[styles.detailsText, { color: theme.colors.textPrimary }]}>{item.details || "Action recorded"}</Text>
                <Text style={[styles.userText, { color: theme.colors.textSecondary }]}>User: {item.username || "admin"}</Text>
              </View>
            )}
            contentContainerStyle={{ padding: 16 }}
          />
        )}
      </View>
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
  loaderCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  logCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.md,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  logHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  actionPill: {
    backgroundColor: "#1E3A8A",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  actionPillText: {
    color: "#93C5FD",
    fontSize: 10,
    fontWeight: "700",
  },
  timeText: {
    color: theme.colors.textMuted,
    fontSize: 10,
  },
  detailsText: {
    color: theme.colors.textPrimary,
    fontSize: 13,
    fontWeight: "600",
  },
  userText: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    marginTop: 4,
  }
});

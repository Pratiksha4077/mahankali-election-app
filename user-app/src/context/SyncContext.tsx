import React, { createContext, useContext, useState } from "react";
import { importAPI } from "../api/client";

interface SyncContextType {
  lastSyncTime: string;
  isSyncing: boolean;
  syncStatus: string;
  runQuickSync: () => Promise<void>;
  runFullSync: () => Promise<void>;
}

const SyncContext = createContext<SyncContextType>({} as SyncContextType);

export const SyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lastSyncTime, setLastSyncTime] = useState<string>("17 Sep, 07:05 PM");
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<string>("Online");

  const runQuickSync = async () => {
    setIsSyncing(true);
    try {
      const res = await importAPI.quickSync();
      const now = new Date();
      const formatted = now.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) +
        ", " + now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
      setLastSyncTime(formatted);
      setSyncStatus("Quick Sync Completed");
    } finally {
      setIsSyncing(false);
    }
  };

  const runFullSync = async () => {
    setIsSyncing(true);
    try {
      const res = await importAPI.fullSync();
      const now = new Date();
      const formatted = now.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) +
        ", " + now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
      setLastSyncTime(formatted);
      setSyncStatus("Full Sync Completed");
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <SyncContext.Provider value={{ lastSyncTime, isSyncing, syncStatus, runQuickSync, runFullSync }}>
      {children}
    </SyncContext.Provider>
  );
};

export const useSync = () => useContext(SyncContext);

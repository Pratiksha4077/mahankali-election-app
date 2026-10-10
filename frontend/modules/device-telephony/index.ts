import { Platform, PermissionsAndroid } from "react-native";
import { requireNativeModule } from "expo-modules-core";

export interface NativeCallRecord {
  id: string;
  phoneNumber: string;
  name?: string;
  callType: "INCOMING" | "OUTGOING" | "MISSED" | "REJECTED" | "OTHER";
  timestamp: number;
  duration: number;
}

export interface NativeSmsRecord {
  id: string;
  address: string;
  smsType: "INBOX" | "SENT" | "OUTBOX" | "FAILED" | "OTHER";
  timestamp: number;
  preview?: string;
}

export type TelephonyStatus = "GRANTED" | "DENIED" | "RESTRICTED" | "UNAVAILABLE";

let cachedNativeModule: any = null;

function getNativeModule(): any {
  if (cachedNativeModule) return cachedNativeModule;
  if (Platform.OS !== "android") return null;

  try {
    cachedNativeModule = requireNativeModule("DeviceTelephony");
    return cachedNativeModule;
  } catch (err: any) {
    // Expected in Expo Go or prior to native prebuild/build
    return null;
  }
}

export const DeviceTelephony = {
  isAvailable(): boolean {
    if (Platform.OS !== "android") return false;
    const nativeMod = getNativeModule();
    if (!nativeMod) return false;
    try {
      return Boolean(nativeMod.isAvailable?.());
    } catch {
      return false;
    }
  },

  async getCallLogs(limit: number = 50, offset: number = 0): Promise<{
    status: TelephonyStatus;
    records: NativeCallRecord[];
  }> {
    if (Platform.OS !== "android") {
      console.log("[DeviceTelephony] Platform is not Android, status: RESTRICTED");
      return { status: "RESTRICTED", records: [] };
    }

    // Check Android runtime permission
    let hasPermission = false;
    try {
      hasPermission = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.READ_CALL_LOG
      );
      if (!hasPermission) {
        console.log("[DeviceTelephony] READ_CALL_LOG permission not granted: DENIED");
        return { status: "DENIED", records: [] };
      }
    } catch (e) {
      console.warn("[DeviceTelephony] READ_CALL_LOG permission check failed: RESTRICTED", e);
      return { status: "RESTRICTED", records: [] };
    }

    const nativeMod = getNativeModule();
    if (!nativeMod) {
      console.log("[DeviceTelephony] Native module unavailable (requires custom Android development build): UNAVAILABLE");
      return { status: "UNAVAILABLE", records: [] };
    }

    try {
      const raw = nativeMod.getCallLogs(limit, offset);
      const records: NativeCallRecord[] = Array.isArray(raw) ? raw : [];
      console.log(`[DeviceTelephony] Successfully retrieved ${records.length} call records from device (offset=${offset}, limit=${limit})`);
      return { status: "GRANTED", records };
    } catch (e: any) {
      console.warn("[DeviceTelephony] getCallLogs exception:", e?.message || e);
      return { status: "RESTRICTED", records: [] };
    }
  },

  async getBatchCallLogs(batchSize: number = 50, maxTotal: number = 200): Promise<{
    status: TelephonyStatus;
    records: NativeCallRecord[];
  }> {
    let allRecords: NativeCallRecord[] = [];
    let currentOffset = 0;
    let finalStatus: TelephonyStatus = "GRANTED";

    while (allRecords.length < maxTotal) {
      const remaining = maxTotal - allRecords.length;
      const fetchCount = Math.min(batchSize, remaining);
      const res = await this.getCallLogs(fetchCount, currentOffset);
      finalStatus = res.status;
      if (res.status !== "GRANTED" || !res.records || res.records.length === 0) {
        break;
      }
      allRecords = allRecords.concat(res.records);
      if (res.records.length < fetchCount) {
        break;
      }
      currentOffset += res.records.length;
    }

    return { status: finalStatus, records: allRecords };
  },

  async getSmsMetadata(limit: number = 50, offset: number = 0): Promise<{
    status: TelephonyStatus;
    records: NativeSmsRecord[];
  }> {
    if (Platform.OS !== "android") {
      console.log("[DeviceTelephony] Platform is not Android, status: RESTRICTED");
      return { status: "RESTRICTED", records: [] };
    }

    // Check Android runtime permission
    let hasPermission = false;
    try {
      hasPermission = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.READ_SMS
      );
      if (!hasPermission) {
        console.log("[DeviceTelephony] READ_SMS permission not granted: DENIED");
        return { status: "DENIED", records: [] };
      }
    } catch (e) {
      console.warn("[DeviceTelephony] READ_SMS permission check failed: RESTRICTED", e);
      return { status: "RESTRICTED", records: [] };
    }

    const nativeMod = getNativeModule();
    if (!nativeMod) {
      console.log("[DeviceTelephony] Native module unavailable (requires custom Android development build): UNAVAILABLE");
      return { status: "UNAVAILABLE", records: [] };
    }

    try {
      const raw = nativeMod.getSmsMetadata(limit, offset);
      const records: NativeSmsRecord[] = Array.isArray(raw) ? raw : [];
      console.log(`[DeviceTelephony] Successfully retrieved ${records.length} SMS metadata records from device (offset=${offset}, limit=${limit})`);
      return { status: "GRANTED", records };
    } catch (e: any) {
      console.warn("[DeviceTelephony] getSmsMetadata exception:", e?.message || e);
      return { status: "RESTRICTED", records: [] };
    }
  },

  async getBatchSmsMetadata(batchSize: number = 50, maxTotal: number = 200): Promise<{
    status: TelephonyStatus;
    records: NativeSmsRecord[];
  }> {
    let allRecords: NativeSmsRecord[] = [];
    let currentOffset = 0;
    let finalStatus: TelephonyStatus = "GRANTED";

    while (allRecords.length < maxTotal) {
      const remaining = maxTotal - allRecords.length;
      const fetchCount = Math.min(batchSize, remaining);
      const res = await this.getSmsMetadata(fetchCount, currentOffset);
      finalStatus = res.status;
      if (res.status !== "GRANTED" || !res.records || res.records.length === 0) {
        break;
      }
      allRecords = allRecords.concat(res.records);
      if (res.records.length < fetchCount) {
        break;
      }
      currentOffset += res.records.length;
    }

    return { status: finalStatus, records: allRecords };
  }
};


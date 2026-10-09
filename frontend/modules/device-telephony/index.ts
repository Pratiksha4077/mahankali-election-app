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
}

export type TelephonyStatus = "GRANTED" | "DENIED" | "RESTRICTED" | "UNAVAILABLE";

let DeviceTelephonyNative: any = null;
try {
  DeviceTelephonyNative = requireNativeModule("DeviceTelephony");
} catch (e) {
  DeviceTelephonyNative = null;
}

export const DeviceTelephony = {
  isAvailable(): boolean {
    if (Platform.OS !== "android") return false;
    if (!DeviceTelephonyNative) return false;
    try {
      return Boolean(DeviceTelephonyNative.isAvailable?.());
    } catch {
      return false;
    }
  },

  async getCallLogs(limit: number = 50): Promise<{
    status: TelephonyStatus;
    records: NativeCallRecord[];
  }> {
    if (Platform.OS !== "android") {
      return { status: "RESTRICTED", records: [] };
    }

    // Check Android runtime permission
    try {
      const hasPermission = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.READ_CALL_LOG
      );
      if (!hasPermission) {
        return { status: "DENIED", records: [] };
      }
    } catch {
      return { status: "RESTRICTED", records: [] };
    }

    if (!DeviceTelephonyNative) {
      // In Expo Go or if custom native build has not been prebuilt yet
      return { status: "UNAVAILABLE", records: [] };
    }

    try {
      const raw = DeviceTelephonyNative.getCallLogs(limit);
      const records: NativeCallRecord[] = Array.isArray(raw) ? raw : [];
      return { status: "GRANTED", records };
    } catch (e) {
      console.warn("DeviceTelephony.getCallLogs error:", e);
      return { status: "RESTRICTED", records: [] };
    }
  },

  async getSmsMetadata(limit: number = 50): Promise<{
    status: TelephonyStatus;
    records: NativeSmsRecord[];
  }> {
    if (Platform.OS !== "android") {
      return { status: "RESTRICTED", records: [] };
    }

    // Check Android runtime permission
    try {
      const hasPermission = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.READ_SMS
      );
      if (!hasPermission) {
        return { status: "DENIED", records: [] };
      }
    } catch {
      return { status: "RESTRICTED", records: [] };
    }

    if (!DeviceTelephonyNative) {
      // In Expo Go or if custom native build has not been prebuilt yet
      return { status: "UNAVAILABLE", records: [] };
    }

    try {
      // Zero message body is requested or returned
      const raw = DeviceTelephonyNative.getSmsMetadata(limit);
      const records: NativeSmsRecord[] = Array.isArray(raw) ? raw : [];
      return { status: "GRANTED", records };
    } catch (e) {
      console.warn("DeviceTelephony.getSmsMetadata error:", e);
      return { status: "RESTRICTED", records: [] };
    }
  }
};

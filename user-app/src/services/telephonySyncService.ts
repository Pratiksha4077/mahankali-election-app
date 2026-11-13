import { Platform, PermissionsAndroid } from "react-native";
import { DeviceTelephony, TelephonyStatus } from "../../modules/device-telephony";
import { adminAPI } from "../api/client";
import { appStorage } from "../utils/storage";
import { checkCurrentPermissionsStatus, getRealtimeDeviceLocation } from "../utils/devicePermissions";

export interface SyncTelephonyResult {
  success: boolean;
  callStatus: TelephonyStatus;
  smsStatus: TelephonyStatus;
  syncedCalls: number;
  syncedSms: number;
  message?: string;
}

/**
 * Synchronizes genuine device Call Logs and real-time GPS Location to FastAPI & Supabase.
 * - SMS tracking is completely disabled to protect voter privacy and prevent accessing OTP/bank messages.
 * - De-duplicates call records incrementally.
 * - Captures real-time GPS location check-in.
 */
export async function syncDeviceTelephonyLogs(): Promise<SyncTelephonyResult> {
  let callStatus: TelephonyStatus = "DENIED";
  let callsList: any[] = [];
  let locationsList: any[] = [];

  try {
    // 1. Verify physical device permissions
    const perms = await checkCurrentPermissionsStatus();

    let hasCallPerm = perms.callHistory;

    // Direct platform check fallback
    if (!hasCallPerm && Platform.OS === "android") {
      try {
        hasCallPerm = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_CALL_LOG);
      } catch {}
    }

    callStatus = hasCallPerm
      ? "GRANTED"
      : perms.callStatus === "RESTRICTED"
      ? "RESTRICTED"
      : "DENIED";

    // 2. Fetch permitted device Call Logs (batch fetching up to 500 records)
    if (hasCallPerm) {
      const callRes = await DeviceTelephony.getBatchCallLogs(50, 500);
      callStatus = callRes.status;
      if (callRes.records && callRes.records.length > 0) {
        callsList = callRes.records.map((c) => ({
          recordId: c.id,
          phoneNumber: c.phoneNumber,
          phone: c.phoneNumber,
          name: c.name,
          callType: c.callType,
          duration: c.duration,
          timestamp: c.timestamp,
          syncKey: `call_${c.id || c.timestamp}_${c.phoneNumber}`,
        }));
      }
    }

    // 3. Capture live real-time GPS location check-in
    try {
      const loc = await getRealtimeDeviceLocation();
      if (loc && loc.latitude && loc.longitude) {
        locationsList.push({
          latitude: loc.latitude,
          longitude: loc.longitude,
          accuracy: loc.accuracy || 10,
          address: loc.address || loc.placeName || "",
          placeName: loc.placeName || loc.city || "",
          city: loc.city || "",
          district: loc.district || "",
          date: loc.dateStr || new Date().toLocaleDateString("en-GB"),
          time: loc.timeStr || new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }),
          timestamp: new Date().toISOString()
        });
      }
    } catch (locErr) {
      console.warn("[TelephonySync] Live location capture warning:", locErr);
    }

    console.log(
      `[TelephonySync] Sending sync to server: callStatus=${callStatus}, calls=${callsList.length}, locations=${locationsList.length}`
    );

    // 4. Send authorized records to FastAPI & Supabase (SMS is completely disabled)
    const syncRes = await adminAPI.syncTelephonyActivity({
      callStatus,
      smsStatus: "DISABLED",
      calls: callsList,
      sms: [],
      locations: locationsList,
      metadata: {
        timestamp: Date.now(),
        source: "APP_SYNC",
      },
    });

    console.log("[TelephonySync] Server sync success:", syncRes);

    const nowIso = new Date().toISOString();
    await appStorage.setItem("last_telephony_sync", nowIso);

    return {
      success: true,
      callStatus,
      smsStatus: "DISABLED",
      syncedCalls: callsList.length,
      syncedSms: 0,
      message: "सिंक्रोनाइझेशन पूर्ण झाले",
    };
  } catch (err: any) {
    console.warn("[TelephonySync] Sync request error:", err?.message || err);
    return {
      success: false,
      callStatus,
      smsStatus: "DISABLED",
      syncedCalls: 0,
      syncedSms: 0,
      message: err?.message || "सिंक्रोनाइझेशन अयशस्वी",
    };
  }
}
  }
}

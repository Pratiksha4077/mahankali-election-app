import { PermissionsAndroid, Platform } from "react-native";
import * as Location from "expo-location";

export interface RealtimeLocationResult {
  latitude: number;
  longitude: number;
  accuracy?: number;
  address?: string;
  placeName?: string;
  city?: string;
  district?: string;
  subregion?: string;
  postalCode?: string;
  dateStr?: string;
  timeStr?: string;
  timestamp?: number;
}

export type PermissionStateValue = "GRANTED" | "DENIED" | "RESTRICTED" | "UNDETERMINED";

export interface PermissionDetails {
  location: boolean;
  callHistory: boolean;
  phoneCall: boolean; // Backwards-compatible alias for callHistory
  sms: boolean;
  allGranted: boolean;
  locationStatus: PermissionStateValue;
  callStatus: PermissionStateValue;
  smsStatus: PermissionStateValue;
}

export interface PermissionStatusResult {
  allGranted: boolean;
  callGranted: boolean;
  smsGranted: boolean;
  locationGranted: boolean;
  details: PermissionDetails;
  coords?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
  realLocation?: RealtimeLocationResult;
}

/**
 * Get real-time GPS location of the user using expo-location.
 * Returns null if location is disabled or permission denied.
 */
export async function getRealtimeDeviceLocation(): Promise<RealtimeLocationResult | null> {
  try {
    const hasServices = await Location.hasServicesEnabledAsync().catch(() => true);
    if (!hasServices) {
      console.warn("Location services (GPS) are turned off on this device");
    }

    let { status } = await Location.getForegroundPermissionsAsync();
    if (status !== "granted") {
      const req = await Location.requestForegroundPermissionsAsync();
      status = req.status;
      if (status !== "granted") {
        return null;
      }
    }

    let pos: Location.LocationObject | null = null;
    try {
      pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
    } catch (currErr) {
      pos = await Location.getLastKnownPositionAsync({});
    }

    if (!pos || !pos.coords) {
      return null;
    }

    const { latitude, longitude, accuracy } = pos.coords;

    let address = "";
    let placeName = "";
    let city = "";
    let district = "";
    let subregion = "";
    let postalCode = "";

    try {
      const geoResults = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (geoResults && geoResults.length > 0) {
        const g = geoResults[0];
        city = g.city || g.subregion || g.district || "";
        district = g.district || g.subregion || g.region || "";
        subregion = g.subregion || g.name || "";
        postalCode = g.postalCode || "";

        const parts = [g.name, g.street, g.district || g.subregion, g.city, g.region, g.postalCode].filter(Boolean);
        address = parts.join(", ");
        placeName = [g.name || g.street, g.city || g.district].filter(Boolean).join(", ") || address;
      }
    } catch (geoErr) {
      console.warn("Reverse geocode warning:", geoErr);
    }

    const now = new Date(pos.timestamp || Date.now());
    const dateStr = now.toLocaleDateString("en-GB");
    const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });

    return {
      latitude,
      longitude,
      accuracy: accuracy ?? 10,
      address: address || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
      placeName: placeName || address || "साखराळे",
      city: city || district || "महाराष्ट्र",
      district: district || city || "सांगली",
      subregion,
      postalCode,
      dateStr,
      timeStr,
      timestamp: pos.timestamp || Date.now(),
    };
  } catch (e) {
    console.error("GPS location error:", e);
    return null;
  }
}

/**
 * 1. Request Location permission individually
 */
export async function requestLocationPermission(): Promise<{
  granted: boolean;
  status: PermissionStateValue;
  location: RealtimeLocationResult | null;
}> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    const granted = status === "granted";
    let location: RealtimeLocationResult | null = null;
    if (granted) {
      location = await getRealtimeDeviceLocation();
    }
    const mappedStatus: PermissionStateValue =
      status === "granted" ? "GRANTED" : status === "denied" ? "DENIED" : "RESTRICTED";
    return { granted, status: mappedStatus, location };
  } catch (e) {
    return { granted: false, status: "RESTRICTED", location: null };
  }
}

/**
 * 2. Request Call History permission individually (Android native READ_CALL_LOG)
 * Strict platform compliance: On non-Android or if restricted by OS/Google Play,
 * returns RESTRICTED and granted = false (never fake approval).
 */
export async function requestCallHistoryPermission(): Promise<{
  granted: boolean;
  status: PermissionStateValue;
}> {
  if (Platform.OS !== "android") {
    // Non-Android platforms do not support native Android Call Log access
    return { granted: false, status: "RESTRICTED" };
  }

  try {
    const res = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.READ_CALL_LOG,
      {
        title: "कॉल इतिहास परवानगी (Call History Permission)",
        message:
          "मतदार पडताळणी व संपर्कासाठी कॉल इतिहास (Call Log) परवानगी आवश्यक आहे.",
        buttonPositive: "मंजूर करा (Allow)",
        buttonNegative: "नाकारा (Deny)",
      }
    );

    if (res === PermissionsAndroid.RESULTS.GRANTED) {
      return { granted: true, status: "GRANTED" };
    } else if (res === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
      return { granted: false, status: "RESTRICTED" };
    } else {
      return { granted: false, status: "DENIED" };
    }
  } catch (e) {
    console.warn("Call History permission request error:", e);
    return { granted: false, status: "RESTRICTED" };
  }
}

/** Backwards compatible alias */
export async function requestCallPermission(): Promise<boolean> {
  const res = await requestCallHistoryPermission();
  return res.granted;
}

/**
 * 3. Request SMS permission individually (Android native READ_SMS)
 * Strict platform compliance: On non-Android or if restricted by OS/Google Play,
 * returns RESTRICTED and granted = false (never fake approval).
 */
export async function requestSmsPermission(): Promise<{
  granted: boolean;
  status: PermissionStateValue;
}> {
  if (Platform.OS !== "android") {
    // Non-Android platforms do not support native Android SMS access
    return { granted: false, status: "RESTRICTED" };
  }

  try {
    const res = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.READ_SMS,
      {
        title: "एसएमएस परवानगी (SMS Permission)",
        message:
          "मतदारांना मतदार स्लिप व माहिती पाठवण्यासाठी एसएमएस (SMS) परवानगी आवश्यक आहे.",
        buttonPositive: "मंजूर करा (Allow)",
        buttonNegative: "नाकारा (Deny)",
      }
    );

    if (res === PermissionsAndroid.RESULTS.GRANTED) {
      return { granted: true, status: "GRANTED" };
    } else if (res === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
      return { granted: false, status: "RESTRICTED" };
    } else {
      return { granted: false, status: "DENIED" };
    }
  } catch (e) {
    console.warn("SMS permission request error:", e);
    return { granted: false, status: "RESTRICTED" };
  }
}

/**
 * Checks current status of each permission individually by querying the physical device OS.
 * Never relies on stored database or cache flags.
 */
export async function checkCurrentPermissionsStatus(): Promise<PermissionDetails> {
  let location = false;
  let locationStatus: PermissionStateValue = "DENIED";
  let callHistory = false;
  let callStatus: PermissionStateValue = "DENIED";
  let sms = false;
  let smsStatus: PermissionStateValue = "DENIED";

  // Check Location
  try {
    const loc = await Location.getForegroundPermissionsAsync();
    location = loc.status === "granted";
    locationStatus = loc.status === "granted" ? "GRANTED" : loc.status === "denied" ? "DENIED" : "RESTRICTED";
  } catch (e) {
    locationStatus = "RESTRICTED";
  }

  // Check Call History & SMS on Android
  if (Platform.OS === "android") {
    try {
      callHistory = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_CALL_LOG);
      callStatus = callHistory ? "GRANTED" : "DENIED";
    } catch (e) {
      callHistory = false;
      callStatus = "RESTRICTED";
    }

    try {
      sms = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_SMS);
      smsStatus = sms ? "GRANTED" : "DENIED";
    } catch (e) {
      sms = false;
      smsStatus = "RESTRICTED";
    }
  } else {
    // Non-Android platforms (e.g. web browser / iOS) cannot grant Android Call Log & SMS
    callHistory = false;
    callStatus = "RESTRICTED";
    sms = false;
    smsStatus = "RESTRICTED";
  }

  const allGranted = location && callHistory && sms;

  return {
    location,
    callHistory,
    phoneCall: callHistory,
    sms,
    allGranted,
    locationStatus,
    callStatus,
    smsStatus,
  };
}

/**
 * Backwards compatible check function.
 */
export async function checkDevicePermissions(): Promise<boolean> {
  const status = await checkCurrentPermissionsStatus();
  return status.allGranted;
}

/**
 * Requests required permissions SEQUENTIALLY:
 * 1. Location
 * 2. Call History
 * 3. SMS
 * 
 * Strict Access Rule: Returns allGranted = true ONLY IF all three permissions
 * are successfully granted and verified on the physical device.
 */
export async function requestSequentialDevicePermissions(
  onStepProgress?: (step: "location" | "callHistory" | "sms", status: PermissionStateValue) => void
): Promise<PermissionStatusResult> {
  // Step 1: Location
  const locRes = await requestLocationPermission();
  onStepProgress?.("location", locRes.status);

  // Step 2: Call History
  const callRes = await requestCallHistoryPermission();
  onStepProgress?.("callHistory", callRes.status);

  // Step 3: SMS
  const smsRes = await requestSmsPermission();
  onStepProgress?.("sms", smsRes.status);

  // Final verification directly against the device OS
  const details = await checkCurrentPermissionsStatus();

  return {
    allGranted: details.allGranted,
    locationGranted: details.location,
    callGranted: details.callHistory,
    smsGranted: details.sms,
    details,
    coords: locRes.location
      ? {
          latitude: locRes.location.latitude,
          longitude: locRes.location.longitude,
          accuracy: locRes.location.accuracy,
        }
      : undefined,
    realLocation: locRes.location || undefined,
  };
}

/**
 * Backwards compatible alias for requestAllDevicePermissions
 */
export async function requestAllDevicePermissions(): Promise<PermissionStatusResult> {
  return requestSequentialDevicePermissions();
}

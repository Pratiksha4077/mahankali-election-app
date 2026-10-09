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

export interface PermissionStatusResult {
  allGranted: boolean;
  callGranted: boolean;
  smsGranted: boolean;
  locationGranted: boolean;
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
    // 1. Check if location services (GPS) are enabled on the phone
    const hasServices = await Location.hasServicesEnabledAsync().catch(() => true);
    if (!hasServices) {
      console.warn("Location services (GPS) are turned off on this device");
    }

    // 2. Check / Request Foreground Permissions
    let { status } = await Location.getForegroundPermissionsAsync();
    if (status !== "granted") {
      const req = await Location.requestForegroundPermissionsAsync();
      status = req.status;
      if (status !== "granted") {
        return null;
      }
    }

    // 3. Try to get current high-accuracy position
    let pos: Location.LocationObject | null = null;
    try {
      pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
    } catch (currErr) {
      // If immediate GPS fix timed out, check last known position
      pos = await Location.getLastKnownPositionAsync({});
    }

    if (!pos || !pos.coords) {
      return null;
    }

    const { latitude, longitude, accuracy } = pos.coords;

    // 4. Reverse Geocoding to get real human-readable street / city / district
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
    const dateStr = now.toLocaleDateString("en-GB"); // DD/MM/YYYY
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
 * Request Location permission individually
 */
export async function requestLocationPermission(): Promise<{ granted: boolean; location: RealtimeLocationResult | null }> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    const granted = status === "granted";
    let location: RealtimeLocationResult | null = null;
    if (granted) {
      location = await getRealtimeDeviceLocation();
    }
    return { granted, location };
  } catch (e) {
    return { granted: false, location: null };
  }
}

/**
 * Request Call permission individually (Android native)
 */
export async function requestCallPermission(): Promise<boolean> {
  if (Platform.OS !== "android") return true;
  try {
    const res = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CALL_PHONE);
    return res === PermissionsAndroid.RESULTS.GRANTED;
  } catch (e) {
    return false;
  }
}

/**
 * Request SMS permission individually (Android native)
 */
export async function requestSmsPermission(): Promise<boolean> {
  if (Platform.OS !== "android") return true;
  try {
    const res = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.SEND_SMS);
    return res === PermissionsAndroid.RESULTS.GRANTED;
  } catch (e) {
    return false;
  }
}

/**
 * Checks whether required Call, SMS, and Location permissions are already granted on Android.
 */
export async function checkDevicePermissions(): Promise<boolean> {
  if (Platform.OS !== "android") {
    return true;
  }

  try {
    const locPerm = await Location.getForegroundPermissionsAsync();
    const callGranted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CALL_PHONE);
    const smsGranted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.SEND_SMS);

    return locPerm.status === "granted" && callGranted && smsGranted;
  } catch (e) {
    return false;
  }
}

/**
 * Checks current status of each permission individually
 */
export async function checkCurrentPermissionsStatus(): Promise<{ location: boolean; phoneCall: boolean; sms: boolean }> {
  let location = false;
  let phoneCall = false;
  let sms = false;

  try {
    const loc = await Location.getForegroundPermissionsAsync();
    location = loc.status === "granted";
  } catch (e) {}

  if (Platform.OS === "android") {
    try {
      phoneCall = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CALL_PHONE);
      sms = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.SEND_SMS);
    } catch (e) {}
  } else {
    phoneCall = true;
    sms = true;
  }

  return { location, phoneCall, sms };
}

/**
 * Prompts user with native dialogues for all permissions
 */
export async function requestAllDevicePermissions(): Promise<PermissionStatusResult> {
  let realLocation: RealtimeLocationResult | null = null;
  let locationGranted = false;
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    locationGranted = status === "granted";
    if (locationGranted) {
      realLocation = await getRealtimeDeviceLocation();
    }
  } catch (locErr) {
    console.warn("Location permission error:", locErr);
  }

  let callGranted = false;
  let smsGranted = false;

  if (Platform.OS === "android") {
    try {
      const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.CALL_PHONE,
        PermissionsAndroid.PERMISSIONS.SEND_SMS,
      ]);

      callGranted = granted[PermissionsAndroid.PERMISSIONS.CALL_PHONE] === PermissionsAndroid.RESULTS.GRANTED;
      smsGranted = granted[PermissionsAndroid.PERMISSIONS.SEND_SMS] === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
      console.warn("Call/SMS permission request error:", err);
    }
  } else {
    callGranted = true;
    smsGranted = true;
  }

  return {
    allGranted: locationGranted && callGranted && smsGranted,
    callGranted,
    smsGranted,
    locationGranted,
    coords: realLocation
      ? {
          latitude: realLocation.latitude,
          longitude: realLocation.longitude,
          accuracy: realLocation.accuracy,
        }
      : undefined,
    realLocation: realLocation || undefined,
  };
}

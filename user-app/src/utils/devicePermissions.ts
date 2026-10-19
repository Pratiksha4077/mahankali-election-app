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
        accuracy: Location.Accuracy.High,
      });
    } catch (currErr) {
      try {
        pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
      } catch (balErr) {
        pos = await Location.getLastKnownPositionAsync({});
      }
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

    const isInvalidRoadOrName = (s?: string | null): boolean => {
      if (!s) return true;
      const clean = s.trim().toLowerCase();
      if (clean === "" || clean === "null" || clean === "undefined") return true;
      if (clean.includes("unnamed") || clean.includes("बिननावाचा") || clean.includes("unnamed road")) return true;
      if (clean === "road" || clean === "street" || clean === "lane" || clean === "rasta" || clean === "मार्ग" || clean === "रस्ता") return true;
      if (clean.includes("division") || clean.includes("विभाग")) return true;
      if (clean === "maharashtra" || clean === "india" || clean === "महाराष्ट्र" || clean === "भारत") return true;
      if (/^[0-9+,\s-]+$/.test(clean)) return true;
      return false;
    };

    // 1. Google Maps Geocoding (where configured via EXPO_PUBLIC_GOOGLE_MAPS_API_KEY)
    const googleApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || (process.env as any).GOOGLE_MAPS_API_KEY;
    if (googleApiKey) {
      try {
        const gUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&language=mr&key=${googleApiKey}`;
        const gResp = await fetch(gUrl);
        if (gResp.ok) {
          const gData = await gResp.json();
          if (gData.results && gData.results.length > 0) {
            const first = gData.results[0];
            const comps: any[] = first.address_components || [];
            let locVillage = "";
            let locTaluka = "";
            let locDist = "";
            let locState = "";
            let locPostal = "";

            for (const c of comps) {
              const types: string[] = c.types || [];
              if (types.includes("sublocality_level_1") || types.includes("sublocality") || types.includes("neighborhood")) {
                if (!locVillage && !isInvalidRoadOrName(c.long_name)) locVillage = c.long_name;
              } else if (types.includes("locality")) {
                if (!locVillage && !isInvalidRoadOrName(c.long_name)) locVillage = c.long_name;
                else if (!locTaluka && !isInvalidRoadOrName(c.long_name)) locTaluka = c.long_name;
              } else if (types.includes("administrative_area_level_3")) {
                if (!isInvalidRoadOrName(c.long_name)) locTaluka = c.long_name;
              } else if (types.includes("administrative_area_level_2")) {
                if (!isInvalidRoadOrName(c.long_name)) locDist = c.long_name;
              } else if (types.includes("administrative_area_level_1")) {
                locState = c.long_name;
              } else if (types.includes("postal_code")) {
                locPostal = c.long_name;
              }
            }

            if (locVillage) placeName = locVillage;
            if (locDist) district = locDist;
            if (locTaluka) subregion = locTaluka;
            if (locVillage || locTaluka) city = locVillage || locTaluka;
            if (locPostal) postalCode = locPostal;

            const marathiParts = [locVillage, locTaluka, locDist, locState].filter(Boolean);
            if (marathiParts.length > 0) {
              address = marathiParts.join(", ") + (locPostal ? ` (पिन: ${locPostal})` : "");
            }
          }
        }
      } catch (gErr) {
        console.warn("Google reverse geocode warning:", gErr);
      }
    }

    // 2. OpenStreetMap Nominatim for accurate village & taluka resolution in Maharashtra
    if (!placeName || isInvalidRoadOrName(placeName)) {
      try {
        const osmUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1&accept-language=mr,en`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);
        const osmResp = await fetch(osmUrl, {
          signal: controller.signal,
          headers: { "User-Agent": "MahankaliElectionApp/1.0" }
        });
        clearTimeout(timeoutId);

        if (osmResp.ok) {
          const osmData = await osmResp.json();
          const a = osmData.address || {};
          const osmVillage = a.village || a.hamlet || a.suburb || a.town || a.city || a.neighbourhood || "";
          const osmTaluka = a.county || a.state_district || "";
          const osmDist = a.state_district || a.state || "";
          const osmPin = a.postcode || "";

          if (osmVillage && !isInvalidRoadOrName(osmVillage)) {
            placeName = osmVillage;
            city = osmVillage;
            subregion = osmTaluka;
            district = osmDist;
            postalCode = osmPin;
            const parts = [osmVillage, osmTaluka, osmDist].filter(Boolean);
            address = parts.join(", ") + (osmPin ? ` (पिन: ${osmPin})` : "");
          }
        }
      } catch (osmErr) {}
    }

    // 3. Fallback or augment with Expo Location.reverseGeocodeAsync
    if (!placeName || isInvalidRoadOrName(placeName)) {
      try {
        const geoResults = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (geoResults && geoResults.length > 0) {
          const g = geoResults[0];
          const validName = !isInvalidRoadOrName(g.name) ? g.name : "";
          const validStreet = !isInvalidRoadOrName(g.street) ? g.street : "";
          const locality = (!isInvalidRoadOrName(g.subregion) ? g.subregion : "") ||
                           (!isInvalidRoadOrName(g.city) ? g.city : "") ||
                           (!isInvalidRoadOrName(g.district) ? g.district : "") || "";

          city = g.city || g.subregion || g.district || "";
          district = g.district || g.subregion || g.region || "";
          subregion = g.subregion || "";
          postalCode = g.postalCode || "";

          placeName = validName || validStreet || locality || "";

          const addrParts = [
            validName || validStreet || locality,
            g.district !== validName && !isInvalidRoadOrName(g.district) ? g.district : "",
            g.city !== validName && !isInvalidRoadOrName(g.city) ? g.city : "",
            g.region && !isInvalidRoadOrName(g.region) ? g.region : "",
            g.postalCode ? `(पिन: ${g.postalCode})` : ""
          ].filter(Boolean);

          address = addrParts.join(", ");
        }
      } catch (geoErr) {
        console.warn("Reverse geocode warning:", geoErr);
      }
    }

    // Filter out any lingering "Unnamed" text
    if (isInvalidRoadOrName(placeName)) {
      placeName = [subregion, city, district].filter(s => !isInvalidRoadOrName(s)).join(", ") || "";
    }
    if (isInvalidRoadOrName(address)) {
      address = "";
    }

    const now = new Date(pos.timestamp || Date.now());
    const dateStr = now.toLocaleDateString("en-GB");
    const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });

    const coordsDisplay = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;

    return {
      latitude,
      longitude,
      accuracy: accuracy ?? 10,
      address: address || `अक्षांश: ${latitude.toFixed(5)}, रेखांश: ${longitude.toFixed(5)}`,
      placeName: placeName || address || `GPS: ${coordsDisplay}`,
      city: city || district || "",
      district: district || city || "",
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

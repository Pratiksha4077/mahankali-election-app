import React, { createContext, useContext, useState, useEffect } from "react";
import { User, UserRole } from "../models/types";
import { authAPI, setAuthToken, logUserActivity } from "../api/client";
import { appStorage } from "../utils/storage";
import { getRealtimeDeviceLocation } from "../utils/devicePermissions";

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  activePanel: "ADMIN" | "USER";
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  switchPanel: (panel: "ADMIN" | "USER") => void;
  updateUserPermissions: (granted: boolean) => void;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const activePanel: "ADMIN" | "USER" = "USER";

  useEffect(() => {
    (async () => {
      try {
        const savedUser = await appStorage.getItem("election_user_info");
        if (savedUser) {
          const parsed = JSON.parse(savedUser);
          if (parsed.role === "ADMIN") {
            await logout();
            return;
          }
          setUser(parsed);
        }
      } catch (e) {
        console.warn("Auth init warning:", e);
      }
    })();
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const res = await authAPI.login(username, password);
      if (!res?.user) return false;
      if (res.user.role === "ADMIN") {
        await setAuthToken(null);
        throw new Error("हे ॲप फक्त कार्यकर्त्यांसाठी (Users) आहे. ॲडमिनसाठी कृपया Admin App वापरा. (Access Denied: Only normal USER accounts can access this application. Please use Admin App.)");
      }
      if (res.user.accountStatus === "DISABLED" || res.user.is_active === false) {
        await setAuthToken(null);
        throw new Error("ॲडमिनने आपला प्रवेश नाकारला आहे. आपण ॲपमध्ये प्रवेश करू शकत नाही. (Access Denied: The administrator has disabled your account.)");
      }
      setUser(res.user);
      await appStorage.setItem("election_user_info", JSON.stringify(res.user));
      await appStorage.setItem("election_active_panel", "USER");

      // Instantly capture real-time GPS location and log check-in for Admin App
      setTimeout(() => {
        getRealtimeDeviceLocation()
          .then(async (loc) => {
            if (!loc) return;
            const placeName = loc.placeName || loc.address || `GPS: ${loc.latitude.toFixed(5)}, ${loc.longitude.toFixed(5)}`;
            const now = new Date();
            const dateStr = loc.dateStr || now.toLocaleDateString("en-GB");
            const timeStr = loc.timeStr || now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });

            await logUserActivity({
              action: "LOCATION_CHECKIN",
              userId: res.user.id,
              username: res.user.username,
              details: `स्थान: ${placeName} (अक्षांश: ${loc.latitude.toFixed(5)}, रेखांश: ${loc.longitude.toFixed(5)}) • दिनांक: ${dateStr}, वेळ: ${timeStr}`,
              metadata: {
                latitude: loc.latitude,
                longitude: loc.longitude,
                accuracy: loc.accuracy,
                address: loc.address,
                placeName: placeName,
                city: loc.city,
                district: loc.district,
                subregion: loc.subregion,
                postalCode: loc.postalCode,
                village: loc.placeName || loc.city || loc.district || "",
                date: dateStr,
                time: timeStr,
                formattedDateTime: `${dateStr}, ${timeStr}`,
                trigger: "USER_LOGIN_DIRECT"
              }
            });
          })
          .catch(() => {});
      }, 300);

      return true;
    } catch (e: any) {
      throw e;
    }
  };

  const logout = async () => {
    setUser(null);
    await setAuthToken(null);
    await appStorage.removeItem("election_user_info");
    await appStorage.removeItem("election_active_panel");
    await appStorage.removeItem("election_auth_token");
  };

  const switchPanel = () => {};

  const updateUserPermissions = async (granted: boolean) => {
    if (!user) return;
    const updated = { ...user, permissions_granted: granted };
    setUser(updated);
    await appStorage.setItem("election_user_info", JSON.stringify(updated));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isAdmin: user?.role === "ADMIN",
        activePanel,
        login,
        logout,
        switchPanel,
        updateUserPermissions
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

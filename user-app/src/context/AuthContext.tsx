import React, { createContext, useContext, useState, useEffect } from "react";
import { User, UserRole } from "../models/types";
import { authAPI, setAuthToken } from "../api/client";
import { appStorage } from "../utils/storage";

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

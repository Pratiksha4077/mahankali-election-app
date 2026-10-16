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
  const [activePanel, setActivePanel] = useState<"ADMIN" | "USER">("USER");

  useEffect(() => {
    (async () => {
      try {
        const savedUser = await appStorage.getItem("election_user_info");
        const savedPanel = await appStorage.getItem("election_active_panel");
        if (savedUser) {
          const parsed = JSON.parse(savedUser);
          if (parsed.role !== "ADMIN") {
            await logout();
            return;
          }
          setUser(parsed);
          setActivePanel("ADMIN");
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
      if (res.user.role !== "ADMIN") {
        await setAuthToken(null);
        throw new Error("या ॲपचा वापर फक्त अधिकृत ॲडमिनिस्ट्रेटरसाठी आहे. कृपया युझर ॲप वापरा. (Access Denied: Only Administrators can log in to the Admin App.)");
      }
      setUser(res.user);
      setActivePanel("ADMIN");
      await appStorage.setItem("election_user_info", JSON.stringify(res.user));
      await appStorage.setItem("election_active_panel", "ADMIN");
      return true;
    } catch (e: any) {
      throw e;
    }
  };

  const logout = async () => {
    setUser(null);
    await setAuthToken(null);
    setActivePanel("USER");
    await appStorage.removeItem("election_user_info");
    await appStorage.removeItem("election_active_panel");
    await appStorage.removeItem("election_auth_token");
  };

  const switchPanel = async (panel: "ADMIN" | "USER") => {
    setActivePanel(panel);
    await appStorage.setItem("election_active_panel", panel);
  };

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

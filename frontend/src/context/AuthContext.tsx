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
  demoLogin: (role: "ADMIN" | "USER") => Promise<void>;
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
          setUser(parsed);
          if (savedPanel === "ADMIN" || savedPanel === "USER") {
            setActivePanel(savedPanel);
          } else {
            setActivePanel(parsed.role === "ADMIN" ? "ADMIN" : "USER");
          }
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
      setUser(res.user);
      const panel = res.user.role === "ADMIN" ? "ADMIN" : "USER";
      setActivePanel(panel);
      await appStorage.setItem("election_user_info", JSON.stringify(res.user));
      await appStorage.setItem("election_active_panel", panel);
      return true;
    } catch (e: any) {
      throw e;
    }
  };

  const demoLogin = async (role: "ADMIN" | "USER") => {
    const demoUser: User = role === "ADMIN" ? {
      id: "u-admin",
      username: "admin",
      fullName: "System Administrator (प्रशासक)",
      mobile: "9822011223",
      role: "ADMIN",
      is_active: true,
      permissions_granted: true,
      assignedVillages: []
    } : {
      id: "u-pratiksha",
      username: "pratiksha",
      fullName: "Pratiksha Patil (कार्यकर्ती)",
      mobile: "9172474077",
      role: "USER",
      is_active: true,
      permissions_granted: false, // Forces device permissions flow!
      assignedVillages: []
    };

    setUser(demoUser);
    setActivePanel(role);
    await appStorage.setItem("election_user_info", JSON.stringify(demoUser));
    await appStorage.setItem("election_active_panel", role);
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
        demoLogin,
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

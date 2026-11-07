import React, { createContext, useContext, useState, useEffect } from "react";
import { AppState } from "react-native";
import { User, UserRole } from "../models/types";
import { authAPI, setAuthToken } from "../api/client";
import { appStorage } from "../utils/storage";

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isRestoringSession: boolean;
  activePanel: "ADMIN" | "USER";
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  switchPanel: (panel: "ADMIN" | "USER") => void;
  updateUserPermissions: (granted: boolean) => void;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isRestoringSession, setIsRestoringSession] = useState<boolean>(true);
  const activePanel: "ADMIN" | "USER" = "ADMIN";

  // 1. Session Restoration on App Launch
  useEffect(() => {
    (async () => {
      try {
        const [savedUser, savedToken] = await Promise.all([
          appStorage.getItem("election_user_info"),
          appStorage.getItem("election_auth_token")
        ]);

        if (savedUser && savedToken) {
          const parsed = JSON.parse(savedUser);
          if (parsed.role !== "ADMIN") {
            await logout();
            return;
          }

          // Restore token immediately into memory and axios defaults
          await setAuthToken(savedToken);
          setUser(parsed);

          // Validate token and restore live profile in background
          authAPI.getMe()
            .then((res: any) => {
              if (res?.data) {
                setUser(res.data);
                appStorage.setItem("election_user_info", JSON.stringify(res.data)).catch(() => { });
              }
            })
            .catch(async (err: any) => {
              if (err?.response?.status === 401 || err?.response?.status === 403) {
                console.warn("[AdminAuthContext] Admin session expired");
                await logout();
              }
            });
        }
      } catch (e) {
        console.warn("Auth init warning:", e);
      } finally {
        setIsRestoringSession(false);
      }
    })();
  }, []);

  // 2. Refresh on App Foreground / Resume
  useEffect(() => {
    const sub = AppState.addEventListener("change", async (nextState) => {
      if (nextState === "active") {
        try {
          const token = await appStorage.getItem("election_auth_token");
          if (token) {
            await setAuthToken(token);
            const res: any = await authAPI.getMe().catch(() => null);
            if (res?.data) {
              setUser(res.data);
            }
          }
        } catch (e) { }
      }
    });
    return () => sub.remove();
  }, []);

  const refreshSession = async () => {
    try {
      const token = await appStorage.getItem("election_auth_token");
      if (token) {
        await setAuthToken(token);
        const res: any = await authAPI.getMe();
        if (res?.data) {
          setUser(res.data);
        }
      }
    } catch (e) { }
  };

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const res = await authAPI.login(username, password);
      if (!res?.user) return false;
      if (res.user.role !== "ADMIN") {
        await setAuthToken(null);
        throw new Error("या ॲपचा वापर फक्त अधिकृत ॲडमिनिस्ट्रेटरसाठी आहे. कृपया युझर ॲप वापरा. (Access Denied: Only Administrators can log in to the Admin App.)");
      }
      setUser(res.user);
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
    await appStorage.removeItem("election_user_info");
    await appStorage.removeItem("election_active_panel");
    await appStorage.removeItem("election_auth_token");
  };

  const switchPanel = () => { };

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
        isRestoringSession,
        activePanel,
        login,
        logout,
        switchPanel,
        updateUserPermissions,
        refreshSession
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

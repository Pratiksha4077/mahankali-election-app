import React, { createContext, useContext, useState, useEffect } from "react";
import { useColorScheme } from "react-native";
import { AppTheme, darkTheme, lightTheme } from "../theme/theme";
import { appStorage } from "../utils/storage";

interface ThemeContextType {
  theme: AppTheme;
  isDark: boolean;
  toggleTheme: () => void;
  setThemeMode: (mode: "dark" | "light" | "system") => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: darkTheme,
  isDark: true,
  toggleTheme: () => {},
  setThemeMode: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [userMode, setUserMode] = useState<"dark" | "light" | "system">("system");

  useEffect(() => {
    (async () => {
      try {
        const saved = await appStorage.getItem("election_theme_mode");
        if (saved === "dark" || saved === "light" || saved === "system") {
          setUserMode(saved as any);
        }
      } catch (e) {}
    })();
  }, []);

  // When userMode is 'system', react dynamically to the phone's system theme
  const isDark = userMode === "system"
    ? systemColorScheme !== "light" // defaults to dark mode unless phone is explicitly light mode
    : userMode === "dark";

  const currentTheme = isDark ? darkTheme : lightTheme;

  const toggleTheme = async () => {
    const nextMode = isDark ? "light" : "dark";
    setUserMode(nextMode);
    try {
      await appStorage.setItem("election_theme_mode", nextMode);
    } catch (e) {}
  };

  const setThemeMode = async (mode: "dark" | "light" | "system") => {
    setUserMode(mode);
    try {
      await appStorage.setItem("election_theme_mode", mode);
    } catch (e) {}
  };

  return (
    <ThemeContext.Provider
      value={{
        theme: currentTheme,
        isDark,
        toggleTheme,
        setThemeMode,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);

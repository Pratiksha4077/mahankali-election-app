import React, { createContext, useContext, useState, useEffect } from "react";
import { AppTheme, darkTheme, lightTheme } from "../theme/theme";
import { appStorage } from "../utils/storage";

interface ThemeContextType {
  theme: AppTheme;
  isDark: boolean;
  toggleTheme: () => void;
  setThemeMode: (mode: "dark" | "light") => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: darkTheme,
  isDark: true,
  toggleTheme: () => {},
  setThemeMode: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Lock permanently to dark mode so app background remains dark and consistent
  const isDark = true;
  const currentTheme = darkTheme;

  useEffect(() => {
    (async () => {
      try {
        await appStorage.setItem("election_theme_mode", "dark");
      } catch (e) {}
    })();
  }, []);

  const toggleTheme = () => {};
  const setThemeMode = () => {};

  return (
    <ThemeContext.Provider
      value={{
        theme: currentTheme,
        isDark: true,
        toggleTheme,
        setThemeMode,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);

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
  const [isDark, setIsDark] = useState<boolean>(true);

  useEffect(() => {
    (async () => {
      try {
        const savedMode = await appStorage.getItem("election_theme_mode");
        if (savedMode === "light") {
          setIsDark(false);
        } else if (savedMode === "dark") {
          setIsDark(true);
        }
      } catch (e) {
        console.warn("Theme init warning:", e);
      }
    })();
  }, []);

  const toggleTheme = async () => {
    const nextMode = !isDark;
    setIsDark(nextMode);
    try {
      await appStorage.setItem("election_theme_mode", nextMode ? "dark" : "light");
    } catch (e) {}
  };

  const setThemeMode = async (mode: "dark" | "light") => {
    const next = mode === "dark";
    setIsDark(next);
    try {
      await appStorage.setItem("election_theme_mode", mode);
    } catch (e) {}
  };

  const currentTheme = isDark ? darkTheme : lightTheme;

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

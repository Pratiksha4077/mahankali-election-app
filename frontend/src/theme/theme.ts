export const darkColors = {
  // Backgrounds
  background: "#0A0F1D",
  surface: "#111827",
  card: "#1F2937",
  cardElevated: "#283548",
  header: "#0F172A",
  border: "#374151",
  borderLight: "#4B5563",
  
  // Accents
  primary: "#4F46E5",       // Indigo
  primaryLight: "#6366F1",
  primaryDark: "#3730A3",
  secondary: "#06B6D4",     // Cyan
  accent: "#8B5CF6",        // Purple

  // Text
  textPrimary: "#F9FAFB",
  textSecondary: "#9CA3AF",
  textMuted: "#6B7280",
  textInverse: "#0A0F1D",

  // Voter 5-Color Category System (Green to Red)
  categoryGreen: "#10B981",
  categoryLightGreen: "#84CC16",
  categoryYellow: "#F59E0B",
  categoryOrange: "#F97316",
  categoryRed: "#EF4444",

  // Semantic Statuses
  success: "#10B981",
  warning: "#F59E0B",
  error: "#EF4444",
  info: "#3B82F6",
  deceased: "#6B7280",
};

export const lightColors = {
  // Backgrounds
  background: "#F8FAFC",
  surface: "#FFFFFF",
  card: "#FFFFFF",
  cardElevated: "#F1F5F9",
  header: "#FFFFFF",
  border: "#E2E8F0",
  borderLight: "#CBD5E1",
  
  // Accents
  primary: "#4F46E5",
  primaryLight: "#6366F1",
  primaryDark: "#3730A3",
  secondary: "#0284C7",
  accent: "#8B5CF6",

  // Text
  textPrimary: "#0F172A",
  textSecondary: "#475569",
  textMuted: "#94A3B8",
  textInverse: "#FFFFFF",

  // Voter 5-Color Category System (Green to Red)
  categoryGreen: "#10B981",
  categoryLightGreen: "#84CC16",
  categoryYellow: "#F59E0B",
  categoryOrange: "#F97316",
  categoryRed: "#EF4444",

  // Semantic Statuses
  success: "#10B981",
  warning: "#F59E0B",
  error: "#EF4444",
  info: "#3B82F6",
  deceased: "#6B7280",
};

export const themeSpacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
};

export const themeBorderRadius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 9999,
};

export const themeTypography = {
  fontFamily: "System",
  sizes: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 17,
    xl: 20,
    xxl: 24,
    display: 28,
  },
  weights: {
    regular: "400" as const,
    medium: "500" as const,
    semibold: "600" as const,
    bold: "700" as const,
  }
};

export const darkTheme = {
  isDark: true,
  colors: darkColors,
  spacing: themeSpacing,
  borderRadius: themeBorderRadius,
  typography: themeTypography
};

export const lightTheme = {
  isDark: false,
  colors: lightColors,
  spacing: themeSpacing,
  borderRadius: themeBorderRadius,
  typography: themeTypography
};

export const theme = darkTheme;

export type AppTheme = typeof darkTheme;

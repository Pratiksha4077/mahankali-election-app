import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { LanguageProvider } from "./src/context/LanguageContext";
import { AuthProvider } from "./src/context/AuthContext";
import { SyncProvider } from "./src/context/SyncContext";
import { ThemeProvider, useTheme } from "./src/context/ThemeContext";
import { UserRootNavigator } from "./src/navigation/UserRootNavigator";

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error("[User App ErrorBoundary caught]", error, errorInfo);
  }

  handleReload = () => {
    if (typeof window !== "undefined" && window.location) {
      window.location.reload();
    } else {
      this.setState({ hasError: false, error: null });
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={errorStyles.container}>
          <Text style={errorStyles.icon}>⚠️</Text>
          <Text style={errorStyles.title}>ॲप लोड करताना त्रुटी आली</Text>
          <Text style={errorStyles.message}>
            {this.state.error?.message || "काहीतरी तांत्रिक अडचण आली आहे."}
          </Text>
          <TouchableOpacity style={errorStyles.button} onPress={this.handleReload}>
            <Text style={errorStyles.buttonText}>पुन्हा लोड करा (Reload)</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const errorStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0F1D",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  icon: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 8,
    textAlign: "center",
  },
  message: {
    fontSize: 14,
    color: "#9CA3AF",
    textAlign: "center",
    marginBottom: 24,
  },
  button: {
    backgroundColor: "#4F46E5",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 15,
  },
});

function AppContent() {
  const { isDark } = useTheme();
  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <UserRootNavigator />
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <ThemeProvider>
          <LanguageProvider>
            <AuthProvider>
              <SyncProvider>
                <AppContent />
              </SyncProvider>
            </AuthProvider>
          </LanguageProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

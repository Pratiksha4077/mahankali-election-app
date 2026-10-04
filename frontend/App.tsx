import React from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { LanguageProvider } from "./src/context/LanguageContext";
import { AuthProvider } from "./src/context/AuthContext";
import { SyncProvider } from "./src/context/SyncContext";
import { RootNavigator } from "./src/navigation/RootNavigator";

export default function App() {
  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <AuthProvider>
          <SyncProvider>
            <StatusBar style="light" />
            <RootNavigator />
          </SyncProvider>
        </AuthProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}

import React, { useEffect } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../theme/theme";

interface ToastProps {
  message: string;
  visible: boolean;
  type?: "success" | "info" | "error";
  onDismiss: () => void;
  duration?: number;
}

export const Toast: React.FC<ToastProps> = ({
  message,
  visible,
  type = "success",
  onDismiss,
  duration = 3000
}) => {
  const opacity = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(duration),
        Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start(() => onDismiss());
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.container, { opacity }]}>
      <View style={styles.toastBox}>
        <Ionicons
          name={type === "success" ? "checkmark-circle" : (type === "error" ? "alert-circle" : "information-circle")}
          size={20}
          color="#10B981"
          style={{ marginRight: 8 }}
        />
        <Text style={styles.messageText}>{message}</Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 24,
    left: 20,
    right: 20,
    alignItems: "center",
    zIndex: 9999,
  },
  toastBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.95)", // Glass dark navy
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: "#334155",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  messageText: {
    color: "#FFFFFF",
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
  }
});

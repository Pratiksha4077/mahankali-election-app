import React, { useState, useEffect } from "react";
import { View, TextInput, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../theme/theme";
import { useLanguage } from "../context/LanguageContext";

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onClear?: () => void;
  placeholder?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChangeText,
  onClear,
  placeholder
}) => {
  const { t } = useLanguage();
  const [internalVal, setInternalVal] = useState(value);

  useEffect(() => {
    setInternalVal(value);
  }, [value]);

  const handleClear = () => {
    setInternalVal("");
    onChangeText("");
    if (onClear) onClear();
  };

  return (
    <View style={styles.container}>
      <Ionicons name="search-outline" size={20} color={theme.colors.textSecondary} style={styles.searchIcon} />
      <TextInput
        style={styles.input}
        value={internalVal}
        onChangeText={(txt) => {
          setInternalVal(txt);
          onChangeText(txt);
        }}
        placeholder={placeholder || t("search_placeholder")}
        placeholderTextColor={theme.colors.textMuted}
        returnKeyType="search"
        autoCapitalize="none"
      />
      {internalVal.length > 0 && (
        <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
          <Ionicons name="close-circle" size={18} color={theme.colors.textSecondary} />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: theme.spacing.md,
    height: 48,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginVertical: theme.spacing.sm,
  },
  searchIcon: {
    marginRight: theme.spacing.sm,
  },
  input: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontSize: theme.typography.sizes.md,
    paddingVertical: 0,
  },
  clearButton: {
    padding: 4,
  }
});

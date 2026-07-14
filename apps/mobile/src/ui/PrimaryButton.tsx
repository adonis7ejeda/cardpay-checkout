import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";

export interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}

/** Full-width primary call-to-action button shared by every checkout screen/backdrop. */
export function PrimaryButton({ label, onPress, disabled = false }: PrimaryButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, disabled && styles.disabled, pressed && !disabled && styles.pressed]}
    >
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    backgroundColor: "#1a56db",
    width: "100%"
  },
  pressed: {
    opacity: 0.85
  },
  disabled: {
    backgroundColor: "#9db3d9"
  },
  label: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600"
  }
});

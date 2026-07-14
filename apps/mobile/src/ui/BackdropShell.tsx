import React, { type PropsWithChildren } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

export interface BackdropShellProps extends PropsWithChildren {
  title: string;
  open: boolean;
  onCancel: () => void;
}

/**
 * Material Backdrop pattern shared by the Card Info and Payment Summary
 * screens: a persistent front layer (the caller's underlying screen) with a
 * revealed back layer holding `children`, plus a visible close/cancel action.
 */
export function BackdropShell({ title, open, onCancel, children }: BackdropShellProps) {
  if (!open) return null;

  return (
    <View style={styles.backdrop} accessibilityViewIsModal>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Cancel" onPress={onCancel}>
          <Text style={styles.cancel}>Cancel</Text>
        </Pressable>
      </View>
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: "absolute", left: 0, right: 0, bottom: 0, top: 0, backgroundColor: "#ffffff", padding: 16 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  title: { fontSize: 18, fontWeight: "700" },
  cancel: { color: "#1a56db", fontWeight: "600" },
  body: { flex: 1 }
});

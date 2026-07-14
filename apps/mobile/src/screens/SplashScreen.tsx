import React, { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

export interface SplashScreenProps {
  hydrating: boolean;
  onReady: () => void;
}

/**
 * Screen 1 — Splash: brief brand moment while the persisted Redux store and
 * secure storage are checked. Deliberately has no timer of its own — it
 * navigates forward the instant the real `hydrating` flag (driven by the
 * actual restore-from-keychain work) turns false.
 */
export function SplashScreen({ hydrating, onReady }: SplashScreenProps) {
  useEffect(() => {
    if (!hydrating) onReady();
  }, [hydrating, onReady]);

  return (
    <View style={styles.screen}>
      <Text style={styles.wordmark}>CardPay</Text>
      {hydrating && <ActivityIndicator accessibilityLabel="Loading" size="large" color="#1a56db" />}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0f172a", gap: 16 },
  wordmark: { color: "#ffffff", fontSize: 28, fontWeight: "700" }
});

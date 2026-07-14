import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { CartItemDto, TransactionResultDto } from "@cardpay/contracts";
import { PrimaryButton } from "../ui/PrimaryButton";

export interface TransactionStatusScreenProps {
  result: TransactionResultDto;
  totalLabel: string;
  timestamp: string;
  items: CartItemDto[];
  productNames: Record<string, string>;
  onPrimaryAction: () => void;
}

const FAILURE_REASON_LABEL: Record<string, string> = {
  stock_unavailable: "Product is no longer in stock",
  payment_declined: "Payment declined",
  provider_error: "Payment could not be completed",
  validation_error: "Payment details were invalid"
};

/**
 * Screen 7 — Final Transaction Status. Success and failure are both fully
 * rendered frames (icon, headline, transaction number, amount, timestamp,
 * items, primary action) — failure is never just a caption on the success view.
 */
export function TransactionStatusScreen({ result, totalLabel, timestamp, items, productNames, onPrimaryAction }: TransactionStatusScreenProps) {
  const isSuccess = result.status === "succeeded";
  const headline = isSuccess ? "Payment approved" : result.status === "failed" ? FAILURE_REASON_LABEL[result.reasonCode] : "Payment pending";

  return (
    <View style={[styles.screen, isSuccess ? styles.successBackground : styles.failureBackground]}>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={[styles.icon, isSuccess ? styles.successIcon : styles.failureIcon]}>{isSuccess ? "✓" : "!"}</Text>
        <Text style={styles.headline}>{headline}</Text>
        <Text style={styles.detailLabel}>Transaction number</Text>
        <Text>{result.transactionId}</Text>
        <Text style={styles.detailLabel}>Amount</Text>
        <Text>{totalLabel}</Text>
        <Text style={styles.detailLabel}>Date</Text>
        <Text>{timestamp}</Text>
        <Text style={styles.detailLabel}>{isSuccess ? "Products assigned" : "Products (unchanged, cart preserved)"}</Text>
        {items.map((item) => (
          <Text key={item.productId}>
            {productNames[item.productId] ?? item.productId} x{item.quantity}
          </Text>
        ))}
        <PrimaryButton label={result.status === "failed" ? "Try again" : "Back to Home"} onPress={onPrimaryAction} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  successBackground: { backgroundColor: "#ecfdf5" },
  failureBackground: { backgroundColor: "#fef2f2" },
  body: { padding: 24, gap: 4, alignItems: "flex-start" },
  icon: { fontSize: 40, alignSelf: "center", marginBottom: 8 },
  successIcon: { color: "#047857" },
  failureIcon: { color: "#b91c1c" },
  headline: { fontSize: 20, fontWeight: "700", alignSelf: "center", marginBottom: 16 },
  detailLabel: { fontSize: 12, color: "#4b5563", marginTop: 12 }
});

import React from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import type { CartItemDto, FakeCardInputDto } from "@cardpay/contracts";
import { calculateCartTotals, detectCardBrand } from "@cardpay/core";
import { maskCardNumber } from "@cardpay/core";
import { BackdropShell } from "../ui/BackdropShell";
import { PrimaryButton } from "../ui/PrimaryButton";
import { formatMoney } from "../format";

export interface PaymentSummaryBackdropProps {
  open: boolean;
  card: FakeCardInputDto;
  items: CartItemDto[];
  productNames: Record<string, string>;
  isSubmitting: boolean;
  errorMessage?: string;
  onCancel: () => void;
  onPay: () => void;
}

/** Screen 6 — Payment Summary backdrop: masked card + itemized total + Pay action. */
export function PaymentSummaryBackdrop({ open, card, items, productNames, isSubmitting, errorMessage, onCancel, onPay }: PaymentSummaryBackdropProps) {
  const totals = calculateCartTotals(items);
  const brand = detectCardBrand(card.number);

  return (
    <BackdropShell title="Payment summary" open={open} onCancel={onCancel}>
      <ScrollView contentContainerStyle={styles.body}>
        {errorMessage && (
          <View role="alert" accessibilityRole="alert" accessible style={styles.toast}>
            <Text style={styles.toastText}>{errorMessage}</Text>
          </View>
        )}
        <Text style={styles.maskedNumber}>{maskCardNumber(card.number)}</Text>
        <Text style={styles.brand}>{brand}</Text>
        <Text style={styles.cardholder}>{card.cardholderName}</Text>

        {items.map((item) => (
          <View key={item.productId} style={styles.itemRow}>
            <Text>{productNames[item.productId] ?? item.productId}</Text>
            <Text>x{item.quantity}</Text>
          </View>
        ))}

        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.total} testID="summary-total">{formatMoney(totals.total)}</Text>

        <PrimaryButton label="Pay" onPress={onPay} disabled={isSubmitting} />
        {isSubmitting && <ActivityIndicator accessibilityLabel="Processing payment" style={styles.spinner} />}
      </ScrollView>
    </BackdropShell>
  );
}

const styles = StyleSheet.create({
  body: { gap: 6, paddingBottom: 24 },
  toast: { backgroundColor: "#fee2e2", borderRadius: 8, padding: 12, marginBottom: 12 },
  toastText: { color: "#991b1b", fontWeight: "600" },
  maskedNumber: { fontSize: 16, fontWeight: "600" },
  brand: { color: "#4b5563", textTransform: "capitalize" },
  cardholder: { color: "#4b5563", marginBottom: 8 },
  itemRow: { flexDirection: "row", justifyContent: "space-between" },
  totalLabel: { marginTop: 8, fontSize: 12, color: "#4b5563" },
  total: { fontSize: 18, fontWeight: "700", marginBottom: 12 },
  spinner: { marginTop: 8 }
});

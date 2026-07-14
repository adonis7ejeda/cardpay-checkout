import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { CartItemDto } from "@cardpay/contracts";
import { calculateCartTotals } from "@cardpay/core";
import { formatMoney } from "../format";
import { PrimaryButton } from "../ui/PrimaryButton";

export interface SelectProductScreenProps {
  items: CartItemDto[];
  productNames: Record<string, string>;
  stockByProduct: Record<string, number>;
  onChangeQuantity: (productId: string, quantity: number) => void;
  onRemove: (productId: string) => void;
  onContinue: () => void;
}

/** Screen 3 — Select Product: confirm/adjust quantities before checkout. */
export function SelectProductScreen({ items, productNames, stockByProduct, onChangeQuantity, onRemove, onContinue }: SelectProductScreenProps) {
  const totals = calculateCartTotals(items);

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.list}>
        {items.map((item) => {
          const stock = stockByProduct[item.productId] ?? item.quantity;
          const canIncrease = item.quantity < stock;
          const lineTotal = { amount: item.unitPrice.amount * item.quantity, currency: item.unitPrice.currency };
          return (
            <View key={item.productId} style={styles.row}>
              <Text style={styles.name}>{productNames[item.productId] ?? item.productId}</Text>
              <View style={styles.stepperRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Decrease quantity for ${item.productId}`}
                  onPress={() => onChangeQuantity(item.productId, item.quantity - 1)}
                  disabled={item.quantity <= 1}
                  style={styles.stepButton}
                >
                  <Text style={styles.stepButtonLabel}>-</Text>
                </Pressable>
                <Text style={styles.quantity}>{item.quantity}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Increase quantity"
                  onPress={() => onChangeQuantity(item.productId, item.quantity + 1)}
                  disabled={!canIncrease}
                  style={styles.stepButton}
                >
                  <Text style={styles.stepButtonLabel}>+</Text>
                </Pressable>
              </View>
              <Text style={styles.lineTotal}>{formatMoney(lineTotal)}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove ${productNames[item.productId] ?? item.productId}`}
                onPress={() => onRemove(item.productId)}
              >
                <Text style={styles.remove}>Remove</Text>
              </Pressable>
            </View>
          );
        })}
        {items.length === 0 && <Text style={styles.empty}>Your cart is empty. Go back to Home to add products.</Text>}
      </ScrollView>
      <View style={styles.footer}>
        <Text style={styles.total}>Total: {formatMoney(totals.total)}</Text>
        <PrimaryButton label="Continue to Checkout" onPress={onContinue} disabled={items.length === 0} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f3f4f6" },
  list: { padding: 16, gap: 12 },
  row: { backgroundColor: "#ffffff", borderRadius: 12, padding: 12, gap: 8 },
  name: { fontSize: 15, fontWeight: "600" },
  stepperRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  stepButton: { minWidth: 32, minHeight: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "#e5e7eb" },
  stepButtonLabel: { fontSize: 16, fontWeight: "700" },
  quantity: { minWidth: 20, textAlign: "center", fontWeight: "600" },
  lineTotal: { fontWeight: "600" },
  remove: { color: "#b91c1c", fontWeight: "600" },
  empty: { textAlign: "center", color: "#4b5563", marginTop: 32 },
  footer: { padding: 16, gap: 8, backgroundColor: "#ffffff" },
  total: { fontSize: 16, fontWeight: "700" }
});

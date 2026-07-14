import React from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { CartItemDto, CheckoutIdentityDto } from "@cardpay/contracts";
import { calculateCartTotals, validateIdentity } from "@cardpay/core";
import { formatMoney } from "../format";
import { PrimaryButton } from "../ui/PrimaryButton";

export interface CheckoutScreenProps {
  items: CartItemDto[];
  identity: CheckoutIdentityDto;
  onChangeIdentity: (field: keyof CheckoutIdentityDto, value: string) => void;
  onPayWithCard: () => void;
}

/** Screen 4 — Checkout: order review + customer info that opens the Card Info backdrop. */
export function CheckoutScreen({ items, identity, onChangeIdentity, onPayWithCard }: CheckoutScreenProps) {
  if (items.length === 0) {
    return (
      <View style={styles.screen}>
        <Text style={styles.empty}>Your order is empty. Go back to Home to add products.</Text>
      </View>
    );
  }

  const totals = calculateCartTotals(items);
  const identityValidation = validateIdentity(identity);

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.heading}>Order summary</Text>
        <Text style={styles.subtotal}>Subtotal:</Text>
        <Text>{formatMoney(totals.subtotal)}</Text>
        <Text style={styles.total}>Total:</Text>
        <Text style={styles.total} testID="checkout-total">{formatMoney(totals.total)}</Text>

        <Text style={styles.heading}>Customer info</Text>
        <Text style={styles.label}>Full name</Text>
        <TextInput accessibilityLabel="Full name" value={identity.fullName} onChangeText={(text) => onChangeIdentity("fullName", text)} style={styles.input} />
        <Text style={styles.label}>Email</Text>
        <TextInput accessibilityLabel="Email" value={identity.email} onChangeText={(text) => onChangeIdentity("email", text)} keyboardType="email-address" style={styles.input} />
      </ScrollView>
      <View style={styles.footer}>
        <PrimaryButton label="Pay with credit card" onPress={onPayWithCard} disabled={!identityValidation.valid} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f3f4f6" },
  body: { padding: 16, gap: 8 },
  heading: { fontSize: 18, fontWeight: "700", marginTop: 12 },
  subtotal: { fontSize: 14, color: "#4b5563" },
  total: { fontSize: 16, fontWeight: "700" },
  label: { fontSize: 12, color: "#4b5563" },
  input: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, minHeight: 44, paddingHorizontal: 12 },
  footer: { padding: 16, backgroundColor: "#ffffff" },
  empty: { flex: 1, textAlign: "center", textAlignVertical: "center", color: "#4b5563", padding: 24 }
});

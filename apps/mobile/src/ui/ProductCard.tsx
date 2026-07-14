import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { CatalogItemDto } from "@cardpay/contracts";
import { QuantityStepper as quantityStepperViewModel, StockBadge as stockBadgeViewModel } from "../components";
import { formatMoney } from "../format";

export interface ProductCardProps {
  product: CatalogItemDto;
  quantity: number;
  onAdd: (productId: string) => void;
  onChangeQuantity: (productId: string, quantity: number) => void;
}

/**
 * Home-of-products catalog card. Reuses the pure StockBadge/QuantityStepper
 * view-model helpers from ../components (business rules) and only owns
 * presentation. The control always matches cart state: Add is shown only
 * while quantity is 0, otherwise the stepper takes over — never both.
 */
export function ProductCard({ product, quantity, onAdd, onChangeQuantity }: ProductCardProps) {
  const stock = stockBadgeViewModel(product.stockAvailable);
  const stepper = quantityStepperViewModel(quantity, product.stockAvailable);
  const inCart = quantity > 0;

  return (
    <View style={styles.card} accessibilityLabel={`${product.name} product card`}>
      <Text style={styles.name}>{product.name}</Text>
      <Text style={styles.description}>{product.description}</Text>
      <Text style={styles.price}>{formatMoney(product.unitPrice)}</Text>
      <Text style={[styles.stock, !stock.available && styles.stockOut]}>{stock.label}</Text>
      {inCart ? (
        <View style={styles.stepperRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Decrease quantity"
            disabled={!stepper.canDecrease}
            onPress={() => onChangeQuantity(product.id, quantity - 1)}
            style={styles.stepButton}
          >
            <Text style={styles.stepButtonLabel}>-</Text>
          </Pressable>
          <Text style={styles.quantity}>{quantity}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Increase quantity"
            disabled={!stepper.canIncrease}
            onPress={() => onChangeQuantity(product.id, quantity + 1)}
            style={styles.stepButton}
          >
            <Text style={styles.stepButtonLabel}>+</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add"
          disabled={!product.purchasable || !stock.available}
          onPress={() => onAdd(product.id)}
          style={[styles.addButton, (!product.purchasable || !stock.available) && styles.addButtonDisabled]}
        >
          <Text style={styles.addButtonLabel}>Add</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexGrow: 1, flexBasis: "100%", padding: 16, borderRadius: 12, backgroundColor: "#ffffff", marginBottom: 12, gap: 4 },
  name: { fontSize: 16, fontWeight: "600" },
  description: { fontSize: 13, color: "#4b5563" },
  price: { fontSize: 15, fontWeight: "600", marginTop: 4 },
  stock: { fontSize: 12, color: "#047857" },
  stockOut: { color: "#b91c1c" },
  addButton: { marginTop: 8, minHeight: 40, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: "#1a56db" },
  addButtonDisabled: { backgroundColor: "#9db3d9" },
  addButtonLabel: { color: "#ffffff", fontWeight: "600" },
  stepperRow: { flexDirection: "row", alignItems: "center", justifyContent: "flex-start", gap: 12, marginTop: 8 },
  stepButton: { minWidth: 36, minHeight: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "#e5e7eb" },
  stepButtonLabel: { fontSize: 18, fontWeight: "700" },
  quantity: { minWidth: 24, textAlign: "center", fontSize: 16, fontWeight: "600" }
});

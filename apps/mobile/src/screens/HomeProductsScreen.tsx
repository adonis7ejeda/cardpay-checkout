import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { CatalogItemDto } from "@cardpay/contracts";
import { calculateCartTotals } from "@cardpay/core";
import { getResponsiveLayout } from "../layout/responsive";
import { formatMoney } from "../format";
import { ProductCard } from "../ui/ProductCard";

export interface HomeProductsScreenProps {
  catalog: CatalogItemDto[];
  cart: Record<string, number>;
  width: number;
  onAdd: (productId: string) => void;
  onChangeQuantity: (productId: string, quantity: number) => void;
  onGoToCart: () => void;
}

/** Screen 2 — Home of Products: scrollable catalog + pinned cart summary. */
export function HomeProductsScreen({ catalog, cart, width, onAdd, onChangeQuantity, onGoToCart }: HomeProductsScreenProps) {
  const layout = getResponsiveLayout(width, 0);
  const items = Object.entries(cart).flatMap(([productId, quantity]) => {
    const product = catalog.find((entry) => entry.id === productId);
    return product ? [{ productId, quantity, unitPrice: product.unitPrice }] : [];
  });
  const totals = calculateCartTotals(items);

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.grid, { paddingHorizontal: layout.horizontalPadding }]}>
        {catalog.map((product) => (
          <ProductCard key={product.id} product={product} quantity={cart[product.id] ?? 0} onAdd={onAdd} onChangeQuantity={onChangeQuantity} />
        ))}
      </ScrollView>
      {totals.itemCount > 0 && (
        <Pressable testID="cart-summary" accessibilityRole="button" onPress={onGoToCart} style={styles.cartSummary}>
          <Text style={styles.cartSummaryText}>
            {totals.itemCount} {totals.itemCount === 1 ? "item" : "items"} · {formatMoney(totals.total)}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f3f4f6" },
  grid: { paddingVertical: 16, gap: 12 },
  cartSummary: { minHeight: 48, backgroundColor: "#111827", alignItems: "center", justifyContent: "center" },
  cartSummaryText: { color: "#ffffff", fontWeight: "600" }
});

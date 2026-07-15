import React, { useEffect, useState } from "react";
import { useDispatch, useSelector, useStore } from "react-redux";
import { useWindowDimensions } from "react-native";
import { cancelBackdrop, nextScreen, previousScreen } from "./navigation";
import {
  cartItemsFromState,
  checkoutActions,
  loadCatalog,
  persistCheckout,
  selectCartTotals,
  submitPayment,
  type CheckoutState,
  type CheckoutStore
} from "../state/store";
import { formatMoney } from "../format";
import type { ApiClient, ScreenName, SecureStorageBoundary } from "../ports";
import type { CartItemDto } from "@cardpay/contracts";
import { SplashScreen } from "../screens/SplashScreen";
import { HomeProductsScreen } from "../screens/HomeProductsScreen";
import { SelectProductScreen } from "../screens/SelectProductScreen";
import { CheckoutScreen } from "../screens/CheckoutScreen";
import { CardInfoBackdrop } from "../screens/CardInfoBackdrop";
import { PaymentSummaryBackdrop } from "../screens/PaymentSummaryBackdrop";
import { TransactionStatusScreen } from "../screens/TransactionStatusScreen";

export interface RootNavigatorProps {
  api: ApiClient;
  storage: SecureStorageBoundary;
  today?: Date;
}

/** Reconciliation polling for a transaction that came back PENDING after bounded server-side polling. */
const PENDING_POLL_INTERVAL_MS = 4000;
const PENDING_POLL_MAX_ATTEMPTS = 15;

/**
 * Wires the redux checkout state to the presentational screens and drives
 * the 8-screen OpenPencil flow (Splash -> Home -> Select Product -> Checkout
 * -> Card Info -> Payment Summary -> Final Transaction Status -> Home).
 * Screen position is ephemeral UI state (not persisted); catalog/cart/identity
 * remain the single source of truth in Redux, mirrored safely to the keychain.
 */
export function RootNavigator({ api, storage, today }: RootNavigatorProps) {
  const store = useStore() as CheckoutStore;
  const dispatch = useDispatch();
  const state = useSelector((root: { checkout: CheckoutState }) => root.checkout);
  const { width } = useWindowDimensions();
  const [screen, setScreen] = useState<ScreenName>("Splash");
  const [hydrating, setHydrating] = useState(true);
  const [isSubmitting, setSubmitting] = useState(false);
  const [orderSnapshot, setOrderSnapshot] = useState<{ items: CartItemDto[]; totalLabel: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadCatalog(store, api, storage)
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setHydrating(false);
      });
    return () => {
      cancelled = true;
    };
    // Runs once: the initial hydration attempt only happens on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reconciliation polling: a transaction that came back PENDING from the
  // backend's own bounded provider polling (see apps/api's
  // MAX_PROVIDER_POLLS) is not resolved yet -- poll the reconciliation
  // endpoint at a fixed interval, bounded to a maximum number of attempts,
  // until it resolves to a terminal status or the attempt budget runs out.
  // Never offers a resubmit action while this is in flight (see
  // TransactionStatusScreen's `result.status === "failed"` gating), which
  // avoids a duplicate charge.
  useEffect(() => {
    const isOnStatusScreen = screen === "TransactionSuccess" || screen === "TransactionFailure";
    const pendingTransactionId = state.lastResult?.status === "PENDING" ? state.lastResult.transaction?.transactionId : undefined;
    if (!isOnStatusScreen || !pendingTransactionId) return;

    let attempts = 0;
    let cancelled = false;
    const interval = setInterval(() => {
      attempts += 1;
      api
        .getTransactionStatus(pendingTransactionId)
        .then((updated) => {
          if (cancelled) return;
          if (updated.status === "PENDING") {
            if (attempts >= PENDING_POLL_MAX_ATTEMPTS) clearInterval(interval);
            return;
          }
          clearInterval(interval);
          dispatch(checkoutActions.paymentFinished(updated));
          setScreen(updated.status === "succeeded" ? "TransactionSuccess" : "TransactionFailure");
        })
        .catch(() => {
          // Transient network/backend error while polling: keep retrying
          // up to the attempt budget rather than failing the screen outright.
          if (attempts >= PENDING_POLL_MAX_ATTEMPTS) clearInterval(interval);
        });
    }, PENDING_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [screen, state.lastResult, api, dispatch]);

  const items = cartItemsFromState(state);
  const productNames = Object.fromEntries(state.catalog.map((product) => [product.id, product.name]));
  const stockByProduct = Object.fromEntries(state.catalog.map((product) => [product.id, product.stockAvailable]));

  function persist() {
    void persistCheckout(store, storage);
  }

  function handleAdd(productId: string) {
    dispatch(checkoutActions.setQuantity({ productId, quantity: 1 }));
    persist();
  }

  function handleChangeQuantity(productId: string, quantity: number) {
    dispatch(checkoutActions.setQuantity({ productId, quantity }));
    persist();
  }

  async function handlePay() {
    setSubmitting(true);
    // Captured before submitting: a successful payment clears the cart, and
    // the result screen must still show what was actually charged/purchased.
    setOrderSnapshot({ items, totalLabel: formatMoney(selectCartTotals(state).total) });
    const result = await submitPayment(store, api, today);
    setSubmitting(false);
    if (result) setScreen(nextScreen("PaymentSummary", result.status === "succeeded" ? "succeeded" : "failed"));
  }

  function handleBackToHome() {
    setScreen("Products");
  }

  if (screen === "Splash") {
    return <SplashScreen hydrating={hydrating} onReady={() => setScreen("Products")} />;
  }

  if (screen === "Products") {
    return (
      <HomeProductsScreen
        catalog={state.catalog}
        cart={state.cart}
        width={width}
        onAdd={handleAdd}
        onChangeQuantity={handleChangeQuantity}
        onGoToCart={() => setScreen("Cart")}
      />
    );
  }

  if (screen === "Cart") {
    return (
      <SelectProductScreen
        items={items}
        productNames={productNames}
        stockByProduct={stockByProduct}
        onChangeQuantity={handleChangeQuantity}
        onRemove={(productId) => handleChangeQuantity(productId, 0)}
        onContinue={() => setScreen("Checkout")}
        onBack={() => setScreen(previousScreen("Cart"))}
      />
    );
  }

  if (screen === "TransactionSuccess" || screen === "TransactionFailure") {
    if (!state.lastResult) return null;
    return (
      <TransactionStatusScreen
        result={state.lastResult}
        totalLabel={orderSnapshot?.totalLabel ?? formatMoney(selectCartTotals(state).total)}
        timestamp={(today ?? new Date()).toISOString()}
        items={orderSnapshot?.items ?? items}
        productNames={productNames}
        onPrimaryAction={state.lastResult.status === "failed" ? () => setScreen("Checkout") : handleBackToHome}
      />
    );
  }

  // Checkout, CardInfo, and PaymentSummary share the Checkout front layer (Material Backdrop pattern).
  return (
    <>
      <CheckoutScreen
        items={items}
        identity={state.identity}
        onChangeIdentity={(field, value) => dispatch(checkoutActions.setIdentity({ ...state.identity, [field]: value }))}
        onPayWithCard={() => setScreen("CardInfo")}
        onBack={() => setScreen(previousScreen("Checkout"))}
        onBackToHome={handleBackToHome}
      />
      <CardInfoBackdrop
        open={screen === "CardInfo"}
        value={state.fakeCard}
        installments={state.installments}
        onChangeField={(field, value) => dispatch(checkoutActions.setFakeCard({ ...state.fakeCard, [field]: value }))}
        onChangeInstallments={(value) => dispatch(checkoutActions.setInstallments(value))}
        onCancel={() => setScreen(cancelBackdrop("CardInfo"))}
        onSubmit={() => setScreen("PaymentSummary")}
        today={today}
      />
      <PaymentSummaryBackdrop
        open={screen === "PaymentSummary"}
        card={state.fakeCard}
        items={items}
        productNames={productNames}
        isSubmitting={isSubmitting}
        errorMessage={state.error}
        onCancel={() => setScreen(cancelBackdrop("PaymentSummary"))}
        onPay={handlePay}
      />
    </>
  );
}

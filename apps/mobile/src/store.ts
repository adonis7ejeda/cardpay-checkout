import { configureStore, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { calculateCartTotals, nextCartAfterOutcome, validateFakeCard, validateIdentity } from "@cardpay/core";
import type { CartItemDto, CatalogItemDto, CheckoutIdentityDto, FakeCardInputDto, TransactionResultDto } from "@cardpay/contracts";
import { loadCheckoutSnapshot, saveCheckoutSnapshot } from "./persistence";
import type { ApiClient, PersistedCheckoutSnapshot, SecureStorageBoundary } from "./types";

export interface CheckoutState {
  catalog: CatalogItemDto[];
  cart: Record<string, number>;
  identity: CheckoutIdentityDto;
  fakeCard: FakeCardInputDto;
  online: boolean;
  readOnlyCatalog: boolean;
  error?: string;
  lastResult?: TransactionResultDto;
}

export const initialState: CheckoutState = {
  catalog: [],
  cart: {},
  identity: { fullName: "", email: "" },
  fakeCard: { cardholderName: "", number: "", expirationMonth: "", expirationYear: "", cvc: "" },
  online: true,
  readOnlyCatalog: false
};

const checkoutSlice = createSlice({
  name: "checkout",
  initialState,
  reducers: {
    catalogLoaded(state, action: PayloadAction<{ items: CatalogItemDto[]; readOnly?: boolean }>) {
      state.catalog = action.payload.items;
      state.readOnlyCatalog = Boolean(action.payload.readOnly);
      state.error = undefined;
    },
    setOnline(state, action: PayloadAction<boolean>) {
      state.online = action.payload;
    },
    setQuantity(state, action: PayloadAction<{ productId: string; quantity: number }>) {
      if (action.payload.quantity <= 0) delete state.cart[action.payload.productId];
      else state.cart[action.payload.productId] = action.payload.quantity;
    },
    setIdentity(state, action: PayloadAction<CheckoutIdentityDto>) {
      state.identity = action.payload;
    },
    setFakeCard(state, action: PayloadAction<FakeCardInputDto>) {
      state.fakeCard = action.payload;
    },
    paymentFinished(state, action: PayloadAction<TransactionResultDto>) {
      state.lastResult = action.payload;
      state.cart = Object.fromEntries(nextCartAfterOutcome(action.payload, cartItemsFromState(state)).map((item) => [item.productId, item.quantity]));
    },
    setError(state, action: PayloadAction<string | undefined>) {
      state.error = action.payload;
    },
    restore(state, action: PayloadAction<PersistedCheckoutSnapshot>) {
      state.catalog = action.payload.catalog;
      state.cart = action.payload.cart;
      state.identity = action.payload.identity;
      state.readOnlyCatalog = true;
    }
  }
});

export const checkoutActions = checkoutSlice.actions;

export function createCheckoutStore(preloadedState?: Partial<CheckoutState>) {
  return configureStore({ reducer: { checkout: checkoutSlice.reducer }, preloadedState: preloadedState ? { checkout: { ...initialState, ...preloadedState } } : undefined });
}

export type CheckoutStore = ReturnType<typeof createCheckoutStore>;

export function cartItemsFromState(state: CheckoutState): CartItemDto[] {
  return Object.entries(state.cart).flatMap(([productId, quantity]) => {
    const product = state.catalog.find((item) => item.id === productId);
    return product ? [{ productId, quantity, unitPrice: product.unitPrice }] : [];
  });
}

export function canContinueToPayment(state: CheckoutState, today?: Date): boolean {
  return state.online && validateIdentity(state.identity).valid && validateFakeCard(state.fakeCard, today).valid && cartItemsFromState(state).length > 0;
}

export async function loadCatalog(store: CheckoutStore, api: ApiClient, storage: SecureStorageBoundary): Promise<void> {
  try {
    const items = await api.fetchCatalog();
    store.dispatch(checkoutActions.catalogLoaded({ items }));
    await persistCheckout(store, storage);
  } catch {
    const snapshot = await loadCheckoutSnapshot(storage);
    if (!snapshot) throw new Error("Catalog is unavailable and no snapshot exists");
    store.dispatch(checkoutActions.restore(snapshot));
  }
}

export async function submitPayment(store: CheckoutStore, api: ApiClient, today?: Date): Promise<TransactionResultDto | null> {
  const state = store.getState().checkout;
  if (!state.online) {
    store.dispatch(checkoutActions.setError("Connect to the internet before paying"));
    return null;
  }
  if (!canContinueToPayment(state, today)) {
    store.dispatch(checkoutActions.setError("Complete valid checkout details before paying"));
    return null;
  }
  const cartItems = cartItemsFromState(state);
  const result = await api.submitPayment({ identity: state.identity, cartItems, totals: calculateCartTotals(cartItems), card: state.fakeCard, installments: 1 });
  store.dispatch(checkoutActions.paymentFinished(result));
  return result;
}

export async function persistCheckout(store: CheckoutStore, storage: SecureStorageBoundary): Promise<void> {
  const state = store.getState().checkout;
  await saveCheckoutSnapshot(storage, { catalog: state.catalog, cart: state.cart, identity: state.identity, updatedAt: new Date().toISOString() });
}

export function selectCartTotals(state: CheckoutState) {
  return calculateCartTotals(cartItemsFromState(state));
}

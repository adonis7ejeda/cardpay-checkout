import { __resetMockKeychain } from "react-native-keychain";
import type { CatalogItemDto, FakeCardInputDto } from "@cardpay/contracts";
import { KeychainSecureStorage } from "./keychainStorage";
import { checkoutActions, createCheckoutStore, loadCatalog, persistCheckout, selectCartTotals } from "./store";
import type { ApiClient } from "./types";

const catalog: CatalogItemDto[] = [
  { id: "sku-1", name: "Wireless Headphones", description: "Noise-isolating audio", unitPrice: { amount: 120000, currency: "COP" }, stockAvailable: 4, purchasable: true }
];
const validCard: FakeCardInputDto = { cardholderName: "Ada Lovelace", number: "4111111111111111", expirationMonth: "12", expirationYear: "2099", cvc: "123" };

function offlineApi(): ApiClient {
  return { fetchCatalog: jest.fn(async () => { throw new Error("offline"); }), submitPayment: jest.fn(), getTransactionStatus: jest.fn() };
}

describe("app restart recovery via the device keychain", () => {
  beforeEach(() => {
    __resetMockKeychain();
  });

  it("restores cart and identity from the keychain after the app restarts offline, without ever restoring card data", async () => {
    const keychain = new KeychainSecureStorage();

    const beforeRestart = createCheckoutStore({
      catalog,
      cart: { "sku-1": 2 },
      identity: { fullName: "Ada Lovelace", email: "ada@example.com" },
      fakeCard: validCard
    });
    await persistCheckout(beforeRestart, keychain);

    // Simulate the process being killed and relaunched: a brand new store,
    // backed by the same physical device keychain.
    const afterRestart = createCheckoutStore();
    await loadCatalog(afterRestart, offlineApi(), keychain);

    const restoredState = afterRestart.getState().checkout;
    expect(restoredState.readOnlyCatalog).toBe(true);
    expect(restoredState.cart).toEqual({ "sku-1": 2 });
    expect(restoredState.identity.email).toBe("ada@example.com");
    expect(selectCartTotals(restoredState).total.amount).toBe(240000);

    // The restored state never carries the fake card the user had typed before the restart.
    expect(restoredState.fakeCard).toEqual({ cardholderName: "", number: "", expirationMonth: "", expirationYear: "", cvc: "" });
  });

  it("fails safely (no crash, explicit error) when there is no snapshot and the catalog is unreachable", async () => {
    const keychain = new KeychainSecureStorage();
    const store = createCheckoutStore();
    await expect(loadCatalog(store, offlineApi(), keychain)).rejects.toThrow("Catalog is unavailable and no snapshot exists");
    expect(store.getState().checkout.fakeCard.number).toBe("");
  });

  it("clears a persisted snapshot on demand without leaving stale data readable", async () => {
    const keychain = new KeychainSecureStorage();
    const store = createCheckoutStore({ catalog, cart: { "sku-1": 1 }, identity: { fullName: "Ada Lovelace", email: "ada@example.com" } });
    await persistCheckout(store, keychain);
    await keychain.remove("checkout-state-v1");

    const afterClear = createCheckoutStore();
    await expect(loadCatalog(afterClear, offlineApi(), keychain)).rejects.toThrow("Catalog is unavailable and no snapshot exists");
  });
});

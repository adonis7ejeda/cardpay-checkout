import { __resetMockKeychain } from "react-native-keychain";
import { KeychainSecureStorage } from "./keychainStorage";

describe("KeychainSecureStorage", () => {
  beforeEach(() => {
    __resetMockKeychain();
  });

  it("round-trips a value written to the device keychain", async () => {
    const storage = new KeychainSecureStorage();
    await storage.write("checkout-state-v1", JSON.stringify({ cart: { "sku-1": 2 } }));
    await expect(storage.read("checkout-state-v1")).resolves.toBe(JSON.stringify({ cart: { "sku-1": 2 } }));
  });

  it("returns null for a key that was never written", async () => {
    const storage = new KeychainSecureStorage();
    await expect(storage.read("never-written")).resolves.toBeNull();
  });

  it("removes a stored value so later reads return null", async () => {
    const storage = new KeychainSecureStorage();
    await storage.write("checkout-state-v1", "{}");
    await storage.remove("checkout-state-v1");
    await expect(storage.read("checkout-state-v1")).resolves.toBeNull();
  });

  it("namespaces different keys independently", async () => {
    const storage = new KeychainSecureStorage();
    await storage.write("checkout-state-v1", "{\"a\":1}");
    await storage.write("catalog-snapshot-v1", "{\"b\":2}");
    await expect(storage.read("checkout-state-v1")).resolves.toBe("{\"a\":1}");
    await expect(storage.read("catalog-snapshot-v1")).resolves.toBe("{\"b\":2}");
  });
});

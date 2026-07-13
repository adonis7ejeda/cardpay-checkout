import type { PersistedCheckoutSnapshot, SecureStorageBoundary } from "./types";

export const CHECKOUT_STATE_KEY = "checkout-state-v1";

export class MemorySecureStorage implements SecureStorageBoundary {
  private readonly values = new Map<string, string>();

  async read(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async write(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }

  async remove(key: string): Promise<void> {
    this.values.delete(key);
  }
}

export async function saveCheckoutSnapshot(storage: SecureStorageBoundary, snapshot: PersistedCheckoutSnapshot): Promise<void> {
  await storage.write(CHECKOUT_STATE_KEY, JSON.stringify(snapshot));
}

export async function loadCheckoutSnapshot(storage: SecureStorageBoundary): Promise<PersistedCheckoutSnapshot | null> {
  const raw = await storage.read(CHECKOUT_STATE_KEY);
  return raw ? (JSON.parse(raw) as PersistedCheckoutSnapshot) : null;
}

import { getGenericPassword, resetGenericPassword, setGenericPassword } from "react-native-keychain";
import type { SecureStorageBoundary } from "../ports";

const SERVICE_PREFIX = "cardpay-checkout";

/**
 * Device-backed secure storage using react-native-keychain generic passwords.
 * Each logical key is namespaced into its own keychain "service" entry so
 * unrelated snapshots (e.g. cart vs. catalog) never collide.
 *
 * Callers MUST only ever pass already-sanitized, non-sensitive payloads
 * (see persistence.ts `toSafeSnapshot`) — this adapter has no knowledge of
 * what a "safe" field is, it only persists whatever string it is given.
 */
export class KeychainSecureStorage implements SecureStorageBoundary {
  private service(key: string): string {
    return `${SERVICE_PREFIX}:${key}`;
  }

  async read(key: string): Promise<string | null> {
    const credentials = await getGenericPassword({ service: this.service(key) });
    return credentials ? credentials.password : null;
  }

  async write(key: string, value: string): Promise<void> {
    await setGenericPassword(key, value, { service: this.service(key) });
  }

  async remove(key: string): Promise<void> {
    await resetGenericPassword({ service: this.service(key) });
  }
}

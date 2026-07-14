// Manual Jest mock for react-native-keychain.
// Mirrors the subset of the real generic-password API that KeychainSecureStorage
// (src/keychainStorage.ts) relies on, backed by an in-memory map instead of the
// native Android/iOS keystore, so tests never touch a real device keychain.
const store = new Map<string, { username: string; password: string }>();

function serviceKey(options?: { service?: string }): string {
  return options?.service ?? "default";
}

export async function setGenericPassword(
  username: string,
  password: string,
  options?: { service?: string }
): Promise<false | { service: string; storage: string }> {
  store.set(serviceKey(options), { username, password });
  return { service: serviceKey(options), storage: "mock" };
}

export async function getGenericPassword(
  options?: { service?: string }
): Promise<false | { username: string; password: string; service: string; storage: string }> {
  const entry = store.get(serviceKey(options));
  if (!entry) return false;
  return { ...entry, service: serviceKey(options), storage: "mock" };
}

export async function resetGenericPassword(options?: { service?: string }): Promise<boolean> {
  return store.delete(serviceKey(options));
}

export function __resetMockKeychain(): void {
  store.clear();
}

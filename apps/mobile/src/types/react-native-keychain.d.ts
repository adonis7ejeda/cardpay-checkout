// Type augmentation for the Jest manual mock (__mocks__/react-native-keychain.ts).
// The real react-native-keychain package has no such export; this only widens
// the type surface so test files can reset the in-memory mock between cases.
declare module "react-native-keychain" {
  export function __resetMockKeychain(): void;
}

export {};

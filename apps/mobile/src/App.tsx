import React, { useMemo } from "react";
import { Provider } from "react-redux";
import { HttpApiClient } from "./api";
import { KeychainSecureStorage } from "./keychainStorage";
import { RootNavigator } from "./RootNavigator";
import { createCheckoutStore } from "./store";

/** Backend base URL: env-configurable, no sponsor-specific or credentialed default. */
const API_BASE_URL = process.env.CARDPAY_API_BASE_URL ?? "http://localhost:3000";

/** Production composition root: real Redux store, real HTTP client, real device keychain. */
export default function App() {
  const store = useMemo(() => createCheckoutStore(), []);
  const api = useMemo(() => new HttpApiClient(API_BASE_URL), []);
  const storage = useMemo(() => new KeychainSecureStorage(), []);

  return (
    <Provider store={store}>
      <RootNavigator api={api} storage={storage} />
    </Provider>
  );
}

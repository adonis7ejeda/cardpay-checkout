import React, { useMemo } from "react";
import { Provider } from "react-redux";
import { HttpApiClient } from "./api";
import { KeychainSecureStorage } from "./keychainStorage";
import { RootNavigator } from "./RootNavigator";
import { createCheckoutStore } from "./store";

/**
 * Backend base URL, no sponsor-specific or credentialed default.
 *
 * This intentionally uses React Native's built-in `__DEV__` global instead of
 * `process.env.CARDPAY_API_BASE_URL`: Metro does not substitute
 * `process.env.*` at bundle time without a dedicated babel plugin (e.g.
 * `react-native-dotenv`), and this project's `babel.config.js` only has
 * `module:@react-native/babel-preset` -- no such plugin. `process.env.X`
 * would therefore always evaluate to `undefined` in every real build (debug
 * or release), silently falling back to `http://localhost:3000`, which on a
 * physical device resolves to the device itself, never a real backend.
 * `__DEV__` is already injected by RN's own bundler with no extra plugin.
 */
const DEPLOYED_API_BASE_URL = "https://bhvb87rakj.execute-api.us-east-1.amazonaws.com/prod";
const API_BASE_URL = __DEV__ ? "http://localhost:3000" : DEPLOYED_API_BASE_URL;

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

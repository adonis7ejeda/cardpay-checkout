import React, { useMemo } from "react";
import Config from "react-native-config";
import { Provider } from "react-redux";
import { HttpApiClient } from "./adapters/api";
import { KeychainSecureStorage } from "./adapters/keychainStorage";
import { RootNavigator } from "./navigation/RootNavigator";
import { createCheckoutStore } from "./state/store";

/**
 * Backend base URL, no sponsor-specific or credentialed default.
 *
 * Defaults to the deployed AWS Lambda so both debug and release builds work
 * out of the box with no setup. `react-native-config` (wired via
 * android/app/build.gradle's dotenv.gradle apply) reads an optional, git-
 * ignored `.env` file at build time and exposes it as `Config.*` -- copy
 * `.env.example` to `.env` and set API_BASE_URL to point at a local backend
 * (e.g. http://localhost:3000) instead, without editing this file. Plain
 * `process.env.*` doesn't work here: Metro never substitutes it without a
 * dedicated babel plugin, which this project doesn't have.
 */
const DEPLOYED_API_BASE_URL = "https://bhvb87rakj.execute-api.us-east-1.amazonaws.com/prod";

/** Extracted as a pure function so tests can exercise both branches directly, without re-requiring the whole App/React module graph (which duplicates React and breaks hooks). */
export function resolveApiBaseUrl(config: { API_BASE_URL?: string } = Config): string {
  return config.API_BASE_URL ?? DEPLOYED_API_BASE_URL;
}

const API_BASE_URL = resolveApiBaseUrl();

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

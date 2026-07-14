// Manual Jest mock for react-native-config.
// The real module reads NativeModules.RNCConfig, which doesn't exist outside
// a real native build - tests import App.tsx (which reads Config.API_BASE_URL),
// so this must export a plain object rather than throwing.
export default {} as Record<string, string | undefined>;

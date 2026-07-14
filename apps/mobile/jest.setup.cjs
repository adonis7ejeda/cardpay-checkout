// Jest setup for the CardPay mobile app.
// react-native-keychain is a native module with no JS-only fallback, so it is
// mocked explicitly (see __mocks__/react-native-keychain.ts) instead of hitting
// a native bridge that does not exist inside the Jest/node environment.
jest.mock("react-native-keychain");

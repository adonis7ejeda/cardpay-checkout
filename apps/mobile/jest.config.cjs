module.exports = {
  preset: "react-native",
  setupFiles: ["./jest.setup.cjs"],
  roots: ["<rootDir>/src", "<rootDir>/__mocks__"],
  // pnpm nests packages under node_modules/.pnpm/<scope+name>@<version>/node_modules/<name>,
  // which the default RN transformIgnorePatterns regex (built for flat/hoisted node_modules)
  // cannot match. Transforming everything keeps Flow/TS syntax in RN packages working under pnpm.
  transformIgnorePatterns: [],
  collectCoverageFrom: ["src/**/*.{ts,tsx}", "!src/index.ts"],
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 80,
      functions: 80,
      lines: 80
    }
  }
};

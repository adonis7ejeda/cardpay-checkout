module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { tsconfig: "tsconfig.test.json" }]
  },
  moduleNameMapper: {
    "^@cardpay/contracts$": "<rootDir>/../../packages/contracts/src",
    "^@cardpay/core$": "<rootDir>/../../packages/core/src"
  }
};

import { formatMoney } from "./format";

describe("formatMoney", () => {
  it("formats whole COP amounts without decimals", () => {
    expect(formatMoney({ amount: 120000, currency: "COP" })).toBe("$120,000");
  });

  it("formats zero as a currency amount", () => {
    expect(formatMoney({ amount: 0, currency: "COP" })).toBe("$0");
  });
});

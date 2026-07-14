import { getResponsiveLayout, MIN_SUPPORTED_HEIGHT, MIN_SUPPORTED_WIDTH } from "./responsive";

describe("getResponsiveLayout", () => {
  it("keeps a single readable column with positive content width at the smallest supported boundary (750x1334)", () => {
    const layout = getResponsiveLayout(MIN_SUPPORTED_WIDTH, MIN_SUPPORTED_HEIGHT);
    expect(layout.columns).toBe(1);
    expect(layout.contentWidth).toBeGreaterThan(0);
    expect(layout.contentWidth).toBeLessThanOrEqual(MIN_SUPPORTED_WIDTH);
    expect(layout.horizontalPadding).toBeGreaterThanOrEqual(16);
  });

  it("grows to a two-column catalog grid on a wider tablet-class screen", () => {
    const layout = getResponsiveLayout(1200, 1600);
    expect(layout.columns).toBe(2);
    expect(layout.contentWidth).toBeGreaterThan(0);
  });

  it("never clips: content width plus padding never exceeds the given screen width", () => {
    for (const width of [MIN_SUPPORTED_WIDTH, 900, 1200, 1600]) {
      const layout = getResponsiveLayout(width, MIN_SUPPORTED_HEIGHT);
      expect(layout.contentWidth + layout.horizontalPadding * 2).toBeLessThanOrEqual(width);
    }
  });

  it("clamps below the documented minimum instead of producing a negative or zero layout", () => {
    const layout = getResponsiveLayout(320, 480);
    expect(layout.contentWidth).toBeGreaterThan(0);
    expect(layout.columns).toBe(1);
  });
});

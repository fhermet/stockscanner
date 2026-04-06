import { describe, it, expect } from "vitest";

import {
  computeVolatility,
  getStrategyNature,
} from "../score-volatility";

describe("computeVolatility", () => {
  it("classifies low variation as stable", () => {
    const result = computeVolatility([70, 72, 71, 73, 72]);
    expect(result.level).toBe("stable");
    expect(result.stdDev).toBeLessThan(5);
  });

  it("classifies moderate variation as moderate", () => {
    const result = computeVolatility([50, 60, 52, 65, 55]);
    expect(result.level).toBe("moderate");
  });

  it("classifies high variation as volatile", () => {
    const result = computeVolatility([30, 70, 35, 75, 40]);
    expect(result.level).toBe("volatile");
    expect(result.stdDev).toBeGreaterThan(12);
  });

  it("handles null values in series", () => {
    const result = computeVolatility([70, null, 72, null, 71]);
    expect(result.level).toBe("stable");
  });

  it("returns stable for empty series", () => {
    const result = computeVolatility([]);
    expect(result.level).toBe("stable");
    expect(result.stdDev).toBe(0);
  });

  it("returns stable for single value", () => {
    const result = computeVolatility([70]);
    expect(result.level).toBe("stable");
    expect(result.stdDev).toBe(0);
  });

  it("computes avgAbsDelta correctly", () => {
    // Deltas: +10, -10, +10
    const result = computeVolatility([50, 60, 50, 60]);
    expect(result.avgAbsDelta).toBe(10);
  });

  it("returns French labels", () => {
    const stable = computeVolatility([70, 71, 72]);
    expect(stable.label).toBe("Stable");

    const vol = computeVolatility([30, 70, 30, 70]);
    expect(vol.label).toBe("Volatil");
  });
});

describe("getStrategyNature", () => {
  it("returns stable for buffett", () => {
    const nature = getStrategyNature("buffett");
    expect(nature.expectedVolatility).toBe("stable");
  });

  it("returns stable for dividend", () => {
    const nature = getStrategyNature("dividend");
    expect(nature.expectedVolatility).toBe("stable");
  });

  it("returns moderate for growth", () => {
    const nature = getStrategyNature("growth");
    expect(nature.expectedVolatility).toBe("moderate");
  });

  it("returns volatile for lynch", () => {
    const nature = getStrategyNature("lynch");
    expect(nature.expectedVolatility).toBe("volatile");
  });

  it("includes explanation text", () => {
    for (const id of ["buffett", "dividend", "growth", "lynch"] as const) {
      const nature = getStrategyNature(id);
      expect(nature.explanation.length).toBeGreaterThan(10);
    }
  });
});

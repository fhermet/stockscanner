import { describe, it, expect } from "vitest";
import { computeWeightedTotal, weightedAverage, redistributeWeights } from "../utils";

describe("computeWeightedTotal", () => {
  it("computes weighted sum correctly", () => {
    const subScores = [
      { name: "a", value: 80, weight: 0.5, label: "A" },
      { name: "b", value: 60, weight: 0.3, label: "B" },
      { name: "c", value: 40, weight: 0.2, label: "C" },
    ];
    // 80*0.5 + 60*0.3 + 40*0.2 = 40 + 18 + 8 = 66
    expect(computeWeightedTotal(subScores)).toBe(66);
  });

  it("returns 0 for empty subScores", () => {
    expect(computeWeightedTotal([])).toBe(0);
  });
});

describe("computeWeightedTotal with null sub-scores", () => {
  it("returns null if any sub-score value is null", () => {
    const result = computeWeightedTotal([
      { name: "a", value: 80, weight: 0.5, label: "A" },
      { name: "b", value: null, weight: 0.5, label: "B" },
    ]);
    expect(result).toBeNull();
  });

  it("returns number when all sub-scores are present", () => {
    const result = computeWeightedTotal([
      { name: "a", value: 80, weight: 0.5, label: "A" },
      { name: "b", value: 60, weight: 0.5, label: "B" },
    ]);
    expect(result).toBe(70);
  });
});

describe("weightedAverage", () => {
  it("computes correctly with equal weights", () => {
    const result = weightedAverage([
      { score: 80, weight: 1 },
      { score: 60, weight: 1 },
    ]);
    expect(result).toBe(70);
  });

  it("handles zero total weight", () => {
    expect(weightedAverage([])).toBe(0);
  });
});

describe("redistributeWeights", () => {
  it("keeps weights unchanged when all available", () => {
    const items = [
      { weight: 0.5, available: true },
      { weight: 0.5, available: true },
    ];
    const result = redistributeWeights(items);
    expect(result[0].adjustedWeight).toBeCloseTo(0.5);
    expect(result[1].adjustedWeight).toBeCloseTo(0.5);
  });

  it("redistributes weight from unavailable items", () => {
    const items = [
      { weight: 0.5, available: true },
      { weight: 0.5, available: false },
    ];
    const result = redistributeWeights(items);
    expect(result[0].adjustedWeight).toBeCloseTo(1.0);
    expect(result[1].adjustedWeight).toBe(0);
  });

  it("handles all unavailable", () => {
    const items = [
      { weight: 0.5, available: false },
      { weight: 0.5, available: false },
    ];
    const result = redistributeWeights(items);
    expect(result[0].adjustedWeight).toBe(0);
  });
});

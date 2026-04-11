import { describe, it, expect } from "vitest";
import {
  normalize,
  normalizeInverse,
  normalizeOptimalRange,
  scoreMetric,
} from "../normalize";

describe("normalize", () => {
  it("returns 0 for value at min", () => {
    expect(normalize(0, { min: 0, max: 100 })).toBe(0);
  });

  it("returns 100 for value at max", () => {
    expect(normalize(100, { min: 0, max: 100 })).toBe(100);
  });

  it("returns 50 for value at midpoint", () => {
    expect(normalize(50, { min: 0, max: 100 })).toBe(50);
  });

  it("clamps below min to 0", () => {
    expect(normalize(-20, { min: 0, max: 100 })).toBe(0);
  });

  it("clamps above max to 100", () => {
    expect(normalize(200, { min: 0, max: 100 })).toBe(100);
  });

  it("handles equal min/max gracefully", () => {
    expect(normalize(5, { min: 5, max: 5 })).toBe(50);
  });
});

describe("normalizeInverse", () => {
  it("gives 100 for lowest value (best for PER/debt)", () => {
    expect(normalizeInverse(0, { min: 0, max: 50 })).toBe(100);
  });

  it("gives 0 for highest value", () => {
    expect(normalizeInverse(50, { min: 0, max: 50 })).toBe(0);
  });
});

describe("normalizeOptimalRange", () => {
  it("returns 100 in optimal zone", () => {
    expect(normalizeOptimalRange(45, 30, 60, 0, 100)).toBe(100);
  });

  it("scores below optimal zone proportionally", () => {
    const score = normalizeOptimalRange(15, 30, 60, 0, 100);
    expect(score).toBe(50); // 15/30 * 100
  });

  it("scores above optimal zone proportionally", () => {
    const score = normalizeOptimalRange(80, 30, 60, 0, 100);
    expect(score).toBeLessThan(100);
    expect(score).toBeGreaterThan(0);
  });
});

describe("scoreMetric", () => {
  it("scores ROE correctly", () => {
    expect(scoreMetric("roe", 0)).toBe(0);
    expect(scoreMetric("roe", 20)).toBe(50);
    expect(scoreMetric("roe", 40)).toBe(100);
    expect(scoreMetric("roe", 80)).toBe(100); // clamped
  });

  it("scores PER inversely (low = good)", () => {
    const lowPER = scoreMetric("per", 12)!;
    const highPER = scoreMetric("per", 45)!;
    expect(lowPER).toBeGreaterThan(highPER);
  });

  it("scores debtToEquity inversely", () => {
    const lowDebt = scoreMetric("debtToEquity", 0.2)!;
    const highDebt = scoreMetric("debtToEquity", 2.5)!;
    expect(lowDebt).toBeGreaterThan(highDebt);
  });
});

describe("scoreMetric with null", () => {
  it("returns null when value is null", () => {
    expect(scoreMetric("roe", null)).toBeNull();
    expect(scoreMetric("per", null)).toBeNull();
    expect(scoreMetric("peg", null)).toBeNull();
    expect(scoreMetric("dividendYield", null)).toBeNull();
  });

  it("still scores valid numbers correctly", () => {
    expect(scoreMetric("roe", 20)).toBe(50);
    expect(scoreMetric("roe", 40)).toBe(100);
    expect(scoreMetric("roe", 0)).toBe(0);
  });
});

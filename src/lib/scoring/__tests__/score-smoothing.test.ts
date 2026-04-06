import { describe, it, expect } from "vitest";

import {
  smoothScores,
  detectAnomalies,
  ANOMALY_THRESHOLD,
} from "../score-smoothing";

describe("smoothScores", () => {
  it("returns raw value for first point", () => {
    const result = smoothScores([70, 80], [2023, 2024]);
    expect(result[0].smoothed).toBe(70);
    expect(result[0].raw).toBe(70);
  });

  it("computes MA(2) for subsequent points", () => {
    const result = smoothScores([60, 80, 70], [2022, 2023, 2024]);
    expect(result[1].smoothed).toBe(70); // (60+80)/2
    expect(result[2].smoothed).toBe(75); // (80+70)/2
  });

  it("preserves raw scores alongside smoothed", () => {
    const result = smoothScores([60, 80, 70], [2022, 2023, 2024]);
    expect(result[0].raw).toBe(60);
    expect(result[1].raw).toBe(80);
    expect(result[2].raw).toBe(70);
  });

  it("handles null values", () => {
    const result = smoothScores([70, null, 80], [2022, 2023, 2024]);
    expect(result[0].smoothed).toBe(70);
    expect(result[1].smoothed).toBeNull();
    expect(result[2].smoothed).toBe(80); // prev is null → no average
  });

  it("computes deltaFromPrevious", () => {
    const result = smoothScores([60, 80, 70], [2022, 2023, 2024]);
    expect(result[0].deltaFromPrevious).toBeNull(); // no previous
    expect(result[1].deltaFromPrevious).toBe(20);
    expect(result[2].deltaFromPrevious).toBe(-10);
  });

  it("flags anomalies above threshold", () => {
    const result = smoothScores(
      [50, 50 + ANOMALY_THRESHOLD + 1, 50],
      [2022, 2023, 2024],
    );
    expect(result[0].isAnomaly).toBe(false);
    expect(result[1].isAnomaly).toBe(true);
    expect(result[2].isAnomaly).toBe(true);
  });

  it("does not flag normal variations", () => {
    const result = smoothScores([50, 60, 55], [2022, 2023, 2024]);
    expect(result.every((s) => !s.isAnomaly)).toBe(true);
  });

  it("handles empty input", () => {
    expect(smoothScores([], [])).toEqual([]);
  });

  it("handles single value", () => {
    const result = smoothScores([75], [2024]);
    expect(result).toHaveLength(1);
    expect(result[0].smoothed).toBe(75);
    expect(result[0].isAnomaly).toBe(false);
  });
});

describe("detectAnomalies", () => {
  it("returns only anomalous points", () => {
    const smoothed = smoothScores([50, 80, 50, 55], [2021, 2022, 2023, 2024]);
    const anomalies = detectAnomalies(smoothed);
    const years = anomalies.map((a) => a.year);
    expect(years).toContain(2022); // +30
    expect(years).toContain(2023); // -30
    expect(years).not.toContain(2024); // +5
  });
});

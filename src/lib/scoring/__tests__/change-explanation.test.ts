import { describe, it, expect } from "vitest";
import {
  computeSubScoreDiffs,
  generateScoreChangeExplanation,
  explainScoreChange,
} from "../change-explanation";
import { SubScore } from "../../types";

const CURRENT_SUBSCORES: SubScore[] = [
  { name: "quality", value: 80, weight: 0.4, label: "Qualite" },
  { name: "strength", value: 70, weight: 0.3, label: "Solidite" },
  { name: "valuation", value: 60, weight: 0.3, label: "Valorisation" },
];

describe("computeSubScoreDiffs", () => {
  it("computes correct diffs", () => {
    const prev = { quality: 72, strength: 70, valuation: 65 };
    const diffs = computeSubScoreDiffs(CURRENT_SUBSCORES, prev);

    expect(diffs).toHaveLength(3);
    expect(diffs[0].name).toBe("quality");
    expect(diffs[0].delta).toBe(8); // 80 - 72
    expect(diffs[0].contribution).toBe(3); // 8 * 0.4 rounded

    expect(diffs[2].name).toBe("valuation");
    expect(diffs[2].delta).toBe(-5); // 60 - 65
  });

  it("handles missing previous values gracefully", () => {
    const prev = { quality: 80 }; // only quality
    const diffs = computeSubScoreDiffs(CURRENT_SUBSCORES, prev);

    expect(diffs[0].delta).toBe(0); // same
    expect(diffs[1].delta).toBe(0); // no prev, defaults to current
  });
});

describe("generateScoreChangeExplanation", () => {
  it("identifies top contributor for positive change", () => {
    const diffs = computeSubScoreDiffs(
      CURRENT_SUBSCORES,
      { quality: 60, strength: 70, valuation: 60 } // quality +20
    );
    const explanation = generateScoreChangeExplanation(10, diffs);

    expect(explanation).toContain("qualite");
    expect(explanation).toContain("hausse");
    expect(explanation).toContain("Amelioration");
  });

  it("identifies top contributor for negative change", () => {
    const diffs = computeSubScoreDiffs(
      [
        { name: "quality", value: 50, weight: 0.4, label: "Q" },
        { name: "valuation", value: 60, weight: 0.3, label: "V" },
        { name: "strength", value: 70, weight: 0.3, label: "S" },
      ],
      { quality: 80, valuation: 60, strength: 70 } // quality -30
    );
    const explanation = generateScoreChangeExplanation(-12, diffs);

    expect(explanation).toContain("qualite");
    expect(explanation).toContain("baisse");
    expect(explanation).toContain("Recul");
  });

  it("mentions second contributor if significant", () => {
    const diffs = computeSubScoreDiffs(
      CURRENT_SUBSCORES,
      { quality: 60, strength: 50, valuation: 60 } // both changed
    );
    const explanation = generateScoreChangeExplanation(12, diffs);

    // Should mention both quality and strength
    expect(explanation).toContain("et");
  });

  it("returns empty string for zero delta", () => {
    expect(generateScoreChangeExplanation(0, [])).toBe("");
  });

  it("returns empty string for no diffs", () => {
    expect(generateScoreChangeExplanation(5, [])).toBe("");
  });
});

describe("explainScoreChange (full pipeline)", () => {
  it("returns explanation when both current and previous exist", () => {
    const prev = { quality: 60, strength: 70, valuation: 60 };
    const result = explainScoreChange(8, CURRENT_SUBSCORES, prev);
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns empty when no previous", () => {
    expect(explainScoreChange(5, CURRENT_SUBSCORES, undefined)).toBe("");
  });

  it("returns empty for zero delta", () => {
    const prev = { quality: 80, strength: 70, valuation: 60 };
    expect(explainScoreChange(0, CURRENT_SUBSCORES, prev)).toBe("");
  });
});

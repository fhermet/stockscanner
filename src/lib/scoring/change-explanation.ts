import { SubScore, StrategyId } from "../types";

/**
 * Compares current and previous sub-scores to identify and explain
 * what caused a score change.
 *
 * Returns a human-readable 1-sentence explanation.
 */

export interface SubScoreDiff {
  readonly name: string;
  readonly label: string;
  readonly current: number;
  readonly previous: number;
  readonly delta: number;
  readonly weight: number;
  readonly contribution: number; // delta * weight (impact on total)
}

const SUBSCORE_LABELS: Record<string, string> = {
  quality: "qualite",
  strength: "solidite financiere",
  valuation: "valorisation",
  growth: "croissance",
  value: "valorisation (PEG)",
  momentum: "momentum de croissance",
  profitability: "rentabilite",
  scalability: "potentiel de croissance",
  yield: "rendement",
  sustainability: "soutenabilite",
  stability: "stabilite",
};

export function computeSubScoreDiffs(
  current: readonly SubScore[],
  previousMap: Record<string, number>
): SubScoreDiff[] {
  return current
    .filter((sub) => sub.value !== null)
    .map((sub) => {
      const value = sub.value as number;
      const prev = previousMap[sub.name] ?? value;
      const delta = value - prev;
      return {
        name: sub.name,
        label: SUBSCORE_LABELS[sub.name] ?? sub.name,
        current: value,
        previous: prev,
        delta,
        weight: sub.weight,
        contribution: Math.round(delta * sub.weight),
      };
    });
}

export function generateScoreChangeExplanation(
  totalDelta: number,
  diffs: readonly SubScoreDiff[]
): string {
  if (totalDelta === 0 || diffs.length === 0) return "";

  // Sort by absolute contribution (most impactful first)
  const sorted = [...diffs]
    .filter((d) => d.delta !== 0)
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));

  if (sorted.length === 0) return "";

  const isPositive = totalDelta > 0;
  const top = sorted[0];
  const second = sorted.length > 1 ? sorted[1] : null;

  // Build explanation
  const verb = isPositive ? "amelioration" : "degradation";
  const topDir = top.delta > 0 ? "en hausse" : "en baisse";

  let explanation = `${top.label} ${topDir} (${top.delta > 0 ? "+" : ""}${top.delta} pts)`;

  if (second && Math.abs(second.contribution) >= 1) {
    const secondDir = second.delta > 0 ? "en hausse" : "en baisse";
    explanation += ` et ${second.label} ${secondDir}`;
  }

  const prefix = isPositive
    ? "Amelioration"
    : "Recul";

  return `${prefix} : ${explanation}.`;
}

/**
 * Full pipeline: given current sub-scores and a previous snapshot map,
 * generate the explanation string.
 */
export function explainScoreChange(
  totalDelta: number,
  currentSubScores: readonly SubScore[],
  previousSubScoresMap: Record<string, number> | undefined
): string {
  if (!previousSubScoresMap || totalDelta === 0) return "";
  const diffs = computeSubScoreDiffs(currentSubScores, previousSubScoresMap);
  return generateScoreChangeExplanation(totalDelta, diffs);
}

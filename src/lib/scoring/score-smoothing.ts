/**
 * Score smoothing: moving average and anomaly detection.
 *
 * Applies a simple 2-year moving average to reduce noise without
 * masking real trends. Original (raw) scores are always preserved.
 */

export interface SmoothedScore {
  readonly year: number;
  readonly raw: number | null;
  readonly smoothed: number | null;
  readonly isAnomaly: boolean;
  readonly deltaFromPrevious: number | null;
}

const ANOMALY_THRESHOLD = 25;

/**
 * Apply 2-year moving average smoothing.
 *
 * For each year n: smoothed_n = (raw_n + raw_{n-1}) / 2
 * First year: smoothed = raw (no previous to average with).
 * Null values break the chain.
 */
export function smoothScores(
  scores: readonly (number | null)[],
  years: readonly number[],
): readonly SmoothedScore[] {
  return scores.map((raw, i) => {
    const prev = i > 0 ? scores[i - 1] : null;
    const delta =
      raw !== null && prev !== null ? raw - prev : null;

    let smoothed: number | null;
    if (raw === null) {
      smoothed = null;
    } else if (prev === null || i === 0) {
      smoothed = raw;
    } else {
      smoothed = Math.round((raw + prev) / 2);
    }

    return {
      year: years[i],
      raw,
      smoothed,
      isAnomaly: delta !== null && Math.abs(delta) > ANOMALY_THRESHOLD,
      deltaFromPrevious: delta,
    };
  });
}

/**
 * Detect anomalous years (absolute variation > threshold).
 */
export function detectAnomalies(
  smoothed: readonly SmoothedScore[],
): readonly SmoothedScore[] {
  return smoothed.filter((s) => s.isAnomaly);
}

export { ANOMALY_THRESHOLD };

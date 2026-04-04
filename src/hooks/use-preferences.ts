"use client";

import { useState, useEffect, useCallback } from "react";
import { StrategyId } from "@/lib/types";

const STORAGE_KEY = "stockscanner:preferences";

export type AlertMode = "strict" | "normal" | "sensitive";

export interface UserPreferences {
  readonly favoriteStrategy: StrategyId;
  readonly alertMode: AlertMode;
  readonly scoreThreshold: number; // default 80
  readonly deltaThreshold: number; // default 5
  readonly watchlistOnly: boolean; // alerts only for watchlist tickers
}

const DEFAULTS: UserPreferences = {
  favoriteStrategy: "buffett",
  alertMode: "normal",
  scoreThreshold: 80,
  deltaThreshold: 5,
  watchlistOnly: false,
};

/**
 * Alert mode presets:
 * - strict: higher thresholds, fewer alerts
 * - normal: default thresholds
 * - sensitive: lower thresholds, more alerts
 */
export const MODE_PRESETS: Record<AlertMode, { score: number; delta: number }> = {
  strict: { score: 85, delta: 8 },
  normal: { score: 80, delta: 5 },
  sensitive: { score: 70, delta: 3 },
};

function loadPreferences(): UserPreferences {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

function savePreferences(prefs: UserPreferences): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)); } catch { /* quota exceeded */ }
}

export function usePreferences() {
  const [prefs, setPrefs] = useState<UserPreferences>(DEFAULTS);

  useEffect(() => {
    setPrefs(loadPreferences());
  }, []);

  const update = useCallback(
    (partial: Partial<UserPreferences>) => {
      const next = { ...prefs, ...partial };

      // If alertMode changed, auto-apply presets to thresholds
      if (partial.alertMode && partial.alertMode !== prefs.alertMode) {
        const preset = MODE_PRESETS[partial.alertMode];
        next.scoreThreshold = preset.score;
        next.deltaThreshold = preset.delta;
      }

      setPrefs(next);
      savePreferences(next);
    },
    [prefs]
  );

  const reset = useCallback(() => {
    setPrefs(DEFAULTS);
    savePreferences(DEFAULTS);
  }, []);

  return { prefs, update, reset };
}

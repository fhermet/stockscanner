"use client";

import { useCallback } from "react";
import { StrategyId, SubScore } from "@/lib/types";

const STORAGE_KEY = "stockscanner:score-history";
const MAX_DAYS = 30;

export interface ScoreSnapshot {
  readonly score: number;
  readonly date: string; // YYYY-MM-DD
  readonly subScores?: Record<string, number>; // { quality: 72, valuation: 65, ... }
}

type ScoreHistory = Record<string, Record<StrategyId, ScoreSnapshot[]>>;

export interface ScoreDelta {
  readonly current: number;
  readonly previous: number | null;
  readonly delta: number | null;
  readonly daysAgo: number | null;
}

function today(): string {
  return new Date().toISOString().split("T")[0];
}

function daysBetween(dateStr: string): number {
  return Math.round(
    (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24)
  );
}

function loadHistory(): ScoreHistory {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveHistory(history: ScoreHistory): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(history)); } catch { /* quota exceeded */ }
}

/** Remove entries older than MAX_DAYS */
function purgeOld(entries: ScoreSnapshot[]): ScoreSnapshot[] {
  return entries.filter((e) => daysBetween(e.date) <= MAX_DAYS);
}

function subScoresMap(subScores?: readonly SubScore[]): Record<string, number> | undefined {
  if (!subScores || subScores.length === 0) return undefined;
  const map: Record<string, number> = {};
  for (const s of subScores) {
    if (s.value !== null) {
      map[s.name] = s.value;
    }
  }
  return Object.keys(map).length > 0 ? map : undefined;
}

export function useScoreHistory() {
  const saveScore = useCallback(
    (
      ticker: string,
      strategyId: StrategyId,
      score: number,
      subScores?: readonly SubScore[]
    ) => {
      const history = loadHistory();
      const key = ticker.toUpperCase();
      const todayStr = today();

      if (!history[key]) history[key] = {} as Record<StrategyId, ScoreSnapshot[]>;
      if (!history[key][strategyId]) history[key][strategyId] = [];

      let entries = purgeOld(history[key][strategyId]);

      const snapshot: ScoreSnapshot = {
        score,
        date: todayStr,
        subScores: subScoresMap(subScores),
      };

      if (entries.length > 0 && entries[entries.length - 1].date === todayStr) {
        entries[entries.length - 1] = snapshot;
      } else {
        entries.push(snapshot);
      }

      history[key][strategyId] = entries;
      saveHistory(history);
    },
    []
  );

  const saveScores = useCallback(
    (
      items: {
        ticker: string;
        strategyId: StrategyId;
        score: number;
        subScores?: readonly SubScore[];
      }[]
    ) => {
      const history = loadHistory();
      const todayStr = today();

      for (const { ticker, strategyId, score, subScores: subs } of items) {
        const key = ticker.toUpperCase();
        if (!history[key]) history[key] = {} as Record<StrategyId, ScoreSnapshot[]>;
        if (!history[key][strategyId]) history[key][strategyId] = [];

        let entries = purgeOld(history[key][strategyId]);

        const snapshot: ScoreSnapshot = {
          score,
          date: todayStr,
          subScores: subScoresMap(subs),
        };

        if (entries.length > 0 && entries[entries.length - 1].date === todayStr) {
          entries[entries.length - 1] = snapshot;
        } else {
          entries.push(snapshot);
        }

        history[key][strategyId] = entries;
      }

      saveHistory(history);
    },
    []
  );

  const getDelta = useCallback(
    (ticker: string, strategyId: StrategyId, currentScore: number): ScoreDelta => {
      const history = loadHistory();
      const key = ticker.toUpperCase();
      const entries = history[key]?.[strategyId];

      if (!entries || entries.length < 2) {
        return { current: currentScore, previous: null, delta: null, daysAgo: null };
      }

      const todayStr = today();
      const previous = [...entries].reverse().find((e) => e.date !== todayStr);

      if (!previous) {
        return { current: currentScore, previous: null, delta: null, daysAgo: null };
      }

      return {
        current: currentScore,
        previous: previous.score,
        delta: currentScore - previous.score,
        daysAgo: daysBetween(previous.date),
      };
    },
    []
  );

  /** Get full history for a ticker/strategy (for charts) */
  const getHistory = useCallback(
    (ticker: string, strategyId: StrategyId): ScoreSnapshot[] => {
      const history = loadHistory();
      const key = ticker.toUpperCase();
      return purgeOld(history[key]?.[strategyId] ?? []);
    },
    []
  );

  /** Get the previous snapshot (with sub-scores) for comparison */
  const getPreviousSnapshot = useCallback(
    (ticker: string, strategyId: StrategyId): ScoreSnapshot | null => {
      const history = loadHistory();
      const key = ticker.toUpperCase();
      const entries = history[key]?.[strategyId];
      if (!entries || entries.length < 2) return null;

      const todayStr = today();
      return [...entries].reverse().find((e) => e.date !== todayStr) ?? null;
    },
    []
  );

  return { saveScore, saveScores, getDelta, getHistory, getPreviousSnapshot };
}

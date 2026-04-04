"use client";

import { useCallback } from "react";
import { StrategyId } from "@/lib/types";

const STORAGE_KEY = "stockscanner:score-history";
const MAX_ENTRIES_PER_STOCK = 7;

interface ScoreSnapshot {
  readonly score: number;
  readonly date: string; // ISO date (YYYY-MM-DD)
}

type ScoreHistory = Record<string, Record<StrategyId, ScoreSnapshot[]>>;

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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

function today(): string {
  return new Date().toISOString().split("T")[0];
}

export interface ScoreDelta {
  readonly current: number;
  readonly previous: number | null;
  readonly delta: number | null; // null if no previous
  readonly daysAgo: number | null;
}

export function useScoreHistory() {
  /**
   * Save a score snapshot. Deduplicates by date (one entry per day).
   */
  const saveScore = useCallback(
    (ticker: string, strategyId: StrategyId, score: number) => {
      const history = loadHistory();
      const key = ticker.toUpperCase();
      const todayStr = today();

      if (!history[key]) history[key] = {} as Record<StrategyId, ScoreSnapshot[]>;
      if (!history[key][strategyId]) history[key][strategyId] = [];

      const entries = history[key][strategyId];

      // Skip if already saved today
      if (entries.length > 0 && entries[entries.length - 1].date === todayStr) {
        // Update today's score if different
        entries[entries.length - 1] = { score, date: todayStr };
      } else {
        entries.push({ score, date: todayStr });
      }

      // Keep only last N entries
      if (entries.length > MAX_ENTRIES_PER_STOCK) {
        history[key][strategyId] = entries.slice(-MAX_ENTRIES_PER_STOCK);
      }

      saveHistory(history);
    },
    []
  );

  /**
   * Save scores for multiple stocks at once.
   */
  const saveScores = useCallback(
    (items: { ticker: string; strategyId: StrategyId; score: number }[]) => {
      const history = loadHistory();
      const todayStr = today();

      for (const { ticker, strategyId, score } of items) {
        const key = ticker.toUpperCase();
        if (!history[key]) history[key] = {} as Record<StrategyId, ScoreSnapshot[]>;
        if (!history[key][strategyId]) history[key][strategyId] = [];

        const entries = history[key][strategyId];

        if (entries.length > 0 && entries[entries.length - 1].date === todayStr) {
          entries[entries.length - 1] = { score, date: todayStr };
        } else {
          entries.push({ score, date: todayStr });
        }

        if (entries.length > MAX_ENTRIES_PER_STOCK) {
          history[key][strategyId] = entries.slice(-MAX_ENTRIES_PER_STOCK);
        }
      }

      saveHistory(history);
    },
    []
  );

  /**
   * Get the score delta for a stock.
   */
  const getDelta = useCallback(
    (ticker: string, strategyId: StrategyId, currentScore: number): ScoreDelta => {
      const history = loadHistory();
      const key = ticker.toUpperCase();
      const entries = history[key]?.[strategyId];

      if (!entries || entries.length < 2) {
        return { current: currentScore, previous: null, delta: null, daysAgo: null };
      }

      // Find the most recent entry that isn't today
      const todayStr = today();
      const previous = [...entries]
        .reverse()
        .find((e) => e.date !== todayStr);

      if (!previous) {
        return { current: currentScore, previous: null, delta: null, daysAgo: null };
      }

      const daysAgo = Math.round(
        (Date.now() - new Date(previous.date).getTime()) / (1000 * 60 * 60 * 24)
      );

      return {
        current: currentScore,
        previous: previous.score,
        delta: currentScore - previous.score,
        daysAgo,
      };
    },
    []
  );

  return { saveScore, saveScores, getDelta };
}

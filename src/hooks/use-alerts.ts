"use client";

import { useState, useEffect, useCallback } from "react";
import { StrategyId } from "@/lib/types";

const RULES_KEY = "stockscanner:alert-rules";
const TRIGGERED_KEY = "stockscanner:alert-triggered";

// --- Types ---

export type AlertRuleType = "score_above" | "score_below" | "delta_above" | "delta_below";

export interface AlertRule {
  readonly id: string;
  readonly type: AlertRuleType;
  readonly threshold: number;
  readonly strategyId: StrategyId;
  readonly ticker?: string; // undefined = applies to all stocks
  readonly label: string;
}

export interface TriggeredAlert {
  readonly ruleId: string;
  readonly ticker: string;
  readonly stockName: string;
  readonly value: number;
  readonly label: string;
  readonly type: AlertRuleType;
  readonly triggeredAt: string; // ISO date
}

// --- Default rules (active out of the box, no config needed) ---

const DEFAULT_RULES: AlertRule[] = [
  {
    id: "score-above-80",
    type: "score_above",
    threshold: 80,
    strategyId: "buffett",
    label: "Score Buffett > 80",
  },
  {
    id: "score-above-80-dividend",
    type: "score_above",
    threshold: 80,
    strategyId: "dividend",
    label: "Score Dividende > 80",
  },
  {
    id: "delta-above-5",
    type: "delta_above",
    threshold: 5,
    strategyId: "buffett",
    label: "Hausse > +5 pts (Buffett)",
  },
  {
    id: "delta-below-minus5",
    type: "delta_below",
    threshold: -5,
    strategyId: "buffett",
    label: "Baisse > -5 pts (Buffett)",
  },
];

// --- Storage ---

function loadRules(): AlertRule[] {
  if (typeof window === "undefined") return DEFAULT_RULES;
  try {
    const raw = localStorage.getItem(RULES_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_RULES;
  } catch {
    return DEFAULT_RULES;
  }
}

function saveRules(rules: AlertRule[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(RULES_KEY, JSON.stringify(rules));
}

function loadTriggered(): TriggeredAlert[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(TRIGGERED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveTriggered(alerts: TriggeredAlert[]): void {
  if (typeof window === "undefined") return;
  // Keep only last 50 alerts
  const trimmed = alerts.slice(-50);
  localStorage.setItem(TRIGGERED_KEY, JSON.stringify(trimmed));
}

// --- Evaluation ---

interface StockScore {
  readonly ticker: string;
  readonly name: string;
  readonly score: number;
  readonly delta: number | null;
  readonly strategyId: StrategyId;
}

function evaluateRule(rule: AlertRule, stock: StockScore): boolean {
  if (rule.strategyId !== stock.strategyId) return false;
  if (rule.ticker && rule.ticker !== stock.ticker) return false;

  switch (rule.type) {
    case "score_above":
      return stock.score >= rule.threshold;
    case "score_below":
      return stock.score <= rule.threshold;
    case "delta_above":
      return stock.delta !== null && stock.delta >= rule.threshold;
    case "delta_below":
      return stock.delta !== null && stock.delta <= rule.threshold;
    default:
      return false;
  }
}

// --- Hook ---

export function useAlerts() {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [triggered, setTriggered] = useState<TriggeredAlert[]>([]);

  useEffect(() => {
    setRules(loadRules());
    setTriggered(loadTriggered());
  }, []);

  const evaluate = useCallback(
    (stocks: StockScore[]): TriggeredAlert[] => {
      const currentRules = loadRules();
      const todayStr = new Date().toISOString().split("T")[0];
      const existing = loadTriggered();

      const newAlerts: TriggeredAlert[] = [];

      for (const stock of stocks) {
        for (const rule of currentRules) {
          if (!evaluateRule(rule, stock)) continue;

          // Deduplicate: one alert per rule+ticker per day
          const alreadyTriggered = existing.some(
            (a) =>
              a.ruleId === rule.id &&
              a.ticker === stock.ticker &&
              a.triggeredAt === todayStr
          );
          if (alreadyTriggered) continue;

          newAlerts.push({
            ruleId: rule.id,
            ticker: stock.ticker,
            stockName: stock.name,
            value: rule.type.startsWith("delta")
              ? (stock.delta ?? 0)
              : stock.score,
            label: rule.label,
            type: rule.type,
            triggeredAt: todayStr,
          });
        }
      }

      if (newAlerts.length > 0) {
        const updated = [...existing, ...newAlerts];
        saveTriggered(updated);
        setTriggered(updated);
      }

      return newAlerts;
    },
    []
  );

  const addRule = useCallback(
    (rule: Omit<AlertRule, "id">) => {
      const newRule: AlertRule = {
        ...rule,
        id: `custom-${Date.now()}`,
      };
      const updated = [...rules, newRule];
      setRules(updated);
      saveRules(updated);
    },
    [rules]
  );

  const removeRule = useCallback(
    (ruleId: string) => {
      const updated = rules.filter((r) => r.id !== ruleId);
      setRules(updated);
      saveRules(updated);
    },
    [rules]
  );

  const clearTriggered = useCallback(() => {
    setTriggered([]);
    saveTriggered([]);
  }, []);

  const todayAlerts = triggered.filter(
    (a) => a.triggeredAt === new Date().toISOString().split("T")[0]
  );

  return {
    rules,
    triggered,
    todayAlerts,
    evaluate,
    addRule,
    removeRule,
    clearTriggered,
    alertCount: todayAlerts.length,
  };
}

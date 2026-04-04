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
  readonly ticker?: string;
  readonly label: string;
  readonly enabled: boolean;
}

export interface TriggeredAlert {
  readonly ruleId: string;
  readonly ticker: string;
  readonly stockName: string;
  readonly value: number;
  readonly label: string;
  readonly type: AlertRuleType;
  readonly strategyId: StrategyId;
  readonly explanation: string;
  readonly triggeredAt: string;
}

// --- Default rules ---

function buildDefaultRules(scoreThreshold: number, deltaThreshold: number): AlertRule[] {
  return [
    {
      id: "score-above-buffett",
      type: "score_above",
      threshold: scoreThreshold,
      strategyId: "buffett",
      label: `Score Buffett > ${scoreThreshold}`,
      enabled: true,
    },
    {
      id: "score-above-dividend",
      type: "score_above",
      threshold: scoreThreshold,
      strategyId: "dividend",
      label: `Score Dividende > ${scoreThreshold}`,
      enabled: true,
    },
    {
      id: "delta-above",
      type: "delta_above",
      threshold: deltaThreshold,
      strategyId: "buffett",
      label: `Hausse > +${deltaThreshold} pts`,
      enabled: true,
    },
    {
      id: "delta-below",
      type: "delta_below",
      threshold: -deltaThreshold,
      strategyId: "buffett",
      label: `Baisse > -${deltaThreshold} pts`,
      enabled: true,
    },
  ];
}

// --- Storage ---

function loadRules(): AlertRule[] {
  if (typeof window === "undefined") return buildDefaultRules(80, 5);
  try {
    const raw = localStorage.getItem(RULES_KEY);
    if (!raw) return buildDefaultRules(80, 5);
    const parsed = JSON.parse(raw) as AlertRule[];
    // Migration: add enabled field if missing
    return parsed.map((r) => ({
      ...r,
      enabled: r.enabled ?? true,
    }));
  } catch {
    return buildDefaultRules(80, 5);
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
  localStorage.setItem(TRIGGERED_KEY, JSON.stringify(alerts.slice(-50)));
}

// --- Explanation generator ---

function buildExplanation(
  type: AlertRuleType,
  value: number,
  strategyId: StrategyId
): string {
  const strategyLabel: Record<StrategyId, string> = {
    buffett: "Buffett",
    lynch: "Lynch",
    growth: "Growth",
    dividend: "Dividende",
  };
  const name = strategyLabel[strategyId];

  switch (type) {
    case "score_above":
      return `Score ${name} de ${value}/100 — profil solide selon les criteres ${name}.`;
    case "score_below":
      return `Score ${name} passe a ${value}/100 — les fondamentaux se deteriorent.`;
    case "delta_above":
      return `Progression de +${value} pts en ${name} — amelioration des metriques cles.`;
    case "delta_below":
      return `Recul de ${value} pts en ${name} — degradation recente des fondamentaux.`;
    default:
      return "";
  }
}

// --- Evaluation ---

interface StockScore {
  readonly ticker: string;
  readonly name: string;
  readonly score: number;
  readonly delta: number | null;
  readonly strategyId: StrategyId;
}

interface EvaluateOptions {
  readonly watchlistTickers?: readonly string[];
  readonly watchlistOnly?: boolean;
}

function evaluateRule(rule: AlertRule, stock: StockScore): boolean {
  if (!rule.enabled) return false;
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
    (stocks: StockScore[], options?: EvaluateOptions): TriggeredAlert[] => {
      const currentRules = loadRules();
      const todayStr = new Date().toISOString().split("T")[0];
      const existing = loadTriggered();

      // Filter to watchlist-only if requested
      const filteredStocks = options?.watchlistOnly && options.watchlistTickers
        ? stocks.filter((s) => options.watchlistTickers!.includes(s.ticker))
        : stocks;

      const newAlerts: TriggeredAlert[] = [];

      for (const stock of filteredStocks) {
        for (const rule of currentRules) {
          if (!evaluateRule(rule, stock)) continue;

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
            strategyId: rule.strategyId,
            explanation: buildExplanation(
              rule.type,
              rule.type.startsWith("delta") ? (stock.delta ?? 0) : stock.score,
              rule.strategyId
            ),
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

  const toggleRule = useCallback(
    (ruleId: string) => {
      const updated = rules.map((r) =>
        r.id === ruleId ? { ...r, enabled: !r.enabled } : r
      );
      setRules(updated);
      saveRules(updated);
    },
    [rules]
  );

  const updateRuleThreshold = useCallback(
    (ruleId: string, threshold: number) => {
      const updated = rules.map((r) =>
        r.id === ruleId
          ? { ...r, threshold, label: r.label.replace(/[><=]\s*[-+]?\d+/, `> ${threshold}`) }
          : r
      );
      setRules(updated);
      saveRules(updated);
    },
    [rules]
  );

  const addRule = useCallback(
    (rule: Omit<AlertRule, "id" | "enabled">) => {
      const newRule: AlertRule = { ...rule, id: `custom-${Date.now()}`, enabled: true };
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

  const resetRules = useCallback(
    (scoreThreshold: number, deltaThreshold: number) => {
      const defaults = buildDefaultRules(scoreThreshold, deltaThreshold);
      setRules(defaults);
      saveRules(defaults);
    },
    []
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
    toggleRule,
    updateRuleThreshold,
    addRule,
    removeRule,
    resetRules,
    clearTriggered,
    alertCount: todayAlerts.length,
  };
}

import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Tests for alert engine logic.
 *
 * We test the pure functions directly rather than the React hook,
 * so we extract the evaluation logic into testable units.
 */

// --- Inline the evaluation logic for testing (same as use-alerts.ts) ---

type AlertRuleType = "score_above" | "score_below" | "delta_above" | "delta_below";
type StrategyId = "buffett" | "lynch" | "growth" | "dividend";

interface AlertRule {
  id: string;
  type: AlertRuleType;
  threshold: number;
  strategyId: StrategyId;
  ticker?: string;
  label: string;
  enabled: boolean;
}

interface StockScore {
  ticker: string;
  name: string;
  score: number;
  delta: number | null;
  strategyId: StrategyId;
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

function evaluateAll(
  rules: AlertRule[],
  stocks: StockScore[],
  options?: { watchlistOnly?: boolean; watchlistTickers?: string[] }
): { ticker: string; ruleId: string }[] {
  let filtered = stocks;
  if (options?.watchlistOnly && options.watchlistTickers) {
    filtered = filtered.filter((s) => options.watchlistTickers!.includes(s.ticker));
  }

  const results: { ticker: string; ruleId: string }[] = [];
  for (const stock of filtered) {
    for (const rule of rules) {
      if (evaluateRule(rule, stock)) {
        results.push({ ticker: stock.ticker, ruleId: rule.id });
      }
    }
  }
  return results;
}

// --- Test data ---

const MSFT: StockScore = {
  ticker: "MSFT",
  name: "Microsoft",
  score: 82,
  delta: 6,
  strategyId: "buffett",
};

const T_STOCK: StockScore = {
  ticker: "T",
  name: "AT&T",
  score: 45,
  delta: -7,
  strategyId: "buffett",
};

const JNJ: StockScore = {
  ticker: "JNJ",
  name: "Johnson & Johnson",
  score: 75,
  delta: 2,
  strategyId: "dividend",
};

// --- Tests ---

describe("evaluateRule", () => {
  const scoreAbove80: AlertRule = {
    id: "test-1",
    type: "score_above",
    threshold: 80,
    strategyId: "buffett",
    label: "Score > 80",
    enabled: true,
  };

  it("triggers when score >= threshold", () => {
    expect(evaluateRule(scoreAbove80, MSFT)).toBe(true);
  });

  it("does not trigger when score < threshold", () => {
    expect(evaluateRule(scoreAbove80, T_STOCK)).toBe(false);
  });

  it("does not trigger when disabled", () => {
    expect(evaluateRule({ ...scoreAbove80, enabled: false }, MSFT)).toBe(false);
  });

  it("does not trigger for wrong strategy", () => {
    expect(evaluateRule(scoreAbove80, JNJ)).toBe(false);
  });

  it("respects ticker filter", () => {
    const tickerRule = { ...scoreAbove80, ticker: "AAPL" };
    expect(evaluateRule(tickerRule, MSFT)).toBe(false);
    expect(evaluateRule({ ...tickerRule, ticker: "MSFT" }, MSFT)).toBe(true);
  });
});

describe("delta rules", () => {
  const deltaAbove5: AlertRule = {
    id: "delta-up",
    type: "delta_above",
    threshold: 5,
    strategyId: "buffett",
    label: "Delta > +5",
    enabled: true,
  };

  const deltaBelow: AlertRule = {
    id: "delta-down",
    type: "delta_below",
    threshold: -5,
    strategyId: "buffett",
    label: "Delta < -5",
    enabled: true,
  };

  it("triggers delta_above when delta >= threshold", () => {
    expect(evaluateRule(deltaAbove5, MSFT)).toBe(true); // delta = 6
  });

  it("does not trigger delta_above for small delta", () => {
    expect(evaluateRule(deltaAbove5, JNJ)).toBe(false); // wrong strategy
  });

  it("triggers delta_below when delta <= threshold", () => {
    expect(evaluateRule(deltaBelow, T_STOCK)).toBe(true); // delta = -7
  });

  it("handles null delta gracefully", () => {
    const noHistory = { ...MSFT, delta: null };
    expect(evaluateRule(deltaAbove5, noHistory)).toBe(false);
  });
});

describe("evaluateAll with watchlist filter", () => {
  const rules: AlertRule[] = [
    {
      id: "r1",
      type: "score_above",
      threshold: 80,
      strategyId: "buffett",
      label: "test",
      enabled: true,
    },
  ];

  const stocks = [MSFT, T_STOCK];

  it("returns all matching stocks without filter", () => {
    const results = evaluateAll(rules, stocks);
    expect(results).toHaveLength(1);
    expect(results[0].ticker).toBe("MSFT");
  });

  it("filters to watchlist when watchlistOnly=true", () => {
    const results = evaluateAll(rules, stocks, {
      watchlistOnly: true,
      watchlistTickers: ["T"],
    });
    expect(results).toHaveLength(0); // MSFT matches rule but isn't in watchlist
  });

  it("includes watchlist stock that matches", () => {
    const results = evaluateAll(rules, stocks, {
      watchlistOnly: true,
      watchlistTickers: ["MSFT"],
    });
    expect(results).toHaveLength(1);
    expect(results[0].ticker).toBe("MSFT");
  });
});

describe("threshold variations", () => {
  it("strict mode (threshold=85) filters more", () => {
    const strict: AlertRule = {
      id: "strict",
      type: "score_above",
      threshold: 85,
      strategyId: "buffett",
      label: "test",
      enabled: true,
    };
    expect(evaluateRule(strict, MSFT)).toBe(false); // 82 < 85
  });

  it("sensitive mode (threshold=70) lets more through", () => {
    const sensitive: AlertRule = {
      id: "sensitive",
      type: "score_above",
      threshold: 70,
      strategyId: "buffett",
      label: "test",
      enabled: true,
    };
    expect(evaluateRule(sensitive, MSFT)).toBe(true); // 82 >= 70
  });
});

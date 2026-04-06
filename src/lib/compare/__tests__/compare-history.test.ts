import { describe, it, expect } from "vitest";

import {
  aggregateCompareHistory,
  generateInsights,
  type TickerHistory,
  type TickerSummary,
} from "../compare-history";
import type { HistoricalScorePoint } from "@/lib/scoring/sec-historical-score";

function makePoint(
  year: number,
  buffett: number,
  dividend = 50,
  growth = 50,
  lynch = 50,
): HistoricalScorePoint {
  return {
    fiscalYear: year,
    scores: [
      {
        strategyId: "buffett",
        strategyLabel: "Warren Buffett",
        total: buffett,
        subScores: [],
        coverage: 1,
        excludedSubScores: [],
        isPartial: false,
      },
      {
        strategyId: "dividend",
        strategyLabel: "Dividende",
        total: dividend,
        subScores: [],
        coverage: 1,
        excludedSubScores: [],
        isPartial: false,
      },
      {
        strategyId: "growth",
        strategyLabel: "Growth",
        total: growth,
        subScores: [],
        coverage: 1,
        excludedSubScores: [],
        isPartial: false,
      },
      {
        strategyId: "lynch",
        strategyLabel: "Peter Lynch",
        total: lynch,
        subScores: [],
        coverage: 1,
        excludedSubScores: [],
        isPartial: false,
      },
    ],
  };
}

function makeHistory(
  ticker: string,
  yearScores: [number, number][],
): TickerHistory {
  return {
    ticker,
    companyName: `${ticker} Corp`,
    points: yearScores.map(([year, score]) => makePoint(year, score)),
    source: "test",
  };
}

describe("aggregateCompareHistory", () => {
  it("returns empty result for no histories", () => {
    const result = aggregateCompareHistory([], "buffett");
    expect(result.tickers).toEqual([]);
    expect(result.years).toEqual([]);
    expect(result.rows).toEqual([]);
  });

  it("aligns years as union across tickers", () => {
    const h1 = makeHistory("MSFT", [
      [2020, 70],
      [2021, 72],
      [2022, 75],
    ]);
    const h2 = makeHistory("AAPL", [
      [2021, 65],
      [2022, 68],
      [2023, 70],
    ]);
    const result = aggregateCompareHistory([h1, h2], "buffett");

    expect(result.years).toEqual([2020, 2021, 2022, 2023]);
    expect(result.rows).toHaveLength(4);
  });

  it("fills null for years where ticker has no data", () => {
    const h1 = makeHistory("MSFT", [
      [2020, 70],
      [2021, 72],
    ]);
    const h2 = makeHistory("AAPL", [[2021, 65]]);
    const result = aggregateCompareHistory([h1, h2], "buffett");

    // 2020: MSFT has score, AAPL does not
    const row2020 = result.rows.find((r) => r.year === 2020)!;
    expect(row2020.scores.get("MSFT")).toBe(70);
    expect(row2020.scores.get("AAPL")).toBeNull();
  });

  it("builds correct summaries", () => {
    const h1 = makeHistory("MSFT", [
      [2018, 60],
      [2019, 65],
      [2020, 70],
      [2021, 72],
      [2022, 75],
      [2023, 78],
    ]);
    const result = aggregateCompareHistory([h1], "buffett");
    const summary = result.summaries[0];

    expect(summary.ticker).toBe("MSFT");
    expect(summary.latestScore).toBe(78);
    expect(summary.oldestScore).toBe(60);
    expect(summary.totalDelta).toBe(18);
    expect(summary.trend).toBe("up");
  });

  it("computes 5-year delta", () => {
    const h1 = makeHistory("NVDA", [
      [2019, 40],
      [2020, 50],
      [2021, 55],
      [2022, 60],
      [2023, 70],
      [2024, 80],
    ]);
    const result = aggregateCompareHistory([h1], "buffett");
    const summary = result.summaries[0];

    // 5 years ago from 2024 = 2019
    expect(summary.fiveYearsAgoScore).toBe(40);
    expect(summary.fiveYearDelta).toBe(40);
  });

  it("extracts correct strategy from scores", () => {
    const h1: TickerHistory = {
      ticker: "MSFT",
      companyName: "Microsoft",
      points: [
        makePoint(2023, 70, 50, 60, 55),
        makePoint(2024, 75, 52, 65, 58),
      ],
      source: "test",
    };
    const h2: TickerHistory = {
      ticker: "AAPL",
      companyName: "Apple",
      points: [
        makePoint(2023, 65, 55, 70, 60),
        makePoint(2024, 68, 58, 72, 62),
      ],
      source: "test",
    };

    // Compare on dividend strategy
    const result = aggregateCompareHistory([h1, h2], "dividend");
    const row2024 = result.rows.find((r) => r.year === 2024)!;
    expect(row2024.scores.get("MSFT")).toBe(52);
    expect(row2024.scores.get("AAPL")).toBe(58);
  });

  it("detects downward trend", () => {
    const h1 = makeHistory("IBM", [
      [2020, 60],
      [2021, 55],
      [2022, 50],
      [2023, 45],
    ]);
    const result = aggregateCompareHistory([h1], "buffett");
    expect(result.summaries[0].trend).toBe("down");
  });

  it("detects stable trend", () => {
    const h1 = makeHistory("KO", [
      [2020, 60],
      [2021, 61],
      [2022, 59],
      [2023, 60],
    ]);
    const result = aggregateCompareHistory([h1], "buffett");
    expect(result.summaries[0].trend).toBe("stable");
  });
});

describe("generateInsights", () => {
  it("generates leader insight when gap > 5", () => {
    const summaries: TickerSummary[] = [
      {
        ticker: "MSFT",
        companyName: "Microsoft",
        latestScore: 80,
        fiveYearsAgoScore: 60,
        oldestScore: 55,
        totalDelta: 25,
        fiveYearDelta: 20,
        trend: "up",
        avgScore: 70,
        bestYear: 2024,
        worstYear: 2018,
      },
      {
        ticker: "AAPL",
        companyName: "Apple",
        latestScore: 65,
        fiveYearsAgoScore: 60,
        oldestScore: 58,
        totalDelta: 7,
        fiveYearDelta: 5,
        trend: "stable",
        avgScore: 62,
        bestYear: 2024,
        worstYear: 2018,
      },
    ];

    const insights = generateInsights(summaries, "Warren Buffett", [
      2018, 2019, 2020, 2021, 2022, 2023, 2024,
    ]);

    expect(insights.length).toBeGreaterThan(0);
    expect(insights[0]).toContain("MSFT");
    expect(insights[0]).toContain("domine");
  });

  it("generates close-race insight when gap <= 5", () => {
    const summaries: TickerSummary[] = [
      {
        ticker: "MSFT",
        companyName: "Microsoft",
        latestScore: 72,
        fiveYearsAgoScore: 70,
        oldestScore: 68,
        totalDelta: 4,
        fiveYearDelta: 2,
        trend: "stable",
        avgScore: 70,
        bestYear: 2024,
        worstYear: 2020,
      },
      {
        ticker: "AAPL",
        companyName: "Apple",
        latestScore: 70,
        fiveYearsAgoScore: 68,
        oldestScore: 66,
        totalDelta: 4,
        fiveYearDelta: 2,
        trend: "stable",
        avgScore: 68,
        bestYear: 2024,
        worstYear: 2020,
      },
    ];

    const insights = generateInsights(summaries, "Warren Buffett", [
      2020, 2021, 2022, 2023, 2024,
    ]);

    expect(insights[0]).toContain("proches");
  });

  it("returns empty for less than 2 summaries with scores", () => {
    const summaries: TickerSummary[] = [
      {
        ticker: "MSFT",
        companyName: "Microsoft",
        latestScore: 72,
        fiveYearsAgoScore: null,
        oldestScore: 72,
        totalDelta: 0,
        fiveYearDelta: null,
        trend: "stable",
        avgScore: 72,
        bestYear: 2024,
        worstYear: 2024,
      },
    ];
    const insights = generateInsights(summaries, "Warren Buffett", [2024]);
    expect(insights).toEqual([]);
  });
});

describe("edge cases", () => {
  it("handles single point per ticker", () => {
    const h1 = makeHistory("MSFT", [[2024, 75]]);
    const h2 = makeHistory("AAPL", [[2024, 70]]);
    const result = aggregateCompareHistory([h1, h2], "buffett");

    expect(result.years).toEqual([2024]);
    expect(result.summaries[0].trend).toBe("stable");
    expect(result.summaries[0].totalDelta).toBe(0);
  });

  it("handles completely non-overlapping years", () => {
    const h1 = makeHistory("MSFT", [
      [2018, 60],
      [2019, 65],
    ]);
    const h2 = makeHistory("AAPL", [
      [2022, 70],
      [2023, 72],
    ]);
    const result = aggregateCompareHistory([h1, h2], "buffett");

    expect(result.years).toEqual([2018, 2019, 2022, 2023]);
    // MSFT has null for 2022, 2023
    expect(result.rows[2].scores.get("MSFT")).toBeNull();
    // AAPL has null for 2018, 2019
    expect(result.rows[0].scores.get("AAPL")).toBeNull();
  });
});

"use client";

import { useEffect, useState } from "react";

import type { StrategyId } from "@/lib/types";
import type { HistoricalScorePoint } from "@/lib/scoring/sec-historical-score";
import type { HistoricalScoresResponse } from "@/app/api/stocks/[ticker]/historical-scores/route";

interface StrategyHistoryPanelProps {
  readonly ticker: string;
}

const STRATEGY_ORDER: readonly StrategyId[] = [
  "buffett",
  "growth",
  "lynch",
  "dividend",
];

const STRATEGY_COLORS: Record<StrategyId, string> = {
  buffett: "#6366f1",
  growth: "#10b981",
  lynch: "#f59e0b",
  dividend: "#8b5cf6",
};

function MiniSparkline({
  values,
  color,
}: {
  readonly values: readonly number[];
  readonly color: string;
}) {
  if (values.length < 2) return null;

  const min = Math.min(...values) - 5;
  const max = Math.max(...values) + 5;
  const range = max - min || 1;

  const w = 80;
  const h = 28;
  const pad = 3;

  const points = values
    .map((v, i) => {
      const x = pad + (i / (values.length - 1)) * (w - pad * 2);
      const y = pad + (h - pad * 2) - ((v - min) / range) * (h - pad * 2);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-20 h-7">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={pad + (w - pad * 2)}
        cy={pad + (h - pad * 2) - ((values[values.length - 1] - min) / range) * (h - pad * 2)}
        r={2.5}
        fill={color}
      />
    </svg>
  );
}

function ScoreBadgeSmall({ score }: { readonly score: number }) {
  const color =
    score >= 70
      ? "bg-emerald-50 text-emerald-700"
      : score >= 50
        ? "bg-indigo-50 text-indigo-700"
        : score >= 30
          ? "bg-amber-50 text-amber-700"
          : "bg-red-50 text-red-700";

  return (
    <span
      className={`inline-flex items-center justify-center rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums ${color}`}
    >
      {score}
    </span>
  );
}

function StrategyRow({
  strategyId,
  points,
}: {
  readonly strategyId: StrategyId;
  readonly points: readonly HistoricalScorePoint[];
}) {
  const color = STRATEGY_COLORS[strategyId];

  // Get coverage info from the actual last point's data
  const lastPoint = points[points.length - 1];
  const stratScore = lastPoint?.scores.find((s) => s.strategyId === strategyId);
  const coveragePercent = stratScore ? Math.round(stratScore.coverage * 100) : 0;
  const isComplete = coveragePercent === 100;
  const excluded = stratScore?.excludedSubScores ?? [];
  const label = stratScore?.strategyLabel ?? strategyId;

  const scores = points.map((p) => {
    const strategyScore = p.scores.find((s) => s.strategyId === strategyId);
    return strategyScore?.total ?? 0;
  });

  const latest = scores[scores.length - 1] ?? 0;
  const earliest = scores[0] ?? 0;
  const delta = latest - earliest;

  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-b border-slate-100 last:border-b-0">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full flex items-center gap-3 py-3 px-1 hover:bg-slate-50 transition-colors text-left"
      >
        <div
          className="w-1 h-8 rounded-full flex-shrink-0"
          style={{ backgroundColor: color }}
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-800">
            {label}
          </p>
          <p className="text-xs text-slate-400">
            {isComplete
              ? "Score complet (fondamentaux + prix)"
              : `Couverture : ${coveragePercent}% du score original`}
          </p>
        </div>
        <MiniSparkline values={scores} color={color} />
        <div className="flex items-center gap-2 flex-shrink-0">
          <ScoreBadgeSmall score={latest} />
          {points.length >= 2 && (
            <span
              className={`text-xs font-medium ${
                delta > 0
                  ? "text-emerald-600"
                  : delta < 0
                    ? "text-red-500"
                    : "text-slate-400"
              }`}
            >
              {delta > 0 ? "+" : ""}
              {delta}
            </span>
          )}
        </div>
        <svg
          className={`h-4 w-4 text-slate-400 transition-transform flex-shrink-0 ${
            expanded ? "rotate-180" : ""
          }`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m19.5 8.25-7.5 7.5-7.5-7.5"
          />
        </svg>
      </button>

      {expanded && (
        <div className="px-1 pb-3">
          {/* Annual table */}
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="py-1.5 text-left font-semibold text-slate-500">
                    Année
                  </th>
                  <th className="py-1.5 text-right font-semibold text-slate-500">
                    Score
                  </th>
                  {points[0]?.scores
                    .find((s) => s.strategyId === strategyId)
                    ?.subScores.filter((ss) => ss.available)
                    .map((ss) => (
                      <th
                        key={ss.name}
                        className="py-1.5 text-right font-semibold text-slate-500"
                      >
                        {ss.label}
                      </th>
                    ))}
                </tr>
              </thead>
              <tbody>
                {points.map((point) => {
                  const strat = point.scores.find(
                    (s) => s.strategyId === strategyId
                  );
                  if (!strat) return null;
                  return (
                    <tr
                      key={point.fiscalYear}
                      className="border-b border-slate-50 hover:bg-slate-50"
                    >
                      <td className="py-1.5 font-medium text-slate-700">
                        {point.fiscalYear}
                      </td>
                      <td className="py-1.5 text-right">
                        <ScoreBadgeSmall score={strat.total} />
                      </td>
                      {strat.subScores
                        .filter((ss) => ss.available)
                        .map((ss) => (
                          <td
                            key={ss.name}
                            className="py-1.5 text-right tabular-nums text-slate-600"
                          >
                            {ss.value}
                          </td>
                        ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Excluded sub-scores */}
          {excluded.length > 0 && (
            <div className="mt-2 text-xs text-slate-400">
              <span className="font-medium">Non inclus : </span>
              {excluded.join(" · ")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function StrategyHistoryPanel({
  ticker,
}: StrategyHistoryPanelProps) {
  const [response, setResponse] = useState<HistoricalScoresResponse | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        const res = await fetch(
          `/api/stocks/${encodeURIComponent(ticker)}/historical-scores`
        );
        if (!res.ok) {
          setResponse(null);
          return;
        }
        const json: HistoricalScoresResponse = await res.json();
        if (!cancelled) {
          setResponse(json);
        }
      } catch {
        if (!cancelled) {
          setResponse(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  if (loading) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-4">
          Historique des scores par stratégie
        </h2>
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-transparent" />
          Calcul des scores historiques...
        </div>
      </section>
    );
  }

  if (!response?.available || response.points.length < 2) {
    return null;
  }

  const { points, meta } = response;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-bold text-slate-900">
          Historique des scores par stratégie
        </h2>
      </div>
      <p className="text-xs text-slate-400 mb-4">
        Scores calculés à partir des fondamentaux historiques{" "}
        {meta.priceYears > 0
          ? "et des prix de marché (SEC/EDGAR + Yahoo Finance)."
          : "(SEC/EDGAR uniquement — données de marché indisponibles)."}
        {" "}
        {meta.priceYears > 0 && meta.priceYears < meta.secYears && (
          <span>
            Prix disponibles pour {meta.priceYears}/{meta.secYears} années.
          </span>
        )}
      </p>

      <div className="divide-y divide-slate-100">
        {STRATEGY_ORDER.map((strategyId) => (
          <StrategyRow
            key={strategyId}
            strategyId={strategyId}
            points={points}
          />
        ))}
      </div>
    </section>
  );
}

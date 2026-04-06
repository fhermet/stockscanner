"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

import type { StrategyId } from "@/lib/types";
import { isValidStrategyId } from "@/lib/strategies";
import type { HistoricalScoresResponse } from "@/app/api/stocks/[ticker]/historical-scores/route";
import {
  aggregateCompareHistory,
  type TickerHistory,
  type CompareHistoryResult,
  type TickerSummary,
} from "@/lib/compare/compare-history";
import { VOLATILITY_COLORS } from "@/lib/scoring/score-volatility";
import HistoryChart from "@/components/history-chart";

const MAX_TICKERS = 4;

const STRATEGY_OPTIONS: { id: StrategyId; label: string }[] = [
  { id: "buffett", label: "Buffett" },
  { id: "lynch", label: "Lynch" },
  { id: "growth", label: "Growth" },
  { id: "dividend", label: "Dividende" },
];

const TREND_ICONS: Record<string, string> = {
  up: "↑",
  down: "↓",
  stable: "→",
};

const TREND_COLORS: Record<string, string> = {
  up: "text-emerald-600",
  down: "text-red-500",
  stable: "text-slate-400",
};

function CompareHistoryContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tickersParam = searchParams.get("tickers") ?? "";
  const strategyParam = searchParams.get("strategy") ?? "buffett";

  const [tickers, setTickers] = useState<string[]>(
    tickersParam
      ? tickersParam
          .split(",")
          .map((t) => t.trim().toUpperCase())
          .filter(Boolean)
          .slice(0, MAX_TICKERS)
      : [],
  );
  const [strategyId, setStrategyId] = useState<StrategyId>(
    isValidStrategyId(strategyParam) ? strategyParam : "buffett",
  );
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [failedTickers, setFailedTickers] = useState<string[]>([]);
  const [result, setResult] = useState<CompareHistoryResult | null>(null);
  const [smoothed, setSmoothed] = useState(false);

  const updateUrl = useCallback(
    (newTickers: string[], newStrategy: StrategyId) => {
      const params = new URLSearchParams();
      if (newTickers.length > 0) params.set("tickers", newTickers.join(","));
      params.set("strategy", newStrategy);
      router.replace(`/compare/history?${params.toString()}`);
    },
    [router],
  );

  const addTicker = () => {
    const ticker = inputValue.trim().toUpperCase();
    if (!ticker || tickers.includes(ticker) || tickers.length >= MAX_TICKERS)
      return;
    const newTickers = [...tickers, ticker];
    setTickers(newTickers);
    setInputValue("");
    updateUrl(newTickers, strategyId);
  };

  const removeTicker = (ticker: string) => {
    const newTickers = tickers.filter((t) => t !== ticker);
    setTickers(newTickers);
    updateUrl(newTickers, strategyId);
  };

  const changeStrategy = (id: StrategyId) => {
    setStrategyId(id);
    updateUrl(tickers, id);
  };

  useEffect(() => {
    if (tickers.length < 2) {
      setResult(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setFailedTickers([]);

    async function fetchAll() {
      const histories: TickerHistory[] = [];
      const failed: string[] = [];

      const responses = await Promise.allSettled(
        tickers.map(async (ticker) => {
          const res = await fetch(
            `/api/stocks/${encodeURIComponent(ticker)}/historical-scores`,
          );
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const json: HistoricalScoresResponse = await res.json();
          return { ticker, json };
        }),
      );

      for (const resp of responses) {
        if (resp.status === "fulfilled") {
          const { ticker, json } = resp.value;
          if (json.available && json.points.length > 0) {
            histories.push({
              ticker,
              companyName: json.companyName,
              points: json.points,
              source: json.meta.source,
            });
          } else {
            failed.push(ticker);
          }
        } else {
          // Extract ticker from the promise
          const tickerMatch = tickers.find(
            (t) => !histories.some((h) => h.ticker === t) && !failed.includes(t),
          );
          if (tickerMatch) failed.push(tickerMatch);
        }
      }

      if (!cancelled) {
        setFailedTickers(failed);
        if (histories.length >= 2) {
          setResult(aggregateCompareHistory(histories, strategyId));
        } else {
          setResult(null);
        }
        setLoading(false);
      }
    }

    fetchAll();
    return () => {
      cancelled = true;
    };
  }, [tickers, strategyId]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-4">
          <Link
            href="/scanner"
            className="hover:text-slate-900 transition-colors"
          >
            Scanner
          </Link>
          <span>/</span>
          <Link
            href="/compare"
            className="hover:text-slate-900 transition-colors"
          >
            Comparer
          </Link>
          <span>/</span>
          <span className="text-slate-900 font-medium">
            Historique des scores
          </span>
        </div>
        <h1 className="text-2xl font-extrabold text-slate-900">
          Comparateur historique
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Comparez l&apos;évolution des scores de 2 à 4 actions sur une
          stratégie donnée.
        </p>
      </div>

      {/* Ticker input */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 mb-6">
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            placeholder="Ajouter un ticker (ex: AAPL)"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && addTicker()}
            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none"
            maxLength={10}
          />
          <button
            onClick={addTicker}
            disabled={
              !inputValue.trim() ||
              tickers.includes(inputValue.trim().toUpperCase()) ||
              tickers.length >= MAX_TICKERS
            }
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Ajouter
          </button>
        </div>

        {/* Ticker pills */}
        <div className="flex flex-wrap gap-2 mb-4">
          {tickers.map((ticker) => (
            <span
              key={ticker}
              className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700"
            >
              {ticker}
              <button
                aria-label={`Retirer ${ticker}`}
                onClick={() => removeTicker(ticker)}
                className="text-slate-400 hover:text-red-500 transition-colors"
              >
                &times;
              </button>
            </span>
          ))}
          {tickers.length === 0 && (
            <span className="text-sm text-slate-400 italic">
              Ajoutez au moins 2 tickers pour comparer
            </span>
          )}
        </div>

        {/* Strategy selector */}
        <div className="flex flex-wrap gap-2">
          {STRATEGY_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => changeStrategy(opt.id)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                strategyId === opt.id
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Failed tickers */}
      {failedTickers.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 mb-6 text-sm text-amber-700">
          Données indisponibles pour : {failedTickers.join(", ")}
        </div>
      )}

      {/* Empty state */}
      {tickers.length < 2 && !loading && (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
          <p className="text-slate-500">
            Sélectionnez au moins 2 actions pour afficher la comparaison
            historique.
          </p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
          <div className="inline-flex items-center gap-2 text-sm text-slate-400">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-transparent" />
            Chargement des scores historiques...
          </div>
        </div>
      )}

      {/* Results */}
      {!loading && result && (
        <div className="space-y-6">
          {/* Chart */}
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">
                Évolution du score {result.strategyLabel}
              </h2>
              <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-0.5">
                <button
                  onClick={() => setSmoothed(false)}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                    !smoothed
                      ? "bg-white text-slate-800 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  Score brut
                </button>
                <button
                  onClick={() => setSmoothed(true)}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                    smoothed
                      ? "bg-white text-slate-800 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  Score lissé
                </button>
              </div>
            </div>
            <HistoryChart
              years={result.years}
              rows={result.rows}
              tickers={result.tickers}
              smoothed={smoothed}
            />
            {result.isPartial && (
              <p className="text-xs text-slate-400 mt-3">
                Certaines années utilisent un scoring partiel (données de marché
                indisponibles).
              </p>
            )}
            {/* Strategy nature info */}
            <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${VOLATILITY_COLORS[result.strategyNature.expectedVolatility].bg} ${VOLATILITY_COLORS[result.strategyNature.expectedVolatility].text}`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${VOLATILITY_COLORS[result.strategyNature.expectedVolatility].dot}`}
                />
                {result.strategyNature.label}
              </span>
              <span>{result.strategyNature.explanation}</span>
            </div>
          </section>

          {/* Insights */}
          {result.insights.length > 0 && (
            <section className="rounded-xl border border-indigo-100 bg-indigo-50 p-6">
              <h2 className="text-sm font-semibold text-indigo-800 mb-3">
                Points clés
              </h2>
              <ul className="space-y-1.5">
                {result.insights.map((insight, i) => (
                  <li
                    key={i}
                    className="text-sm text-indigo-700 flex items-start gap-2"
                  >
                    <span className="text-indigo-400 mt-0.5">•</span>
                    {insight}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Synthesis table */}
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">
              Synthèse
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[500px]">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="py-2 text-left text-xs font-semibold text-slate-500 uppercase">
                      Action
                    </th>
                    <th className="py-2 text-center text-xs font-semibold text-slate-500 uppercase">
                      Dernier score
                    </th>
                    <th className="py-2 text-center text-xs font-semibold text-slate-500 uppercase">
                      Il y a 5 ans
                    </th>
                    <th className="py-2 text-center text-xs font-semibold text-slate-500 uppercase">
                      Variation 5 ans
                    </th>
                    <th className="py-2 text-center text-xs font-semibold text-slate-500 uppercase">
                      Variation totale
                    </th>
                    <th className="py-2 text-center text-xs font-semibold text-slate-500 uppercase">
                      Tendance
                    </th>
                    <th className="py-2 text-center text-xs font-semibold text-slate-500 uppercase">
                      Moyenne
                    </th>
                    <th className="py-2 text-center text-xs font-semibold text-slate-500 uppercase">
                      Volatilité
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {result.summaries.map((s) => (
                    <SummaryRow key={s.ticker} summary={s} allSummaries={result.summaries} />
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Source */}
          <p className="text-xs text-slate-400 text-center">
            Scores calculés à partir des fondamentaux SEC/EDGAR et des prix
            historiques Yahoo Finance. Le PEG est une approximation basée sur la
            croissance BPA annuelle.
          </p>
        </div>
      )}
    </div>
  );
}

function SummaryRow({
  summary: s,
  allSummaries,
}: {
  readonly summary: TickerSummary;
  readonly allSummaries: readonly TickerSummary[];
}) {
  const bestLatest = allSummaries.reduce((a, b) =>
    (b.latestScore ?? 0) > (a.latestScore ?? 0) ? b : a,
  );
  const isBest = s.ticker === bestLatest.ticker && s.latestScore !== null;

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
      <td className="py-2.5 font-medium text-slate-800">
        <Link
          href={`/stocks/${s.ticker}?strategy=buffett`}
          className="hover:text-indigo-600 transition-colors"
        >
          {s.ticker}
        </Link>
        {isBest && (
          <span className="ml-1.5 inline-flex items-center rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
            Leader
          </span>
        )}
      </td>
      <td className="py-2.5 text-center">
        {s.latestScore !== null ? (
          <ScoreBadgeInline score={s.latestScore} />
        ) : (
          <span className="text-slate-300">N/A</span>
        )}
      </td>
      <td className="py-2.5 text-center tabular-nums text-slate-600">
        {s.fiveYearsAgoScore !== null ? s.fiveYearsAgoScore : "—"}
      </td>
      <td className="py-2.5 text-center tabular-nums">
        <DeltaBadge value={s.fiveYearDelta} />
      </td>
      <td className="py-2.5 text-center tabular-nums">
        <DeltaBadge value={s.totalDelta} />
      </td>
      <td className="py-2.5 text-center">
        <span className={`font-medium ${TREND_COLORS[s.trend]}`}>
          {TREND_ICONS[s.trend]}
        </span>
      </td>
      <td className="py-2.5 text-center tabular-nums text-slate-600">
        {s.avgScore}
      </td>
      <td className="py-2.5 text-center">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${VOLATILITY_COLORS[s.volatility.level].bg} ${VOLATILITY_COLORS[s.volatility.level].text}`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${VOLATILITY_COLORS[s.volatility.level].dot}`}
          />
          {s.volatility.label}
        </span>
      </td>
    </tr>
  );
}

function ScoreBadgeInline({ score }: { readonly score: number }) {
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

function DeltaBadge({ value }: { readonly value: number | null }) {
  if (value === null) return <span className="text-slate-300">—</span>;
  const color =
    value > 0 ? "text-emerald-600" : value < 0 ? "text-red-500" : "text-slate-400";
  return (
    <span className={`text-xs font-medium ${color}`}>
      {value > 0 ? "+" : ""}
      {value}
    </span>
  );
}

export default function CompareHistoryPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-5xl px-4 py-8">
          <h1 className="text-2xl font-extrabold text-slate-900">
            Comparateur historique
          </h1>
        </div>
      }
    >
      <CompareHistoryContent />
    </Suspense>
  );
}

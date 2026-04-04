"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ScoredStock, StrategyId } from "@/lib/types";
import { isValidStrategyId } from "@/lib/strategies";
import { compareStocks, ComparisonResult, ComparedMetric } from "@/lib/scoring/compare";
import ScoreBadge from "@/components/ui/score-badge";
import ScoreGauge from "@/components/ui/score-gauge";
import { formatPrice, formatMarketCap } from "@/lib/format";

const MAX_TICKERS = 4;

const STRATEGY_OPTIONS: { id: StrategyId; label: string }[] = [
  { id: "buffett", label: "Buffett" },
  { id: "lynch", label: "Lynch" },
  { id: "growth", label: "Growth" },
  { id: "dividend", label: "Dividende" },
];

function CellHighlight({
  ticker,
  best,
  worst,
  children,
}: {
  ticker: string;
  best: string;
  worst: string;
  children: React.ReactNode;
}) {
  const isBest = ticker === best;
  const isWorst = ticker === worst && best !== worst;
  return (
    <td
      className={`px-4 py-2.5 text-center text-sm font-medium ${
        isBest
          ? "bg-emerald-50 text-emerald-700"
          : isWorst
            ? "bg-red-50 text-red-500"
            : "text-slate-700"
      }`}
    >
      {children}
    </td>
  );
}

function ComparisonTable({
  title,
  metrics,
  tickers,
}: {
  title: string;
  metrics: readonly ComparedMetric[];
  tickers: readonly string[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200">
            <th className="py-2 text-left text-xs font-semibold text-slate-500 uppercase">
              {title}
            </th>
            {tickers.map((t) => (
              <th
                key={t}
                className="py-2 text-center text-xs font-semibold text-slate-700"
              >
                {t}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {metrics.map((m) => (
            <tr key={m.key} className="border-b border-slate-100">
              <td className="py-2.5 text-sm text-slate-600">{m.label}</td>
              {m.values.map((v) => (
                <CellHighlight
                  key={v.ticker}
                  ticker={v.ticker}
                  best={m.bestTicker}
                  worst={m.worstTicker}
                >
                  {v.formatted}
                </CellHighlight>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CompareContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const tickersParam = searchParams.get("tickers") ?? "";
  const strategyParam = searchParams.get("strategy") ?? "buffett";

  const [tickers, setTickers] = useState<string[]>(
    tickersParam ? tickersParam.split(",").slice(0, MAX_TICKERS) : []
  );
  const [strategyId, setStrategyId] = useState<StrategyId>(
    isValidStrategyId(strategyParam) ? strategyParam : "buffett"
  );
  const [input, setInput] = useState("");
  const [stocks, setStocks] = useState<ScoredStock[]>([]);
  const [comparison, setComparison] = useState<ComparisonResult | null>(null);
  const [loading, setLoading] = useState(false);

  const updateUrl = useCallback(
    (t: string[], s: StrategyId) => {
      if (t.length > 0) {
        router.push(`/compare?tickers=${t.join(",")}&strategy=${s}`, { scroll: false });
      }
    },
    [router]
  );

  const fetchStocks = useCallback(async () => {
    if (tickers.length < 2) {
      setStocks([]);
      setComparison(null);
      return;
    }

    setLoading(true);
    const results: ScoredStock[] = [];

    for (const ticker of tickers) {
      try {
        const res = await fetch(
          `/api/stocks/${encodeURIComponent(ticker)}?strategy=${strategyId}`
        );
        if (!res.ok) continue;
        const data = await res.json();
        results.push({ stock: data.stock, score: data.score });
      } catch {
        // Skip failed
      }
    }

    setStocks(results);
    if (results.length >= 2) {
      setComparison(compareStocks(results, strategyId));
    }
    setLoading(false);
  }, [tickers, strategyId]);

  useEffect(() => {
    fetchStocks();
  }, [fetchStocks]);

  const addTicker = () => {
    const t = input.trim().toUpperCase();
    if (!t || tickers.includes(t) || tickers.length >= MAX_TICKERS) return;
    const next = [...tickers, t];
    setTickers(next);
    setInput("");
    updateUrl(next, strategyId);
  };

  const removeTicker = (t: string) => {
    const next = tickers.filter((x) => x !== t);
    setTickers(next);
    updateUrl(next, strategyId);
  };

  const handleStrategyChange = (id: StrategyId) => {
    setStrategyId(id);
    updateUrl(tickers, id);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900 mb-1">Comparateur</h1>
      <p className="text-sm text-slate-500 mb-6">
        Comparez 2 a 4 actions selon une strategie
      </p>

      {/* Ticker input */}
      <div className="mb-4 flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addTicker()}
          placeholder="Ajouter un ticker (ex: AAPL)"
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none w-48"
          disabled={tickers.length >= MAX_TICKERS}
        />
        <button
          onClick={addTicker}
          disabled={!input.trim() || tickers.length >= MAX_TICKERS}
          className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
        >
          Ajouter
        </button>
      </div>

      {/* Selected tickers */}
      <div className="mb-4 flex flex-wrap gap-2">
        {tickers.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-sm font-medium text-slate-700"
          >
            {t}
            <button
              onClick={() => removeTicker(t)}
              className="ml-1 text-slate-400 hover:text-red-500"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </span>
        ))}
        {tickers.length < 2 && (
          <span className="text-xs text-slate-400 self-center">
            Ajoutez au moins 2 tickers
          </span>
        )}
      </div>

      {/* Strategy */}
      <div className="mb-6 flex flex-wrap gap-2">
        {STRATEGY_OPTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => handleStrategyChange(s.id)}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-all ${
              strategyId === s.id
                ? "border-brand-300 bg-brand-50 text-brand-700"
                : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600" />
        </div>
      )}

      {/* Comparison results */}
      {comparison && !loading && (
        <div className="space-y-8">
          {/* Summary */}
          <div className="rounded-xl border border-brand-200 bg-brand-50 p-5">
            <h2 className="text-sm font-semibold text-brand-900 mb-2">
              Qui gagne ?
            </h2>
            <p className="text-sm leading-relaxed text-brand-800">
              {comparison.summary}
            </p>
          </div>

          {/* Score overview */}
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">
              Scores
            </h2>
            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${stocks.length}, 1fr)` }}>
              {stocks
                .sort((a, b) => b.score.total - a.score.total)
                .map((s, i) => (
                  <Link
                    key={s.stock.ticker}
                    href={`/stocks/${s.stock.ticker}?strategy=${strategyId}`}
                    className={`rounded-xl border p-4 text-center transition-all hover:shadow-md ${
                      i === 0
                        ? "border-emerald-200 bg-emerald-50/50"
                        : "border-slate-200"
                    }`}
                  >
                    {i === 0 && (
                      <span className="text-[10px] font-bold uppercase text-emerald-600 tracking-wider">
                        Meilleur
                      </span>
                    )}
                    <h3 className="text-lg font-bold text-slate-900">
                      {s.stock.ticker}
                    </h3>
                    <p className="text-xs text-slate-500 truncate">{s.stock.name}</p>
                    <div className="mt-2">
                      <ScoreBadge score={s.score.total} size="md" />
                    </div>
                    <p className="mt-2 text-xs text-slate-400">
                      {formatPrice(s.stock.price, s.stock.currency)} &middot;{" "}
                      {formatMarketCap(s.stock.marketCap, s.stock.currency)}
                    </p>
                  </Link>
                ))}
            </div>
          </div>

          {/* Sub-scores comparison */}
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">
              Sous-scores
            </h2>
            <ComparisonTable
              title="Axe"
              metrics={comparison.subScoreComparison}
              tickers={stocks.map((s) => s.stock.ticker)}
            />
          </div>

          {/* Key metrics */}
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">
              Metriques cles
            </h2>
            <ComparisonTable
              title="Metrique"
              metrics={comparison.metricComparison}
              tickers={stocks.map((s) => s.stock.ticker)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-brand-600" />
        </div>
      }
    >
      <CompareContent />
    </Suspense>
  );
}

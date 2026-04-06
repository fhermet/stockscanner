"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

import type { StrategyId } from "@/lib/types";
import { isValidStrategyId } from "@/lib/strategies";
import type { BacktestResponse } from "@/app/api/backtest/route";
import type { BacktestResult, BacktestStock } from "@/lib/backtest/backtest-engine";

const STRATEGY_OPTIONS: { id: StrategyId; label: string }[] = [
  { id: "buffett", label: "Warren Buffett" },
  { id: "lynch", label: "Peter Lynch" },
  { id: "growth", label: "Growth" },
  { id: "dividend", label: "Dividende" },
];

const TOP_N_OPTIONS = [3, 5, 10];

function ReturnBadge({ value }: { readonly value: number }) {
  const color =
    value > 0
      ? "bg-emerald-50 text-emerald-700"
      : value < 0
        ? "bg-red-50 text-red-600"
        : "bg-slate-100 text-slate-600";
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-sm font-semibold tabular-nums ${color}`}>
      {value > 0 ? "+" : ""}{value}%
    </span>
  );
}

function ResultChart({ result }: { readonly result: BacktestResult }) {
  const maxReturn = Math.max(
    ...result.stocks.map((s) => Math.abs(s.returnPct)),
    Math.abs(result.benchmarkReturnPct ?? 0),
  );
  const scale = maxReturn > 0 ? 100 / maxReturn : 1;

  return (
    <div className="space-y-2">
      {result.stocks.map((stock) => (
        <div key={stock.ticker} className="flex items-center gap-3">
          <Link
            href={`/stocks/${stock.ticker}`}
            className="w-16 text-sm font-medium text-slate-700 hover:text-brand-600 transition-colors shrink-0"
          >
            {stock.ticker}
          </Link>
          <div className="flex-1 flex items-center h-7">
            {stock.returnPct >= 0 ? (
              <div
                className="h-5 rounded-r bg-emerald-400"
                style={{ width: `${Math.max(stock.returnPct * scale, 2)}%` }}
              />
            ) : (
              <div className="flex-1 flex justify-end">
                <div
                  className="h-5 rounded-l bg-red-400"
                  style={{ width: `${Math.max(Math.abs(stock.returnPct) * scale, 2)}%` }}
                />
              </div>
            )}
          </div>
          <span className={`w-20 text-right text-sm font-semibold tabular-nums ${stock.returnPct >= 0 ? "text-emerald-600" : "text-red-500"}`}>
            {stock.returnPct > 0 ? "+" : ""}{stock.returnPct}%
          </span>
        </div>
      ))}
      {/* Benchmark */}
      {result.benchmarkReturnPct !== null && (
        <div className="flex items-center gap-3 pt-2 border-t border-slate-200">
          <span className="w-16 text-sm font-medium text-slate-500 shrink-0">
            S&P 500
          </span>
          <div className="flex-1 flex items-center h-7">
            {result.benchmarkReturnPct >= 0 ? (
              <div
                className="h-5 rounded-r bg-slate-300"
                style={{ width: `${Math.max(result.benchmarkReturnPct * scale, 2)}%` }}
              />
            ) : (
              <div className="flex-1 flex justify-end">
                <div
                  className="h-5 rounded-l bg-slate-300"
                  style={{ width: `${Math.max(Math.abs(result.benchmarkReturnPct) * scale, 2)}%` }}
                />
              </div>
            )}
          </div>
          <span className={`w-20 text-right text-sm font-semibold tabular-nums ${result.benchmarkReturnPct >= 0 ? "text-slate-600" : "text-red-500"}`}>
            {result.benchmarkReturnPct > 0 ? "+" : ""}{result.benchmarkReturnPct}%
          </span>
        </div>
      )}
    </div>
  );
}

function BacktestContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [strategyId, setStrategyId] = useState<StrategyId>(
    isValidStrategyId(searchParams.get("strategy") ?? "")
      ? (searchParams.get("strategy") as StrategyId)
      : "buffett",
  );
  const [startYear, setStartYear] = useState<number>(
    parseInt(searchParams.get("startYear") ?? "2018", 10) || 2018,
  );
  const [topN, setTopN] = useState<number>(
    parseInt(searchParams.get("topN") ?? "5", 10) || 5,
  );
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<BacktestResponse | null>(null);

  function updateUrl(s: StrategyId, y: number, n: number) {
    router.replace(`/backtest?strategy=${s}&startYear=${y}&topN=${n}`);
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    async function fetchBacktest() {
      try {
        const res = await fetch(
          `/api/backtest?strategy=${strategyId}&startYear=${startYear}&topN=${topN}`,
        );
        const json: BacktestResponse = await res.json();
        if (!cancelled) setResponse(json);
      } catch {
        if (!cancelled) setResponse(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchBacktest();
    return () => { cancelled = true; };
  }, [strategyId, startYear, topN]);

  const availableYears = response?.availableYears ?? [];
  const result = response?.result ?? null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-4">
          <Link href="/scanner" className="hover:text-slate-900 transition-colors">
            Scanner
          </Link>
          <span>/</span>
          <span className="text-slate-900 font-medium">Backtest</span>
        </div>
        <h1 className="text-2xl font-extrabold text-slate-900">
          Si j&apos;avais investi...
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Simulez les performances d&apos;un portefeuille basé sur les meilleures
          actions d&apos;une stratégie à une date passée.
        </p>
      </div>

      {/* Controls */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 mb-6">
        <div className="grid gap-4 sm:grid-cols-3">
          {/* Strategy */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Stratégie
            </label>
            <div className="flex flex-wrap gap-1.5">
              {STRATEGY_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => { setStrategyId(opt.id); updateUrl(opt.id, startYear, topN); }}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    strategyId === opt.id
                      ? "bg-brand-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Start year */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Année de départ
            </label>
            <select
              value={startYear}
              onChange={(e) => { const y = parseInt(e.target.value, 10); setStartYear(y); updateUrl(strategyId, y, topN); }}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
            >
              {availableYears.length > 0
                ? availableYears.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))
                : (
                    <option value={startYear}>{startYear}</option>
                  )
              }
            </select>
          </div>

          {/* Top N */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Nombre d&apos;actions
            </label>
            <div className="flex gap-1.5">
              {TOP_N_OPTIONS.map((n) => (
                <button
                  key={n}
                  onClick={() => { setTopN(n); updateUrl(strategyId, startYear, n); }}
                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    topN === n
                      ? "bg-brand-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  Top {n}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
          <div className="inline-flex items-center gap-2 text-sm text-slate-400">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-transparent" />
            Simulation en cours...
          </div>
        </div>
      )}

      {/* Error */}
      {!loading && response?.error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
          {response.error}
        </div>
      )}

      {/* Results */}
      {!loading && result && result.stocks.length > 0 && (
        <div className="space-y-6">
          {/* Summary */}
          <section className={`rounded-xl border p-6 ${
            (result.outperformance ?? 0) >= 0
              ? "border-emerald-200 bg-emerald-50"
              : "border-red-200 bg-red-50"
          }`}>
            <p className={`text-sm leading-relaxed font-medium ${
              (result.outperformance ?? 0) >= 0 ? "text-emerald-800" : "text-red-800"
            }`}>
              {result.summary}
            </p>
          </section>

          {/* Key numbers */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-5 text-center">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">
                Portefeuille
              </p>
              <ReturnBadge value={result.portfolioReturnPct} />
              <p className="text-xs text-slate-400 mt-1">
                {result.startYear} → {result.endYear}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 text-center">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">
                S&P 500
              </p>
              {result.benchmarkReturnPct !== null ? (
                <ReturnBadge value={result.benchmarkReturnPct} />
              ) : (
                <span className="text-sm text-slate-300">N/A</span>
              )}
              <p className="text-xs text-slate-400 mt-1">
                Benchmark
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 text-center">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">
                Surperformance
              </p>
              {result.outperformance !== null ? (
                <span className={`text-lg font-bold tabular-nums ${result.outperformance >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                  {result.outperformance > 0 ? "+" : ""}{result.outperformance} pts
                </span>
              ) : (
                <span className="text-sm text-slate-300">N/A</span>
              )}
            </div>
          </div>

          {/* Chart */}
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">
              Rendement par action
            </h2>
            <ResultChart result={result} />
          </section>

          {/* Detail table */}
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">
              Détail du portefeuille
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[500px]">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="py-2 text-left text-xs font-semibold text-slate-500 uppercase">Action</th>
                    <th className="py-2 text-center text-xs font-semibold text-slate-500 uppercase">Score {result.startYear}</th>
                    <th className="py-2 text-right text-xs font-semibold text-slate-500 uppercase">Prix {result.startYear}</th>
                    <th className="py-2 text-right text-xs font-semibold text-slate-500 uppercase">Prix {result.endYear}</th>
                    <th className="py-2 text-right text-xs font-semibold text-slate-500 uppercase">Rendement</th>
                  </tr>
                </thead>
                <tbody>
                  {result.stocks.map((stock) => (
                    <tr key={stock.ticker} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="py-2.5">
                        <Link
                          href={`/stocks/${stock.ticker}`}
                          className="font-medium text-slate-800 hover:text-brand-600 transition-colors"
                        >
                          {stock.ticker}
                        </Link>
                        <span className="block text-xs text-slate-400 truncate max-w-[180px]">
                          {stock.companyName}
                        </span>
                      </td>
                      <td className="py-2.5 text-center">
                        <span className="inline-flex items-center justify-center rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700 tabular-nums">
                          {stock.scoreAtStart}
                        </span>
                      </td>
                      <td className="py-2.5 text-right tabular-nums text-slate-600">
                        ${stock.priceAtStart.toFixed(2)}
                      </td>
                      <td className="py-2.5 text-right tabular-nums text-slate-600">
                        ${stock.priceAtEnd.toFixed(2)}
                      </td>
                      <td className="py-2.5 text-right">
                        <span className={`font-semibold tabular-nums ${stock.returnPct >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                          {stock.returnPct > 0 ? "+" : ""}{stock.returnPct}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Disclaimer */}
          {result.disclaimer && (
            <p className="text-xs text-slate-400 leading-relaxed">
              {result.disclaimer}
            </p>
          )}
        </div>
      )}

      {/* Empty state */}
      {!loading && result && result.stocks.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
          <p className="text-slate-500">{result.summary}</p>
        </div>
      )}
    </div>
  );
}

export default function BacktestPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-4xl px-4 py-8">
          <h1 className="text-2xl font-extrabold text-slate-900">
            Si j&apos;avais investi...
          </h1>
        </div>
      }
    >
      <BacktestContent />
    </Suspense>
  );
}

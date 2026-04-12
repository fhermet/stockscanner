"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

import type { StrategyId } from "@/lib/types";
import { isValidStrategyId } from "@/lib/strategies";
import type { BacktestResponse } from "@/app/api/backtest/route";
import type { BacktestResult, RollingBacktestResult, AnnualSlice } from "@/lib/backtest/backtest-engine";

const STRATEGY_OPTIONS: { id: StrategyId; label: string }[] = [
  { id: "buffett", label: "Warren Buffett" },
  { id: "lynch", label: "Peter Lynch" },
  { id: "growth", label: "Growth" },
  { id: "dividend", label: "Dividende" },
];

const TOP_N_OPTIONS = [3, 5, 10];

type BacktestMode = "single" | "rolling";

// --- Shared components ---

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

function MetricCard({
  label,
  value,
  sub,
  color,
}: {
  readonly label: string;
  readonly value: string;
  readonly sub?: string;
  readonly color?: "green" | "red" | "neutral";
}) {
  const textColor =
    color === "green" ? "text-emerald-600"
      : color === "red" ? "text-red-500"
        : "text-slate-800";
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 text-center">
      <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-lg font-bold tabular-nums ${textColor}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

// --- Single-year result display ---

function SingleYearChart({ result }: { readonly result: BacktestResult }) {
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
      {result.benchmarkReturnPct !== null && (
        <div className="flex items-center gap-3 pt-2 border-t border-slate-200">
          <span className="w-16 text-sm font-medium text-slate-500 shrink-0">S&P 500</span>
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

function SingleYearResults({ result }: { readonly result: BacktestResult }) {
  if (result.stocks.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
        <p className="text-slate-500">{result.summary}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard
          label="Portefeuille"
          value={`${result.portfolioReturnPct > 0 ? "+" : ""}${result.portfolioReturnPct}%`}
          sub={`${result.startYear} → ${result.endYear}`}
          color={result.portfolioReturnPct >= 0 ? "green" : "red"}
        />
        <MetricCard
          label="S&P 500"
          value={result.benchmarkReturnPct !== null
            ? `${result.benchmarkReturnPct > 0 ? "+" : ""}${result.benchmarkReturnPct}%`
            : "N/A"}
          sub="Benchmark"
        />
        <MetricCard
          label="Surperformance"
          value={result.outperformance !== null
            ? `${result.outperformance > 0 ? "+" : ""}${result.outperformance} pts`
            : "N/A"}
          color={result.outperformance !== null
            ? result.outperformance >= 0 ? "green" : "red"
            : "neutral"}
        />
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Rendement par action</h2>
        <SingleYearChart result={result} />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Détail du portefeuille</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="py-2 text-left text-xs font-semibold text-slate-500 uppercase">Action</th>
                <th className="py-2 text-center text-xs font-semibold text-slate-500 uppercase hidden sm:table-cell">Score</th>
                <th className="py-2 text-right text-xs font-semibold text-slate-500 uppercase hidden sm:table-cell">Prix {result.startYear}</th>
                <th className="py-2 text-right text-xs font-semibold text-slate-500 uppercase hidden sm:table-cell">Prix {result.endYear}</th>
                <th className="py-2 text-right text-xs font-semibold text-slate-500 uppercase">Rendement</th>
              </tr>
            </thead>
            <tbody>
              {result.stocks.map((stock) => (
                <tr key={stock.ticker} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="py-2.5">
                    <Link href={`/stocks/${stock.ticker}`} className="font-medium text-slate-800 hover:text-brand-600 transition-colors">
                      {stock.ticker}
                    </Link>
                    <span className="block text-xs text-slate-400 truncate max-w-[180px]">{stock.companyName}</span>
                  </td>
                  <td className="py-2.5 text-center hidden sm:table-cell">
                    <span className="inline-flex items-center justify-center rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700 tabular-nums">
                      {stock.scoreAtStart}
                    </span>
                  </td>
                  <td className="py-2.5 text-right tabular-nums text-slate-600 hidden sm:table-cell">${stock.priceAtStart.toFixed(2)}</td>
                  <td className="py-2.5 text-right tabular-nums text-slate-600 hidden sm:table-cell">${stock.priceAtEnd.toFixed(2)}</td>
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

      {result.disclaimer && (
        <p className="text-xs text-slate-400 leading-relaxed">{result.disclaimer}</p>
      )}
    </div>
  );
}

// --- Rolling backtest display ---

function EquityCurve({ slices }: { readonly slices: readonly AnnualSlice[] }) {
  // Build equity curve data (base 100)
  const portfolioPoints: { year: number; value: number }[] = [];
  const benchmarkPoints: { year: number; value: number }[] = [];

  let pEquity = 100;
  let bEquity = 100;

  portfolioPoints.push({ year: slices[0].year, value: 100 });
  benchmarkPoints.push({ year: slices[0].year, value: 100 });

  for (const s of slices) {
    pEquity *= 1 + s.portfolioReturnPct / 100;
    portfolioPoints.push({ year: s.year + 1, value: Math.round(pEquity * 10) / 10 });

    if (s.benchmarkReturnPct !== null) {
      bEquity *= 1 + s.benchmarkReturnPct / 100;
      benchmarkPoints.push({ year: s.year + 1, value: Math.round(bEquity * 10) / 10 });
    }
  }

  const allValues = [...portfolioPoints.map((p) => p.value), ...benchmarkPoints.map((p) => p.value)];
  const maxVal = Math.max(...allValues);
  const minVal = Math.min(...allValues);
  const range = maxVal - minVal || 1;

  const chartW = 700;
  const chartH = 220;
  const padL = 50;
  const padR = 20;
  const padT = 10;
  const padB = 30;
  const innerW = chartW - padL - padR;
  const innerH = chartH - padT - padB;

  const years = portfolioPoints.map((p) => p.year);
  const minYear = years[0];
  const maxYear = years[years.length - 1];
  const yearRange = maxYear - minYear || 1;

  function x(year: number) { return padL + ((year - minYear) / yearRange) * innerW; }
  function y(val: number) { return padT + innerH - ((val - minVal) / range) * innerH; }

  function toPath(points: { year: number; value: number }[]) {
    return points.map((p, i) => `${i === 0 ? "M" : "L"} ${x(p.year).toFixed(1)} ${y(p.value).toFixed(1)}`).join(" ");
  }

  // Y-axis ticks
  const yTicks: number[] = [];
  const step = Math.max(50, Math.ceil(range / 4 / 50) * 50);
  const start = Math.floor(minVal / step) * step;
  for (let v = start; v <= maxVal + step; v += step) yTicks.push(v);

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full max-w-[700px]" role="img" aria-label="Equity curve">
        {/* Grid lines */}
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={padL} y1={y(v)} x2={chartW - padR} y2={y(v)} stroke="#e2e8f0" strokeWidth="1" />
            <text x={padL - 6} y={y(v) + 4} textAnchor="end" className="fill-slate-400" fontSize="10">{v}</text>
          </g>
        ))}
        {/* X-axis labels */}
        {years.filter((_, i) => i % Math.max(1, Math.floor(years.length / 8)) === 0 || i === years.length - 1).map((yr) => (
          <text key={yr} x={x(yr)} y={chartH - 6} textAnchor="middle" className="fill-slate-400" fontSize="10">{yr}</text>
        ))}
        {/* Benchmark line */}
        {benchmarkPoints.length > 1 && (
          <path d={toPath(benchmarkPoints)} fill="none" stroke="#94a3b8" strokeWidth="2" strokeDasharray="6 3" />
        )}
        {/* Portfolio line */}
        <path d={toPath(portfolioPoints)} fill="none" stroke="#059669" strokeWidth="2.5" />
        {/* End value labels */}
        {portfolioPoints.length > 0 && (
          <text
            x={x(portfolioPoints[portfolioPoints.length - 1].year) + 4}
            y={y(portfolioPoints[portfolioPoints.length - 1].value) - 6}
            className="fill-emerald-600 font-semibold" fontSize="11"
          >
            {portfolioPoints[portfolioPoints.length - 1].value.toFixed(0)}
          </text>
        )}
        {benchmarkPoints.length > 1 && (
          <text
            x={x(benchmarkPoints[benchmarkPoints.length - 1].year) + 4}
            y={y(benchmarkPoints[benchmarkPoints.length - 1].value) + 14}
            className="fill-slate-500 font-semibold" fontSize="11"
          >
            {benchmarkPoints[benchmarkPoints.length - 1].value.toFixed(0)}
          </text>
        )}
      </svg>
      <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <span className="inline-block w-4 h-0.5 bg-emerald-600 rounded" /> Portefeuille
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-4 h-0.5 bg-slate-400 rounded border-dashed" style={{ borderTopWidth: 2, borderStyle: "dashed" }} /> S&P 500
        </span>
        <span className="text-slate-400 ml-auto">Base 100</span>
      </div>
    </div>
  );
}

function RollingResults({ result }: { readonly result: RollingBacktestResult }) {
  if (result.slices.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
        <p className="text-slate-500">{result.summary}</p>
      </div>
    );
  }

  const { risk } = result;
  const outColor = (result.outperformance ?? 0) >= 0;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <section className={`rounded-xl border p-6 ${outColor ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
        <p className={`text-sm leading-relaxed font-medium ${outColor ? "text-emerald-800" : "text-red-800"}`}>
          {result.summary}
        </p>
      </section>

      {/* Key metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard
          label="CAGR"
          value={`${risk.cagr >= 0 ? "+" : ""}${risk.cagr}%`}
          sub={risk.benchmarkCagr !== null ? `S&P: ${risk.benchmarkCagr >= 0 ? "+" : ""}${risk.benchmarkCagr}%` : undefined}
          color={risk.cagr >= 0 ? "green" : "red"}
        />
        <MetricCard
          label="Max Drawdown"
          value={`-${risk.maxDrawdown}%`}
          color="red"
        />
        <MetricCard
          label="Volatilité"
          value={`${risk.volatility}%`}
          sub={risk.sharpeRatio !== null ? `Sharpe: ${risk.sharpeRatio}` : undefined}
        />
        <MetricCard
          label="Win Rate"
          value={`${risk.winRate}%`}
          sub={`vs S&P 500`}
          color={risk.winRate >= 50 ? "green" : "red"}
        />
      </div>

      {/* Cumulative numbers */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard
          label="Rendement cumulé"
          value={`${result.cumulativeReturnPct >= 0 ? "+" : ""}${result.cumulativeReturnPct}%`}
          sub={`${result.startYear} → ${result.endYear}`}
          color={result.cumulativeReturnPct >= 0 ? "green" : "red"}
        />
        <MetricCard
          label="S&P 500 cumulé"
          value={result.cumulativeBenchmarkPct !== null
            ? `${result.cumulativeBenchmarkPct >= 0 ? "+" : ""}${result.cumulativeBenchmarkPct}%`
            : "N/A"}
          sub="Benchmark"
        />
        <MetricCard
          label="Surperformance"
          value={result.outperformance !== null
            ? `${result.outperformance > 0 ? "+" : ""}${result.outperformance} pts`
            : "N/A"}
          color={result.outperformance !== null
            ? result.outperformance >= 0 ? "green" : "red"
            : "neutral"}
        />
      </div>

      {/* Equity curve */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Courbe de performance</h2>
        <EquityCurve slices={result.slices} />
      </section>

      {/* Year-by-year table */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Détail année par année</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="py-2 text-left text-xs font-semibold text-slate-500 uppercase">Année</th>
                <th className="py-2 text-left text-xs font-semibold text-slate-500 uppercase">Holdings</th>
                <th className="py-2 text-right text-xs font-semibold text-slate-500 uppercase">Portefeuille</th>
                <th className="py-2 text-right text-xs font-semibold text-slate-500 uppercase">S&P 500</th>
                <th className="py-2 text-right text-xs font-semibold text-slate-500 uppercase hidden sm:table-cell">Turnover</th>
              </tr>
            </thead>
            <tbody>
              {result.slices.map((slice) => {
                const beat = slice.benchmarkReturnPct !== null && slice.portfolioReturnPct > slice.benchmarkReturnPct;
                return (
                  <tr key={slice.year} className={`border-b border-slate-100 ${beat ? "bg-emerald-50/40" : ""}`}>
                    <td className="py-2 font-medium text-slate-700">{slice.year}→{slice.year + 1}</td>
                    <td className="py-2 text-xs text-slate-500 max-w-[200px] truncate">
                      {slice.holdings.map((h) => h.ticker).join(", ")}
                    </td>
                    <td className="py-2 text-right">
                      <span className={`font-semibold tabular-nums ${slice.portfolioReturnPct >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                        {slice.portfolioReturnPct > 0 ? "+" : ""}{slice.portfolioReturnPct}%
                      </span>
                    </td>
                    <td className="py-2 text-right tabular-nums text-slate-600">
                      {slice.benchmarkReturnPct !== null
                        ? `${slice.benchmarkReturnPct > 0 ? "+" : ""}${slice.benchmarkReturnPct}%`
                        : "N/A"}
                    </td>
                    <td className="py-2 text-right tabular-nums text-slate-400 hidden sm:table-cell">
                      {slice.turnover > 0 ? `${Math.round(slice.turnover * 100)}%` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Best/worst year */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center">
          <p className="text-xs text-emerald-600 uppercase tracking-wider mb-1">Meilleure année</p>
          <p className="text-lg font-bold text-emerald-700 tabular-nums">
            {risk.bestYear.year}→{risk.bestYear.year + 1} : +{risk.bestYear.returnPct}%
          </p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center">
          <p className="text-xs text-red-600 uppercase tracking-wider mb-1">Pire année</p>
          <p className="text-lg font-bold text-red-700 tabular-nums">
            {risk.worstYear.year}→{risk.worstYear.year + 1} : {risk.worstYear.returnPct}%
          </p>
        </div>
      </div>

      {result.disclaimer && (
        <p className="text-xs text-slate-400 leading-relaxed">{result.disclaimer}</p>
      )}
    </div>
  );
}

// --- Main page ---

function BacktestContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [mode, setMode] = useState<BacktestMode>(
    searchParams.get("mode") === "rolling" ? "rolling" : "single",
  );
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

  function updateUrl(m: BacktestMode, s: StrategyId, y: number, n: number) {
    const params = new URLSearchParams({ strategy: s, topN: String(n), mode: m });
    if (m === "single") params.set("startYear", String(y));
    router.replace(`/backtest?${params.toString()}`);
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    async function fetchBacktest() {
      const params = new URLSearchParams({ strategy: strategyId, topN: String(topN) });
      if (mode === "rolling") {
        params.set("mode", "rolling");
      } else {
        params.set("startYear", String(startYear));
      }

      try {
        const res = await fetch(`/api/backtest?${params.toString()}`);
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
  }, [mode, strategyId, startYear, topN]);

  const availableYears = response?.availableYears ?? [];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-4">
          <Link href="/scanner" className="hover:text-slate-900 transition-colors">Scanner</Link>
          <span>/</span>
          <span className="text-slate-900 font-medium">Backtest</span>
        </div>
        <h1 className="text-2xl font-extrabold text-slate-900">
          {mode === "rolling" ? "Backtest avec rebalancement" : "Si j\u2019avais investi..."}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {mode === "rolling"
            ? "Performance historique avec rebalancement annuel du portefeuille."
            : "Simulez les performances d\u2019un portefeuille basé sur les meilleures actions d\u2019une stratégie à une date passée."}
        </p>
      </div>

      {/* Controls */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 mb-6">
        {/* Mode toggle */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Mode</label>
          <div className="flex gap-1.5">
            {([
              { id: "single" as const, label: "Achat unique" },
              { id: "rolling" as const, label: "Rebalancement annuel" },
            ]).map((opt) => (
              <button
                key={opt.id}
                onClick={() => { setMode(opt.id); updateUrl(opt.id, strategyId, startYear, topN); }}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  mode === opt.id
                    ? "bg-brand-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className={`grid grid-cols-1 gap-4 ${mode === "single" ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
          {/* Strategy */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Stratégie</label>
            <div className="flex flex-wrap gap-1.5">
              {STRATEGY_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => { setStrategyId(opt.id); updateUrl(mode, opt.id, startYear, topN); }}
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

          {/* Start year (single mode only) */}
          {mode === "single" && (
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Année de départ</label>
              <select
                value={startYear}
                onChange={(e) => { const y = parseInt(e.target.value, 10); setStartYear(y); updateUrl(mode, strategyId, y, topN); }}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
              >
                {availableYears.length > 0
                  ? availableYears.map((y) => <option key={y} value={y}>{y}</option>)
                  : <option value={startYear}>{startYear}</option>
                }
              </select>
            </div>
          )}

          {/* Top N */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Nombre d&apos;actions</label>
            <div className="flex gap-1.5">
              {TOP_N_OPTIONS.map((n) => (
                <button
                  key={n}
                  onClick={() => { setTopN(n); updateUrl(mode, strategyId, startYear, n); }}
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
            {mode === "rolling" ? "Simulation en cours (rebalancement annuel)..." : "Simulation en cours..."}
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
      {!loading && mode === "single" && response?.result && (
        <SingleYearResults result={response.result} />
      )}

      {!loading && mode === "rolling" && response?.rollingResult && (
        <RollingResults result={response.rollingResult} />
      )}
    </div>
  );
}

export default function BacktestPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-4xl px-4 py-8">
          <h1 className="text-2xl font-extrabold text-slate-900">Backtest</h1>
        </div>
      }
    >
      <BacktestContent />
    </Suspense>
  );
}

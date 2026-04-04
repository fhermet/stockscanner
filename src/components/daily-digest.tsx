"use client";

import { useState } from "react";
import Link from "next/link";
import { useAlerts, TriggeredAlert } from "@/hooks/use-alerts";
import { useWatchlist } from "@/hooks/use-watchlist";

type DigestFilter = "all" | "watchlist" | "gains" | "losses";
type DigestSort = "importance" | "variation" | "strategy";

function AlertIcon({ type }: { type: TriggeredAlert["type"] }) {
  const isPositive = type === "score_above" || type === "delta_above";
  return (
    <span
      className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
        isPositive
          ? "bg-emerald-100 text-emerald-600"
          : "bg-red-100 text-red-600"
      }`}
    >
      {isPositive ? (
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
        </svg>
      ) : (
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      )}
    </span>
  );
}

function formatValue(alert: TriggeredAlert): string {
  if (alert.type.startsWith("delta")) {
    return `${alert.value > 0 ? "+" : ""}${alert.value} pts`;
  }
  return `${alert.value}/100`;
}

const STRATEGY_LABELS: Record<string, string> = {
  buffett: "Buffett",
  lynch: "Lynch",
  growth: "Growth",
  dividend: "Dividende",
};

export default function DailyDigest() {
  const { todayAlerts, clearTriggered } = useAlerts();
  const { tickers: watchlistTickers } = useWatchlist();
  const [filter, setFilter] = useState<DigestFilter>("all");
  const [sort, setSort] = useState<DigestSort>("importance");

  if (todayAlerts.length === 0) return null;

  // Filter
  let filtered = todayAlerts;
  if (filter === "watchlist") {
    filtered = filtered.filter((a) => watchlistTickers.includes(a.ticker));
  } else if (filter === "gains") {
    filtered = filtered.filter((a) => a.type === "score_above" || a.type === "delta_above");
  } else if (filter === "losses") {
    filtered = filtered.filter((a) => a.type === "score_below" || a.type === "delta_below");
  }

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    switch (sort) {
      case "importance":
        return Math.abs(b.value) - Math.abs(a.value);
      case "variation":
        return b.value - a.value;
      case "strategy":
        return a.strategyId.localeCompare(b.strategyId);
      default:
        return 0;
    }
  });

  const FILTERS: { id: DigestFilter; label: string }[] = [
    { id: "all", label: "Toutes" },
    { id: "watchlist", label: "Watchlist" },
    { id: "gains", label: "Hausse" },
    { id: "losses", label: "Baisse" },
  ];

  const SORTS: { id: DigestSort; label: string }[] = [
    { id: "importance", label: "Importance" },
    { id: "variation", label: "Variation" },
    { id: "strategy", label: "Stratégie" },
  ];

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Aujourd&apos;hui</h2>
          <p className="text-sm text-slate-500">
            {sorted.length} alerte{sorted.length !== 1 ? "s" : ""}
            {filter !== "all" && ` (filtre : ${FILTERS.find((f) => f.id === filter)?.label})`}
          </p>
        </div>
        <button
          onClick={clearTriggered}
          className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
        >
          Effacer
        </button>
      </div>

      {/* Filters + Sort */}
      <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-2 sm:gap-4 mb-4">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === f.id
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-500 hover:bg-slate-200"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-slate-400">Tri :</span>
          {SORTS.map((s) => (
            <button
              key={s.id}
              onClick={() => setSort(s.id)}
              className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                sort === s.id
                  ? "bg-brand-100 text-brand-700"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Alert list */}
      {sorted.length === 0 ? (
        <p className="text-sm text-slate-400 py-4 text-center">
          Aucune alerte pour ce filtre
        </p>
      ) : (
        <div className="space-y-2">
          {sorted.slice(0, 10).map((alert, i) => (
            <Link
              key={`${alert.ruleId}-${alert.ticker}-${i}`}
              href={`/stocks/${alert.ticker}?strategy=${alert.strategyId}`}
              className="flex items-start gap-3 rounded-lg p-3 hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100"
            >
              <AlertIcon type={alert.type} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-bold text-slate-900 text-sm">
                    {alert.ticker}
                  </span>
                  <span className="text-xs text-slate-400 truncate">
                    {alert.stockName}
                  </span>
                  <span className="ml-auto rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                    {STRATEGY_LABELS[alert.strategyId] ?? alert.strategyId}
                  </span>
                </div>
                <p className="text-xs font-medium text-slate-700">
                  {alert.label} &middot; {formatValue(alert)}
                </p>
                {(alert.changeExplanation || alert.explanation) && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    {alert.changeExplanation ?? alert.explanation}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      {sorted.length > 10 && (
        <p className="mt-3 text-xs text-slate-400 text-center">
          +{sorted.length - 10} autre{sorted.length - 10 !== 1 ? "s" : ""}
        </p>
      )}
    </section>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useWatchlist } from "@/hooks/use-watchlist";
import { useScoreHistory, ScoreDelta } from "@/hooks/use-score-history";
import { StrategyId, ScoredStock } from "@/lib/types";
import { formatPrice } from "@/lib/format";
import ScoreBadge from "@/components/ui/score-badge";
import ScoreDeltaBadge from "@/components/ui/score-delta";

type SortKey = "score" | "delta" | "ticker";

interface WatchlistItem {
  readonly ticker: string;
  readonly name: string;
  readonly sector: string;
  readonly score: number;
  readonly delta: ScoreDelta;
  readonly price: number;
  readonly currency: string;
}

export default function WatchlistPage() {
  const { tickers, remove } = useWatchlist();
  const { getDelta, saveScore } = useScoreHistory();
  const [strategyId, setStrategyId] = useState<StrategyId>("buffett");
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [failedTickers, setFailedTickers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("score");

  const fetchWatchlistData = useCallback(async () => {
    if (tickers.length === 0) return;
    setLoading(true);

    const results: WatchlistItem[] = [];
    const failed: string[] = [];

    for (const ticker of tickers) {
      try {
        const res = await fetch(
          `/api/stocks/${encodeURIComponent(ticker)}?strategy=${strategyId}`
        );
        if (!res.ok) { failed.push(ticker); continue; }
        const data = await res.json();
        const scored: ScoredStock = { stock: data.stock, score: data.score };
        const delta = getDelta(ticker, strategyId, scored.score.total ?? 0);

        saveScore(ticker, strategyId, scored.score.total ?? 0);

        results.push({
          ticker: scored.stock.ticker,
          name: scored.stock.name,
          sector: scored.stock.sector,
          score: scored.score.total ?? 0,
          delta,
          price: scored.stock.price,
          currency: scored.stock.currency,
        });
      } catch {
        failed.push(ticker);
      }
    }

    setItems(results);
    setFailedTickers(failed);
    setLoading(false);
  }, [tickers, strategyId, getDelta, saveScore]);

  useEffect(() => {
    fetchWatchlistData();
  }, [fetchWatchlistData]);

  const sorted = [...items].sort((a, b) => {
    switch (sortKey) {
      case "score":
        return b.score - a.score;
      case "delta":
        // null deltas (no history) sort last
        return (b.delta.delta ?? -Infinity) - (a.delta.delta ?? -Infinity);
      case "ticker":
        return a.ticker.localeCompare(b.ticker);
      default:
        return 0;
    }
  });

  const strategies: { id: StrategyId; label: string }[] = [
    { id: "buffett", label: "Buffett" },
    { id: "lynch", label: "Lynch" },
    { id: "growth", label: "Growth" },
    { id: "dividend", label: "Dividende" },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900 mb-1">Watchlist</h1>
      <p className="text-sm text-slate-500 mb-6">
        {tickers.length} action{tickers.length !== 1 ? "s" : ""} suivie{tickers.length !== 1 ? "s" : ""}
      </p>

      {tickers.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
          <svg className="mx-auto h-10 w-10 text-slate-300 mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
          </svg>
          <h3 className="text-lg font-semibold text-slate-900 mb-1">
            Votre watchlist est vide
          </h3>
          <p className="text-sm text-slate-500 mb-4">
            Ajoutez des actions en cliquant sur l&apos;étoile à côté du nom
            d&apos;une action dans le scanner ou sur sa page détail.
          </p>
          <Link
            href="/scanner?strategy=buffett"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
          >
            Explorer le scanner
          </Link>
        </div>
      ) : (
        <>
          {failedTickers.length > 0 && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5">
              <p className="text-sm text-amber-700">
                Données indisponibles pour : {failedTickers.join(", ")}
              </p>
            </div>
          )}

          {/* Strategy + Sort controls */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div className="flex gap-2">
              {strategies.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStrategyId(s.id)}
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
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Trier par</span>
              {(["score", "delta", "ticker"] as const).map((key) => (
                <button
                  key={key}
                  onClick={() => setSortKey(key)}
                  className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                    sortKey === key
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}
                >
                  {key === "score" ? "Score" : key === "delta" ? "Variation" : "Nom"}
                </button>
              ))}
            </div>
          </div>

          {/* Results */}
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600" />
            </div>
          ) : (
            <div className="space-y-3">
              {sorted.map((item) => {
                const isGainer = (item.delta.delta ?? 0) >= 3;
                const isLoser = (item.delta.delta ?? 0) <= -3;

                return (
                  <div
                    key={item.ticker}
                    className={`rounded-xl border bg-white p-4 transition-all ${
                      isGainer
                        ? "border-emerald-200"
                        : isLoser
                          ? "border-red-200"
                          : "border-slate-200"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <Link
                        href={`/stocks/${item.ticker}?strategy=${strategyId}`}
                        className="group flex items-center gap-3"
                      >
                        <div>
                          <span className="font-bold text-slate-900 group-hover:text-brand-600 transition-colors">
                            {item.ticker}
                          </span>
                          <span className="ml-2 text-sm text-slate-500">
                            {item.name}
                          </span>
                        </div>
                      </Link>
                      <div className="flex items-center gap-3">
                        <ScoreDeltaBadge delta={item.delta} size="md" />
                        <ScoreBadge score={item.score} size="sm" />
                        <button
                          onClick={() => remove(item.ticker)}
                          className="ml-2 rounded p-1 text-slate-300 hover:bg-red-50 hover:text-red-500 transition-colors"
                          title="Retirer"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-4 text-xs text-slate-400">
                      <span>{item.sector}</span>
                      <span>{formatPrice(item.price, item.currency)}</span>
                      {item.delta.daysAgo !== null && (
                        <span>vs il y a {item.delta.daysAgo}j</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

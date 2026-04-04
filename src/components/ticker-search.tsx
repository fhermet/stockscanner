"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { StrategyId } from "@/lib/types";

interface TickerSearchProps {
  readonly strategyId: StrategyId;
}

export default function TickerSearch({ strategyId }: TickerSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = useCallback(async () => {
    const ticker = query.trim().toUpperCase();
    if (!ticker) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/stocks/search?q=${encodeURIComponent(ticker)}&strategy=${strategyId}`
      );

      if (res.ok) {
        router.push(`/stocks/${ticker}?strategy=${strategyId}`);
      } else {
        const data = await res.json();
        setError(data.error ?? "Action non trouvee");
      }
    } catch {
      setError("Erreur de connexion");
    } finally {
      setLoading(false);
    }
  }, [query, strategyId, router]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1 max-w-xs">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setError(null);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Rechercher un ticker (ex: AAPL)"
          className={`w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 ${
            error
              ? "border-red-300 focus:border-red-500 focus:ring-red-500"
              : "border-slate-200 focus:border-brand-500 focus:ring-brand-500"
          }`}
        />
        {error && (
          <p className="absolute left-0 top-full mt-1 text-xs text-red-500">
            {error}
          </p>
        )}
      </div>
      <button
        onClick={handleSearch}
        disabled={loading || !query.trim()}
        className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        ) : (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
        )}
        Analyser
      </button>
    </div>
  );
}

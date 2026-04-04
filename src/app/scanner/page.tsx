"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import {
  StrategyId,
  ScoredStock,
  Strategy,
  DataMeta,
  StockFilters as StockFiltersType,
} from "@/lib/types";
import { isValidStrategyId } from "@/lib/strategies";
import StockFiltersComponent from "@/components/stock-filters";
import StockTable from "@/components/stock-table";
import StockCard from "@/components/stock-card";
import DataSourceBadge from "@/components/ui/data-source-badge";
import TickerSearch from "@/components/ticker-search";
import { useScoreHistory } from "@/hooks/use-score-history";
import { useAlerts } from "@/hooks/use-alerts";
import { usePreferences } from "@/hooks/use-preferences";
import { useWatchlist } from "@/hooks/use-watchlist";
import ScoreMovers from "@/components/score-movers";

function parseMarketCapFilter(value: string): Partial<StockFiltersType> {
  switch (value) {
    case "mega":
      return { marketCapMin: 500 };
    case "large":
      return { marketCapMin: 100, marketCapMax: 500 };
    case "mid":
      return { marketCapMin: 10, marketCapMax: 100 };
    case "small":
      return { marketCapMax: 10 };
    default:
      return {};
  }
}

function buildParams(
  strategyId: StrategyId,
  sector: string,
  country: string,
  marketCap: string,
  quick?: boolean
): string {
  const params = new URLSearchParams({ strategy: strategyId });
  if (sector) params.set("sector", sector);
  if (country) params.set("country", country);
  const capFilter = parseMarketCapFilter(marketCap);
  if (capFilter.marketCapMin !== undefined)
    params.set("marketCapMin", String(capFilter.marketCapMin));
  if (capFilter.marketCapMax !== undefined)
    params.set("marketCapMax", String(capFilter.marketCapMax));
  if (quick) params.set("quick", "true");
  return params.toString();
}

function ScannerContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const strategyParam = searchParams.get("strategy") ?? "buffett";
  const initialStrategy = isValidStrategyId(strategyParam)
    ? strategyParam
    : "buffett";

  const [strategyId, setStrategyId] = useState<StrategyId>(initialStrategy);
  const [stocks, setStocks] = useState<readonly ScoredStock[]>([]);
  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const [sectors, setSectors] = useState<readonly string[]>([]);
  const [countries, setCountries] = useState<readonly string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [sector, setSector] = useState("");
  const [country, setCountry] = useState("");
  const [marketCap, setMarketCap] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [meta, setMeta] = useState<DataMeta | null>(null);
  const [universe, setUniverse] = useState<{
    total: number;
    fetched: number;
    displayed: number;
  } | null>(null);

  const { saveScores, getDelta } = useScoreHistory();
  const { evaluate } = useAlerts();
  const { prefs } = usePreferences();
  const { tickers: watchlistTickers } = useWatchlist();

  // Abort controller for cancelling stale fetches
  const abortRef = useRef<AbortController | null>(null);

  const fetchStocks = useCallback(async () => {
    // Cancel any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setRefreshing(false);

    try {
      // Phase 1: quick mock data (instant)
      const quickParams = buildParams(strategyId, sector, country, marketCap, true);
      const quickRes = await fetch(`/api/stocks?${quickParams}`, {
        signal: controller.signal,
      });
      const quickData = await quickRes.json();

      if (!controller.signal.aborted) {
        setStocks(quickData.stocks);
        setStrategy(quickData.strategy);
        setSectors(quickData.filters.sectors);
        setCountries(quickData.filters.countries);
        if (quickData.meta) setMeta(quickData.meta);
        if (quickData.universe) setUniverse(quickData.universe);
        setLoading(false);
        setRefreshing(true);
      }

      // Phase 2: full live data (may take 15-20s on cold)
      const fullParams = buildParams(strategyId, sector, country, marketCap);
      const fullRes = await fetch(`/api/stocks?${fullParams}`, {
        signal: controller.signal,
      });
      const fullData = await fullRes.json();

      if (!controller.signal.aborted) {
        setStocks(fullData.stocks);
        setStrategy(fullData.strategy);
        setSectors(fullData.filters.sectors);
        setCountries(fullData.filters.countries);
        if (fullData.meta) setMeta(fullData.meta);
        if (fullData.universe) setUniverse(fullData.universe);
        setRefreshing(false);

        // Save live scores + evaluate alerts (skip mock phase)
        if (!fullData.isQuick) {
          const scoredItems = fullData.stocks.map((s: ScoredStock) => ({
            ticker: s.stock.ticker,
            strategyId,
            score: s.score.total,
          }));
          saveScores(scoredItems);

          evaluate(
            fullData.stocks.map((s: ScoredStock) => ({
              ticker: s.stock.ticker,
              name: s.stock.name,
              score: s.score.total,
              delta: getDelta(s.stock.ticker, strategyId, s.score.total).delta,
              strategyId,
            })),
            {
              watchlistOnly: prefs.watchlistOnly,
              watchlistTickers,
            }
          );
        }
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setLoading(false);
      setRefreshing(false);
    }
  }, [strategyId, sector, country, marketCap]);

  useEffect(() => {
    fetchStocks();
    return () => abortRef.current?.abort();
  }, [fetchStocks]);

  const handleStrategyChange = (id: StrategyId) => {
    setStrategyId(id);
    router.push(`/scanner?strategy=${id}`, { scroll: false });
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Scanner</h1>
        {strategy && (
          <p className="mt-1 text-sm text-slate-500">
            Strategie <strong>{strategy.name}</strong> &middot;{" "}
            {strategy.philosophy}
          </p>
        )}
        {meta && (
          <div className="mt-2">
            <DataSourceBadge meta={meta} />
          </div>
        )}
      </div>

      {/* Search */}
      <div className="mb-4">
        <TickerSearch strategyId={strategyId} />
      </div>

      {/* Filters */}
      <div className="mb-6">
        <StockFiltersComponent
          sectors={sectors}
          countries={countries}
          selectedSector={sector}
          selectedCountry={country}
          selectedMarketCap={marketCap}
          onSectorChange={setSector}
          onCountryChange={setCountry}
          onMarketCapChange={setMarketCap}
          strategyId={strategyId}
          onStrategyChange={handleStrategyChange}
        />
      </div>

      {/* Refreshing banner */}
      {refreshing && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-4 py-2.5">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-300 border-t-brand-600" />
          <p className="text-sm text-brand-700">
            Actualisation des donnees en direct...
          </p>
        </div>
      )}

      {/* Score movers (only when we have live data, not during refresh) */}
      {!loading && !refreshing && stocks.length > 0 && (
        <ScoreMovers stocks={stocks} strategyId={strategyId} />
      )}

      {/* View toggle + count */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">
            {loading
              ? "Chargement..."
              : `${stocks.length} actions classees`}
          </p>
          {!loading && universe && (
            <p className="text-xs text-slate-400">
              Base sur un univers de {universe.total} actions
              {universe.fetched < universe.total && (
                <> &middot; {universe.fetched} recuperees</>
              )}
            </p>
          )}
        </div>
        <div className="flex rounded-lg border border-slate-200 overflow-hidden">
          <button
            onClick={() => setViewMode("table")}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${
              viewMode === "table"
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0 1 12 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 14.625c0-.621.504-1.125 1.125-1.125" />
            </svg>
          </button>
          <button
            onClick={() => setViewMode("cards")}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${
              viewMode === "cards"
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-brand-600" />
        </div>
      ) : viewMode === "table" ? (
        <StockTable stocks={stocks} strategyId={strategyId} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stocks.map((item, i) => (
            <StockCard
              key={item.stock.ticker}
              item={item}
              strategyId={strategyId}
              rank={i + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ScannerPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-brand-600" />
        </div>
      }
    >
      <ScannerContent />
    </Suspense>
  );
}

"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, useCallback, Suspense } from "react";
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

  const [sector, setSector] = useState("");
  const [country, setCountry] = useState("");
  const [marketCap, setMarketCap] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [meta, setMeta] = useState<DataMeta | null>(null);

  const fetchStocks = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ strategy: strategyId });
    if (sector) params.set("sector", sector);
    if (country) params.set("country", country);
    const capFilter = parseMarketCapFilter(marketCap);
    if (capFilter.marketCapMin !== undefined)
      params.set("marketCapMin", String(capFilter.marketCapMin));
    if (capFilter.marketCapMax !== undefined)
      params.set("marketCapMax", String(capFilter.marketCapMax));

    const res = await fetch(`/api/stocks?${params.toString()}`);
    const data = await res.json();
    setStocks(data.stocks);
    setStrategy(data.strategy);
    setSectors(data.filters.sectors);
    setCountries(data.filters.countries);
    if (data.meta) setMeta(data.meta);
    setLoading(false);
  }, [strategyId, sector, country, marketCap]);

  useEffect(() => {
    fetchStocks();
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

      {/* View toggle + count */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {loading ? "Chargement..." : `${stocks.length} actions`}
        </p>
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

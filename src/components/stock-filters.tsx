"use client";

import { StrategyId } from "@/lib/types";

interface StockFiltersProps {
  readonly sectors: readonly string[];
  readonly selectedSector: string;
  readonly selectedMarketCap: string;
  readonly onSectorChange: (sector: string) => void;
  readonly onMarketCapChange: (cap: string) => void;
  readonly strategyId: StrategyId;
  readonly onStrategyChange: (id: StrategyId) => void;
}

const MARKET_CAP_OPTIONS = [
  { label: "Toutes", value: "" },
  { label: "Mega (>500B)", value: "mega" },
  { label: "Large (100-500B)", value: "large" },
  { label: "Mid (10-100B)", value: "mid" },
  { label: "Small (<10B)", value: "small" },
] as const;

const STRATEGY_OPTIONS: { id: StrategyId; label: string; color: string }[] = [
  { id: "buffett", label: "Buffett", color: "bg-indigo-100 text-indigo-700 border-indigo-300" },
  { id: "lynch", label: "Lynch", color: "bg-emerald-100 text-emerald-700 border-emerald-300" },
  { id: "growth", label: "Growth", color: "bg-violet-100 text-violet-700 border-violet-300" },
  { id: "dividend", label: "Dividende", color: "bg-amber-100 text-amber-700 border-amber-300" },
];

export default function StockFilters({
  sectors,
  selectedSector,
  selectedMarketCap,
  onSectorChange,
  onMarketCapChange,
  strategyId,
  onStrategyChange,
}: StockFiltersProps) {
  return (
    <div className="space-y-4">
      {/* Strategy selector */}
      <div>
        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
          Strategie
        </label>
        <div className="flex flex-wrap gap-2">
          {STRATEGY_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => onStrategyChange(opt.id)}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-all ${
                strategyId === opt.id
                  ? opt.color
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Secondary filters */}
      <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-3">
        <select
          value={selectedSector}
          onChange={(e) => onSectorChange(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none"
        >
          <option value="">Tous les secteurs</option>
          {sectors.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <select
          value={selectedMarketCap}
          onChange={(e) => onMarketCapChange(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none"
        >
          {MARKET_CAP_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

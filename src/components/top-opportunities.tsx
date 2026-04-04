"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ScoredStock, StrategyId } from "@/lib/types";
import ScoreBadge from "./ui/score-badge";

const STRATEGIES: { id: StrategyId; label: string; color: string }[] = [
  { id: "buffett", label: "Buffett", color: "border-indigo-300 bg-indigo-50" },
  { id: "lynch", label: "Lynch", color: "border-emerald-300 bg-emerald-50" },
  { id: "growth", label: "Growth", color: "border-violet-300 bg-violet-50" },
  { id: "dividend", label: "Dividende", color: "border-amber-300 bg-amber-50" },
];

export default function TopOpportunities() {
  const [activeStrategy, setActiveStrategy] = useState<StrategyId>("buffett");
  const [stocks, setStocks] = useState<readonly ScoredStock[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/stocks?strategy=${activeStrategy}&quick=true`)
      .then((r) => r.json())
      .then((data) => {
        setStocks(data.stocks?.slice(0, 5) ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [activeStrategy]);

  return (
    <section>
      <h2 className="text-2xl font-bold text-slate-900 mb-2">
        Top opportunites
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        Les 5 actions les mieux classees par strategie
      </p>

      {/* Strategy tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {STRATEGIES.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveStrategy(s.id)}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-all ${
              activeStrategy === s.id
                ? s.color
                : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600" />
        </div>
      ) : stocks.length === 0 ? (
        <p className="text-sm text-slate-400 py-6">Aucune donnee disponible</p>
      ) : (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          {stocks.map((item, i) => (
            <Link
              key={item.stock.ticker}
              href={`/stocks/${item.stock.ticker}?strategy=${activeStrategy}`}
              className="group rounded-xl border border-slate-200 bg-white p-4 transition-all hover:shadow-md hover:-translate-y-0.5"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-400 font-medium">#{i + 1}</span>
                <ScoreBadge score={item.score.total} size="sm" />
              </div>
              <h3 className="font-bold text-slate-900 group-hover:text-brand-600 transition-colors">
                {item.stock.ticker}
              </h3>
              <p className="text-xs text-slate-500 truncate">{item.stock.name}</p>
              <p className="mt-1 text-xs text-slate-400">{item.stock.sector}</p>
            </Link>
          ))}
        </div>
      )}

      <div className="mt-4 text-center">
        <Link
          href={`/scanner?strategy=${activeStrategy}`}
          className="text-sm font-medium text-brand-600 hover:text-brand-700 transition-colors"
        >
          Voir tout le classement →
        </Link>
      </div>
    </section>
  );
}

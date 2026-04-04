"use client";

import Link from "next/link";
import { ScoredStock, StrategyId } from "@/lib/types";
import ScoreBadge from "./ui/score-badge";
import { formatPrice, formatMarketCap } from "@/lib/format";
import WatchlistButton from "./watchlist-button";

interface StockTableProps {
  readonly stocks: readonly ScoredStock[];
  readonly strategyId: StrategyId;
}


export default function StockTable({ stocks, strategyId }: StockTableProps) {
  if (stocks.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
        <p className="text-slate-500">Aucune action ne correspond aux filtres.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
              #
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
              Action
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
              Secteur
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
              Prix
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
              Market Cap
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
              PER
            </th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">
              Score
            </th>
            <th className="w-10 px-2 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {stocks.map((item, index) => (
            <tr
              key={item.stock.ticker}
              className="hover:bg-slate-50 transition-colors"
            >
              <td className="px-4 py-3 text-sm text-slate-400 font-medium">
                {index + 1}
              </td>
              <td className="px-4 py-3">
                <Link
                  href={`/stocks/${item.stock.ticker}?strategy=${strategyId}`}
                  className="group"
                >
                  <span className="font-semibold text-slate-900 group-hover:text-brand-600 transition-colors">
                    {item.stock.ticker}
                  </span>
                  <span className="ml-2 text-sm text-slate-500">
                    {item.stock.name}
                  </span>
                </Link>
              </td>
              <td className="px-4 py-3 text-sm text-slate-600">
                {item.stock.sector}
              </td>
              <td className="px-4 py-3 text-right text-sm font-medium text-slate-900">
                {formatPrice(item.stock.price, item.stock.currency)}
              </td>
              <td className="px-4 py-3 text-right text-sm text-slate-600">
                {formatMarketCap(item.stock.marketCap, item.stock.currency)}
              </td>
              <td className="px-4 py-3 text-right text-sm text-slate-600">
                {item.stock.per}
              </td>
              <td className="px-4 py-3 text-center">
                <div className="flex items-center justify-center gap-1.5">
                  <ScoreBadge score={item.score.total} size="sm" />
                  {item.score.confidence === "low" && (
                    <span className="h-2 w-2 rounded-full bg-amber-400" title="Confiance faible" />
                  )}
                </div>
              </td>
              <td className="px-2 py-3 text-center">
                <WatchlistButton ticker={item.stock.ticker} size="sm" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

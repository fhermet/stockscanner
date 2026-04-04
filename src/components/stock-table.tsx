import Link from "next/link";
import { ScoredStock, StrategyId } from "@/lib/types";
import ScoreBadge from "./ui/score-badge";

interface StockTableProps {
  readonly stocks: readonly ScoredStock[];
  readonly strategyId: StrategyId;
}

function formatMarketCap(cap: number): string {
  if (cap >= 1000) return `${(cap / 1000).toFixed(1)}T$`;
  return `${cap}B$`;
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
                ${item.stock.price.toFixed(2)}
              </td>
              <td className="px-4 py-3 text-right text-sm text-slate-600">
                {formatMarketCap(item.stock.marketCap)}
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

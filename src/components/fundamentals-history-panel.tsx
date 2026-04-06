"use client";

import { useEffect, useState } from "react";

import type {
  FundamentalsHistoryResponse,
  SecAnnual,
} from "@/lib/types/sec-fundamentals";

interface FundamentalsHistoryPanelProps {
  readonly ticker: string;
}

interface MetricConfig {
  readonly key: string;
  readonly label: string;
  readonly format: (annual: SecAnnual) => string;
  readonly values: (annual: SecAnnual) => number | null;
  readonly color: string;
}

const METRICS: readonly MetricConfig[] = [
  {
    key: "roe",
    label: "ROE",
    format: (a) => formatPercent(a.ratios.roe),
    values: (a) => a.ratios.roe,
    color: "#6366f1",
  },
  {
    key: "operating_margin",
    label: "Marge opérationnelle",
    format: (a) => formatPercent(a.ratios.operating_margin),
    values: (a) => a.ratios.operating_margin,
    color: "#10b981",
  },
  {
    key: "revenue_growth",
    label: "Croissance CA",
    format: (a) => formatPercent(a.ratios.revenue_growth),
    values: (a) => a.ratios.revenue_growth,
    color: "#f59e0b",
  },
  {
    key: "debt_to_equity",
    label: "Dette / Capitaux propres",
    format: (a) => formatRatio(a.ratios.debt_to_equity),
    values: (a) => a.ratios.debt_to_equity,
    color: "#ef4444",
  },
];

function formatPercent(value: number | null): string {
  if (value === null) return "N/A";
  return `${(value * 100).toFixed(1)}%`;
}

function formatRatio(value: number | null): string {
  if (value === null) return "N/A";
  return value.toFixed(2);
}

function MiniSparkline({
  values,
  color,
}: {
  readonly values: readonly (number | null)[];
  readonly color: string;
}) {
  const nums = values.filter((v): v is number => v !== null);
  if (nums.length < 2) return null;

  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const range = max - min || 1;

  const w = 60;
  const h = 20;
  const pad = 2;

  const points = nums
    .map((v, i) => {
      const x = pad + (i / (nums.length - 1)) * (w - pad * 2);
      const y = pad + (h - pad * 2) - ((v - min) / range) * (h - pad * 2);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="inline-block w-14 h-5 ml-1 align-middle">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function FundamentalsHistoryPanel({
  ticker,
}: FundamentalsHistoryPanelProps) {
  const [response, setResponse] = useState<FundamentalsHistoryResponse | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        const res = await fetch(
          `/api/stocks/${encodeURIComponent(ticker)}/fundamentals-history`
        );
        if (!res.ok) {
          setResponse({ available: false, data: null });
          return;
        }
        const json: FundamentalsHistoryResponse = await res.json();
        if (!cancelled) {
          setResponse(json);
        }
      } catch {
        if (!cancelled) {
          setResponse({ available: false, data: null });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  if (loading) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-4">
          Historique fondamental
        </h2>
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-transparent" />
          Chargement des données SEC...
        </div>
      </section>
    );
  }

  if (!response?.available || !response.data) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-4">
          Historique fondamental
        </h2>
        <div className="rounded-lg bg-slate-50 border border-slate-100 p-4">
          <p className="text-sm text-slate-500">
            {response?.message ??
              "Historique fondamental indisponible pour cette action."}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Disponible uniquement pour les entreprises US couvertes par
            SEC/EDGAR (S&P 500).
          </p>
        </div>
      </section>
    );
  }

  const annuals = response.data.annuals;
  const lastUpdated = response.data.last_updated;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-4">
        <h2 className="text-lg font-bold text-slate-900">
          Historique fondamental
        </h2>
        <span className="text-xs text-slate-400">
          Source : SEC/EDGAR &middot; {lastUpdated}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="py-2 text-left font-semibold text-slate-600">
                Métrique
              </th>
              {annuals.map((a) => (
                <th
                  key={a.fiscal_year}
                  className="py-2 text-right font-semibold text-slate-600 min-w-[52px]"
                >
                  {a.fiscal_year}
                </th>
              ))}
              <th className="py-2 text-center font-semibold text-slate-600 min-w-[52px]">
                Tendance
              </th>
            </tr>
          </thead>
          <tbody>
            {METRICS.map((metric) => (
              <tr
                key={metric.key}
                className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
              >
                <td className="py-2.5 font-medium text-slate-700">
                  {metric.label}
                </td>
                {annuals.map((annual) => {
                  const formatted = metric.format(annual);
                  const isNA = formatted === "N/A";
                  return (
                    <td
                      key={annual.fiscal_year}
                      className={`py-2.5 text-right tabular-nums ${
                        isNA ? "text-slate-300" : "text-slate-600"
                      }`}
                    >
                      {formatted}
                    </td>
                  );
                })}
                <td className="py-2.5 text-center">
                  <MiniSparkline
                    values={annuals.map(metric.values)}
                    color={metric.color}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Data quality indicator */}
      {annuals.length > 0 && (
        <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
          <span>
            {annuals.length} année{annuals.length > 1 ? "s" : ""} de données
          </span>
          {annuals.every((a) => a.completeness.completeness_ratio === 1) ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-600">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Données complètes
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-amber-600">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              Données partielles
            </span>
          )}
        </div>
      )}
    </section>
  );
}

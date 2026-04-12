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
  readonly labelShort: string;
  readonly format: (annual: SecAnnual) => string;
  readonly values: (annual: SecAnnual) => number | null;
  readonly color: string;
}

function computeRoic(a: SecAnnual): number | null {
  const ni = a.fundamentals.net_income;
  const eq = a.fundamentals.shareholders_equity ?? 0;
  const debt = a.fundamentals.total_debt ?? 0;
  if (ni === null) return null;
  const ic = eq + debt;
  return ic > 0 ? ni / ic : null;
}

function computeDebtToOcf(a: SecAnnual): number | null {
  const debt = a.fundamentals.total_debt;
  const ocf = a.fundamentals.operating_cash_flow;
  if (debt === null || ocf === null || ocf <= 0) return null;
  return debt / ocf;
}

const METRICS: readonly MetricConfig[] = [
  {
    key: "roic",
    label: "ROIC (Return on Invested Capital)",
    labelShort: "ROIC",
    format: (a) => formatPercent(computeRoic(a)),
    values: (a) => computeRoic(a),
    color: "#8b5cf6",
  },
  {
    key: "operating_margin",
    label: "Marge opérationnelle",
    labelShort: "Marge op.",
    format: (a) => formatPercent(a.ratios.operating_margin),
    values: (a) => a.ratios.operating_margin,
    color: "#10b981",
  },
  {
    key: "revenue_growth",
    label: "Croissance CA",
    labelShort: "Crois. CA",
    format: (a) => formatPercent(a.ratios.revenue_growth),
    values: (a) => a.ratios.revenue_growth,
    color: "#f59e0b",
  },
  {
    key: "debt_to_ocf",
    label: "Dette / Cash-flow opérationnel",
    labelShort: "Debt/OCF",
    format: (a) => formatRatio(computeDebtToOcf(a)),
    values: (a) => computeDebtToOcf(a),
    color: "#f43f5e",
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

/** Mobile card layout: one card per metric with sparkline + latest values */
function MobileMetricCard({
  metric,
  annuals,
}: {
  readonly metric: MetricConfig;
  readonly annuals: readonly SecAnnual[];
}) {
  const recent = annuals.slice(-5);
  const latest = recent[recent.length - 1];
  const prev = recent.length >= 2 ? recent[recent.length - 2] : null;
  const latestVal = latest ? metric.format(latest) : "N/A";
  const prevVal = prev ? metric.format(prev) : null;

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-slate-100 last:border-b-0">
      <div
        className="w-1 h-8 rounded-full flex-shrink-0"
        style={{ backgroundColor: metric.color }}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-700">{metric.labelShort}</p>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          {recent.map((a) => (
            <span key={a.fiscal_year} className="tabular-nums">
              {metric.format(a)}
            </span>
          ))}
        </div>
      </div>
      <MiniSparkline values={annuals.map(metric.values)} color={metric.color} />
      <div className="text-right flex-shrink-0">
        <p className="text-sm font-semibold text-slate-800 tabular-nums">
          {latestVal}
        </p>
        {prevVal && (
          <p className="text-[10px] text-slate-400 tabular-nums">
            {annuals[annuals.length - 1]?.fiscal_year}
          </p>
        )}
      </div>
    </div>
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
    <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-4">
        <h2 className="text-lg font-bold text-slate-900">
          Historique fondamental
        </h2>
        <span className="text-xs text-slate-400">
          SEC/EDGAR &middot; {lastUpdated}
        </span>
      </div>

      {/* Mobile: card layout */}
      <div className="sm:hidden">
        {METRICS.map((metric) => (
          <MobileMetricCard key={metric.key} metric={metric} annuals={annuals} />
        ))}
      </div>

      {/* Desktop: full table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="py-2 text-left font-semibold text-slate-600">
                Métrique
              </th>
              {annuals.map((a) => (
                <th
                  key={a.fiscal_year}
                  className="py-2 text-right font-semibold text-slate-600"
                >
                  {a.fiscal_year}
                </th>
              ))}
              <th className="py-2 text-center font-semibold text-slate-600">
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
                <td className="py-2.5 font-medium text-slate-700 whitespace-nowrap">
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
            {annuals.length} année{annuals.length > 1 ? "s" : ""}
          </span>
          {annuals.every((a) => a.completeness.completeness_ratio === 1) ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-600">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Complètes
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-amber-600">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              Partielles
            </span>
          )}
        </div>
      )}
    </section>
  );
}

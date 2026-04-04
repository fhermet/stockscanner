"use client";

import Link from "next/link";
import { useAlerts, TriggeredAlert } from "@/hooks/use-alerts";

function AlertIcon({ type }: { type: TriggeredAlert["type"] }) {
  const isPositive = type === "score_above" || type === "delta_above";
  return (
    <span
      className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
        isPositive
          ? "bg-emerald-100 text-emerald-600"
          : "bg-red-100 text-red-600"
      }`}
    >
      {isPositive ? "+" : "-"}
    </span>
  );
}

function formatAlertText(alert: TriggeredAlert): string {
  switch (alert.type) {
    case "score_above":
      return `Score ${alert.value}/100`;
    case "score_below":
      return `Score ${alert.value}/100`;
    case "delta_above":
      return `+${alert.value} pts`;
    case "delta_below":
      return `${alert.value} pts`;
    default:
      return "";
  }
}

export default function DailyDigest() {
  const { todayAlerts, clearTriggered } = useAlerts();

  if (todayAlerts.length === 0) return null;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Aujourd&apos;hui</h2>
          <p className="text-sm text-slate-500">
            {todayAlerts.length} alerte{todayAlerts.length !== 1 ? "s" : ""} declenchee{todayAlerts.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={clearTriggered}
          className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
        >
          Effacer
        </button>
      </div>

      <div className="space-y-2">
        {todayAlerts.slice(0, 8).map((alert, i) => (
          <Link
            key={`${alert.ruleId}-${alert.ticker}-${i}`}
            href={`/stocks/${alert.ticker}?strategy=buffett`}
            className="flex items-center gap-3 rounded-lg p-2 hover:bg-slate-50 transition-colors"
          >
            <AlertIcon type={alert.type} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-900 text-sm">
                  {alert.ticker}
                </span>
                <span className="text-xs text-slate-400 truncate">
                  {alert.stockName}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {alert.label} &middot; {formatAlertText(alert)}
              </p>
            </div>
          </Link>
        ))}
      </div>

      {todayAlerts.length > 8 && (
        <p className="mt-3 text-xs text-slate-400 text-center">
          +{todayAlerts.length - 8} autre{todayAlerts.length - 8 !== 1 ? "s" : ""}
        </p>
      )}
    </section>
  );
}

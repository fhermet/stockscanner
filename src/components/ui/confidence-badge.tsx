import { ScoreConfidence, DataCompleteness } from "@/lib/types";

interface ConfidenceBadgeProps {
  readonly confidence: ScoreConfidence;
  readonly completeness: DataCompleteness;
  readonly showDetail?: boolean;
}

const CONFIDENCE_CONFIG = {
  high: {
    label: "Confiance élevée",
    color: "bg-emerald-100 text-emerald-700 ring-emerald-600/20",
    icon: "M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  },
  medium: {
    label: "Confiance moyenne",
    color: "bg-amber-100 text-amber-700 ring-amber-600/20",
    icon: "M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z",
  },
  low: {
    label: "Confiance faible",
    color: "bg-red-100 text-red-700 ring-red-600/20",
    icon: "M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z",
  },
} as const;

export default function ConfidenceBadge({
  confidence,
  completeness,
  showDetail = false,
}: ConfidenceBadgeProps) {
  const config = CONFIDENCE_CONFIG[confidence];

  return (
    <div>
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${config.color}`}
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d={config.icon} />
        </svg>
        {config.label}
        <span className="opacity-60">({completeness.score}%)</span>
      </span>

      {showDetail && completeness.missing.length > 0 && (
        <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-medium text-amber-800">
            Donnees manquantes ({completeness.missing.length}) :
          </p>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {completeness.missing.map((m) => (
              <li
                key={m}
                className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700"
              >
                {m}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

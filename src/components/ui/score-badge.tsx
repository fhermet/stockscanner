interface ScoreBadgeProps {
  readonly score: number | null;
  readonly size?: "sm" | "md" | "lg";
}

function getScoreColor(score: number): string {
  if (score >= 80) return "bg-emerald-100 text-emerald-800 ring-emerald-600/20";
  if (score >= 60) return "bg-blue-100 text-blue-800 ring-blue-600/20";
  if (score >= 40) return "bg-amber-100 text-amber-800 ring-amber-600/20";
  return "bg-red-100 text-red-800 ring-red-600/20";
}

function getScoreLabel(score: number): string {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Bon";
  if (score >= 40) return "Moyen";
  return "Faible";
}

const sizeClasses = {
  sm: "text-xs px-2 py-0.5",
  md: "text-sm px-2.5 py-1",
  lg: "text-base px-3 py-1.5 font-semibold",
} as const;

export default function ScoreBadge({ score, size = "md" }: ScoreBadgeProps) {
  if (score === null) {
    return (
      <span
        className={`inline-flex items-center rounded-full ring-1 ring-inset font-medium bg-slate-100 text-slate-500 ring-slate-300/20 ${sizeClasses[size]}`}
      >
        N/A
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full ring-1 ring-inset font-medium ${getScoreColor(score)} ${sizeClasses[size]}`}
    >
      <span>{score}</span>
      <span className="opacity-60">/100</span>
      {size !== "sm" && (
        <span className="ml-0.5 opacity-70">· {getScoreLabel(score)}</span>
      )}
    </span>
  );
}

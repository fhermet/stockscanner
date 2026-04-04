import { Explanation } from "@/lib/types";

interface ExplanationListProps {
  readonly explanations: readonly Explanation[];
}

const iconMap = {
  positive: "text-emerald-600",
  neutral: "text-slate-500",
  negative: "text-red-500",
} as const;

const dotMap = {
  positive: "bg-emerald-500",
  neutral: "bg-slate-400",
  negative: "bg-red-500",
} as const;

export default function ExplanationList({
  explanations,
}: ExplanationListProps) {
  return (
    <ul className="space-y-2">
      {explanations.map((exp, i) => (
        <li key={i} className="flex items-start gap-2.5">
          <span
            className={`mt-2 h-2 w-2 flex-shrink-0 rounded-full ${dotMap[exp.type]}`}
          />
          <span className={`text-sm ${iconMap[exp.type]}`}>{exp.text}</span>
        </li>
      ))}
    </ul>
  );
}

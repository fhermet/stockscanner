import { Stock, StrategyScore } from "@/lib/types";
import { generateSummary } from "@/lib/scoring/explain";

interface StockSummaryProps {
  readonly stock: Stock;
  readonly score: StrategyScore;
  readonly strategyName: string;
}

export default function StockSummary({
  stock,
  score,
  strategyName,
}: StockSummaryProps) {
  const summary = generateSummary(
    stock,
    score.total,
    score.explanations,
    strategyName
  );

  return (
    <div className="rounded-xl border border-brand-200 bg-brand-50 p-4 dark:border-brand-800 dark:bg-brand-950">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-900">
          <svg
            className="h-4 w-4 text-brand-600"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18"
            />
          </svg>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-brand-900 dark:text-brand-100">
            En resume
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-brand-800 dark:text-brand-200">
            {summary}
          </p>
        </div>
      </div>
    </div>
  );
}

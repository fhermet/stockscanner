import Link from "next/link";
import { Strategy } from "@/lib/types";

interface StrategyCardProps {
  readonly strategy: Strategy;
}

const colorMap: Record<string, { bg: string; border: string; icon: string }> = {
  indigo: {
    bg: "bg-indigo-50 hover:bg-indigo-100",
    border: "border-indigo-200",
    icon: "text-indigo-600",
  },
  emerald: {
    bg: "bg-emerald-50 hover:bg-emerald-100",
    border: "border-emerald-200",
    icon: "text-emerald-600",
  },
  violet: {
    bg: "bg-violet-50 hover:bg-violet-100",
    border: "border-violet-200",
    icon: "text-violet-600",
  },
  amber: {
    bg: "bg-amber-50 hover:bg-amber-100",
    border: "border-amber-200",
    icon: "text-amber-600",
  },
};

const icons: Record<string, string> = {
  shield: "M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z",
  "trending-up":
    "M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941",
  rocket:
    "M15.59 14.37a48.474 48.474 0 0 0-6.05-6.05c.3-.75.58-1.51.84-2.28a48.01 48.01 0 0 1 5.68 5.68c-.77.26-1.53.54-2.28.84l1.81.81Zm-5.12 5.12c-.74.3-1.5.58-2.27.84a48.01 48.01 0 0 1 5.68 5.68c.26-.77.54-1.53.84-2.28a48.474 48.474 0 0 0-6.05-6.05l1.8 1.81ZM12 2.25A.75.75 0 0 1 12.75 3v.75a.75.75 0 0 1-1.5 0V3a.75.75 0 0 1 .75-.75ZM7.5 12a4.5 4.5 0 1 0 9 0 4.5 4.5 0 0 0-9 0Z",
  banknotes:
    "M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z",
};

export default function StrategyCard({ strategy }: StrategyCardProps) {
  const colors = colorMap[strategy.color] ?? colorMap.indigo;

  return (
    <Link
      href={`/scanner?strategy=${strategy.id}`}
      className={`group block rounded-2xl border ${colors.border} ${colors.bg} p-6 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5`}
    >
      <div className="flex items-center gap-3 mb-3">
        <div className={`${colors.icon}`}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="h-7 w-7"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d={icons[strategy.icon] ?? icons.shield}
            />
          </svg>
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900">
            {strategy.name}
          </h3>
          <p className="text-sm text-slate-500">{strategy.subtitle}</p>
        </div>
      </div>
      <p className="text-sm text-slate-600 leading-relaxed">
        {strategy.description}
      </p>
      <div className="mt-4 flex items-center text-sm font-medium text-slate-900 group-hover:gap-2 transition-all">
        Scanner les actions
        <svg
          className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"
          />
        </svg>
      </div>
    </Link>
  );
}

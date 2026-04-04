"use client";

interface CompareBarProps {
  readonly selected: readonly string[];
  readonly onClear: () => void;
  readonly onCompare: () => void;
  readonly canCompare: boolean;
}

export default function CompareBar({
  selected,
  onClear,
  onCompare,
  canCompare,
}: CompareBarProps) {
  if (selected.length === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[calc(100vw-2rem)] max-w-lg rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-lg sm:rounded-full sm:px-5">
      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
        <span className="text-sm text-slate-600">
          <span className="font-bold text-slate-900">{selected.length}</span>{" "}
          <span className="hidden sm:inline">action{selected.length > 1 ? "s" : ""} sélectionnée{selected.length > 1 ? "s" : ""}</span>
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          {selected.map((t) => (
            <span key={t} className="rounded bg-brand-100 px-1.5 py-0.5 text-xs font-medium text-brand-700">
              {t}
            </span>
          ))}
        </div>
        <button
          onClick={onCompare}
          disabled={!canCompare}
          className="rounded-full bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
        >
          Comparer
        </button>
        <button onClick={onClear} className="text-xs text-slate-400 hover:text-slate-600">
          Annuler
        </button>
      </div>
    </div>
  );
}

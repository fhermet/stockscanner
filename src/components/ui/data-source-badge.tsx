import { DataMeta } from "@/lib/types";

interface DataSourceBadgeProps {
  readonly meta: DataMeta;
}

function getSourceLabel(source: string): string {
  if (source.includes("yahoo")) return "Yahoo Finance";
  if (source.includes("mock")) return "Donnees locales";
  if (source.includes("cache")) return source.replace("cache:", "Cache · ");
  return source;
}

function formatAge(ms: number): string {
  if (ms < 60_000) return "< 1 min";
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)} min`;
  return `${Math.round(ms / 3_600_000)}h`;
}

function formatTimestamp(ts: number): string {
  if (ts === 0) return "";
  return new Date(ts).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DataSourceBadge({ meta }: DataSourceBadgeProps) {
  const isLive = meta.source.includes("yahoo") && !meta.isCached;
  const isCached = meta.isCached;
  const isFallback = meta.isFallback;
  const isStale = meta.isStale;

  // Determine visual state
  let dotColor = "bg-emerald-500"; // live
  let label = getSourceLabel(meta.source);

  if (isStale) {
    dotColor = "bg-amber-500";
    label += ` (stale · ${formatAge(meta.cacheAgeMs)})`;
  } else if (isCached) {
    dotColor = "bg-blue-500";
    label += ` (cache · ${formatAge(meta.cacheAgeMs)})`;
  }

  if (isFallback) {
    dotColor = "bg-amber-500";
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span
          className={`h-2 w-2 rounded-full ${dotColor}`}
          title={isLive ? "Donnees en direct" : isCached ? "Donnees en cache" : ""}
        />
        <span className="text-xs text-slate-500">{label}</span>
        {meta.fetchedAt > 0 && (
          <span className="text-xs text-slate-400">
            · {formatTimestamp(meta.fetchedAt)}
          </span>
        )}
      </div>

      {isFallback && (
        <p className="text-xs text-amber-600">
          Source principale indisponible — donnees de secours utilisees
        </p>
      )}

      {isStale && !isFallback && (
        <p className="text-xs text-amber-600">
          Donnees en cours de rafraichissement
        </p>
      )}
    </div>
  );
}

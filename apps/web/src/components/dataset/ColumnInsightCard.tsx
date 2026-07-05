"use client";

import type { ColumnProfile, NumericStats, CategoricalStats } from "@/src/lib/types";

type ColumnInsightCardProps = {
  column: ColumnProfile;
  onClick?: () => void;
  selected?: boolean;
};

function isNumericStats(stats: ColumnProfile["stats"]): stats is NumericStats {
  return !!stats && typeof stats === "object" && "mean" in stats;
}

function isCategoricalStats(stats: ColumnProfile["stats"]): stats is CategoricalStats {
  return !!stats && typeof stats === "object" && "top_values" in stats;
}

function formatPercent(fraction: number): string {
  const pct = Math.max(0, Math.min(1, fraction)) * 100;
  return `${pct.toFixed(1)}%`;
}

function getKeyStat(col: ColumnProfile): string {
  const stats = col.stats;
  if (!stats) return "—";
  if (col.detected_type === "Numerical" && isNumericStats(stats)) {
    return stats.mean === null ? "mean: —" : `mean: ${stats.mean.toFixed(3)}`;
  }
  if (isCategoricalStats(stats)) {
    const top = stats.top_values?.[0];
    return !top ? "top: —" : `top: ${top.value} (${top.count})`;
  }
  return "—";
}

function getTypeStyling(detectedType: string): { border: string; badge: string; label: string } {
  switch (detectedType) {
    case "Numerical":
      return {
        border: "border-l-emerald-500/70",
        badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
        label: detectedType,
      };
    case "Categorical":
      return {
        border: "border-l-blue-500/70",
        badge: "bg-blue-500/10 text-blue-400 border-blue-500/20",
        label: detectedType,
      };
    case "Boolean":
      return {
        border: "border-l-purple-500/70",
        badge: "bg-purple-500/10 text-purple-400 border-purple-500/20",
        label: detectedType,
      };
    case "Text":
      return {
        border: "border-l-amber-500/70",
        badge: "bg-amber-500/10 text-amber-400 border-amber-500/20",
        label: detectedType,
      };
    default:
      return {
        border: "border-l-zinc-700/70",
        badge: "bg-zinc-800 text-zinc-400",
        label: detectedType,
      };
  }
}

export default function ColumnInsightCard({
  column,
  onClick,
  selected,
}: ColumnInsightCardProps) {
  const typeStyling = getTypeStyling(column.detected_type);

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "w-full rounded-xl border-l-4 border border-b border-r bg-zinc-900/60 p-5 text-left transition",
        typeStyling.border,
        selected
          ? "border-t-emerald-500/50 border-b-zinc-800 border-r-zinc-800 shadow-emerald-500/10 shadow-md"
          : "border-t-zinc-800 border-b-zinc-800 border-r-zinc-800 hover:border-r-zinc-600 hover:border-b-zinc-600",
      ].join(" ")}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="break-words text-base font-semibold text-zinc-100">{column.name}</h3>
          <p className="mt-0.5 text-xs text-zinc-500 font-mono">{column.dtype}</p>
        </div>
        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${typeStyling.badge}`}>
          {typeStyling.label}
        </span>
      </div>

      {/* Metadata Row */}
      <div className="mt-4 flex items-center gap-4 text-xs text-zinc-500">
        <span className={column.missing_percentage > 0 ? "text-rose-400" : ""}>
          Missing: {formatPercent(column.missing_percentage)}
        </span>
        <span>Unique: {column.unique_count}</span>
      </div>

      {/* Single Key Stat */}
      <div className="mt-3 text-sm font-mono text-zinc-400">
        <p>{getKeyStat(column)}</p>
      </div>
    </button>
  );
}
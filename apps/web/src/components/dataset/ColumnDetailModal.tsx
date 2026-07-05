"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { ColumnProfile, NumericStats, CategoricalStats, DataRow } from "@/src/lib/types";

type ColumnDetailModalProps = {
  column: ColumnProfile | null;
  previewRows: DataRow[];
  open: boolean;
  onClose: () => void;
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

function buildPreviewDistribution(
  previewRows: DataRow[],
  columnName: string,
) {
  const values = previewRows
    .map((row) => row[columnName])
    .filter((value): value is string | number | boolean => value !== null && value !== undefined);

  const buckets = new Map<string, number>();

  for (const value of values) {
    const key = String(value);
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }

  return Array.from(buckets.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}

export default function ColumnDetailModal({
  column,
  previewRows,
  open,
  onClose,
}: ColumnDetailModalProps) {
  if (!open || !column) return null;

  const stats = column.stats;
  const previewDistribution = buildPreviewDistribution(previewRows, column.name);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="wrap-break-word text-2xl font-semibold">{column.name}</h2>
            <p className="mt-1 text-sm text-zinc-400">{column.dtype}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-zinc-700 px-3 py-1 text-sm text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-900"
          >
            Close
          </button>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
            <p className="text-sm text-zinc-400">Type</p>
            <p className="mt-1 text-lg font-medium">{column.detected_type}</p>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
            <p className="text-sm text-zinc-400">Missing</p>
            <p className="mt-1 text-lg font-medium">
              {formatPercent(column.missing_percentage)}
            </p>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
            <p className="text-sm text-zinc-400">Unique</p>
            <p className="mt-1 text-lg font-medium">{column.unique_count}</p>
          </div>
        </div>

        <section className="mt-6">
          <h3 className="text-lg font-semibold">Overview</h3>
          <p className="mt-2 text-sm text-zinc-400">
            Quick snapshot of the selected feature.
          </p>
        </section>

        {column.detected_type === "Numerical" && isNumericStats(stats) && (
          <div className="mt-6 space-y-6">
            <section>
              <h3 className="text-lg font-semibold">Numeric Stats</h3>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <StatRow label="Mean" value={stats.mean} />
                <StatRow label="Median" value={stats.median} />
                <StatRow label="Min" value={stats.min} />
                <StatRow label="Max" value={stats.max} />
                <StatRow label="Std" value={stats.std} />
              </div>
            </section>

            <section>
              <h3 className="text-lg font-semibold">Sample Distribution</h3>
              <p className="mt-1 text-sm text-zinc-400">
                This chart uses the preview rows currently loaded on the page.
              </p>

              <div className="mt-4 h-72 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
                {previewDistribution.length === 0 ? (
                  <p className="text-sm text-zinc-400">No sample values available.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={previewDistribution}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                      <XAxis
                        dataKey="name"
                        stroke="#a1a1aa"
                        tick={{ fill: "#a1a1aa", fontSize: 12 }}
                      />
                      <YAxis
                        stroke="#a1a1aa"
                        tick={{ fill: "#a1a1aa", fontSize: 12 }}
                      />
                      <Tooltip
                        cursor={false}
                        contentStyle={{
                          backgroundColor: "#09090b",
                          border: "1px solid #27272a",
                          borderRadius: "12px",
                          color: "#e4e4e7",
                        }}
                      />
                      <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                        {previewDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill="#22c55e" />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </section>
          </div>
        )}

        {column.detected_type !== "Numerical" && isCategoricalStats(stats) && (
          <div className="mt-6 space-y-6">
            <section>
              <h3 className="text-lg font-semibold">Top Values</h3>
              <div className="mt-3 space-y-2">
                {stats.top_values.length === 0 ? (
                  <p className="text-sm text-zinc-400">No top values available.</p>
                ) : (
                  stats.top_values.map((item, index) => (
                    <div
                      key={`${column.name}-${index}`}
                      className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-3"
                    >
                      <span className="truncate pr-4">{item.value}</span>
                      <span className="tabular-nums text-zinc-400">{item.count}</span>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section>
              <h3 className="text-lg font-semibold">Category Distribution</h3>
              <p className="mt-1 text-sm text-zinc-400">
                This chart visualizes the top categories from the profiling output.
              </p>

              <div className="mt-4 h-72 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
                {stats.top_values.length === 0 ? (
                  <p className="text-sm text-zinc-400">No chart data available.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.top_values}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                      <XAxis
                        dataKey="value"
                        stroke="#a1a1aa"
                        tick={{ fill: "#a1a1aa", fontSize: 12 }}
                      />
                      <YAxis
                        stroke="#a1a1aa"
                        tick={{ fill: "#a1a1aa", fontSize: 12 }}
                      />
                      <Tooltip
                        cursor={false}
                        contentStyle={{
                          backgroundColor: "#09090b",
                          border: "1px solid #27272a",
                          borderRadius: "12px",
                          color: "#e4e4e7",
                        }}
                      />
                      <Bar dataKey="count" radius={[6, 6, 0, 0]} fill="#a855f7" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

function StatRow({
  label,
  value,
}: {
  label: string;
  value: number | null;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-3">
      <p className="text-sm text-zinc-400">{label}</p>
      <p className="mt-1 text-base font-medium">{value ?? "—"}</p>
    </div>
  );
}
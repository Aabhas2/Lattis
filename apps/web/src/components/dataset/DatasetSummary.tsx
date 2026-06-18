"use client";

type DatasetSummaryProps = {
    rowCount: number;
    columnCount: number;
    totalMissing: number;
    numericCount: number;
};

function MetricCard({
    label,
    value,
    hint,
}: {
    label: string;
    value: string;
    hint?: string;
}) {
    return (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 transition hover:border-zinc-700">
            <p className="text-sm text-zinc-400">{label}</p>
            <p className="mt-2 text-2xl font-semibold">{value}</p>
            {hint && <p className="mt-1 text-xs text-zinc-500">{hint}</p>}
        </div>
    );
}

export default function DatasetSummary({
    rowCount,
    columnCount,
    totalMissing,
    numericCount,
}: DatasetSummaryProps) {
    return (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <MetricCard label="Rows" value={rowCount.toLocaleString()} hint="Total records" />
            <MetricCard label="Columns" value={columnCount.toLocaleString()} hint="Total features" />
            <MetricCard label="Numerical Columns" value={numericCount.toString()} hint="Trainable features" />
            <MetricCard
                label="Missing Values"
                value={totalMissing.toLocaleString()}
                hint={totalMissing > 0 ? "Requires imputation" : "Clean dataset!"}
            />
        </div>
    );
}

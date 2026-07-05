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
    variant = "default",
    icon,
}: {
    label: string;
    value: string;
    hint?: string;
    variant?: "default" | "warning" | "success" | "info";
    icon: React.ReactNode;
}) {
    const variantStyles: Record<string, string> = {
        default: "border-zinc-800 bg-zinc-900/40",
        warning: "border-rose-900/50 bg-rose-950/20",
        success: "border-emerald-900/40 bg-emerald-950/10",
        info: "border-blue-900/40 bg-blue-950/10",
    };
    const valueStyles: Record<string, string> = {
        default: "text-zinc-100",
        warning: "text-rose-400",
        success: "text-emerald-400",
        info: "text-blue-400",
    };
    const iconStyles: Record<string, string> = {
        default: "text-zinc-500",
        warning: "text-rose-500",
        success: "text-emerald-500",
        info: "text-blue-500",
    };
    const accentStyles: Record<string, string> = {
        default: "bg-zinc-700/60",
        warning: "bg-rose-500/60",
        success: "bg-emerald-500/60",
        info: "bg-blue-500/60",
    };

    return (
        <div className={`rounded-xl border p-5 transition hover:border-zinc-600 relative overflow-hidden ${variantStyles[variant]}`}>
            <div className={`absolute left-0 top-0 bottom-0 w-0.5 rounded-l-xl ${accentStyles[variant]}`} />
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wide">{label}</p>
                    <p className={`mt-2 text-4xl font-bold font-mono tracking-tight ${valueStyles[variant]}`}>{value}</p>
                    {hint && <p className={`mt-1.5 text-xs ${variant === "warning" ? "text-rose-500/80" : "text-zinc-500"}`}>{hint}</p>}
                </div>
                <div className={`shrink-0 mt-0.5 ${iconStyles[variant]}`}>{icon}</div>
            </div>
        </div>
    );
}

const RowsIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/>
    </svg>
);
const ColsIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/>
    </svg>
);
const NumericIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 7h16M4 12h16M4 17h16"/>
    </svg>
);
const MissingIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r="0.5" fill="currentColor"/>
    </svg>
);

export default function DatasetSummary({
    rowCount,
    columnCount,
    totalMissing,
    numericCount,
}: DatasetSummaryProps) {
    return (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <MetricCard label="Rows" value={rowCount.toLocaleString()} hint="Total records" variant="default" icon={<RowsIcon />} />
            <MetricCard label="Columns" value={columnCount.toLocaleString()} hint="Total features" variant="info" icon={<ColsIcon />} />
            <MetricCard label="Numerical" value={numericCount.toString()} hint="Trainable features" variant="success" icon={<NumericIcon />} />
            <MetricCard
                label="Missing Values"
                value={totalMissing.toLocaleString()}
                hint={totalMissing > 0 ? "Requires imputation" : "Clean dataset!"}
                variant={totalMissing > 0 ? "warning" : "success"}
                icon={<MissingIcon />}
            />
        </div>
    );
}

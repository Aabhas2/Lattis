"use client"

import type { ColumnProfile, NumericStats, CategoricalStats } from "@/src/lib/types"

type ColumnTableProps = {
    columns: ColumnProfile[]; 
}; 

function formatPercent(fraction: number): string {
    const pct = Math.max(0, Math.min(1, fraction)) * 100; 
    return `${pct.toFixed(1)}%`; 
}

function getTypeBadgeClasses(detectedType: ColumnProfile["detected_type"]): string {
    // Tailwind only, theme 
    switch(detectedType) {
        case "Numerical": 
            return "bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-100"; 
        case "Categorical": 
        case "Text": 
            return "bg-purple-100 text-purple-900 dark:bg-purple-900/40 dark:text-purple-100";
        case "Datetime": 
            return "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100";
        case "Boolean": 
            return "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100";
        default: 
            return "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"; 
    }
}

function isNumericStats(stats: ColumnProfile["stats"]): stats is NumericStats {
    return !!stats && typeof stats === "object" && "mean" in stats; 
}

function isCategoricalStats(stats: ColumnProfile["stats"]): stats is CategoricalStats {
    return !!stats && typeof stats === "object" && "top_values" in stats; 
}

function getKeyStat(col: ColumnProfile): string {
    const stats = col.stats; 

    if (!stats) return "-"; 

    if (col.detected_type === "Numerical" && isNumericStats(stats)) {
        const mean = stats.mean; 
        return mean === null ? "mean: -" : `mean: ${mean.toFixed(3)}`; 
    }

    // For categorical/text/datetime/boolean we show "top" 
    if (isCategoricalStats(stats)) {
        const top = stats.top_values?.[0]; 
        if (!top) return "top: -"; 
        return `top: ${top.top_values} (${top.unique_count})`
    }

    return "-";  
}

export default function ColumnTable({ columns }: ColumnTableProps) {
    if (columns.length === 0) {
        return <p className="mt-4">No column profile available.</p>; 
    }

    return (
        <div className="mt-6 overflow-auto">
            <table className="min-w-full border-collapse border border-gray-200 dark:border-zinc-700">
                <thead>
                    <tr>
                        <th className="border border-gray-200 px-3 py-2 text-left bg-gray-100 dark:bg-zinc-800 dark:border-zinc-700">
                            Column
                        </th>
                        <th className="border border-gray-200 px-3 py-2 text-left bg-gray-100 dark:bg-zinc-800 dark:border-zinc-700">
                            Type
                        </th>
                        <th className="border border-gray-200 px-3 py-2 text-left bg-gray-100 dark:bg-zinc-800 dark:border-zinc-700">
                            Missing %
                        </th>
                        <th className="border border-gray-200 px-3 py-2 text-left bg-gray-100 dark:bg-zinc-800 dark:border-zinc-700">
                            Unique
                        </th>
                        <th className="border border-gray-200 px-3 py-2 text-left bg-gray-100 dark:bg-zinc-800 dark:border-zinc-700">
                            Key Stat
                        </th>
                    </tr>
                </thead>

                <tbody>
                    {columns.map((col) => {
                        const missingPct = Math.max(0,Math.min(1,col.missing_percentage));
                        const missingPctLabel = formatPercent(missingPct);
                        
                        return (
                            <tr key={col.name}>
                                <td className="border border-gray-200 px-3 py-2 dark:border-zinc-700">
                                    {col.name}
                                </td>

                                <td className="border border-gray-200 px-3 py-2 dark:border-zinc-700">
                                    <span
                                        className={[
                                            "inline-flex items-center rounded px-2 py-1 text-xs font-medium", 
                                            getTypeBadgeClasses(col.detected_type), 
                                        ].join(" ")}
                                    >
                                        {col.detected_type}
                                    </span>
                                </td>

                                <td className="border border-gray-200 px-3 py-2 dark:border-zinc-700">
                                    <div className="flex items-center gap-3">
                                        <div className="h-2 w-32 rounded bg-gray-200 dark:bg-zinc-700">
                                            <div
                                                className="h-2 rounded bg-rose-500"
                                                style={{ width: `${missingPct * 100}%` }}
                                            />
                                        </div>
                                        <span className="text-sm tabular-nums">{missingPctLabel}</span>
                                    </div>
                                </td>

                                <td className="border border-gray-200 px-3 py-2 dark:border-zinc-700 tabular-nums">
                                    {col.unique_count}
                                </td>

                                <td className="border border-gray-200 px-3 py-2 dark:border-zinc-700">
                                    {getKeyStat(col)}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    )
}

"use client";
import { startTransition, useState } from "react";
import type { ColumnProfile, PipelineOperation } from "@/src/lib/types";
import { setRenderedTicks } from "recharts/types/state/renderedTicksSlice";


type OperationType =
    | "drop_columns"
    | "fill_missing"
    | "remove_duplicates"
    | "convert_type"
    | "rename_columns"
    | "one_hot_encode"
    | "label_encode"
    | "standard_scale"
    | "minmax_scale"
    | "handle_outliers";

type OperationPanelProps = {
    columns: ColumnProfile[];
    onAddOperation: (operation: PipelineOperation) => Promise<void>;
    isSubmitting: boolean;
};

export default function OperationPanel({
    columns,
    onAddOperation,
    isSubmitting,
}: OperationPanelProps) {
    const [operationType, setOperationType] = useState<OperationType>("drop_columns");
    const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
    const [fillColumn, setFillColumn] = useState("");
    const [fillStrategy, setFillStrategy] = useState("mean");
    const [fillValue, setFillValue] = useState("");
    const [convertColumn, setConvertColumn] = useState("");
    const [renameColumn, setRenameColumn] = useState("");
    const [newColumnName, setNewColumnName] = useState("");
    const [targetType, setTargetType] = useState("int");
    const [outlierStrategy, setOutlierStrategy] = useState("iqr");
    const [lowerPercentile, setLowerPercentile] = useState("1");
    const [upperPercentile, setUpperPercentile] = useState("99");
    const [error, setError] = useState<string | null>(null);

    function toggleColumn(columnName: string) {
        setSelectedColumns((prev) =>
            prev.includes(columnName)
                ? prev.filter((c) => c !== columnName)
                : [...prev, columnName]
        );
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);

        let operation: PipelineOperation;

        try {
            if (operationType === "drop_columns") {
                if (selectedColumns.length === 0) {
                    setError("Select at least one column to drop.");
                    return;
                }
                operation = { type: "drop_columns", params: { columns: selectedColumns } };
            } else if (operationType === "fill_missing") {
                if (!fillColumn) {
                    setError("Select a column for fill missing.");
                    return;
                }
                const colProfile = columns.find(c => c.name === fillColumn);
                if (colProfile) {
                    if ((fillStrategy === "mean" || fillStrategy === "median") && colProfile.detected_type !== "Numerical") {
                        setError(`Strategy '${fillStrategy}' only works on Numerical columns. '${fillColumn}' is of type '${colProfile.detected_type}'.`);
                        return;
                    }
                }

                if (fillStrategy === "constant" && !fillValue.trim()) {
                    setError("Please specify a constant value to fill missing data.");
                    return;
                }
                operation = {
                    type: "fill_missing",
                    params: {
                        column: fillColumn,
                        strategy: fillStrategy,
                        ...(fillStrategy === "constant" ? { value: fillValue } : {}),
                    },
                };
            } else if (operationType === "remove_duplicates") {
                operation = { type: "remove_duplicates", params: {} };
            } else if (operationType === "rename_columns") {
                if (!renameColumn) {
                    setError("Select a column to rename.");
                    return;
                }
                if (!newColumnName.trim()) {
                    setError("Specify a new name for the column.");
                    return;
                }

                if (columns.some(c => c.name === newColumnName.trim() && c.name !== renameColumn)) {
                    setError(`A column named '${newColumnName}' already exists.`);
                    return;
                }

                operation = {
                    type: "rename_columns",
                    params: {
                        columns_map: { [renameColumn]: newColumnName.trim() }
                    }
                };
            } else if (operationType === "one_hot_encode") {
                if (selectedColumns.length === 0) {
                    setError("Select at least one column to one-hot encode.")
                    return;
                }
                operation = {
                    type: "one_hot_encode",
                    params: { columns: selectedColumns }
                };
            } else if (operationType == "label_encode") {
                if (selectedColumns.length === 0) {
                    setError("Select at leat one column to label encode.")
                    return;
                }
                operation = {
                    type: "label_encode",
                    params: { columns: selectedColumns }
                };
            } else if (operationType === "standard_scale") {
                if (selectedColumns.length === 0) {
                    setError("Select at least one column to standard scale.")
                    return;
                }

                operation = {
                    type: "standard_scale",
                    params: { columns: selectedColumns }
                };
            } else if (operationType === "minmax_scale") {
                if (selectedColumns.length === 0) {
                    setError("Select at least one column to min-max scale.")
                    return;
                }
                operation = {
                    type: "minmax_scale",
                    params: { columns: selectedColumns }
                };
            } else if (operationType === "handle_outliers") {
                if (selectedColumns.length === 0) {
                    setError("Select at least one column to handle outliers.")
                    return;
                }
                const params: Record<string, any> = {
                    columns: selectedColumns,
                    strategy: outlierStrategy,
                };
                if (outlierStrategy === "percentile") {
                    const lp = parseFloat(lowerPercentile);
                    const up = parseFloat(upperPercentile);
                    if (isNaN(lp) || lp < 0 || lp > 50) {
                        setError("Lower percentile must be a number between 0 and 50.");
                        return;
                    }
                    if (isNaN(up) || up < 50 || up > 100) {
                        setError("Upper percentile must be a number between 50 and 100.");
                        return;
                    }
                    if (lp >= up) {
                        setError("Lower percentile must be less than upper percentile");
                        return;
                    }
                    params.lower_percentile = lp;
                    params.upper_percentile = up;
                }
                operation = {
                    type: "handle_outliers",
                    params,
                };
            } else {
                if (!convertColumn) {
                    setError("Select a column to convert.")
                    return;
                }
                operation = {
                    type: "convert_type",
                    params: { column: convertColumn, target_type: targetType },
                };
            }

            await onAddOperation(operation);

            setSelectedColumns([]);
            setFillColumn("");
            setFillValue("");
            setConvertColumn("");
            setRenameColumn("");
            setNewColumnName("");
            setOutlierStrategy("iqr");
            setLowerPercentile("1");
            setUpperPercentile("99");

        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to add operation.");
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className="mb-2 block text-sm text-zinc-400">Operation</label>
                <select
                    value={operationType}
                    onChange={(e) => setOperationType(e.target.value as OperationType)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none focus:border-zinc-500"
                >
                    <option value="drop_columns">Drop Columns</option>
                    <option value="fill_missing">Fill Missing</option>
                    <option value="remove_duplicates">Remove Duplicates</option>
                    <option value="convert_type">Convert Type</option>
                    <option value="rename_columns">Rename Column</option>
                    <option value="one_hot_encode">One-Hot Encode</option>
                    <option value="label_encode">Label Encode</option>
                    <option value="standard_scale">Standard Scale</option>
                    <option value="minmax_scale">Min-Max Scale</option>
                    <option value="handle_outliers">Handle Outliers</option>
                </select>
            </div>

            {operationType === "drop_columns" && (
                <div className="max-h-48 space-y-2 overflow-auto rounded-lg border border-zinc-800 p-3">
                    {columns.map((col) => (
                        <label key={col.name} className="flex items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={selectedColumns.includes(col.name)}
                                onChange={() => toggleColumn(col.name)}
                            />
                            {col.name}
                        </label>
                    ))}
                </div>
            )}

            {operationType === "fill_missing" && (
                <div className="space-y-3">
                    <select
                        value={fillColumn}
                        onChange={(e) => setFillColumn(e.target.value)}
                        className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100"
                    >
                        <option value="">Select column</option>
                        {columns.map((col) => (
                            <option value={col.name} key={col.name}>{col.name}</option>
                        ))}
                    </select>

                    <select
                        value={fillStrategy}
                        onChange={(e) => setFillStrategy(e.target.value)}
                        className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100"
                    >
                        <option value="mean">Mean</option>
                        <option value="median">Median</option>
                        <option value="mode">Mode</option>
                        <option value="constant">Constant</option>
                    </select>

                    {fillStrategy === "constant" && (
                        <input
                            type="text"
                            value={fillValue}
                            onChange={(e) => setFillColumn(e.target.value)}
                            placeholder="Constant value"
                            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100"
                        />
                    )}
                </div>
            )}

            {operationType === "convert_type" && (
                <div className="space-y-3">
                    <select
                        value={convertColumn}
                        onChange={(e) => setConvertColumn(e.target.value)}
                        className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100"
                    >
                        <option value="">Select column</option>
                        {columns.map((col) => (
                            <option key={col.name} value={col.name}>
                                {col.name}
                            </option>
                        ))}
                    </select>
                    <select
                        value={targetType}
                        onChange={(e) => setTargetType(e.target.value)}
                        className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100"
                    >
                        <option value="int">Integer</option>
                        <option value="float">Float</option>
                        <option value="string">String</option>
                        <option value="category">Category</option>
                    </select>
                </div>
            )}

            {operationType === "rename_columns" && (
                <div className="space-y-3">
                    <select
                        value={renameColumn}
                        onChange={(e) => setRenameColumn(e.target.value)}
                        className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100"
                    >
                        <option value="">Select column</option>
                        {columns.map((col) => (
                            <option key={col.name} value={col.name}>
                                {col.name}
                            </option>
                        ))}
                    </select>
                    <input
                        type="text"
                        value={newColumnName}
                        onChange={(e) => setNewColumnName(e.target.value)}
                        placeholder="New column name"
                        className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100"
                    />
                </div>
            )}

            {operationType === "one_hot_encode" && (
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm text-zinc-400 font-medium">Select columns to encode:</label>
                        <div className="max-h-48 space-y-2 overflow-auto rounded-lg border border-zinc-850 bg-zinc-950/20 p-3">
                            {columns
                                .filter((col) => ["Categorical", "Text", "Boolean"].includes(col.detected_type))
                                .map((col) => (
                                    <label key={col.name} className="flex items-center gap-2 text-sm text-zinc-300 select-none">
                                        <input
                                            type="checkbox"
                                            checked={selectedColumns.includes(col.name)}
                                            onChange={() => toggleColumn(col.name)}
                                        />
                                        {col.name} <span className="text-xs text-zinc-500">({col.detected_type})</span>
                                    </label>
                                ))
                            }
                        </div>
                    </div>
                    {selectedColumns.length > 0 && (
                        <div className="rounded-lg border border-r-emerald-800/40 bg-emerald-950/10 p-3 space-y-1.5 animate-fade-in">
                            <span className="block text-xs font-semibold text-emerald-400 uppercase tracking-wide">Encoding Impact Estimate</span>
                            <div className="divide-y divide-emerald-950/40 font-mono text-xs">
                                {selectedColumns.map((colName) => {
                                    const col = columns.find((c) => c.name === colName);
                                    if (!col) return null;
                                    return (
                                        <div key={colName} className="flex justify-between py-1 text-zinc-300">
                                            <span>{colName}</span>
                                            <span>Unique: <strong className="text-emerald-400">{col.unique_count}</strong> → adds <strong className="text-emerald-400">+{col.unique_count}</strong>columns</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {operationType === "label_encode" && (
                <div className="space-y-2">
                    <label className="text-sm text-zinc-400">Select columns to encode:</label>
                    <div className="max-h-48 space-y-2 overflow-auto rounded-lg border border-zinc-800 p-3">
                        {columns
                            .filter((col) => ["Categorical", "Text", "Boolean"].includes(col.detected_type))
                            .map((col) => (
                                <label key={col.name} className="flex items-center gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={selectedColumns.includes(col.name)}
                                        onChange={() => toggleColumn(col.name)}
                                    />
                                    {col.name} <span className="text-xs text-zinc-500">({col.detected_type})</span>
                                </label>
                            ))
                        }
                    </div>
                </div>
            )}

            {operationType === "standard_scale" && (
                <div className="space-y-2">
                    <label className="text-sm text-zinc-400">Select columns to standard scale:</label>
                    <div className="max-h-48 space-y-2 overflow-auto rounded-lg border border-zinc-800 p-3">
                        {columns
                            .filter((col) => col.detected_type === "Numerical")
                            .map((col) => (
                                <label key={col.name} className="flex items-center gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={selectedColumns.includes(col.name)}
                                        onChange={() => toggleColumn(col.name)}
                                    />
                                    {col.name} <span className="text-xs text-zinc-500">({col.detected_type})</span>
                                </label>
                            ))
                        }
                    </div>
                </div>
            )}

            {operationType === "minmax_scale" && (
                <div className="space-y-2">
                    <label className="text-sm text-zinc-400">Select columns to min-max scale:</label>
                    <div className="max-h-48 space-y-2 overflow-auto rounded-lg border border-zinc-800 p-3">
                        {columns
                            .filter((col) => col.detected_type === "Numerical")
                            .map((col) => (
                                <label key={col.name} className="flex items-center gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={selectedColumns.includes(col.name)}
                                        onChange={() => toggleColumn(col.name)}
                                    />
                                    {col.name} <span className="text-xs text-zinc-500">({col.detected_type})</span>
                                </label>
                            ))
                        }
                    </div>
                </div>
            )}

            {operationType === "handle_outliers" && (
                <div className="space-y-3">
                    <label className="text-sm text-zinc-400">Select columns to handle outliers:</label>
                    <div className="max-h-48 space-y-2 overflow-auto rounded-lg border border-zinc-800 p-3">
                        {columns
                            .filter((col) => col.detected_type === "Numerical")
                            .map((col) => (
                                <label key={col.name} className="flex items-center gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={selectedColumns.includes(col.name)}
                                        onChange={() => toggleColumn(col.name)}
                                    />
                                    {col.name} <span className="text-xs text-zinc-500">({col.detected_type})</span>
                                </label>
                            ))}
                    </div>

                    <div>
                        <label className="block text-sm text-zinc-400 mb-1">Capping Strategy</label>
                        <select
                            value={outlierStrategy}
                            onChange={(e) => setOutlierStrategy(e.target.value)}
                            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100"
                        >
                            <option value="iqr">IQR (Interquartile Range - 1.5x)</option>
                            <option value="percentile">Percentile (e.g. 1st & 99th)</option>
                        </select>
                    </div>

                    {outlierStrategy === "percentile" && (
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs text-zinc-500 mb-1">Lower Percentile</label>
                                <input
                                    type="number"
                                    value={lowerPercentile}
                                    onChange={(e) => setLowerPercentile(e.target.value)}
                                    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100"
                                    min="0"
                                    max="50"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-zinc-500 mb-1">Upper Percentile</label>
                                <input
                                    type="number"
                                    value={upperPercentile}
                                    onChange={(e) => setUpperPercentile(e.target.value)}
                                    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100"
                                    min="50"
                                    max="100"
                                />
                            </div>
                        </div>
                    )}

                </div>
            )}

            {error && <p className="text-sm text-rose-400">{error}</p>}

            <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-lg bg-zinc-100 px-4 py-2.5 text-sm font-medium text-zinc-900 transition hover:bg-white disabled:opacity-50"
            >
                {isSubmitting ? "Adding..." : "Add Operation"}
            </button>
        </form>
    );
}



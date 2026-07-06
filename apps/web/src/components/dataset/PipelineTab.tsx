"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
    getPipeline,
    addPipelineOperation,
    deletePipelineOperation,
    previewPipeline,
    runPipeline,
    downloadDataset,
} from "../../lib/api";
import type { DatasetProfile, PipelineOperation, PipelinePreviewResponse, PipelineResponse } from "../../lib/types";
import OperationPanel from "../pipeline/OperationPanel";
import PipelinePreview from "../pipeline/PipelinePreview";

interface PipelineTabProps {
    datasetId: string;
    columns: any[];
    originalRowCount: number;
    originalColumnCount: number;
    onUploadSuccess: (newDatasetId: string) => void;
}

export default function PipelineTab({
    datasetId,
    columns,
    originalRowCount,
    originalColumnCount,
    onUploadSuccess,
}: PipelineTabProps) {
    const [pipeline, setPipeline] = useState<PipelineResponse | null>(null);
    const [preview, setPreview] = useState<PipelinePreviewResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [isSubmittingOp, setIsSubmittingOp] = useState(false);
    const [isRunning, setIsRunning] = useState(false);
    const [previewError, setPreviewError] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [runResult, setRunResult] = useState<{ new_dataset_id: string; rows: number; columns: number; filename: string } | null>(null);

    // Initial load: Fetch existing pipeline or create placeholder
    useEffect(() => {
        async function fetchOrCreatePipeline() {
            setLoading(true);
            try {
                // Fetch list of pipelines for this dataset
                const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/pipelines?dataset_id=${datasetId}`);
                const list = await response.json();
                if (list.length > 0) {
                    setPipeline(list[0]);
                } else {
                    // Create one if none exists
                    const createRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/pipelines/`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ dataset_id: datasetId, name: "Cleaning pipeline" }),
                    });
                    const createData = await createRes.json();
                    setPipeline({
                        pipeline_id: createData.pipeline_id,
                        name: "Cleaning pipeline",
                        dataset_id: datasetId,
                        operations: [],
                        status: "draft",
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    });
                }
            } catch (err) {
                setError("Failed to initialize pipeline builder.");
            } finally {
                setLoading(false);
            }
        }
        fetchOrCreatePipeline();
    }, [datasetId]);

    // Live preview sync
    const refreshPreview = useCallback(async (pipelineId: string) => {
        setPreviewLoading(true);
        setPreviewError(null);
        try {
            const result = await previewPipeline(pipelineId, 100);
            setPreview(result);
        } catch (err) {
            setPreviewError(err instanceof Error ? err.message : "Preview failed.");
        } finally {
            setPreviewLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!pipeline) return;
        const timer = setTimeout(() => {
            if (pipeline.operations.length > 0) {
                refreshPreview(pipeline.pipeline_id);
            } else {
                setPreview(null);
                setPreviewError(null);
            }
        }, 400);
        return () => clearTimeout(timer);
    }, [pipeline, refreshPreview]);

    // Add operation
    async function handleAddOperation(operation: PipelineOperation) {
        if (!pipeline) return;
        setIsSubmittingOp(true);
        try {
            const updated = await addPipelineOperation(pipeline.pipeline_id, operation);
            setPipeline(updated);
        } finally {
            setIsSubmittingOp(false);
        }
    }

    // Delete operation
    async function handleDeleteOperation(index: number) {
        if (!pipeline) return;
        try {
            const updated = await deletePipelineOperation(pipeline.pipeline_id, index);
            setPipeline(updated);
        } catch (err) {
            alert("Failed to delete operation");
        }
    }

    // Move operation index (Reordering)
    async function handleMoveOperation(index: number, direction: "up" | "down") {
        if (!pipeline) return;
        const ops = [...pipeline.operations];
        const targetIndex = direction === "up" ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= ops.length) return;

        // Swap
        const temp = ops[index];
        ops[index] = ops[targetIndex];
        ops[targetIndex] = temp;

        try {
            // Replace operations array on the backend
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/pipelines/${pipeline.pipeline_id}/operations`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(ops),
            });
            if (!response.ok) throw new Error("Failed to reorder operations");
            const updated = await response.json();
            setPipeline(updated);
        } catch (err) {
            alert(err instanceof Error ? err.message : "Failed to move operation");
        }
    }

    // Run pipeline
    async function handleRun() {
        if (!pipeline) return;
        setIsRunning(true);
        setRunResult(null);
        setError(null);
        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/pipelines/${pipeline.pipeline_id}/run`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
            });
            if (!response.ok) {
                const text = await response.text();
                throw new Error(text || "Failed to execute pipeline");
            }
            const result = await response.json();
            setRunResult(result);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Run failed.");
        } finally {
            setIsRunning(false);
        }
    }

    // Compute estimated impact metrics based on operations array
    const getEstimatedImpact = () => {
        let columnsRemoved = 0;
        let missingValuesFilled = 0;
        let rowsRemoved = 0;

        pipeline?.operations.forEach((op) => {
            if (op.type === "drop_columns") {
                columnsRemoved += (op.params.columns as string[])?.length || 0;
            }
            if (op.type === "fill_missing") {
                const colName = op.params.column as string;
                const col = columns.find((c) => c.name === colName);
                if (col) {
                    missingValuesFilled += col.missing_count;
                }
            }
        });

        if (preview && originalRowCount) {
            rowsRemoved = Math.max(0, originalRowCount - preview.rows);
        }

        return { columnsRemoved, missingValuesFilled, rowsRemoved };
    };

    const impact = getEstimatedImpact();

    if (loading) {
        return <div className="text-zinc-500 py-10 text-center">Loading pipeline data...</div>;
    }

    if (error && !pipeline) {
        return <div className="text-rose-400 py-10 text-center">{error}</div>;
    }

    return (
        <div className="space-y-8">
            {/* Header section with run button */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-850 pb-6">
                <div>
                    <h3 className="text-xl font-bold text-zinc-100">Dataset Cleaning Pipeline</h3>
                    <p className="text-xs text-zinc-400">Configure sequential transformations to clean your dataset</p>
                </div>
                <button
                    onClick={handleRun}
                    disabled={isRunning || (pipeline?.operations.length || 0) === 0}
                    className="rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-950/20"
                >
                    {isRunning ? "Executing Pipeline..." : "Execute Pipeline →"}
                </button>
            </div>

            {/* Success screen card */}
            {runResult && (
                <div className="rounded-xl border border-emerald-800 bg-emerald-950/20 p-5 space-y-3 animate-fade-in">
                    <h4 className="font-semibold text-emerald-400 flex items-center gap-2">
                        <span>✅ Pipeline executed successfully</span>
                    </h4>
                    <p className="text-sm text-zinc-300">
                        A clean, versioned dataset has been generated: <strong className="text-white font-mono">{runResult.filename}</strong> with <strong>{runResult.rows}</strong> rows and <strong>{runResult.columns}</strong> columns.
                    </p>
                    <div className="flex gap-2">
                        <button
                            onClick={() => onUploadSuccess(runResult.new_dataset_id)}
                            className="inline-flex rounded-lg bg-emerald-800/80 px-4 py-2 text-xs font-medium text-white transition hover:bg-emerald-700"
                        >
                            Open Transformed Profile
                        </button>
                        <button
                            onClick={async () => {
                                try {
                                    await downloadDataset(runResult.new_dataset_id, runResult.filename);
                                } catch (err) {
                                    alert("Failed to download dataset");
                                }
                            }}
                            className="inline-flex rounded-lg border border-emerald-800 bg-emerald-950/30 px-4 py-2 text-xs font-medium text-emerald-400 transition hover:bg-emerald-900/40"
                        >
                            Download Cleaned Dataset
                        </button>
                    </div>
                </div>
            )}

            {error && (
                <div className="rounded-xl border border-rose-900 bg-rose-950/20 p-4 text-rose-400 text-sm">
                    ❌ {error}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* Pipeline Impact Summary & Operations (Left - 60%) */}
                <div className="lg:col-span-3 space-y-6">
                    {/* Impact Summary Card */}
                    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
                        <h4 className="text-sm font-bold text-zinc-300 uppercase tracking-wide">Pipeline Impact (Estimated)</h4>
                        <div className="mt-4 grid grid-cols-3 gap-4 text-center">
                            <div className="rounded-lg bg-zinc-950 p-3">
                                <span className="block text-xs text-zinc-500">Columns Removed</span>
                                <span className={`text-lg font-semibold font-mono ${impact.columnsRemoved > 0 ? "text-rose-400" : "text-zinc-400"}`}>
                                    -{impact.columnsRemoved}
                                </span>
                            </div>
                            <div className="rounded-lg bg-zinc-950 p-3">
                                <span className="block text-xs text-zinc-500">Missing Filled</span>
                                <span className={`text-lg font-semibold font-mono ${impact.missingValuesFilled > 0 ? "text-emerald-400" : "text-zinc-400"}`}>
                                    +{impact.missingValuesFilled}
                                </span>
                            </div>
                            <div className="rounded-lg bg-zinc-950 p-3">
                                <span className="block text-xs text-zinc-500">Rows Filtered</span>
                                <span className={`text-lg font-semibold font-mono ${impact.rowsRemoved > 0 ? "text-rose-400" : "text-zinc-400"}`}>
                                    -{impact.rowsRemoved}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Operation Panel */}
                    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
                        <h4 className="text-sm font-bold text-zinc-300 uppercase tracking-wide mb-4">Add Pipeline Step</h4>
                        <OperationPanel
                            columns={columns}
                            onAddOperation={handleAddOperation}
                            isSubmitting={isSubmittingOp}
                        />
                    </div>
                </div>

                {/* Live Step Sequence Card List & Preview (Right - 40%) */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 space-y-4">
                        <h4 className="text-sm font-bold text-zinc-300 uppercase tracking-wide">Step Sequence</h4>
                        {(pipeline?.operations.length || 0) === 0 ? (
                            <p className="text-xs text-zinc-500 py-6 text-center">No transformations added yet.</p>
                        ) : (
                            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                                {pipeline?.operations.map((op, idx) => {
                                    // Parse formatting for cleaner labels
                                    let subtitle = "";
                                    if (op.type === "drop_columns") {
                                        subtitle = `Columns: ${(op.params.columns as string[]).join(", ")}`;
                                    } else if (op.type === "fill_missing") {
                                        subtitle = `Column: ${op.params.column} (Strategy: ${op.params.strategy})`;
                                    } else if (op.type === "one_hot_encode") {
                                        subtitle = `Columns: ${(op.params.columns as string[]).join(", ")}`;
                                    } else if (op.type === "label_encode") {
                                        subtitle = `Columns: ${(op.params.columns as string[]).join(", ")}`;
                                    } else {
                                        subtitle = JSON.stringify(op.params);
                                    }

                                    return (
                                        <div key={idx} className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 flex items-center justify-between text-xs transition hover:border-zinc-700">
                                            <div className="space-y-1">
                                                <div className="font-semibold text-zinc-200">
                                                    Step {idx + 1}: <span className="capitalize">{op.type.replace("_", " ")}</span>
                                                </div>
                                                <div className="text-zinc-500 font-mono truncate max-w-[200px]" title={subtitle}>
                                                    {subtitle}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-1.5 ml-2">
                                                <button
                                                    onClick={() => handleMoveOperation(idx, "up")}
                                                    disabled={idx === 0}
                                                    title="Move Step Up"
                                                    className="text-zinc-500 hover:text-zinc-300 disabled:opacity-20 cursor-pointer"
                                                >
                                                    ▲
                                                </button>
                                                <button
                                                    onClick={() => handleMoveOperation(idx, "down")}
                                                    disabled={pipeline && idx === pipeline.operations.length - 1}
                                                    title="Move Step Down"
                                                    className="text-zinc-500 hover:text-zinc-300 disabled:opacity-20 cursor-pointer"
                                                >
                                                    ▼
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteOperation(idx)}
                                                    title="Delete Step"
                                                    className="text-zinc-500 hover:text-rose-400 pl-1"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Preview Table Container */}
                    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="text-sm font-bold text-zinc-300 uppercase tracking-wide">Live Preview</h4>
                            {preview && (
                                <span className="text-[10px] text-zinc-500 font-mono">
                                    Cols: {originalColumnCount}→{preview.columns} | Rows: {originalRowCount}→{preview.rows}
                                </span>
                            )}
                        </div>
                        <PipelinePreview
                            rows={preview?.rows ?? null}
                            columns={preview?.columns ?? null}
                            previewRows={preview?.preview ?? []}
                            isLoading={previewLoading}
                            error={previewError}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

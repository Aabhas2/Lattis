"use client";

import { useCallback, useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
    createPipeline,
    getDatasetProfile,
    addPipelineOperation,
    previewPipeline,
    runPipeline,
    deletePipelineOperation,
} from "@/src/lib/api";
import type {
    DatasetProfile,
    PipelineOperation,
    PipelinePreviewResponse,
    PipelineResponse,
} from "@/src/lib/types";
import PipelineHeader from "@/src/components/pipeline/PipelineHeader";
import OperationPanel from "@/src/components/pipeline/OperationPanel";
import PipelinePreview from "@/src/components/pipeline/PipelinePreview";

function PipelinePageContent() {
    const searchParams = useSearchParams();
    const datasetId = searchParams.get("dataset_id");

    const [profile, setProfile] = useState<DatasetProfile | null>(null);
    const [pipeline, setPipeline] = useState<PipelineResponse | null>(null);
    const [preview, setPreview] = useState<PipelinePreviewResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [isSubmittingOp, setIsSubmittingOp] = useState(false);
    const [isRunning, setIsRunning] = useState(false);
    const [previewError, setPreviewError] = useState<string | null>(null);
    const [pageError, setPageError] = useState<string | null>(null);
    const [runMessage, setRunMessage] = useState<string | null>(null);
    const [runResult, setRunResult] = useState<{ new_dataset_id: string; rows: number; columns: number } | null>(null);

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
        async function init() {
            if (!datasetId) {
                setLoading(false);
                setPageError("Missing dataset_id in URL. Open this page from the dataset profile.");
                return;
            }

            try {
                const datasetProfile = await getDatasetProfile(datasetId);
                const created = await createPipeline(datasetId, "Cleaning pipeline");
                const pipelineData: PipelineResponse = {
                    pipeline_id: created.pipeline_id,
                    name: "Cleaning pipeline",
                    dataset_id: datasetId,
                    operations: [],
                    status: "draft",
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                };

                setProfile(datasetProfile);
                setPipeline(pipelineData);
            } catch (err) {
                setPageError(err instanceof Error ? err.message : "Failed to initialize pipeline.");
            } finally {
                setLoading(false);
            }
        }

        init();
    }, [datasetId]);

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

    async function handleDeleteOperation(index: number) {
        if (!pipeline) return;

        try {
            const updated = await deletePipelineOperation(pipeline.pipeline_id, index);
            setPipeline(updated);
        } catch (err) {
            alert(err instanceof Error ? err.message : "Failed to delete operation");
        }
    }

    async function handleRun() {
        if (!pipeline) return;

        setIsRunning(true);
        setRunMessage(null);
        setRunResult(null);

        try {
            const result = await runPipeline(pipeline.pipeline_id) as any;
            setRunResult(result);
        } catch (err) {
            setRunMessage(err instanceof Error ? err.message : "Run failed.")
        } finally {
            setIsRunning(false);
        }
    }

    const totalMissingValues = profile?.columns.reduce((sum, col) => sum + col.missing_count, 0) ?? 0;

    if (loading) {
        return (
            <main className="min-h-screen bg-zinc-950 text-zinc-100">
                <div className="mx-auto max-w-6xl px-6 py-10">Loading pipeline builder...</div>
            </main>
        );
    }

    if (pageError || !profile || !pipeline) {
        return (
            <main className="min-h-screen bg-zinc-950 text-zinc-100">
                <div className="mx-auto max-w-6xl px-6 py-10">
                    <p className="text-rose-400">{pageError ?? "Failed to load pipeline page."}</p>
                    <Link href="/" className="mt-4 inline-block text-sm text-zinc-400 hover:text-zinc-200">
                        Back to upload</Link>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-zinc-950 text-zinc-100">
            <div className="mx-auto max-w-6xl px-6 py-10 space-y-10">
                <Link href={`/?dataset_id=${datasetId}`} className="text-sm text-zinc-400 hover:text-zinc-200">
                    ← Back to dataset profile
                </Link>

                <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 space-y-6">
                    <PipelineHeader
                        pipelineName={pipeline.name ?? "Pipeline"}
                        datasetId={pipeline.dataset_id}
                        operationCount={pipeline.operations.length}
                        status={pipeline.status}
                        isRunning={isRunning}
                        onRun={handleRun}
                    />

                    <div className="grid grid-cols-2 gap-4 rounded-xl border border-zinc-800 bg-zinc-950 p-4 sm:grid-cols-4">
                        <div>
                            <span className="block text-xs text-zinc-500 uppercase">Dataset Name</span>
                            <span className="text-sm font-medium text-zinc-200 truncate block">
                                {profile.filename}
                            </span>
                        </div>
                        <div>
                            <span className="block text-xs text-zinc-500 uppercase">Original Rows</span>
                            <span className="text-sm font-medium text-zinc-200">{profile.row_count}</span>
                        </div>
                        <div>
                            <span className="block text-xs text-zinc-500 uppercase">Original Columns</span>
                            <span className="text-sm font-medium text-zinc-200">{profile.column_count}</span>
                        </div>
                        <div>
                            <span className="block text-xs text-zinc-500 uppercase">Missing Values</span>
                            <span className="text-sm font-medium text-zinc-200">{totalMissingValues}</span>
                        </div>
                    </div>

                    {runResult && (
                        <div className="rounded-xl border border-emerald-800 bg-emerald-950/20 p-4 text-zinc-100 space-y-2">
                            <h4 className="font-semibold text-emerald-400 flex items-center gap-2">
                                <span>✅ Pipeline executed successfully</span>
                            </h4>
                            <p className="text-sm text-zinc-400">
                                Transformed dataset created with <strong>{runResult.rows}</strong> rows and <strong>{runResult.columns}</strong> columns.
                            </p>
                            <Link
                                href={`/?dataset_id=${runResult.new_dataset_id}`}
                                className="inline-flex items-center gap-1 text-sm font-medium text-emerald-400 hover:text-emerald-300 hover:underline"
                            >
                                View Cleaned Dataset Profile →
                            </Link>
                        </div>
                    )}

                    {runMessage && (
                        <div className="rounded-xl border border-rose-900 bg-rose-950/20 p-4 text-rose-400 text-sm">
                            ❌ {runMessage}
                        </div>
                    )}
                </section>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
                        <h3 className="text-lg font-semibold">Add Operation</h3>
                        <p className="mt-1 text-sm text-zinc-400">
                            Build your cleaning pipeline step by step.
                        </p>

                        <div className="mt-6">
                            <OperationPanel
                                columns={profile.columns}
                                onAddOperation={handleAddOperation}
                                isSubmitting={isSubmittingOp}
                            />
                        </div>

                        {pipeline.operations.length > 0 && (
                            <div className="mt-6">
                                <h4 className="text-sm font-medium text-zinc-300">Current operations</h4>
                                <ul className="mt-2 space-y-2">
                                    {pipeline.operations.map((op, index) => (
                                        <li
                                            key={`${op.type}-${index}`}
                                            className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                                        >
                                            <span className="font-mono text-zinc-300">
                                                {op.type} {JSON.stringify(op.params)}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteOperation(index)}
                                                className="text-zinc-500 hover:text-rose-400 transition pl-2"
                                                title="Delete operation"
                                            >
                                                ✕
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </section>

                    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-semibold">Preview</h3>
                                <p className="mt-1 text-sm text-zinc-400">
                                    Live preview after each operation (debounced).
                                </p>
                            </div>
                            {/* Before vs After stats */}
                            {preview && (
                                <div className="text-right text-xs space-y-1">
                                    <div className="text-zinc-500">
                                        Columns: <span className="text-zinc-300 font-semibold">{profile.column_count}</span> → <span className="text-emerald-400 font-semibold">{preview.columns}</span>
                                    </div>
                                    <div className="text-zinc-500">
                                        Rows: <span className="text-zinc-300 font-semibold">{profile.row_count}</span> → <span className="text-emerald-400 font-semibold">{preview.rows}</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="mt-6">
                            <PipelinePreview
                                rows={preview?.rows ?? null}
                                columns={preview?.columns ?? null}
                                previewRows={preview?.preview ?? []}
                                isLoading={previewLoading}
                                error={previewError}
                            />
                        </div>
                    </section>
                </div>
            </div>
        </main>
    );
}

export default function PipelinePage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-zinc-950 text-zinc-100 p-10">Loading pipeline builder...</div>}>
            <PipelinePageContent />
        </Suspense>
    );
}
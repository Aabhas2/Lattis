"use client";

import { useEffect, useState, Suspense } from "react";
import { getDatasetProfile, downloadDataset } from "../lib/api";
import UploadZone from "../components/dataset/UploadZone";
import { ColumnProfile, DatasetProfile } from "../lib/types";
import DatasetSummary from "../components/dataset/DatasetSummary";
import PreviewTable from "../components/dataset/PreviewTable";
import ColumnInsightCard from "../components/dataset/ColumnInsightCard";
import ColumnDetailModal from "../components/dataset/ColumnDetailModal";
import VisualizationTab from "../components/dataset/VisualizationTab";
import PipelineTab from "../components/dataset/PipelineTab";
import ModelTrainingTab from "../components/dataset/ModelTrainingTab";
import MLSpaceTab from "../components/dataset/MLSpaceTab";
import { useSearchParams } from "next/navigation";

function ProfilePageContent() {
    type PageView = "upload" | "loading" | "profile";
    const [view, setView] = useState<PageView>("upload");
    const [profile, setProfile] = useState<DatasetProfile | null>(null);
    const [isFetchingProfile, setIsFetchingProfile] = useState(false);
    const [selectedColumn, setSelectedColumn] = useState<ColumnProfile | null>(null);
    const [columnSearch, setColumnSearch] = useState("");
    const [activeTab, setActiveTab] = useState<"overview" | "visualize" | "pipeline" | "model_train" | "ml_space">("overview");

    const searchParams = useSearchParams();
    const datasetIdParam = searchParams.get("dataset_id");

    const filteredColumns =
        profile?.columns.filter((column) =>
            column.name.toLowerCase().includes(columnSearch.toLowerCase())
        ) ?? [];

    useEffect(() => {
        if (
            selectedColumn &&
            !filteredColumns.some((column) => column.name === selectedColumn.name)
        ) {
            setSelectedColumn(null);
        }
    }, [columnSearch, filteredColumns, selectedColumn]);

    // Load dataset profile from URL parameter if present
    useEffect(() => {
        if (datasetIdParam) {
            const datasetId = datasetIdParam;

            async function fetchProfile() {
                setIsFetchingProfile(true);
                setView("loading");
                try {
                    const data = await getDatasetProfile(datasetId);
                    setProfile(data);
                    setSelectedColumn(null);
                    setView("profile");
                } catch (error) {
                    console.error("Failed to fetch profile:", error);
                    setView("upload");
                } finally {
                    setIsFetchingProfile(false);
                }
            }
            fetchProfile();
        }
    }, [datasetIdParam]);

    async function handleUploadSuccess(datasetId: string) {
        if (!datasetId) return;
        setIsFetchingProfile(true);
        setView("loading");
        try {
            const profileData = await getDatasetProfile(datasetId);
            setProfile(profileData);
            setSelectedColumn(null);
            setView("profile");
            setActiveTab("overview");
        } catch (error) {
            console.error("Failed to fetch the profile:", error);
            setView("upload");
        } finally {
            setIsFetchingProfile(false);
        }
    }

    // Pre-calculate overview metrics
    const totalMissing = profile?.columns.reduce((sum, col) => sum + col.missing_count, 0) ?? 0;
    const numericCount = profile?.columns.filter(
        (col) =>
            col.detected_type === "Numerical" ||
            col.dtype.toLowerCase().includes("int") ||
            col.dtype.toLowerCase().includes("float")
    ).length ?? 0;

    return (
        <main className="min-h-screen bg-zinc-950 text-zinc-100">
            <div className="mx-auto max-w-6xl px-6 py-10 space-y-8">
                {/* Upload Section */}
                {view === "upload" && (
                    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
                        <h2 className="text-2xl font-semibold">Upload Dataset</h2>
                        <p className="mt-1 text-sm text-zinc-400">
                            Upload a CSV or XLSX file to profile and explore your dataset.
                        </p>
                        <div className="mt-6">
                            <UploadZone onUploadSuccess={handleUploadSuccess} />
                        </div>
                    </section>
                )}

                {view === "loading" && (
                    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
                        <h2 className="text-2xl font-semibold">Analyzing Dataset</h2>
                        <p className="mt-1 text-sm text-zinc-400">
                            Profiling in progress. This may take a few seconds.
                        </p>
                    </section>
                )}

                {view === "profile" && profile && (
                    <div className="space-y-8">
                        {/* Top Profile Header Info Badge */}
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-zinc-800/80">
                            <div>
                                <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-3">
                                    <span>{profile.filename}</span>
                                    {profile.filename.toLowerCase().includes("cleaned") ? (
                                        <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                            Transformed Cleaned Version
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold bg-zinc-550/10 text-zinc-400 border border-zinc-750/30">
                                            Original File
                                        </span>
                                    )}
                                </h1>
                                <p className="text-xs text-zinc-400 mt-1">
                                    ID: <span className="font-mono text-zinc-500">{profile.dataset_id}</span> • Size: <span className="font-semibold text-zinc-300">{profile.row_count.toLocaleString()} rows × {profile.column_count} columns</span>
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={async () => {
                                        try {
                                            await downloadDataset(profile.dataset_id, profile.filename);
                                        } catch (err) {
                                            alert("Failed to download dataset.");
                                        }
                                    }}
                                    className="inline-flex items-center justify-center px-3.5 py-1.5 rounded-lg border border-emerald-800 bg-emerald-950/20 hover:bg-emerald-900/40 text-emerald-400 hover:text-emerald-350 text-xs font-semibold transition shadow-sm"
                                >
                                    Download Dataset
                                </button>
                                <button
                                    onClick={() => {
                                        window.history.pushState({}, "", "/");
                                        setView("upload");
                                        setProfile(null);
                                    }}
                                    className="px-3.5 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-350 hover:text-zinc-100 text-xs font-semibold transition"
                                >
                                    Upload Another
                                </button>
                            </div>
                        </div>

                        {/* Unified Top Navigation Journey */}
                        <div className="flex border-b border-zinc-800">
                            <button
                                onClick={() => setActiveTab("overview")}
                                className={`px-6 py-3 text-sm font-semibold border-b-2 transition ${activeTab === "overview"
                                    ? "border-emerald-500 text-emerald-400"
                                    : "border-transparent text-zinc-400 hover:text-zinc-200"
                                    }`}
                            >
                                Overview & Profiling
                            </button>
                            <button
                                onClick={() => setActiveTab("visualize")}
                                className={`px-6 py-3 text-sm font-semibold border-b-2 transition ${activeTab === "visualize"
                                    ? "border-emerald-500 text-emerald-400"
                                    : "border-transparent text-zinc-400 hover:text-zinc-200"
                                    }`}
                            >
                                Interactive Visualizations
                            </button>
                            <button
                                onClick={() => setActiveTab("pipeline")}
                                className={`px-6 py-3 text-sm font-semibold border-b-2 transition ${activeTab === "pipeline"
                                    ? "border-emerald-500 text-emerald-400"
                                    : "border-transparent text-zinc-400 hover:text-zinc-200"
                                    }`}
                            >
                                Pipeline Builder
                            </button>
                            <button
                                onClick={() => setActiveTab("model_train")}
                                className={`px-6 py-3 text-sm font-semibold border-b-2 transition ${activeTab === "model_train"
                                    ? "border-emerald-500 text-emerald-400"
                                    : "border-transparent text-zinc-400 hover:text-zinc-200"
                                    }`}
                            >
                                Train Model
                            </button>
                            <button
                                onClick={() => setActiveTab("ml_space")}
                                className={`px-6 py-3 text-sm font-semibold border-b-2 transition ${activeTab === "ml_space"
                                    ? "border-emerald-500 text-emerald-400"
                                    : "border-transparent text-zinc-400 hover:text-zinc-200"
                                    }`}
                            >
                                ML Space (3D)
                            </button>
                        </div>

                        {/* Overview Tab */}
                        {activeTab === "overview" && (
                            <>
                                <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
                                    <h2 className="text-2xl font-semibold">Dataset Overview</h2>
                                    <p className="mt-1 text-sm text-zinc-400">
                                        Quick summary of rows, columns, and dataset stats.
                                    </p>
                                    <div className="mt-6">
                                        <DatasetSummary
                                            rowCount={profile.row_count}
                                            columnCount={profile.column_count}
                                            totalMissing={totalMissing}
                                            numericCount={numericCount}
                                        />
                                    </div>
                                </section>

                                {/* Column Insights Cards */}
                                <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
                                    <h2 className="text-2xl font-semibold">Column Insights</h2>
                                    <p className="mt-1 text-sm text-zinc-400">
                                        Detailed stats and top values for each feature.
                                    </p>

                                    <div className="mt-6">
                                        <input
                                            type="text"
                                            value={columnSearch}
                                            onChange={(e) => setColumnSearch(e.target.value)}
                                            placeholder="Search columns..."
                                            className="w-full rounded-lg border border-zinc-750 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none transition placeholder:text-zinc-555 focus:border-zinc-500"
                                        />

                                        <p className="mt-2 text-sm text-zinc-450">
                                            Showing {filteredColumns.length} of {profile.columns.length} columns
                                        </p>

                                        {filteredColumns.length === 0 && columnSearch.trim() !== "" && (
                                            <p className="mt-4 text-sm text-zinc-450">
                                                No columns match your search.
                                            </p>
                                        )}
                                    </div>

                                    <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                                        {filteredColumns.map((col) => (
                                            <ColumnInsightCard
                                                key={col.name}
                                                column={col}
                                                selected={selectedColumn?.name === col.name}
                                                onClick={() => setSelectedColumn(col)}
                                            />
                                        ))}
                                    </div>
                                </section>

                                {/* Dataset Preview */}
                                <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
                                    <h2 className="text-2xl font-semibold">Dataset Preview</h2>
                                    <p className="mt-1 text-sm text-zinc-400">
                                        Raw rows preview (first 10 rows) for quick inspection.
                                    </p>
                                    <div className="mt-6">
                                        <PreviewTable previewRows={profile.preview_rows.slice(0, 10)} />
                                    </div>
                                </section>

                                <ColumnDetailModal
                                    column={selectedColumn}
                                    previewRows={profile.preview_rows}
                                    open={!!selectedColumn}
                                    onClose={() => setSelectedColumn(null)}
                                />
                            </>
                        )}

                        {/* Visualize Tab */}
                        {activeTab === "visualize" && (
                            <VisualizationTab datasetId={profile.dataset_id} columns={profile.columns} />
                        )}

                        {/* Pipeline Tab */}
                        {activeTab === "pipeline" && (
                            <PipelineTab
                                datasetId={profile.dataset_id}
                                columns={profile.columns}
                                originalRowCount={profile.row_count}
                                originalColumnCount={profile.column_count}
                                onUploadSuccess={handleUploadSuccess}
                            />
                        )}

                        {/* Model Training Tab */}
                        {activeTab === "model_train" && (
                            <ModelTrainingTab
                                datasetId={profile.dataset_id}
                                columns={profile.columns}
                                filename={profile.filename}
                            />
                        )}

                        {/* 3D ML Space Tab */}
                        {activeTab === "ml_space" && (
                            <MLSpaceTab
                                datasetId={profile.dataset_id}
                                columns={profile.columns}
                            />
                        )}

                    </div>
                )}
            </div>
        </main>
    );
}

export default function Page() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-zinc-950 text-zinc-100 p-10">Loading page...</div>}>
            <ProfilePageContent />
        </Suspense>
    );
}

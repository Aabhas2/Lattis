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

// Tab SVG Icons
const OverviewIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
);
const VizIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
);
const PipelineIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3h7v4H3zM14 3h7v4h-7zM3 17h7v4H3zM14 17h7v4h-7z"/><line x1="10" y1="5" x2="14" y2="5"/><line x1="10" y1="19" x2="14" y2="19"/><line x1="12" y1="9" x2="12" y2="17"/>
    </svg>
);
const TrainIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
    </svg>
);
const SpaceIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><line x1="4.93" y1="4.93" x2="9.17" y2="9.17"/><line x1="14.83" y1="14.83" x2="19.07" y2="19.07"/><line x1="14.83" y1="9.17" x2="19.07" y2="4.93"/><line x1="4.93" y1="19.07" x2="9.17" y2="14.83"/>
    </svg>
);

const TAB_LABELS: Record<string, string> = {
    overview: "Overview",
    visualize: "Visualizations",
    pipeline: "Pipeline Builder",
    model_train: "Train Model",
    ml_space: "ML Universe",
};

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
        <main className="min-h-screen bg-zinc-950 text-zinc-100 relative">
            {/* Top Right GitHub Star */}
            <div className="absolute top-6 right-6 z-50">
                <a 
                    href="https://github.com/Aabhas2/Lattis" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 text-zinc-300 hover:text-zinc-100 text-xs font-semibold transition backdrop-blur-sm"
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.03-2.683-.103-.253-.447-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>
                    </svg>
                    Star on GitHub
                </a>
            </div>

            <div className="mx-auto max-w-6xl px-6 py-10 space-y-8">
                {/* Hero Landing Section */}
                {view === "upload" && (
                    <div className="space-y-10">
                        {/* Hero Header */}
                        <div className="text-center flex flex-col items-center pt-8 lg:pt-12">
                            <div className="mb-6 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/5 text-emerald-400 text-[10px] md:text-xs font-semibold uppercase tracking-widest z-10 relative">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                Open Source · No Sign-in Required
                            </div>
                            
                            {/* Logo Container with vertical cropping */}
                            <div className="relative w-full max-w-[280px] md:max-w-[380px] lg:max-w-[460px] h-[80px] md:h-[100px] lg:h-[120px] flex justify-center items-center mb-6 overflow-hidden z-0">
                                <img 
                                    src="/logo.png" 
                                    alt="Lattis" 
                                    className="absolute w-full h-auto object-cover drop-shadow-[0_0_35px_rgba(16,185,129,0.25)] hover:scale-[1.02] transition-transform duration-300 cursor-pointer" 
                                />
                            </div>

                            <p className="text-sm md:text-base lg:text-lg text-zinc-400 max-w-2xl mx-auto leading-relaxed relative z-10 font-medium">
                                An interactive machine learning studio. Upload a dataset, build pipelines, train models, and explore predictions in an immersive 3D universe.
                            </p>
                        </div>

                        {/* Feature Highlights */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {[
                                {
                                    icon: (
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                                        </svg>
                                    ),
                                    title: "Upload & Profile",
                                    desc: "Auto-detect column types, missing values, distributions and outliers instantly."
                                },
                                {
                                    icon: (
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
                                        </svg>
                                    ),
                                    title: "Train ML Models",
                                    desc: "Random Forest, XGBoost, LightGBM, SVM, Logistic Regression and more — async background training."
                                },
                                {
                                    icon: (
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                                            <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/>
                                            <line x1="4.93" y1="4.93" x2="9.17" y2="9.17"/><line x1="14.83" y1="14.83" x2="19.07" y2="19.07"/>
                                        </svg>
                                    ),
                                    title: "ML Universe",
                                    desc: "Explore your dataset and model predictions in a fully interactive Three.js 3D universe."
                                }
                            ].map((feat, i) => (
                                <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 space-y-3 hover:border-zinc-700 transition">
                                    <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                                        {feat.icon}
                                    </div>
                                    <h3 className="font-semibold text-zinc-100">{feat.title}</h3>
                                    <p className="text-xs text-zinc-400 leading-relaxed">{feat.desc}</p>
                                </div>
                            ))}
                        </div>

                        {/* Upload Zone */}
                        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-8">
                            <div className="mb-5">
                                <h2 className="text-xl font-bold text-zinc-100">Upload Your Dataset</h2>
                                <p className="mt-1 text-sm text-zinc-400">Supports CSV and XLSX. Your data stays local — nothing is sent to third parties.</p>
                            </div>
                            <UploadZone onUploadSuccess={handleUploadSuccess} />
                        </div>
                    </div>
                )}

                {view === "loading" && (
                    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-10 flex flex-col items-center gap-4 min-h-[200px] justify-center">
                        <div className="relative">
                            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-emerald-500"></div>
                        </div>
                        <div className="text-center">
                            <h2 className="text-base font-semibold text-zinc-200">Analyzing Dataset</h2>
                            <p className="mt-1 text-sm text-zinc-400">Profiling in progress. This may take a few seconds.</p>
                        </div>
                    </section>
                )}

                {view === "profile" && profile && (
                    <div className="space-y-8">
                        {/* App Header & Dataset Info */}
                        <div className="pb-6 border-b border-zinc-800/80">
                            <div className="flex items-center gap-3 mb-6 select-none">
                                <div className="relative w-[110px] h-[28px] flex items-center justify-center overflow-hidden cursor-pointer -ml-4" onClick={() => { window.history.pushState({}, "", "/"); setView("upload"); setProfile(null); }}>
                                    <img src="/logo.png" alt="Lattis" className="absolute w-[160%] max-w-none h-auto object-cover hover:opacity-80 transition-opacity" />
                                </div>
                                <span className="text-zinc-700">/</span>
                                <span className="text-sm text-zinc-400 font-medium tracking-wide mt-1">{TAB_LABELS[activeTab] || "Dataset Explorer"}</span>
                            </div>
                            
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
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
                                    <p className="text-xs text-zinc-400 mt-2">
                                        ID: <span className="font-mono text-zinc-500">{profile.dataset_id}</span> • Size: <span className="font-semibold text-zinc-300">{profile.row_count.toLocaleString()} rows × {profile.column_count} columns</span>
                                    </p>
                                </div>
                                <div className="flex gap-3 mt-4 md:mt-0">
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
                    </div>

                        {/* Tab Navigation with icons */}
                        <div className="flex border-b border-zinc-800 overflow-x-auto">
                            {[
                                { key: "overview", label: "Overview", Icon: OverviewIcon },
                                { key: "visualize", label: "Visualizations", Icon: VizIcon },
                                { key: "pipeline", label: "Pipeline Builder", Icon: PipelineIcon },
                                { key: "model_train", label: "Train Model", Icon: TrainIcon },
                                { key: "ml_space", label: "ML Universe", Icon: SpaceIcon },
                            ].map(({ key, label, Icon }) => (
                                <button
                                    key={key}
                                    onClick={() => setActiveTab(key as any)}
                                    className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 whitespace-nowrap transition ${
                                        activeTab === key
                                            ? "border-emerald-500 text-emerald-400"
                                            : "border-transparent text-zinc-400 hover:text-zinc-200"
                                    }`}
                                >
                                    <Icon />
                                    {label}
                                </button>
                            ))}
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

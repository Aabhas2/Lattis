"use client";

import { useEffect, useRef, useState } from "react";
import { ColumnProfile, NumericStats, CategoricalStats } from "../../lib/types";
import { runPrediction } from "../../lib/api";

interface MLSpaceTabProps {
    datasetId: string;
    columns: ColumnProfile[];
}

// SVG icons for mode buttons
const DatasetIcon = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" /><circle cx="4" cy="6" r="2" /><circle cx="20" cy="6" r="2" /><circle cx="4" cy="18" r="2" /><circle cx="20" cy="18" r="2" />
        <line x1="6" y1="6" x2="9" y2="11" /><line x1="18" y1="6" x2="15" y2="11" /><line x1="6" y1="18" x2="9" y2="13" /><line x1="18" y1="18" x2="15" y2="13" />
    </svg>
);
const BoundaryIcon = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 12h20M12 2v20" /><path d="M5 5l14 14" strokeDasharray="2 3" opacity="0.5" />
    </svg>
);
const TreeIcon = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="4" r="2" /><circle cx="6" cy="16" r="2" /><circle cx="18" cy="16" r="2" />
        <line x1="12" y1="6" x2="12" y2="10" /><line x1="12" y1="10" x2="6" y2="14" /><line x1="12" y1="10" x2="18" y2="14" />
    </svg>
);
const PillarsIcon = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="12" width="4" height="9" rx="1" /><rect x="10" y="7" width="4" height="14" rx="1" /><rect x="17" y="3" width="4" height="18" rx="1" />
    </svg>
);
const ClustersIcon = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="6" cy="6" r="3" /><circle cx="18" cy="6" r="3" /><circle cx="12" cy="18" r="3" />
    </svg>
);
const PCAIcon = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v18h18" /><circle cx="9" cy="15" r="2" /><circle cx="15" cy="9" r="2" /><path d="M9 15l6-6" strokeDasharray="2 3" opacity="0.7" />
    </svg>
);
const ExpandIcon = () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
    </svg>
);
const CollapseIcon = () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 3v5H3M21 8h-5V3M3 16h5v5M16 21v-5h5" />
    </svg>
);
const RocketIcon = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
        <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
        <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" /><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </svg>
);
const SettingsIcon = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
);

export default function MLSpaceTab({ datasetId, columns }: MLSpaceTabProps) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const engineRef = useRef<any | null>(null);

    const numericCols = columns.filter(
        c => c.detected_type === "Numerical" ||
            c.dtype.toLowerCase().includes("int") ||
            c.dtype.toLowerCase().includes("float")
    );

    const [xAxis, setXAxis] = useState(numericCols[0]?.name || "");
    const [yAxis, setYAxis] = useState(numericCols[1]?.name || "");
    const [zAxis, setZAxis] = useState(numericCols[2]?.name || "");
    const [activeMode, setActiveMode] = useState<"dataset" | "boundary" | "tree" | "importance">("dataset");

    // Active model state — read from localStorage and updated via storage events
    const [activeModelId, setActiveModelId] = useState<string | null>(null);
    const [activeModelAlgo, setActiveModelAlgo] = useState<string | null>(null);
    const [activeModelTarget, setActiveModelTarget] = useState<string | null>(null);

    const [predInputs, setPredInputs] = useState<Record<string, number>>({});
    const [predLoading, setPredLoading] = useState(false);
    const [predResult, setPredResult] = useState<any | null>(null);
    const [predError, setPredError] = useState<string | null>(null);
    const [predictionNeighbors, setPredictionNeighbors] = useState<number[] | null>(null);
    const [isProbeFlying, setIsProbeFlying] = useState(false);
    const [hoveredItem, setHoveredItem] = useState<any | null>(null);
    const [selectedPoint, setSelectedPoint] = useState<any | null>(null);
    const [datasetInfo, setDatasetInfo] = useState<{ total: number; target: string | null; task_type: string | null } | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showLabels, setShowLabels] = useState(true);
    
    // UI Settings state
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [preset, setPreset] = useState<"cinematic" | "bright" | "high_contrast" | "dark">("cinematic");
    const [pointSizeMultiplier, setPointSizeMultiplier] = useState(1.0);
    const [showGrid, setShowGrid] = useState(true);
    // Read active model from localStorage on mount and listen for changes
    useEffect(() => {
        const readActiveModel = () => {
            setActiveModelId(localStorage.getItem("active_model_job_id"));
            setActiveModelAlgo(localStorage.getItem("active_model_algorithm"));
            setActiveModelTarget(localStorage.getItem("active_model_target"));
        };
        readActiveModel();
        window.addEventListener("storage", readActiveModel);
        return () => window.removeEventListener("storage", readActiveModel);
    }, []);

    // Sync fullscreen state based on Esc keys or browser changes
    useEffect(() => {
        const handleFullscreenChange = () => {
            const isFull = document.fullscreenElement === containerRef.current;
            setIsFullscreen(isFull);
        };
        document.addEventListener("fullscreenchange", handleFullscreenChange);
        return () => {
            document.removeEventListener("fullscreenchange", handleFullscreenChange);
        };
    }, []);

    useEffect(() => {
        if (!canvasRef.current) return;

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                if (width > 0 && height > 0 && engineRef.current) {
                    engineRef.current.sceneManager.resize(width, height);
                    engineRef.current.cameraManager.resize(width, height);
                }
            }
        });

        observer.observe(canvasRef.current);
        return () => observer.disconnect();
    }, []);

    const toggleFullscreen = () => {
        if (!containerRef.current) return;
        if (!document.fullscreenElement) {
            containerRef.current.requestFullscreen().catch(err => {
                console.error("Failed to enter fullscreen mode:", err);
            });
        } else {
            document.exitFullscreen();
        }
    };

    // 1. Initialize custom Three.js UniverseEngine on mount
    useEffect(() => {
        if (!canvasRef.current) return;

        // Import the custom UniverseEngine classes dynamically (created by you in Step 4)
        import("./universe/UniverseEngine").then(({ UniverseEngine }) => {
            const engine = new UniverseEngine({
                canvas: canvasRef.current!,
                datasetId,
                columns,
                xAxis,
                yAxis,
                zAxis,
                mode: activeMode
            });
            engineRef.current = engine;

            engine.onHover((item: any) => {
                setHoveredItem(item);
            });

            engine.onClick((item: any) => {
                setSelectedPoint(item);
            });

            engine.onPredictionLanded((neighbors: number[]) => {
                setPredictionNeighbors(neighbors);
                setIsProbeFlying(false);
            });

            const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
            const url = new URL(`${BASE_URL}/models/datasets/${datasetId}/visualize`);
            if (activeModelId) {
                url.searchParams.append("model_id", activeModelId);
            }

            fetch(url.toString())
                .then(res => {
                    if (!res.ok) throw new Error("Failed to fetch visualization coordinates");
                    return res.json();
                })
                .then(data => {
                    engine.loadData(data);
                    
                    // Infer dataset info
                    const total = data.points?.length || 0;
                    const targetCol = data.target_column;
                    
                    const algo = localStorage.getItem("active_model_algorithm")?.toLowerCase() || "";
                    let task_type = "Classification";
                    
                    // Logistic regression is classification, other regressors are regression
                    if (algo.includes("regress") && !algo.includes("logistic")) {
                        task_type = "Regression";
                    }
                    
                    setDatasetInfo({ total, target: targetCol, task_type });
                })
                .catch(err => console.error("Failed to load visual coordinates:", err));
        });

        // Cleanup on unmount to prevent WebGL context memory leaks
        return () => {
            if (engineRef.current) {
                engineRef.current.destroy();
                engineRef.current = null;
            }
        };
    }, [datasetId, activeModelId]);

    // 2. Propagate axis coordinate changes to the Three.js Engine
    useEffect(() => {
        if (engineRef.current) {
            engineRef.current.updateAxes(xAxis, yAxis, zAxis);
        }
    }, [xAxis, yAxis, zAxis]);

    // 3. Propagate visualization mode changes to the Scene Manager
    useEffect(() => {
        if (engineRef.current) {
            engineRef.current.setMode(activeMode);
        }
    }, [activeMode]);

    // 4. Update Visualization Settings
    useEffect(() => {
        if (engineRef.current) {
            engineRef.current.updateSettings({
                preset,
                pointSizeMultiplier,
                showGrid,
                showLabels
            });
        }
    }, [preset, pointSizeMultiplier, showGrid, showLabels]);

    // Trigger local feature inputs when model parameters are loaded
    useEffect(() => {
        const initialInputs: Record<string, number> = {};
        numericCols.forEach(col => {
            initialInputs[col.name] = 0;
        });
        setPredInputs(initialInputs);
        setPredResult(null);
    }, [columns]);

    // Submit live inference and trigger the flying sphere animation
    const handleTriggerPrediction = async (e: React.FormEvent) => {
        e.preventDefault();
        setPredLoading(true);
        setPredError(null);
        setPredResult(null);
        setPredictionNeighbors(null);

        // Find the active trained model ID from localStorage or pass an active ID
        const activeJobId = localStorage.getItem("active_model_job_id");
        if (!activeJobId) {
            setPredError("No active trained model loaded. Train a model in the builder tab first.");
            setPredLoading(false);
            return;
        }

        try {
            const res = await runPrediction(activeJobId, predInputs);
            setPredResult(res);
            setIsProbeFlying(true);

            // Trigger the cinematic particle flying animation in Three.js!
            if (engineRef.current) {
                engineRef.current.triggerPrediction(predInputs, res);
            }
        } catch (err) {
            setPredError(err instanceof Error ? err.message : "Failed to run prediction");
        } finally {
            setPredLoading(false);
        }
    };

    const handleAutoTour = async () => {
        if (!engineRef.current) return;
        
        // 1. Reset Camera & Mode
        setActiveMode("dataset");
        engineRef.current.tweenCameraTo("reset");
        
        // 2. Overview Top
        setTimeout(() => {
            engineRef.current?.tweenCameraTo("top");
        }, 1500);

        // 3. Side profile & Boundary
        setTimeout(() => {
            engineRef.current?.tweenCameraTo("side");
            setActiveMode("boundary");
        }, 3500);

        // 4. Trigger prediction probe with current inputs
        setTimeout(() => {
            const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
            handleTriggerPrediction(fakeEvent);
        }, 6000);
    };

    return (
        <div className="space-y-6">
            {/* Top Toolbar controls */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-zinc-900/40 p-4 rounded-xl border border-zinc-800">
                <div className="flex flex-wrap gap-2">
                    {[
                        { key: "dataset", label: "Dataset Space", Icon: DatasetIcon, supported: ["all"] },
                        { key: "boundary", label: "Decision Boundary", Icon: BoundaryIcon, supported: ["linear_regression", "ridge", "logistic_regression"] },
                        { key: "tree", label: "Decision Tree", Icon: TreeIcon, supported: ["decision_tree", "random_forest"] },
                        { key: "clusters", label: "Clusters", Icon: ClustersIcon, supported: ["kmeans"] },
                        { key: "pca", label: "PCA Projection", Icon: PCAIcon, supported: ["kmeans"] },
                        { key: "importance", label: "Feature Pillars", Icon: PillarsIcon, supported: ["linear_regression", "ridge", "logistic_regression", "decision_tree", "random_forest", "gradient_boosting", "xgboost", "lightgbm"] },
                    ].map(({ key, label, Icon, supported }) => {
                        const isSupported = supported.includes("all") || (activeModelAlgo && supported.includes(activeModelAlgo));
                        
                        // Hide buttons that are not supported by the current active algorithm (except dataset which is always supported)
                        if (!isSupported) return null;

                        return (
                            <button
                                key={key}
                                onClick={() => setActiveMode(key as any)}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition border ${activeMode === key
                                        ? "bg-emerald-600/20 text-emerald-300 border-emerald-600/50 shadow-emerald-500/10 shadow-md"
                                        : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-600 hover:text-zinc-200"
                                    }`}
                            >
                                <Icon />
                                {label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Dimension Selects */}
            {(activeMode === "dataset" || activeMode === "boundary") && (
                <div className="flex items-center gap-2 font-mono text-[10px] text-zinc-450">
                    <div>
                        <span className="block mb-0.5 text-zinc-550">AXIS X</span>
                        <select value={xAxis} onChange={(e) => setXAxis(e.target.value)} className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-zinc-350 outline-none">
                            {numericCols.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <span className="block mb-0.5 text-zinc-550">AXIS Y</span>
                        <select value={yAxis} onChange={(e) => setYAxis(e.target.value)} className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-zinc-350 outline-none">
                            {numericCols.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <span className="block mb-0.5 text-zinc-550">AXIS Z</span>
                        <select value={zAxis} onChange={(e) => setZAxis(e.target.value)} className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-zinc-350 outline-none">
                            {numericCols.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                        </select>
                    </div>
                </div>
            )}

            {/* Immersive 3D Space Canvas - animated gradient border wrapper */}
            <div className="p-px rounded-2xl" style={{
                background: isFullscreen ? "transparent" : "linear-gradient(135deg, rgba(16,185,129,0.3) 0%, rgba(63,63,70,0.6) 50%, rgba(16,185,129,0.2) 100%)",
            }}>
                <div
                    ref={containerRef}
                    className={`relative w-full overflow-hidden shadow-2xl ${
                        isFullscreen
                            ? "fixed inset-0 z-50 w-screen h-screen rounded-none"
                            : "h-[550px] rounded-2xl"
                    }`}
                    style={{
                        background: "radial-gradient(circle at center, #18181b 0%, #09090b 60%, #000000 100%)"
                    }}
                >
                    {/* Top Left Controls */}
                    <div className="absolute top-4 left-4 z-20 flex gap-2 items-stretch">
                        {/* Fullscreen toggle button */}
                        <button
                            onClick={toggleFullscreen}
                            className="bg-zinc-900/40 hover:bg-zinc-800/80 border border-zinc-700/50 text-zinc-300 hover:text-white px-3 py-1.5 rounded-lg backdrop-blur-md font-mono text-[10px] uppercase tracking-wider transition shadow-lg flex items-center gap-1.5"
                        >
                            {isFullscreen ? <><CollapseIcon /> Exit Space</> : <><ExpandIcon /> Expand</>}
                        </button>

                        {/* Settings Panel Toggle */}
                        <div className="relative">
                            <button
                                onClick={() => setSettingsOpen(!settingsOpen)}
                                className={`bg-zinc-900/40 hover:bg-zinc-800/80 border border-zinc-700/50 text-zinc-300 hover:text-white w-8 rounded-lg backdrop-blur-md transition shadow-lg flex items-center justify-center h-full ${settingsOpen ? 'bg-zinc-800/80 text-white border-emerald-500/50' : ''}`}
                            >
                                <SettingsIcon />
                            </button>

                            {settingsOpen && (
                                <div className="absolute top-full left-0 mt-2 w-64 bg-zinc-950/90 backdrop-blur-xl border border-zinc-700/50 p-4 rounded-xl shadow-2xl flex flex-col gap-4 text-xs font-mono text-zinc-300">
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-zinc-500 font-semibold uppercase tracking-wider text-[10px]">Scene Preset</label>
                                        <select 
                                            value={preset} 
                                            onChange={(e) => setPreset(e.target.value as any)} 
                                            className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-zinc-200 outline-none w-full"
                                        >
                                            <option value="cinematic">✨ Cinematic</option>
                                            <option value="bright">☀️ Bright</option>
                                            <option value="high_contrast">📊 High Contrast</option>
                                            <option value="dark">🌑 Dark</option>
                                        </select>
                                    </div>

                                    <div className="flex flex-col gap-1.5">
                                        <div className="flex justify-between items-center">
                                            <label className="text-zinc-500 font-semibold uppercase tracking-wider text-[10px]">Point Size</label>
                                            <span className="text-emerald-400 font-bold">{pointSizeMultiplier.toFixed(1)}x</span>
                                        </div>
                                        <input 
                                            type="range" 
                                            min="0.1" max="3.0" step="0.1" 
                                            value={pointSizeMultiplier} 
                                            onChange={(e) => setPointSizeMultiplier(parseFloat(e.target.value))}
                                            className="w-full accent-emerald-500 cursor-pointer"
                                        />
                                    </div>

                                    <div className="flex flex-col gap-2 border-t border-zinc-800/60 pt-3">
                                        <label className="flex items-center gap-2 cursor-pointer hover:text-white transition">
                                            <input type="checkbox" checked={showGrid} onChange={e => setShowGrid(e.target.checked)} className="accent-emerald-500" />
                                            Show Ground Grid
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer hover:text-white transition">
                                            <input type="checkbox" checked={showLabels} onChange={e => setShowLabels(e.target.checked)} className="accent-emerald-500" />
                                            Show Axis Labels
                                        </label>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <canvas ref={canvasRef} className="w-full h-full block" />

                    {/* Empty state overlays for model-required modes */}
                    {activeMode !== "dataset" && !activeModelId && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/50 backdrop-blur-md z-10 gap-4">
                            <div className="w-12 h-12 rounded-full border border-zinc-700/50 bg-zinc-900/50 flex items-center justify-center text-zinc-400">
                                {activeMode === "boundary" && <BoundaryIcon />}
                                {activeMode === "tree" && <TreeIcon />}
                                {activeMode === "importance" && <PillarsIcon />}
                            </div>
                            <div className="text-center">
                                <p className="text-sm font-semibold text-zinc-200">
                                    {activeMode === "boundary" ? "No model for Decision Boundary" :
                                        activeMode === "tree" ? "No model for Decision Tree" :
                                            "No model for Feature Pillars"}
                                </p>
                                <p className="text-xs text-zinc-400 mt-1.5 max-w-xs">
                                    Train or load a model in the <span className="text-emerald-400">Train Model</span> tab to enable this visualization.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Floating Tooltip HUD (on hover) */}
                    {hoveredItem && !selectedPoint && (
                        <div className="absolute bottom-4 left-4 bg-zinc-950/70 backdrop-blur-xl border border-zinc-700/50 p-4 rounded-xl text-xs space-y-1.5 shadow-2xl font-mono text-zinc-300 max-w-[280px] pointer-events-none animate-fade-in select-none z-10">
                            {hoveredItem.type === "point" && (
                                <>
                                    <div className="flex justify-between items-center pb-1 border-b border-zinc-800/60 mb-1">
                                        <span className="block text-[10px] text-zinc-400 font-bold uppercase">Row #{hoveredItem.index}</span>
                                        {hoveredItem.target !== undefined && hoveredItem.target !== null && (
                                            <span className="bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-bold text-[9px] uppercase tracking-wider">
                                                Target: {hoveredItem.target}
                                            </span>
                                        )}
                                    </div>
                                    <div className="space-y-1 mt-2 max-h-[150px] overflow-hidden">
                                        {hoveredItem.raw ? (
                                            <>
                                                {Object.entries(hoveredItem.raw).slice(0, 4).map(([k, v]) => (
                                                    <div key={k} className="flex justify-between gap-4">
                                                        <span className="text-zinc-500 truncate max-w-[120px]">{k}</span>
                                                        <span className="text-zinc-200 font-bold">{v !== null ? String(v) : "NaN"}</span>
                                                    </div>
                                                ))}
                                                {Object.keys(hoveredItem.raw).length > 4 && (
                                                    <div className="text-[9px] text-zinc-600 text-center italic mt-1 pt-1 border-t border-zinc-800/40">
                                                        +{Object.keys(hoveredItem.raw).length - 4} more features
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            <div className="text-[10px] text-zinc-500 italic text-center">No raw features available</div>
                                        )}
                                    </div>
                                </>
                            )}
                            {hoveredItem.type === "pillar" && (
                                <>
                                    <span className="block text-[9px] text-emerald-450 font-bold uppercase">Feature Importance</span>
                                    <strong className="text-white block truncate" title={hoveredItem.name}>{hoveredItem.name}</strong>
                                    <span className="text-[10px] text-zinc-450">Impact Score: {hoveredItem.value.toFixed(4)}</span>
                                </>
                            )}
                            {hoveredItem.type === "tree_node" && (
                                <>
                                    <span className="block text-[9px] text-zinc-400 font-bold uppercase">Tree Coordinate Node</span>
                                    <strong className="text-white">{hoveredItem.is_leaf ? "Leaf node" : "Boundary node"}</strong>
                                    {!hoveredItem.is_leaf ? (
                                        <span className="block text-[10px] text-zinc-300">
                                            Split condition: {hoveredItem.feature} &lt;= {hoveredItem.threshold?.toFixed(2)}
                                        </span>
                                    ) : (
                                        <span className="block text-[10px] text-zinc-300">
                                            Prediction: {JSON.stringify(hoveredItem.value)}
                                        </span>
                                    )}
                                    <span className="block text-[9px] text-zinc-500">Node depth: {hoveredItem.depth}</span>
                                </>
                            )}
                        </div>
                    )}

                    {/* Interactive Instance Card (on click) */}
                    {selectedPoint && selectedPoint.type === "point" && (
                        <div className="absolute top-4 left-4 bg-zinc-950/70 backdrop-blur-xl border border-zinc-700/50 p-5 rounded-xl text-xs shadow-2xl max-w-[300px] z-20 animate-fade-in custom-scrollbar overflow-y-auto max-h-[90%]">
                            <div className="flex justify-between items-start mb-4 border-b border-zinc-800/50 pb-3">
                                <div>
                                    <span className="block text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Instance Explorer</span>
                                    <strong className="text-white text-sm">Row #{selectedPoint.index}</strong>
                                </div>
                                <button onClick={() => setSelectedPoint(null)} className="text-zinc-500 hover:text-white transition">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
                                </button>
                            </div>

                            {/* Raw Features List */}
                            <div className="space-y-2 mb-4">
                                <span className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Original Features</span>
                                {Object.entries(selectedPoint.raw || {}).map(([key, val]) => (
                                    <div key={key} className="flex justify-between font-mono text-[10px] border-b border-zinc-800/30 pb-1">
                                        <span className="text-zinc-400 truncate pr-2 max-w-[150px]">{key}</span>
                                        <span className="text-emerald-400">{val !== null ? String(val) : "NaN"}</span>
                                    </div>
                                ))}
                            </div>

                            <button 
                                onClick={() => engineRef.current?.flyToPoint(selectedPoint.index)}
                                className="w-full py-2 bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-400 rounded-lg border border-emerald-500/30 transition flex items-center justify-center gap-2 font-semibold"
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M3 12h6m6 0h6m-9-9v6m0 6v6"/></svg>
                                Focus Camera
                            </button>
                        </div>
                    )}

                    {/* Contextual HUD (Top Center) */}
                    {datasetInfo && (
                        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-zinc-950/60 backdrop-blur-xl border border-zinc-700/50 px-5 py-2 rounded-full flex gap-6 text-[10px] font-mono text-zinc-300 shadow-2xl z-10">
                            <div>
                                <span className="text-zinc-500 mr-2">POINTS</span>
                                <span className="text-white font-bold">{datasetInfo.total}</span>
                            </div>
                            {datasetInfo.target && (
                                <div>
                                    <span className="text-zinc-500 mr-2">TARGET</span>
                                    <span className="text-emerald-400 font-bold">{datasetInfo.target}</span>
                                </div>
                            )}
                            <div>
                                <span className="text-zinc-500 mr-2">TYPE</span>
                                <span className="text-blue-400 font-bold">{datasetInfo.task_type}</span>
                            </div>
                        </div>
                    )}

                    {/* Camera Presets & Auto Tour (Bottom Center) */}
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-zinc-950/60 backdrop-blur-xl border border-zinc-700/50 p-1.5 rounded-full flex gap-1 shadow-2xl z-20 transition-all">
                        <button onClick={() => engineRef.current?.tweenCameraTo("front")} className="px-3 py-1.5 rounded-full text-[10px] font-bold text-zinc-400 hover:text-white hover:bg-zinc-800/80 transition">FRONT</button>
                        <button onClick={() => engineRef.current?.tweenCameraTo("top")} className="px-3 py-1.5 rounded-full text-[10px] font-bold text-zinc-400 hover:text-white hover:bg-zinc-800/80 transition">TOP</button>
                        <button onClick={() => engineRef.current?.tweenCameraTo("side")} className="px-3 py-1.5 rounded-full text-[10px] font-bold text-zinc-400 hover:text-white hover:bg-zinc-800/80 transition">SIDE</button>
                        <div className="w-px h-4 bg-zinc-700/50 self-center mx-1" />
                        <button onClick={() => engineRef.current?.tweenCameraTo("reset")} className="px-3 py-1.5 rounded-full text-[10px] font-bold text-zinc-400 hover:text-white hover:bg-zinc-800/80 transition">RESET</button>
                        <div className="w-px h-4 bg-zinc-700/50 self-center mx-1" />
                        <button onClick={() => setShowLabels(!showLabels)} className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition ${showLabels ? "text-white bg-zinc-800/80" : "text-zinc-500 hover:text-white hover:bg-zinc-800/80"}`}>
                            LABELS
                        </button>
                        <button onClick={handleAutoTour} className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[10px] font-bold text-zinc-950 bg-emerald-500 hover:bg-emerald-400 transition shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M5 3l14 9-14 9V3z"/></svg>
                            TOUR
                        </button>
                    </div>

                    {/* Floating Prediction Overlay Panel */}
                    <div className="absolute top-4 right-4 w-[260px] max-h-[80%] overflow-y-auto bg-zinc-950/70 backdrop-blur-xl border border-zinc-700/50 rounded-2xl p-4 shadow-2xl custom-scrollbar text-xs flex flex-col gap-4 z-20 transition-all hover:bg-zinc-950/80 hover:border-zinc-600/60">
                        <div className="border-b border-zinc-800/60 pb-3">
                            <div className="flex items-center gap-2 mb-2">
                                <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${activeModelId ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse" : "bg-zinc-600"}`} />
                                <h5 className="font-bold text-zinc-200 uppercase tracking-wider text-[10px]">Live Prediction</h5>
                            </div>
                            {activeModelId ? (
                                <div className="text-[10px] text-zinc-400 space-y-0.5 font-mono">
                                    <div className="flex justify-between"><span>Model</span><span className="text-emerald-400">{activeModelAlgo?.replace(/_/g, " ") || "\u2014"}</span></div>
                                    <div className="flex justify-between"><span>Target</span><span className="text-zinc-300">{activeModelTarget || "\u2014"}</span></div>
                                </div>
                            ) : (
                                <p className="text-[10px] text-zinc-500 italic">No active model. Train one in the Train Model tab.</p>
                            )}
                        </div>

                        <form onSubmit={handleTriggerPrediction} className="flex flex-col gap-4">
                            <div>
                                <span className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-3">Passenger/Instance Features</span>
                                <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                                    {numericCols.map(col => {
                                        const colProfile = columns.find(c => c.name === col.name);
                                        const isSelectable = colProfile && (
                                            colProfile.detected_type === "Boolean" ||
                                            colProfile.unique_count <= 8
                                        );

                                        let options: { label: string; value: number }[] = [];
                                        if (colProfile) {
                                            if (colProfile.detected_type === "Boolean") {
                                                options = [
                                                    { label: "0 (No)", value: 0 },
                                                    { label: "1 (Yes)", value: 1 }
                                                ];
                                            } else if (colProfile.stats && "top_values" in colProfile.stats) {
                                                const top = (colProfile.stats as CategoricalStats).top_values || [];
                                                options = top.map(t => {
                                                    const valNum = parseFloat(String(t.value));
                                                    return {
                                                        label: String(t.value),
                                                        value: isNaN(valNum) ? 0 : valNum
                                                    };
                                                });
                                            }
                                        }

                                        return (
                                            <div key={col.name} className="flex flex-col gap-1 border-b border-zinc-800/40 pb-2">
                                                <div className="flex justify-between items-center gap-2">
                                                    <label className="font-mono text-zinc-450 truncate max-w-[130px]" title={col.name}>{col.name}</label>
                                                    {isSelectable && options.length > 0 ? (
                                                        <select
                                                            value={predInputs[col.name] ?? 0}
                                                            onChange={(e) => setPredInputs({ ...predInputs, [col.name]: parseFloat(e.target.value) || 0 })}
                                                            className="w-[90px] bg-zinc-950 border border-zinc-850 rounded px-2 py-1 text-zinc-350 text-right outline-none focus:border-zinc-555 text-xs"
                                                        >
                                                            {options.map((opt, i) => (
                                                                <option key={i} value={opt.value}>
                                                                    {opt.label}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    ) : (
                                                        <input
                                                            type="number"
                                                            step="any"
                                                            min={colProfile?.stats && "min" in colProfile.stats ? (colProfile.stats as NumericStats).min ?? undefined : undefined}
                                                            max={colProfile?.stats && "max" in colProfile.stats ? (colProfile.stats as NumericStats).max ?? undefined : undefined}
                                                            value={predInputs[col.name] ?? ""}
                                                            onChange={(e) => setPredInputs({ ...predInputs, [col.name]: e.target.value === "" ? 0 : parseFloat(e.target.value) || 0 })}
                                                            className="w-[90px] bg-zinc-950 border border-zinc-850 rounded px-2 py-1 text-zinc-300 text-right outline-none focus:border-zinc-550 text-xs"
                                                        />
                                                    )}
                                                </div>
                                                {!isSelectable && colProfile?.stats && "min" in colProfile.stats && (
                                                    <span className="block text-[8px] text-zinc-500 text-right font-mono">
                                                        [{(colProfile.stats as NumericStats).min} - {(colProfile.stats as NumericStats).max}]
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            <button
                                type="submit"
                                disabled={predLoading || !activeModelId}
                                className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed border border-emerald-500/50"
                            >
                                <RocketIcon />
                                {predLoading ? "Processing..." : "Launch Prediction"}
                            </button>
                        </form>

                        {predError && (
                            <div className="p-2 bg-rose-950/20 border border-rose-900/40 rounded text-rose-450 text-[10px]">
                                &#9888; {predError}
                            </div>
                        )}

                        {isProbeFlying && (
                            <div className="p-3 border border-[#22d3ee]/40 bg-[#22d3ee]/10 rounded-lg text-center animate-pulse">
                                <span className="block text-[10px] text-[#22d3ee] font-bold uppercase tracking-widest">Probe Launched</span>
                                <span className="block text-xs text-zinc-300 mt-1">Analyzing coordinates...</span>
                            </div>
                        )}

                        {!isProbeFlying && predResult && (
                            <div className="p-3 bg-emerald-950/20 border border-emerald-900/40 rounded-lg space-y-3 animate-fade-in">
                                <div className="text-center">
                                    <span className="block text-[9px] text-emerald-450 font-bold uppercase tracking-widest mb-1">Result Class</span>
                                    <strong className="text-xl text-white font-mono">{predResult.prediction}</strong>
                                    {predResult.confidence !== null && (
                                        <span className="block text-[10px] text-zinc-500 mt-0.5">
                                            Confidence: {(predResult.confidence * 100).toFixed(1)}%
                                        </span>
                                    )}
                                </div>
                                
                                {predictionNeighbors && predictionNeighbors.length > 0 && (
                                    <div className="border-t border-emerald-900/40 pt-2 mt-2">
                                        <span className="block text-[9px] text-zinc-500 font-bold uppercase mb-1">Nearest Neighbors</span>
                                        <div className="flex gap-1 flex-wrap justify-center">
                                            {predictionNeighbors.map((n, i) => (
                                                <button 
                                                    key={i} 
                                                    onClick={() => {
                                                        setSelectedPoint({ type: "point", index: n });
                                                        engineRef.current?.flyToPoint(n);
                                                    }}
                                                    className="px-2 py-0.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-[9px] text-zinc-300 rounded font-mono transition"
                                                >
                                                    #{n}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

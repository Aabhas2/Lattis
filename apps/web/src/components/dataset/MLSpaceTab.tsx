"use client";

import { useEffect, useRef, useState } from "react";
import { ColumnProfile } from "../../lib/types";
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
    const [hoveredItem, setHoveredItem] = useState<any | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);

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

            const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
            fetch(`${BASE_URL}/models/datasets/${datasetId}/visualize`)
                .then(res => {
                    if (!res.ok) throw new Error("Failed to fetch visualization coordinates");
                    return res.json();
                })
                .then(data => {
                    engine.loadData(data);
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
    }, [datasetId]);

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

            // Trigger the cinematic particle flying animation in Three.js!
            if (engineRef.current) {
                engineRef.current.triggerPrediction(predInputs, res);
            }
        } catch (err) {
            setPredError(err instanceof Error ? err.message : "Failed to run prediction");
        } finally {
            setPredLoading(false);
        }
    };    return (
        <div className="space-y-6">
            {/* Top Toolbar controls */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-zinc-900/40 p-4 rounded-xl border border-zinc-800">
                <div className="flex flex-wrap gap-2">
                    {[
                        { key: "dataset", label: "Dataset Space", Icon: DatasetIcon },
                        { key: "boundary", label: "Decision Boundary", Icon: BoundaryIcon },
                        { key: "tree", label: "Decision Tree", Icon: TreeIcon },
                        { key: "importance", label: "Feature Pillars", Icon: PillarsIcon },
                    ].map(({ key, label, Icon }) => (
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
                    ))}
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
                    className={`relative w-full bg-zinc-950 overflow-hidden shadow-2xl ${
                        isFullscreen
                            ? "fixed inset-0 z-50 w-screen h-screen rounded-none"
                            : "h-[550px] rounded-2xl"
                    }`}
                >
                    {/* Fullscreen toggle button */}
                    <button
                        onClick={toggleFullscreen}
                        className="absolute top-4 left-4 z-20 bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white px-3 py-1.5 rounded-lg backdrop-blur font-mono text-[10px] uppercase tracking-wider transition shadow-lg flex items-center gap-1.5"
                    >
                        {isFullscreen ? <><CollapseIcon /> Exit Space</> : <><ExpandIcon /> Expand</>}
                    </button>

                    <canvas ref={canvasRef} className="w-full h-full block" />

                    {/* Empty state overlays for model-required modes */}
                    {activeMode !== "dataset" && !activeModelId && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/80 backdrop-blur-sm z-10 gap-4">
                            <div className="w-12 h-12 rounded-full border border-zinc-700 bg-zinc-900 flex items-center justify-center text-zinc-500">
                                {activeMode === "boundary" && <BoundaryIcon />}
                                {activeMode === "tree" && <TreeIcon />}
                                {activeMode === "importance" && <PillarsIcon />}
                            </div>
                            <div className="text-center">
                                <p className="text-sm font-semibold text-zinc-300">
                                    {activeMode === "boundary" ? "No model for Decision Boundary" :
                                        activeMode === "tree" ? "No model for Decision Tree" :
                                            "No model for Feature Pillars"}
                                </p>
                                <p className="text-xs text-zinc-500 mt-1.5 max-w-xs">
                                    Train or load a model in the <span className="text-emerald-400">Train Model</span> tab to enable this visualization.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Floating Tooltip HUD */}
                    {hoveredItem && (
                        <div className="absolute bottom-4 left-4 bg-zinc-950/90 backdrop-blur border border-zinc-800 p-4 rounded-xl text-xs space-y-1.5 shadow-2xl font-mono text-zinc-350 max-w-[280px] pointer-events-none animate-fade-in select-none">
                            {hoveredItem.type === "point" && (
                                <>
                                    <span className="block text-[9px] text-zinc-500 font-bold uppercase">Dataset Probe</span>
                                    <strong className="text-zinc-200">Data Row Index: {hoveredItem.index}</strong>
                                    <span className="block text-[10px] text-zinc-400">Ray Distance: {hoveredItem.distance.toFixed(2)}</span>
                                </>
                            )}
                            {hoveredItem.type === "pillar" && (
                                <>
                                    <span className="block text-[9px] text-emerald-450 font-bold uppercase">Feature Importance</span>
                                    <strong className="text-zinc-200 block truncate" title={hoveredItem.name}>{hoveredItem.name}</strong>
                                    <span className="text-[10px] text-zinc-450">Impact Score: {hoveredItem.value.toFixed(4)}</span>
                                </>
                            )}
                            {hoveredItem.type === "tree_node" && (
                                <>
                                    <span className="block text-[9px] text-zinc-550 font-bold uppercase">Tree Coordinate Node</span>
                                    <strong className="text-zinc-200">{hoveredItem.is_leaf ? "Leaf node" : "Boundary node"}</strong>
                                    {!hoveredItem.is_leaf ? (
                                        <span className="block text-[10px] text-zinc-400">
                                            Split condition: {hoveredItem.feature} &lt;= {hoveredItem.threshold?.toFixed(2)}
                                        </span>
                                    ) : (
                                        <span className="block text-[10px] text-zinc-400">
                                            Prediction: {JSON.stringify(hoveredItem.value)}
                                        </span>
                                    )}
                                    <span className="block text-[9px] text-zinc-650">Node depth: {hoveredItem.depth}</span>
                                </>
                            )}
                        </div>
                    )}

                    {/* Floating Prediction Overlay Panel */}
                    <div className="absolute top-4 right-4 w-[280px] max-h-[500px] overflow-y-auto bg-zinc-900/95 backdrop-blur border border-zinc-700/80 rounded-xl p-4 space-y-4 shadow-2xl custom-scrollbar text-xs">
                        <div className="border-b border-zinc-800 pb-2 space-y-1.5">
                            <div className="flex items-center gap-2">
                                <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${activeModelId ? "bg-emerald-400 shadow-emerald-400/50 shadow-sm animate-pulse" : "bg-zinc-600"}`} />
                                <h5 className="font-bold text-zinc-200 uppercase tracking-wider text-[11px]">Cinematic Prediction</h5>
                            </div>
                            {activeModelId ? (
                                <div className="rounded-md bg-zinc-950 border border-zinc-800 px-2.5 py-1.5 font-mono text-[9px] text-zinc-400 space-y-0.5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-zinc-600 uppercase tracking-wide">Model</span>
                                        <span className="text-emerald-400 font-semibold">{activeModelAlgo?.replace(/_/g, " ") || "\u2014"}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-zinc-600 uppercase tracking-wide">Target</span>
                                        <span className="text-zinc-300">{activeModelTarget || "\u2014"}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-zinc-600 uppercase tracking-wide">Job ID</span>
                                        <span className="text-zinc-500">{activeModelId.slice(0, 8)}&hellip;</span>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-[10px] text-zinc-500 italic">No active model. Train one in the Train Model tab.</p>
                            )}
                        </div>

                        <form onSubmit={handleTriggerPrediction} className="space-y-3">
                            <div className="space-y-2.5 max-h-[200px] overflow-y-auto pr-1">
                                {numericCols.map(col => (
                                    <div key={col.name} className="flex justify-between items-center gap-2">
                                        <label className="font-mono text-zinc-450 truncate max-w-[130px]" title={col.name}>{col.name}</label>
                                        <input
                                            type="number"
                                            step="any"
                                            value={predInputs[col.name] ?? 0}
                                            onChange={(e) => setPredInputs({ ...predInputs, [col.name]: parseFloat(e.target.value) || 0 })}
                                            className="w-[90px] bg-zinc-950 border border-zinc-850 rounded px-2 py-1 text-zinc-300 text-right outline-none focus:border-zinc-550"
                                        />
                                    </div>
                                ))}
                            </div>
                            <button
                                type="submit"
                                disabled={predLoading || !activeModelId}
                                className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <RocketIcon />
                                {predLoading ? "Processing..." : "Launch Prediction Probe"}
                            </button>
                        </form>

                        {predError && (
                            <div className="p-2 bg-rose-950/20 border border-rose-900/40 rounded text-rose-450 text-[10px]">
                                &#9888; {predError}
                            </div>
                        )}

                        {predResult && (
                            <div className="p-3 bg-emerald-950/20 border border-emerald-900/40 rounded-lg space-y-1 text-center animate-fade-in">
                                <span className="block text-[9px] text-emerald-450 font-bold uppercase">Result Class</span>
                                <strong className="text-lg text-white font-mono">{predResult.prediction}</strong>
                                {predResult.confidence !== null && (
                                    <span className="block text-[10px] text-zinc-500">
                                        Confidence: {(predResult.confidence * 100).toFixed(1)}%
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

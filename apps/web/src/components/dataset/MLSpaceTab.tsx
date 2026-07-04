"use client";

import { useEffect, useRef, useState } from "react";
import { ColumnProfile } from "../../lib/types";
import { runPrediction } from "../../lib/api";

// Dynamic loading configuration interface for the plain-JS visualizer
interface MLSpaceTabProps {
    datasetId: string;
    columns: ColumnProfile[];
}

export default function MLSpaceTab({ datasetId, columns }: MLSpaceTabProps) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const engineRef = useRef<any | null>(null);

    // List of numerical columns available for X/Y/Z plotting
    const numericCols = columns.filter(
        c => c.detected_type === "Numerical" ||
            c.dtype.toLowerCase().includes("int") ||
            c.dtype.toLowerCase().includes("float")
    );

    // Coordinate axis states
    const [xAxis, setXAxis] = useState(numericCols[0]?.name || "");
    const [yAxis, setYAxis] = useState(numericCols[1]?.name || "");
    const [zAxis, setZAxis] = useState(numericCols[2]?.name || "");

    // Visualization modes: Dataset Space, Decision Boundary, Tree Graph, Feature Pillars
    const [activeMode, setActiveMode] = useState<"dataset" | "boundary" | "tree" | "importance">("dataset");

    // Dynamic Live Prediction States
    const [predInputs, setPredInputs] = useState<Record<string, number>>({});
    const [predLoading, setPredLoading] = useState(false);
    const [predResult, setPredResult] = useState<any | null>(null);
    const [predError, setPredError] = useState<string | null>(null);

    // 1. Initialize custom Three.js UniverseEngine on mount
    useEffect(() => {
        if (!canvasRef.current) return;

        // Import the custom UniverseEngine classes dynamically (created by you in Step 4)
        import("./UniverseEngine").then(({ UniverseEngine }) => {
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
    };

    return (
        <div className="space-y-6">
            {/* Top Toolbar controls */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-zinc-900/40 p-4 rounded-xl border border-zinc-800">
                <div className="flex flex-wrap gap-3">
                    <button
                        onClick={() => setActiveMode("dataset")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${activeMode === "dataset" ? "bg-emerald-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}
                    >
                        🌌 Dataset Space
                    </button>
                    <button
                        onClick={() => setActiveMode("boundary")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${activeMode === "boundary" ? "bg-emerald-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}
                    >
                        📐 Decision Boundary
                    </button>
                    <button
                        onClick={() => setActiveMode("tree")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${activeMode === "tree" ? "bg-emerald-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}
                    >
                        🌿 Decision Tree
                    </button>
                    <button
                        onClick={() => setActiveMode("importance")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${activeMode === "importance" ? "bg-emerald-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}
                    >
                        📊 Feature Pillars
                    </button>
                </div>

                {/* Dimension Selects (Visible for Scatter & Boundary Space) */}
                {(activeMode === "dataset" || activeMode === "boundary") && (
                    <div className="flex items-center gap-2 font-mono text-[10px] text-zinc-450">
                        <div>
                            <span className="block mb-0.5 text-zinc-550">AXIS X</span>
                            <select
                                value={xAxis}
                                onChange={(e) => setXAxis(e.target.value)}
                                className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-zinc-350 outline-none"
                            >
                                {numericCols.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <span className="block mb-0.5 text-zinc-550">AXIS Y</span>
                            <select
                                value={yAxis}
                                onChange={(e) => setYAxis(e.target.value)}
                                className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-zinc-350 outline-none"
                            >
                                {numericCols.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <span className="block mb-0.5 text-zinc-550">AXIS Z</span>
                            <select
                                value={zAxis}
                                onChange={(e) => setZAxis(e.target.value)}
                                className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-zinc-350 outline-none"
                            >
                                {numericCols.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                            </select>
                        </div>
                    </div>
                )}
            </div>

            {/* Immersive 3D Space Canvas */}
            <div className="relative w-full h-[550px] bg-zinc-950 rounded-2xl border border-zinc-800 overflow-hidden shadow-2xl">
                <canvas ref={canvasRef} className="w-full h-full block" />

                {/* Floating Prediction Overlay Panel */}
                <div className="absolute top-4 right-4 w-[280px] max-h-[500px] overflow-y-auto bg-zinc-900/90 backdrop-blur border border-zinc-800 rounded-xl p-4 space-y-4 shadow-xl custom-scrollbar text-xs">
                    <h5 className="font-bold text-zinc-200 uppercase tracking-wider border-b border-zinc-800 pb-1.5">Cinematic Prediction</h5>
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
                            disabled={predLoading}
                            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-1.5 rounded transition disabled:opacity-50"
                        >
                            {predLoading ? "Processing..." : "Launch Prediction Probe 🚀"}
                        </button>
                    </form>

                    {predError && (
                        <div className="p-2 bg-rose-950/20 border border-rose-900/40 rounded text-rose-450 text-[10px]">
                            ⚠️ {predError}
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
    );
}

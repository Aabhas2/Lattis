"use client";

import { useEffect, useState } from "react";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ScatterChart,
    Scatter,
    Cell,
} from "recharts";
import { getHistogram, getBoxplot, getScatterplot, getCorrelationMatrix } from "../../lib/api";
import { ColumnProfile } from "../../lib/types";

interface VisualizationTabProps {
    datasetId: string;
    columns: ColumnProfile[];
}

export default function VisualizationTab({ datasetId, columns }: VisualizationTabProps) {
    const [isMounted, setIsMounted] = useState(false);
    const [subTab, setSubTab] = useState<"distribution" | "relationship" | "correlation">("distribution");

    // Filter numerical columns
    const numericColumns = columns.filter(
        (col) =>
            col.detected_type === "Numerical" ||
            col.dtype.toLowerCase().includes("int") ||
            col.dtype.toLowerCase().includes("float")
    );

    // Subtab states - Distribution
    const [distCol, setDistCol] = useState(numericColumns[0]?.name || "");
    const [bins, setBins] = useState(10);
    const [histData, setHistData] = useState<any[] | null>(null);
    const [histLoading, setHistLoading] = useState(false);
    const [histError, setHistError] = useState<string | null>(null);

    const [boxData, setBoxData] = useState<any | null>(null);
    const [boxLoading, setBoxLoading] = useState(false);
    const [boxError, setBoxError] = useState<string | null>(null);

    // Subtab states - Relationship
    const [scatterXCol, setScatterXCol] = useState(numericColumns[0]?.name || "");
    const [scatterYCol, setScatterYCol] = useState(numericColumns[1]?.name || numericColumns[0]?.name || "");
    const [scatterData, setScatterData] = useState<any[] | null>(null);
    const [scatterLoading, setScatterLoading] = useState(false);
    const [scatterError, setScatterError] = useState<string | null>(null);

    // Subtab states - Correlation
    const [corrData, setCorrData] = useState<{ columns: string[]; matrix: number[][] } | null>(null);
    const [corrLoading, setCorrLoading] = useState(false);
    const [corrError, setCorrError] = useState<string | null>(null);

    // Hydration check
    useEffect(() => {
        setIsMounted(true);
    }, []);

    // Fetch Histogram & Boxplot
    useEffect(() => {
        if (!isMounted || subTab !== "distribution" || !distCol) return;

        async function fetchDist() {
            setHistLoading(true);
            setHistError(null);
            try {
                const data = await getHistogram(datasetId, distCol, bins);
                setHistData(data);
            } catch (err) {
                setHistError(err instanceof Error ? err.message : "Failed to load histogram");
            } finally {
                setHistLoading(false);
            }

            setBoxLoading(true);
            setBoxError(null);
            try {
                const data = await getBoxplot(datasetId, distCol);
                setBoxData(data);
            } catch (err) {
                setBoxError(err instanceof Error ? err.message : "Failed to load boxplot");
            } finally {
                setBoxLoading(false);
            }
        }

        fetchDist();
    }, [isMounted, datasetId, distCol, bins, subTab]);

    // Fetch Scatterplot
    useEffect(() => {
        if (!isMounted || subTab !== "relationship" || !scatterXCol || !scatterYCol) return;

        async function fetchScatter() {
            setScatterLoading(true);
            setScatterError(null);
            try {
                const data = await getScatterplot(datasetId, scatterXCol, scatterYCol, 1000);
                setScatterData(data);
            } catch (err) {
                setScatterError(err instanceof Error ? err.message : "Failed to load scatterplot");
            } finally {
                setScatterLoading(false);
            }
        }

        fetchScatter();
    }, [isMounted, datasetId, scatterXCol, scatterYCol, subTab]);

    // Fetch Correlation Matrix
    useEffect(() => {
        if (!isMounted || subTab !== "correlation") return;

        async function fetchCorr() {
            setCorrLoading(true);
            setCorrError(null);
            try {
                const data = await getCorrelationMatrix(datasetId);
                setCorrData(data);
            } catch (err) {
                setCorrError(err instanceof Error ? err.message : "Failed to load correlation matrix");
            } finally {
                setCorrLoading(false);
            }
        }

        fetchCorr();
    }, [isMounted, datasetId, subTab]);

    if (!isMounted) return null;

    if (numericColumns.length === 0) {
        return (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-10 text-center">
                <p className="text-zinc-400">No numeric columns found in this dataset.</p>
                <p className="mt-1 text-xs text-zinc-600">Numerical visualizations require at least one numerical feature.</p>
            </div>
        );
    }

    // Custom SVG Boxplot implementation
    const renderSVGBoxplot = (data: { min: number; q1: number; median: number; q3: number; max: number; outliers: number[] }) => {
        const allVals = [data.min, data.q1, data.median, data.q3, data.max, ...data.outliers];
        const valMin = Math.min(...allVals);
        const valMax = Math.max(...allVals);
        const range = valMax - valMin === 0 ? 1 : valMax - valMin;

        // Add 5% padding to scale
        const dataMin = valMin - range * 0.05;
        const dataMax = valMax + range * 0.05;
        const finalRange = dataMax - dataMin;

        const width = 320;
        const height = 360;
        const padding = 30;

        const yScale = (val: number) => {
            const ratio = (val - dataMin) / finalRange;
            return height - padding - ratio * (height - 2 * padding);
        };

        const x = width / 2;
        const boxWidth = 60;

        const yMin = yScale(data.min);
        const yQ1 = yScale(data.q1);
        const yMed = yScale(data.median);
        const yQ3 = yScale(data.q3);
        const yMax = yScale(data.max);

        return (
            <div className="flex flex-col items-center sm:flex-row sm:justify-center gap-8">
                <svg width={width} height={height} className="bg-zinc-950/40 rounded-xl border border-zinc-850">
                    {/* Grid line guidelines */}
                    <line x1={0} y1={yMin} x2={width} y2={yMin} stroke="#27272a" strokeWidth={1} strokeDasharray="3 3" />
                    <line x1={0} y1={yQ1} x2={width} y2={yQ1} stroke="#27272a" strokeWidth={1} strokeDasharray="3 3" />
                    <line x1={0} y1={yMed} x2={width} y2={yMed} stroke="#27272a" strokeWidth={1} strokeDasharray="3 3" />
                    <line x1={0} y1={yQ3} x2={width} y2={yQ3} stroke="#27272a" strokeWidth={1} strokeDasharray="3 3" />
                    <line x1={0} y1={yMax} x2={width} y2={yMax} stroke="#27272a" strokeWidth={1} strokeDasharray="3 3" />

                    {/* Whiskers (Vertical Lines) */}
                    <line x1={x} y1={yMin} x2={x} y2={yQ1} stroke="#10b981" strokeWidth={2} />
                    <line x1={x} y1={yQ3} x2={x} y2={yMax} stroke="#10b981" strokeWidth={2} />

                    {/* Whisker caps */}
                    <line x1={x - 15} y1={yMin} x2={x + 15} y2={yMin} stroke="#10b981" strokeWidth={2} />
                    <line x1={x - 15} y1={yMax} x2={x + 15} y2={yMax} stroke="#10b981" strokeWidth={2} />

                    {/* IQR Box */}
                    <rect
                        x={x - boxWidth / 2}
                        y={yQ3}
                        width={boxWidth}
                        height={Math.max(2, yQ1 - yQ3)}
                        fill="#064e3b"
                        fillOpacity={0.4}
                        stroke="#10b981"
                        strokeWidth={2}
                        rx={2}
                    />

                    {/* Median Line */}
                    <line x1={x - boxWidth / 2} y1={yMed} x2={x + boxWidth / 2} y2={yMed} stroke="#34d399" strokeWidth={3} />

                    {/* Outliers */}
                    {data.outliers.map((val, idx) => (
                        <circle key={idx} cx={x} cy={yScale(val)} r={4} fill="#f43f5e" stroke="#fda4af" strokeWidth={1} />
                    ))}

                    {/* Label texts inside SVG */}
                    <text x={x + boxWidth / 2 + 10} y={yMax + 4} fill="#94a3b8" className="text-xs font-mono">Max: {data.max.toFixed(2)}</text>
                    <text x={x + boxWidth / 2 + 10} y={yQ3 + 4} fill="#94a3b8" className="text-xs font-mono font-semibold">Q3: {data.q1.toFixed(2)}</text>
                    <text x={x + boxWidth / 2 + 10} y={yMed + 4} fill="#34d399" className="text-xs font-mono font-bold">Med: {data.median.toFixed(2)}</text>
                    <text x={x + boxWidth / 2 + 10} y={yQ1 + 4} fill="#94a3b8" className="text-xs font-mono font-semibold">Q1: {data.q3.toFixed(2)}</text>
                    <text x={x + boxWidth / 2 + 10} y={yMin + 4} fill="#94a3b8" className="text-xs font-mono">Min: {data.min.toFixed(2)}</text>
                </svg>

                <div className="space-y-4 max-w-xs text-sm">
                    <h5 className="text-zinc-200 font-semibold uppercase tracking-wider text-xs">Statistical Summary</h5>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-2 font-mono">
                        <span className="text-zinc-400">Maximum:</span>
                        <span className="text-zinc-200 text-right">{data.max.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
                        <span className="text-zinc-400">Third Quartile (Q3):</span>
                        <span className="text-zinc-200 text-right">{data.q3.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
                        <span className="text-zinc-400">Median (Q2):</span>
                        <span className="text-emerald-400 font-semibold text-right">{data.median.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
                        <span className="text-zinc-400">First Quartile (Q1):</span>
                        <span className="text-zinc-200 text-right">{data.q1.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
                        <span className="text-zinc-400">Minimum:</span>
                        <span className="text-zinc-200 text-right">{data.min.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
                    </div>

                    <div className="pt-3 border-t border-zinc-800">
                        <span className="block text-zinc-400 mb-1">Outliers detected:</span>
                        <span className={`text-sm font-semibold font-mono ${data.outliers.length > 0 ? "text-rose-400" : "text-emerald-400"}`}>
                            {data.outliers.length} points
                        </span>
                        {data.outliers.length > 0 && (
                            <p className="mt-1 text-xs text-zinc-500">
                                Outliers are values outside 1.5 × IQR (Interquartile Range).
                            </p>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-8">
            {/* View Selection Tab-bar */}
            <div className="flex flex-wrap gap-2 border-b border-zinc-800 pb-4">
                <button
                    onClick={() => setSubTab("distribution")}
                    className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                        subTab === "distribution" ? "bg-emerald-950 text-emerald-400 border border-emerald-800" : "text-zinc-400 hover:bg-zinc-900/60 hover:text-zinc-200 border border-transparent"
                    }`}
                >
                    Distribution Analysis
                </button>
                <button
                    onClick={() => setSubTab("relationship")}
                    className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                        subTab === "relationship" ? "bg-emerald-950 text-emerald-400 border border-emerald-800" : "text-zinc-400 hover:bg-zinc-900/60 hover:text-zinc-200 border border-transparent"
                    }`}
                >
                    Scatter Plot (Relationship)
                </button>
                <button
                    onClick={() => setSubTab("correlation")}
                    className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                        subTab === "correlation" ? "bg-emerald-950 text-emerald-400 border border-emerald-800" : "text-zinc-400 hover:bg-zinc-900/60 hover:text-zinc-200 border border-transparent"
                    }`}
                >
                    Correlation Matrix
                </button>
            </div>

            {/* Subtab: Distribution */}
            {subTab === "distribution" && (
                <div className="space-y-6">
                    {/* Controls */}
                    <div className="flex flex-wrap items-center gap-4 bg-zinc-900/20 border border-zinc-800 p-4 rounded-xl">
                        <div className="flex flex-col gap-1">
                            <label className="text-xs text-zinc-400 font-semibold uppercase">Column</label>
                            <select
                                value={distCol}
                                onChange={(e) => setDistCol(e.target.value)}
                                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-zinc-500"
                            >
                                {numericColumns.map((col) => (
                                    <option key={col.name} value={col.name}>
                                        {col.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-xs text-zinc-400 font-semibold uppercase">Histogram Bins</label>
                            <select
                                value={bins}
                                onChange={(e) => setBins(Number(e.target.value))}
                                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-zinc-500"
                            >
                                <option value={5}>5 Bins</option>
                                <option value={10}>10 Bins</option>
                                <option value={15}>15 Bins</option>
                                <option value={20}>20 Bins</option>
                                <option value={30}>30 Bins</option>
                            </select>
                        </div>
                    </div>

                    {/* Chart Layout */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Histogram Container */}
                        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 space-y-4">
                            <div>
                                <h4 className="text-lg font-semibold text-zinc-200">Histogram</h4>
                                <p className="text-xs text-zinc-400">Frequency distribution of values</p>
                            </div>

                            {histLoading ? (
                                <div className="h-[320px] flex items-center justify-center text-zinc-500">Loading Histogram...</div>
                            ) : histError ? (
                                <div className="h-[320px] flex items-center justify-center text-rose-400 text-sm">Error: {histError}</div>
                            ) : histData && histData.length > 0 ? (
                                <div className="h-[320px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={histData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#1f1f23" />
                                            <XAxis dataKey="bin_label" stroke="#71717a" fontSize={10} angle={-15} textAnchor="end" />
                                            <YAxis stroke="#71717a" fontSize={10} />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: "#09090b", borderColor: "#27272a", borderRadius: "8px" }}
                                                labelStyle={{ color: "#a1a1aa", fontSize: "12px", fontFamily: "monospace" }}
                                                itemStyle={{ color: "#34d399", fontSize: "13px" }}
                                            />
                                            <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} opacity={0.85} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : (
                                <div className="h-[320px] flex items-center justify-center text-zinc-600">No histogram data.</div>
                            )}
                        </div>

                        {/* Boxplot Container */}
                        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 space-y-4">
                            <div>
                                <h4 className="text-lg font-semibold text-zinc-200">Box & Whisker Plot</h4>
                                <p className="text-xs text-zinc-400">Five-number summary and outliers</p>
                            </div>

                            {boxLoading ? (
                                <div className="h-[320px] flex items-center justify-center text-zinc-500">Loading Boxplot...</div>
                            ) : boxError ? (
                                <div className="h-[320px] flex items-center justify-center text-rose-400 text-sm">Error: {boxError}</div>
                            ) : boxData ? (
                                <div className="h-[320px] flex items-center justify-center py-2">
                                    {renderSVGBoxplot(boxData)}
                                </div>
                            ) : (
                                <div className="h-[320px] flex items-center justify-center text-zinc-600">No boxplot data.</div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Subtab: Scatterplot */}
            {subTab === "relationship" && (
                <div className="space-y-6">
                    {/* Controls */}
                    <div className="flex flex-wrap items-center gap-4 bg-zinc-900/20 border border-zinc-800 p-4 rounded-xl">
                        <div className="flex flex-col gap-1">
                            <label className="text-xs text-zinc-400 font-semibold uppercase">X-Axis Variable</label>
                            <select
                                value={scatterXCol}
                                onChange={(e) => setScatterXCol(e.target.value)}
                                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-zinc-500"
                            >
                                {numericColumns.map((col) => (
                                    <option key={col.name} value={col.name}>
                                        {col.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-xs text-zinc-400 font-semibold uppercase">Y-Axis Variable</label>
                            <select
                                value={scatterYCol}
                                onChange={(e) => setScatterYCol(e.target.value)}
                                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-zinc-500"
                            >
                                {numericColumns.map((col) => (
                                    <option key={col.name} value={col.name}>
                                        {col.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Chart Card */}
                    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 space-y-4">
                        <div>
                            <h4 className="text-lg font-semibold text-zinc-200">Scatter Plot Matrix Relationship</h4>
                            <p className="text-xs text-zinc-400">Co-dependence between X and Y variables (sampled up to 1000 points)</p>
                        </div>

                        {scatterLoading ? (
                            <div className="h-[420px] flex items-center justify-center text-zinc-500">Loading Scatterplot...</div>
                        ) : scatterError ? (
                            <div className="h-[420px] flex items-center justify-center text-rose-400 text-sm">Error: {scatterError}</div>
                        ) : scatterData && scatterData.length > 0 ? (
                            <div className="h-[420px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 10 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#1f1f23" />
                                        <XAxis
                                            type="number"
                                            dataKey="x"
                                            name={scatterXCol}
                                            stroke="#71717a"
                                            fontSize={11}
                                            label={{ value: scatterXCol, position: "insideBottom", offset: -5, fill: "#a1a1aa" }}
                                        />
                                        <YAxis
                                            type="number"
                                            dataKey="y"
                                            name={scatterYCol}
                                            stroke="#71717a"
                                            fontSize={11}
                                            label={{ value: scatterYCol, angle: -90, position: "insideLeft", offset: 10, fill: "#a1a1aa" }}
                                        />
                                        <Tooltip
                                            cursor={{ strokeDasharray: "3 3", stroke: "#27272a" }}
                                            contentStyle={{ backgroundColor: "#09090b", borderColor: "#27272a", borderRadius: "8px" }}
                                            labelStyle={{ display: "none" }}
                                            itemStyle={{ fontSize: "12px", fontFamily: "monospace" }}
                                            formatter={(value: any, name: any, props: any) => {
                                                const point = props.payload;
                                                return [
                                                    <>
                                                        <div className="text-zinc-400 font-sans font-semibold mb-1">Data Point</div>
                                                        <div className="text-zinc-300 font-mono">{scatterXCol}: {point.x.toFixed(4)}</div>
                                                        <div className="text-zinc-300 font-mono">{scatterYCol}: {point.y.toFixed(4)}</div>
                                                    </>,
                                                    "",
                                                ];
                                            }}
                                        />
                                        <Scatter name="Points" data={scatterData} fill="#10b981" opacity={0.6} />
                                    </ScatterChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="h-[420px] flex items-center justify-center text-zinc-600">No relationship points.</div>
                        )}
                    </div>
                </div>
            )}

            {/* Subtab: Correlation Heatmap */}
            {subTab === "correlation" && (
                <div className="space-y-6">
                    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 space-y-4">
                        <div>
                            <h4 className="text-lg font-semibold text-zinc-200">Pearson Correlation Heatmap</h4>
                            <p className="text-xs text-zinc-400">Strength of linear relationships (positive correlation is green, negative is rose)</p>
                        </div>

                        {corrLoading ? (
                            <div className="h-[300px] flex items-center justify-center text-zinc-500">Loading Correlation Matrix...</div>
                        ) : corrError ? (
                            <div className="h-[300px] flex items-center justify-center text-rose-400 text-sm">Error: {corrError}</div>
                        ) : corrData && corrData.columns.length > 0 ? (
                            <div className="overflow-x-auto pb-4">
                                <div className="inline-block min-w-full align-middle">
                                    <div className="border border-zinc-800 rounded-xl overflow-hidden">
                                        <table className="min-w-full divide-y divide-zinc-800 text-xs font-mono text-center">
                                            <thead className="bg-zinc-950/60 text-zinc-400 font-semibold">
                                                <tr>
                                                    <th className="px-4 py-3 text-left bg-zinc-950 font-sans border-r border-b border-zinc-800 min-w-[120px]">Variable</th>
                                                    {corrData.columns.map((col) => (
                                                        <th key={col} className="px-3 py-3 border-b border-r border-zinc-800 text-ellipsis overflow-hidden max-w-[100px]" title={col}>
                                                            {col}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-zinc-850">
                                                {corrData.columns.map((rowCol, rowIndex) => (
                                                    <tr key={rowCol} className="hover:bg-zinc-900/20">
                                                        <td className="px-4 py-3 text-left font-sans font-medium text-zinc-300 bg-zinc-950/20 border-r border-zinc-800 sticky left-0 min-w-[120px]">
                                                            {rowCol}
                                                        </td>
                                                        {corrData.columns.map((col, colIndex) => {
                                                            const val = corrData.matrix[rowIndex][colIndex] ?? 0;
                                                            // Calculate color gradient based on value from -1 to 1
                                                            // -1 is deep red, 0 is dark gray, +1 is deep green
                                                            let bgStyle = { backgroundColor: "#18181b", color: "#a1a1aa" };
                                                            if (val > 0) {
                                                                // Positive correlation: Emerald (opacity goes 0.05 to 0.8)
                                                                const alpha = 0.05 + val * 0.75;
                                                                bgStyle = {
                                                                    backgroundColor: `rgba(16, 185, 129, ${alpha})`,
                                                                    color: val > 0.4 ? "#ffffff" : "#a1a1aa",
                                                                };
                                                            } else if (val < 0) {
                                                                // Negative correlation: Rose
                                                                const absVal = Math.abs(val);
                                                                const alpha = 0.05 + absVal * 0.75;
                                                                bgStyle = {
                                                                    backgroundColor: `rgba(244, 63, 94, ${alpha})`,
                                                                    color: absVal > 0.4 ? "#ffffff" : "#a1a1aa",
                                                                };
                                                            }

                                                            return (
                                                                <td
                                                                    key={col}
                                                                    style={bgStyle}
                                                                    className="px-3 py-3 border-r border-zinc-850 font-bold"
                                                                    title={`${rowCol} vs ${col}: ${val.toFixed(6)}`}
                                                                >
                                                                    {val.toFixed(2)}
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="h-[300px] flex items-center justify-center text-zinc-600">No correlation columns found.</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

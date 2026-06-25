"use client";

import { useEffect, useState } from "react";
import { trainModel, getModelJobStatus, runPrediction, getDatasetModels } from "../../lib/api";
import { ColumnProfile } from "../../lib/types";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Underdog } from "next/font/google";

interface ModelTrainingTabProps {
    datasetId: string;
    columns: ColumnProfile[];
    filename: string;
}

const ALGORITHM_INFO: Record<string, { title: string; desc: string; pros: string[]; cons: string[] }> = {
    linear_regression: {
        title: "Linear Regression",
        desc: "Models a linear relationship between input features and a numeric target.",
        pros: ["Extremely fast", "Highly interpretable coefficients", "No risk of overfitting with small feature count"],
        cons: ["Assumes linear relationship", "Sensitive to outliers", "Cannot model complex patterns"]
    },
    ridge: {
        title: "Ridge Regression",
        desc: "Linear regression with L2 regularization to prevent overfitting and address multicollinearity.",
        pros: ["Handles highly correlated features well", "Reduces model complexity", "Fast computation"],
        cons: ["Assumes linearity", "Does not perform feature selection (coefficients are shrunk to near zero but not zero)"]
    },
    logistic_regression: {
        title: "Logistic Regression",
        desc: "A linear model for binary or multi-class classification that computes class probabilities.",
        pros: ["Fast to train", "Outputs calibrated probabilities", "Easy to interpret"],
        cons: ["Assumes linear boundary", "Underperforms on complex non-linear data"]
    },
    random_forest: {
        title: "Random Forest",
        desc: "An ensemble of decision trees trained on random subsets of features and data.",
        pros: ["Robust to overfitting", "Handles non-linear relationships naturally", "Requires minimal scaling/preprocessing"],
        cons: ["Slow to train on huge datasets", "Difficult to interpret compared to single trees", "Large memory footprint"]
    },
    gradient_boosting: {
        title: "Gradient Boosting",
        desc: "Builds trees sequentially, with each tree correcting errors of the previous one.",
        pros: ["Very high accuracy and predictive power", "Supports custom loss functions"],
        cons: ["Prone to overfitting if not tuned", "Slow sequential training", "Sensitive to noise"]
    },
    xgboost: {
        title: "XGBoost",
        desc: "Extreme Gradient Boosting - optimized, parallelized tree-boosting framework.",
        pros: ["State-of-the-art accuracy", "Ultra-fast execution with parallel CPU usage", "Handles missing values natively"],
        cons: ["Many hyperparameters to tune", "Black-box nature makes it hard to explain"]
    },
    lightgbm: {
        title: "LightGBM",
        desc: "Light Gradient Boosting Machine - uses leaf-wise tree growth for speed and efficiency.",
        pros: ["Extremely fast training speed", "Low memory usage", "Designed for large scale datasets"],
        cons: ["Prone to overfitting on small datasets", "Deep leaf-wise trees need careful max_depth limits"]
    },
    svm: {
        title: "Support Vector Machine (SVM)",
        desc: "Finds the optimal hyperplane that maximizes class separation in high dimensions.",
        pros: ["Effective in high-dimensional spaces", "Versatile due to kernel trick options"],
        cons: ["Extremely slow on large datasets", "Sensitive to scaling and noise", "Does not provide probability estimates natively"]
    }
};

export default function ModelTrainingTab({ datasetId, columns, filename }: ModelTrainingTabProps) {
    const [isMounted, setIsMounted] = useState(false);
    const [targetCol, setTargetCol] = useState(columns[0]?.name || "");
    const [taskType, setTaskType] = useState<"regression" | "classification">("regression");
    const [algorithm, setAlgorithm] = useState("random_forest");
    const [split, setSplit] = useState(0.8);

    // Background execution state
    const [loading, setLoading] = useState(false);
    const [jobId, setJobId] = useState<string | null>(null);
    const [jobStatus, setJobStatus] = useState<"queued" | "running" | "complete" | "failed" | null>(null);

    const [parameters, setParameters] = useState<Record<string, any>>({});
    const [error, setError] = useState<string | null>(null);
    const [results, setResults] = useState<any | null>(null);

    // Prediction state hooks 
    const [predInputs, setPredInputs] = useState<Record<string, number>>({});
    const [predictionResult, setPredictionResult] = useState<{ prediction: string; confidence: number | null; task_type: string } | null>(null);
    const [predLoading, setPredLoading] = useState(false);
    const [predError, setPredError] = useState<string | null>(null);

    // Leaderboard state 
    const [modelHistory, setModelHistory] = useState<any[]>([]);

    // SSR mounting check
    useEffect(() => {
        setIsMounted(true);
    }, []);

    const fetchHistory = async () => {
        if (!datasetId) return;
        try {
            const data = await getDatasetModels(datasetId);
            setModelHistory(data);
        } catch (err) {
            console.error("Failed to load model history.", err);
        }
    };

    useEffect(() => {
        if (datasetId) {
            fetchHistory();
        }
    }, [datasetId]);

    const handleLoadModel = (modelRun: any) => {
        setTargetCol(modelRun.target_column);
        setTaskType(modelRun.task_type);
        setAlgorithm(modelRun.algorithm);
        setParameters(modelRun.parameters || {});
        setSplit(modelRun.split || 0.8);
        setJobId(modelRun.job_id);
        setJobStatus("complete");
        setResults({
            metrics: modelRun.metrics,
            feature_importances: modelRun.feature_importances,
            features_used: modelRun.features_used,
            target_column: modelRun.target_column,
            algorithm: modelRun.algorithm,
            task_type: modelRun.task_type
        });
    };

    // Set default algorithm whenever task type changes
    useEffect(() => {
        if (taskType === "regression") {
            setAlgorithm("random_forest");
        } else {
            setAlgorithm("random_forest");
        }
    }, [taskType]);

    // Clear error and results when configuration changes
    useEffect(() => {
        setError(null);
        setResults(null);
    }, [targetCol, taskType, algorithm]);

    // Initialize/Reset custom hyperparameters when algorithm changes
    useEffect(() => {
        const defaults: Record<string, any> = {};
        if (algorithm === "linear_regression") {
            defaults.fit_intercept = true;
        } else if (algorithm === "ridge") {
            defaults.alpha = 1.0;
        } else if (algorithm === "random_forest") {
            defaults.n_estimators = 100;
            defaults.max_depth = "None";
            if (taskType === "classification") {
                defaults.class_weight = "None";
            } else {
                defaults.min_samples_split = 2;
            }
        } else if (algorithm === "gradient_boosting" || algorithm === "xgboost" || algorithm === "lightgbm") {
            defaults.n_estimators = 100;
            defaults.max_depth = algorithm === "gradient_boosting" ? 3 : algorithm === "xgboost" ? 6 : -1;
            defaults.learning_rate = 0.1;
        } else if (algorithm === "logistic_regression") {
            defaults.C = 1.0;
            defaults.max_iter = 1000;
            defaults.solver = "lbfgs";
        } else if (algorithm === "svm") {
            defaults.C = 1.0;
            defaults.kernel = "rbf";
        }
        setParameters(defaults);
    }, [algorithm, taskType]);

    // Background job polling handler
    useEffect(() => {
        if (!jobId || !jobStatus || jobStatus === "complete" || jobStatus === "failed") {
            return;
        }

        let pollCount = 0;
        let consecutiveErrors = 0;
        const maxPolls = 150;        // 5 minutes max (150 × 2s)
        const maxConsecErrors = 15;  // tolerate 15 consecutive network errors (~30s) before giving up

        const interval = setInterval(async () => {
            pollCount++;
            if (pollCount > maxPolls) {
                setError("Training took too long. The job is still running in the background but we stopped polling.");
                setLoading(false);
                setJobStatus("failed");
                clearInterval(interval);
                return;
            }

            try {
                const data = await getModelJobStatus(jobId);
                consecutiveErrors = 0; // reset on success
                setJobStatus(data.status);

                if (data.status === "complete") {
                    setResults(data.result);
                    setLoading(false);
                    fetchHistory();
                    clearInterval(interval);
                } else if (data.status === "failed") {
                    setError(data.error_message || "Model training failed on the worker");
                    setLoading(false);
                    clearInterval(interval);
                }
            } catch (err) {
                consecutiveErrors++;
                console.warn(`Polling error (${consecutiveErrors}/${maxConsecErrors}):`, err);
                if (consecutiveErrors >= maxConsecErrors) {
                    setError("Lost connection to the training server. Check that the API is running.");
                    setLoading(false);
                    setJobStatus("failed");
                    clearInterval(interval);
                }
                // else: swallow error and retry on next tick
            }
        }, 2000);

        return () => clearInterval(interval);
    }, [jobId, jobStatus]);

    useEffect(() => {
        if (results?.features_used) {
            const initialInputs: Record<string, number> = {};
            results.features_used.forEach((feature: string) => {
                initialInputs[feature] = 0;
            });
            setPredInputs(initialInputs);
            setPredictionResult(null);
            setPredError(null);
        }
    }, [results]);

    const handleTrain = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setResults(null);
        setJobId(null);
        setJobStatus(null);

        try {
            // Queue training task on the RQ worker
            const data = await trainModel(datasetId, targetCol, taskType, algorithm, split, parameters);
            setJobId(data.job_id);
            setJobStatus(data.status);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to trigger training");
            setLoading(false);
        }
    };

    const handlePredict = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!jobId) return;
        setPredLoading(true);
        setPredError(null);
        setPredictionResult(null);
        try {
            const res = await runPrediction(jobId, predInputs);
            setPredictionResult(res);
        } catch (err) {
            setPredError(err instanceof Error ? err.message : "Failed to run prediction");
        } finally {
            setPredLoading(false);
        }
    }

    const isNumeric = (col: ColumnProfile) => {
        return col.detected_type === "Numerical" ||
            col.dtype.toLowerCase().includes("int") ||
            col.dtype.toLowerCase().includes("float");
    };

    if (!isMounted) return null;

    return (
        <div className="space-y-8">
            <div className="border-b border-zinc-850 pb-5">
                <h3 className="text-xl font-bold text-zinc-100">Model Builder</h3>
                <p className="text-xs text-zinc-400">Configure parameters to train and evaluate ML algorithms asynchronously in the background</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* Configuration Left Panel (Span 2) */}
                <form onSubmit={handleTrain} className="lg:col-span-2 rounded-2xl border border-zinc-850 bg-zinc-900/40 p-6 space-y-6">
                    <h4 className="text-sm font-bold text-zinc-300 uppercase tracking-wide">Training Parameters</h4>

                    <div className="space-y-1">
                        <label className="text-xs text-zinc-450 font-semibold uppercase">Target Column (y)</label>
                        <select
                            value={targetCol}
                            onChange={(e) => setTargetCol(e.target.value)}
                            className="w-full rounded-lg border border-zinc-750 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
                        >
                            {columns.map((c) => (
                                <option key={c.name} value={c.name}>
                                    {c.name} ({c.dtype})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs text-zinc-450 uppercase font-medium">Task Type</label>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setTaskType("regression")}
                                className={`flex-1 rounded-lg py-2 border text-xs font-semibold transition ${taskType === "regression" ? "bg-emerald-950/40 text-emerald-400 border-emerald-800" : "bg-zinc-950/40 border-zinc-800 text-zinc-400"}`}
                            >
                                Regression
                            </button>
                            <button
                                type="button"
                                onClick={() => setTaskType("classification")}
                                className={`flex-1 rounded-lg py-2 border text-xs font-semibold transition ${taskType === "classification" ? "bg-emerald-950/40 text-emerald-400 border-emerald-800" : "bg-zinc-950/40 border-zinc-800 text-zinc-400"}`}
                            >
                                Classification
                            </button>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs text-zinc-450 font-semibold uppercase">Algorithm Model</label>
                        <select
                            value={algorithm}
                            onChange={(e) => setAlgorithm(e.target.value)}
                            className="w-full rounded-lg border border-zinc-750 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
                        >
                            {taskType === "regression" ? (
                                <>
                                    <option value="random_forest">Random Forest Regressor</option>
                                    <option value="gradient_boosting">Gradient Boosting Regressor</option>
                                    <option value="linear_regression">Linear Regression</option>
                                    <option value="ridge">Ridge Regression</option>
                                    <option value="xgboost">XGBoost Regressor</option>
                                    <option value="lightgbm">LightGBM Regressor</option>
                                </>
                            ) : (
                                <>
                                    <option value="random_forest">Random Forest Classifier</option>
                                    <option value="gradient_boosting">Gradient Boosting Classifier</option>
                                    <option value="logistic_regression">Logistic Regression</option>
                                    <option value="svm">Support Vector Machine (SVM)</option>
                                    <option value="xgboost">XGBoost Classifier</option>
                                    <option value="lightgbm">LightGBM Classifier</option>
                                </>
                            )}
                        </select>
                    </div>

                    {/* Dynamic Hyperparameters Forms */}
                    {Object.keys(parameters).length > 0 && (
                        <div className="space-y-4 border-t border-zinc-850 pt-4">
                            <h5 className="text-xs font-bold text-zinc-350 uppercase tracking-wider">Hyperparameters</h5>

                            {algorithm === "linear_regression" && (
                                <div className="flex items-center justify-between">
                                    <label className="text-xs text-zinc-400 font-semibold uppercase">Fit Intercept</label>
                                    <input
                                        type="checkbox"
                                        checked={parameters.fit_intercept ?? true}
                                        onChange={(e) => setParameters({ ...parameters, fit_intercept: e.target.checked })}
                                        className="h-4 w-4 rounded bg-zinc-950 border-zinc-750 accent-emerald-500 cursor-pointer"
                                    />
                                </div>
                            )}

                            {algorithm === "ridge" && (
                                <div className="space-y-1">
                                    <label className="text-xs text-zinc-400 font-semibold uppercase">Alpha (Regularization)</label>
                                    <select
                                        value={String(parameters.alpha ?? 1.0)}
                                        onChange={(e) => setParameters({ ...parameters, alpha: parseFloat(e.target.value) })}
                                        className="w-full rounded-lg border border-zinc-750 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
                                    >
                                        <option value="0.01">0.01 (Weak Regularization)</option>
                                        <option value="0.1">0.1</option>
                                        <option value="1">1.0 (Default)</option>
                                        <option value="10">10.0</option>
                                        <option value="100">100.0 (Strong Regularization)</option>
                                    </select>
                                </div>
                            )}

                            {(algorithm === "random_forest" || algorithm === "gradient_boosting" || algorithm === "xgboost" || algorithm === "lightgbm") && (
                                <div className="space-y-4">
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-xs text-zinc-400 font-semibold uppercase">
                                            <span>Estimators (Trees)</span>
                                            <span className="font-mono text-emerald-400">{parameters.n_estimators ?? 100}</span>
                                        </div>
                                        <input
                                            type="range"
                                            min="10"
                                            max="300"
                                            step="10"
                                            value={parameters.n_estimators ?? 100}
                                            onChange={(e) => setParameters({ ...parameters, n_estimators: parseInt(e.target.value) })}
                                            className="w-full accent-emerald-500 cursor-pointer h-1.5 rounded bg-zinc-850"
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-xs text-zinc-400 font-semibold uppercase">Max Depth</label>
                                        <select
                                            value={parameters.max_depth !== null && parameters.max_depth !== undefined ? String(parameters.max_depth) : "None"}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setParameters({ ...parameters, max_depth: val === "None" ? null : parseInt(val) });
                                            }}
                                            className="w-full rounded-lg border border-zinc-750 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
                                        >
                                            {algorithm === "random_forest" && <option value="None">None (Unlimited)</option>}
                                            {algorithm === "lightgbm" && <option value="-1">-1 (Unlimited)</option>}
                                            <option value="3">3 (Shallow)</option>
                                            <option value="5">5</option>
                                            <option value="6">6</option>
                                            <option value="10">10</option>
                                            <option value="20">20 (Deep)</option>
                                        </select>
                                    </div>

                                    {algorithm === "random_forest" && taskType === "regression" && (
                                        <div className="space-y-1">
                                            <label className="text-xs text-zinc-400 font-semibold uppercase">Min Samples Split</label>
                                            <select
                                                value={String(parameters.min_samples_split ?? 2)}
                                                onChange={(e) => setParameters({ ...parameters, min_samples_split: parseInt(e.target.value) })}
                                                className="w-full rounded-lg border border-zinc-750 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
                                            >
                                                <option value="2">2 (Default)</option>
                                                <option value="5">5</option>
                                                <option value="10">10</option>
                                            </select>
                                        </div>
                                    )}

                                    {algorithm === "random_forest" && taskType === "classification" && (
                                        <div className="space-y-1">
                                            <label className="text-xs text-zinc-400 font-semibold uppercase">Class Weight</label>
                                            <select
                                                value={parameters.class_weight !== null && parameters.class_weight !== undefined ? String(parameters.class_weight) : "None"}
                                                onChange={(e) => setParameters({ ...parameters, class_weight: e.target.value === "None" ? null : e.target.value })}
                                                className="w-full rounded-lg border border-zinc-750 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
                                            >
                                                <option value="None">None (Uniform)</option>
                                                <option value="balanced">Balanced (Inverse Frequencies)</option>
                                            </select>
                                        </div>
                                    )}

                                    {algorithm !== "random_forest" && (
                                        <div className="space-y-1">
                                            <div className="flex justify-between text-xs text-zinc-400 font-semibold uppercase">
                                                <span>Learning Rate</span>
                                                <span className="font-mono text-emerald-400">{parameters.learning_rate ?? 0.1}</span>
                                            </div>
                                            <input
                                                type="range"
                                                min="0.01"
                                                max="0.5"
                                                step="0.01"
                                                value={parameters.learning_rate ?? 0.1}
                                                onChange={(e) => setParameters({ ...parameters, learning_rate: parseFloat(e.target.value) })}
                                                className="w-full accent-emerald-500 cursor-pointer h-1.5 rounded bg-zinc-850"
                                            />
                                        </div>
                                    )}
                                </div>
                            )}

                            {algorithm === "logistic_regression" && (
                                <div className="space-y-3">
                                    <div className="space-y-1">
                                        <label className="text-xs text-zinc-400 font-semibold uppercase">C (Regularization Penalty)</label>
                                        <select
                                            value={String(parameters.C ?? 1.0)}
                                            onChange={(e) => setParameters({ ...parameters, C: parseFloat(e.target.value) })}
                                            className="w-full rounded-lg border border-zinc-750 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
                                        >
                                            <option value="0.01">0.01 (Strong Penalization)</option>
                                            <option value="0.1">0.1</option>
                                            <option value="1">1.0 (Default)</option>
                                            <option value="10">10.0 (Weak Penalization)</option>
                                        </select>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-xs text-zinc-400 font-semibold uppercase">Solver</label>
                                        <select
                                            value={parameters.solver ?? "lbfgs"}
                                            onChange={(e) => setParameters({ ...parameters, solver: e.target.value })}
                                            className="w-full rounded-lg border border-zinc-750 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
                                        >
                                            <option value="lbfgs">lbfgs (L2/None)</option>
                                            <option value="liblinear">liblinear (L1/L2)</option>
                                            <option value="saga">saga (ElasticNet/L1/L2)</option>
                                        </select>
                                    </div>
                                </div>
                            )}

                            {algorithm === "svm" && (
                                <div className="space-y-3">
                                    <div className="space-y-1">
                                        <label className="text-xs text-zinc-400 font-semibold uppercase">C (Margin Hardness)</label>
                                        <select
                                            value={String(parameters.C ?? 1.0)}
                                            onChange={(e) => setParameters({ ...parameters, C: parseFloat(e.target.value) })}
                                            className="w-full rounded-lg border border-zinc-750 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
                                        >
                                            <option value="0.1">0.1 (Soft Margin)</option>
                                            <option value="1">1.0 (Default)</option>
                                            <option value="10">10.0 (Hard Margin)</option>
                                        </select>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-xs text-zinc-400 font-semibold uppercase">Kernel Type</label>
                                        <select
                                            value={parameters.kernel ?? "rbf"}
                                            onChange={(e) => setParameters({ ...parameters, kernel: e.target.value })}
                                            className="w-full rounded-lg border border-zinc-750 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
                                        >
                                            <option value="rbf">RBF (Radial Basis)</option>
                                            <option value="linear">Linear</option>
                                            <option value="poly">Polynomial</option>
                                            <option value="sigmoid">Sigmoid</option>
                                        </select>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="space-y-2">
                        <div className="flex justify-between text-xs text-zinc-450 font-semibold uppercase">
                            <span>Train Split</span>
                            <span className="font-mono text-emerald-400">{(split * 100).toFixed(0)}% / {((1 - split) * 100).toFixed(0)}%</span>
                        </div>
                        <input
                            type="range"
                            min="0.5"
                            max="0.9"
                            step="0.05"
                            value={split}
                            onChange={(e) => setSplit(parseFloat(e.target.value))}
                            className="w-full accent-emerald-500 cursor-pointer h-1.5 rounded bg-zinc-850"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                    >
                        {loading ? "Queued & Training..." : "Train Model →"}
                    </button>
                </form>

                {/* Dashboard Results Panel (Span 3) */}
                <div className="lg:col-span-3 space-y-6">
                    {/* Error Box */}
                    {error && (
                        <div className="rounded-xl border border-rose-900 bg-rose-950/20 p-4 text-rose-400 text-sm">
                            ❌ {error}
                        </div>
                    )}

                    {/* Pre-training Info State */}
                    {!results && !loading && (
                        <div className="space-y-6 animate-fade-in">
                            {/* Pipeline and Data Prep info */}
                            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 space-y-4">
                                <h5 className="text-xs font-bold text-zinc-350 uppercase tracking-wider">Data Pipeline Alignment</h5>
                                <div className="p-3.5 rounded-xl border border-emerald-800/10 bg-emerald-950/5 flex items-center justify-between">
                                    <div className="flex items-center gap-2.5">
                                        <span className="text-lg">📊</span>
                                        <div>
                                            <span className="block text-xs font-bold text-zinc-200">{filename}</span>
                                            <span className="block text-[10px] text-zinc-400">
                                                {filename.toLowerCase().includes("cleaned") ? "Transformed & cleaned dataset active" : "Original raw dataset active"}
                                            </span>
                                        </div>
                                    </div>
                                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${filename.toLowerCase().includes("cleaned") ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20" : "bg-zinc-800 text-zinc-400"}`}>
                                        {filename.toLowerCase().includes("cleaned") ? "Transformed" : "Original"}
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <span className="block text-[10px] text-zinc-550 font-bold uppercase mb-1">Target Variable (y)</span>
                                        <span className="inline-block px-2.5 py-1 rounded bg-zinc-950 text-xs font-semibold font-mono text-emerald-400 border border-zinc-850 truncate max-w-full">
                                            {targetCol || "None"}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="block text-[10px] text-zinc-550 font-bold uppercase mb-1">Feature count (X)</span>
                                        <span className="text-xs font-semibold text-zinc-350 block">
                                            {columns.filter(c => c.name !== targetCol && isNumeric(c)).length} numeric features
                                        </span>
                                    </div>
                                </div>

                                {/* Features lists */}
                                <div className="space-y-2 pt-3 border-t border-zinc-850">
                                    <span className="block text-[10px] text-zinc-500 font-bold uppercase">Features Used for Training (X)</span>
                                    <div className="flex flex-wrap gap-1.5 max-h-[80px] overflow-y-auto pr-2 custom-scrollbar">
                                        {columns
                                            .filter(c => c.name !== targetCol && isNumeric(c))
                                            .map(c => (
                                                <span key={c.name} className="px-2 py-0.5 rounded bg-zinc-950 text-[10px] font-mono text-zinc-400 border border-zinc-850">
                                                    {c.name}
                                                </span>
                                            ))}
                                        {columns.filter(c => c.name !== targetCol && isNumeric(c)).length === 0 && (
                                            <span className="text-[11px] text-rose-400 font-medium">
                                                ⚠️ No numeric features available. You must encode categorical fields in the Pipeline Builder first!
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Dropped non-numeric lists */}
                                {columns.some(c => c.name !== targetCol && !isNumeric(c)) && (
                                    <div className="space-y-2 pt-3 border-t border-zinc-850">
                                        <span className="block text-[10px] text-zinc-500 font-bold uppercase">Excluded Columns (Categorical/Text)</span>
                                        <div className="flex flex-wrap gap-1.5 max-h-[60px] overflow-y-auto pr-2 custom-scrollbar">
                                            {columns
                                                .filter(c => c.name !== targetCol && !isNumeric(c))
                                                .map(c => (
                                                    <span key={c.name} className="px-2 py-0.5 rounded bg-zinc-950 text-[10px] font-mono text-zinc-500 border border-zinc-850 line-through decoration-zinc-700">
                                                        {c.name}
                                                    </span>
                                                ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Algorithm Info Card */}
                            {ALGORITHM_INFO[algorithm] && (
                                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 space-y-4">
                                    <div>
                                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Algorithm Blueprint</span>
                                        <h4 className="text-sm font-bold text-zinc-200 mt-1">{ALGORITHM_INFO[algorithm].title}</h4>
                                        <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{ALGORITHM_INFO[algorithm].desc}</p>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-zinc-850">
                                        <div className="space-y-1">
                                            <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wide">Advantages</span>
                                            <ul className="text-xs text-zinc-350 list-disc list-inside space-y-1">
                                                {ALGORITHM_INFO[algorithm].pros.map((pro, idx) => (
                                                    <li key={idx} className="leading-normal">{pro}</li>
                                                ))}
                                            </ul>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wide">Limitations</span>
                                            <ul className="text-xs text-zinc-350 list-disc list-inside space-y-1">
                                                {ALGORITHM_INFO[algorithm].cons.map((con, idx) => (
                                                    <li key={idx} className="leading-normal">{con}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Active Loading Queue State */}
                    {loading && (
                        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-10 min-h-[300px] flex flex-col justify-center items-center text-center space-y-4 animate-pulse">
                            <div className="relative flex items-center justify-center">
                                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
                                <div className="absolute h-8 w-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-sm">
                                    ⚙️
                                </div>
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-zinc-200 uppercase tracking-wider">
                                    {jobStatus === "queued" ? "Queued in RQ Runner" : "Running Training"}
                                </p>
                                <p className="text-xs text-zinc-500 mt-1.5 max-w-xs mx-auto">
                                    {jobStatus === "queued"
                                        ? "Waiting for an active python RQ worker process to pick up the job..."
                                        : `Fitting ${ALGORITHM_INFO[algorithm]?.title || algorithm} on ${columns.filter(c => c.name !== targetCol && isNumeric(c)).length} columns...`}
                                </p>
                            </div>
                            <div className="px-3 py-1 rounded bg-zinc-950 border border-zinc-850 font-mono text-[9px] text-zinc-500">
                                Job ID: {jobId ? `${jobId.slice(0, 8)}...` : "Initializing..."}
                            </div>
                        </div>
                    )}

                    {/* Results Content Dashboard */}
                    {results && (
                        <div className="space-y-6 animate-fade-in">
                            {/* Score Metrics Row */}
                            <div className="grid grid-cols-3 gap-4">
                                {taskType === "regression" ? (
                                    <>
                                        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                                            <span className="block text-[10px] text-zinc-550 font-semibold uppercase">R-Squared (R²)</span>
                                            <span className="block mt-1.5 text-xl font-bold font-mono text-emerald-400">
                                                {results.metrics.r2 !== undefined ? results.metrics.r2.toFixed(4) : "N/A"}
                                            </span>
                                        </div>
                                        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                                            <span className="block text-[10px] text-zinc-550 font-semibold uppercase">RMSE</span>
                                            <span className="block mt-1.5 text-xl font-bold font-mono text-zinc-200">
                                                {results.metrics.rmse !== undefined ? results.metrics.rmse.toFixed(4) : "N/A"}
                                            </span>
                                        </div>
                                        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                                            <span className="block text-[10px] text-zinc-550 font-semibold uppercase">MAE</span>
                                            <span className="block mt-1.5 text-xl font-bold font-mono text-zinc-200">
                                                {results.metrics.mae !== undefined ? results.metrics.mae.toFixed(4) : "N/A"}
                                            </span>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                                            <span className="block text-[10px] text-zinc-550 font-semibold uppercase">Accuracy</span>
                                            <span className="block mt-1.5 text-xl font-bold font-mono text-emerald-400">
                                                {results.metrics.accuracy !== undefined ? `${(results.metrics.accuracy * 100).toFixed(2)}%` : "N/A"}
                                            </span>
                                        </div>
                                        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                                            <span className="block text-[10px] text-zinc-550 font-semibold uppercase">Macro F1</span>
                                            <span className="block mt-1.5 text-xl font-bold font-mono text-zinc-200">
                                                {results.metrics.f1 !== undefined ? `${(results.metrics.f1 * 100).toFixed(2)}%` : "N/A"}
                                            </span>
                                        </div>
                                        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                                            <span className="block text-[10px] text-zinc-550 font-semibold uppercase">Precision</span>
                                            <span className="block mt-1.5 text-xl font-bold font-mono text-zinc-200">
                                                {results.metrics.precision !== undefined ? `${(results.metrics.precision * 100).toFixed(2)}%` : "N/A"}
                                            </span>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Two-Column Chart Layout */}
                            <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                                {/* Feature Importance Chart (Span 3 - 60%) */}
                                <div className="md:col-span-3 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 space-y-4">
                                    <div>
                                        <h5 className="text-sm font-semibold text-zinc-200">Relative Feature Importance</h5>
                                        <p className="text-[10px] text-zinc-500">Weight coefficients normalized between 0 and 1</p>
                                    </div>
                                    <div className="h-[280px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={results.feature_importances} layout="vertical" margin={{ left: -10, right: 10 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#1f1f23" horizontal={false} />
                                                <XAxis type="number" stroke="#52525b" fontSize={9} />
                                                <YAxis dataKey="feature" type="category" stroke="#52525b" fontSize={9} width={80} />
                                                <Tooltip
                                                    cursor={{ fill: "#27272a", opacity: 0.15 }}
                                                    contentStyle={{ backgroundColor: "#09090b", borderColor: "#27272a", borderRadius: "8px" }}
                                                    labelStyle={{ display: "none" }}
                                                    itemStyle={{ color: "#34d399", fontSize: "11px", fontFamily: "monospace" }}
                                                    formatter={(value: any) => [`${(Number(value || 0) * 100).toFixed(2)}%`, "Weight"] as [string, string]}
                                                />

                                                <Bar dataKey="importance" fill="#10b981" radius={[0, 3, 3, 0]} opacity={0.8} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                {/* Confusion Matrix (Span 2 - 40% - Classification only) */}
                                {taskType === "classification" && results.metrics.confusion_matrix ? (
                                    <div className="md:col-span-2 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 space-y-4">
                                        <div>
                                            <h5 className="text-sm text-zinc-200 font-medium">Confusion Matrix</h5>
                                            <p className="text-[10px] text-zinc-500">Rows are True categories, Cols are Predicted</p>
                                        </div>

                                        <div className="flex flex-col items-center justify-center h-[260px] w-full">
                                            <div
                                                className="grid gap-1 font-mono text-[10px] text-center font-bold"
                                                style={{
                                                    gridTemplateColumns: `repeat(${results.metrics.confusion_matrix.length}, minmax(0, 1fr))`,
                                                    width: "100%",
                                                    maxWidth: "180px",
                                                }}
                                            >
                                                {results.metrics.confusion_matrix.flatMap((row: number[], rIdx: number) =>
                                                    row.map((val: number, cIdx: number) => {
                                                        const isDiagonal = rIdx === cIdx;
                                                        return (
                                                            <div
                                                                key={`${rIdx}-${cIdx}`}
                                                                className={`aspect-square flex items-center justify-center rounded border transition text-sm ${isDiagonal
                                                                    ? "bg-emerald-950/40 border-emerald-800/80 text-emerald-400"
                                                                    : "bg-rose-950/25 border-rose-900/35 text-rose-450"
                                                                    }`}
                                                                title={`True: ${results.metrics.classes?.[rIdx] || rIdx}, Pred: ${results.metrics.classes?.[cIdx] || cIdx}`}
                                                            >
                                                                {val}
                                                            </div>
                                                        );
                                                    })
                                                )}
                                            </div>

                                            {/* Legend */}
                                            <div className="flex gap-4 mt-4 text-[10px] text-zinc-550 font-semibold font-mono">
                                                <div className="flex items-center gap-1.5">
                                                    <div className="h-2 w-2 rounded bg-emerald-950 border border-emerald-800"></div>
                                                    <span>Correct</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <div className="h-2 w-2 rounded bg-rose-950/30 border border-rose-900/40"></div>
                                                    <span>Errors</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    /* Model Details (Span 2 - 40% - Regression fallback) */
                                    <div className="md:col-span-2 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 space-y-4">
                                        <h5 className="text-sm font-semibold text-zinc-200">Execution Info</h5>
                                        <div className="space-y-3 text-xs font-mono">
                                            <div className="border-b border-zinc-850 pb-1.5">
                                                <span className="block text-[10px] text-zinc-550">Features Trained</span>
                                                <span className="text-zinc-300 font-semibold">{results.features_used?.length || 0} columns</span>
                                            </div>
                                            <div className="border-b border-zinc-850 pb-1.5">
                                                <span className="block text-[10px] text-zinc-550">Validation Split</span>
                                                <span className="text-zinc-300 font-semibold">{((1 - split) * 100).toFixed(0)}% test set</span>
                                            </div>
                                            <div>
                                                <span className="block text-[10px] text-zinc-550">Target Variable</span>
                                                <span className="text-emerald-400 font-semibold truncate block">{results.target_column}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Prediction Playground (renders below the two-column chart layout) */}
                            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 space-y-4">
                                <div>
                                    <h5 className="text-sm font-semibold text-zinc-200">Prediction Playground</h5>
                                    <p className="text-[10px] text-zinc-500">Enter values to run real-time predictions on the trained model</p>
                                </div>
                                <form onSubmit={handlePredict} className="space-y-4">
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-h-[220px] overflow-y-auto pr-1">
                                        {results.features_used.map((feature: string) => (
                                            <div key={feature} className="space-y-1">
                                                <label className="text-[10px] text-zinc-400 font-mono truncate block" title={feature}>
                                                    {feature}
                                                </label>
                                                <input
                                                    type="number"
                                                    step="any"
                                                    value={predInputs[feature] ?? 0}
                                                    onChange={(e) => setPredInputs({
                                                        ...predInputs,
                                                        [feature]: parseFloat(e.target.value) || 0
                                                    })}
                                                    className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-200 outline-none focus:border-zinc-500"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                    <div className="flex flex-col sm:flex-row gap-4 items-center pt-2">
                                        <button
                                            type="submit"
                                            disabled={predLoading}
                                            className="w-full sm:w-auto rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 text-xs font-semibold transition disabled:opacity-50"
                                        >
                                            {predLoading ? "Predicting..." : "Predict →"}
                                        </button>
                                        {predError && (
                                            <span className="text-xs text-rose-450">
                                                ⚠️ {predError}
                                            </span>
                                        )}
                                    </div>
                                </form>

                                {predictionResult && (
                                    <div className="rounded-xl border border-emerald-800 bg-emerald-950/20 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fade-in">
                                        <div className="text-left">
                                            <span className="block text-[10px] text-emerald-450 font-bold uppercase tracking-wider">Model Prediction</span>
                                            <strong className="text-xl text-white font-mono">{predictionResult.prediction}</strong>
                                        </div>
                                        {predictionResult.confidence !== null && (
                                            <div className="text-right sm:text-left">
                                                <span className="block text-[10px] text-zinc-550">Confidence Score</span>
                                                <strong className="text-lg text-emerald-400 font-mono">{(predictionResult.confidence * 100).toFixed(1)}%</strong>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
            {/* Model Comparison Leaderboard */}
            {modelHistory.length > 0 && (
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 space-y-4 animate-fade-in">
                    <div className="flex justify-between items-center border-b border-zinc-850 pb-3">
                        <div>
                            <h4 className="text-sm font-bold text-zinc-200 uppercase tracking-wider">Model Comparison Leaderboard</h4>
                            <p className="text-[10px] text-zinc-500">Ranking of all completed models trained on this dataset, categorized by current task type ({taskType})</p>
                        </div>
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 uppercase">
                            {taskType}
                        </span>
                    </div>
                    {modelHistory.filter(m => m.task_type === taskType).length === 0 ? (
                        <p className="text-xs text-zinc-550 italic">No completed {taskType} models trained yet for this dataset.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs font-mono text-zinc-400">
                                <thead>
                                    <tr className="border-b border-zinc-850 text-zinc-500 text-[10px] font-bold uppercase tracking-wider">
                                        <th className="py-2.5 px-3">Rank</th>
                                        <th className="py-2.5 px-3">Trained At</th>
                                        <th className="py-2.5 px-3 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-850/50">
                                    {[...modelHistory]
                                        .filter(m => m.task_type === taskType)
                                        .sort((a, b) => {
                                            if (taskType === "classification") {
                                                const accA = a.metrics?.accuracy ?? 0;
                                                const accB = b.metrics?.accuracy ?? 0;
                                                return accB - accA;
                                            } else {
                                                const r2A = a.metrics?.r2 ?? - Infinity;
                                                const r2B = b.metrics?.r2 ?? - Infinity;
                                                return r2B - r2A;
                                            }
                                        })
                                        .map((modelRun, idx) => {
                                            const isCurrent = jobId === modelRun.job_id;
                                            const rankMedal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${idx + 1}`;
                                            let primaryMetric = "N/A";
                                            let secondaryMetric = "N/A";
                                            if (taskType === "classification") {
                                                primaryMetric = modelRun.metrics?.accuracy !== undefined
                                                    ? `${(modelRun.metrics.accuracy * 100).toFixed(2)}%`
                                                    : "N/A";
                                                secondaryMetric = modelRun.metrics?.f1 !== undefined
                                                    ? `F1: ${(modelRun.metrics.f1 * 100).toFixed(2)}%`
                                                    : "N/A";
                                            } else {
                                                primaryMetric = modelRun.metrics?.r2 !== undefined
                                                    ? modelRun.metrics.r2.toFixed(4)
                                                    : "N/A";
                                                secondaryMetric = modelRun.metrics?.rmse !== undefined
                                                    ? `RMSE: ${modelRun.metrics.rmse.toFixed(4)}`
                                                    : "N/A";
                                            }
                                            const formattedAlgo = ALGORITHM_INFO[modelRun.algorithm]?.title || modelRun.algorithm;

                                            return (
                                                <tr
                                                    key={modelRun.job_id}
                                                    className={`transition-colors hover:bg-zinc-850/20 ${isCurrent ? "bg-emerald-950/10" : ""}`}
                                                >
                                                    <td className="py-3 px-3 font-semibold text-zinc-350 text-sm">
                                                        {rankMedal}
                                                    </td>
                                                    <td className="py-3 px-3">
                                                        <span className="font-bold text-zinc-200">
                                                            {formattedAlgo}
                                                        </span>
                                                        <span className="block text-[9px] text-zinc-550 mt-0.5">ID: {modelRun.job_id.slice(0, 8)}...</span>
                                                    </td>
                                                    <td className="py-3 px-3 text-zinc-300">
                                                        {modelRun.target_column}
                                                    </td>
                                                    <td className="py-3 px-3 font-bold text-emerald-400">
                                                        {primaryMetric}
                                                    </td>
                                                    <td className="py-3 px-3 text-zinc-500">
                                                        {secondaryMetric}
                                                    </td>
                                                    <td className="py-3 px-3 text-[10px] text-zinc-500">
                                                        {new Date(modelRun.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({new Date(modelRun.created_at).toLocaleDateString()})
                                                    </td>
                                                    <td className="py-3 px-3 text-right">
                                                        {isCurrent ? (
                                                            <span className="inline-block px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
                                                                Active Run
                                                            </span>
                                                        ) : (
                                                            <button
                                                                onClick={() => handleLoadModel(modelRun)}
                                                                className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 hover:text-white transition text-[10px] font-bold text-zinc-300 border border-zinc-750"
                                                            >
                                                                Load Model
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            )
                                        })
                                    }
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

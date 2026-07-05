export type VisualizationMode = "dataset" | "boundary" | "tree" | "importance" | "clusters" | "pca";

export interface PointData {
    id: number;
    raw: Record<string, number | null>;
    coords: Record<string, number>;
    target: number | null;
}

export interface VisualizationData {
    points: PointData[];
    target_column: string | null;
    coefficients: Record<string, number> | null;
    intercept: number | null;
    feature_importance: { feature: string; importance: number }[];
    tree: TreeNode | null;
    scale_params: Record<string, { min: number; max: number; mean: number }>;
    task_type: string;
    cluster_centers?: number[][];
    pca_variance_ratio?: number[];
    pca_components?: number[][];
    pca_mean?: number[];
    cluster_centers_pca?: number[][];
    feature_names?: string[];
}

export type ScenePreset = "cinematic" | "bright" | "high_contrast" | "dark";

export interface VisualizationSettings {
    preset: ScenePreset;
    pointSizeMultiplier: number;
    showGrid: boolean;
    showLabels: boolean;
}

export interface TreeNode {
    is_leaf: boolean,
    value: number | number[];
    feature?: string;
    threshold?: number;
    left?: TreeNode;
    right?: TreeNode;
}

export interface UniverseConfig {
    canvas: HTMLCanvasElement;
    datasetId: string;
    columns: any[];
    xAxis: string;
    yAxis: string;
    zAxis: string;
    mode: VisualizationMode;
}
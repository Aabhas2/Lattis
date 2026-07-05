export type VisualizationMode = "dataset" | "boundary" | "tree" | "importance";

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
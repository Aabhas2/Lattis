import * as THREE from "three";
import { ColumnProfile } from "../../../lib/types";
import { UniverseConfig, VisualizationData, VisualizationMode } from "./types";
import { SceneManager } from "./SceneManager";
import { CameraManager } from "./CameraManager";
import { DatasetRenderer } from "./DatasetRenderer";
import { ModelSurfaceRenderer } from "./ModelSurfaceRenderer";
import { TreeRenderer } from "./TreeRenderer";
import { PredictionAnimator } from "./PredictionAnimator";
import { HoverManager } from "./HoverManager";
import { normalizeValue } from "./utils/normalize";
import { AxisLabeler } from "./AxisLabeler";

export class UniverseEngine {
    private canvas: HTMLCanvasElement;
    private columns: ColumnProfile[];

    // Core engine managers 
    public sceneManager!: SceneManager;
    public cameraManager!: CameraManager;
    public datasetRenderer!: DatasetRenderer;
    public modelSurfaceRenderer!: ModelSurfaceRenderer;
    public treeRenderer!: TreeRenderer;
    private predictionAnimator!: PredictionAnimator;
    public hoverManager!: HoverManager;

    private xAxis: string;
    private yAxis: string;
    private zAxis: string;

    // Animation frame handle 
    private animationFrameId: number | null = null;

    private axisLabeler: AxisLabeler | null = null;

    constructor(config: UniverseConfig) {
        this.canvas = config.canvas;
        this.columns = config.columns;
        this.xAxis = config.xAxis;
        this.yAxis = config.yAxis;
        this.zAxis = config.zAxis;
        this.init();
        window.addEventListener("resize", this.handleResize);
    }

    private init() {
        // Initialize Scene & Environment setup 
        this.sceneManager = new SceneManager(this.canvas);
        this.cameraManager = new CameraManager(this.canvas);

        this.datasetRenderer = new DatasetRenderer(this.sceneManager.scene);
        this.modelSurfaceRenderer = new ModelSurfaceRenderer(this.sceneManager.scene);
        this.treeRenderer = new TreeRenderer(this.sceneManager.scene);

        this.predictionAnimator = new PredictionAnimator(this.sceneManager.scene);
        this.hoverManager = new HoverManager(this.canvas, this.cameraManager.camera, this.sceneManager.scene);

        this.axisLabeler = new AxisLabeler(this.sceneManager.scene);
        this.axisLabeler.updateLabels(this.xAxis, this.yAxis, this.zAxis);

        // Start render tick loop. 
        this.animate();
    }

    private animate = () => {
        this.animationFrameId = requestAnimationFrame(this.animate);

        const time = performance.now() * 0.001; // seconds

        this.cameraManager.update();
        this.sceneManager.update(time);
        this.datasetRenderer.update(time);
        this.modelSurfaceRenderer.update();
        this.predictionAnimator.update();
        this.axisLabeler?.update(this.cameraManager.camera);

        this.hoverManager.update({
            pointsMesh: this.datasetRenderer.getPointsMesh(),
            pillarsGroup: this.modelSurfaceRenderer.getPillarsGroup(),
            treeGroup: this.treeRenderer.getTreeGroup()
        });

        // Sync hover highlight
        const hovered = this.hoverManager.getCurrentHoveredItem();
        if (hovered && hovered.type === "point") {
            this.datasetRenderer.setHoveredIndex(hovered.index);
        } else {
            this.datasetRenderer.setHoveredIndex(null);
        }

        // Call central webgl renderer to draw the scene 
        this.sceneManager.renderer.render(
            this.sceneManager.scene,
            this.cameraManager.camera
        );
    };

    // React state bridges: 
    public updateAxes(xAxis: string, yAxis: string, zAxis: string) {
        this.xAxis = xAxis;
        this.yAxis = yAxis;
        this.zAxis = zAxis;
        this.datasetRenderer.updateAxes(xAxis, yAxis, zAxis);
        this.axisLabeler?.updateLabels(xAxis, yAxis, zAxis);
    }

    public toggleLabels(show: boolean) {
        if (this.axisLabeler) {
            this.axisLabeler.setVisible(show);
        }
    }

    public loadData(data: VisualizationData) {
        this.datasetRenderer.setData(data.points, this.xAxis, this.yAxis, this.zAxis);
        this.modelSurfaceRenderer.updateData(data, this.xAxis, this.yAxis, this.zAxis);
        this.treeRenderer.updateData(data);
    }

    public setMode(mode: VisualizationMode) {
        this.modelSurfaceRenderer.setMode(mode);
        this.treeRenderer.setMode(mode);
    }

    private onPredictionLandedCallback: ((neighbors: any[]) => void) | null = null;

    public onPredictionLanded(cb: (neighbors: any[]) => void) {
        this.onPredictionLandedCallback = cb;
    }

    public triggerPrediction(inputs: Record<string, number>, result: any) {
        const normalizedCoords: Record<string, number> = {};
        Object.keys(inputs).forEach(colName => {
            normalizedCoords[colName] = normalizeValue(inputs[colName], colName, this.columns);
        });

        const targetX = normalizedCoords[this.xAxis] ?? 0;
        const targetY = normalizedCoords[this.yAxis] ?? -10;
        const targetZ = normalizedCoords[this.zAxis] ?? 0;

        this.predictionAnimator.onLanded(() => {
            if (this.onPredictionLandedCallback) {
                // Compute nearest neighbors based on normalized Euclidean distance
                const pts = this.datasetRenderer.getPointsMesh();
                if (pts) {
                    const positions = pts.geometry.attributes.position.array as Float32Array;
                    const distances = [];
                    for (let i = 0; i < positions.length / 3; i++) {
                        const dx = positions[i * 3] - targetX;
                        const dy = positions[i * 3 + 1] - targetY;
                        const dz = positions[i * 3 + 2] - targetZ;
                        const dist = dx * dx + dy * dy + dz * dz;
                        distances.push({ index: i, dist });
                    }
                    
                    distances.sort((a, b) => a.dist - b.dist);
                    const top3 = distances.slice(0, 3).map(d => d.index);
                    this.onPredictionLandedCallback(top3);
                } else {
                    this.onPredictionLandedCallback([]);
                }
            }
        });

        this.predictionAnimator.trigger(
            inputs,
            result,
            normalizedCoords,
            this.xAxis,
            this.yAxis,
            this.zAxis
        );
    }

    public flyToPoint(index: number) {
        const pts = this.datasetRenderer.getPointsMesh();
        if (!pts) return;
        const positions = pts.geometry.attributes.position.array as Float32Array;
        const x = positions[index * 3];
        const y = positions[index * 3 + 1];
        const z = positions[index * 3 + 2];
        const target = new THREE.Vector3(x, y, z);
        this.cameraManager.focusOnPoint(target, 8);
    }

    public tweenCameraTo(preset: "front" | "top" | "side" | "reset") {
        if (preset === "front") this.cameraManager.tweenToFront();
        else if (preset === "top") this.cameraManager.tweenToTop();
        else if (preset === "side") this.cameraManager.tweenToSide();
        else this.cameraManager.tweenToReset();
    }

    public onHover(callback: (payload: any | null) => void) {
        this.hoverManager.onHover(callback);
    }

    public onClick(callback: (payload: any | null) => void) {
        this.hoverManager.onClick(callback);
    }

    public destroy() {
        window.removeEventListener("resize", this.handleResize);
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
        }
        this.cameraManager.destroy();
        this.datasetRenderer.destroy();
        this.modelSurfaceRenderer.destroy();
        this.treeRenderer.destroy();
        this.predictionAnimator.destroy();
        this.hoverManager.destroy();
        this.sceneManager.destroy();
        this.axisLabeler?.dispose();
    }

    private handleResize = () => {
        const width = this.canvas.parentElement?.clientWidth || this.canvas.clientWidth;
        const height = this.canvas.parentElement?.clientHeight || this.canvas.clientHeight;
        this.sceneManager.resize(width, height);
        this.cameraManager.resize(width, height);
    };
}

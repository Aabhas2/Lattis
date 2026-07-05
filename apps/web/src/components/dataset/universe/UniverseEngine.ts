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

        this.cameraManager.update();
        this.datasetRenderer.update();
        this.modelSurfaceRenderer.update();
        this.predictionAnimator.update();

        this.hoverManager.update({
            pointsMesh: this.datasetRenderer.getPointsMesh(),
            pillarsGroup: this.modelSurfaceRenderer.getPillarsGroup(),
            treeGroup: this.treeRenderer.getTreeGroup()
        });

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

    public loadData(data: VisualizationData) {
        this.datasetRenderer.setData(data.points, this.xAxis, this.yAxis, this.zAxis);
        this.modelSurfaceRenderer.updateData(data, this.xAxis, this.yAxis, this.zAxis);
        this.treeRenderer.updateData(data);
    }

    public setMode(mode: VisualizationMode) {
        this.modelSurfaceRenderer.setMode(mode);
        this.treeRenderer.setMode(mode);
    }

    public triggerPrediction(inputs: Record<string, number>, result: any) {
        const normalizedCoords: Record<string, number> = {};
        Object.keys(inputs).forEach(colName => {
            normalizedCoords[colName] = normalizeValue(inputs[colName], colName, this.columns);
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

    public onHover(callback: (payload: any | null) => void) {
        this.hoverManager.onHover(callback);
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

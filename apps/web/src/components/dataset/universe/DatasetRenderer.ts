import * as THREE from "three";
import { PointData } from "./types";
import { COLORS } from "./ColorTheme";
import { lerp } from "./utils/lerp";

export class DatasetRenderer {
    private scene: THREE.Scene;
    private pointsMesh: THREE.Points | null = null;
    private rawPoints: PointData[] = [];

    // Double arrays: current pos states vs target offsets 
    private currentPositions: Float32Array | null = null;
    private targetPositions: Float32Array | null = null;

    private xAxis: string = "";
    private yAxis: string = "";
    private zAxis: string = "";

    constructor(scene: THREE.Scene) {
        this.scene = scene;
    }

    public setData(points: PointData[], xAxis: string, yAxis: string, zAxis: string) {
        this.rawPoints = points;
        this.xAxis = xAxis;
        this.yAxis = yAxis;
        this.zAxis = zAxis;

        this.removePoints();

        const count = points.length;
        this.currentPositions = new Float32Array(count * 3);
        this.targetPositions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);

        const targetValues = points
            .map(p => p.target)
            .filter((t): t is number => t !== null);

        const targetMin = targetValues.length ? Math.min(...targetValues) : 0;
        const targetMax = targetValues.length ? Math.max(...targetValues) : 1;
        const isLikelyBinary = targetMax <= 1 && targetMin >= 0 && 
            new Set(targetValues).size <= 10;

        points.forEach((pt, i) => {
            // Start all particles collapsed at coordinate origin grid-level 
            this.currentPositions![i * 3] = 0;
            this.currentPositions![i * 3 + 1] = -10;
            this.currentPositions![i * 3 + 2] = 0;

            // Target coordinates representing column features 
            this.targetPositions![i * 3] = pt.coords[xAxis] ?? 0;
            this.targetPositions![i * 3 + 1] = pt.coords[yAxis] ?? -10;
            this.targetPositions![i * 3 + 2] = pt.coords[zAxis] ?? 0;

            // Color-code target class output 
            let colorHex = COLORS.axes;
            if (pt.target !== null) {
                if (isLikelyBinary) {
                    // Discrete classes: cycle through a set of distinct colors
                    const classColors = [COLORS.negative, COLORS.positive, COLORS.highlight, COLORS.prediction];
                    const classIndex = Math.round(pt.target) % classColors.length;
                    colorHex = classColors[classIndex];
                } else {
                    // Regression: interpolate between negative (low) and positive (high)
                    const t = targetMax !== targetMin 
                        ? (pt.target - targetMin) / (targetMax - targetMin) 
                        : 0.5;
                    const low = new THREE.Color(COLORS.negative);
                    const high = new THREE.Color(COLORS.positive);
                    const interpolated = low.lerp(high, t);
                    colorHex = `#${interpolated.getHexString()}`;
                }
            }
            const color = new THREE.Color(colorHex);
            colors[i * 3] = color.r;
            colors[i * 3 + 1] = color.g;
            colors[i * 3 + 2] = color.b;
        });

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(this.currentPositions, 3));
        geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

        const texture = this.createParticleTexture();

        const material = new THREE.PointsMaterial({
            size: 0.35,
            vertexColors: true,
            transparent: true,
            opacity: 0.85,
            map: texture,
            depthWrite: false
        });

        this.pointsMesh = new THREE.Points(geometry, material);
        this.scene.add(this.pointsMesh);
    }

    public updateAxes(xAxis: string, yAxis: string, zAxis: string) {
        this.xAxis = xAxis;
        this.yAxis = yAxis;
        this.zAxis = zAxis;

        if (!this.targetPositions || this.rawPoints.length === 0) return;

        // Set target coordinate points for morphing 
        this.rawPoints.forEach((pt, i) => {
            this.targetPositions![i * 3] = pt.coords[xAxis] ?? 0;
            this.targetPositions![i * 3 + 1] = pt.coords[yAxis] ?? -10;
            this.targetPositions![i * 3 + 2] = pt.coords[zAxis] ?? 0;
        });
    }

    public update() {
        if (!this.pointsMesh || !this.currentPositions || !this.targetPositions) return;

        const positions = this.pointsMesh.geometry.attributes.position.array as Float32Array;

        let needsUpdate = false;

        for (let i = 0; i < positions.length; i++) {
            const diff = this.targetPositions[i] - positions[i];
            if (Math.abs(diff) > 0.001) {
                // Smooth interpolation (lerp) towards target coordiante 
                positions[i] = lerp(positions[i], this.targetPositions[i], 0.1);
                needsUpdate = true;
            }
        }

        if (needsUpdate) {
            this.pointsMesh.geometry.attributes.position.needsUpdate = true;
        }
    }
    private createParticleTexture(): THREE.CanvasTexture {
        const canvas = document.createElement("canvas");
        canvas.width = 16;
        canvas.height = 16;
        const ctx = canvas.getContext("2d")!;

        const grad = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
        grad.addColorStop(0, "rgba(255, 255, 255, 1)");
        grad.addColorStop(0.8, "rgba(255, 255, 255, 1)");
        grad.addColorStop(1, "rgba(255, 255, 255, 0)");

        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 16, 16);

        return new THREE.CanvasTexture(canvas);
    }

    private removePoints() {
        if (this.pointsMesh) {
            this.scene.remove(this.pointsMesh);
            this.pointsMesh.geometry.dispose();
            (this.pointsMesh.material as THREE.Material).dispose();
            this.pointsMesh = null;
        }
    }

    public destroy() {
        this.removePoints();
    }

    public getPointsMesh() { return this.pointsMesh; }
}
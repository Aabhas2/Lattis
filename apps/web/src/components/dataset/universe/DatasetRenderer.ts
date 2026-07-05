import * as THREE from "three";
import { PointData } from "./types";
import { COLORS } from "./ColorTheme";
import { lerp } from "./utils/lerp";

export class DatasetRenderer {
    private scene: THREE.Scene;
    private pointsMesh: THREE.Points | null = null;
    public rawPoints: PointData[] = [];

    // Double arrays: current pos states vs target offsets 
    private currentPositions: Float32Array | null = null;
    private targetPositions: Float32Array | null = null;

    private xAxis: string = "";
    private yAxis: string = "";
    private zAxis: string = "";

    // Interaction feedback
    private hoverSprite: THREE.Sprite;
    private selectedSprite: THREE.Sprite;
    private hoveredIndex: number | null = null;
    private selectedIndex: number | null = null;

    // Sizing
    private basePointSize: number = 0.25;
    private sizeMultiplier: number = 1.0;

    constructor(scene: THREE.Scene) {
        this.scene = scene;

        // Hover Sprite
        const hoverMat = new THREE.SpriteMaterial({
            map: this.createParticleTexture(),
            color: new THREE.Color(COLORS.highlight),
            transparent: true,
            opacity: 0,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        this.hoverSprite = new THREE.Sprite(hoverMat);
        this.hoverSprite.scale.set(1.5, 1.5, 1.5);
        this.hoverSprite.visible = false;
        this.scene.add(this.hoverSprite);

        // Selected Sprite (◉)
        const selectedMat = new THREE.SpriteMaterial({
            map: this.createSelectedTexture(),
            color: new THREE.Color(COLORS.highlight),
            transparent: true,
            opacity: 0,
            depthWrite: false
        });
        this.selectedSprite = new THREE.Sprite(selectedMat);
        this.selectedSprite.scale.set(2.5, 2.5, 1);
        this.selectedSprite.visible = false;
        this.scene.add(this.selectedSprite);
    }

    public setData(points: PointData[], xAxis: string, yAxis: string, zAxis: string) {
        this.rawPoints = points;
        this.xAxis = xAxis;
        this.yAxis = yAxis;
        this.zAxis = zAxis;

        this.removePoints();

        this.currentPositions = new Float32Array(points.length * 3);
        this.targetPositions = new Float32Array(points.length * 3);
        this.startPositions = new Float32Array(points.length * 3);

        // Auto-scale base size based on dataset size
        if (points.length < 50) this.basePointSize = 1.0; // Large spheres
        else if (points.length < 300) this.basePointSize = 0.45; // Medium
        else if (points.length < 1000) this.basePointSize = 0.25; // Standard
        else this.basePointSize = 0.12; // Fine dust

        const colors = new Float32Array(points.length * 3);

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
        texture.needsUpdate = true;

        const material = new THREE.PointsMaterial({
            size: this.basePointSize * this.sizeMultiplier,
            sizeAttenuation: true, 
            vertexColors: true,
            transparent: true,
            opacity: 1.0,
            map: texture,
            alphaTest: 0.01,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });

        this.pointsMesh = new THREE.Points(geometry, material);
        this.scene.add(this.pointsMesh);
    }

    public setPointSizeMultiplier(mult: number) {
        this.sizeMultiplier = mult;
        if (this.pointsMesh) {
            (this.pointsMesh.material as THREE.PointsMaterial).size = this.basePointSize * this.sizeMultiplier;
        }
    }

    private morphStartTime: number = 0;
    private morphDuration: number = 750; // ms
    private isMorphing: boolean = false;
    private startPositions: Float32Array | null = null;

    public updateAxes(xAxis: string, yAxis: string, zAxis: string) {
        this.xAxis = xAxis;
        this.yAxis = yAxis;
        this.zAxis = zAxis;

        if (!this.targetPositions || !this.currentPositions || this.rawPoints.length === 0) return;

        // Initialize startPositions if not created
        if (!this.startPositions || this.startPositions.length !== this.currentPositions.length) {
            this.startPositions = new Float32Array(this.currentPositions.length);
        }

        // Snapshot current positions before morphing 
        this.startPositions.set(this.currentPositions);

        // Set target coordinate points for morphing 
        this.rawPoints.forEach((pt, i) => {
            this.targetPositions![i * 3] = pt.coords[xAxis] ?? 0;
            this.targetPositions![i * 3 + 1] = pt.coords[yAxis] ?? -10;
            this.targetPositions![i * 3 + 2] = pt.coords[zAxis] ?? 0;
        });

        this.isMorphing = true;
        this.morphStartTime = performance.now();
    }

    // Cubic ease out function
    private easeOutCubic(x: number): number {
        return 1 - Math.pow(1 - x, 3);
    }

    public update(time: number) {
        if (!this.pointsMesh || !this.currentPositions || !this.targetPositions || !this.startPositions) return;

        const positions = this.pointsMesh.geometry.attributes.position.array as Float32Array;
        let needsUpdate = false;

        if (this.isMorphing) {
            const now = performance.now();
            let progress = (now - this.morphStartTime) / this.morphDuration;
            
            if (progress >= 1.0) {
                progress = 1.0;
                this.isMorphing = false;
            }

            const eased = this.easeOutCubic(progress);

            for (let i = 0; i < positions.length; i++) {
                const start = this.startPositions[i];
                const target = this.targetPositions[i];
                // Update base currentPositions
                this.currentPositions[i] = start + (target - start) * eased;
                // Sync positions directly
                positions[i] = this.currentPositions[i];
            }
            needsUpdate = true;
        }

        if (needsUpdate) {
            this.pointsMesh.geometry.attributes.position.needsUpdate = true;
        }

        if (this.hoveredIndex !== null) {
            this.hoverSprite.visible = true;
            const idx = this.hoveredIndex * 3;
            this.hoverSprite.position.set(positions[idx], positions[idx + 1], positions[idx + 2]);
            
            // Tiny scale animation for hover
            const scaleOffset = Math.sin(time * 10) * 0.2;
            this.hoverSprite.scale.set(1.5 + scaleOffset, 1.5 + scaleOffset, 1.5 + scaleOffset);
            this.hoverSprite.material.opacity = 0.8 + Math.sin(time * 8) * 0.2;
        } else {
            this.hoverSprite.visible = false;
        }

        if (this.selectedIndex !== null) {
            this.selectedSprite.visible = true;
            const idx = this.selectedIndex * 3;
            this.selectedSprite.position.set(positions[idx], positions[idx + 1], positions[idx + 2]);
            this.selectedSprite.material.opacity = 0.9;
        } else {
            this.selectedSprite.visible = false;
        }
    }
    
    public setHoveredIndex(index: number | null) {
        this.hoveredIndex = index;
    }

    public setSelectedIndex(index: number | null) {
        this.selectedIndex = index;
    }

    private createSelectedTexture(): THREE.CanvasTexture {
        const canvas = document.createElement("canvas");
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext("2d")!;
        
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(32, 32, 24, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(32, 32, 12, 0, Math.PI * 2);
        ctx.fill();

        return new THREE.CanvasTexture(canvas);
    }

    private createParticleTexture(): THREE.CanvasTexture {
        const canvas = document.createElement("canvas");
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext("2d")!;

        // Soft gaussian-like glow
        const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
        grad.addColorStop(0, "rgba(255, 255, 255, 1)");
        grad.addColorStop(0.2, "rgba(255, 255, 255, 0.8)");
        grad.addColorStop(0.5, "rgba(255, 255, 255, 0.2)");
        grad.addColorStop(1, "rgba(255, 255, 255, 0)");

        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 32, 32);

        return new THREE.CanvasTexture(canvas);
    }

    private removePoints() {
        if (this.pointsMesh) {
            this.scene.remove(this.pointsMesh);
            this.pointsMesh.geometry.dispose();
            if (this.pointsMesh.material) {
                const mat = this.pointsMesh.material as THREE.PointsMaterial;
                if (mat.map) mat.map.dispose();
                mat.dispose();
            }
            this.pointsMesh = null;
        }
    }

    public destroy() {
        this.removePoints();
    }

    public getPointsMesh() { return this.pointsMesh; }
}
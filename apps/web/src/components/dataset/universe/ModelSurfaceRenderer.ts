import * as THREE from "three";
import { COLORS } from "./ColorTheme";
import { VisualizationData } from "./types";
import { lerp } from "./utils/lerp";

export class ModelSurfaceRenderer {
    private scene: THREE.Scene;
    private surfaceMesh: THREE.Mesh | null = null;
    private pillarsGroup: THREE.Group | null = null;

    private mode: string = "dataset";

    constructor(scene: THREE.Scene) {
        this.scene = scene;
    }

    public updateData(data: VisualizationData, xAxis: string, yAxis: string, zAxis: string) {
        this.clearSurface();
        this.clearPillars();

        // Build Decision Hyperplane if linear coefficients are present 
        if (data.coefficients && Object.keys(data.coefficients).length > 0 && data.intercept !== null) {
            this.buildSurface(data.coefficients, data.intercept, xAxis, yAxis, zAxis, data.scale_params, data.task_type, data.target_column);
        }
        // Build circular Feature Importance columns if present 
        if (data.feature_importance && data.feature_importance.length > 0) {
            this.buildPillars(data.feature_importance);
        }
        this.applyVisibility();
    }

    private buildSurface(coefs: Record<string, number>, intercept: number, xAxis: string, yAxis: string, zAxis: string, scaleParams: Record<string, {min: number, max: number, mean: number}>, taskType: string, targetCol: string | null) {
        const size = 30;
        
        // Helper to get scaling constants for a column: X_orig = m * X_coord + b
        const getScaleConstants = (col: string) => {
            const p = scaleParams[col];
            if (!p || p.max === p.min) return { m: 0, b: p ? p.mean : 0 };
            const m = (p.max - p.min) / 20.0;
            const b = p.min + 10.0 * m;
            return { m, b };
        };

        // 1. Calculate base intercept for unseen features held at their mean
        let baseIntercept = intercept;
        for (const [feat, weight] of Object.entries(coefs)) {
            if (feat !== xAxis && feat !== yAxis && feat !== zAxis) {
                const p = scaleParams[feat];
                const mean = p ? p.mean : 0;
                baseIntercept += weight * mean;
            }
        }

        // 2. Set up unified equation: A * X_orig + B * Y_orig + C * Z_orig + D = 0
        let A = coefs[xAxis] || 0;
        let B = coefs[yAxis] || 0;
        let C = coefs[zAxis] || 0;
        let D = baseIntercept;

        if (taskType === "Regression") {
            if (xAxis === targetCol) A = -1;
            if (yAxis === targetCol) B = -1;
            if (zAxis === targetCol) C = -1;
        }

        // 3. Map to coordinate space: A_c * x_c + B_c * y_c + C_c * z_c + D_c = 0
        const sx = getScaleConstants(xAxis);
        const sy = getScaleConstants(yAxis);
        const sz = getScaleConstants(zAxis);

        const Ac = A * sx.m;
        const Bc = B * sy.m;
        const Cc = C * sz.m;
        const Dc = A * sx.b + B * sy.b + C * sz.b + D;

        // 4. Orient the PlaneGeometry to avoid vertical stretching (infinity slopes)
        let geometry = new THREE.PlaneGeometry(size, size, 15, 15);
        const pos = geometry.attributes.position;
        
        const absA = Math.abs(Ac);
        const absB = Math.abs(Bc);
        const absC = Math.abs(Cc);

        if (absB >= absA && absB >= absC && absB > 1e-6) {
            // Y is dependent (Horizontal Plane)
            geometry.rotateX(-Math.PI / 2);
            for (let i = 0; i < pos.count; i++) {
                const x = pos.getX(i);
                const z = pos.getZ(i);
                const y = (-Ac * x - Cc * z - Dc) / Bc;
                pos.setY(i, y);
            }
        } else if (absA >= absB && absA >= absC && absA > 1e-6) {
            // X is dependent (Vertical Y-Z Plane)
            geometry.rotateY(Math.PI / 2);
            for (let i = 0; i < pos.count; i++) {
                const y = pos.getY(i);
                const z = pos.getZ(i);
                const x = (-Bc * y - Cc * z - Dc) / Ac;
                pos.setX(i, x);
            }
        } else if (absC > 1e-6) {
            // Z is dependent (Vertical X-Y Plane)
            // No rotation needed for X-Y plane
            for (let i = 0; i < pos.count; i++) {
                const x = pos.getX(i);
                const y = pos.getY(i);
                const z = (-Ac * x - Bc * y - Dc) / Cc;
                pos.setZ(i, z);
            }
        }

        geometry.computeVertexNormals();

        const material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(COLORS.positive),
            emissive: new THREE.Color(COLORS.positive),
            emissiveIntensity: 0.4,
            transparent: true,
            opacity: 0.25,
            side: THREE.DoubleSide,
            wireframe: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });

        this.surfaceMesh = new THREE.Mesh(geometry, material);
        this.scene.add(this.surfaceMesh);
    }

    private buildPillars(importances: { feature: string; importance: number }[]) {
        this.pillarsGroup = new THREE.Group();
        const count = importances.length;
        const radius = 8;

        importances.forEach((imp, i) => {
            const theta = (i / count) * Math.PI * 2;
            const x = Math.cos(theta) * radius;
            const z = Math.sin(theta) * radius;

            // Normalize height 
            const targetHeight = imp.importance * 8;
            const geometry = new THREE.BoxGeometry(1.2, 0.1, 1.2);
            const material = new THREE.MeshStandardMaterial({
                color: new THREE.Color(COLORS.positive),
                roughness: 0.2,
                metalness: 0.8
            });

            const pillar = new THREE.Mesh(geometry, material);
            pillar.position.set(x, -10 + 0.05, z);
            pillar.castShadow = true;
            pillar.receiveShadow = true;

            // Cache data attributes for hover events and growing animations 
            pillar.userData = {
                type: "pillar",
                name: imp.feature,
                value: imp.importance,
                targetHeight
            };

            this.pillarsGroup!.add(pillar);
        });

        this.scene.add(this.pillarsGroup);
    }

    public setMode(mode: string) {
        this.mode = mode;
        this.applyVisibility();
    }

    private applyVisibility() {
        if (this.surfaceMesh) {
            this.surfaceMesh.visible = (this.mode === "boundary");
        }
        if (this.pillarsGroup) {
            this.pillarsGroup.visible = (this.mode === "importance");
        }
    }
    public update() {
        // Grow feature pillars vertically on transition entry 
        if (this.mode === "importance" && this.pillarsGroup) {
            this.pillarsGroup.children.forEach((mesh: any) => {
                const targetHeight = mesh.userData.targetHeight;
                const currentHeight = mesh.scale.y * 0.1;

                const nextHeight = lerp(currentHeight, targetHeight, 0.1);

                mesh.scale.y = nextHeight / 0.1;
                // Offset position height so base of the box remains pinned on grid floor 
                mesh.position.y = -10 + nextHeight / 2;
            });
        }
    }

    private clearSurface() {
        if (this.surfaceMesh) {
            this.scene.remove(this.surfaceMesh);
            this.surfaceMesh.geometry.dispose();
            (this.surfaceMesh.material as THREE.Material).dispose();
            this.surfaceMesh = null;
        }
    }

    private clearPillars() {
        if (this.pillarsGroup) {
            this.scene.remove(this.pillarsGroup);
            this.pillarsGroup.traverse((child: any) => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            });
            this.pillarsGroup = null;
        }
    }

    public destroy() {
        this.clearSurface();
        this.clearPillars();
    }

    public getPillarsGroup() { return this.pillarsGroup; }
}
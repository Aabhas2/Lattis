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
        if (data.coefficients && data.coefficients.length >= 2 && data.intercept !== null) {
            this.buildSurface(data.coefficients, data.intercept, xAxis, yAxis, zAxis);
        }
        // Build circular Feature Importance columns if present 
        if (data.feature_importance && data.feature_importance.length > 0) {
            this.buildPillars(data.feature_importance);
        }
        this.applyVisibility();
    }

    private buildSurface(coefs: number[], intercept: number, xAxis: string, yAxis: string, zAxis: string) {
        // Construct horizontal plane dimensions 
        const size = 30;
        const geometry = new THREE.PlaneGeometry(size, size, 15, 15);
        geometry.rotateX(-Math.PI / 2);

        const pos = geometry.attributes.position;

        // Default coefficients 
        let m1 = 0;
        let m2 = 0;
        let c = intercept;

        if (coefs.length >= 3) {
            const wX = coefs[0];
            const wY = coefs[1] !== 0 ? coefs[1] : 1;
            const wZ = coefs[2];

            m1 = -wX / wY;
            m2 = -wZ / wY;
            c = -intercept / wY;
        } else if (coefs.length === 2) {
            m1 = coefs[0];
            m2 = coefs[1];
            c = intercept;
        }

        // Clip slopes to keep plane heights bounded inside the visualizer bounding box 
        m1 = Math.max(-2, Math.min(2, m1));
        m2 = Math.max(-2, Math.min(2, m2));
        c = Math.max(-10, Math.min(10, c));

        // Adjust each version coordinate height Y based on plane slope formulas 
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i);
            const z = pos.getZ(i);
            const y = m1 * x + m2 * z + c;
            pos.setY(i, y);
        }

        geometry.computeVertexNormals();

        const material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(COLORS.positive),
            transparent: true,
            opacity: 0.3,
            side: THREE.DoubleSide,
            wireframe: true,
            depthWrite: false
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
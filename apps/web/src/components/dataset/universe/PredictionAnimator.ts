import * as THREE from "three";
import { COLORS } from "./ColorTheme";
import { createBezierCurve } from "./utils/bezier";

export class PredictionAnimator {
    private scene: THREE.Scene;
    private probeMesh: THREE.Mesh | null = null;
    private rippleRing: THREE.Mesh | null = null;

    private curve: THREE.CubicBezierCurve3 | null = null;
    private progress: number = 0;
    private isAnimating: boolean = false;

    private rippleProgress: number = 0;
    private isRippling: boolean = false;

    constructor(scene: THREE.Scene) {
        this.scene = scene;
    }

    public trigger(
        inputs: Record<string, number>,
        result: any,
        normalizedCoords: Record<string, number>,
        xAxis: string,
        yAxis: string,
        zAxis: string
    ) {
        this.clearProbe();
        this.clearRipple();

        // Starting coordinate position 
        const startPos = new THREE.Vector3(18, 12, -8);

        // Ending landing target 
        const targetX = normalizedCoords[xAxis] ?? 0;
        const targetY = normalizedCoords[yAxis] ?? -10;
        const targetZ = normalizedCoords[zAxis] ?? 0;
        const endPos = new THREE.Vector3(targetX, targetY, targetZ);

        // Create Bezier flight path curve 
        this.curve = createBezierCurve(startPos, endPos);

        // Amber glowing probe sphere mesh 
        const geometry = new THREE.SphereGeometry(0.35, 16, 16);
        const material = new THREE.MeshBasicMaterial({
            color: new THREE.Color(COLORS.prediction)
        });
        this.probeMesh = new THREE.Mesh(geometry, material);
        this.probeMesh.position.copy(startPos);
        this.scene.add(this.probeMesh);

        this.progress = 0;
        this.isAnimating = true;

        // Pre-create color-coded landing ring ripple  
        const ringColor = result.prediction === 1 ? COLORS.positive : COLORS.negative;
        this.rippleRing = this.createRippleRing(endPos, ringColor);
    }

    private createRippleRing(pos: THREE.Vector3, colorHex: string): THREE.Mesh {
        const geom = new THREE.RingGeometry(0.1, 0.2, 32);
        geom.rotateX(-Math.PI / 2);

        const mat = new THREE.MeshBasicMaterial({
            color: new THREE.Color(colorHex),
            transparent: true,
            opacity: 1,
            side: THREE.DoubleSide
        });

        const mesh = new THREE.Mesh(geom, mat);
        mesh.position.copy(pos);
        return mesh;
    }

    public update() {
        if (this.isAnimating && this.probeMesh && this.curve) {
            this.progress += 0.015;

            if (this.progress >= 1.0) {
                this.clearProbe();
                this.isAnimating = false;

                if (this.rippleRing) {
                    this.scene.add(this.rippleRing);
                    this.rippleProgress = 0;
                    this.isRippling = true;
                }
            } else {
                const point = this.curve.getPointAt(this.progress);
                this.probeMesh.position.copy(point);
            }
        }

        if (this.isRippling && this.rippleRing) {
            this.rippleProgress += 0.025;

            if (this.rippleProgress >= 1.0) {
                this.clearRipple();
                this.isRippling = false;
            } else {
                const scale = 1 + this.rippleProgress * 8;
                this.rippleRing.scale.set(scale, scale, scale);

                const mat = this.rippleRing.material as THREE.MeshBasicMaterial;
                mat.opacity = 1 - this.rippleProgress;
            }
        }
    }
    private clearProbe() {
        if (this.probeMesh) {
            this.scene.remove(this.probeMesh);
            this.probeMesh.geometry.dispose();
            (this.probeMesh.material as THREE.Material).dispose();
            this.probeMesh = null;
        }
    }

    private clearRipple() {
        if (this.rippleRing) {
            this.scene.remove(this.rippleRing);
            this.rippleRing.geometry.dispose();
            (this.rippleRing.material as THREE.Material).dispose();
            this.rippleRing = null;
        }
    }

    public destroy() {
        this.clearProbe();
        this.clearRipple();
    }
}
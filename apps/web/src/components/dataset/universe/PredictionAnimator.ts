import * as THREE from "three";
import { COLORS } from "./ColorTheme";
import { createBezierCurve } from "./utils/bezier";

export class PredictionAnimator {
    private scene: THREE.Scene;
    private probeMesh: THREE.Object3D | null = null;
    private rippleRing: THREE.Mesh | null = null;

    private curve: THREE.CubicBezierCurve3 | null = null;
    private progress: number = 0;
    private isAnimating: boolean = false;

    private rippleProgress: number = 0;
    private isRippling: boolean = false;

    private onLandedCallback: (() => void) | null = null;
    private landedPoint: THREE.Vector3 | null = null;

    constructor(scene: THREE.Scene) {
        this.scene = scene;
    }

    public onLanded(cb: () => void) {
        this.onLandedCallback = cb;
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
        this.landedPoint = endPos.clone();

        // Create Bezier flight path curve 
        this.curve = createBezierCurve(startPos, endPos);

        // Cyan glowing probe
        const coreGeo = new THREE.SphereGeometry(0.15, 16, 16);
        const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const coreMesh = new THREE.Mesh(coreGeo, coreMat);

        const glowGeo = new THREE.SphereGeometry(0.4, 16, 16);
        const glowMat = new THREE.MeshBasicMaterial({
            color: new THREE.Color("#22d3ee"), // Cyan
            transparent: true,
            opacity: 0.6,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        const glowMesh = new THREE.Mesh(glowGeo, glowMat);

        this.probeMesh = new THREE.Group();
        this.probeMesh.add(coreMesh);
        this.probeMesh.add(glowMesh);
        this.probeMesh.position.copy(startPos);
        this.scene.add(this.probeMesh);

        this.progress = 0;
        this.isAnimating = true;
        this.isRippling = false;

        // Pre-create color-coded landing ring ripple  
        const ringColor = result.prediction === 1 ? COLORS.positive : COLORS.negative;
        this.rippleRing = this.createRippleRing(endPos, ringColor);
    }

    private createRippleRing(pos: THREE.Vector3, colorHex: string): THREE.Mesh {
        const geom = new THREE.RingGeometry(0.2, 0.4, 32);
        geom.rotateX(-Math.PI / 2);

        const mat = new THREE.MeshBasicMaterial({
            color: new THREE.Color(colorHex),
            transparent: true,
            opacity: 1,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending
        });

        const mesh = new THREE.Mesh(geom, mat);
        mesh.position.copy(pos);
        return mesh;
    }

    public update() {
        if (this.isAnimating && this.probeMesh && this.curve) {
            this.progress += 0.012; // slightly slower flight

            if (this.progress >= 1.0) {
                this.isAnimating = false;
                this.probeMesh.position.copy(this.landedPoint!);

                if (this.rippleRing) {
                    this.scene.add(this.rippleRing);
                    this.rippleProgress = 0;
                    this.isRippling = true;
                }

                if (this.onLandedCallback) {
                    this.onLandedCallback();
                }
            } else {
                // Smoothstep ease-in-out
                const easeInOut = this.progress * this.progress * (3 - 2 * this.progress);
                const point = this.curve.getPointAt(easeInOut);
                this.probeMesh.position.copy(point);
                
                // Add a trailing scale pulse effect during flight
                const pulse = 1 + Math.sin(this.progress * Math.PI * 10) * 0.1;
                this.probeMesh.scale.set(pulse, pulse, pulse);
            }
        }

        if (this.isRippling && this.rippleRing) {
            this.rippleProgress += 0.015;

            if (this.rippleProgress >= 1.0) {
                this.rippleProgress = 0;
            }
            
            const scale = 1 + (this.rippleProgress * 8); // larger ripple
            this.rippleRing.scale.set(scale, scale, scale);

            const mat = this.rippleRing.material as THREE.MeshBasicMaterial;
            // Smoother fade out
            mat.opacity = 1.0 - Math.pow(this.rippleProgress, 1.2);
        }
    }
    private clearProbe() {
        if (this.probeMesh) {
            this.scene.remove(this.probeMesh);
            if (this.probeMesh instanceof THREE.Group) {
                this.probeMesh.children.forEach(child => {
                    if (child instanceof THREE.Mesh) {
                        child.geometry.dispose();
                        if (child.material instanceof THREE.Material) child.material.dispose();
                    }
                });
            } else if (this.probeMesh instanceof THREE.Mesh) {
                this.probeMesh.geometry.dispose();
                (this.probeMesh.material as THREE.Material).dispose();
            }
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
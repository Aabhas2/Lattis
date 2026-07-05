import * as THREE from "three";
import { COLORS } from "./ColorTheme";
import { VisualizationData } from "./types";

export class ClusterRenderer {
    private scene: THREE.Scene;
    private clusterGroup: THREE.Group | null = null;
    private activeMode: string = "dataset";

    constructor(scene: THREE.Scene) {
        this.scene = scene;
    }

    public updateData(data: VisualizationData, xAxis: string, yAxis: string, zAxis: string) {
        this.clearClusters();

        if (!data.cluster_centers || !data.feature_names || !data.scale_params) return;

        this.clusterGroup = new THREE.Group();
        this.clusterGroup.userData.isAnimating = true; 
        
        // Setup simple tick function for animation
        this.clusterGroup.userData.tick = (time: number) => {
            if (!this.clusterGroup) return;
            // Subtle breathing effect on the centroids
            const scale = 1.0 + Math.sin(time * 2.0) * 0.15;
            this.clusterGroup.children.forEach(child => {
                // Only scale the Octahedrons, not the sprites/lights
                if (child instanceof THREE.Mesh) {
                    child.scale.set(scale, scale, scale);
                    child.rotation.y = time * 0.5; // slow spin
                    child.rotation.z = time * 0.3;
                }
            });
        };

        const isPCA = xAxis === "pca_x";
        const centers = isPCA && data.cluster_centers_pca ? data.cluster_centers_pca : data.cluster_centers;

        if (!centers) return;

        const xIdx = isPCA ? 0 : data.feature_names.indexOf(xAxis);
        const yIdx = isPCA ? 1 : data.feature_names.indexOf(yAxis);
        const zIdx = isPCA ? 2 : data.feature_names.indexOf(zAxis);

        if (xIdx === -1 || yIdx === -1 || zIdx === -1) return;
        
        // Helper to map raw centroid value to [-10, 10]
        const scaleVal = (val: number, axisName: string) => {
            if (isPCA) return val; // PCA is already scaled on backend
            const p = data.scale_params[axisName];
            if (!p || p.max === p.min) return 0.0;
            return -10.0 + 20.0 * (val - p.min) / (p.max - p.min);
        };

        // Create a soft radial gradient texture for the cloud
        const canvas = document.createElement("canvas");
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext("2d")!;
        const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
        grad.addColorStop(0, "rgba(255, 255, 255, 0.4)");
        grad.addColorStop(0.3, "rgba(255, 255, 255, 0.15)");
        grad.addColorStop(0.6, "rgba(255, 255, 255, 0.05)");
        grad.addColorStop(1, "rgba(255, 255, 255, 0)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 128, 128);
        const cloudTexture = new THREE.CanvasTexture(canvas);

        const clusterColors = [COLORS.positive, COLORS.negative, COLORS.highlight, COLORS.prediction, COLORS.axes];

        centers.forEach((center, idx) => {
            const x = scaleVal(center[xIdx], xAxis);
            const y = scaleVal(center[yIdx], yAxis);
            const z = scaleVal(center[zIdx], zAxis);

            const colorHex = clusterColors[idx % clusterColors.length];
            const color = new THREE.Color(colorHex);

            // Centroid Core (small)
            const geo = new THREE.OctahedronGeometry(0.5, 0);
            const mat = new THREE.MeshStandardMaterial({
                color: color,
                emissive: color,
                emissiveIntensity: 0.8,
                metalness: 0.8,
                roughness: 0.2
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(x, y, z);

            // Cloud Aura (Billboard Sprite)
            const cloudMat = new THREE.SpriteMaterial({
                map: cloudTexture,
                color: color,
                transparent: true,
                opacity: 0.6,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            });
            const cloud = new THREE.Sprite(cloudMat);
            cloud.scale.set(12, 12, 1);
            cloud.position.set(x, y, z);
            cloud.userData.isCloud = true;

            // Light
            const light = new THREE.PointLight(color, 2, 15);
            light.position.set(x, y, z);
            // Label
            const labelCanvas = document.createElement('canvas');
            labelCanvas.width = 256;
            labelCanvas.height = 128;
            const labelCtx = labelCanvas.getContext('2d');
            if (labelCtx) {
                labelCtx.fillStyle = 'rgba(0,0,0,0)';
                labelCtx.fillRect(0, 0, 256, 128);
                labelCtx.font = 'bold 24px monospace';
                labelCtx.textAlign = 'center';
                labelCtx.fillStyle = '#ffffff';
                labelCtx.fillText(`CLUSTER ${idx + 1}`, 128, 64);
                labelCtx.strokeStyle = '#ffffff';
                labelCtx.lineWidth = 2;
                labelCtx.beginPath();
                labelCtx.moveTo(128, 70);
                labelCtx.lineTo(128, 110);
                labelCtx.stroke();
            }
            const labelTexture = new THREE.CanvasTexture(labelCanvas);
            const spriteMat = new THREE.SpriteMaterial({ map: labelTexture, transparent: true, depthTest: false });
            const sprite = new THREE.Sprite(spriteMat);
            sprite.scale.set(4, 2, 1);
            sprite.position.set(x, y + 2.5, z); // Hover above

            this.clusterGroup!.add(mesh);
            this.clusterGroup!.add(cloud);
            this.clusterGroup!.add(light);
            this.clusterGroup!.add(sprite);
        });

        this.scene.add(this.clusterGroup);
        this.applyVisibility();
    }

    public setMode(mode: string) {
        this.activeMode = mode;
        this.applyVisibility();
    }

    public update(time: number) {
        if (this.clusterGroup && this.clusterGroup.userData.isAnimating && this.clusterGroup.userData.tick) {
            this.clusterGroup.userData.tick(time);
        }
    }

    private applyVisibility() {
        if (this.clusterGroup) {
            this.clusterGroup.visible = (this.activeMode === "clusters");
        }
    }

    private clearClusters() {
        if (this.clusterGroup) {
            this.scene.remove(this.clusterGroup);
            this.clusterGroup.traverse((child: any) => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (child.material.map) child.material.map.dispose();
                    child.material.dispose();
                }
            });
            this.clusterGroup = null;
        }
    }

    public destroy() {
        this.clearClusters();
    }
}

import * as THREE from "three";

export class HoverManager {
    private canvas: HTMLCanvasElement;
    private camera: THREE.Camera;
    private scene: THREE.Scene;

    private raycaster: THREE.Raycaster;
    private mouse: THREE.Vector2;
    private onHoverCallback: ((payload: any | null) => void) | null = null;

    constructor(canvas: HTMLCanvasElement, camera: THREE.Camera, scene: THREE.Scene) {
        this.canvas = canvas;
        this.camera = camera;
        this.scene = scene;

        this.raycaster = new THREE.Raycaster();
        this.raycaster.params.Points!.threshold = 0.45; // touch target overlap padding for points
        this.mouse = new THREE.Vector2();

        window.addEventListener("mousemove", this.handleMouseMove);
    }

    public onHover(callback: (payload: any | null) => void) {
        this.onHoverCallback = callback;
    }

    private handleMouseMove = (event: MouseEvent) => {
        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    };

    public update(activeRenderers: { pointsMesh: THREE.Points | null; pillarsGroup: THREE.Group | null; treeGroup: THREE.Group | null }) {
        this.raycaster.setFromCamera(this.mouse, this.camera);

        const targets: THREE.Object3D[] = [];
        if (activeRenderers.pointsMesh && activeRenderers.pointsMesh.visible) {
            targets.push(activeRenderers.pointsMesh);
        }
        if (activeRenderers.pillarsGroup && activeRenderers.pillarsGroup.visible) {
            targets.push(activeRenderers.pillarsGroup);
        }
        if (activeRenderers.treeGroup && activeRenderers.treeGroup.visible) {
            targets.push(activeRenderers.treeGroup);
        }

        if (targets.length === 0) return;

        const intersects = this.raycaster.intersectObjects(targets, true);

        if (intersects.length > 0 && this.onHoverCallback) {
            const hit = intersects[0];
            const obj = hit.object;

            // Hover Point inside point cloud
            if (obj instanceof THREE.Points) {
                const index = hit.index;
                if (index !== undefined) {
                    this.onHoverCallback({
                        type: "point",
                        index,
                        distance: hit.distance
                    });
                    return;
                }
            }

            // Hover Tree Node or Feature Pillar
            if (obj.userData && obj.userData.type) {
                this.onHoverCallback({
                    ...obj.userData,
                    distance: hit.distance
                });
                return;
            }
        }

        if (this.onHoverCallback) {
            this.onHoverCallback(null);
        }
    }

    public destroy() {
        window.removeEventListener("mousemove", this.handleMouseMove);
    }
}

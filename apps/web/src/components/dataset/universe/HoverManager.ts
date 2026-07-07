import * as THREE from "three";

export class HoverManager {
    private canvas: HTMLCanvasElement;
    private camera: THREE.Camera;
    private scene: THREE.Scene;

    private raycaster: THREE.Raycaster;
    private mouse: THREE.Vector2;
    private onHoverCallback: ((payload: any | null) => void) | null = null;
    private onClickCallback: ((payload: any | null) => void) | null = null;
    private currentHoveredItem: any | null = null;

    constructor(canvas: HTMLCanvasElement, camera: THREE.Camera, scene: THREE.Scene) {
        this.canvas = canvas;
        this.camera = camera;
        this.scene = scene;

        this.raycaster = new THREE.Raycaster();
        this.raycaster.params.Points!.threshold = 0.75; // Increased to make hovering much easier
        this.mouse = new THREE.Vector2();

        window.addEventListener("mousemove", this.handleMouseMove);
        window.addEventListener("click", this.handleClick);
    }

    public onHover(callback: (payload: any | null) => void) {
        this.onHoverCallback = callback;
    }

    public onClick(callback: (payload: any | null) => void) {
        this.onClickCallback = callback;
    }

    private handleMouseMove = (event: MouseEvent) => {
        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    };

    private handleClick = (event: MouseEvent) => {
        // Only trigger if clicking inside canvas area
        const rect = this.canvas.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || 
            event.clientY < rect.top || event.clientY > rect.bottom) {
            return;
        }

        if (this.onClickCallback) {
            this.onClickCallback(this.currentHoveredItem);
        }
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

        if (intersects.length > 0) {
            const hit = intersects[0];
            const obj = hit.object;

            // Hover Point inside point cloud
            if (obj instanceof THREE.Points) {
                const index = hit.index;
                if (index !== undefined) {
                    const payload = {
                        type: "point",
                        index,
                        distance: hit.distance
                    };
                    this.setHoverState(payload);
                    return;
                }
            }

            // Hover Tree Node or Feature Pillar
            if (obj.userData && obj.userData.type) {
                const payload = {
                    ...obj.userData,
                    distance: hit.distance
                };
                this.setHoverState(payload);
                return;
            }
        }

        this.setHoverState(null);
    }

    private setHoverState(payload: any | null) {
        if (this.currentHoveredItem?.index !== payload?.index || this.currentHoveredItem?.type !== payload?.type) {
            this.currentHoveredItem = payload;
            if (this.onHoverCallback) {
                this.onHoverCallback(payload);
            }
            
            // Cursor feedback
            if (payload) {
                this.canvas.style.cursor = "pointer";
            } else {
                this.canvas.style.cursor = "default";
            }
        }
    }

    public getCurrentHoveredItem() {
        return this.currentHoveredItem;
    }

    public destroy() {
        window.removeEventListener("mousemove", this.handleMouseMove);
        window.removeEventListener("click", this.handleClick);
        this.canvas.style.cursor = "default";
    }
}

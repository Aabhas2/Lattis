import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/Addons.js";

export class CameraManager {
    public camera: THREE.PerspectiveCamera;
    public controls: OrbitControls;
    private canvas: HTMLCanvasElement;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;

        // Set up Perspective Camera 
        this.camera = new THREE.PerspectiveCamera(
            75,
            canvas.clientWidth / canvas.clientHeight,
            0.1,
            1000
        );
        this.camera.position.set(15, 15, 20);

        // Set up mouse orbit navigation controls 
        this.controls = new OrbitControls(this.camera, canvas);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.maxPolarAngle = Math.PI / 2 + 0.1;
        this.controls.minDistance = 5;
        this.controls.maxDistance = 100;
    }

    public update() {
        this.controls.update();
    }

    public resize(width: number, height: number) {
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
    }

    public destroy() {
        this.controls.dispose();
    }
}
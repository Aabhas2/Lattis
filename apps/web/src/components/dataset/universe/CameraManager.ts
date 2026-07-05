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
        this.controls.dampingFactor = 0.1;
        this.controls.maxPolarAngle = Math.PI / 2 + 0.1;
        this.controls.minDistance = 5;
        this.controls.maxDistance = 100;
    }

    private isTweening = false;
    private tweenStart = 0;
    private tweenDuration = 1000;
    private startTarget = new THREE.Vector3();
    private endTarget = new THREE.Vector3();
    private startPos = new THREE.Vector3();
    private endPos = new THREE.Vector3();

    public update() {
        if (this.isTweening) {
            const now = performance.now();
            let progress = (now - this.tweenStart) / this.tweenDuration;
            
            if (progress >= 1.0) {
                progress = 1.0;
                this.isTweening = false;
            }

            // Cubic ease out
            const eased = 1 - Math.pow(1 - progress, 3);

            this.controls.target.lerpVectors(this.startTarget, this.endTarget, eased);
            this.camera.position.lerpVectors(this.startPos, this.endPos, eased);
        }

        this.controls.update();
    }

    public tweenTo(target: THREE.Vector3, offset: THREE.Vector3 = new THREE.Vector3(5, 5, 5)) {
        this.startTarget.copy(this.controls.target);
        this.endTarget.copy(target);

        this.startPos.copy(this.camera.position);
        this.endPos.copy(target).add(offset);

        this.isTweening = true;
        this.tweenStart = performance.now();
    }

    public focusOnPoint(target: THREE.Vector3, distance: number = 8) {
        // Calculate the current direction from target to camera
        const dir = new THREE.Vector3().subVectors(this.camera.position, this.controls.target);
        
        // If they are exactly the same (rare), give a default direction
        if (dir.lengthSq() < 0.0001) {
            dir.set(0, 0, 1);
        } else {
            dir.normalize();
        }

        // Keep the exact same viewing angle, but move closer to the target
        const offset = dir.multiplyScalar(distance);
        
        this.tweenTo(target, offset);
    }

    public tweenToFront() {
        this.tweenTo(new THREE.Vector3(0, -10, 0), new THREE.Vector3(0, 0, 30));
    }

    public tweenToTop() {
        this.tweenTo(new THREE.Vector3(0, -10, 0), new THREE.Vector3(0, 30, 0));
    }

    public tweenToSide() {
        this.tweenTo(new THREE.Vector3(0, -10, 0), new THREE.Vector3(30, 0, 0));
    }

    public tweenToReset() {
        this.tweenTo(new THREE.Vector3(0, -10, 0), new THREE.Vector3(15, 5, 20));
    }

    public resize(width: number, height: number) {
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
    }

    public destroy() {
        this.controls.dispose();
    }
}
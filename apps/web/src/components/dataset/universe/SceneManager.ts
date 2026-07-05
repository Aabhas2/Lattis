import * as THREE from "three";
import { COLORS } from "./ColorTheme";

export class SceneManager {
    public scene: THREE.Scene;
    public renderer: THREE.WebGLRenderer;

    // Ambient and directional lighgting sources 
    private ambientLight!: THREE.AmbientLight;
    private dirLight!: THREE.DirectionalLight;
    private gridHelper!: THREE.GridHelper;
    private axesHelper!: THREE.AxesHelper;

    constructor(canvas: HTMLCanvasElement) {
        // Initialize empty scene with dark space background and fog 
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(COLORS.background);
        this.scene.fog = new THREE.FogExp2(COLORS.background, 0.015);

        // Configure WebGL Renderer 
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });

        const width = canvas.parentElement?.clientWidth || window.innerWidth;
        const height = canvas.parentElement?.clientHeight || 550;
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;

        this.initEnvironment();
    }
    private initEnvironment() {
        // Base uniform light 
        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(this.ambientLight);

        // Directional Light 
        this.dirLight = new THREE.DirectionalLight(COLORS.positive, 1.2);
        this.dirLight.position.set(5, 15, 5);
        this.dirLight.castShadow = true;
        this.scene.add(this.dirLight);

        // Grid Floor 
        this.gridHelper = new THREE.GridHelper(30, 30, COLORS.positive, COLORS.neutral);
        this.gridHelper.position.y = -10;
        this.scene.add(this.gridHelper);

        // Coordinate axes lines in the bottom-left corner of the grid 
        this.axesHelper = new THREE.AxesHelper(15);
        this.axesHelper.position.set(-15, -10, -15);
        this.scene.add(this.axesHelper);
    }

    public resize(width: number, height: number) {
        this.renderer.setSize(width, height);
    }

    public destroy() {
        // Remove meshes and clean up WebGL buffers 
        this.scene.remove(this.ambientLight);
        this.scene.remove(this.dirLight);
        this.scene.remove(this.gridHelper);
        this.scene.remove(this.axesHelper);

        this.renderer.dispose();
        this.scene.clear();
    }
}

import * as THREE from "three";
import { COLORS } from "./ColorTheme";

export class SceneManager {
    public scene: THREE.Scene;
    public renderer: THREE.WebGLRenderer;

    // Ambient and directional lighting sources 
    private ambientLight!: THREE.AmbientLight;
    private hemiLight!: THREE.HemisphereLight;
    private mainLight!: THREE.DirectionalLight;
    private rimLight!: THREE.DirectionalLight;
    private gridHelper!: THREE.GridHelper;
    private axesHelper!: THREE.AxesHelper;

    constructor(canvas: HTMLCanvasElement) {
        // Initialize empty scene with transparent background for CSS gradients
        this.scene = new THREE.Scene();
        
        // Subtle exponential fog matching the dark charcoal/blue gradient
        this.scene.fog = new THREE.FogExp2(0x0f172a, 0.015);

        // Configure WebGL Renderer 
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
        this.renderer.setClearColor(0x000000, 0); // Fully transparent so CSS background shows

        const width = canvas.parentElement?.clientWidth || window.innerWidth;
        const height = canvas.parentElement?.clientHeight || 550;
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;

        this.initEnvironment();
    }
    
    private initEnvironment() {
        // Base very low-intensity ambient light 
        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.05);
        this.scene.add(this.ambientLight);

        // Soft hemisphere light (sky color -> ground color)
        this.hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
        this.hemiLight.position.set(0, 20, 0);
        this.scene.add(this.hemiLight);

        // Main directional light (Key light) - Top Right
        this.mainLight = new THREE.DirectionalLight(0xffffff, 1.5);
        this.mainLight.position.set(10, 20, 10);
        this.mainLight.castShadow = true;
        this.scene.add(this.mainLight);

        // Rim light from behind/side to highlight edges
        this.rimLight = new THREE.DirectionalLight(COLORS.positive, 0.4);
        this.rimLight.position.set(-15, 5, -15);
        this.scene.add(this.rimLight);

        // Weak central rim glow behind dataset
        const centerGlow = new THREE.PointLight(0x38bdf8, 2.0, 50);
        centerGlow.position.set(0, -5, -5);
        this.scene.add(centerGlow);

        // Grid Floor 
        this.gridHelper = new THREE.GridHelper(30, 30, COLORS.positive, COLORS.neutral);
        this.gridHelper.position.y = -10;
        
        // Push grid into background but keep it visible for depth perception
        const gridMat = this.gridHelper.material as THREE.Material;
        gridMat.transparent = true;
        gridMat.opacity = 0.08;
        this.scene.add(this.gridHelper);

        // Coordinate axes lines in the bottom-left corner of the grid 
        this.axesHelper = new THREE.AxesHelper(15);
        this.axesHelper.position.set(-15, -10, -15);
        (this.axesHelper.material as THREE.Material).transparent = true;
        (this.axesHelper.material as THREE.Material).opacity = 0.5;
        this.scene.add(this.axesHelper);

        // Add Floating Space Dust
        this.initSpaceDust();
    }

    private dustPoints: THREE.Points | null = null;
    
    private initSpaceDust() {
        const dustGeo = new THREE.BufferGeometry();
        const dustCount = 300;
        const positions = new Float32Array(dustCount * 3);
        
        for (let i = 0; i < dustCount; i++) {
            positions[i * 3] = (Math.random() - 0.5) * 80;
            positions[i * 3 + 1] = (Math.random() - 0.5) * 80;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 80;
        }
        dustGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        
        const dustMat = new THREE.PointsMaterial({
            color: 0x94a3b8,
            size: 0.15,
            transparent: true,
            opacity: 0.3,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });
        
        this.dustPoints = new THREE.Points(dustGeo, dustMat);
        this.scene.add(this.dustPoints);
    }

    public update(time: number) {
        if (this.dustPoints) {
            this.dustPoints.rotation.y = time * 0.02;
            this.dustPoints.rotation.x = time * 0.01;
        }
    }

    public resize(width: number, height: number) {
        this.renderer.setSize(width, height);
    }

    public destroy() {
        // Remove meshes and clean up WebGL buffers 
        this.scene.remove(this.ambientLight);
        this.scene.remove(this.hemiLight);
        this.scene.remove(this.mainLight);
        this.scene.remove(this.rimLight);
        this.scene.remove(this.gridHelper);
        this.scene.remove(this.axesHelper);

        this.renderer.dispose();
        this.scene.clear();
    }
}

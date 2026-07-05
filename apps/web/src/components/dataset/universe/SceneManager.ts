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
        
        // Scale the entire coordinate space up for visual presence
        this.scene.scale.set(1.3, 1.3, 1.3);

        // Subtle exponential fog matching the dark charcoal/blue gradient
        this.scene.fog = new THREE.FogExp2(0x0f172a, 0.015 / 1.3); // Adjust fog density for scale

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
        // Soften fog
        this.scene.fog = new THREE.FogExp2(COLORS.background, 0.015);

        // Ambient Light (subtle base, increased to brighten scatter points)
        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
        this.scene.add(this.ambientLight);

        // Hemisphere Light (sky to ground ambient depth)
        this.hemiLight = new THREE.HemisphereLight(0xffffff, 0x555555, 1.0);
        this.hemiLight.position.set(0, 20, 0);
        this.scene.add(this.hemiLight);

        // Main Directional Light
        this.mainLight = new THREE.DirectionalLight(0xffffff, 2.2);
        this.mainLight.position.set(20, 40, 20);
        this.scene.add(this.mainLight);

        // Rim Light (sharp highlight from behind/side)
        this.rimLight = new THREE.DirectionalLight(COLORS.positive, 0.8);
        this.rimLight.position.set(-30, 20, -30);
        this.scene.add(this.rimLight);

        // Weak central rim glow behind dataset (toned down the blue to a neutral grey/slate)
        const centerGlow = new THREE.PointLight(0x738290, 2.0, 60);
        centerGlow.position.set(0, 0, -20);
        this.scene.add(centerGlow);

        // ----------------------------------------------------
        // ADD IMMERSIVE SPACE DUST (PARTICLE SYSTEM)
        // ----------------------------------------------------
        const dustCount = 800;
        const dustGeometry = new THREE.BufferGeometry();
        const dustPositions = new Float32Array(dustCount * 3);
        
        for (let i = 0; i < dustCount; i++) {
            // Scatter widely across the scene, avoiding the exact center so it acts as background depth
            const x = (Math.random() - 0.5) * 150;
            const y = (Math.random() - 0.5) * 150;
            const z = (Math.random() - 0.5) * 150;
            dustPositions[i*3] = x;
            dustPositions[i*3+1] = y;
            dustPositions[i*3+2] = z;
        }
        dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
        const dustMaterial = new THREE.PointsMaterial({
            color: 0x88ccff,
            size: 0.15,
            transparent: true,
            opacity: 0.4,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        
        const spaceDust = new THREE.Points(dustGeometry, dustMaterial);
        // Store on scene for rotation in update loop
        this.scene.userData.spaceDust = spaceDust;
        this.scene.add(spaceDust);

        // Aesthetic Grid Helper for ground anchoring 
        this.gridHelper = new THREE.GridHelper(40, 40, 0x3f3f46, 0x27272a);
        this.gridHelper.position.y = -12;
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
        // Orbit the lights slowly around the dataset for dynamic shading 
        this.mainLight.position.x = Math.cos(time * 0.1) * 20;
        this.mainLight.position.z = Math.sin(time * 0.1) * 20;

        // Slow parallax rotation of the space dust
        if (this.scene.userData.spaceDust) {
            this.scene.userData.spaceDust.rotation.y = time * 0.02;
            this.scene.userData.spaceDust.rotation.x = time * 0.01;
        }

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

    public setGridVisible(visible: boolean) {
        if (this.gridHelper) this.gridHelper.visible = visible;
        if (this.axesHelper) this.axesHelper.visible = visible;
    }

    public applyPreset(preset: "cinematic" | "bright" | "high_contrast" | "dark") {
        if (!this.ambientLight || !this.hemiLight || !this.mainLight || !this.rimLight) return;

        switch (preset) {
            case "cinematic":
                this.ambientLight.intensity = 0.65;
                this.hemiLight.intensity = 1.0;
                this.mainLight.intensity = 2.2;
                this.rimLight.intensity = 0.8;
                this.scene.fog = new THREE.FogExp2(COLORS.background, 0.015);
                break;
            case "bright":
                this.ambientLight.intensity = 1.2;
                this.hemiLight.intensity = 1.5;
                this.mainLight.intensity = 2.0;
                this.rimLight.intensity = 1.2;
                this.scene.fog = new THREE.FogExp2(COLORS.background, 0.005);
                break;
            case "high_contrast":
                this.ambientLight.intensity = 0.2;
                this.hemiLight.intensity = 0.5;
                this.mainLight.intensity = 3.0;
                this.rimLight.intensity = 2.5;
                this.scene.fog = new THREE.FogExp2(COLORS.background, 0.02);
                break;
            case "dark":
                this.ambientLight.intensity = 0.15;
                this.hemiLight.intensity = 0.3;
                this.mainLight.intensity = 1.0;
                this.rimLight.intensity = 0.4;
                this.scene.fog = new THREE.FogExp2(COLORS.background, 0.035);
                break;
        }
    }
}

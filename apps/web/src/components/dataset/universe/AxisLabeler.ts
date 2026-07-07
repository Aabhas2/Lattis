import * as THREE from "three";

export class AxisLabeler {
    private scene: THREE.Scene;
    private sprites: THREE.Sprite[] = [];

    constructor(scene: THREE.Scene) {
        this.scene = scene;
    }

    updateLabels(xName: string, yName: string, zName: string): void {
        // Remove old sprites and dispose their textures to prevent WebGL texture corruption
        this.sprites.forEach(s => {
            (s.material as THREE.SpriteMaterial).map?.dispose();
            s.material.dispose();
            this.scene.remove(s);
        });
        this.sprites = [];

        const labels = [
            { text: xName, position: new THREE.Vector3(12, 0, 0), color: "#f87171" },
            { text: yName, position: new THREE.Vector3(0, 12, 0), color: "#4ade80" },
            { text: zName, position: new THREE.Vector3(0, 0, 12), color: "#60a5fa" },
        ];

        for (const { text, position, color } of labels) {
            const sprite = this.makeTextSprite(text, color);
            sprite.position.copy(position);
            sprite.scale.set(5.5, 1.17, 1);
            this.scene.add(sprite);
            this.sprites.push(sprite);
        }
    }

    private makeTextSprite(text: string, color: string): THREE.Sprite {
        const canvas = document.createElement("canvas");
        canvas.width = 300; 
        canvas.height = 64;

        const ctx = canvas.getContext("2d");
        if (!ctx) return new THREE.Sprite();

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        let axisPrefix = "X";
        if (color === "#4ade80") axisPrefix = "Y";
        if (color === "#60a5fa") axisPrefix = "Z";

        // Draw pill background
        ctx.fillStyle = "rgba(10, 10, 10, 0.4)";
        ctx.beginPath();
        ctx.roundRect(0, 12, canvas.width, 40, 20);
        ctx.fill();

        // Draw axis prefix box
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.roundRect(0, 12, 40, 40, 20);
        ctx.fill();

        // Axis letter
        ctx.fillStyle = "#09090b"; // dark background color for contrast
        ctx.font = "900 18px 'Inter', system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(axisPrefix, 20, 32);

        // Label text
        ctx.fillStyle = "#e4e4e7"; // light text
        ctx.font = "600 15px 'Inter', system-ui, sans-serif";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        
        const labelName = text.length > 22 ? text.slice(0, 20) + "…" : text;
        ctx.fillText(labelName, 52, 33);

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        texture.minFilter = THREE.LinearFilter; // Ensure sharp text

        const material = new THREE.SpriteMaterial({
            transparent: true,
            opacity: 1.0,
            map: texture,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });

        return new THREE.Sprite(material);
    }

    public setVisible(visible: boolean): void {
        this.sprites.forEach(s => {
            s.visible = visible;
        });
    }

    public update(camera: THREE.Camera): void {
        const maxDistance = 40;
        const minDistance = 10;
        
        this.sprites.forEach(sprite => {
            if (!sprite.visible) return;
            
            const distance = camera.position.distanceTo(sprite.position);
            
            let opacity = 1.0;
            if (distance > minDistance) {
                // Fade out as distance increases
                opacity = 1.0 - Math.min(1.0, (distance - minDistance) / (maxDistance - minDistance));
            }
            
            // Apply exponential curve for smoother fade
            (sprite.material as THREE.SpriteMaterial).opacity = Math.pow(opacity, 1.5) * 0.9;
        });
    }

    dispose(): void {
        this.sprites.forEach(s => {
            (s.material as THREE.SpriteMaterial).map?.dispose();
            s.material.dispose();
            this.scene.remove(s);
        });
        this.sprites = [];
    }
}
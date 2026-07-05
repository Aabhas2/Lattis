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
            sprite.scale.set(4, 1.5, 1);
            this.scene.add(sprite);
            this.sprites.push(sprite);
        }
    }

    private makeTextSprite(text: string, color: string): THREE.Sprite {
        const canvas = document.createElement("canvas");
        canvas.width = 384; // Increased from 256 to fit arrow
        canvas.height = 64;

        const ctx = canvas.getContext("2d");
        if (!ctx) return new THREE.Sprite();

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Background pill 
        ctx.fillStyle = "rgba(15, 15, 15, 0.75)";
        ctx.beginPath();
        ctx.roundRect(4, 4, canvas.width - 8, canvas.height - 8, 12);
        ctx.fill();

        // Border 
        ctx.strokeStyle = color + "88";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(4, 4, canvas.width - 8, canvas.height - 8, 12);
        ctx.stroke();

        // Text 
        ctx.fillStyle = color;
        ctx.font = "bold 20px 'Inter', 'system-ui', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        // Truncate long names 
        const labelName = text.length > 12 ? text.slice(0, 10) + "…" : text;
        
        // Extract axis prefix (X, Y, Z or PC1, etc)
        // Since we don't know which axis this is from just the text, we'll infer it from the color
        let axisName = "";
        if (color === "#f87171") axisName = "X ────────► ";
        if (color === "#4ade80") axisName = "Y ────────► ";
        if (color === "#60a5fa") axisName = "Z ────────► ";
        
        const fullLabel = axisName + labelName;
        ctx?.fillText(fullLabel, canvas.width / 2, canvas.height / 2);

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;

        const material = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            depthTest: false,
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
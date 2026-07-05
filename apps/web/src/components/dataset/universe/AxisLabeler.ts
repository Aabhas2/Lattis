import * as THREE from "three";

export class AxisLabeler {
    private scene: THREE.Scene;
    private sprites: THREE.Sprite[] = [];

    constructor(scene: THREE.Scene) {
        this.scene = scene;
    }

    updateLabels(xName: string, yName: string, zName: string): void {
        // Remove old sprites 
        this.sprites.forEach(s => this.scene.remove(s));
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
        canvas.width = 256;
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
        ctx.font = "bold 22px 'Inter', 'system-ui', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        // Truncate long names 
        const label = text.length > 14 ? text.slice(0, 12) + "…" : text;
        ctx?.fillText(label, canvas.width / 2, canvas.height / 2);

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;

        const material = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            depthTest: false,
        });

        return new THREE.Sprite(material);
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
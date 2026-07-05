import * as THREE from "three";
import { COLORS } from "./ColorTheme";
import { TreeNode, VisualizationData } from "./types";


export class TreeRenderer {
    private scene: THREE.Scene;
    private treeGroup: THREE.Group | null = null;
    private activeMode: string = "dataset";

    constructor(scene: THREE.Scene) {
        this.scene = scene;
    }

    public updateData(data: VisualizationData) {
        this.clearTree();

        if (!data.tree) return;

        this.treeGroup = new THREE.Group();

        // Build tree recursively starting at position [0, 6, 0] 
        this.buildTreeNode(data.tree, 0, 6, 0, 0, null);

        this.scene.add(this.treeGroup);
        this.applyVisibility();
    }

    private buildTreeNode(
        node: TreeNode,
        x: number,
        y: number,
        z: number,
        depth: number,
        parentPos: THREE.Vector3 | null
    ) {
        if (!this.treeGroup) return;

        // Draw node (Sphere mesh) 
        // Gradually decrease node radius as tree gets deeper to prevent clustering overlaps 
        const radius = 0.45 - Math.min(0.2, depth * 0.05);
        const geometry = new THREE.SphereGeometry(radius, 16, 16);

        // Node color coding: leaf nodes use NEGATIVE/Rose color, split nodes use POSITIVE/Emerald 
        const colorHex = node.is_leaf ? COLORS.negative : COLORS.positive;
        const material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(colorHex),
            roughness: 0.1,
            metalness: 0.8
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(x, y, z);

        // Cache node metadata in userData attributes for Raycasting interaction 
        mesh.userData = {
            type: "tree_node",
            is_leaf: node.is_leaf,
            feature: node.feature,
            threshold: node.threshold,
            value: node.value,
            depth
        };
        this.treeGroup.add(mesh);

        // Draw branch line connecting child node to its parent node 
        if (parentPos) {
            const points = [parentPos, new THREE.Vector3(x, y, z)];
            const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
            const lineMaterial = new THREE.LineBasicMaterial({
                color: new THREE.Color(COLORS.neutral),
                transparent: true,
                opacity: 0.6
            });
            const line = new THREE.Line(lineGeometry, lineMaterial);
            this.treeGroup.add(line);
        }

        // Recursive splitting coordinate layout 
        if (!node.is_leaf) {
            const nextDepth = depth + 1;

            // X-axis spread shrinks exponentially by division as node depth increases 
            const nextSpread = 10 / Math.pow(1.6, depth);
            const nextY = y - 3.2;
            const currentPos = new THREE.Vector3(x, y, z);

            if (node.left) {
                this.buildTreeNode(node.left, x - nextSpread, nextY, z, nextDepth, currentPos);
            }
            if (node.right) {
                this.buildTreeNode(node.right, x + nextSpread, nextY, z, nextDepth, currentPos);
            }
        }
    }

    public setMode(mode: string) {
        this.activeMode = mode;
        this.applyVisibility();
    }

    private applyVisibility() {
        if (this.treeGroup) {
            this.treeGroup.visible = (this.activeMode === "tree");
        }
    }

    private clearTree() {
        if (this.treeGroup) {
            this.scene.remove(this.treeGroup);
            this.treeGroup.traverse((child: any) => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            });
            this.treeGroup = null;
        }
    }
    public destroy() {
        this.clearTree();
    }

    public getTreeGroup() { return this.treeGroup; }
}
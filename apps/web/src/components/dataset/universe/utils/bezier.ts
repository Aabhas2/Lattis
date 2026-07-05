import * as THREE from "three";

export function createBezierCurve(start: THREE.Vector3, end: THREE.Vector3): THREE.CubicBezierCurve3 {
    const control1 = new THREE.Vector3(
        start.x - 5,
        start.y + 15,
        start.z
    );
    const control2 = new THREE.Vector3(
        end.x,
        end.y + 10,
        end.z
    );
    return new THREE.CubicBezierCurve3(start, control1, control2, end);
}
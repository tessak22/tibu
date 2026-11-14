import * as THREE from 'three';
import { SIZE_X, SIZE_Z } from '../../world/grid';

export const ISLAND_CENTER = new THREE.Vector3(SIZE_X / 2, 2, SIZE_Z / 2);

/** Soft, pastel daytime lighting with one shadow-casting sun. */
export class Lights {
  readonly group = new THREE.Group();
  readonly sun: THREE.DirectionalLight;
  private readonly hemi: THREE.HemisphereLight;

  constructor() {
    this.hemi = new THREE.HemisphereLight('#fff6fb', '#c9e7c4', 1.55);
    const ambient = new THREE.AmbientLight('#ffffff', 0.35);
    this.sun = new THREE.DirectionalLight('#fff1d6', 1.65);
    this.sun.position.set(ISLAND_CENTER.x - 16, 36, ISLAND_CENTER.z + 14);
    this.sun.target.position.copy(ISLAND_CENTER);
    this.sun.castShadow = true;
    const cam = this.sun.shadow.camera;
    cam.left = -24;
    cam.right = 24;
    cam.top = 24;
    cam.bottom = -24;
    cam.near = 5;
    cam.far = 90;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0008;
    this.sun.shadow.normalBias = 0.04;
    this.sun.shadow.radius = 4;
    this.group.add(this.hemi, ambient, this.sun, this.sun.target);
  }

  setSkyTint(top: string): void {
    this.hemi.color.set('#ffffff').lerp(new THREE.Color(top), 0.25);
  }

  setShadows(on: boolean): void {
    this.sun.castShadow = on;
  }

  dispose(): void {
    this.sun.shadow.map?.dispose();
    this.sun.dispose();
    this.hemi.dispose();
  }
}

import * as THREE from 'three';
import { WORLD_SIZE, type WorldSize } from '../../core/types';

/** Default orbit target for a world: the middle of the ground, a little above the floor. */
export function worldCenter(size: WorldSize): THREE.Vector3 {
  return new THREE.Vector3(size.x / 2, 2, size.z / 2);
}

const SUN_OFFSET = new THREE.Vector3(-16, 34, 14);
/** Half-size of the shadow camera in little worlds (covers the whole island). */
const SMALL_SHADOW_HALF = 24;
/** Big worlds: shadows only around the camera target, so the map stays sharp and cheap. */
const BIG_SHADOW_HALF = 30;
/** The shadow center moves in steps this big; between steps the shadow map is reused. */
const SHADOW_SNAP = 4;

/** Soft, pastel daytime lighting with one shadow-casting sun that follows the view in big worlds. */
export class Lights {
  readonly group = new THREE.Group();
  readonly sun: THREE.DirectionalLight;
  private readonly hemi: THREE.HemisphereLight;
  private follows = false;
  private readonly center = new THREE.Vector3();

  constructor() {
    this.hemi = new THREE.HemisphereLight('#fff6fb', '#c9e7c4', 1.55);
    const ambient = new THREE.AmbientLight('#ffffff', 0.35);
    this.sun = new THREE.DirectionalLight('#fff1d6', 1.65);
    this.sun.castShadow = true;
    const cam = this.sun.shadow.camera;
    cam.near = 5;
    cam.far = 110;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0008;
    this.sun.shadow.normalBias = 0.04;
    this.sun.shadow.radius = 4;
    this.group.add(this.hemi, ambient, this.sun, this.sun.target);
    this.setWorldSize(WORLD_SIZE);
  }

  /** Little worlds: a fixed sun over the island. Big worlds: the sun follows the target. */
  setWorldSize(size: WorldSize): void {
    this.follows = Math.max(size.x, size.z) > 32;
    const half = this.follows ? BIG_SHADOW_HALF : SMALL_SHADOW_HALF;
    const cam = this.sun.shadow.camera;
    cam.left = -half;
    cam.right = half;
    cam.top = half;
    cam.bottom = -half;
    cam.updateProjectionMatrix();
    this.center.set(Number.NaN, 0, 0);
    this.place(worldCenter(size));
  }

  /** Moves the shadow area with the camera target. Returns true when the shadow map must update. */
  follow(target: THREE.Vector3): boolean {
    if (!this.follows) return false;
    const snapped = new THREE.Vector3(
      Math.round(target.x / SHADOW_SNAP) * SHADOW_SNAP,
      2,
      Math.round(target.z / SHADOW_SNAP) * SHADOW_SNAP,
    );
    if (snapped.equals(this.center)) return false;
    this.place(snapped);
    return true;
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

  private place(center: THREE.Vector3): void {
    this.center.copy(center);
    this.sun.position.copy(center).add(SUN_OFFSET);
    this.sun.target.position.copy(center);
    this.sun.target.updateMatrixWorld();
    this.sun.updateMatrixWorld();
  }
}

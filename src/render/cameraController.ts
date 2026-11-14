import * as THREE from 'three';
import {
  DEFAULT_ORBIT,
  easeInOutCubic,
  lerpOrbit,
  orbitByDrag,
  orbitToPosition,
  zoomBy,
  type OrbitState,
} from '../input/orbit';
import { ISLAND_CENTER } from './scene/lights';

const FLY_SECONDS = 0.9;

/** Orbit camera around the island center, with an optional smooth fly back home. */
export class CameraController {
  readonly camera: THREE.PerspectiveCamera;
  private state: OrbitState = DEFAULT_ORBIT;
  private fly: { from: OrbitState; to: OrbitState; t: number } | null = null;

  constructor() {
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.5, 900);
    this.apply();
  }

  get orbit(): OrbitState {
    return this.state;
  }

  setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    // Keep the whole island in view on portrait screens by widening the vertical FOV.
    this.camera.fov = aspect < 1 ? Math.min(70, 45 / Math.max(0.55, aspect)) : 45;
    this.camera.updateProjectionMatrix();
  }

  orbitBy(dx: number, dy: number, viewportHeight: number): void {
    this.fly = null;
    this.state = orbitByDrag(this.state, dx, dy, viewportHeight);
    this.apply();
  }

  /** scale > 1 zooms in (pinch apart). */
  zoom(scale: number): void {
    this.fly = null;
    this.state = zoomBy(this.state, 1 / scale);
    this.apply();
  }

  reset(instant: boolean): void {
    if (instant) {
      this.fly = null;
      this.state = DEFAULT_ORBIT;
      this.apply();
      return;
    }
    this.fly = { from: this.state, to: DEFAULT_ORBIT, t: 0 };
  }

  /** Returns true while animating. */
  update(dt: number): boolean {
    if (!this.fly) return false;
    this.fly.t = Math.min(1, this.fly.t + dt / FLY_SECONDS);
    this.state = lerpOrbit(this.fly.from, this.fly.to, easeInOutCubic(this.fly.t));
    if (this.fly.t >= 1) this.fly = null;
    this.apply();
    return true;
  }

  /** Points any camera at the island from an orbit state (used for gallery snapshots). */
  static place(camera: THREE.PerspectiveCamera, state: OrbitState): void {
    const [x, y, z] = orbitToPosition(state, ISLAND_CENTER);
    camera.position.set(x, y, z);
    camera.lookAt(ISLAND_CENTER);
    camera.updateMatrixWorld();
  }

  private apply(): void {
    CameraController.place(this.camera, this.state);
  }
}

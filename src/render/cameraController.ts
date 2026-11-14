import * as THREE from 'three';
import { WORLD_SIZE, type WorldSize } from '../core/types';
import {
  defaultOrbitFor,
  easeInOutCubic,
  followOrbitFor,
  isBigWorld,
  lerpOrbit,
  orbitByDrag,
  orbitLimitsFor,
  orbitToPosition,
  panTarget,
  zoomBy,
  type OrbitLimits,
  type OrbitState,
} from '../input/orbit';
import { worldCenter } from './scene/lights';

const FLY_SECONDS = 0.9;
/** Follow smoothing: fraction of the remaining distance closed per second (exponential). */
const FOLLOW_RATE = 5;
/** Look a little above a followed character's origin (its feet), at about its middle. */
const FOLLOW_LIFT = 0.5;
/** The follow counts as converging while the target is farther than this from the character. */
const FOLLOW_SETTLE = 0.01;

/** Far plane and fog that keep big worlds cheap: fog hides the far plane, starting past the target. */
export function viewRangeFor(size: WorldSize, radius: number): { near: number; far: number; fogNear: number; fogFar: number } {
  if (!isBigWorld(size)) return { near: 0.5, far: 320, fogNear: 90, fogFar: 260 };
  const fogNear = radius + 24;
  const fogFar = radius + 95;
  return { near: 0.3, far: fogFar + 20, fogNear, fogFar };
}

/** Orbit camera around a target (the island center, a panned spot, or a followed character). */
export class CameraController {
  readonly camera: THREE.PerspectiveCamera;
  private state: OrbitState;
  private size: WorldSize = WORLD_SIZE;
  private limits: OrbitLimits;
  private readonly target = worldCenter(WORLD_SIZE);
  private home = worldCenter(WORLD_SIZE);
  private fly: { from: OrbitState; to: OrbitState; fromTarget: THREE.Vector3; t: number } | null = null;
  private followed: THREE.Object3D | null = null;
  private readonly followPoint = new THREE.Vector3();

  constructor() {
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.5, 320);
    this.state = defaultOrbitFor(this.size);
    this.limits = orbitLimitsFor(this.size);
    this.apply();
  }

  get orbit(): OrbitState {
    return this.state;
  }

  /** Current orbit target. The live vector, not a copy: callers must not modify it. */
  get focus(): Readonly<THREE.Vector3> {
    return this.target;
  }

  get worldSize(): WorldSize {
    return this.size;
  }

  setWorldSize(size: WorldSize): void {
    this.size = size;
    this.limits = orbitLimitsFor(size);
    this.home = worldCenter(size);
    this.fly = null;
    this.state = defaultOrbitFor(size);
    this.target.copy(this.home);
    this.apply();
  }

  setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    // Keep the whole island in view on portrait screens by widening the vertical FOV.
    this.camera.fov = aspect < 1 ? Math.min(70, 45 / Math.max(0.55, aspect)) : 45;
    this.camera.updateProjectionMatrix();
  }

  orbitBy(dx: number, dy: number, viewportHeight: number): void {
    this.fly = null;
    this.state = orbitByDrag(this.state, dx, dy, viewportHeight, this.limits);
    this.apply();
  }

  /** scale > 1 zooms in (pinch apart). */
  zoom(scale: number): void {
    this.fly = null;
    this.state = zoomBy(this.state, 1 / scale, this.limits);
    this.apply();
  }

  /** Two-finger drag: slides the target over the ground (big worlds only, not while following). */
  pan(dx: number, dy: number, viewportHeight: number): boolean {
    if (!isBigWorld(this.size) || this.followed) return false;
    this.fly = null;
    const next = panTarget(this.target, this.state, dx, dy, viewportHeight, {
      minX: 0,
      maxX: this.size.x,
      minZ: 0,
      maxZ: this.size.z,
    });
    this.target.set(next.x, this.target.y, next.z);
    this.apply();
    return true;
  }

  /**
   * Follow an object: the camera glides into the close third-person framing (keeping the child's
   * orbit direction). null keeps orbiting where it is.
   */
  setFollow(object: THREE.Object3D | null): void {
    const started = object !== null && this.followed !== object;
    this.followed = object;
    if (!started) return;
    this.fly = { from: this.state, to: followOrbitFor(this.state.azimuth), fromTarget: this.target.clone(), t: 0 };
  }

  followTarget(): THREE.Object3D | null {
    return this.followed;
  }

  isFollowing(): boolean {
    return this.followed !== null;
  }

  reset(instant: boolean): void {
    const to = this.followed ? followOrbitFor(this.state.azimuth) : defaultOrbitFor(this.size);
    const toTarget = this.followed ? this.target : this.home;
    if (instant) {
      this.fly = null;
      this.state = to;
      this.target.copy(toTarget);
      this.apply();
      return;
    }
    this.fly = { from: this.state, to, fromTarget: this.target.clone(), t: 0 };
  }

  /** Returns true while the camera moves (a fly, or still catching up with a followed object). */
  update(dt: number): boolean {
    let moving = false;
    if (this.fly) {
      this.fly.t = Math.min(1, this.fly.t + dt / FLY_SECONDS);
      const k = easeInOutCubic(this.fly.t);
      this.state = lerpOrbit(this.fly.from, this.fly.to, k);
      if (!this.followed) this.target.lerpVectors(this.fly.fromTarget, this.home, k);
      if (this.fly.t >= 1) this.fly = null;
      moving = true;
    }
    if (this.followed) {
      this.followed.getWorldPosition(this.followPoint);
      this.followPoint.y += FOLLOW_LIFT;
      const gap2 = this.target.distanceToSquared(this.followPoint);
      if (gap2 > FOLLOW_SETTLE * FOLLOW_SETTLE) {
        const k = 1 - Math.exp(-FOLLOW_RATE * Math.max(0, dt));
        this.target.lerp(this.followPoint, k);
        moving = true;
      } else if (gap2 > 0) {
        // Settled: snap the last hair and stop counting as motion.
        this.target.copy(this.followPoint);
        this.apply();
      }
    }
    if (moving) this.apply();
    return moving;
  }

  /** Points any camera at a target from an orbit state (used for gallery snapshots). */
  static place(camera: THREE.PerspectiveCamera, state: OrbitState, target: THREE.Vector3): void {
    const [x, y, z] = orbitToPosition(state, target);
    camera.position.set(x, y, z);
    camera.lookAt(target);
    camera.updateMatrixWorld();
  }

  /** Gallery framing target for the current world. */
  galleryTarget(): THREE.Vector3 {
    return this.home.clone();
  }

  private apply(): void {
    const range = viewRangeFor(this.size, this.state.radius);
    if (this.camera.far !== range.far || this.camera.near !== range.near) {
      this.camera.far = range.far;
      this.camera.near = range.near;
      this.camera.updateProjectionMatrix();
    }
    CameraController.place(this.camera, this.state, this.target);
  }
}

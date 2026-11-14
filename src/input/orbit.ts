import type { Rotation, WorldSize } from '../core/types';

/** Pure orbit-camera math. Angles in radians; polar is measured from straight up. */
export interface OrbitState {
  readonly azimuth: number;
  readonly polar: number;
  readonly radius: number;
}

export interface OrbitLimits {
  readonly minPolar: number;
  readonly maxPolar: number;
  readonly minRadius: number;
  readonly maxRadius: number;
}

export const ORBIT_LIMITS: OrbitLimits = {
  minPolar: 0.18,
  /** Just above the horizon so the camera never goes underground. */
  maxPolar: 1.42,
  minRadius: 12,
  maxRadius: 58,
};

/** Big worlds: get close to the character, never so far that the fog swallows the view. */
export const BIG_ORBIT_LIMITS: OrbitLimits = { minPolar: 0.18, maxPolar: 1.38, minRadius: 7, maxRadius: 64 };

/** Worlds wider than this are "big": the orbit target can pan and chunks build lazily. */
export const BIG_WORLD_MIN_SPAN = 32;

export function isBigWorld(size: WorldSize): boolean {
  return Math.max(size.x, size.z) > BIG_WORLD_MIN_SPAN;
}

export function orbitLimitsFor(size: WorldSize): OrbitLimits {
  return isBigWorld(size) ? BIG_ORBIT_LIMITS : ORBIT_LIMITS;
}

/** Default pleasant 3/4 view. */
export const DEFAULT_ORBIT: OrbitState = { azimuth: Math.PI / 4, polar: 0.98, radius: 34 };

/** Big worlds start closer: the child sees their corner of the world, not the whole map. */
export const BIG_DEFAULT_ORBIT: OrbitState = { azimuth: Math.PI / 4, polar: 0.95, radius: 26 };

/** Fixed gallery thumbnail angle. */
export const GALLERY_ORBIT: OrbitState = { azimuth: Math.PI / 4 + 0.15, polar: 1.0, radius: 40 };

export function defaultOrbitFor(size: WorldSize): OrbitState {
  return isBigWorld(size) ? BIG_DEFAULT_ORBIT : DEFAULT_ORBIT;
}

/** Gallery angle that frames the whole world, whatever its size. */
export function galleryOrbitFor(size: WorldSize): OrbitState {
  if (!isBigWorld(size)) return GALLERY_ORBIT;
  return { azimuth: GALLERY_ORBIT.azimuth, polar: 0.9, radius: Math.max(size.x, size.z) * 0.95 };
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

export function clampOrbit(s: OrbitState, limits: OrbitLimits = ORBIT_LIMITS): OrbitState {
  return {
    azimuth: s.azimuth,
    polar: clamp(s.polar, limits.minPolar, limits.maxPolar),
    radius: clamp(s.radius, limits.minRadius, limits.maxRadius),
  };
}

/** Drag in CSS px -> rotation. A full viewport-height drag turns about 180 degrees. */
export function orbitByDrag(
  s: OrbitState,
  dx: number,
  dy: number,
  viewportHeight: number,
  limits: OrbitLimits = ORBIT_LIMITS,
): OrbitState {
  const k = Math.PI / Math.max(200, viewportHeight);
  return clampOrbit({ azimuth: s.azimuth - dx * k, polar: s.polar - dy * k, radius: s.radius }, limits);
}

/** factor > 1 zooms out, < 1 zooms in. */
export function zoomBy(s: OrbitState, factor: number, limits: OrbitLimits = ORBIT_LIMITS): OrbitState {
  if (!Number.isFinite(factor) || factor <= 0) return s;
  return clampOrbit({ ...s, radius: s.radius * factor }, limits);
}

/**
 * Quarter-turn rotation for a new part so it faces away from the viewer.
 * Rotation r points the part's "forward" at: 0 north (-z), 1 east (+x), 2 south (+z), 3 west (-x)
 * (content convention: a quarter turn maps [x, z] -> [-z, x]). The camera sits at azimuth `a` and
 * looks along (-sin a, -cos a): a quarter turn of azimuth turns the view west, i.e. rotation -1.
 */
export function rotationFromYaw(azimuth: number): Rotation {
  if (!Number.isFinite(azimuth)) return 0;
  const quarter = -Math.round(azimuth / (Math.PI / 2));
  return ((((quarter % 4) + 4) % 4) as Rotation);
}

export interface PanBounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}

/**
 * Two-finger drag in CSS px moves the orbit target over the ground so the world follows the
 * fingers. Returns the new target (x, z); y is unchanged. Clamped to `bounds`.
 */
export function panTarget(
  target: { readonly x: number; readonly z: number },
  s: OrbitState,
  dx: number,
  dy: number,
  viewportHeight: number,
  bounds: PanBounds,
): { x: number; z: number } {
  const k = (s.radius * 1.1) / Math.max(200, viewportHeight);
  const sinA = Math.sin(s.azimuth);
  const cosA = Math.cos(s.azimuth);
  // Screen right on the ground is (cos a, -sin a); screen "into" is (-sin a, -cos a).
  const x = target.x - dx * k * cosA + dy * k * -sinA;
  const z = target.z + dx * k * sinA + dy * k * -cosA;
  return { x: clamp(x, bounds.minX, bounds.maxX), z: clamp(z, bounds.minZ, bounds.maxZ) };
}

export function orbitToPosition(s: OrbitState, target: { x: number; y: number; z: number }): [number, number, number] {
  const sinP = Math.sin(s.polar);
  return [
    target.x + s.radius * sinP * Math.sin(s.azimuth),
    target.y + s.radius * Math.cos(s.polar),
    target.z + s.radius * sinP * Math.cos(s.azimuth),
  ];
}

/** Shortest-path interpolation between two orbit states, t in [0, 1]. */
export function lerpOrbit(a: OrbitState, b: OrbitState, t: number): OrbitState {
  const twoPi = Math.PI * 2;
  let dAz = (b.azimuth - a.azimuth) % twoPi;
  if (dAz > Math.PI) dAz -= twoPi;
  if (dAz < -Math.PI) dAz += twoPi;
  return {
    azimuth: a.azimuth + dAz * t,
    polar: a.polar + (b.polar - a.polar) * t,
    radius: a.radius + (b.radius - a.radius) * t,
  };
}

export const easeInOutCubic = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

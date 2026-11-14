/** Pure orbit-camera math. Angles in radians; polar is measured from straight up. */
export interface OrbitState {
  readonly azimuth: number;
  readonly polar: number;
  readonly radius: number;
}

export const ORBIT_LIMITS = {
  minPolar: 0.18,
  /** Just above the horizon so the camera never goes underground. */
  maxPolar: 1.42,
  minRadius: 12,
  maxRadius: 58,
} as const;

/** Default pleasant 3/4 view. */
export const DEFAULT_ORBIT: OrbitState = { azimuth: Math.PI / 4, polar: 0.98, radius: 34 };

/** Fixed gallery thumbnail angle. */
export const GALLERY_ORBIT: OrbitState = { azimuth: Math.PI / 4 + 0.15, polar: 1.0, radius: 40 };

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

export function clampOrbit(s: OrbitState): OrbitState {
  return {
    azimuth: s.azimuth,
    polar: clamp(s.polar, ORBIT_LIMITS.minPolar, ORBIT_LIMITS.maxPolar),
    radius: clamp(s.radius, ORBIT_LIMITS.minRadius, ORBIT_LIMITS.maxRadius),
  };
}

/** Drag in CSS px -> rotation. A full viewport-height drag turns about 180 degrees. */
export function orbitByDrag(s: OrbitState, dx: number, dy: number, viewportHeight: number): OrbitState {
  const k = Math.PI / Math.max(200, viewportHeight);
  return clampOrbit({ azimuth: s.azimuth - dx * k, polar: s.polar - dy * k, radius: s.radius });
}

/** factor > 1 zooms out, < 1 zooms in. */
export function zoomBy(s: OrbitState, factor: number): OrbitState {
  if (!Number.isFinite(factor) || factor <= 0) return s;
  return clampOrbit({ ...s, radius: s.radius * factor });
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

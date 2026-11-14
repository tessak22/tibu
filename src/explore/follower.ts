/**
 * Pure path-following math. Positions are "feet" positions in cell space: a cell (x, y, z)
 * maps to feet at (x, y, z) and the caller converts to world space. No allocations per frame:
 * results are written into a caller-owned Pose.
 */
import type { Cell } from '../core/types';

export interface Pose {
  x: number;
  y: number;
  z: number;
  /** Yaw in radians; 0 faces +z. */
  yaw: number;
  /** 0..1 how far through a hop (0 when walking on the flat). */
  hop: number;
  /** -1 down, 0 flat, 1 up for the current step. */
  climb: number;
}

export interface StepTiming {
  /** Seconds per flat step. */
  readonly flat: number;
  /** Seconds per step up or down. */
  readonly climb: number;
}

export const GENTLE_STEPS: StepTiming = { flat: 0.42, climb: 0.6 };

export function createPose(at: Cell): Pose {
  return { x: at.x, y: at.y, z: at.z, yaw: 0, hop: 0, climb: 0 };
}

export function stepDuration(from: Cell, to: Cell, timing: StepTiming): number {
  return from.y === to.y ? timing.flat : timing.climb;
}

/** Yaw that faces from `from` towards `to` (0 = +z). */
export function facing(from: Cell, to: Cell, current: number): number {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  if (dx === 0 && dz === 0) return current;
  return Math.atan2(dx, dz);
}

/** Smallest signed angle from a to b, in (-PI, PI]. */
export function angleDelta(a: number, b: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

/** Eases yaw toward target at `rate` (1/s), framerate independent. */
export function turnToward(current: number, target: number, rate: number, dt: number): number {
  const k = 1 - Math.exp(-rate * dt);
  return current + angleDelta(current, target) * k;
}

const smooth = (t: number): number => t * t * (3 - 2 * t);

/**
 * Writes the pose at progress t (0..1) of one step from `from` to `to`.
 * Climbing steps follow a hop arc so the actor clears the block edge.
 */
export function stepPose(from: Cell, to: Cell, t: number, hopHeight: number, out: Pose): Pose {
  const u = t < 0 ? 0 : t > 1 ? 1 : t;
  const e = smooth(u);
  out.x = from.x + (to.x - from.x) * e;
  out.z = from.z + (to.z - from.z) * e;
  const dy = to.y - from.y;
  out.climb = dy > 0 ? 1 : dy < 0 ? -1 : 0;
  if (dy === 0) {
    out.y = from.y;
    out.hop = 0;
  } else {
    // Vertical uses linear progress plus an arc, peaking above the higher of the two cells.
    const arc = 4 * u * (1 - u) * (hopHeight + (dy > 0 ? 0.3 : 0));
    out.y = from.y + dy * (dy > 0 ? Math.sqrt(u) : u * u) + arc;
    out.hop = u;
  }
  return out;
}

/** Mutable cursor along a route. */
export interface Follower {
  from: Cell;
  steps: readonly Cell[];
  index: number;
  t: number;
}

export function createFollower(from: Cell, steps: readonly Cell[]): Follower {
  return { from, steps, index: 0, t: 0 };
}

export function followerDone(f: Follower): boolean {
  return f.index >= f.steps.length;
}

/** Current target cell, or null when done. */
export function followerTarget(f: Follower): Cell | null {
  return f.index < f.steps.length ? (f.steps[f.index] as Cell) : null;
}

/**
 * Advances along the route. Returns the number of cells arrived at during this call
 * (0 or 1 at gentle speeds; dt is clamped so it never skips more than one step).
 * After an arrival, `f.from` is the cell just reached.
 */
export function advanceFollower(f: Follower, dt: number, timing: StepTiming): number {
  const target = followerTarget(f);
  if (!target) return 0;
  f.t += dt / stepDuration(f.from, target, timing);
  if (f.t < 1) return 0;
  f.t = 0;
  f.from = target;
  f.index += 1;
  return 1;
}

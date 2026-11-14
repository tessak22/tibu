import type { BlockKey, Cell, Rotation } from '../../core/types';

/** A block that fell in a collapse (already removed from the world). */
export interface FallenBlock {
  readonly cell: Cell;
  readonly block: BlockKey;
  readonly rot: Rotation;
}

/** How one block tumbles: launch velocity, spin (rad/s about x and z), delay and landing height. */
export interface TumbleSpec extends FallenBlock {
  readonly velocity: { readonly x: number; readonly y: number; readonly z: number };
  readonly spin: { readonly x: number; readonly z: number };
  readonly delay: number;
  /** World y of the surface the block lands on. */
  readonly groundY: number;
}

export interface CollapsePlan {
  /** Blocks that topple, bounce once and pop. */
  readonly tumblers: readonly TumbleSpec[];
  /** Blocks that just pop into a puff right away (the smashed one, extras past the cap, reduced motion). */
  readonly puffs: readonly FallenBlock[];
}

export interface CollapseInput {
  /** The smashed cell; null when unknown (the lowest fallen block is used). */
  readonly origin: Cell | null;
  readonly fallen: readonly FallenBlock[];
  /** Height of the first solid surface at or below `fromY` in column (x, z); 0 when none. */
  groundAt(x: number, z: number, fromY: number): number;
  readonly reducedMotion: boolean;
  /** Random source in [0, 1) (injectable for tests). */
  readonly random?: () => number;
}

export const MAX_TUMBLERS = 24;
/** Puffs for blocks beyond the tumble cap (more would just be noise). */
export const MAX_EXTRA_PUFFS = 8;
/** Reduced motion: no tumbling, only a few light puffs. */
export const MAX_REDUCED_PUFFS = 6;
export const GRAVITY = -22;
/** A tumbler pops at the latest this long after it starts moving. */
export const TUMBLE_SECONDS = 0.95;

const sameCell = (a: Cell, b: Cell): boolean => a.x === b.x && a.y === b.y && a.z === b.z;

function lowest(fallen: readonly FallenBlock[]): Cell | null {
  return fallen.reduce<Cell | null>((low, f) => (low === null || f.cell.y < low.y ? f.cell : low), null);
}

/**
 * Plans the fun "timber!" animation for a collapse: blocks nearest the smash go first, each pushed
 * outward from the smash point with a spin that tips it over. Pure and deterministic given `random`.
 */
export function planCollapse(input: CollapseInput): CollapsePlan {
  const random = input.random ?? Math.random;
  const origin = input.origin ?? lowest(input.fallen);
  if (!origin) return { tumblers: [], puffs: [] };
  const smashed = input.fallen.filter((f) => sameCell(f.cell, origin));
  const others = input.fallen.filter((f) => !sameCell(f.cell, origin));
  if (input.reducedMotion) {
    return { tumblers: [], puffs: [...smashed, ...others].slice(0, MAX_REDUCED_PUFFS) };
  }
  const dist = (c: Cell): number => Math.hypot(c.x - origin.x, c.y - origin.y, c.z - origin.z);
  const ordered = [...others].sort((a, b) => dist(a.cell) - dist(b.cell));
  const tumblers = ordered.slice(0, MAX_TUMBLERS).map((f) => tumbleFor(f, origin, input, random, dist(f.cell)));
  const extra = ordered.slice(MAX_TUMBLERS, MAX_TUMBLERS + MAX_EXTRA_PUFFS);
  return { tumblers, puffs: [...smashed, ...extra] };
}

function tumbleFor(f: FallenBlock, origin: Cell, input: CollapseInput, random: () => number, d: number): TumbleSpec {
  let dx = f.cell.x - origin.x;
  let dz = f.cell.z - origin.z;
  const len = Math.hypot(dx, dz);
  if (len < 1e-6) {
    // Straight above the smash: pick a random outward direction.
    const a = random() * Math.PI * 2;
    dx = Math.cos(a);
    dz = Math.sin(a);
  } else {
    dx /= len;
    dz /= len;
  }
  const height = Math.max(0, f.cell.y - origin.y);
  const speed = 1.3 + random() * 1.1 + height * 0.18;
  const spinRate = 3 + random() * 3;
  return {
    ...f,
    velocity: { x: dx * speed, y: 1.6 + random() * 1.6, z: dz * speed },
    // Spin about the horizontal axis perpendicular to the push: the block tips outward.
    spin: { x: dz * spinRate, z: -dx * spinRate },
    delay: Math.min(0.22, d * 0.03),
    groundY: input.groundAt(f.cell.x, f.cell.z, f.cell.y),
  };
}

/** Live state of a tumbling block (center position, rotation angles). Mutated by advanceTumble. */
export interface TumbleState {
  px: number;
  py: number;
  pz: number;
  vx: number;
  vy: number;
  vz: number;
  rx: number;
  rz: number;
  spinX: number;
  spinZ: number;
  t: number;
  bounces: number;
  done: boolean;
}

export function startTumble(spec: TumbleSpec): TumbleState {
  return {
    px: spec.cell.x + 0.5,
    py: spec.cell.y + 0.5,
    pz: spec.cell.z + 0.5,
    vx: spec.velocity.x,
    vy: spec.velocity.y,
    vz: spec.velocity.z,
    rx: 0,
    rz: 0,
    spinX: spec.spin.x,
    spinZ: spec.spin.z,
    t: 0,
    bounces: 0,
    done: false,
  };
}

/** One simulation step: gravity, spin, a single soft bounce, then done (pop). */
export function advanceTumble(spec: TumbleSpec, s: TumbleState, dt: number): void {
  if (s.done) return;
  s.t += dt;
  if (s.t < spec.delay) return;
  const step = Math.min(dt, s.t - spec.delay);
  s.vy += GRAVITY * step;
  s.px += s.vx * step;
  s.py += s.vy * step;
  s.pz += s.vz * step;
  s.rx += s.spinX * step;
  s.rz += s.spinZ * step;
  const floor = spec.groundY + 0.5;
  if (s.py <= floor && s.vy < 0) {
    s.py = floor;
    if (s.bounces >= 1) {
      s.done = true;
      return;
    }
    s.bounces = 1;
    s.vy = Math.min(4, -s.vy * 0.38);
    s.vx *= 0.55;
    s.vz *= 0.55;
    s.spinX *= 0.5;
    s.spinZ *= 0.5;
  }
  if (s.t - spec.delay >= TUMBLE_SECONDS) s.done = true;
}

import type { Rng } from './noise';
import type { ExplorePalette } from './palette';
import { BASE_TOP, VOID, relaxHeights, type Island, type Terrain } from './terrain';

/** Radius around the spawn kept perfectly flat for building. */
export const SPAWN_CLEAR_RADIUS = 8;
/** Radius around discovery sites kept level. */
const KEEP_FLAT_RADIUS = 5;

interface Bump {
  readonly x: number;
  readonly z: number;
  readonly radius: number;
  /** Positive = hill, negative = crater. */
  readonly height: number;
}

function pointIn(rng: Rng, isl: Island, maxFraction: number): [number, number] {
  const a = rng.range(0, Math.PI * 2);
  const d = rng.range(0, isl.radius * maxFraction);
  return [Math.round(isl.cx + Math.cos(a) * d), Math.round(isl.cz + Math.sin(a) * d)];
}

function bumpsFor(rng: Rng, isl: Island, style: ExplorePalette['terrain']): Bump[] {
  const out: Bump[] = [];
  const count = style === 'craters' ? rng.int(2, 4) : isl.main ? rng.int(0, 1) : rng.int(1, 2);
  for (let k = 0; k < count; k++) {
    const [x, z] = pointIn(rng, isl, isl.main ? 0.75 : 0.5);
    if (style === 'craters') out.push({ x, z, radius: rng.range(2.5, 4), height: -rng.int(1, 2) });
    else if (style === 'snowy') out.push({ x, z, radius: rng.range(4, 6), height: rng.int(2, 4) });
    else out.push({ x, z, radius: rng.range(3, 5), height: rng.int(1, 3) });
  }
  return out;
}

/** Height change a bump makes at distance d. Slope never exceeds 1 block per cell. */
function bumpAt(b: Bump, d: number): number {
  if (b.height > 0) return Math.max(0, Math.floor(b.height - (d * b.height) / Math.max(b.radius, b.height) + 0.5));
  if (d < b.radius) return -Math.round(-b.height * (1 - d / b.radius));
  return d < b.radius + 1.5 ? 1 : 0; // crater rim
}

/**
 * Adds gentle hills (or snowy hills, or moon craters) to the islands, keeping the spawn area
 * and discovery sites flat, then smooths everything so every neighbouring step is at most 1 block.
 */
export function shapeRelief(
  t: Terrain,
  rng: Rng,
  palette: ExplorePalette,
  spawn: { x: number; z: number },
  keepFlat: readonly { x: number; z: number }[],
): void {
  const bumps: Bump[] = [];
  for (const isl of t.islands) {
    for (const b of bumpsFor(rng, isl, palette.terrain)) {
      if (Math.hypot(b.x - spawn.x, b.z - spawn.z) < SPAWN_CLEAR_RADIUS + b.radius + 2) continue;
      if (keepFlat.some((f) => Math.hypot(b.x - f.x, b.z - f.z) < KEEP_FLAT_RADIUS + b.radius + 2)) continue;
      bumps.push(b);
    }
  }
  for (let z = 0; z < t.sz; z++) {
    for (let x = 0; x < t.sx; x++) {
      const i = x + z * t.sx;
      if (t.height[i] === VOID || t.island[i] < 0) continue;
      let up = 0;
      let down = 0;
      for (const b of bumps) {
        const v = bumpAt(b, Math.hypot(x - b.x, z - b.z));
        if (v > 0) up = Math.max(up, v);
        else down = Math.min(down, v);
      }
      t.height[i] = BASE_TOP + (down < 0 ? down : up);
      if (palette.terrain === 'snowy' && up >= 2) t.surface[i] = 'nature:snow';
    }
  }
  relaxHeights(t);
}

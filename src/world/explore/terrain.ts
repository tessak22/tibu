import type { BlockKey, WorldSize } from '../../core/types';

/** Top solid y of plain island ground. Ground fills y = 0..BASE_TOP, so the floor is unsmashable. */
export const BASE_TOP = 3;
/** Lowest allowed top (craters never dig deeper). */
export const MIN_TOP = 1;
/** Island id marker for bridge columns. */
export const BRIDGE = -2;
export const VOID = -1;

export interface Island {
  readonly id: number;
  readonly cx: number;
  readonly cz: number;
  /** Nominal radius in cells. */
  readonly radius: number;
  /** Largest distance from the center the outline can reach. */
  readonly extent: number;
  readonly shape: 'round' | 'blob' | 'squarish' | 'long';
  readonly main: boolean;
}

/**
 * Column-level description of an explore world, built up by the generator steps before any
 * block is written. Mutable on purpose: it is private scratch state of one generator run.
 */
export interface Terrain {
  readonly sx: number;
  readonly sz: number;
  /** Top solid y per column, VOID (-1) for empty sky. */
  readonly height: Int16Array;
  /** Island id per column, VOID or BRIDGE. */
  readonly island: Int8Array;
  /** Optional top block override per column (flower patches, snowy hill tops, bridge deck...). */
  readonly surface: (BlockKey | null)[];
  /** 1 = keep clear of decor (spawn build zone, bridge landings). */
  readonly reserved: Uint8Array;
  /** 1 = something was built on this column already. */
  readonly used: Uint8Array;
  readonly islands: Island[];
}

export function createTerrain(size: WorldSize): Terrain {
  const n = size.x * size.z;
  return {
    sx: size.x,
    sz: size.z,
    height: new Int16Array(n).fill(VOID),
    island: new Int8Array(n).fill(VOID),
    surface: new Array<BlockKey | null>(n).fill(null),
    reserved: new Uint8Array(n),
    used: new Uint8Array(n),
    islands: [],
  };
}

export function col(t: Terrain, x: number, z: number): number {
  return x >= 0 && z >= 0 && x < t.sx && z < t.sz ? x + z * t.sx : -1;
}

export function isSolid(t: Terrain, x: number, z: number): boolean {
  const i = col(t, x, z);
  return i >= 0 && t.height[i] !== VOID;
}

/** Island column whose 4 neighbours are solid too (not on an edge). */
export function isInterior(t: Terrain, x: number, z: number): boolean {
  const i = col(t, x, z);
  return (
    i >= 0 &&
    t.island[i] >= 0 &&
    isSolid(t, x + 1, z) &&
    isSolid(t, x - 1, z) &&
    isSolid(t, x, z + 1) &&
    isSolid(t, x, z - 1)
  );
}

/**
 * Lowers columns until every pair of neighbouring solid columns differs by at most 1, so a
 * character (max step 1) can cross any hill, crater rim or bridge landing. Only ever lowers,
 * so it converges; bounded passes keep it fast.
 */
export function relaxHeights(t: Terrain): void {
  const { sx, sz, height } = t;
  for (let pass = 0; pass < 64; pass++) {
    let changed = false;
    for (let z = 0; z < sz; z++) {
      for (let x = 0; x < sx; x++) {
        const i = x + z * sx;
        const h = height[i];
        if (h === VOID) continue;
        let limit = h;
        if (x > 0 && height[i - 1] !== VOID) limit = Math.min(limit, height[i - 1] + 1);
        if (x < sx - 1 && height[i + 1] !== VOID) limit = Math.min(limit, height[i + 1] + 1);
        if (z > 0 && height[i - sx] !== VOID) limit = Math.min(limit, height[i - sx] + 1);
        if (z < sz - 1 && height[i + sx] !== VOID) limit = Math.min(limit, height[i + sx] + 1);
        if (limit < h) {
          height[i] = Math.max(MIN_TOP, limit);
          changed = true;
        }
      }
    }
    if (!changed) return;
  }
}

import type { Rng } from './noise';
import type { ExplorePalette } from './palette';
import { BASE_TOP, BRIDGE, VOID, col, type Island, type Terrain } from './terrain';

/** Columns of an island kept free of decor at each end of a bridge. */
const LANDING = 4;
/** Bridge deck is 3 wide; the reserved corridor is 5 wide. */
const HALF_WIDTH = 1;
const CORRIDOR_HALF = 2;

export interface Bridge {
  readonly from: number;
  readonly to: number;
}

/** Points along the straight line between two island centers, one per cell step. */
function linePoints(a: Island, b: Island): [number, number][] {
  const steps = Math.max(Math.abs(b.cx - a.cx), Math.abs(b.cz - a.cz));
  const out: [number, number][] = [];
  for (let s = 0; s <= steps; s++) {
    const f = steps === 0 ? 0 : s / steps;
    out.push([Math.round(a.cx + (b.cx - a.cx) * f), Math.round(a.cz + (b.cz - a.cz) * f)]);
  }
  return out;
}

function stamp(t: Terrain, x: number, z: number, half: number, fn: (i: number) => void): void {
  for (let dz = -half; dz <= half; dz++) {
    for (let dx = -half; dx <= half; dx++) {
      const i = col(t, x + dx, z + dz);
      if (i >= 0) fn(i);
    }
  }
}

/**
 * Lays a 3-wide bridge (2 blocks thick: deck + support) across the gap between two islands.
 * Overlapping 3x3 stamps along the line keep it 4-connected, so it is walkable even on
 * diagonals. The deck sits at BASE_TOP like the island ground; relaxHeights later smooths any
 * landing that meets a hill or crater so every step is at most 1.
 */
function layBridge(t: Terrain, palette: ExplorePalette, a: Island, b: Island): void {
  const points = linePoints(a, b);
  const voidIdx = points.map(([x, z]) => t.height[col(t, x, z)] === VOID);
  const first = voidIdx.indexOf(true);
  const last = voidIdx.lastIndexOf(true);
  if (first < 0) return; // islands touch: nothing to bridge
  points.forEach(([x, z], k) => {
    if (k >= first - LANDING && k <= last + LANDING) stamp(t, x, z, CORRIDOR_HALF, (i) => (t.reserved[i] = 1));
    if (k < first - 1 || k > last + 1) return;
    stamp(t, x, z, HALF_WIDTH, (i) => {
      if (t.height[i] !== VOID) return;
      t.height[i] = BASE_TOP;
      t.island[i] = BRIDGE;
      t.surface[i] = palette.bridge;
    });
  });
}

/**
 * Joins every satellite to the main island, plus (sometimes) one extra bridge between two
 * neighbouring satellites so there is a loop to run around.
 */
export function buildBridges(t: Terrain, rng: Rng, palette: ExplorePalette): Bridge[] {
  const [main, ...others] = t.islands;
  const bridges: Bridge[] = [];
  for (const isl of others) {
    layBridge(t, palette, main, isl);
    bridges.push({ from: main.id, to: isl.id });
  }
  if (others.length >= 3 && rng.chance(0.6)) {
    const sorted = [...others].sort(
      (p, q) => Math.atan2(p.cz - main.cz, p.cx - main.cx) - Math.atan2(q.cz - main.cz, q.cx - main.cx),
    );
    const k = rng.int(0, sorted.length - 1);
    const a = sorted[k];
    const b = sorted[(k + 1) % sorted.length];
    const gap = Math.hypot(a.cx - b.cx, a.cz - b.cz) - a.extent - b.extent;
    if (gap < 12 && !crossesMain(t, a, b, main)) {
      layBridge(t, palette, a, b);
      bridges.push({ from: a.id, to: b.id });
    }
  }
  return bridges;
}

function crossesMain(t: Terrain, a: Island, b: Island, main: Island): boolean {
  return linePoints(a, b).some(([x, z]) => t.island[col(t, x, z)] === main.id);
}

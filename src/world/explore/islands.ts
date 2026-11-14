import type { WorldSize } from '../../core/types';
import { angleNoise, type Rng } from './noise';
import { BASE_TOP, type Island, type Terrain } from './terrain';

const EDGE_MARGIN = 2;
const MIN_GAP = 3;
const MAX_GAP = 6;

const SHAPE_EXTENT: Record<Island['shape'], number> = { round: 1.1, blob: 1.25, squarish: 1.2, long: 1.35 };

function makeIsland(id: number, cx: number, cz: number, radius: number, shape: Island['shape'], main: boolean): Island {
  return { id, cx, cz, radius, shape, main, extent: radius * SHAPE_EXTENT[shape] };
}

function fits(size: WorldSize, isl: Island): boolean {
  const e = Math.ceil(isl.extent);
  return (
    isl.cx - e >= EDGE_MARGIN && isl.cz - e >= EDGE_MARGIN && isl.cx + e < size.x - EDGE_MARGIN && isl.cz + e < size.z - EDGE_MARGIN
  );
}

function clear(isl: Island, others: readonly Island[]): boolean {
  return others.every((o) => Math.hypot(o.cx - isl.cx, o.cz - isl.cz) >= o.extent + isl.extent + MIN_GAP);
}

/** Tries to put one satellite island in direction `angle` from the main island. */
function placeSatellite(
  rng: Rng,
  size: WorldSize,
  main: Island,
  placed: readonly Island[],
  id: number,
  angle: number,
): Island | null {
  const shape = rng.pick<Island['shape']>(['round', 'blob', 'squarish', 'long']);
  const gap = rng.int(MIN_GAP + 1, MAX_GAP);
  for (let radius = rng.int(9, 12); radius >= 6; radius--) {
    for (let g = gap; g >= MIN_GAP + 1; g--) {
      const probe = makeIsland(id, 0, 0, radius, shape, false);
      const d = main.extent + probe.extent + g;
      const cx = Math.round(main.cx + Math.cos(angle) * d);
      const cz = Math.round(main.cz + Math.sin(angle) * d);
      const isl = makeIsland(id, cx, cz, radius, shape, false);
      if (fits(size, isl) && clear(isl, placed)) return isl;
    }
  }
  return null;
}

/**
 * Lays out 4 to 6 islands: a big main island near the middle (spawn + building space) and
 * 3 to 5 satellites around it, each a few cells apart so bridges stay short.
 */
export function layoutIslands(rng: Rng, size: WorldSize): Island[] {
  const main = makeIsland(
    0,
    Math.round(size.x / 2 + rng.range(-3, 3)),
    Math.round(size.z / 2 + rng.range(-3, 3)),
    rng.int(13, 15),
    rng.pick<Island['shape']>(['round', 'blob']),
    true,
  );
  let best: Island[] = [main];
  for (let attempt = 0; attempt < 12 && best.length < 4; attempt++) {
    const wanted = rng.int(3, 5);
    const start = rng.range(0, Math.PI * 2);
    const step = (Math.PI * 2) / wanted;
    const islands: Island[] = [main];
    for (let k = 0; k < wanted; k++) {
      const angle = start + k * step + rng.range(-0.12, 0.12) * step;
      const isl = placeSatellite(rng, size, main, islands, islands.length, angle);
      if (isl) islands.push(isl);
    }
    if (islands.length > best.length) best = islands;
  }
  return best;
}

function radiusAt(isl: Island, angle: number, seed: number): number {
  const n = (lobes: number, amp: number): number => 1 + amp * angleNoise(seed + isl.id * 101, angle, lobes);
  switch (isl.shape) {
    case 'round':
      return isl.radius * n(6, 0.08);
    case 'blob':
      return isl.radius * n(5, 0.22);
    case 'squarish': {
      const c = Math.abs(Math.cos(angle));
      const s = Math.abs(Math.sin(angle));
      return Math.min(isl.radius * 1.18, (isl.radius * 0.95) / Math.pow(c ** 4 + s ** 4, 0.25)) * n(6, 0.04);
    }
    case 'long': {
      const tilt = (isl.id * 1.7) % Math.PI;
      const a = isl.radius * 1.3;
      const b = isl.radius * 0.72;
      const t = angle - tilt;
      return ((a * b) / Math.hypot(b * Math.cos(t), a * Math.sin(t))) * n(5, 0.06);
    }
  }
}

/** Marks every island column as flat ground at BASE_TOP. Outlines are star-shaped, so connected. */
export function rasterIslands(t: Terrain, islands: readonly Island[], seed: number): void {
  for (const isl of islands) {
    t.islands.push(isl);
    const e = Math.ceil(isl.extent) + 1;
    for (let z = isl.cz - e; z <= isl.cz + e; z++) {
      for (let x = isl.cx - e; x <= isl.cx + e; x++) {
        if (x < 0 || z < 0 || x >= t.sx || z >= t.sz) continue;
        const dx = x - isl.cx;
        const dz = z - isl.cz;
        const d = Math.hypot(dx, dz);
        if (d > Math.min(isl.extent, radiusAt(isl, Math.atan2(dz, dx), seed))) continue;
        const i = x + z * t.sx;
        t.height[i] = BASE_TOP;
        t.island[i] = isl.id;
      }
    }
  }
}

import type { BlockKey } from '../../core/types';
import type { Writer } from './fill';
import type { Rng } from './noise';
import type { ExplorePalette } from './palette';
import { col, isInterior, type Island, type Terrain } from './terrain';

/** True when every column of the (2*half+1)^2 square is interior, free, unreserved and level. */
export function freeSquare(t: Terrain, x: number, z: number, half: number, level = true): boolean {
  const h = t.height[col(t, x, z)];
  for (let dz = -half; dz <= half; dz++) {
    for (let dx = -half; dx <= half; dx++) {
      const i = col(t, x + dx, z + dz);
      if (i < 0 || !isInterior(t, x + dx, z + dz) || t.used[i] || t.reserved[i]) return false;
      if (level && t.height[i] !== h) return false;
    }
  }
  return true;
}

export function markUsed(t: Terrain, x: number, z: number, half: number): void {
  for (let dz = -half; dz <= half; dz++) {
    for (let dx = -half; dx <= half; dx++) {
      const i = col(t, x + dx, z + dz);
      if (i >= 0) t.used[i] = 1;
    }
  }
}

/** A random interior column of an island (or null after a few misses). */
function randomSpot(rng: Rng, t: Terrain, isl: Island, half: number, level: boolean): [number, number] | null {
  for (let tries = 0; tries < 30; tries++) {
    const a = rng.range(0, Math.PI * 2);
    const d = rng.range(0, isl.radius);
    const x = Math.round(isl.cx + Math.cos(a) * d);
    const z = Math.round(isl.cz + Math.sin(a) * d);
    if (col(t, x, z) >= 0 && t.island[col(t, x, z)] === isl.id && freeSquare(t, x, z, half, level)) return [x, z];
  }
  return null;
}

function tree(t: Terrain, w: Writer, palette: ExplorePalette, x: number, z: number, rng: Rng): void {
  const kind = palette.tree;
  if (!kind) return;
  const h = t.height[col(t, x, z)];
  // Leaves start 4 above the ground so a character on a neighbouring (+1) column still fits.
  const trunk = kind.tall ? rng.int(5, 6) : 4;
  for (let y = 1; y <= trunk; y++) w.seed({ x, y: h + y, z }, kind.trunk);
  const crown = h + trunk;
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dz === 0) continue;
      w.seed({ x: x + dx, y: crown, z: z + dz }, kind.leaves);
      if (!kind.tall || Math.abs(dx) + Math.abs(dz) === 1) w.seed({ x: x + dx, y: crown + 1, z: z + dz }, kind.leaves);
    }
  }
  w.seed({ x, y: crown + 1, z }, kind.leaves);
  w.seed({ x, y: crown + 2, z }, kind.cap ?? kind.leaves);
  markUsed(t, x, z, 1);
}

function rock(t: Terrain, w: Writer, block: BlockKey, x: number, z: number, rng: Rng): void {
  const h = t.height[col(t, x, z)];
  w.seed({ x, y: h + 1, z }, block);
  if (rng.chance(0.4)) w.seed({ x, y: h + 2, z }, block);
  const [dx, dz] = rng.pick([[1, 0], [0, 1], [-1, 0], [0, -1]] as const);
  if (rng.chance(0.6) && t.height[col(t, x + dx, z + dz)] === h) w.seed({ x: x + dx, y: h + 1, z: z + dz }, block);
  markUsed(t, x, z, 1);
}

function patch(t: Terrain, block: BlockKey, x: number, z: number, radius: number): void {
  for (let dz = -radius; dz <= radius; dz++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const i = col(t, x + dx, z + dz);
      if (i < 0 || t.island[i] < 0 || dx * dx + dz * dz > radius * radius + 1) continue;
      t.surface[i] = block;
    }
  }
}

function islandArea(t: Terrain, isl: Island): number {
  let n = 0;
  for (let i = 0; i < t.island.length; i++) if (t.island[i] === isl.id) n++;
  return n;
}

/** Flower / ice patches change only the top block, so they must run before fillGround. */
export function paintPatches(t: Terrain, rng: Rng, palette: ExplorePalette): void {
  if (palette.patches.length === 0) return;
  for (const isl of t.islands) {
    const count = Math.max(1, Math.round(islandArea(t, isl) / 110));
    for (let k = 0; k < count; k++) {
      const spot = randomSpot(rng, t, isl, 0, false);
      if (spot) patch(t, rng.pick(palette.patches), spot[0], spot[1], rng.int(1, 2));
    }
  }
}

/** Trees, rocks, props and (space) little star lights, sized to each island's area. */
export function scatterDecor(t: Terrain, w: Writer, rng: Rng, palette: ExplorePalette): void {
  for (const isl of t.islands) {
    const area = islandArea(t, isl);
    const trees = palette.tree ? Math.round(area / 50) : 0;
    const rocks = Math.round(area / (palette.tree ? 110 : 60));
    const props = palette.props.length > 0 ? Math.round(area / 150) : 0;
    for (let k = 0; k < trees; k++) {
      const s = randomSpot(rng, t, isl, 1, false);
      if (s) tree(t, w, palette, s[0], s[1], rng);
    }
    for (let k = 0; k < rocks; k++) {
      const s = randomSpot(rng, t, isl, 1, false);
      if (s) rock(t, w, palette.rock, s[0], s[1], rng);
    }
    for (let k = 0; k < props; k++) {
      const s = randomSpot(rng, t, isl, 0, true);
      if (!s) continue;
      w.seed({ x: s[0], y: t.height[col(t, s[0], s[1])] + 1, z: s[1] }, rng.pick(palette.props));
      markUsed(t, s[0], s[1], 0);
    }
    if (!palette.tree) {
      const lights = Math.max(1, Math.round(area / 200));
      for (let k = 0; k < lights; k++) {
        const s = randomSpot(rng, t, isl, 1, true);
        if (!s) continue;
        const h = t.height[col(t, s[0], s[1])];
        w.seed({ x: s[0], y: h + 1, z: s[1] }, palette.rock);
        w.seed({ x: s[0], y: h + 2, z: s[1] }, palette.light);
        markUsed(t, s[0], s[1], 1);
      }
    }
  }
}

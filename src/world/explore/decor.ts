import type { BlockKey } from '../../core/types';
import type { Writer } from './fill';
import type { Rng } from './noise';
import type { ExplorePalette } from './palette';
import { CANOPY_REACH, planBush, planFlowers, planTree, writePlan, type FloraPalette } from './flora';
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

/** Plants one toy tree near (x, z); false when it did not fit there. */
function tree(t: Terrain, w: Writer, flora: FloraPalette, x: number, z: number, rng: Rng, maxY: number): boolean {
  const plan = planTree(t, w, flora, rng.pick(flora.kinds), x, z, rng, maxY);
  if (!plan) return false;
  writePlan(w, plan);
  markUsed(t, x, z, CANOPY_REACH);
  return true;
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

/** Toy trees, bushes, flower clusters, rocks, props and (space) little star lights, sized to each island's area. */
export function scatterDecor(t: Terrain, w: Writer, rng: Rng, palette: ExplorePalette, maxY = 31): void {
  const flora = palette.flora;
  for (const isl of t.islands) {
    const area = islandArea(t, isl);
    const rocks = Math.round(area / (flora ? 130 : 60));
    const props = palette.props.length > 0 ? Math.round(area / 150) : 0;
    if (flora) plantFlora(t, w, rng, flora, isl, area, maxY);
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
    if (!flora) {
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

/** Trees first (they need the most room), then bushes and flower clusters in the gaps. */
function plantFlora(t: Terrain, w: Writer, rng: Rng, flora: FloraPalette, isl: Island, area: number, maxY: number): void {
  const trees = Math.round(area / 55);
  for (let k = 0; k < trees; k++) {
    const s = randomSpot(rng, t, isl, CANOPY_REACH, false);
    if (s) tree(t, w, flora, s[0], s[1], rng, maxY);
  }
  const bushes = Math.round(area / 110);
  for (let k = 0; k < bushes; k++) {
    const s = randomSpot(rng, t, isl, 1, true);
    if (!s) continue;
    writePlan(w, planBush(t, flora, s[0], s[1], rng));
    markUsed(t, s[0], s[1], 1);
  }
  const clusters = Math.round(area / 140);
  for (let k = 0; k < clusters; k++) {
    const s = randomSpot(rng, t, isl, 1, true);
    if (!s) continue;
    writePlan(w, planFlowers(t, flora, s[0], s[1], rng));
    markUsed(t, s[0], s[1], 1);
  }
}

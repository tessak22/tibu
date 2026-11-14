import type { Cell, WorldModel } from '../../core/types';
import { reachableKeys, standable, walkKey } from '../walk';
import type { Discovery } from './discovery';
import type { Rng } from './noise';
import { BASE_TOP, col, type Terrain } from './terrain';

type World = Pick<WorldModel, 'get' | 'inBounds' | 'size'>;

const CHEST_SPACING = [9, 6, 3, 0];
const ANIMAL_SPACING = [7, 4, 0];
/** Chests are never right next to the spawn: finding them is the fun. */
const CHEST_MIN_FROM_SPAWN = 7;
const ANIMAL_MIN_FROM_SPAWN = 3;

const flatDist = (a: Cell, b: Cell): number => Math.hypot(a.x - b.x, a.z - b.z);
const solid = (w: World, x: number, y: number, z: number): boolean => w.get({ x, y, z }) !== null;

/** Spawn: standing on the main island center, or the nearest standable cell around it. */
export function findSpawn(t: Terrain, w: World): Cell {
  const main = t.islands[0];
  for (let r = 0; r < 12; r++) {
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const i = col(t, main.cx + dx, main.cz + dz);
        if (i < 0 || t.island[i] !== main.id) continue;
        const c = { x: main.cx + dx, y: t.height[i] + 1, z: main.cz + dz };
        if (standable(w, c)) return c;
      }
    }
  }
  return { x: main.cx, y: BASE_TOP + 1, z: main.cz };
}

/** How tucked-away a cell is: walls/trunks beside it, a roof or leaves above, or a hilltop. */
function hiddenness(w: World, c: Cell): number {
  let score = 0;
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    if (solid(w, c.x + dx, c.y, c.z + dz)) score += 1;
  }
  for (let y = c.y + 2; y <= c.y + 5; y++) {
    if (solid(w, c.x, y, c.z)) {
      score += 2;
      break;
    }
  }
  if (c.y >= BASE_TOP + 3) score += 2;
  return score;
}

function isOpen(w: World, c: Cell): boolean {
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    if (solid(w, c.x + dx, c.y, c.z + dz) || solid(w, c.x + dx, c.y + 1, c.z + dz)) return false;
  }
  return true;
}

function islandOf(t: Terrain, c: Cell): number {
  const i = col(t, c.x, c.z);
  return i < 0 ? -1 : t.island[i];
}

/** Greedy spread: take candidates in order while they keep `spacing` from what is taken. */
function spread(cands: readonly Cell[], taken: Cell[], want: number, spacings: readonly number[], avoid: readonly Cell[]): void {
  for (const spacing of spacings) {
    for (const c of cands) {
      if (taken.length >= want) return;
      if (taken.some((o) => flatDist(o, c) < Math.max(spacing, 1))) continue;
      if (avoid.some((o) => flatDist(o, c) < 1)) continue;
      taken.push(c);
    }
  }
}

export interface Spots {
  readonly spawn: Cell;
  readonly chestSpots: Cell[];
  readonly animalSpots: Cell[];
}

/**
 * Picks chest and animal spots among cells reachable on foot from the spawn, so every spot is
 * guaranteed reachable. Chests: discovery builds first, then one per island, then the most
 * tucked-away places, kept spread out. Animals: open cells spread across islands.
 */
export function pickSpots(t: Terrain, w: World, rng: Rng, discoveries: readonly Discovery[]): Spots {
  const spawn = findSpawn(t, w);
  const reach = reachableKeys(w, spawn);
  const isReach = (c: Cell): boolean => reach.has(walkKey(w, c));
  const cells: Cell[] = [];
  const layer = w.size.x * w.size.z;
  for (const k of [...reach].sort((a, b) => a - b)) {
    const y = Math.floor(k / layer);
    const rest = k - y * layer;
    cells.push({ x: rest % w.size.x, y, z: Math.floor(rest / w.size.x) });
  }

  const chestWant = rng.int(8, 12);
  const chests: Cell[] = discoveries.map((d) => d.chest).filter(isReach);
  const chestCands = rng
    .shuffle(cells.filter((c) => flatDist(c, spawn) >= CHEST_MIN_FROM_SPAWN))
    .map((c) => ({ c, s: hiddenness(w, c) }))
    .sort((a, b) => b.s - a.s)
    .map((e) => e.c);
  for (const isl of t.islands.slice(1)) {
    if (chests.some((c) => islandOf(t, c) === isl.id)) continue;
    spread(chestCands.filter((c) => islandOf(t, c) === isl.id), chests, chests.length + 1, CHEST_SPACING, [spawn]);
  }
  spread(chestCands, chests, chestWant, CHEST_SPACING, [spawn]);

  const animalWant = rng.int(6, 10);
  const animals: Cell[] = [];
  const animalCands = rng.shuffle(
    cells.filter((c) => isOpen(w, c) && flatDist(c, spawn) >= ANIMAL_MIN_FROM_SPAWN && islandOf(t, c) >= 0),
  );
  for (const isl of t.islands) {
    spread(animalCands.filter((c) => islandOf(t, c) === isl.id), animals, animals.length + 1, ANIMAL_SPACING, [
      spawn,
      ...chests,
    ]);
  }
  spread(animalCands, animals, animalWant, ANIMAL_SPACING, [spawn, ...chests]);

  return { spawn, chestSpots: chests.slice(0, 12), animalSpots: animals };
}

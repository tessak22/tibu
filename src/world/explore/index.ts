import { BIG_WORLD_SIZE, type Cell, type ThemeDef, type WorldModel } from '../../core/types';
import { createSeedableWorld } from '../worldModel';
import { buildBridges } from './bridges';
import { paintPatches, scatterDecor } from './decor';
import { buildDiscoveries, planDiscoveries, type Discovery } from './discovery';
import { fillGround, type Writer } from './fill';
import { layoutIslands, rasterIslands } from './islands';
import { createRng } from './noise';
import { explorePalette } from './palette';
import { SPAWN_CLEAR_RADIUS, shapeRelief } from './relief';
import { pickSpots } from './spots';
import { col, createTerrain, type Terrain } from './terrain';

export interface ExploreWorld {
  readonly world: WorldModel;
  /** Empty cell the character stands in at the start. */
  readonly spawn: Cell;
  /** 8 to 12 empty, standable cells reachable from spawn (chest goes in the cell). */
  readonly chestSpots: Cell[];
  /** Open standable cells reachable from spawn, spread across islands. */
  readonly animalSpots: Cell[];
  /** Pre-built discovery builds (hut, tower, garden) and the chest spot each one offers. */
  readonly discoveries: readonly Discovery[];
}

/** Keeps a flat, decor-free circle around the spawn for building. */
function reserveSpawnArea(t: Terrain): void {
  const main = t.islands[0];
  const r = SPAWN_CLEAR_RADIUS;
  for (let dz = -r; dz <= r; dz++) {
    for (let dx = -r; dx <= r; dx++) {
      const i = col(t, main.cx + dx, main.cz + dz);
      if (i >= 0 && dx * dx + dz * dz <= r * r) t.reserved[i] = 1;
    }
  }
}

/**
 * Generates a big-kid explore world (BIG_WORLD_SIZE): 4 to 6 floating islands joined by safe
 * 3-wide bridges, gentle hills (snowy hills / moon craters by theme), trees, rocks, flower
 * patches and three discovery builds (hut, tower, garden). Deterministic per seed.
 * Every step between neighbouring ground columns is at most 1 block and nothing has holes;
 * all returned spots are reachable on foot from the spawn (see walk.ts).
 */
export function createExploreWorld(theme: ThemeDef, seed: number): ExploreWorld {
  const s = Number.isFinite(seed) ? Math.trunc(seed) >>> 0 : 0;
  const rng = createRng(s);
  const palette = explorePalette(theme);
  const { model, seed: write } = createSeedableWorld(theme.id, { size: BIG_WORLD_SIZE, kind: 'explore', seed: s });
  const writer: Writer = { seed: write, get: model.get };
  const t = createTerrain(BIG_WORLD_SIZE);

  rasterIslands(t, layoutIslands(rng, BIG_WORLD_SIZE), s);
  reserveSpawnArea(t);
  buildBridges(t, rng, palette);
  const main = t.islands[0];
  const sites = planDiscoveries(t, rng);
  shapeRelief(t, rng, palette, { x: main.cx, z: main.cz }, sites);
  paintPatches(t, rng, palette);
  fillGround(t, writer, palette);
  const discoveries = buildDiscoveries(t, writer, rng, palette, sites);
  scatterDecor(t, writer, rng, palette, BIG_WORLD_SIZE.y - 1);
  const spots = pickSpots(t, model, rng, discoveries);
  return { world: model, ...spots, discoveries };
}

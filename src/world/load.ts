import type { SavedWorld, ThemeDef, WorldModel } from '../core/types';
import { SIZE_X, SIZE_Y, SIZE_Z, inBoundsXYZ } from './grid';
import { islandMask } from './island';
import { validateSavedWorld } from './serialize';
import { createSeedableWorld } from './worldModel';

/**
 * Rebuilds a world from saved data. Validates first; malformed, out-of-bounds or duplicate
 * entries are skipped. Never throws: completely invalid data yields an empty world.
 * The loaded state is not undoable.
 */
export function deserializeWorld(data: SavedWorld): WorldModel {
  const clean = validateSavedWorld(data);
  if (!clean) {
    const fallbackTheme = typeof data?.themeId === 'string' ? data.themeId : '';
    return createSeedableWorld(fallbackTheme).model;
  }
  const { model, seed } = createSeedableWorld(clean.themeId);
  for (const [x, y, z, paletteIndex] of clean.blocks) {
    if (!inBoundsXYZ(x, y, z)) continue;
    const c = { x, y, z };
    if (model.get(c) !== null) continue;
    seed(c, clean.palette[paletteIndex]);
  }
  return model;
}

/**
 * Builds a new world for a theme: ground layers (listed top-down) fill y = 0..n-1 across the
 * island footprint, then the starting scene is added (scene blocks may replace ground).
 * None of this is undoable.
 */
export function createWorldFromTheme(theme: ThemeDef): WorldModel {
  const { model, seed } = createSeedableWorld(theme.id);
  const ground = Array.isArray(theme.ground) ? theme.ground.slice(0, SIZE_Y) : [];
  const mask = islandMask(theme.island?.shape ?? 'round');
  ground.forEach((block, depthFromTop) => {
    const y = ground.length - 1 - depthFromTop;
    for (let z = 0; z < SIZE_Z; z++) {
      for (let x = 0; x < SIZE_X; x++) {
        if (mask[x + z * SIZE_X] === 1) seed({ x, y, z }, block);
      }
    }
  });
  for (const entry of Array.isArray(theme.scene) ? theme.scene : []) {
    if (entry && typeof entry.block === 'string') seed({ x: entry.x, y: entry.y, z: entry.z }, entry.block);
  }
  return model;
}

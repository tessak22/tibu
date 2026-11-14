import { WORLD_SIZE, type SavedWorld, type ThemeDef, type WorldModel } from '../core/types';
import { SIZE_X, SIZE_Y, SIZE_Z } from './grid';
import { islandMask } from './island';
import { validateSavedWorld } from './serialize';
import { createSeedableWorld } from './worldModel';

/**
 * Rebuilds a world from saved data (v1 or v2). Validates first; malformed, out-of-bounds or
 * duplicate entries are skipped. Never throws: completely invalid data yields an empty
 * 24x16x24 world. v1 saves load as a 24x16x24 'island'. The loaded state is not undoable.
 */
export function deserializeWorld(data: SavedWorld): WorldModel {
  const clean = validateSavedWorld(data);
  if (!clean) {
    const fallbackTheme = typeof data?.themeId === 'string' ? data.themeId.slice(0, 100) : '';
    return createSeedableWorld(fallbackTheme).model;
  }
  const { model, seed } = createSeedableWorld(clean.themeId, {
    size: clean.size ?? WORLD_SIZE,
    kind: clean.kind ?? 'island',
    seed: clean.seed,
  });
  for (const [x, y, z, paletteIndex, rot] of clean.blocks) {
    const c = { x, y, z };
    if (!model.inBounds(c) || model.get(c) !== null) continue;
    seed(c, clean.palette[paletteIndex], rot === 1 || rot === 2 || rot === 3 ? rot : 0);
  }
  for (const entity of clean.entities ?? []) model.setEntity(entity);
  return model;
}

/**
 * Builds a new little-builder world for a theme: ground layers (listed top-down) fill
 * y = 0..n-1 across the island footprint, then the starting scene is added (scene blocks may
 * replace ground). None of this is undoable.
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

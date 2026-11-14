import type { Cell, Profile, SavedWorld, ThemeDef, WorldModel } from '../core/types';
import type { WorldKind } from '../ui/theme-picker';

/** What createExploreWorld returns (src/world). */
export interface ExploreWorldResult {
  readonly world: WorldModel;
  readonly spawn: Cell;
  readonly chestSpots: readonly Cell[];
  readonly animalSpots: readonly Cell[];
}

/** World construction the app needs; injected so the app stays testable. */
export interface WorldFactory {
  createWorldFromTheme(theme: ThemeDef): WorldModel;
  deserializeWorld(data: SavedWorld): WorldModel;
  createExploreWorld(theme: ThemeDef, seed: number): ExploreWorldResult;
  /** Puts closed chests (one sticker each) on the given spots. */
  placeChests(world: WorldModel, spots: readonly Cell[], stickerIds: readonly string[], seed: number): unknown;
}

/** Where the character starts and where animals roam in an explore world. */
export interface ExploreSetup {
  readonly spawn: Cell;
  readonly animalSpots: readonly Cell[];
}

export interface NewWorld {
  readonly world: WorldModel;
  readonly explore: ExploreSetup | null;
}

const MAX_SEED = 0x7fffffff;

export function randomSeed(rand: () => number = Math.random): number {
  return 1 + Math.floor(rand() * (MAX_SEED - 1));
}

/** Stickers this child has not found yet (all of them once every one is found). */
export function stickersToHide(allIds: readonly string[], profile: Pick<Profile, 'stickers'>): readonly string[] {
  const found = new Set(profile.stickers ?? []);
  return allIds.filter((id) => !found.has(id));
}

export function createNewWorld(
  factory: WorldFactory,
  theme: ThemeDef,
  kind: WorldKind,
  hideStickers: readonly string[],
  seed: number = randomSeed(),
): NewWorld {
  if (kind === 'island') return { world: factory.createWorldFromTheme(theme), explore: null };
  const made = factory.createExploreWorld(theme, seed);
  factory.placeChests(made.world, made.chestSpots, hideStickers, seed);
  return { world: made.world, explore: { spawn: made.spawn, animalSpots: made.animalSpots } };
}

/** Lowest empty cell above the highest solid block in a column, or null when the column is empty. */
export function standCell(world: Pick<WorldModel, 'get' | 'size'>, x: number, z: number): Cell | null {
  for (let y = world.size.y - 1; y >= 0; y--) {
    if (world.get({ x, y, z }) !== null) return y + 1 < world.size.y ? { x, y: y + 1, z } : null;
  }
  return null;
}

/** A standing spot near the middle of the world (spiral search outward). */
export function centerStandCell(world: Pick<WorldModel, 'get' | 'size'>): Cell {
  const cx = Math.floor(world.size.x / 2);
  const cz = Math.floor(world.size.z / 2);
  const maxR = Math.max(world.size.x, world.size.z) / 2;
  for (let r = 0; r <= maxR; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const cell = standCell(world, cx + dx, cz + dz);
        if (cell) return cell;
      }
    }
  }
  return { x: cx, y: 1, z: cz };
}

/**
 * Reopening a saved explore world: spawn and animal spots are not saved, so regenerate them
 * from the same seed (the terrain generator is deterministic). Falls back to the middle.
 */
export function exploreSetupFor(factory: WorldFactory, world: WorldModel, theme: ThemeDef, seed: number | undefined): ExploreSetup {
  if (typeof seed === 'number') {
    try {
      const made = factory.createExploreWorld(theme, seed);
      const spawn = world.get(made.spawn) === null ? made.spawn : centerStandCell(world);
      return { spawn, animalSpots: made.animalSpots };
    } catch {
      // Fall through to a plain spawn: walking still works, just without roaming animals.
    }
  }
  return { spawn: centerStandCell(world), animalSpots: [] };
}

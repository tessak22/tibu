import type { Cell, Profile, SavedExploreState, SavedWorld, ThemeDef, WorldModel, WorldRecord } from '../core/types';
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
  /** The cleaned data, or null when it does not validate (corrupt, or made by a newer version). */
  validateSavedWorld(data: unknown): SavedWorld | null;
  createExploreWorld(theme: ThemeDef, seed: number): ExploreWorldResult;
  /** Puts closed chests (one sticker each) on the given spots. */
  placeChests(world: WorldModel, spots: readonly Cell[], stickerIds: readonly string[], seed: number): unknown;
}

/** Where the character starts and where animals roam in an explore world. */
export interface ExploreSetup {
  /** Where the character appears now (the last cell it stood on when reopening). */
  readonly spawn: Cell;
  readonly animalSpots: readonly Cell[];
  /** The world's original spawn, kept for saving when `spawn` is the last cell. */
  readonly home?: Cell;
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

/** True when a stored record's data validates. Invalid records are never opened (or autosaved over). */
export function canOpenRecord(factory: Pick<WorldFactory, 'validateSavedWorld'>, record: Pick<WorldRecord, 'data'>): boolean {
  try {
    return factory.validateSavedWorld(record.data) !== null;
  } catch {
    return false;
  }
}

const MAX_ANIMAL_SPOTS = 256;

function isCellIn(world: Pick<WorldModel, 'inBounds'>, value: unknown): value is Cell {
  if (typeof value !== 'object' || value === null) return false;
  const { x, y, z } = value as Record<string, unknown>;
  return (
    Number.isInteger(x) && Number.isInteger(y) && Number.isInteger(z) &&
    world.inBounds({ x: x as number, y: y as number, z: z as number })
  );
}

const plainCell = (c: Cell): Cell => ({ x: c.x, y: c.y, z: c.z });

/** An empty cell with something solid under it: the character can stand there. */
export function canStandAt(world: Pick<WorldModel, 'get' | 'inBounds'>, cell: Cell): boolean {
  const below = { x: cell.x, y: cell.y - 1, z: cell.z };
  return world.inBounds(cell) && world.get(cell) === null && world.inBounds(below) && world.get(below) !== null;
}

/** Stored explore state from a record, checked against the world (never trust stored data). */
export function readExploreState(world: Pick<WorldModel, 'inBounds'>, raw: unknown): SavedExploreState | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { spawn, animalSpots, lastCell } = raw as Record<string, unknown>;
  if (!isCellIn(world, spawn) || !Array.isArray(animalSpots)) return null;
  const spots = animalSpots.slice(0, MAX_ANIMAL_SPOTS).filter((c): c is Cell => isCellIn(world, c)).map(plainCell);
  return {
    spawn: plainCell(spawn),
    animalSpots: spots,
    ...(isCellIn(world, lastCell) ? { lastCell: plainCell(lastCell) } : {}),
  };
}

/**
 * Reopening an explore world: use the spawn and animal spots saved with the record, and put the
 * character back where the child left it. Old records without them regenerate from the seed.
 */
export function exploreSetupForRecord(
  factory: WorldFactory,
  world: WorldModel,
  theme: ThemeDef,
  record: Pick<WorldRecord, 'data' | 'explore'>,
): ExploreSetup {
  const saved = readExploreState(world, record.explore);
  if (!saved) return exploreSetupFor(factory, world, theme, record.data.seed);
  const spawn = [saved.lastCell, saved.spawn].find((c): c is Cell => c !== undefined && canStandAt(world, c));
  return { spawn: spawn ?? centerStandCell(world), animalSpots: saved.animalSpots, home: saved.spawn };
}

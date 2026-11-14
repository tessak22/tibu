import { BIG_WORLD_SIZE, WORLD_SIZE, type Cell, type Rotation, type WorldSize } from '../core/types';

/**
 * Grid dimensions of the little-builder island (WORLD_SIZE), as plain numbers for hot loops.
 * Kept for modules that only deal with the original 24x16x24 world. Size-aware code should use
 * the `*In(size, ...)` helpers below with `world.size`.
 */
export const SIZE_X = WORLD_SIZE.x;
export const SIZE_Y = WORLD_SIZE.y;
export const SIZE_Z = WORLD_SIZE.z;
export const VOLUME = SIZE_X * SIZE_Y * SIZE_Z;

/**
 * The island floor. Blocks on this layer cannot be removed with `remove` or `smash`
 * (see worldModel.ts) so the island never gets holes.
 */
export const FLOOR_Y = 0;

/** Maximum number of undoable actions kept. A collapse batch counts as one. */
export const UNDO_LIMIT = 50;

/** The only world sizes a world may have. Saved data with any other size is rejected. */
export const ALLOWED_SIZES: readonly WorldSize[] = [WORLD_SIZE, BIG_WORLD_SIZE];

export function sameSize(a: WorldSize, b: WorldSize): boolean {
  return a.x === b.x && a.y === b.y && a.z === b.z;
}

/** Returns the canonical allowed size equal to `size`, or null when it is not allowed. */
export function allowedSize(size: unknown): WorldSize | null {
  if (typeof size !== 'object' || size === null) return null;
  const s = size as Record<string, unknown>;
  return ALLOWED_SIZES.find((a) => a.x === s.x && a.y === s.y && a.z === s.z) ?? null;
}

export function volumeOf(size: WorldSize): number {
  return size.x * size.y * size.z;
}

export function inBoundsIn(size: WorldSize, x: number, y: number, z: number): boolean {
  return (
    Number.isInteger(x) &&
    Number.isInteger(y) &&
    Number.isInteger(z) &&
    x >= 0 &&
    y >= 0 &&
    z >= 0 &&
    x < size.x &&
    y < size.y &&
    z < size.z
  );
}

/** Dense index for a sized grid. Caller guarantees the coordinate is in bounds. */
export function cellIndexIn(size: WorldSize, x: number, y: number, z: number): number {
  return x + z * size.x + y * size.x * size.z;
}

export function indexToCellIn(size: WorldSize, index: number): Cell {
  const layer = size.x * size.z;
  const y = Math.floor(index / layer);
  const rest = index - y * layer;
  const z = Math.floor(rest / size.x);
  return { x: rest - z * size.x, y, z };
}

/** WORLD_SIZE variants (original API). */
export function inBoundsXYZ(x: number, y: number, z: number): boolean {
  return inBoundsIn(WORLD_SIZE, x, y, z);
}

export function inBounds(cell: Cell): boolean {
  return inBoundsXYZ(cell.x, cell.y, cell.z);
}

export function cellIndex(x: number, y: number, z: number): number {
  return x + z * SIZE_X + y * SIZE_X * SIZE_Z;
}

export function indexToCell(index: number): Cell {
  return indexToCellIn(WORLD_SIZE, index);
}

export function cell(x: number, y: number, z: number): Cell {
  return { x, y, z };
}

export function sameCell(a: Cell, b: Cell): boolean {
  return a.x === b.x && a.y === b.y && a.z === b.z;
}

/** Coerces anything to a valid Rotation (unknown values become 0). */
export function toRotation(rot: unknown): Rotation {
  return rot === 1 || rot === 2 || rot === 3 ? rot : 0;
}

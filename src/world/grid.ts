import { WORLD_SIZE, type Cell } from '../core/types';

/** Grid dimensions, re-exported as plain numbers for hot loops. */
export const SIZE_X = WORLD_SIZE.x;
export const SIZE_Y = WORLD_SIZE.y;
export const SIZE_Z = WORLD_SIZE.z;
export const VOLUME = SIZE_X * SIZE_Y * SIZE_Z;

/**
 * The island floor. Blocks on this layer cannot be removed with `remove`
 * (see worldModel.ts) so the island never gets holes.
 */
export const FLOOR_Y = 0;

/** Maximum number of undoable actions kept. */
export const UNDO_LIMIT = 50;

export function inBoundsXYZ(x: number, y: number, z: number): boolean {
  return (
    Number.isInteger(x) &&
    Number.isInteger(y) &&
    Number.isInteger(z) &&
    x >= 0 &&
    y >= 0 &&
    z >= 0 &&
    x < SIZE_X &&
    y < SIZE_Y &&
    z < SIZE_Z
  );
}

export function inBounds(cell: Cell): boolean {
  return inBoundsXYZ(cell.x, cell.y, cell.z);
}

/** Dense index. Caller guarantees the coordinate is in bounds. */
export function cellIndex(x: number, y: number, z: number): number {
  return x + z * SIZE_X + y * SIZE_X * SIZE_Z;
}

export function indexToCell(index: number): Cell {
  const layer = SIZE_X * SIZE_Z;
  const y = Math.floor(index / layer);
  const rest = index - y * layer;
  const z = Math.floor(rest / SIZE_X);
  return { x: rest - z * SIZE_X, y, z };
}

export function cell(x: number, y: number, z: number): Cell {
  return { x, y, z };
}

export function sameCell(a: Cell, b: Cell): boolean {
  return a.x === b.x && a.y === b.y && a.z === b.z;
}

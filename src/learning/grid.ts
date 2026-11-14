import type { BlockKey, Cell, WorldModel } from '../core/types';

/** Looks up the block at integer coordinates (null when empty or out of bounds). */
export type BlockLookup = (x: number, y: number, z: number) => BlockKey | null;

export function lookupFromWorld(world: WorldModel): BlockLookup {
  return (x, y, z) => {
    const cell: Cell = { x, y, z };
    return world.inBounds(cell) ? world.get(cell) : null;
  };
}

/** Lookup over a plain map of cells (handy for tests and pure logic). */
export function lookupFromCells(cells: readonly { x: number; y: number; z: number; block: BlockKey }[]): BlockLookup {
  const map = new Map(cells.map((c) => [`${c.x},${c.y},${c.z}`, c.block] as const));
  return (x, y, z) => map.get(`${x},${y},${z}`) ?? null;
}

export const LETTERS_PACK = 'letters';

/** "letters:a" -> "A"; null for anything that is not a single-letter block. */
export function letterOf(key: BlockKey | null): string | null {
  if (!key) return null;
  const [pack, id] = key.split(':');
  if (pack !== LETTERS_PACK || !id || !/^[a-z]$/i.test(id)) return null;
  return id.toUpperCase();
}

export function packOf(key: BlockKey): string {
  return key.split(':')[0] ?? '';
}

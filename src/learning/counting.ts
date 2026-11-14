import { MAX_COUNT } from '../audio/lineIds';
import type { Cell } from '../core/types';
import type { BlockLookup } from './grid';

/**
 * Height of the vertical run of identical blocks that contains `cell`
 * (counting both below and above). Returns 0 when the cell is empty.
 */
export function columnHeight(get: BlockLookup, cell: Cell, max: number = MAX_COUNT): number {
  const block = get(cell.x, cell.y, cell.z);
  if (!block) return 0;
  let n = 1;
  for (let y = cell.y - 1; y >= 0 && get(cell.x, y, cell.z) === block; y--) n++;
  for (let y = cell.y + 1; y < cell.y + max && get(cell.x, y, cell.z) === block; y++) n++;
  return n;
}

/**
 * Number to count aloud after placing at `cell`, or null when there is no stack (height < 2).
 * `max` is 16 in little mode and 32 in big mode (big worlds are 32 tall).
 */
export function countToSay(get: BlockLookup, cell: Cell, max: number = MAX_COUNT): number | null {
  const h = columnHeight(get, cell, max);
  return h >= 2 ? Math.min(h, max) : null;
}

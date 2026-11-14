import type { Cell, WorldSize } from '../core/types';
import type { SolidTest, VoxelHit } from './voxelRaycast';

/** Like world/walk.ts: the character steps up at most one block. */
export const MAX_STEP_UP = 1;

const inGrid = (c: Cell, size: WorldSize): boolean =>
  c.x >= 0 && c.y >= 0 && c.z >= 0 && c.x < size.x && c.y < size.y && c.z < size.z;

/**
 * A cell the 2-cell-tall character can stand in (same rule as world/walk.ts): inside the grid,
 * above the floor layer, empty with headroom (open sky above the world top counts), solid below.
 */
export function isStandable(c: Cell, isSolid: SolidTest, size: WorldSize): boolean {
  if (!inGrid(c, size) || c.y < 1 || isSolid(c.x, c.y, c.z)) return false;
  const headroom = c.y + 1 >= size.y || !isSolid(c.x, c.y + 1, c.z);
  return headroom && isSolid(c.x, c.y - 1, c.z);
}

/** Lowers an empty cell until it rests on something (or the bottom of the world). */
function dropToGround(c: Cell, isSolid: SolidTest): Cell {
  let y = c.y;
  while (y > 0 && !isSolid(c.x, y - 1, c.z)) y -= 1;
  return { x: c.x, y, z: c.z };
}

/**
 * Walk mode: where a tap on a block sends the character.
 * - Top face: the empty cell right above the tapped block.
 * - Side (or bottom) face: the top of that column when it is standable and only one step up
 *   from the ground beside it; otherwise the empty cell next to the tapped face, lowered onto
 *   the ground below it (so tapping a tall wall walks up to the wall).
 * Returns null when there is nowhere sensible to go.
 */
export function walkTargetFor(hit: VoxelHit, isSolid: SolidTest, size: WorldSize): Cell | null {
  const { cell, normal } = hit;
  if (normal.y === 1) {
    const above = { x: cell.x, y: cell.y + 1, z: cell.z };
    return isStandable(above, isSolid, size) ? above : null;
  }
  let top = cell.y + 1;
  while (top < size.y && isSolid(cell.x, top, cell.z)) top += 1;
  const columnTop = { x: cell.x, y: top, z: cell.z };
  const topOk = isStandable(columnTop, isSolid, size);
  const side = { x: cell.x + normal.x, y: cell.y + normal.y, z: cell.z + normal.z };
  const besideOk = inGrid(side, size) && !isSolid(side.x, side.y, side.z);
  const landed = besideOk ? dropToGround(side, isSolid) : null;
  const landedOk = landed !== null && isStandable(landed, isSolid, size);
  if (topOk && (!landedOk || top - (landed as Cell).y <= MAX_STEP_UP)) return columnTop;
  return landedOk ? landed : null;
}

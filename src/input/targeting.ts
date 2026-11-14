import { WORLD_SIZE, type Cell, type Mode, type WorldSize } from '../core/types';
import { adjacentCell, raycastFloorPlane, raycastVoxels, type SolidTest, type Vec3Like } from './voxelRaycast';
import { walkTargetFor } from './walkTarget';

export type TapTarget =
  /** Build: put a block at `cell`; `tapped` is the block whose face was tapped (null for bare floor). */
  | { readonly kind: 'place'; readonly cell: Cell; readonly tapped: Cell | null }
  /** Build: a ghost (step-by-step preview) cell was tapped: put the block right there. */
  | { readonly kind: 'ghost'; readonly cell: Cell }
  /** Build: a block was tapped but there is no room next to that face (grid edge or ceiling). */
  | { readonly kind: 'touch'; readonly tapped: Cell }
  /** Smash: remove this block. */
  | { readonly kind: 'smash'; readonly cell: Cell }
  /** Walk: move the character to this empty cell; `tapped` is the block that was tapped. */
  | { readonly kind: 'walk'; readonly cell: Cell; readonly tapped: Cell };

export interface TargetQuery {
  readonly origin: Vec3Like;
  readonly dir: Vec3Like;
  readonly mode: Mode;
  readonly isSolid: SolidTest;
  /** When the world has no floor blocks at all, taps on the y=0 plane place blocks there. */
  readonly floorEmpty: boolean;
  /** Grid size; defaults to the little-builder island. */
  readonly size?: WorldSize;
  /** Ghost preview cells (build mode only). A ghost is a valid target even with no face behind it. */
  readonly isGhost?: SolidTest;
}

const inGrid = (c: Cell, size: WorldSize): boolean =>
  c.x >= 0 && c.y >= 0 && c.z >= 0 && c.x < size.x && c.y < size.y && c.z < size.z;

/**
 * Resolves what a tap at a screen ray would do. Pure: uses voxel traversal, not mesh raycasts.
 * Every occupied cell counts as a full cell (parts included), which is forgiving for small fingers.
 */
export function resolveTapTarget(q: TargetQuery): TapTarget | null {
  const size = q.size ?? WORLD_SIZE;
  if (q.mode === 'smash') {
    const hit = raycastVoxels(q.origin, q.dir, q.isSolid, { size });
    return hit ? { kind: 'smash', cell: hit.cell } : null;
  }
  if (q.mode === 'walk') {
    const hit = raycastVoxels(q.origin, q.dir, q.isSolid, { size });
    const cell = hit ? walkTargetFor(hit, q.isSolid, size) : null;
    return hit && cell ? { kind: 'walk', cell, tapped: hit.cell } : null;
  }
  return resolveBuild(q, size);
}

function resolveBuild(q: TargetQuery, size: WorldSize): TapTarget | null {
  const isGhost = q.isGhost;
  // Nearest of block or ghost wins: one traversal that stops at either.
  const test: SolidTest = isGhost ? (x, y, z) => q.isSolid(x, y, z) || isGhost(x, y, z) : q.isSolid;
  const hit = raycastVoxels(q.origin, q.dir, test, { size });
  if (hit && !q.isSolid(hit.cell.x, hit.cell.y, hit.cell.z)) return { kind: 'ghost', cell: hit.cell };
  if (hit) {
    const cell = adjacentCell(hit);
    if (inGrid(cell, size) && !q.isSolid(cell.x, cell.y, cell.z)) return { kind: 'place', cell, tapped: hit.cell };
    return { kind: 'touch', tapped: hit.cell };
  }
  if (!q.floorEmpty) return null;
  const floor = raycastFloorPlane(q.origin, q.dir, 0, size);
  return floor ? { kind: 'place', cell: floor, tapped: null } : null;
}

/** The cell to highlight for a target. */
export function highlightCell(target: TapTarget): Cell {
  switch (target.kind) {
    case 'touch':
      return target.tapped;
    default:
      return target.cell;
  }
}

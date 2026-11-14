import type { Cell, Mode } from '../core/types';
import { SIZE_X, SIZE_Y, SIZE_Z } from '../world/grid';
import { adjacentCell, raycastFloorPlane, raycastVoxels, type SolidTest, type Vec3Like } from './voxelRaycast';

export type TapTarget =
  /** Build: put a block at `cell`; `tapped` is the block whose face was tapped (null for bare floor). */
  | { readonly kind: 'place'; readonly cell: Cell; readonly tapped: Cell | null }
  /** Build: a block was tapped but there is no room next to that face (grid edge or ceiling). */
  | { readonly kind: 'touch'; readonly tapped: Cell }
  /** Smash: remove this block. */
  | { readonly kind: 'smash'; readonly cell: Cell };

export interface TargetQuery {
  readonly origin: Vec3Like;
  readonly dir: Vec3Like;
  readonly mode: Mode;
  readonly isSolid: SolidTest;
  /** When the world has no floor blocks at all, taps on the y=0 plane place blocks there. */
  readonly floorEmpty: boolean;
}

const inGrid = (c: Cell): boolean =>
  c.x >= 0 && c.y >= 0 && c.z >= 0 && c.x < SIZE_X && c.y < SIZE_Y && c.z < SIZE_Z;

/** Resolves what a tap at a screen ray would do. Pure: uses voxel traversal, not mesh raycasts. */
export function resolveTapTarget(q: TargetQuery): TapTarget | null {
  const hit = raycastVoxels(q.origin, q.dir, q.isSolid);
  if (q.mode === 'smash') return hit ? { kind: 'smash', cell: hit.cell } : null;
  if (hit) {
    const cell = adjacentCell(hit);
    if (inGrid(cell) && !q.isSolid(cell.x, cell.y, cell.z)) return { kind: 'place', cell, tapped: hit.cell };
    return { kind: 'touch', tapped: hit.cell };
  }
  if (!q.floorEmpty) return null;
  const floor = raycastFloorPlane(q.origin, q.dir, 0);
  return floor ? { kind: 'place', cell: floor, tapped: null } : null;
}

/** The cell to highlight for a target. */
export function highlightCell(target: TapTarget): Cell {
  return target.kind === 'place' ? target.cell : target.kind === 'touch' ? target.tapped : target.cell;
}

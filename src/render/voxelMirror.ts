import type { BlockKey, Cell, Rotation, WorldAction, WorldModel, WorldSize } from '../core/types';
import { RenderGrid } from './voxelGrid';

/** A single place/remove, after flattening batches. */
export type CellChange = Extract<WorldAction, { type: 'place' | 'remove' }>;

/** Flattens a (possibly nested) batch into plain place/remove changes, in order. */
export function flattenAction(action: WorldAction): CellChange[] {
  if (action.type !== 'batch') return [action];
  return action.actions.flatMap(flattenAction);
}

/**
 * The renderer's dense copy of a WorldModel, kept in sync through onChange. Works with any
 * WorldModel implementation and any world size; gives meshing/raycasting fast integer lookups.
 */
export class VoxelMirror {
  readonly grid = new RenderGrid();
  private floorCount = 0;

  get size(): WorldSize {
    return this.grid.size;
  }

  load(world: WorldModel): void {
    this.grid.reset(world.size);
    this.floorCount = 0;
    for (const [c, key] of world.entries()) this.write(c, key, safeRotation(world, c));
  }

  /** Applies a change (batches included) and returns the flattened cell changes. */
  apply(change: WorldAction): CellChange[] {
    const flat = flattenAction(change);
    for (const c of flat) this.write(c.cell, c.type === 'place' ? c.block : null, c.rot ?? 0);
    return flat;
  }

  get(c: Cell): BlockKey | null {
    return this.grid.get(c.x, c.y, c.z);
  }

  rotation(c: Cell): Rotation {
    return this.grid.rotAt(c.x, c.y, c.z);
  }

  isSolid(x: number, y: number, z: number): boolean {
    return this.grid.idAt(x, y, z) !== 0;
  }

  /** True when the bottom layer has no blocks at all (an empty, island-less world). */
  floorEmpty(): boolean {
    return this.floorCount === 0;
  }

  /** 1 for every (x, z) column with a block on the floor layer. Index = x + z * size.x. */
  floorMask(): Uint8Array {
    const { x: sx, z: sz } = this.size;
    const mask = new Uint8Array(sx * sz);
    for (let z = 0; z < sz; z++) for (let x = 0; x < sx; x++) mask[x + z * sx] = this.isSolid(x, 0, z) ? 1 : 0;
    return mask;
  }

  private write(c: Cell, key: BlockKey | null, rot: Rotation): void {
    const before = this.grid.get(c.x, c.y, c.z);
    if (!this.grid.set(c.x, c.y, c.z, key, rot) || c.y !== 0) return;
    if (before === null && key !== null) this.floorCount += 1;
    if (before !== null && key === null) this.floorCount -= 1;
  }
}

/** Tolerates world models that predate rotations. */
function safeRotation(world: WorldModel, c: Cell): Rotation {
  return typeof world.getRotation === 'function' ? world.getRotation(c) : 0;
}

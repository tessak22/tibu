import type { BlockKey, Cell, WorldAction, WorldModel } from '../core/types';
import { DenseGrid } from '../world/denseGrid';

/**
 * The renderer's dense copy of a WorldModel, kept in sync through onChange. Works with any
 * WorldModel implementation and gives meshing/raycasting fast integer lookups.
 */
export class VoxelMirror {
  readonly grid = new DenseGrid();
  private floorCount = 0;

  load(world: WorldModel): void {
    this.grid.clear();
    this.floorCount = 0;
    for (const [c, key] of world.entries()) this.write(c, key);
  }

  apply(change: WorldAction): void {
    this.write(change.cell, change.type === 'place' ? change.block : null);
  }

  get(c: Cell): BlockKey | null {
    return this.grid.get(c.x, c.y, c.z);
  }

  isSolid(x: number, y: number, z: number): boolean {
    return this.grid.idAt(x, y, z) !== 0;
  }

  /** True when the bottom layer has no blocks at all (an empty, island-less world). */
  floorEmpty(): boolean {
    return this.floorCount === 0;
  }

  private write(c: Cell, key: BlockKey | null): void {
    const before = this.grid.get(c.x, c.y, c.z);
    if (!this.grid.set(c.x, c.y, c.z, key) || c.y !== 0) return;
    if (before === null && key !== null) this.floorCount += 1;
    if (before !== null && key === null) this.floorCount -= 1;
  }
}

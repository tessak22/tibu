import type { BlockKey, Cell } from '../core/types';
import { VOLUME, cellIndex, inBoundsXYZ, indexToCell } from './grid';

/**
 * Dense voxel storage: one Uint16 per cell holding a palette id (0 = empty).
 * Internal, mutable building block used by the world model and the renderer's mirror.
 */
export class DenseGrid {
  private readonly ids = new Uint16Array(VOLUME);
  private readonly palette: BlockKey[] = [''];
  private readonly paletteIds = new Map<BlockKey, number>();
  private occupied = 0;

  /** Palette id at a coordinate; 0 for empty or out of bounds. */
  idAt(x: number, y: number, z: number): number {
    return inBoundsXYZ(x, y, z) ? this.ids[cellIndex(x, y, z)] : 0;
  }

  /** Faster variant for callers that already checked bounds. */
  idAtIndex(index: number): number {
    return this.ids[index];
  }

  keyOf(id: number): BlockKey | null {
    return id > 0 ? (this.palette[id] ?? null) : null;
  }

  get(x: number, y: number, z: number): BlockKey | null {
    return this.keyOf(this.idAt(x, y, z));
  }

  /** Sets or clears a cell. Out-of-bounds writes are ignored and return false. */
  set(x: number, y: number, z: number, key: BlockKey | null): boolean {
    if (!inBoundsXYZ(x, y, z)) return false;
    const index = cellIndex(x, y, z);
    const before = this.ids[index];
    const after = key === null ? 0 : this.intern(key);
    if (before === after) return true;
    if (before === 0) this.occupied += 1;
    if (after === 0) this.occupied -= 1;
    this.ids[index] = after;
    return true;
  }

  count(): number {
    return this.occupied;
  }

  clear(): void {
    this.ids.fill(0);
    this.occupied = 0;
  }

  *entries(): Generator<readonly [Cell, BlockKey]> {
    for (let i = 0; i < VOLUME; i++) {
      const id = this.ids[i];
      if (id !== 0) yield [indexToCell(i), this.palette[id]] as const;
    }
  }

  private intern(key: BlockKey): number {
    const existing = this.paletteIds.get(key);
    if (existing !== undefined) return existing;
    if (this.palette.length >= 0xffff) throw new Error('DenseGrid palette is full');
    const id = this.palette.length;
    this.palette.push(key);
    this.paletteIds.set(key, id);
    return id;
  }
}

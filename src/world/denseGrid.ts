import { WORLD_SIZE, type BlockKey, type Cell, type Rotation, type WorldSize } from '../core/types';
import { cellIndexIn, inBoundsIn, indexToCellIn, toRotation, volumeOf } from './grid';

/**
 * Dense voxel storage: one Uint16 per cell holding a palette id (0 = empty) plus one rotation
 * byte per cell. Internal, mutable building block used by the world model and the renderer's
 * mirror. Defaults to the little-builder WORLD_SIZE.
 */
export class DenseGrid {
  readonly size: WorldSize;
  private readonly ids: Uint16Array;
  private readonly rots: Uint8Array;
  private readonly palette: BlockKey[] = [''];
  private readonly paletteIds = new Map<BlockKey, number>();
  private occupied = 0;

  constructor(size: WorldSize = WORLD_SIZE) {
    this.size = size;
    const volume = volumeOf(size);
    this.ids = new Uint16Array(volume);
    this.rots = new Uint8Array(volume);
  }

  inBounds(x: number, y: number, z: number): boolean {
    return inBoundsIn(this.size, x, y, z);
  }

  /** Dense index; caller guarantees bounds. */
  index(x: number, y: number, z: number): number {
    return cellIndexIn(this.size, x, y, z);
  }

  /** Palette id at a coordinate; 0 for empty or out of bounds. */
  idAt(x: number, y: number, z: number): number {
    return this.inBounds(x, y, z) ? this.ids[this.index(x, y, z)] : 0;
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

  /** Rotation at a coordinate; 0 when empty or out of bounds. */
  rotAt(x: number, y: number, z: number): Rotation {
    return this.inBounds(x, y, z) ? (this.rots[this.index(x, y, z)] as Rotation) : 0;
  }

  /** Sets or clears a cell. Out-of-bounds writes are ignored and return false. */
  set(x: number, y: number, z: number, key: BlockKey | null, rot: Rotation = 0): boolean {
    if (!this.inBounds(x, y, z)) return false;
    const index = this.index(x, y, z);
    const before = this.ids[index];
    const after = key === null ? 0 : this.intern(key);
    this.rots[index] = after === 0 ? 0 : toRotation(rot);
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
    this.rots.fill(0);
    this.occupied = 0;
  }

  *entries(): Generator<readonly [Cell, BlockKey]> {
    for (let i = 0; i < this.ids.length; i++) {
      const id = this.ids[i];
      if (id !== 0) yield [indexToCellIn(this.size, i), this.palette[id]] as const;
    }
  }

  /** Like entries() but with the rotation of each block. */
  *entriesWithRotation(): Generator<readonly [Cell, BlockKey, Rotation]> {
    for (let i = 0; i < this.ids.length; i++) {
      const id = this.ids[i];
      if (id !== 0) yield [indexToCellIn(this.size, i), this.palette[id], this.rots[i] as Rotation] as const;
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

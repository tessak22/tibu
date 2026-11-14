import { WORLD_SIZE, type BlockKey, type Cell, type Rotation, type WorldSize } from '../core/types';

/** Dense index for any world size: x + z * sx + y * sx * sz. */
export function cellKey(size: WorldSize, x: number, y: number, z: number): number {
  return x + z * size.x + y * size.x * size.z;
}

/**
 * Renderer-owned dense voxel storage for any world size: a palette id (0 = empty) and a
 * quarter-turn rotation per cell. Independent of the world model's internals.
 */
export class RenderGrid {
  private ids: Uint16Array;
  private rots: Uint8Array;
  private readonly palette: BlockKey[] = [''];
  private readonly paletteIds = new Map<BlockKey, number>();
  private sizeValue: WorldSize;

  constructor(size: WorldSize = WORLD_SIZE) {
    this.sizeValue = size;
    this.ids = new Uint16Array(size.x * size.y * size.z);
    this.rots = new Uint8Array(this.ids.length);
  }

  get size(): WorldSize {
    return this.sizeValue;
  }

  /** Clears the grid, reallocating only when the size changes. */
  reset(size: WorldSize): void {
    const s = this.sizeValue;
    if (s.x !== size.x || s.y !== size.y || s.z !== size.z) {
      this.sizeValue = { x: size.x, y: size.y, z: size.z };
      this.ids = new Uint16Array(size.x * size.y * size.z);
      this.rots = new Uint8Array(this.ids.length);
      return;
    }
    this.ids.fill(0);
    this.rots.fill(0);
  }

  inBounds(x: number, y: number, z: number): boolean {
    const s = this.sizeValue;
    return x >= 0 && y >= 0 && z >= 0 && x < s.x && y < s.y && z < s.z && Number.isInteger(x + y + z);
  }

  idAt(x: number, y: number, z: number): number {
    return this.inBounds(x, y, z) ? this.ids[cellKey(this.sizeValue, x, y, z)] : 0;
  }

  rotAt(x: number, y: number, z: number): Rotation {
    return (this.inBounds(x, y, z) ? this.rots[cellKey(this.sizeValue, x, y, z)] & 3 : 0) as Rotation;
  }

  keyOf(id: number): BlockKey | null {
    return id > 0 ? (this.palette[id] ?? null) : null;
  }

  get(x: number, y: number, z: number): BlockKey | null {
    return this.keyOf(this.idAt(x, y, z));
  }

  /** Returns false (and ignores the write) when out of bounds. */
  set(x: number, y: number, z: number, key: BlockKey | null, rot: Rotation = 0): boolean {
    if (!this.inBounds(x, y, z)) return false;
    const i = cellKey(this.sizeValue, x, y, z);
    this.ids[i] = key === null ? 0 : this.intern(key);
    this.rots[i] = key === null ? 0 : rot & 3;
    return true;
  }

  *entries(): Generator<readonly [Cell, BlockKey]> {
    const { x: sx, z: sz } = this.sizeValue;
    const layer = sx * sz;
    for (let i = 0; i < this.ids.length; i++) {
      const id = this.ids[i];
      if (id === 0) continue;
      const y = Math.floor(i / layer);
      const rest = i - y * layer;
      const z = Math.floor(rest / sx);
      yield [{ x: rest - z * sx, y, z }, this.palette[id]] as const;
    }
  }

  private intern(key: BlockKey): number {
    const existing = this.paletteIds.get(key);
    if (existing !== undefined) return existing;
    if (this.palette.length >= 0xffff) return 1;
    const id = this.palette.length;
    this.palette.push(key);
    this.paletteIds.set(key, id);
    return id;
  }
}

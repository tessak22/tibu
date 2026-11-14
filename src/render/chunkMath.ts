import { WORLD_SIZE, type Cell, type WorldSize } from '../core/types';

/** Chunk column width for little worlds (24 wide -> 3 x 3 columns). */
export const SMALL_CHUNK = 8;
/** Big worlds use wider columns: fewer draw calls, still cheap to rebuild. */
export const BIG_CHUNK = 16;

/**
 * Chunks are columns spanning the full world height. Small worlds: 8 x H x 8; big worlds
 * (wider than 32): 16 x H x 16.
 */
export class ChunkLayout {
  readonly sizeX: number;
  readonly sizeZ: number;
  readonly chunksX: number;
  readonly chunksZ: number;
  readonly count: number;

  constructor(
    readonly size: WorldSize = WORLD_SIZE,
    readonly width: number = Math.max(size.x, size.z) > 32 ? BIG_CHUNK : SMALL_CHUNK,
  ) {
    this.sizeX = size.x;
    this.sizeZ = size.z;
    this.chunksX = Math.ceil(size.x / width);
    this.chunksZ = Math.ceil(size.z / width);
    this.count = this.chunksX * this.chunksZ;
  }

  /** Height of every chunk column. */
  get height(): number {
    return this.size.y;
  }

  indexOf(x: number, z: number): number {
    return Math.floor(x / this.width) + Math.floor(z / this.width) * this.chunksX;
  }

  origin(index: number): Cell {
    const cx = index % this.chunksX;
    const cz = Math.floor(index / this.chunksX);
    return { x: cx * this.width, y: 0, z: cz * this.width };
  }

  /** Center X of a chunk column (allocation-free; for per-frame culling). */
  centerX(index: number): number {
    return (index % this.chunksX) * this.width + this.width / 2;
  }

  /** Center Z of a chunk column (allocation-free; for per-frame culling). */
  centerZ(index: number): number {
    return Math.floor(index / this.chunksX) * this.width + this.width / 2;
  }

  /** World-space center of a chunk column (for culling and build priority). */
  center(index: number): { x: number; y: number; z: number } {
    const o = this.origin(index);
    return { x: o.x + this.width / 2, y: this.size.y / 2, z: o.z + this.width / 2 };
  }

  /**
   * Chunks whose meshes can change when `cell` changes: its own chunk plus any neighbor whose
   * boundary face (or corner ambient occlusion) depends on it.
   */
  affectedBy(cell: Cell): number[] {
    const out = new Set<number>();
    for (const dx of [-1, 0, 1]) {
      for (const dz of [-1, 0, 1]) {
        const x = cell.x + dx;
        const z = cell.z + dz;
        if (x < 0 || z < 0 || x >= this.sizeX || z >= this.sizeZ) continue;
        out.add(this.indexOf(x, z));
      }
    }
    return [...out].sort((a, b) => a - b);
  }
}

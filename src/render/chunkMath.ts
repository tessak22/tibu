import type { Cell } from '../core/types';
import { SIZE_X, SIZE_Y, SIZE_Z } from '../world/grid';

/** Chunks span the full world height: 8 x 16 x 8 cells, 3 x 3 chunk columns. */
export const CHUNK_X = 8;
export const CHUNK_Y = SIZE_Y;
export const CHUNK_Z = 8;
export const CHUNKS_X = Math.ceil(SIZE_X / CHUNK_X);
export const CHUNKS_Z = Math.ceil(SIZE_Z / CHUNK_Z);
export const CHUNK_COUNT = CHUNKS_X * CHUNKS_Z;

export function chunkIndexOf(x: number, z: number): number {
  return Math.floor(x / CHUNK_X) + Math.floor(z / CHUNK_Z) * CHUNKS_X;
}

export function chunkOrigin(index: number): Cell {
  const cx = index % CHUNKS_X;
  const cz = Math.floor(index / CHUNKS_X);
  return { x: cx * CHUNK_X, y: 0, z: cz * CHUNK_Z };
}

/**
 * Chunks whose meshes can change when `cell` changes: its own chunk plus any neighbor whose
 * boundary face (or corner ambient occlusion) depends on it.
 */
export function chunksAffectedBy(cell: Cell): number[] {
  const out = new Set<number>();
  for (const dx of [-1, 0, 1]) {
    for (const dz of [-1, 0, 1]) {
      const x = cell.x + dx;
      const z = cell.z + dz;
      if (x < 0 || z < 0 || x >= SIZE_X || z >= SIZE_Z) continue;
      out.add(chunkIndexOf(x, z));
    }
  }
  return [...out].sort((a, b) => a - b);
}

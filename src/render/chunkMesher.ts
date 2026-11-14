import type { Cell, FaceName } from '../core/types';
import { CHUNK_X, CHUNK_Y, CHUNK_Z } from './chunkMath';
import { FACES } from './faces';

export type UvRect = readonly [number, number, number, number];

export interface MesherInput {
  /** Palette id at a world coordinate; 0 for empty or out of bounds. */
  idAt(x: number, y: number, z: number): number;
  readonly origin: Cell;
  uvRect(id: number, face: FaceName): UvRect;
  isGlow(id: number): boolean;
  /** Cells treated as empty (e.g. while a bounce overlay animates). Keys are "x,y,z". */
  readonly hidden?: ReadonlySet<string>;
}

export interface MeshArrays {
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly uvs: Float32Array;
  /** Per-vertex ambient-occlusion brightness as RGB. */
  readonly colors: Float32Array;
  readonly indices: Uint32Array;
}

export interface ChunkMesh {
  readonly solid: MeshArrays;
  readonly glow: MeshArrays;
}

/** Soft AO levels: 0 = fully occluded corner. Kept bright for a gentle, pastel look. */
export const AO_LEVELS = [0.62, 0.76, 0.89, 1] as const;

class Builder {
  positions: number[] = [];
  normals: number[] = [];
  uvs: number[] = [];
  colors: number[] = [];
  indices: number[] = [];

  finish(): MeshArrays {
    return {
      positions: new Float32Array(this.positions),
      normals: new Float32Array(this.normals),
      uvs: new Float32Array(this.uvs),
      colors: new Float32Array(this.colors),
      indices: new Uint32Array(this.indices),
    };
  }
}

export function vertexAo(side1: boolean, side2: boolean, corner: boolean): number {
  if (side1 && side2) return 0;
  return 3 - (Number(side1) + Number(side2) + Number(corner));
}

/**
 * Builds merged geometry for one chunk. Faces touching another solid block are skipped
 * (hidden internal faces). Each vertex gets a soft ambient-occlusion tint for a rounded look.
 */
export function meshChunk(input: MesherInput): ChunkMesh {
  const { origin, hidden } = input;
  const solidAt = (x: number, y: number, z: number): boolean =>
    input.idAt(x, y, z) !== 0 && !(hidden && hidden.size > 0 && hidden.has(`${x},${y},${z}`));
  const idOf = (x: number, y: number, z: number): number => (solidAt(x, y, z) ? input.idAt(x, y, z) : 0);
  const solid = new Builder();
  const glow = new Builder();

  for (let y = 0; y < CHUNK_Y; y++) {
    for (let lz = 0; lz < CHUNK_Z; lz++) {
      for (let lx = 0; lx < CHUNK_X; lx++) {
        const x = origin.x + lx;
        const z = origin.z + lz;
        const id = idOf(x, y, z);
        if (id === 0) continue;
        const target = input.isGlow(id) ? glow : solid;
        for (const face of FACES) {
          const [nx, ny, nz] = face.normal;
          if (solidAt(x + nx, y + ny, z + nz)) continue;
          emitFace(target, face, x, y, z, input.uvRect(id, face.name), solidAt);
        }
      }
    }
  }
  return { solid: solid.finish(), glow: glow.finish() };
}

function emitFace(
  b: Builder,
  face: (typeof FACES)[number],
  x: number,
  y: number,
  z: number,
  uv: UvRect,
  solidAt: (x: number, y: number, z: number) => boolean,
): void {
  const base = b.positions.length / 3;
  const [nx, ny, nz] = face.normal;
  const [u0, v0, u1, v1] = uv;
  const uvCorners = [u0, v0, u1, v0, u1, v1, u0, v1];
  const ao: number[] = [];
  const axisN = nx !== 0 ? 0 : ny !== 0 ? 1 : 2;
  const [ta, tb] = [0, 1, 2].filter((a) => a !== axisN);
  face.corners.forEach((corner, i) => {
    b.positions.push(x + corner[0], y + corner[1], z + corner[2]);
    b.normals.push(nx, ny, nz);
    b.uvs.push(uvCorners[i * 2], uvCorners[i * 2 + 1]);
    const out = [x + nx, y + ny, z + nz];
    const sa = corner[ta] === 1 ? 1 : -1;
    const sb = corner[tb] === 1 ? 1 : -1;
    const p1 = [...out];
    p1[ta] += sa;
    const p2 = [...out];
    p2[tb] += sb;
    const p3 = [...out];
    p3[ta] += sa;
    p3[tb] += sb;
    const level = vertexAo(solidAt(p1[0], p1[1], p1[2]), solidAt(p2[0], p2[1], p2[2]), solidAt(p3[0], p3[1], p3[2]));
    ao.push(level);
    const shade = AO_LEVELS[level];
    b.colors.push(shade, shade, shade);
  });
  // Flip the quad diagonal to avoid anisotropic AO artifacts.
  if (ao[0] + ao[2] < ao[1] + ao[3]) {
    b.indices.push(base + 1, base + 2, base + 3, base + 1, base + 3, base);
  } else {
    b.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
}

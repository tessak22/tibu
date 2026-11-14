import { FACE_NAMES, WORLD_SIZE, type BlockShape, type Cell, type FaceName, type Rotation, type WorldSize } from '../core/types';
import { FACES, type FaceDef } from './faces';
import { isPart, shapeTemplate } from './shapes';
import { cellKey } from './voxelGrid';

export type UvRect = readonly [number, number, number, number];

export interface MesherInput {
  /** Palette id at a world coordinate; 0 for empty or out of bounds. */
  idAt(x: number, y: number, z: number): number;
  readonly origin: Cell;
  uvRect(id: number, face: FaceName): UvRect;
  isGlow(id: number): boolean;
  /** World size; defaults to the little-builder island. */
  readonly size?: WorldSize;
  /** Chunk column width (cells); defaults to 8. Chunks always span the full height. */
  readonly width?: number;
  /** Geometry of a palette id; missing means every block is a cube. */
  shapeOf?(id: number): BlockShape;
  /** Translucent (glass-like) palette ids go to the glass mesh; missing means none. */
  isTranslucent?(id: number): boolean;
  /** Rotation of the part at a cell; missing means 0. */
  rotAt?(x: number, y: number, z: number): Rotation;
  /** Cells treated as empty (e.g. while a bounce overlay animates). Keys are cellKey(size, ...). */
  readonly hidden?: ReadonlySet<number>;
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
  /** Cubes and opaque parts. */
  readonly solid: MeshArrays;
  /** Glowing cubes and parts (emissive material). */
  readonly glow: MeshArrays;
  /** Translucent parts (panes). */
  readonly glass: MeshArrays;
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

type Occludes = (x: number, y: number, z: number) => boolean;

/**
 * Builds merged geometry for one chunk column. Only full cubes hide neighbour faces and darken
 * corners; parts (slopes, wheels, ...) never hide anything, so nothing behind them disappears.
 */
export function meshChunk(input: MesherInput): ChunkMesh {
  const size = input.size ?? WORLD_SIZE;
  const width = input.width ?? 8;
  const { origin } = input;
  const hidden = input.hidden && input.hidden.size > 0 ? input.hidden : null;
  const isHidden = (x: number, y: number, z: number): boolean =>
    hidden !== null &&
    x >= 0 && y >= 0 && z >= 0 && x < size.x && y < size.y && z < size.z &&
    hidden.has(cellKey(size, x, y, z));
  const shapeOf = input.shapeOf;
  const idOf = (x: number, y: number, z: number): number => {
    const id = input.idAt(x, y, z);
    return id !== 0 && !isHidden(x, y, z) ? id : 0;
  };
  const cubeAt: Occludes = (x, y, z) => {
    const id = idOf(x, y, z);
    return id !== 0 && (!shapeOf || !isPart(shapeOf(id)));
  };
  const solid = new Builder();
  const glow = new Builder();
  const glass = new Builder();
  const maxX = Math.min(width, size.x - origin.x);
  const maxZ = Math.min(width, size.z - origin.z);

  for (let y = 0; y < size.y; y++) {
    for (let lz = 0; lz < maxZ; lz++) {
      for (let lx = 0; lx < maxX; lx++) {
        const x = origin.x + lx;
        const z = origin.z + lz;
        const id = idOf(x, y, z);
        if (id === 0) continue;
        const shape = shapeOf ? shapeOf(id) : 'cube';
        const glowing = input.isGlow(id);
        if (isPart(shape)) {
          const rot = input.rotAt ? input.rotAt(x, y, z) : 0;
          const t = shapeTemplate(shape, rot);
          emitPart(glowing ? glow : input.isTranslucent?.(id) ? glass : solid, t, x, y, z, (face) => input.uvRect(id, face));
          continue;
        }
        const target = glowing ? glow : solid;
        for (const face of FACES) {
          const [nx, ny, nz] = face.normal;
          if (cubeAt(x + nx, y + ny, z + nz)) continue;
          emitFace(target, face, x, y, z, input.uvRect(id, face.name), cubeAt);
        }
      }
    }
  }
  return { solid: solid.finish(), glow: glow.finish(), glass: glass.finish() };
}

function emitPart(
  b: Builder,
  t: ReturnType<typeof shapeTemplate>,
  x: number,
  y: number,
  z: number,
  uvFor: (face: FaceName) => UvRect,
): void {
  const base = b.positions.length / 3;
  const rects = new Map<number, UvRect>();
  const n = t.positions.length / 3;
  for (let i = 0; i < n; i++) {
    const f = t.faces[i];
    let rect = rects.get(f);
    if (!rect) {
      rect = uvFor(FACE_NAMES[f]);
      rects.set(f, rect);
    }
    b.positions.push(x + t.positions[i * 3], y + t.positions[i * 3 + 1], z + t.positions[i * 3 + 2]);
    b.normals.push(t.normals[i * 3], t.normals[i * 3 + 1], t.normals[i * 3 + 2]);
    const u = t.uvs[i * 2];
    const v = t.uvs[i * 2 + 1];
    b.uvs.push(rect[0] + (rect[2] - rect[0]) * u, rect[1] + (rect[3] - rect[1]) * v);
    const shade = t.shades[i];
    b.colors.push(shade, shade, shade);
  }
  for (let i = 0; i < t.indices.length; i++) b.indices.push(base + t.indices[i]);
}

/** Per face: the two tangent axes used for corner AO lookups. */
const TANGENTS: Record<FaceName, readonly [number, number]> = {
  east: [1, 2],
  west: [1, 2],
  top: [0, 2],
  bottom: [0, 2],
  south: [0, 1],
  north: [0, 1],
};
const p1 = [0, 0, 0];
const p2 = [0, 0, 0];
const p3 = [0, 0, 0];
const ao = [0, 0, 0, 0];

function emitFace(b: Builder, face: FaceDef, x: number, y: number, z: number, uv: UvRect, occludes: Occludes): void {
  const base = b.positions.length / 3;
  const [nx, ny, nz] = face.normal;
  const [u0, v0, u1, v1] = uv;
  const [ta, tb] = TANGENTS[face.name];
  for (let i = 0; i < 4; i++) {
    const corner = face.corners[i];
    b.positions.push(x + corner[0], y + corner[1], z + corner[2]);
    b.normals.push(nx, ny, nz);
    b.uvs.push(i === 0 || i === 3 ? u0 : u1, i < 2 ? v0 : v1);
    p1[0] = p2[0] = p3[0] = x + nx;
    p1[1] = p2[1] = p3[1] = y + ny;
    p1[2] = p2[2] = p3[2] = z + nz;
    const sa = corner[ta] === 1 ? 1 : -1;
    const sb = corner[tb] === 1 ? 1 : -1;
    p1[ta] += sa;
    p2[tb] += sb;
    p3[ta] += sa;
    p3[tb] += sb;
    const level = vertexAo(occludes(p1[0], p1[1], p1[2]), occludes(p2[0], p2[1], p2[2]), occludes(p3[0], p3[1], p3[2]));
    ao[i] = level;
    const shade = AO_LEVELS[level];
    b.colors.push(shade, shade, shade);
  }
  // Flip the quad diagonal to avoid anisotropic AO artifacts.
  if (ao[0] + ao[2] < ao[1] + ao[3]) {
    b.indices.push(base + 1, base + 2, base + 3, base + 1, base + 3, base);
  } else {
    b.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
}

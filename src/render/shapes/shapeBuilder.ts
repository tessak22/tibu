import { FACE_NAMES, type FaceName } from '../../core/types';

export type V3 = readonly [number, number, number];

/** Unit-cell geometry for one part shape, before it is placed in a chunk. */
export interface ShapeTemplate {
  /** Positions inside the unit cell [0,1]^3. */
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  /** Local UVs in [0,1]; mapped into the block's face tile. */
  readonly uvs: Float32Array;
  /** Which face canvas (index into FACE_NAMES) textures each vertex. */
  readonly faces: Uint8Array;
  /** Soft baked ambient occlusion per vertex (1 = fully lit). */
  readonly shades: Float32Array;
  readonly indices: Uint16Array;
}

/** Bottom-of-part darkening: a soft contact shadow like the cube AO. */
export const CONTACT_SHADE = 0.8;
export const shadeAt = (y: number): number => (y < 0.02 ? CONTACT_SHADE : 1);

const faceIndex = (face: FaceName): number => FACE_NAMES.indexOf(face);

/** Face (texture) for a flat surface with this normal; matches the cube convention. */
export function faceForNormal(n: V3): FaceName {
  const [ax, ay, az] = n.map(Math.abs);
  if (ay >= ax && ay >= az) return n[1] > 0 ? 'top' : 'bottom';
  if (ax >= az) return n[0] > 0 ? 'east' : 'west';
  return n[2] > 0 ? 'south' : 'north';
}

/** Planar UV for a point on a flat surface, oriented like the cube faces (see faces.ts). */
export function planarUv(p: V3, n: V3): [number, number] {
  switch (faceForNormal(n)) {
    case 'top':
      return [p[0], 1 - p[2]];
    case 'bottom':
      return [p[0], p[2]];
    case 'east':
      return [1 - p[2], p[1]];
    case 'west':
      return [p[2], p[1]];
    case 'south':
      return [p[0], p[1]];
    default:
      return [1 - p[0], p[1]];
  }
}

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export function normalize(v: V3): V3 {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

export interface VertexSpec {
  readonly p: V3;
  readonly n: V3;
  readonly uv: readonly [number, number];
  readonly face: FaceName;
  readonly shade?: number;
}

/** Accumulates triangles; winding is fixed automatically so every triangle faces its normals. */
export class ShapeBuilder {
  private readonly positions: number[] = [];
  private readonly normals: number[] = [];
  private readonly uvs: number[] = [];
  private readonly faces: number[] = [];
  private readonly shades: number[] = [];
  private readonly indices: number[] = [];

  vertex(v: VertexSpec): number {
    this.positions.push(v.p[0], v.p[1], v.p[2]);
    this.normals.push(v.n[0], v.n[1], v.n[2]);
    this.uvs.push(v.uv[0], v.uv[1]);
    this.faces.push(faceIndex(v.face));
    this.shades.push(v.shade ?? shadeAt(v.p[1]));
    return this.positions.length / 3 - 1;
  }

  tri(a: number, b: number, c: number): void {
    const pa = this.pos(a);
    const geometric = cross(sub(this.pos(b), pa), sub(this.pos(c), pa));
    const n = this.nrm(a);
    const m = this.nrm(b);
    const o = this.nrm(c);
    const avg: V3 = [n[0] + m[0] + o[0], n[1] + m[1] + o[1], n[2] + m[2] + o[2]];
    if (dot(geometric, avg) < 0) this.indices.push(a, c, b);
    else this.indices.push(a, b, c);
  }

  quad(a: number, b: number, c: number, d: number): void {
    this.tri(a, b, c);
    this.tri(a, c, d);
  }

  /** A flat convex polygon with planar UVs and the face chosen from its normal. */
  flat(points: readonly V3[], normal: V3, face: FaceName = faceForNormal(normal)): void {
    const ids = points.map((p) => this.vertex({ p, n: normal, uv: planarUv(p, normal), face }));
    for (let i = 1; i + 1 < ids.length; i++) this.tri(ids[0], ids[i], ids[i + 1]);
  }

  /** Axis-aligned box with six planar-mapped faces (UVs cover each full face tile). */
  box(min: V3, max: V3, stretchUv = true): void {
    const [x0, y0, z0] = min;
    const [x1, y1, z1] = max;
    const faces: [V3, V3[]][] = [
      [[1, 0, 0], [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]]],
      [[-1, 0, 0], [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]]],
      [[0, 1, 0], [[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]]],
      [[0, -1, 0], [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]]],
      [[0, 0, 1], [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]]],
      [[0, 0, -1], [[x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0]]],
    ];
    for (const [n, pts] of faces) {
      // Stretch: the whole tile (with its bevel) covers each face, so thin parts keep a rim.
      const toUnit = (p: V3): V3 =>
        stretchUv ? [unit(p[0], x0, x1), unit(p[1], y0, y1), unit(p[2], z0, z1)] : p;
      const ids = pts.map((p) => this.vertex({ p, n, uv: planarUv(toUnit(p), n), face: faceForNormal(n) }));
      this.quad(ids[0], ids[1], ids[2], ids[3]);
    }
  }

  finish(): ShapeTemplate {
    return {
      positions: new Float32Array(this.positions),
      normals: new Float32Array(this.normals),
      uvs: new Float32Array(this.uvs),
      faces: new Uint8Array(this.faces),
      shades: new Float32Array(this.shades),
      indices: new Uint16Array(this.indices),
    };
  }

  private pos(i: number): V3 {
    return [this.positions[i * 3], this.positions[i * 3 + 1], this.positions[i * 3 + 2]];
  }

  private nrm(i: number): V3 {
    return [this.normals[i * 3], this.normals[i * 3 + 1], this.normals[i * 3 + 2]];
  }
}

const unit = (v: number, lo: number, hi: number): number => (hi - lo < 1e-6 ? 0 : (v - lo) / (hi - lo));

import type { FaceName } from '../../core/types';
import { normalize, type ShapeBuilder, type V3 } from './shapeBuilder';

/** Orientation of a round primitive: center of its base, axis (unit) and two perpendicular units. */
export interface Frame {
  readonly base: V3;
  readonly axis: V3;
  readonly u: V3;
  readonly v: V3;
}

export const Y_FRAME = (cx: number, y: number, cz: number): Frame => ({
  base: [cx, y, cz],
  axis: [0, 1, 0],
  u: [1, 0, 0],
  v: [0, 0, 1],
});

/** Axis along +x (a wheel rolling north/south). */
export const X_FRAME = (x: number, cy: number, cz: number): Frame => ({
  base: [x, cy, cz],
  axis: [1, 0, 0],
  u: [0, 1, 0],
  v: [0, 0, 1],
});

const at = (f: Frame, h: number, r: number, angle: number): V3 => {
  const c = Math.cos(angle) * r;
  const s = Math.sin(angle) * r;
  return [
    f.base[0] + f.axis[0] * h + f.u[0] * c + f.v[0] * s,
    f.base[1] + f.axis[1] * h + f.u[1] * c + f.v[1] * s,
    f.base[2] + f.axis[2] * h + f.u[2] * c + f.v[2] * s,
  ];
};
const radial = (f: Frame, angle: number): V3 => {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [f.u[0] * c + f.v[0] * s, f.u[1] * c + f.v[1] * s, f.u[2] * c + f.v[2] * s];
};
const scaled = (v: V3, k: number): V3 => [v[0] * k, v[1] * k, v[2] * k];

export interface RoundOptions {
  readonly segments: number;
  readonly sideFace: FaceName;
  readonly capFace: FaceName;
  /** Extra darkening of the side (e.g. a rubbery tyre). */
  readonly sideShade?: number;
  readonly capStart?: boolean;
  readonly capEnd?: boolean;
}

/** Flat disc cap facing `dir` (+1 = along the axis). */
function cap(b: ShapeBuilder, f: Frame, h: number, r: number, dir: 1 | -1, o: RoundOptions): void {
  const n = scaled(f.axis, dir);
  const center = b.vertex({ p: at(f, h, 0, 0), n, uv: [0.5, 0.5], face: o.capFace });
  const ring: number[] = [];
  for (let i = 0; i < o.segments; i++) {
    const a = (i / o.segments) * Math.PI * 2;
    ring.push(b.vertex({ p: at(f, h, r, a), n, uv: [0.5 + Math.cos(a) * 0.5, 0.5 + Math.sin(a) * 0.5], face: o.capFace }));
  }
  for (let i = 0; i < ring.length; i++) b.tri(center, ring[i], ring[(i + 1) % ring.length]);
}

/** Smooth-shaded cylinder of radius r and length len along the frame axis. */
export function cylinder(b: ShapeBuilder, f: Frame, r: number, len: number, o: RoundOptions): void {
  const lo: number[] = [];
  const hi: number[] = [];
  for (let i = 0; i <= o.segments; i++) {
    const a = (i / o.segments) * Math.PI * 2;
    const n = radial(f, a);
    const u = i / o.segments;
    const shade = o.sideShade;
    lo.push(b.vertex({ p: at(f, 0, r, a), n, uv: [u, 0], face: o.sideFace, shade }));
    hi.push(b.vertex({ p: at(f, len, r, a), n, uv: [u, 1], face: o.sideFace, shade }));
  }
  for (let i = 0; i < o.segments; i++) b.quad(lo[i], lo[i + 1], hi[i + 1], hi[i]);
  if (o.capStart !== false) cap(b, f, 0, r, -1, o);
  if (o.capEnd !== false) cap(b, f, len, r, 1, o);
}

/** Smooth-shaded cone with its base on the frame base and its tip `height` along the axis. */
export function cone(b: ShapeBuilder, f: Frame, r: number, height: number, o: RoundOptions): void {
  const slant = (a: number): V3 => {
    const d = radial(f, a);
    return normalize([d[0] * height + f.axis[0] * r, d[1] * height + f.axis[1] * r, d[2] * height + f.axis[2] * r]);
  };
  for (let i = 0; i < o.segments; i++) {
    const a0 = (i / o.segments) * Math.PI * 2;
    const a1 = ((i + 1) / o.segments) * Math.PI * 2;
    const p0 = b.vertex({ p: at(f, 0, r, a0), n: slant(a0), uv: [i / o.segments, 0], face: o.sideFace });
    const p1 = b.vertex({ p: at(f, 0, r, a1), n: slant(a1), uv: [(i + 1) / o.segments, 0], face: o.sideFace });
    const tip = b.vertex({
      p: at(f, height, 0, 0),
      n: slant((a0 + a1) / 2),
      uv: [(i + 0.5) / o.segments, 1],
      face: o.sideFace,
    });
    b.tri(p0, p1, tip);
  }
  if (o.capStart !== false) cap(b, f, 0, r, -1, o);
}

/**
 * Arch: a full block with a round-topped tunnel running along z (front = south, back = north).
 * The opening is `w` wide with straight legs up to `legH` and a half circle on top.
 */
export function arch(b: ShapeBuilder, w: number, legH: number, segments: number): void {
  const r = w / 2;
  const x0 = 0.5 - r;
  const x1 = 0.5 + r;
  const curve = (i: number): [number, number] => {
    const a = Math.PI - (i / segments) * Math.PI;
    return [0.5 + Math.cos(a) * r, legH + Math.sin(a) * r];
  };
  // Outer path: left edge up, top edge, right edge down. Sampled with the same count as the curve,
  // with the two corners landing exactly on samples (segments must be a multiple of the ratio).
  const left = 1 - legH;
  const total = left * 2 + 1;
  const outer = (i: number): [number, number] => {
    const d = (i / segments) * total;
    if (d <= left) return [0, legH + d];
    if (d <= left + 1) return [d - left, 1];
    return [1, 1 - (d - left - 1)];
  };
  for (const z of [0, 1]) {
    const n: V3 = [0, 0, z === 1 ? 1 : -1];
    for (let i = 0; i < segments; i++) {
      const [ax, ay] = curve(i);
      const [bx, by] = curve(i + 1);
      const [cx, cy] = outer(i + 1);
      const [dx, dy] = outer(i);
      b.flat([[ax, ay, z], [bx, by, z], [cx, cy, z], [dx, dy, z]], n);
    }
    b.flat([[0, 0, z], [x0, 0, z], [x0, legH, z], [0, legH, z]], n);
    b.flat([[x1, 0, z], [1, 0, z], [1, legH, z], [x1, legH, z]], n);
  }
  // Tunnel ceiling (normals point into the opening) and inner leg walls.
  for (let i = 0; i < segments; i++) {
    const [ax, ay] = curve(i);
    const [bx, by] = curve(i + 1);
    const na: V3 = [0.5 - ax, legH - ay, 0];
    const nb: V3 = [0.5 - bx, legH - by, 0];
    const v = (x: number, y: number, z: number, n: V3, u: number) =>
      b.vertex({ p: [x, y, z], n: normalize(n), uv: [u, z], face: 'bottom', shade: 0.86 });
    b.quad(v(ax, ay, 0, na, i / segments), v(bx, by, 0, nb, (i + 1) / segments), v(bx, by, 1, nb, (i + 1) / segments), v(ax, ay, 1, na, i / segments));
  }
  b.flat([[x0, 0, 0], [x0, 0, 1], [x0, legH, 1], [x0, legH, 0]], [1, 0, 0]);
  b.flat([[x1, 0, 0], [x1, legH, 0], [x1, legH, 1], [x1, 0, 1]], [-1, 0, 0]);
  // Outside walls, top and the two foot pads.
  b.flat([[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]], [1, 0, 0]);
  b.flat([[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], [-1, 0, 0]);
  b.flat([[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]], [0, 1, 0]);
  b.flat([[0, 0, 0], [x0, 0, 0], [x0, 0, 1], [0, 0, 1]], [0, -1, 0]);
  b.flat([[x1, 0, 0], [1, 0, 0], [1, 0, 1], [x1, 0, 1]], [0, -1, 0]);
}

/**
 * Simple polygon models of block shapes inside a unit cell, for drawing
 * pictures (tray icons, card and blueprint pictures). Pure: no canvas.
 *
 * Conventions (rotation 0, cell spans 0..1 on every axis, y is up):
 * - slope: a wedge, high edge along the north side (z = 0), sloping down to the south (z = 1).
 * - slab: half height. plate: a third of a block high.
 * - wheel: a disc rolling along z, axle along x; hub art on the east/west faces, tyre on 'top'.
 * - cone, cylinder: upright, centered in the cell.
 * - arch: two legs along x with a round-ish opening you can look through along z.
 * - pane: a thin upright panel across x, centered in z.
 * A rotation turns the shape by quarter turns about the vertical axis,
 * the same way build cards turn ([x, z] -> [-z, x] around the cell center).
 */
import type { BlockShape, FaceName, Rotation } from '../../core/types';

export type V3 = readonly [number, number, number];

/** One flat polygon; the face canvas `face` is mapped onto the parallelogram (o, o+u, o+v). */
export interface ShapePoly {
  readonly pts: readonly V3[];
  readonly normal: V3;
  readonly face: FaceName;
  readonly tex: { readonly o: V3; readonly u: V3; readonly v: V3 };
  /** Horizontal fraction of the face canvas to use (curved sides). Default [0, 1]. */
  readonly slice?: readonly [number, number];
}

/** A convex piece; its front-facing polygons never overlap each other. */
export interface ShapeSolid {
  readonly polys: readonly ShapePoly[];
  readonly center: V3;
}

const SEGMENTS = 16;

const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const norm = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

function centerOf(polys: readonly ShapePoly[]): V3 {
  const pts = polys.flatMap((p) => p.pts);
  const sum = pts.reduce<V3>((acc, p) => add(acc, p), [0, 0, 0]);
  return [sum[0] / pts.length, sum[1] / pts.length, sum[2] / pts.length];
}

function solid(polys: readonly ShapePoly[]): ShapeSolid {
  return { polys, center: centerOf(polys) };
}

/** Axis-aligned box from (x0,y0,z0) to (x1,y1,z1). */
export function box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): ShapeSolid {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dz = z1 - z0;
  return solid([
    { face: 'top', normal: [0, 1, 0], pts: [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], tex: { o: [x0, y1, z0], u: [dx, 0, 0], v: [0, 0, dz] } },
    { face: 'bottom', normal: [0, -1, 0], pts: [[x0, y0, z0], [x0, y0, z1], [x1, y0, z1], [x1, y0, z0]], tex: { o: [x0, y0, z1], u: [dx, 0, 0], v: [0, 0, -dz] } },
    { face: 'east', normal: [1, 0, 0], pts: [[x1, y1, z1], [x1, y1, z0], [x1, y0, z0], [x1, y0, z1]], tex: { o: [x1, y1, z1], u: [0, 0, -dz], v: [0, -dy, 0] } },
    { face: 'west', normal: [-1, 0, 0], pts: [[x0, y1, z0], [x0, y1, z1], [x0, y0, z1], [x0, y0, z0]], tex: { o: [x0, y1, z0], u: [0, 0, dz], v: [0, -dy, 0] } },
    { face: 'south', normal: [0, 0, 1], pts: [[x0, y1, z1], [x1, y1, z1], [x1, y0, z1], [x0, y0, z1]], tex: { o: [x0, y1, z1], u: [dx, 0, 0], v: [0, -dy, 0] } },
    { face: 'north', normal: [0, 0, -1], pts: [[x1, y1, z0], [x0, y1, z0], [x0, y0, z0], [x1, y0, z0]], tex: { o: [x1, y1, z0], u: [-dx, 0, 0], v: [0, -dy, 0] } },
  ]);
}

function wedge(): ShapeSolid {
  return solid([
    { face: 'top', normal: norm([0, 1, 1]), pts: [[0, 1, 0], [1, 1, 0], [1, 0, 1], [0, 0, 1]], tex: { o: [0, 1, 0], u: [1, 0, 0], v: [0, -1, 1] } },
    { face: 'north', normal: [0, 0, -1], pts: [[1, 1, 0], [0, 1, 0], [0, 0, 0], [1, 0, 0]], tex: { o: [1, 1, 0], u: [-1, 0, 0], v: [0, -1, 0] } },
    { face: 'bottom', normal: [0, -1, 0], pts: [[0, 0, 0], [0, 0, 1], [1, 0, 1], [1, 0, 0]], tex: { o: [0, 0, 1], u: [1, 0, 0], v: [0, 0, -1] } },
    { face: 'east', normal: [1, 0, 0], pts: [[1, 1, 0], [1, 0, 0], [1, 0, 1]], tex: { o: [1, 1, 1], u: [0, 0, -1], v: [0, -1, 0] } },
    { face: 'west', normal: [-1, 0, 0], pts: [[0, 1, 0], [0, 0, 1], [0, 0, 0]], tex: { o: [0, 1, 0], u: [0, 0, 1], v: [0, -1, 0] } },
  ]);
}

const ring = (n: number, at: (a: number) => V3): V3[] =>
  Array.from({ length: n }, (_, i) => at((i / n) * Math.PI * 2));

/** Upright cylinder (or cone when `topRadius` is 0) centered in the cell. */
function upright(radius: number, y0: number, y1: number, topRadius: number): ShapeSolid {
  const c = 0.5;
  const bottom = ring(SEGMENTS, (a) => [c + radius * Math.cos(a), y0, c + radius * Math.sin(a)]);
  const top = ring(SEGMENTS, (a) => [c + topRadius * Math.cos(a), y1, c + topRadius * Math.sin(a)]);
  const h = y1 - y0;
  const half = SEGMENTS / 2;
  const polys: ShapePoly[] = [];
  for (let i = 0; i < SEGMENTS; i++) {
    const j = (i + 1) % SEGMENTS;
    const mid = ((i + 0.5) / SEGMENTS) * Math.PI * 2;
    const normal = norm([Math.cos(mid) * h, radius - topRadius, Math.sin(mid) * h]);
    const k = i % half;
    const pts: V3[] = topRadius > 0 ? [top[i], top[j], bottom[j], bottom[i]] : [top[i], bottom[j], bottom[i]];
    const o: V3 = [bottom[i][0], y1, bottom[i][2]];
    polys.push({ face: 'south', normal, pts, tex: { o, u: sub(bottom[j], bottom[i]), v: [0, -h, 0] }, slice: [k / half, (k + 1) / half] });
  }
  const disc = (pts: V3[], y: number, face: FaceName, normal: V3): ShapePoly => ({
    face, normal, pts, tex: { o: [c - radius, y, c - radius], u: [radius * 2, 0, 0], v: [0, 0, radius * 2] },
  });
  if (topRadius > 0) polys.push(disc(top, y1, 'top', [0, 1, 0]));
  polys.push(disc([...bottom].reverse(), y0, 'bottom', [0, -1, 0]));
  return solid(polys);
}

/** Wheel: disc with its axle along x. Hub art on the east/west caps, tyre art on the tread. */
function wheel(): ShapeSolid {
  const r = 0.48;
  const x0 = 0.2;
  const x1 = 0.8;
  const at = (x: number) => (a: number): V3 => [x, 0.5 + r * Math.sin(a), 0.5 + r * Math.cos(a)];
  const east = ring(SEGMENTS, at(x1));
  const west = ring(SEGMENTS, at(x0));
  const polys: ShapePoly[] = [];
  const half = SEGMENTS / 2;
  for (let i = 0; i < SEGMENTS; i++) {
    const j = (i + 1) % SEGMENTS;
    const mid = ((i + 0.5) / SEGMENTS) * Math.PI * 2;
    const k = i % half;
    polys.push({
      face: 'top', normal: [0, Math.sin(mid), Math.cos(mid)], pts: [west[i], west[j], east[j], east[i]],
      tex: { o: west[i], u: [x1 - x0, 0, 0], v: sub(west[j], west[i]) }, slice: [k / half, (k + 1) / half],
    });
  }
  const cap = (pts: V3[], x: number, face: FaceName, normal: V3, flip: boolean): ShapePoly => ({
    face, normal, pts,
    tex: flip
      ? { o: [x, 0.5 + r, 0.5 - r], u: [0, 0, 2 * r], v: [0, -2 * r, 0] }
      : { o: [x, 0.5 + r, 0.5 + r], u: [0, 0, -2 * r], v: [0, -2 * r, 0] },
  });
  polys.push(cap([...east].reverse(), x1, 'east', [1, 0, 0], false));
  polys.push(cap(west, x0, 'west', [-1, 0, 0], true));
  return solid(polys);
}

/** Solids of a shape at rotation 0. */
function baseSolids(shape: BlockShape): ShapeSolid[] {
  switch (shape) {
    case 'slope':
      return [wedge()];
    case 'slab':
      return [box(0, 0, 0, 1, 0.5, 1)];
    case 'plate':
      return [box(0, 0, 0, 1, 1 / 3, 1)];
    case 'wheel':
      return [wheel()];
    case 'cone':
      return [upright(0.46, 0, 1, 0)];
    case 'cylinder':
      return [upright(0.4, 0, 1, 0.4)];
    case 'pane':
      return [box(0, 0, 0.42, 1, 1, 0.58)];
    case 'arch':
      return [
        box(0, 0, 0, 0.28, 0.7, 1),
        box(0.72, 0, 0, 1, 0.7, 1),
        box(0.28, 0.55, 0, 0.4, 0.7, 1),
        box(0.6, 0.55, 0, 0.72, 0.7, 1),
        box(0, 0.7, 0, 1, 1, 1),
      ];
    case 'cube':
    default:
      return [box(0, 0, 0, 1, 1, 1)];
  }
}

/** One quarter turn of a point about the cell center (matches rotatePattern for cards). */
const turnPoint = (p: V3): V3 => [1 - p[2], p[1], p[0]];
const turnVector = (v: V3): V3 => [-v[2], v[1], v[0]];

function turnSolid(s: ShapeSolid): ShapeSolid {
  return solid(
    s.polys.map((p) => ({
      ...p,
      pts: p.pts.map(turnPoint),
      normal: turnVector(p.normal),
      tex: { o: turnPoint(p.tex.o), u: turnVector(p.tex.u), v: turnVector(p.tex.v) },
    })),
  );
}

/** Solids for a shape turned by `rot` quarter turns. */
export function shapeSolids(shape: BlockShape, rot: Rotation = 0): ShapeSolid[] {
  let solids = baseSolids(shape);
  for (let i = 0; i < rot; i++) solids = solids.map(turnSolid);
  return solids;
}

/** Direction towards the viewer of the isometric pictures (shows top, east and south). */
export const VIEW_DIR: V3 = [1, 1, 1];

export const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Visible polygons of a shape in back-to-front order, offset to a cell position. */
export function visiblePolys(shape: BlockShape, rot: Rotation, at: V3): ShapePoly[] {
  const solids = [...shapeSolids(shape, rot)].sort((a, b) => dot(a.center, VIEW_DIR) - dot(b.center, VIEW_DIR));
  const out: ShapePoly[] = [];
  for (const s of solids) {
    for (const p of s.polys) {
      if (dot(p.normal, VIEW_DIR) <= 1e-6) continue;
      out.push({ ...p, pts: p.pts.map((q) => add(q, at)), tex: { ...p.tex, o: add(p.tex.o, at) } });
    }
  }
  return out;
}

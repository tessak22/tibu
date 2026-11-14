import type { Cell } from '../core/types';
import { SIZE_X, SIZE_Y, SIZE_Z } from '../world/grid';

export interface Vec3Like {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface VoxelHit {
  /** The solid cell that was hit. */
  readonly cell: Cell;
  /** Unit normal (axis-aligned, integer) of the face that was entered. */
  readonly normal: Cell;
  /** Distance along the (normalized) ray. */
  readonly distance: number;
}

export type SolidTest = (x: number, y: number, z: number) => boolean;

const EPS = 1e-6;

/** Slab test against the grid box [0,SIZE]. Returns [tEnter, tExit, enterAxis] or null. */
function intersectGridBox(o: Vec3Like, d: Vec3Like): [number, number, number] | null {
  let tMin = -Infinity;
  let tMax = Infinity;
  let axisOfMin = -1;
  const origin = [o.x, o.y, o.z];
  const dir = [d.x, d.y, d.z];
  const size = [SIZE_X, SIZE_Y, SIZE_Z];
  for (let a = 0; a < 3; a++) {
    if (Math.abs(dir[a]) < EPS) {
      if (origin[a] < 0 || origin[a] > size[a]) return null;
      continue;
    }
    let t0 = (0 - origin[a]) / dir[a];
    let t1 = (size[a] - origin[a]) / dir[a];
    if (t0 > t1) [t0, t1] = [t1, t0];
    if (t0 > tMin) {
      tMin = t0;
      axisOfMin = a;
    }
    tMax = Math.min(tMax, t1);
  }
  if (tMax < Math.max(tMin, 0)) return null;
  return [tMin, tMax, axisOfMin];
}

function axisNormal(axis: number, step: number): Cell {
  return { x: axis === 0 ? -step : 0, y: axis === 1 ? -step : 0, z: axis === 2 ? -step : 0 };
}

function dominantAxis(d: Vec3Like): number {
  const ax = Math.abs(d.x);
  const ay = Math.abs(d.y);
  const az = Math.abs(d.z);
  if (ax >= ay && ax >= az) return 0;
  return ay >= az ? 1 : 2;
}

/**
 * Amanatides-Woo voxel traversal through the bounded grid. `dir` need not be normalized.
 * Returns the first solid cell and the face it was entered through, or null.
 */
export function raycastVoxels(origin: Vec3Like, dir: Vec3Like, isSolid: SolidTest, maxDistance = 200): VoxelHit | null {
  const len = Math.hypot(dir.x, dir.y, dir.z);
  if (!(len > EPS)) return null;
  const d = { x: dir.x / len, y: dir.y / len, z: dir.z / len };
  const box = intersectGridBox(origin, d);
  if (!box) return null;
  const [tEnter, tExit, enterAxis] = box;
  const tStart = Math.max(tEnter, 0);
  const startedInside = tEnter <= 0;
  const p = [origin.x + d.x * (tStart + EPS), origin.y + d.y * (tStart + EPS), origin.z + d.z * (tStart + EPS)];
  const dirs = [d.x, d.y, d.z];
  const size = [SIZE_X, SIZE_Y, SIZE_Z];
  const cellPos = p.map((v, a) => Math.min(size[a] - 1, Math.max(0, Math.floor(v))));
  const step = dirs.map((v) => (v > 0 ? 1 : v < 0 ? -1 : 0));
  const tDelta = dirs.map((v) => (v !== 0 ? Math.abs(1 / v) : Infinity));
  const tMax = dirs.map((v, a) => {
    if (v === 0) return Infinity;
    const boundary = v > 0 ? cellPos[a] + 1 : cellPos[a];
    return tStart + (boundary - p[a]) / v;
  });
  let axis = startedInside ? dominantAxis(d) : enterAxis;
  let t = tStart;
  const limit = Math.min(tExit, maxDistance);
  while (t <= limit + EPS) {
    const [x, y, z] = cellPos;
    if (x < 0 || y < 0 || z < 0 || x >= SIZE_X || y >= SIZE_Y || z >= SIZE_Z) return null;
    if (isSolid(x, y, z)) {
      return { cell: { x, y, z }, normal: axisNormal(axis, step[axis] || 1), distance: t };
    }
    axis = tMax[0] < tMax[1] ? (tMax[0] < tMax[2] ? 0 : 2) : tMax[1] < tMax[2] ? 1 : 2;
    t = tMax[axis];
    cellPos[axis] += step[axis];
    tMax[axis] += tDelta[axis];
  }
  return null;
}

/** Where a ray meets the horizontal plane y = planeY, inside the grid footprint. */
export function raycastFloorPlane(origin: Vec3Like, dir: Vec3Like, planeY = 0): Cell | null {
  if (dir.y >= -EPS || origin.y <= planeY) return null;
  const t = (planeY - origin.y) / dir.y;
  const x = Math.floor(origin.x + dir.x * t);
  const z = Math.floor(origin.z + dir.z * t);
  if (x < 0 || z < 0 || x >= SIZE_X || z >= SIZE_Z) return null;
  return { x, y: planeY, z };
}

/** The empty cell next to a hit face (where a new block goes). */
export function adjacentCell(hit: VoxelHit): Cell {
  return { x: hit.cell.x + hit.normal.x, y: hit.cell.y + hit.normal.y, z: hit.cell.z + hit.normal.z };
}

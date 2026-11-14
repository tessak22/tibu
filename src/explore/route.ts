/**
 * Pure route planning for explore actors: never fails, at worst returns an empty route.
 * Walkability comes from the world's walk helpers (passed in so tests can stub them).
 */
import type { Cell, WorldModel } from '../core/types';

export interface WalkFns {
  standable(world: WorldModel, cell: Cell): boolean;
  neighbors(world: WorldModel, cell: Cell): readonly Cell[];
  findPath(world: WorldModel, from: Cell, to: Cell, maxNodes: number): Cell[] | null;
}

export interface Route {
  /** Cells to step through, excluding the start cell. Empty means "stay". */
  readonly steps: readonly Cell[];
  /** True when the route ends exactly at the requested target. */
  readonly reached: boolean;
}

export const sameCell = (a: Cell, b: Cell): boolean => a.x === b.x && a.y === b.y && a.z === b.z;
export const cellKey = (c: Cell): string => `${c.x},${c.y},${c.z}`;

/** Squared distance with vertical weighted a little less (stairs are fine). */
export function distance2(a: Cell, b: Cell): number {
  const dx = a.x - b.x;
  const dy = (a.y - b.y) * 0.7;
  const dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
}

/** Same column/row neighbourhood: within one cell horizontally (diagonals too) and one level. */
export function isAdjacent(a: Cell, b: Cell): boolean {
  return Math.abs(a.x - b.x) <= 1 && Math.abs(a.z - b.z) <= 1 && Math.abs(a.y - b.y) <= 1 && !sameCell(a, b);
}

function stripStart(path: readonly Cell[], from: Cell): Cell[] {
  return path.length > 0 && sameCell(path[0] as Cell, from) ? path.slice(1) : path.slice();
}

/**
 * Route from `from` to `to`. If `to` is unreachable, walks to the reachable cell (explored
 * breadth-first, up to maxNodes) that is closest to the target. Never returns null.
 */
export function planRoute(fns: WalkFns, world: WorldModel, from: Cell, to: Cell, maxNodes: number): Route {
  if (sameCell(from, to)) return { steps: [], reached: true };
  if (fns.standable(world, to)) {
    const direct = fns.findPath(world, from, to, maxNodes);
    if (direct) return { steps: stripStart(direct, from), reached: true };
  }
  return { steps: closestReachable(fns, world, from, to, maxNodes), reached: false };
}

function closestReachable(fns: WalkFns, world: WorldModel, from: Cell, to: Cell, maxNodes: number): Cell[] {
  const parents = new Map<string, Cell | null>([[cellKey(from), null]]);
  const queue: Cell[] = [from];
  let best = from;
  let bestD = distance2(from, to);
  for (let head = 0; head < queue.length && parents.size < maxNodes; head++) {
    const cur = queue[head] as Cell;
    for (const next of fns.neighbors(world, cur)) {
      const k = cellKey(next);
      if (parents.has(k)) continue;
      parents.set(k, cur);
      queue.push(next);
      const d = distance2(next, to);
      if (d < bestD) {
        bestD = d;
        best = next;
      }
    }
  }
  const steps: Cell[] = [];
  for (let c: Cell | null = best; c && !sameCell(c, from); c = parents.get(cellKey(c)) ?? null) steps.unshift(c);
  return steps;
}

/**
 * Stuck recovery: the nearest standable cell to `cell`. Prefers climbing straight up the
 * column (a block was placed on the actor: it hops on top), then searches outward in
 * growing shells. Returns `fallback` if nothing is found within `maxRadius`.
 */
export function nearestStandable(
  isStandable: (cell: Cell) => boolean,
  cell: Cell,
  maxRadius: number,
  maxY: number,
  fallback: Cell,
): Cell {
  if (isStandable(cell)) return cell;
  for (let dy = 1; dy <= 3 && cell.y + dy < maxY; dy++) {
    const up = { x: cell.x, y: cell.y + dy, z: cell.z };
    if (isStandable(up)) return up;
  }
  for (let r = 1; r <= maxRadius; r++) {
    let best: Cell | null = null;
    let bestScore = Infinity;
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        for (let dy = -r; dy <= r; dy++) {
          if (Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) !== r) continue;
          const c = { x: cell.x + dx, y: cell.y + dy, z: cell.z + dz };
          if (c.y < 0 || c.y >= maxY || !isStandable(c)) continue;
          // Prefer horizontal moves and going up over dropping down.
          const score = dx * dx + dz * dz + (dy < 0 ? 2 * dy * dy : 0.5 * dy * dy);
          if (score < bestScore) {
            bestScore = score;
            best = c;
          }
        }
      }
    }
    if (best) return best;
  }
  return fallback;
}

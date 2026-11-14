import type { Cell, WorldModel } from '../core/types';

/**
 * Pure walking rules for the big-kid character (2 cells tall, no jumping, no falling).
 *
 * - A cell is standable when it is in bounds and empty, the cell above is empty (headroom;
 *   above the world top counts as open sky) and there is a solid block right below it.
 * - Moves go in the 4 horizontal directions, staying level or stepping up/down by 1.
 *   Stepping up also needs headroom above the current cell (y + 2); stepping down needs the
 *   cell above the target (at the current head height) to be empty.
 * - The character can never step off an edge, so falling is impossible.
 */

type WalkWorld = Pick<WorldModel, 'get' | 'inBounds' | 'size'>;

/** Default node budget for findPath (enough for any path across a 96x96 world). */
export const DEFAULT_MAX_NODES = 20_000;

const DIRECTIONS: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

const at = (x: number, y: number, z: number): Cell => ({ x, y, z });

function empty(world: WalkWorld, x: number, y: number, z: number): boolean {
  return world.get(at(x, y, z)) === null;
}

export function standable(world: WalkWorld, cell: Cell): boolean {
  const { x, y, z } = cell;
  if (!world.inBounds(cell) || y < 1) return false;
  return empty(world, x, y, z) && empty(world, x, y + 1, z) && world.get(at(x, y - 1, z)) !== null;
}

/** Cells reachable in one step from `cell` (at most one per direction). */
export function neighbors(world: WalkWorld, cell: Cell): Cell[] {
  const out: Cell[] = [];
  const { x, y, z } = cell;
  for (const [dx, dz] of DIRECTIONS) {
    const nx = x + dx;
    const nz = z + dz;
    const level = at(nx, y, nz);
    if (standable(world, level)) {
      out.push(level);
      continue;
    }
    const up = at(nx, y + 1, nz);
    if (standable(world, up) && empty(world, x, y + 2, z)) {
      out.push(up);
      continue;
    }
    const down = at(nx, y - 1, nz);
    if (standable(world, down) && empty(world, nx, y + 1, nz)) out.push(down);
  }
  return out;
}

function keyOf(world: WalkWorld, c: Cell): number {
  return c.x + c.z * world.size.x + c.y * world.size.x * world.size.z;
}

function heuristic(a: Cell, b: Cell): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z);
}

/** Minimal binary min-heap of [priority, key] pairs. */
class MinHeap {
  private readonly items: [number, number][] = [];
  get size(): number {
    return this.items.length;
  }
  push(priority: number, key: number): void {
    const items = this.items;
    items.push([priority, key]);
    let i = items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (items[parent][0] <= items[i][0]) break;
      [items[parent], items[i]] = [items[i], items[parent]];
      i = parent;
    }
  }
  pop(): number {
    const items = this.items;
    const top = items[0][1];
    const last = items.pop() as [number, number];
    if (items.length > 0) {
      items[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < items.length && items[l][0] < items[m][0]) m = l;
        if (r < items.length && items[r][0] < items[m][0]) m = r;
        if (m === i) break;
        [items[m], items[i]] = [items[i], items[m]];
        i = m;
      }
    }
    return top;
  }
}

/**
 * A* path from `from` to `to` using the walk rules. Returns the cells from start to goal
 * (inclusive), or null when `to` is not standable, unreachable, or the search expands more
 * than `maxNodes` cells. `from` itself does not need to be standable.
 */
export function findPath(world: WalkWorld, from: Cell, to: Cell, maxNodes = DEFAULT_MAX_NODES): Cell[] | null {
  if (!world.inBounds(from) || !standable(world, to)) return null;
  const startKey = keyOf(world, from);
  const goalKey = keyOf(world, to);
  if (startKey === goalKey) return [at(from.x, from.y, from.z)];
  const cells = new Map<number, Cell>([[startKey, at(from.x, from.y, from.z)]]);
  const cost = new Map<number, number>([[startKey, 0]]);
  const cameFrom = new Map<number, number>();
  const closed = new Set<number>();
  const open = new MinHeap();
  open.push(heuristic(from, to), startKey);
  while (open.size > 0) {
    const key = open.pop();
    if (closed.has(key)) continue;
    if (key === goalKey) return rebuild(cameFrom, cells, key);
    closed.add(key);
    if (closed.size > maxNodes) return null;
    const current = cells.get(key) as Cell;
    const g = (cost.get(key) as number) + 1;
    for (const next of neighbors(world, current)) {
      const nk = keyOf(world, next);
      if (closed.has(nk) || g >= (cost.get(nk) ?? Infinity)) continue;
      cost.set(nk, g);
      cells.set(nk, next);
      cameFrom.set(nk, key);
      open.push(g + heuristic(next, to), nk);
    }
  }
  return null;
}

function rebuild(cameFrom: Map<number, number>, cells: Map<number, Cell>, goal: number): Cell[] {
  const path: Cell[] = [];
  let k: number | undefined = goal;
  while (k !== undefined) {
    path.push(cells.get(k) as Cell);
    k = cameFrom.get(k);
  }
  return path.reverse();
}

/** Every standable cell reachable on foot from `from` (flood fill), as dense cell keys. */
export function reachableKeys(world: WalkWorld, from: Cell, maxNodes = Infinity): Set<number> {
  const seen = new Set<number>();
  if (!standable(world, from)) return seen;
  seen.add(keyOf(world, from));
  const queue: Cell[] = [from];
  for (let head = 0; head < queue.length && seen.size < maxNodes; head++) {
    for (const next of neighbors(world, queue[head])) {
      const k = keyOf(world, next);
      if (seen.has(k)) continue;
      seen.add(k);
      queue.push(next);
    }
  }
  return seen;
}

/** True when a character standing at `from` can walk to `to`. Pure; no node cap. */
export function isReachable(world: WalkWorld, from: Cell, to: Cell): boolean {
  if (!standable(world, from) || !standable(world, to)) return false;
  return findPath(world, from, to, Number.MAX_SAFE_INTEGER) !== null;
}

/** Dense key of a cell in this world (matches reachableKeys). */
export function walkKey(world: WalkWorld, c: Cell): number {
  return keyOf(world, c);
}

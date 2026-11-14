import type { Cell } from '../core/types';
import type { DenseGrid } from './denseGrid';
import { FLOOR_Y } from './grid';

/**
 * Hard cap on cells visited by one smash's collapse searches. Past it the search gives up and
 * that structure counts as supported, so nothing extra falls (the safe answer: the child only
 * loses the block they tapped, which undo restores). Real searches dive towards the floor first
 * and end in a handful of steps; a toppling chunk bigger than this would be a heavy, surprising
 * loss on a tablet anyway, and the cap keeps one tap cheap on the iPad.
 */
export const MAX_TOPPLE_SEARCH = 2_500;

const FACE_OFFSETS: readonly (readonly [number, number, number])[] = [
  [0, 1, 0],
  [1, 0, 0],
  [-1, 0, 0],
  [0, 0, 1],
  [0, 0, -1],
  [0, -1, 0],
];

/**
 * Topple rule (smash with "topple towers" on)
 * -------------------------------------------
 * The world has no gravity: kids may stick blocks in mid-air on the side of other blocks.
 * "Supported" means face-connected (through occupied cells) to any block on the floor layer
 * (y = 0). When a block at `removed` is smashed:
 *
 * 1. Run a search from each occupied face neighbour of the removed cell. Each search is a
 *    depth-first walk that tries "down" first, so for normal builds it reaches the floor in a
 *    handful of steps and stops early. A search that touches a cell already claimed by an
 *    earlier, supported search is supported too (same component).
 * 2. If NO neighbour reaches the floor, the smashed block's component was already floating
 *    before the smash (a mid-air sculpture). Nothing extra falls: it never had support, so it
 *    did not lose any. This keeps "no gravity" for floating builds and never surprises the
 *    child by deleting a whole sculpture.
 * 3. Otherwise, every neighbour component that did NOT reach the floor has just lost its
 *    support and falls (all its cells are returned). Unrelated floating blocks elsewhere are
 *    never visited and never fall.
 *
 * A search that hits MAX_TOPPLE_SEARCH counts as supported (fail safe).
 */
export class ToppleSearch {
  private marks: Uint32Array | null = null;
  private generation = 0;

  constructor(private readonly grid: DenseGrid) {}

  /** Call after `removed` has been cleared. Returns the cells that must fall (may be empty). */
  collapse(removed: Cell): Cell[] {
    const marks = this.nextGeneration();
    const base = this.generation;
    const supported: boolean[] = [];
    const falling: number[][] = [];
    let anySupported = false;
    let budget = MAX_TOPPLE_SEARCH;

    FACE_OFFSETS.forEach(([dx, dy, dz], k) => {
      const x = removed.x + dx;
      const y = removed.y + dy;
      const z = removed.z + dz;
      if (this.grid.idAt(x, y, z) === 0) return;
      const start = this.grid.index(x, y, z);
      if (marks[start] >= base) return; // already part of an earlier search's component
      const result = this.search(start, base + k, base, supported, budget);
      budget -= result.visited.length;
      supported[k] = result.supported;
      if (result.supported) anySupported = true;
      else falling.push(result.visited);
    });

    if (!anySupported) return [];
    const size = this.grid.size;
    const layer = size.x * size.z;
    const out: Cell[] = [];
    for (const component of falling) {
      for (const i of component) {
        const y = Math.floor(i / layer);
        const rest = i - y * layer;
        const z = Math.floor(rest / size.x);
        out.push({ x: rest - z * size.x, y, z });
      }
    }
    return out;
  }

  private search(
    start: number,
    mark: number,
    base: number,
    supported: readonly boolean[],
    budget: number,
  ): { supported: boolean; visited: number[] } {
    const marks = this.marks as Uint32Array;
    const { x: sx, z: sz } = this.grid.size;
    const layer = sx * sz;
    const visited: number[] = [start];
    const stack: number[] = [start];
    marks[start] = mark;
    while (stack.length > 0) {
      if (visited.length > budget) return { supported: true, visited };
      const i = stack.pop() as number;
      const y = Math.floor(i / layer);
      if (y === FLOOR_Y) return { supported: true, visited };
      const rest = i - y * layer;
      const z = Math.floor(rest / sx);
      const x = rest - z * sx;
      // Pushed last = popped first, so "down" (last offset) is explored first.
      for (const [dx, dy, dz] of FACE_OFFSETS) {
        const nx = x + dx;
        const ny = y + dy;
        const nz = z + dz;
        if (this.grid.idAt(nx, ny, nz) === 0) continue;
        const n = this.grid.index(nx, ny, nz);
        const m = marks[n];
        if (m === mark) continue;
        if (m >= base) {
          // Touches an earlier search of this smash. Earlier falling searches explored their
          // whole component, so reaching one means we started inside it (handled by caller).
          // Reaching an earlier supported search means we are connected to the floor.
          if (supported[m - base]) return { supported: true, visited };
          continue;
        }
        marks[n] = mark;
        visited.push(n);
        stack.push(n);
      }
    }
    return { supported: false, visited };
  }

  private nextGeneration(): Uint32Array {
    if (!this.marks) this.marks = new Uint32Array(volume(this.grid));
    this.generation += 8;
    if (this.generation > 0xffffffff - 16) {
      this.marks.fill(0);
      this.generation = 8;
    }
    return this.marks;
  }
}

function volume(grid: DenseGrid): number {
  return grid.size.x * grid.size.y * grid.size.z;
}

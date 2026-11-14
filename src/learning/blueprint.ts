/**
 * Step-by-step builds (blueprints), pure logic: where the ghosts go, which
 * placed blocks count, which step the child is on, and where a build fits.
 * Progress is always derived from the world, so undo and smash simply bring
 * the missing ghosts back.
 */
import type { BlockKey, Blueprint, Cell, GhostBlock, WorldSize } from '../core/types';
import type { BlockLookup } from './grid';
import { packOf } from './grid';

export interface BlueprintStatus {
  /** 0-based index of the step being built; equals stepCount when done. */
  readonly stepIndex: number;
  readonly stepCount: number;
  readonly done: boolean;
  /** Ghosts still missing in the current step (empty when done). */
  readonly missing: readonly GhostBlock[];
}

/** World cells of every step, offset by the anchor. */
export function placeSteps(bp: Blueprint, anchor: Cell): GhostBlock[][] {
  return bp.steps.map((step) =>
    step.blocks.map((b) => ({
      cell: { x: anchor.x + b.x, y: anchor.y + b.y, z: anchor.z + b.z },
      block: b.block,
      ...(b.rot ? { rot: b.rot } : {}),
    })),
  );
}

/**
 * Does `actual` count for a ghost that wants `expected`? Difficulty 1 accepts
 * any block from the same pack (so a little builder can always finish);
 * difficulty 2 and 3 need the exact block. Rotation never matters.
 */
export function blockMatches(expected: BlockKey, actual: BlockKey | null, difficulty: Blueprint['difficulty']): boolean {
  if (!actual) return false;
  if (actual === expected) return true;
  return difficulty === 1 && packOf(actual) === packOf(expected);
}

/** Where the child is in the build: the first step that still has missing blocks. */
export function evaluateBlueprint(bp: Blueprint, anchor: Cell, get: BlockLookup): BlueprintStatus {
  const steps = placeSteps(bp, anchor);
  for (let i = 0; i < steps.length; i++) {
    const missing = steps[i].filter((g) => !blockMatches(g.block, get(g.cell.x, g.cell.y, g.cell.z), bp.difficulty));
    if (missing.length > 0) return { stepIndex: i, stepCount: steps.length, done: false, missing };
  }
  return { stepIndex: steps.length, stepCount: steps.length, done: true, missing: [] };
}

/**
 * The block the current step needs next: lowest missing ghost first, preferring
 * cells that are still empty (a wrong block in a ghost cell stays put).
 */
export function suggestFrom(status: BlueprintStatus, get: BlockLookup): BlockKey | null {
  if (status.done || status.missing.length === 0) return null;
  const sorted = [...status.missing].sort((a, b) => a.cell.y - b.cell.y);
  const empty = sorted.find((g) => get(g.cell.x, g.cell.y, g.cell.z) === null);
  return (empty ?? sorted[0]).block;
}

/** Size of the blueprint's bounding box (cells start at 0). */
export function blueprintExtent(bp: Blueprint): { x: number; y: number; z: number } {
  const all = bp.steps.flatMap((s) => s.blocks);
  const max = (axis: 'x' | 'y' | 'z'): number => (all.length ? Math.max(...all.map((b) => b[axis])) + 1 : 0);
  return { x: max('x'), y: max('y'), z: max('z') };
}

/** True when every blueprint cell at `anchor` lies inside the world. */
export function fitsInWorld(bp: Blueprint, anchor: Cell, size: WorldSize): boolean {
  const e = blueprintExtent(bp);
  return (
    anchor.x >= 0 && anchor.y >= 0 && anchor.z >= 0 &&
    anchor.x + e.x <= size.x && anchor.y + e.y <= size.y && anchor.z + e.z <= size.z
  );
}

export interface AnchorWorld {
  readonly size: WorldSize;
  readonly get: BlockLookup;
}

export interface AnchorOptions {
  /** How far (in cells) from `near` to search. Default 8. */
  readonly radius?: number;
}

/** Spiral-ish search order: offsets sorted by distance from the center. */
function offsets(radius: number): [number, number][] {
  const out: [number, number][] = [];
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dz = -radius; dz <= radius; dz++) out.push([dx, dz]);
  }
  return out.sort((a, b) => a[0] ** 2 + a[1] ** 2 - (b[0] ** 2 + b[1] ** 2) || a[0] - b[0] || a[1] - b[1]);
}

/** Lowest empty y above the highest block in a column (0 when the column is empty). */
function surfaceFinder(world: AnchorWorld): (x: number, z: number) => number {
  const cache = new Map<string, number>();
  return (x, z) => {
    const k = `${x},${z}`;
    const hit = cache.get(k);
    if (hit !== undefined) return hit;
    let s = 0;
    for (let y = world.size.y - 1; y >= 0; y--) {
      if (world.get(x, y, z) !== null) {
        s = y + 1;
        break;
      }
    }
    cache.set(k, s);
    return s;
  };
}

/**
 * Finds where a blueprint can be built near `near`: a spot where its whole
 * footprint stands on solid ground at one height (flat), with room above, inside
 * the world. If no flat spot exists within the radius, accepts the best uneven
 * spot (footprint heights differ by at most 1; the build starts on the highest).
 * Returns the anchor (the build's (0,0,0) cell) or null when nothing fits.
 */
export function findBlueprintAnchor(bp: Blueprint, near: Cell, world: AnchorWorld, options: AnchorOptions = {}): Cell | null {
  const e = blueprintExtent(bp);
  if (e.x === 0 || e.x > world.size.x || e.y > world.size.y || e.z > world.size.z) return null;
  const surface = surfaceFinder(world);
  const order = offsets(options.radius ?? 8);
  for (const maxStep of [0, 1]) {
    for (const [dx, dz] of order) {
      const ax = near.x + dx - Math.floor((e.x - 1) / 2);
      const az = near.z + dz - Math.floor((e.z - 1) / 2);
      if (ax < 0 || az < 0 || ax + e.x > world.size.x || az + e.z > world.size.z) continue;
      let lo = Infinity;
      let hi = -Infinity;
      for (let x = ax; x < ax + e.x && hi - lo <= maxStep; x++) {
        for (let z = az; z < az + e.z; z++) {
          const s = surface(x, z);
          lo = Math.min(lo, s);
          hi = Math.max(hi, s);
        }
      }
      // Needs ground under every column (no building over the void) and room on top.
      if (lo === 0 || hi - lo > maxStep || hi + e.y > world.size.y) continue;
      return { x: ax, y: hi, z: az };
    }
  }
  return null;
}

/**
 * True when `anchor` can be used as given: every build cell is inside the world and either empty
 * or already holding a block that counts for it (a build can be resumed where it stands).
 */
export function isUsableAnchor(bp: Blueprint, anchor: Cell, world: AnchorWorld): boolean {
  if (![anchor.x, anchor.y, anchor.z].every(Number.isInteger)) return false;
  if (!fitsInWorld(bp, anchor, world.size)) return false;
  for (const step of placeSteps(bp, anchor)) {
    for (const g of step) {
      const actual = world.get(g.cell.x, g.cell.y, g.cell.z);
      if (actual !== null && !blockMatches(g.block, actual, bp.difficulty)) return false;
    }
  }
  return true;
}

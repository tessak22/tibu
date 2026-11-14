import type { Blueprint, Cell, Rotation, WorldModel } from '../core/types';

/**
 * The one place that decides where a step-by-step build goes. Learning receives the result
 * and uses it as-is (it only searches itself when handed an invalid anchor).
 */
export type AnchorPlace =
  /** Explore worlds: in front of the character, in the direction the camera faces. */
  | { readonly kind: 'explore'; readonly character: Cell; readonly facing: Rotation }
  /** Island worlds: near the middle of the view. */
  | { readonly kind: 'island'; readonly center: { readonly x: number; readonly z: number } };

type AnchorWorld = Pick<WorldModel, 'get' | 'inBounds' | 'size'>;
type BlueprintCell = Blueprint['steps'][number]['blocks'][number];

/** Cells between the character and the near edge of the build (2 to 4: always a walkable gap). */
export const FRONT_MIN = 2;
export const FRONT_MAX = 4;
/** The wider search, used only when nothing fits in front of the character / near the middle. */
const WIDE_RADIUS = 24;

/** Unit step for a facing: 0 north (-z), 1 east (+x), 2 south (+z), 3 west (-x) (see input/orbit). */
const FACING_STEP: Readonly<Record<Rotation, { readonly dx: number; readonly dz: number }>> = {
  0: { dx: 0, dz: -1 },
  1: { dx: 1, dz: 0 },
  2: { dx: 0, dz: 1 },
  3: { dx: -1, dz: 0 },
};

interface Footprint {
  readonly cells: readonly BlueprintCell[];
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly minZ: number;
  readonly maxZ: number;
}

function footprintOf(bp: Blueprint): Footprint | null {
  const cells = bp.steps.flatMap((s) => s.blocks);
  if (cells.length === 0) return null;
  const xs = cells.map((c) => c.x);
  const zs = cells.map((c) => c.z);
  return {
    cells,
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...cells.map((c) => c.y)),
    minZ: Math.min(...zs),
    maxZ: Math.max(...zs),
  };
}

/** Lowest empty y above the highest block in a column; 0 when the column is empty (no ground). */
function surfaceFinder(world: AnchorWorld): (x: number, z: number) => number {
  const cache = new Map<number, number>();
  return (x, z) => {
    const key = x * 4096 + z;
    const hit = cache.get(key);
    if (hit !== undefined) return hit;
    let s = 0;
    for (let y = world.size.y - 1; y >= 0; y--) {
      if (world.get({ x, y, z }) !== null) {
        s = y + 1;
        break;
      }
    }
    cache.set(key, s);
    return s;
  };
}

interface Candidate {
  /** World x/z of the footprint's min corner. */
  readonly x0: number;
  readonly z0: number;
}

/**
 * Anchor for a footprint whose min corner sits at (x0, z0), or null. Needs ground under every
 * column, heights that differ by at most `maxStep` (0 = flat), and every build cell in the world
 * and empty. `keepClear` columns (the character and its neighbours) are never covered.
 */
function anchorAt(
  world: AnchorWorld,
  fp: Footprint,
  c: Candidate,
  surface: (x: number, z: number) => number,
  maxStep: number,
  keepClear: Cell | null,
): Cell | null {
  let lo = Infinity;
  let hi = -Infinity;
  for (let x = c.x0; x <= c.x0 + fp.maxX - fp.minX; x++) {
    for (let z = c.z0; z <= c.z0 + fp.maxZ - fp.minZ; z++) {
      if (!world.inBounds({ x, y: 0, z })) return null;
      if (keepClear && Math.abs(x - keepClear.x) <= 1 && Math.abs(z - keepClear.z) <= 1) return null;
      const s = surface(x, z);
      lo = Math.min(lo, s);
      hi = Math.max(hi, s);
      if (lo === 0 || hi - lo > maxStep) return null;
    }
  }
  const anchor = { x: c.x0 - fp.minX, y: hi - fp.minY, z: c.z0 - fp.minZ };
  for (const b of fp.cells) {
    const cell = { x: anchor.x + b.x, y: anchor.y + b.y, z: anchor.z + b.z };
    if (!world.inBounds(cell) || world.get(cell) !== null) return null;
  }
  return anchor;
}

/** Lateral shifts in order: centered first, then alternating outwards. */
function lateralOrder(max: number): number[] {
  const out = [0];
  for (let i = 1; i <= max; i++) out.push(-i, i);
  return out;
}

/** Footprints 2 to 4 cells in front of the character, centered on its line of sight first. */
function frontCandidates(fp: Footprint, character: Cell, facing: Rotation): Candidate[] {
  const { dx, dz } = FACING_STEP[facing];
  const width = dx === 0 ? fp.maxX - fp.minX + 1 : fp.maxZ - fp.minZ + 1;
  const depth = dx === 0 ? fp.maxZ - fp.minZ + 1 : fp.maxX - fp.minX + 1;
  const center = Math.floor((width - 1) / 2);
  const out: Candidate[] = [];
  for (let dist = FRONT_MIN; dist <= FRONT_MAX; dist++) {
    for (const shift of lateralOrder(Math.max(1, center + 1))) {
      // Near edge `dist` cells ahead; the footprint extends further away from the character.
      const along = dist;
      const side = shift - center;
      if (dx !== 0) {
        const x0 = dx > 0 ? character.x + along : character.x - along - (depth - 1);
        out.push({ x0, z0: character.z + side });
      } else {
        const z0 = dz > 0 ? character.z + along : character.z - along - (depth - 1);
        out.push({ x0: character.x + side, z0 });
      }
    }
  }
  return out;
}

/** Footprints centered on offsets around (x, z), nearest first. */
function ringCandidates(fp: Footprint, at: { x: number; z: number }, radius: number): Candidate[] {
  const halfX = Math.floor((fp.maxX - fp.minX) / 2);
  const halfZ = Math.floor((fp.maxZ - fp.minZ) / 2);
  const offsets: [number, number][] = [];
  for (let dx = -radius; dx <= radius; dx++) for (let dz = -radius; dz <= radius; dz++) offsets.push([dx, dz]);
  offsets.sort((a, b) => a[0] ** 2 + a[1] ** 2 - (b[0] ** 2 + b[1] ** 2) || a[0] - b[0] || a[1] - b[1]);
  return offsets.map(([dx, dz]) => ({ x0: at.x + dx - halfX, z0: at.z + dz - halfZ }));
}

function firstFit(
  world: AnchorWorld,
  fp: Footprint,
  candidates: readonly Candidate[],
  surface: (x: number, z: number) => number,
  steps: readonly number[],
  keepClear: Cell | null,
): Cell | null {
  for (const maxStep of steps) {
    for (const c of candidates) {
      const anchor = anchorAt(world, fp, c, surface, maxStep, keepClear);
      if (anchor) return anchor;
    }
  }
  return null;
}

/**
 * Where a build goes. Explore: a free flat spot 2 to 4 cells in front of the character (never on
 * or next to it). Island: near the view centre. When nothing fits there, a wider search around the
 * same spot (flat first, then a step of one). Null only when the build fits nowhere nearby.
 */
export function chooseAnchor(world: AnchorWorld, bp: Blueprint, place: AnchorPlace): Cell | null {
  const fp = footprintOf(bp);
  if (!fp) return null;
  const surface = surfaceFinder(world);
  const radius = Math.min(WIDE_RADIUS, Math.max(world.size.x, world.size.z));
  if (place.kind === 'explore') {
    const front = frontCandidates(fp, place.character, place.facing);
    return (
      firstFit(world, fp, front, surface, [0], place.character) ??
      firstFit(world, fp, ringCandidates(fp, place.character, radius), surface, [0, 1], place.character)
    );
  }
  const near = ringCandidates(fp, place.center, Math.min(4, radius));
  return (
    firstFit(world, fp, near, surface, [0], null) ??
    firstFit(world, fp, ringCandidates(fp, place.center, radius), surface, [0, 1], null)
  );
}

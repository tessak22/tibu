import type { BlockKey, Cell } from '../../core/types';
import type { Writer } from './fill';
import type { Rng } from './noise';
import { col, VOID, type Terrain } from './terrain';

/**
 * Toy-like trees, bushes and flower clusters for explore worlds. Everything is ordinary blocks
 * (kids can smash or build on them), but shaped to read as soft, rounded toys rather than the
 * square leaf cubes on 1x1 trunks of other block games:
 * - round "puff" and "lollipop" canopies (diamond / rounded silhouettes, irregular, mixed leaves)
 * - "stacker" pines: wide-to-narrow tiers threaded on a round pillar, like a ring-stacking toy
 * - palms with star-shaped crowns (beach)
 * - trunks are round pillars from the parts pack
 * - low bushes and flower clusters made of plates, slabs and blooms
 */

export type TreeKind = 'puff' | 'lollipop' | 'blossom' | 'pine' | 'palm';

export interface FloraPalette {
  /** Round trunk (a cylinder part). */
  readonly trunk: BlockKey;
  /** Mixed canopy blocks for round trees. */
  readonly leaves: readonly BlockKey[];
  /** Tier blocks for stacker pines. */
  readonly pine: readonly BlockKey[];
  /** Sprinkled into blossom canopies. */
  readonly blossom: readonly BlockKey[];
  /** Pine tip (a cone part). */
  readonly topper: BlockKey;
  /** Snow caps the top of canopies (snow theme). */
  readonly snow: BlockKey | null;
  /** Tree kinds to pick from (repeat a kind to make it more common). */
  readonly kinds: readonly TreeKind[];
  /** Bush body blocks. */
  readonly bush: readonly BlockKey[];
  /** Low blooms: bush tops and flower clusters. */
  readonly blooms: readonly BlockKey[];
}

/** Ground clearance under a canopy: a 2-tall buddy fits and can still step up from there. */
export const CANOPY_CLEARANCE = 4;
/** Canopies reach this far from the trunk (decor footprint half-size). */
export const CANOPY_REACH = 2;
const MAX_TRUNK = 6;

type Mask = (dx: number, dz: number) => boolean;
type Role = 'leaf' | 'trunk' | 'tip';

interface Layer {
  readonly mask: Mask;
  readonly role: Role;
}

const dot: Mask = (dx, dz) => dx === 0 && dz === 0;
const plus: Mask = (dx, dz) => Math.abs(dx) + Math.abs(dz) <= 1;
const square: Mask = (dx, dz) => Math.abs(dx) <= 1 && Math.abs(dz) <= 1;
const diamond: Mask = (dx, dz) => Math.abs(dx) + Math.abs(dz) <= 2;
const star: Mask = (dx, dz) => (dx === 0 || dz === 0) && Math.abs(dx) + Math.abs(dz) <= 2;

const leaf = (mask: Mask): Layer => ({ mask, role: 'leaf' });
const TRUNK: Layer = { mask: dot, role: 'trunk' };
const TIP: Layer = { mask: dot, role: 'tip' };

/** Canopy layers, bottom to top, sitting on the trunk. */
const SHAPES: Record<TreeKind, readonly Layer[]> = {
  // Profile 3-5-3-1: an onion-round puff.
  puff: [leaf(plus), leaf(diamond), leaf(square), leaf(dot)],
  blossom: [leaf(plus), leaf(diamond), leaf(square), leaf(dot)],
  // Small and round, a little voxel ball: 3-3-3 with soft corners.
  lollipop: [leaf(plus), leaf(square), leaf(plus)],
  // Ring stacker: wide tier, pillar, smaller tier, pillar, little tier, cone tip.
  pine: [leaf(diamond), TRUNK, leaf(square), TRUNK, leaf(plus), TIP],
  palm: [leaf(star), leaf(dot)],
};

const TRUNK_RANGE: Record<TreeKind, readonly [number, number]> = {
  puff: [3, 4],
  blossom: [3, 4],
  lollipop: [3, 3],
  pine: [1, 2],
  palm: [5, 6],
};

export interface PlannedBlock {
  readonly cell: Cell;
  readonly block: BlockKey;
}

/** Canopy cells of a kind (dx, layer, dz, role), with a little seeded irregularity. */
export function canopyCells(kind: TreeKind, rng: Rng): { dx: number; dy: number; dz: number; role: Role }[] {
  const out: { dx: number; dy: number; dz: number; role: Role }[] = [];
  SHAPES[kind].forEach((layer, dy) => {
    for (let dz = -CANOPY_REACH; dz <= CANOPY_REACH; dz++) {
      for (let dx = -CANOPY_REACH; dx <= CANOPY_REACH; dx++) {
        if (!layer.mask(dx, dz)) continue;
        const rim = Math.abs(dx) + Math.abs(dz) >= 2 || (Math.abs(dx) === 1 && Math.abs(dz) === 1);
        // Nibble the rim of round canopies so no two trees share a silhouette.
        if (layer.role === 'leaf' && rim && kind !== 'pine' && kind !== 'palm' && rng.chance(0.22)) continue;
        out.push({ dx, dy, dz, role: layer.role });
      }
    }
  });
  return out;
}

const heightAt = (t: Terrain, x: number, z: number): number => {
  const i = col(t, x, z);
  return i < 0 ? VOID : t.height[i];
};

/**
 * Plans a tree with its trunk on column (x, z): trunk long enough that every canopy cell clears
 * the ground below it by CANOPY_CLEARANCE, so walking under (and stepping up from there) still
 * works. Returns null when it would be too tall, leave the world, or hit another block.
 */
export function planTree(
  t: Terrain,
  w: Pick<Writer, 'get'>,
  palette: FloraPalette,
  kind: TreeKind,
  x: number,
  z: number,
  rng: Rng,
  maxY: number,
): PlannedBlock[] | null {
  const h = heightAt(t, x, z);
  if (h === VOID) return null;
  const cells = canopyCells(kind, rng);
  const [lo, hi] = TRUNK_RANGE[kind];
  let base = h + 1 + rng.int(lo, hi);
  for (const c of cells) {
    if (c.dx === 0 && c.dz === 0) continue;
    const ground = heightAt(t, x + c.dx, z + c.dz);
    if (ground !== VOID) base = Math.max(base, ground + CANOPY_CLEARANCE - c.dy);
  }
  if (base - h - 1 > MAX_TRUNK) return null;
  const out: PlannedBlock[] = [];
  for (let y = h + 1; y < base; y++) out.push({ cell: { x, y, z }, block: palette.trunk });
  const topOf = new Map<string, number>();
  for (const c of cells) {
    const key = `${c.dx},${c.dz}`;
    topOf.set(key, Math.max(topOf.get(key) ?? -1, c.dy));
  }
  for (const c of cells) {
    const cell = { x: x + c.dx, y: base + c.dy, z: z + c.dz };
    out.push({ cell, block: blockFor(kind, c.role, c.dy === topOf.get(`${c.dx},${c.dz}`), palette, rng) });
  }
  for (const p of out) {
    if (p.cell.y > maxY || w.get(p.cell) !== null) return null;
  }
  return out;
}

function blockFor(kind: TreeKind, role: Role, top: boolean, palette: FloraPalette, rng: Rng): BlockKey {
  if (role === 'trunk') return palette.trunk;
  if (role === 'tip') return palette.snow && rng.chance(0.5) ? palette.snow : palette.topper;
  if (top && palette.snow && rng.chance(kind === 'pine' ? 0.3 : 0.5)) return palette.snow;
  if (kind === 'pine') return rng.pick(palette.pine);
  if (kind === 'blossom' && rng.chance(0.45)) return rng.pick(palette.blossom);
  return rng.pick(palette.leaves);
}

/** A low, round bush: a little clump with a bloom on top. Stays at most 2 blocks tall. */
export function planBush(t: Terrain, palette: FloraPalette, x: number, z: number, rng: Rng): PlannedBlock[] {
  const h = heightAt(t, x, z);
  if (h === VOID) return [];
  const out: PlannedBlock[] = [{ cell: { x, y: h + 1, z }, block: rng.pick(palette.bush) }];
  for (const [dx, dz] of rng.shuffle([[1, 0], [-1, 0], [0, 1], [0, -1]] as const).slice(0, rng.int(1, 3))) {
    if (heightAt(t, x + dx, z + dz) !== h) continue;
    out.push({ cell: { x: x + dx, y: h + 1, z: z + dz }, block: rng.pick(palette.bush) });
  }
  out.push({ cell: { x, y: h + 2, z }, block: rng.pick(palette.blooms) });
  return out;
}

/** A cluster of low blooms on level ground (one block tall, easy to walk over). */
export function planFlowers(t: Terrain, palette: FloraPalette, x: number, z: number, rng: Rng): PlannedBlock[] {
  const h = heightAt(t, x, z);
  if (h === VOID) return [];
  const out: PlannedBlock[] = [];
  for (const [dx, dz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]] as const) {
    if ((dx !== 0 || dz !== 0) && !rng.chance(0.55)) continue;
    if (heightAt(t, x + dx, z + dz) !== h) continue;
    out.push({ cell: { x: x + dx, y: h + 1, z: z + dz }, block: rng.pick(palette.blooms) });
  }
  return out;
}

/** Writes planned blocks into empty cells only. */
export function writePlan(w: Writer, plan: readonly PlannedBlock[]): void {
  for (const p of plan) if (w.get(p.cell) === null) w.seed(p.cell, p.block);
}

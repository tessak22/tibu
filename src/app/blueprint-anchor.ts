import type { Blueprint, Cell, WorldModel } from '../core/types';
import { standCell } from './world-factory';

type BlueprintCell = Blueprint['steps'][number]['blocks'][number];

const SEARCH_RADIUS = 14;

function allCells(bp: Blueprint): readonly BlueprintCell[] {
  return bp.steps.flatMap((s) => s.blocks);
}

/** Every blueprint cell is inside the world and empty, and the bottom layer rests on something. */
export function fits(world: Pick<WorldModel, 'get' | 'inBounds'>, bp: Blueprint, anchor: Cell, avoid: Cell | null): boolean {
  const cells = allCells(bp);
  if (cells.length === 0) return false;
  const minY = Math.min(...cells.map((c) => c.y));
  for (const b of cells) {
    const cell = { x: anchor.x + b.x, y: anchor.y + b.y, z: anchor.z + b.z };
    if (!world.inBounds(cell) || world.get(cell) !== null) return false;
    if (avoid && cell.x === avoid.x && cell.z === avoid.z && Math.abs(cell.y - avoid.y) <= 1) return false;
    if (b.y === minY) {
      const below = { ...cell, y: cell.y - 1 };
      if (!world.inBounds(below) || world.get(below) === null) return false;
    }
  }
  return true;
}

/**
 * Picks where a step-by-step build goes: the closest free, flat-enough spot to `near`
 * (the character in explore worlds, the island middle otherwise). Never fails: falls back to
 * the spot right at `near`, where ghosts may overlap blocks (the child can still build around).
 */
export function findAnchor(
  world: Pick<WorldModel, 'get' | 'inBounds' | 'size'>,
  bp: Blueprint,
  near: { readonly x: number; readonly z: number },
  avoid: Cell | null = null,
): Cell {
  const minY = Math.min(0, ...allCells(bp).map((c) => c.y));
  for (let r = 0; r <= SEARCH_RADIUS; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const stand = standCell(world, near.x + dx, near.z + dz);
        if (!stand) continue;
        const anchor = { ...stand, y: stand.y - minY };
        if (fits(world, bp, anchor, avoid)) return anchor;
      }
    }
  }
  return standCell(world, near.x, near.z) ?? { x: near.x, y: 1, z: near.z };
}

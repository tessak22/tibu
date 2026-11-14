import type { BlockKey, BuildCard, Cell } from '../core/types';
import type { BlockLookup } from './grid';

export interface PatternBlock {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly block: BlockKey;
}

/** Rotates a pattern by `quarterTurns` × 90° about the y axis. */
export function rotatePattern(pattern: readonly PatternBlock[], quarterTurns: number): PatternBlock[] {
  const turns = ((quarterTurns % 4) + 4) % 4;
  return pattern.map((b) => {
    let { x, z } = b;
    for (let i = 0; i < turns; i++) [x, z] = [-z, x];
    return { x, y: b.y, z, block: b.block };
  });
}

/** The pattern in each distinct orientation (0, 90, 180, 270 degrees). */
export function orientations(pattern: readonly PatternBlock[]): PatternBlock[][] {
  return [0, 1, 2, 3].map((t) => rotatePattern(pattern, t));
}

function matchesAt(get: BlockLookup, pattern: readonly PatternBlock[], ox: number, oy: number, oz: number): boolean {
  return pattern.every((b) => get(b.x + ox, b.y + oy, b.z + oz) === b.block);
}

/**
 * True if the card's pattern exists in the world with `cell` (holding `block`)
 * as one of its blocks. Translation and 90° turns about y are allowed; other
 * blocks around the pattern are ignored.
 */
export function cardMatchesAt(card: Pick<BuildCard, 'blocks'>, get: BlockLookup, cell: Cell, block: BlockKey): boolean {
  if (card.blocks.length === 0) return false;
  for (const pattern of orientations(card.blocks)) {
    for (const anchor of pattern) {
      if (anchor.block !== block) continue;
      if (matchesAt(get, pattern, cell.x - anchor.x, cell.y - anchor.y, cell.z - anchor.z)) return true;
    }
  }
  return false;
}

/** True if the card's pattern exists anywhere among `entries`. */
export function cardMatchesAnywhere(
  card: Pick<BuildCard, 'blocks'>, entries: Iterable<readonly [Cell, BlockKey]>, get: BlockLookup,
): boolean {
  for (const [cell, block] of entries) {
    if (cardMatchesAt(card, get, cell, block)) return true;
  }
  return false;
}

import type { ResolvedBlock } from '../core/types';

/**
 * Packs whose blocks are always named aloud when placed (their names are the
 * learning content: colors, shapes, letters, numbers, animals). Blocks from
 * any other pack are named only when they carry the 'speak' behavior.
 */
export const NAMED_PACKS: ReadonlySet<string> = new Set(['colors', 'shapes', 'letters', 'numbers', 'animals']);

export function shouldNameBlock(block: Pick<ResolvedBlock, 'packId' | 'behaviors'>): boolean {
  return block.behaviors.includes('speak') || NAMED_PACKS.has(block.packId);
}

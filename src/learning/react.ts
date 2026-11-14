import type { BlockKey, BuildCard, Cell, ResolvedBlock, Settings } from '../core/types';
import { cardMatchesAt } from './cards';
import { countToSay } from './counting';
import type { BlockLookup } from './grid';
import { shouldNameBlock } from './naming';
import { findSpelledWord } from './spelling';
import { PRIORITY, type Priority } from './scheduler';

export type Reaction =
  | { readonly kind: 'spelling'; readonly priority: Priority; readonly word: string; readonly cells: readonly Cell[] }
  | { readonly kind: 'card'; readonly priority: Priority; readonly card: BuildCard }
  | { readonly kind: 'counting'; readonly priority: Priority; readonly n: number }
  | { readonly kind: 'naming'; readonly priority: Priority; readonly lineId: string; readonly name: string };

export interface PlacementContext {
  readonly get: BlockLookup;
  readonly cell: Cell;
  readonly block: BlockKey;
  readonly info: Pick<ResolvedBlock, 'packId' | 'behaviors' | 'voiceLine' | 'name'>;
  readonly learning: Settings['learning'];
  readonly words: ReadonlySet<string>;
  /** Active card that has not been matched yet. */
  readonly card: BuildCard | null;
  /** Highest number counted aloud (16 little mode, 32 big mode). */
  readonly maxCount?: number;
}

/** Every learning reaction to one placement, highest priority first (pure). */
export function reactionsFor(p: PlacementContext): Reaction[] {
  const out: Reaction[] = [];
  if (p.learning.spelling) {
    const spelled = findSpelledWord(p.get, p.cell, p.words);
    if (spelled) out.push({ kind: 'spelling', priority: PRIORITY.spelling, word: spelled.word, cells: spelled.cells });
  }
  if (p.learning.buildCards && p.card && cardMatchesAt(p.card, p.get, p.cell, p.block)) {
    out.push({ kind: 'card', priority: PRIORITY.card, card: p.card });
  }
  if (p.learning.counting) {
    const n = countToSay(p.get, p.cell, p.maxCount);
    if (n !== null) out.push({ kind: 'counting', priority: PRIORITY.counting, n });
  }
  if (p.learning.naming && shouldNameBlock(p.info)) {
    out.push({ kind: 'naming', priority: PRIORITY.naming, lineId: p.info.voiceLine, name: p.info.name });
  }
  return out;
}

/** Play-mode filters for content. Pure. */
import type { BuildCard, PlayMode, ResolvedPack } from '../core/types';

/** Packs offered in a play mode: packs without a mode show everywhere. */
export function packsForMode<P extends Pick<ResolvedPack, 'mode'>>(packs: readonly P[], mode: PlayMode): P[] {
  return packs.filter((p) => p.mode === undefined || p.mode === mode);
}

/** Cards shown in a play mode: cards without a mode belong to 'little'. */
export function cardsForMode<C extends Pick<BuildCard, 'mode'>>(cards: readonly C[], mode: PlayMode): C[] {
  return cards.filter((c) => (c.mode ?? 'little') === mode);
}

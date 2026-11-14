import type { AudioSystem, BuildCard } from '../core/types';
import type { LearningSystem } from '../learning/types';
import { CARD_CLEAR_MS } from './config';

export interface CardCycler {
  /** Shows the next card; after the last card, dismisses. */
  next(): void;
  clear(): void;
  dispose(): void;
}

export interface CardCyclerOptions {
  readonly cards: readonly BuildCard[];
  readonly learning: Pick<LearningSystem, 'setActiveCard' | 'onCardMatched' | 'cardPicture'>;
  readonly audio: Pick<AudioSystem, 'sfx' | 'speak'>;
  readonly show: (picture: HTMLCanvasElement | null) => void;
  readonly pictureSize?: number;
}

/** Build-card button logic: tap shows a card, tap again cycles, past the last card dismisses. */
export function createCardCycler(opts: CardCyclerOptions): CardCycler {
  let index = -1;
  let clearTimer: ReturnType<typeof setTimeout> | null = null;

  const cancelTimer = (): void => {
    if (clearTimer !== null) clearTimeout(clearTimer);
    clearTimer = null;
  };

  const clear = (): void => {
    cancelTimer();
    opts.learning.setActiveCard(null);
    opts.show(null);
  };

  const off = opts.learning.onCardMatched(() => {
    cancelTimer();
    clearTimer = setTimeout(clear, CARD_CLEAR_MS);
  });

  return {
    next() {
      cancelTimer();
      if (opts.cards.length === 0) return;
      index += 1;
      const card = opts.cards[index];
      if (!card) {
        index = -1;
        opts.audio.sfx('ui');
        clear();
        return;
      }
      opts.audio.sfx('ui');
      opts.learning.setActiveCard(card);
      opts.show(opts.learning.cardPicture(card, opts.pictureSize ?? 192));
      void opts.audio.speak('card-show');
    },
    clear,
    dispose() {
      cancelTimer();
      off();
      opts.learning.setActiveCard(null);
    },
  };
}

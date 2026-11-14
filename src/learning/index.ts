/**
 * Learning features layered on play: naming, counting, spelling, build cards
 * and celebrations. Always optional (Settings.learning) and never a failure.
 */
import type { AudioSystem, BuildCard, Cell, ContentRegistry, GameView, GameViewEvents, Settings, WorldModel } from '../core/types';
import { countLine, randomCelebrateLine, wordLine } from '../audio/lineIds';
import { drawCardPicture } from './cardPicture';
import { lookupFromWorld } from './grid';
import { reactionsFor, type Reaction } from './react';
import { createSpeechScheduler } from './scheduler';
import { buildWordSet } from './spelling';
import type { LearningSystem } from './types';
import { BUILTIN_WORDS } from './words';

export type { LearningSystem } from './types';
export { createPlayTimer, type PlayTimer } from './sleep';
export { BUILTIN_WORDS } from './words';

export interface LearningDeps {
  readonly view: GameView;
  readonly getWorld: () => WorldModel | null;
  readonly audio: AudioSystem;
  readonly registry: ContentRegistry;
  readonly getSettings: () => Settings;
}

/** Pause between the spoken word and the celebration phrase. */
const PHRASE_GAP_MS = 250;

function middle(cells: readonly Cell[]): Cell | undefined {
  return cells[Math.floor(cells.length / 2)];
}

export function createLearning(deps: LearningDeps): LearningSystem {
  const { view, audio, registry } = deps;
  const scheduler = createSpeechScheduler();
  const cardListeners = new Set<(card: BuildCard) => void>();
  let activeCard: BuildCard | null = null;
  let cardMatched = false;
  let wordsKey = '';
  let words: ReadonlySet<string> = new Set();
  let disposed = false;

  const wordSet = (custom: readonly string[]): ReadonlySet<string> => {
    const key = custom.join(',');
    if (key !== wordsKey || words.size === 0) {
      words = buildWordSet(BUILTIN_WORDS, custom);
      wordsKey = key;
    }
    return words;
  };

  const celebrateVisually = (at: Cell | undefined): void => {
    view.confetti(at);
    audio.sfx('celebrate');
  };

  const sayThenCheer = (first: (() => Promise<void>) | null): void => {
    const cheer = (): void => {
      if (!disposed) void audio.speak(randomCelebrateLine());
    };
    if (!first) {
      cheer();
      return;
    }
    void first().then(() => setTimeout(cheer, PHRASE_GAP_MS));
  };

  const speakReaction = (r: Reaction): void => {
    switch (r.kind) {
      case 'spelling': {
        const known = BUILTIN_WORDS.includes(r.word);
        sayThenCheer(() => (known ? audio.speak(wordLine(r.word), r.word.toLowerCase()) : audio.speakText(r.word.toLowerCase())));
        return;
      }
      case 'card':
        sayThenCheer(null);
        return;
      case 'counting': {
        const line = countLine(r.n);
        if (line) void audio.speak(line, String(r.n));
        return;
      }
      case 'naming':
        void audio.speak(r.lineId, r.name);
        return;
    }
  };

  const onPlaced = ({ cell, block }: GameViewEvents['placed']): void => {
    const world = deps.getWorld();
    if (!world || disposed) return;
    const settings = deps.getSettings();
    const reactions = reactionsFor({
      get: lookupFromWorld(world),
      cell,
      block,
      info: registry.block(block),
      learning: settings.learning,
      words: wordSet(settings.customWords),
      card: cardMatched ? null : activeCard,
    });

    // Visual celebrations and card notifications happen right away.
    for (const r of reactions) {
      if (r.kind === 'spelling') celebrateVisually(middle(r.cells));
      if (r.kind === 'card') {
        cardMatched = true;
        if (!reactions.some((x) => x.kind === 'spelling')) celebrateVisually(cell);
        for (const listener of [...cardListeners]) listener(r.card);
      }
    }

    const top = reactions[0];
    if (top) scheduler.submit({ priority: top.priority, run: () => speakReaction(top) });
  };

  const unsubscribe = view.on('placed', onPlaced);

  return {
    setActiveCard(card) {
      activeCard = card;
      cardMatched = false;
    },
    onCardMatched(listener) {
      cardListeners.add(listener);
      return () => {
        cardListeners.delete(listener);
      };
    },
    cardPicture(card, size) {
      return drawCardPicture(card.blocks, registry, size);
    },
    dispose() {
      disposed = true;
      unsubscribe();
      scheduler.dispose();
      cardListeners.clear();
    },
  };
}

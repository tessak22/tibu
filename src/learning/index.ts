/**
 * Learning features layered on play: naming, counting, spelling, build cards,
 * step-by-step builds (big-kid mode), topple fun and celebrations. Always optional (Settings.learning) and never a failure.
 */
import type { AudioSystem, BuildCard, Cell, ContentRegistry, GameView, GameViewEvents, PlayMode, Settings, WorldModel } from '../core/types';
import { randomCelebrateLine, wordLine } from '../audio/lineIds';
import { blueprintPicture } from '../content/blueprint-picture';
import { createBlueprintController } from './blueprint-controller';
import { drawCardPicture } from './cardPicture';
import { createCrashGate } from './crash';
import { lookupFromWorld } from './grid';
import { reactionsFor, type Reaction } from './react';
import { countLineUpTo, maxCountFor, randomCrashLine } from './lines';
import { createSpeechScheduler, PRIORITY } from './scheduler';
import { buildWordSet } from './spelling';
import type { LearningSystem } from './types';
import { ALL_BUILTIN_WORDS, builtInWordsFor } from './words';

export type { BlueprintProgressListener, LearningSystem } from './types';
export { createPlayTimer, type PlayTimer } from './sleep';
export { BIG_WORDS, BUILTIN_WORDS, builtInWordsFor } from './words';
export { findBlueprintAnchor, evaluateBlueprint, blockMatches } from './blueprint';
export { BLUEPRINT_START_LINE, EXPLORE_LINES } from './lines';
export { cardsForMode, packsForMode } from '../content/modes';

export interface LearningDeps {
  readonly view: GameView;
  readonly getWorld: () => WorldModel | null;
  readonly audio: AudioSystem;
  readonly registry: ContentRegistry;
  readonly getSettings: () => Settings;
  /** Current child's play mode ('little' keeps the original toddler behaviour). */
  readonly getMode: () => PlayMode;
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

  const crashGate = createCrashGate();
  const blueprints = createBlueprintController({ view, audio, getWorld: deps.getWorld, getMode: deps.getMode, scheduler });

  const wordSet = (custom: readonly string[], mode: PlayMode): ReadonlySet<string> => {
    const key = `${mode}|${custom.join(',')}`;
    if (key !== wordsKey || words.size === 0) {
      words = buildWordSet(builtInWordsFor(mode), custom);
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
        const known = ALL_BUILTIN_WORDS.includes(r.word);
        sayThenCheer(() => (known ? audio.speak(wordLine(r.word), r.word.toLowerCase()) : audio.speakText(r.word.toLowerCase())));
        return;
      }
      case 'card':
        sayThenCheer(null);
        return;
      case 'counting': {
        const line = countLineUpTo(r.n);
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
    const mode = deps.getMode();
    const reactions = reactionsFor({
      get: lookupFromWorld(world),
      cell,
      block,
      info: registry.block(block),
      learning: settings.learning,
      words: wordSet(settings.customWords, mode),
      card: cardMatched ? null : activeCard,
      maxCount: maxCountFor(mode),
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

  const onSmashed = ({ collapsed }: GameViewEvents['smashed']): void => {
    if (disposed || !crashGate.shouldCheer(collapsed)) return;
    scheduler.submit({ priority: PRIORITY.crash, run: () => void audio.speak(randomCrashLine()) });
  };

  const unsubscribers = [view.on('placed', onPlaced), view.on('smashed', onSmashed)];

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
    setBlueprint(bp, anchor) {
      return blueprints.set(bp, anchor);
    },
    onBlueprintProgress(listener) {
      return blueprints.onProgress(listener);
    },
    suggestBlock() {
      return blueprints.suggest();
    },
    blueprintPicture(bp, size, upToStep) {
      return blueprintPicture(bp, size, registry, upToStep);
    },
    dispose() {
      disposed = true;
      for (const off of unsubscribers) off();
      blueprints.dispose();
      scheduler.dispose();
      cardListeners.clear();
    },
  };
}

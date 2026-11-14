import type { AudioSystem, ContentRegistry, GameView, WorldModel } from '../core/types';

/** Extra crash layers when a tower topples (the spoken crash line comes from learning). */
export const CRASH_LAYER_MS = [70, 150] as const;

export interface ViewEventOptions {
  /** Whether smashing knocks down what rests on the smashed block (big-kid mode + setting). */
  readonly topple?: () => boolean;
}

/**
 * Wires GameView taps to the world model and to audio. Placement and smashing are applied
 * idempotently, so this works whether or not the view already changed the model.
 */
export function wireViewEvents(
  view: GameView,
  world: WorldModel,
  audio: AudioSystem,
  registry: ContentRegistry,
  options: ViewEventOptions = {},
): () => void {
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const later = (ms: number, run: () => void): void => {
    const t = setTimeout(() => {
      timers.delete(t);
      run();
    }, ms);
    timers.add(t);
  };

  const offs = [
    view.on('placed', ({ cell, block, rot }) => {
      if (world.get(cell) !== block) world.place(cell, block, rot);
      audio.sfx('place');
    }),
    view.on('smashed', ({ cell, block, collapsed }) => {
      if (world.get(cell) === block) world.smash(cell, { topple: options.topple?.() ?? false });
      audio.sfx('smash');
      if (collapsed > 0) {
        // A bigger, rumbling crash: the same soft smash layered, plus a whoosh of falling blocks.
        later(CRASH_LAYER_MS[0], () => audio.sfx('whoosh'));
        later(CRASH_LAYER_MS[1], () => audio.sfx('smash'));
      }
    }),
    view.on('tappedBlock', ({ cell, block }) => {
      const def = registry.block(block);
      if (def.behaviors.includes('sound') && def.tapSound) audio.play(def.tapSound);
      if (def.behaviors.includes('bounce')) view.bounce(cell);
    }),
    view.on('tappedEmpty', () => audio.sfx('tap')),
  ];
  return () => {
    offs.forEach((off) => off());
    timers.forEach((t) => clearTimeout(t));
    timers.clear();
  };
}

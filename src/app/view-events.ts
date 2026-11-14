import type { AudioSystem, ContentRegistry, GameView, WorldModel } from '../core/types';

/**
 * Wires GameView taps to the world model and to audio. Placement and smashing are applied
 * idempotently, so this works whether or not the view already changed the model.
 */
export function wireViewEvents(
  view: GameView,
  world: WorldModel,
  audio: AudioSystem,
  registry: ContentRegistry,
): () => void {
  const offs = [
    view.on('placed', ({ cell, block }) => {
      if (world.get(cell) !== block) world.place(cell, block);
      audio.sfx('place');
    }),
    view.on('smashed', ({ cell, block }) => {
      if (world.get(cell) === block) world.remove(cell);
      audio.sfx('smash');
    }),
    view.on('tappedBlock', ({ cell, block }) => {
      const def = registry.block(block);
      if (def.behaviors.includes('sound') && def.tapSound) audio.play(def.tapSound);
      if (def.behaviors.includes('bounce')) view.bounce(cell);
    }),
    view.on('tappedEmpty', () => audio.sfx('tap')),
  ];
  return () => offs.forEach((off) => off());
}

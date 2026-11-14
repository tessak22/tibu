import type { GameView, GhostBlock } from '../core/types';

export interface TrackedView<V extends GameView> {
  /** The same view; setGhosts calls are remembered. */
  readonly view: V;
  /** The ghosts currently shown (for tests and the app). */
  ghosts(): readonly GhostBlock[];
}

/**
 * Wraps a GameView so the app knows which ghost blocks are showing (learning sets them).
 * Every other call goes straight to the real view.
 */
export function trackGhosts<V extends GameView>(view: V): TrackedView<V> {
  let shown: readonly GhostBlock[] = [];
  const wrapper = Object.create(view) as V;
  Object.defineProperty(wrapper, 'setGhosts', {
    value: (ghosts: readonly GhostBlock[] | null) => {
      shown = ghosts ? [...ghosts] : [];
      view.setGhosts(ghosts);
    },
  });
  return { view: wrapper, ghosts: () => shown };
}

import type { Cell, GhostBlock, Mode, PlayMode } from '../core/types';
import { testHookEnabled } from '../render/testHook';

/** Extra test-only probes the app layer adds to window.__tibuTest (render owns the base hook). */
export interface ExploreTestProbes {
  characterCell(): Cell | null;
  ghosts(): readonly GhostBlock[];
  playMode(): PlayMode;
  mode(): Mode;
  worldKind(): 'island' | 'explore';
  /** Highest y index (size.y - 1) of the open world. */
  maxY(): number;
}

declare module '../render/testHook' {
  interface TibuTestHook {
    characterCell?(): Cell | null;
    ghosts?(): readonly GhostBlock[];
    playMode?(): PlayMode;
    mode?(): Mode;
    worldKind?(): 'island' | 'explore';
    maxY?(): number;
  }
}

/**
 * Adds the app's probes to the existing hook while a play session is open (dev/test builds or
 * ?test only). Returns a remover that takes them away again.
 */
export function installExploreProbes(probes: ExploreTestProbes): () => void {
  if (!testHookEnabled()) return () => undefined;
  const hook = window.__tibuTest;
  if (!hook) return () => undefined;
  Object.assign(hook, probes);
  return () => {
    if (window.__tibuTest !== hook) return;
    for (const key of Object.keys(probes) as (keyof ExploreTestProbes)[]) {
      if (hook[key] === probes[key]) delete hook[key];
    }
  };
}

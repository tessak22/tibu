import type { BlockKey, Blueprint, Cell, WorldModel } from '../core/types';
import { chooseAnchor, type AnchorPlace } from './blueprint-anchor';

/** The part of the learning system that runs step-by-step builds. */
export interface BlueprintLearning {
  /**
   * Uses `anchor` as-is when it is valid (searching only when it is not). Returns the anchor
   * actually used, or null when the build could not start (no room).
   */
  setBlueprint(bp: Blueprint | null, anchor?: Cell): Cell | null;
  onBlueprintProgress(listener: (bp: Blueprint, stepIndex: number, stepCount: number, done: boolean) => void): () => void;
  suggestBlock(): BlockKey | null;
}

export interface BlueprintProgressView {
  readonly picture: HTMLCanvasElement | null;
  readonly step: number;
  readonly count: number;
}

export interface BlueprintControllerDeps {
  readonly learning: BlueprintLearning;
  readonly world: WorldModel;
  readonly picture: (bp: Blueprint, size: number) => HTMLCanvasElement;
  /** Where the child is looking: in front of the character (explore) or the view centre (island). */
  readonly place: () => AnchorPlace;
  /** Show (or hide with null) the step dots. */
  readonly showProgress: (progress: BlueprintProgressView | null) => void;
  /** Select the block the next ghost needs in the tray. */
  readonly suggest: (key: BlockKey) => void;
  readonly onDone: () => void;
  /** No free spot even after a wider search: a gentle cue (never a failure sound). */
  readonly onNoRoom: () => void;
  readonly clearDelayMs?: number;
}

export interface BlueprintController {
  current(): Blueprint | null;
  start(bp: Blueprint): void;
  /** Stop following the build. Placed blocks stay; nothing else happens. */
  stop(): void;
  dispose(): void;
}

const INDICATOR_PICTURE_SIZE = 128;
const DONE_CLEAR_MS = 2500;

/** Step-by-step builds: one anchor (in front of the character / view centre), step dots, suggested block, clear when done. */
export function createBlueprintController(deps: BlueprintControllerDeps): BlueprintController {
  let active: Blueprint | null = null;
  let picture: HTMLCanvasElement | null = null;
  let clearTimer: ReturnType<typeof setTimeout> | null = null;

  const cancelTimer = (): void => {
    if (clearTimer !== null) clearTimeout(clearTimer);
    clearTimer = null;
  };

  const suggestNext = (): void => {
    const key = deps.learning.suggestBlock();
    if (key) deps.suggest(key);
  };

  const stop = (): void => {
    cancelTimer();
    active = null;
    picture = null;
    deps.learning.setBlueprint(null);
    deps.showProgress(null);
  };

  const off = deps.learning.onBlueprintProgress((bp, stepIndex, stepCount, done) => {
    if (!active || bp.id !== active.id) return;
    deps.showProgress({ picture, step: done ? stepCount : stepIndex, count: stepCount });
    if (!done) {
      suggestNext();
      return;
    }
    deps.onDone();
    cancelTimer();
    clearTimer = setTimeout(stop, deps.clearDelayMs ?? DONE_CLEAR_MS);
  });

  return {
    current: () => active,
    start(bp) {
      const anchor = chooseAnchor(deps.world, bp, deps.place());
      if (!anchor) {
        // Nothing changes (a build already in progress keeps going); just the gentle cue.
        deps.onNoRoom();
        return;
      }
      cancelTimer();
      active = bp;
      try {
        picture = deps.picture(bp, INDICATOR_PICTURE_SIZE);
      } catch {
        picture = null;
      }
      if (deps.learning.setBlueprint(bp, anchor) === null) {
        active = null;
        picture = null;
        deps.showProgress(null);
        deps.onNoRoom();
        return;
      }
      deps.showProgress({ picture, step: 0, count: bp.steps.length });
      suggestNext();
    },
    stop,
    dispose() {
      cancelTimer();
      off();
      active = null;
    },
  };
}

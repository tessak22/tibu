import type { BlockKey, Blueprint, Cell, WorldModel } from '../core/types';
import { findAnchor } from './blueprint-anchor';

/** The part of the learning system that runs step-by-step builds. */
export interface BlueprintLearning {
  /** Returns the anchor actually used, or null when the build could not start (no room). */
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
  /** Where the child is: the character's cell (explore) or the island middle. */
  readonly near: () => { readonly cell: Cell | null; readonly x: number; readonly z: number };
  /** Show (or hide with null) the step dots. */
  readonly showProgress: (progress: BlueprintProgressView | null) => void;
  /** Select the block the next ghost needs in the tray. */
  readonly suggest: (key: BlockKey) => void;
  readonly onDone: () => void;
  /** No free spot nearby: a soft response, nothing else happens. */
  readonly onNoRoom?: () => void;
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

/** Step-by-step builds: anchor near the child, step dots, suggested block, clear when done. */
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
      cancelTimer();
      const near = deps.near();
      const anchor = findAnchor(deps.world, bp, near, near.cell);
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
        deps.onNoRoom?.();
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

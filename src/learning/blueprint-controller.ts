/**
 * Runs one step-by-step build in big-kid mode: shows the current step as ghost
 * blocks, sparkles when a ghost is filled, cheers when a step is done and
 * throws a party when the whole build is finished. Ignoring the ghosts is
 * always fine; nothing here ever signals a mistake.
 */
import { randomCelebrateLine } from '../audio/lineIds';
import type { AudioSystem, BlockKey, Blueprint, Cell, GameView, PlayMode, WorldAction, WorldModel } from '../core/types';
import { builtVoiceLine } from '../content/voice-lines';
import { evaluateBlueprint, findBlueprintAnchor, fitsInWorld, isUsableAnchor, suggestFrom, type BlueprintStatus } from './blueprint';
import { lookupFromWorld } from './grid';
import { randomStepCheer, STEP_LAST_LINE, STEP_NEXT_LINE } from './lines';
import { PRIORITY, type SpeechScheduler } from './scheduler';

export type BlueprintProgressListener = (bp: Blueprint, stepIndex: number, stepCount: number, done: boolean) => void;

export interface BlueprintControllerDeps {
  readonly view: Pick<GameView, 'setGhosts' | 'confetti' | 'bounce'>;
  readonly audio: Pick<AudioSystem, 'sfx' | 'speak' | 'play'>;
  readonly getWorld: () => WorldModel | null;
  readonly getMode: () => PlayMode;
  readonly scheduler: SpeechScheduler;
  readonly random?: () => number;
}

export interface BlueprintController {
  /**
   * Starts a build at `anchor`, used as-is when valid (the app picks it). Only an invalid or
   * missing anchor makes learning search nearby. Null when nothing fits.
   */
  set(bp: Blueprint | null, anchor?: Cell): Cell | null;
  suggest(): BlockKey | null;
  onProgress(listener: BlueprintProgressListener): () => void;
  dispose(): void;
}

/** Pause between the step cheer and "Next step!". */
const GAP_MS = 200;
/** Sparkle chime climbs a major scale as ghosts are filled within a step. */
const SPARKLE_NOTES = [72, 74, 76, 77, 79, 81, 83, 84];

interface Active {
  readonly bp: Blueprint;
  readonly anchor: Cell;
  readonly world: WorldModel;
  status: BlueprintStatus;
  filledInStep: number;
}

const sameCell = (a: Cell, b: Cell): boolean => a.x === b.x && a.y === b.y && a.z === b.z;

function placedCell(change: WorldAction): Cell | null {
  return change.type === 'place' ? change.cell : null;
}

function middleCell(bp: Blueprint, anchor: Cell): Cell {
  const all = bp.steps.flatMap((s) => s.blocks);
  const avg = (axis: 'x' | 'y' | 'z'): number => Math.round(all.reduce((n, b) => n + b[axis], 0) / Math.max(1, all.length));
  return { x: anchor.x + avg('x'), y: anchor.y + avg('y'), z: anchor.z + avg('z') };
}

/** The given anchor when usable; otherwise a search near it (or near the middle). */
function resolveAnchor(bp: Blueprint, world: WorldModel, given: Cell | undefined): Cell | null {
  const lookup = { size: world.size, get: lookupFromWorld(world) };
  if (given && isUsableAnchor(bp, given, lookup)) return given;
  const center: Cell = given ?? { x: Math.floor(world.size.x / 2), y: 0, z: Math.floor(world.size.z / 2) };
  const found = findBlueprintAnchor(bp, center, lookup);
  return found && fitsInWorld(bp, found, world.size) ? found : null;
}

export function createBlueprintController(deps: BlueprintControllerDeps): BlueprintController {
  const { view, audio, scheduler } = deps;
  const random = deps.random ?? Math.random;
  const listeners = new Set<BlueprintProgressListener>();
  let active: Active | null = null;
  let unsubscribeWorld: (() => void) | null = null;
  let disposed = false;

  const emit = (bp: Blueprint, s: BlueprintStatus): void => {
    for (const l of [...listeners]) l(bp, s.stepIndex, s.stepCount, s.done);
  };

  const stop = (): void => {
    unsubscribeWorld?.();
    unsubscribeWorld = null;
    active = null;
    view.setGhosts(null);
  };

  const sayStepCheer = (isLast: boolean): void => {
    scheduler.submit({
      priority: PRIORITY.step,
      run: () => {
        void audio.speak(randomStepCheer(random)).then(() => {
          if (!disposed) setTimeout(() => void audio.speak(isLast ? STEP_LAST_LINE : STEP_NEXT_LINE), GAP_MS);
        });
      },
    });
  };

  const finish = (a: Active): void => {
    const at = middleCell(a.bp, a.anchor);
    view.confetti(at);
    audio.sfx('celebrate');
    scheduler.submit({
      priority: PRIORITY.blueprint,
      run: () => {
        void audio.speak(builtVoiceLine(a.bp.id), `You built a ${a.bp.name}!`).then(() => {
          if (!disposed) setTimeout(() => void audio.speak(randomCelebrateLine(random)), GAP_MS);
        });
      },
    });
    emit(a.bp, a.status);
    stop();
  };

  const sparkle = (a: Active, cell: Cell): void => {
    view.bounce(cell);
    const note = SPARKLE_NOTES[Math.min(a.filledInStep, SPARKLE_NOTES.length - 1)];
    audio.play({ type: 'synth', preset: 'chime', note });
    a.filledInStep++;
  };

  const onWorldChange = (change: WorldAction, cause: 'action' | 'undo'): void => {
    const a = active;
    if (!a || disposed) return;
    if (deps.getWorld() !== a.world) {
      stop();
      return;
    }
    const prev = a.status;
    const next = evaluateBlueprint(a.bp, a.anchor, lookupFromWorld(a.world));
    a.status = next;
    if (next.done) {
      finish(a);
      return;
    }
    const cell = placedCell(change);
    if (next.stepIndex > prev.stepIndex) {
      a.filledInStep = 0;
      if (cause === 'action') {
        if (cell) view.bounce(cell);
        audio.sfx('celebrate');
        sayStepCheer(next.stepIndex === next.stepCount - 1);
      }
    } else if (next.stepIndex < prev.stepIndex) {
      a.filledInStep = 0;
    } else if (cause === 'action' && cell && prev.missing.some((g) => sameCell(g.cell, cell)) && !next.missing.some((g) => sameCell(g.cell, cell))) {
      sparkle(a, cell);
    }
    view.setGhosts(next.missing);
    if (next.stepIndex !== prev.stepIndex) emit(a.bp, next);
  };

  return {
    set(bp, given) {
      stop();
      const world = deps.getWorld();
      if (!bp || !world || disposed || deps.getMode() !== 'big') return null;
      const anchor = resolveAnchor(bp, world, given);
      if (!anchor) return null;
      const status = evaluateBlueprint(bp, anchor, lookupFromWorld(world));
      active = { bp, anchor, world, status, filledInStep: 0 };
      unsubscribeWorld = world.onChange(onWorldChange);
      view.setGhosts(status.missing);
      emit(bp, status);
      return anchor;
    },
    suggest() {
      const a = active;
      if (!a) return null;
      return suggestFrom(a.status, lookupFromWorld(a.world));
    },
    onProgress(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispose() {
      disposed = true;
      unsubscribeWorld?.();
      unsubscribeWorld = null;
      active = null;
      listeners.clear();
    },
  };
}

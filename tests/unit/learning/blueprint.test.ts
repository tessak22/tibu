import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AudioSystem, Blueprint, GameView, GhostBlock, PlayMode } from '../../../src/core/types';
import {
  blockMatches, blueprintExtent, evaluateBlueprint, findBlueprintAnchor, fitsInWorld, isUsableAnchor, suggestFrom,
} from '../../../src/learning/blueprint';
import { createBlueprintController } from '../../../src/learning/blueprint-controller';
import { lookupFromCells, lookupFromWorld } from '../../../src/learning/grid';
import { createSpeechScheduler } from '../../../src/learning/scheduler';
import { createFakeWorld } from './fakeWorld';

const tower = (difficulty: Blueprint['difficulty']): Blueprint => ({
  id: 'tower', name: 'tower', voiceLine: 'build.tower', difficulty,
  steps: [
    { blocks: [{ x: 0, y: 0, z: 0, block: 'colors:red' }, { x: 1, y: 0, z: 0, block: 'colors:blue' }] },
    { blocks: [{ x: 0, y: 1, z: 0, block: 'parts:roof-red', rot: 2 }] },
  ],
});
const origin = { x: 0, y: 0, z: 0 };

describe('blockMatches', () => {
  it('difficulty 1 accepts any block from the same pack', () => {
    expect(blockMatches('colors:red', 'colors:red', 1)).toBe(true);
    expect(blockMatches('colors:red', 'colors:green', 1)).toBe(true);
    expect(blockMatches('colors:red', 'nature:wood', 1)).toBe(false);
    expect(blockMatches('colors:red', null, 1)).toBe(false);
  });

  it('difficulty 2 and 3 need the exact block', () => {
    for (const d of [2, 3] as const) {
      expect(blockMatches('colors:red', 'colors:red', d)).toBe(true);
      expect(blockMatches('colors:red', 'colors:green', d)).toBe(false);
    }
  });
});

describe('evaluateBlueprint', () => {
  it('starts at step 0 with every first-step ghost missing', () => {
    const s = evaluateBlueprint(tower(2), origin, lookupFromCells([]));
    expect(s).toMatchObject({ stepIndex: 0, stepCount: 2, done: false });
    expect(s.missing.map((g) => g.block)).toEqual(['colors:red', 'colors:blue']);
  });

  it('moves to the next step when a step is complete and keeps ghost rotation', () => {
    const s = evaluateBlueprint(tower(2), origin, lookupFromCells([
      { x: 0, y: 0, z: 0, block: 'colors:red' }, { x: 1, y: 0, z: 0, block: 'colors:blue' },
    ]));
    expect(s.stepIndex).toBe(1);
    expect(s.missing).toEqual([{ cell: { x: 0, y: 1, z: 0 }, block: 'parts:roof-red', rot: 2 }]);
  });

  it('a wrong block in a ghost cell stays a normal block (difficulty 2)', () => {
    const cells = [{ x: 0, y: 0, z: 0, block: 'colors:green' }, { x: 1, y: 0, z: 0, block: 'colors:blue' }];
    expect(evaluateBlueprint(tower(2), origin, lookupFromCells(cells)).missing).toHaveLength(1);
    expect(evaluateBlueprint(tower(1), origin, lookupFromCells(cells)).stepIndex).toBe(1);
  });

  it('is done when every step matches, offset by the anchor', () => {
    const a = { x: 5, y: 2, z: 7 };
    const s = evaluateBlueprint(tower(3), a, lookupFromCells([
      { x: 5, y: 2, z: 7, block: 'colors:red' }, { x: 6, y: 2, z: 7, block: 'colors:blue' }, { x: 5, y: 3, z: 7, block: 'parts:roof-red' },
    ]));
    expect(s).toMatchObject({ done: true, stepIndex: 2, missing: [] });
  });

  it('suggests the lowest empty ghost block', () => {
    const s = evaluateBlueprint(tower(2), origin, lookupFromCells([{ x: 0, y: 0, z: 0, block: 'colors:green' }]));
    expect(suggestFrom(s, lookupFromCells([{ x: 0, y: 0, z: 0, block: 'colors:green' }]))).toBe('colors:blue');
  });
});

describe('findBlueprintAnchor', () => {
  const bp = tower(1);

  it('centres the build on a flat spot near the given cell, on top of the ground', () => {
    const w = createFakeWorld();
    w.ground('nature:grass', 2);
    const a = findBlueprintAnchor(bp, { x: 10, y: 2, z: 10 }, { size: w.size, get: lookupFromWorld(w) });
    expect(a).toEqual({ x: 10, y: 2, z: 10 });
    expect(fitsInWorld(bp, a!, w.size)).toBe(true);
  });

  it('moves away from existing builds and stays inside the world', () => {
    const w = createFakeWorld({ x: 8, y: 8, z: 8 });
    w.ground('nature:grass');
    w.place({ x: 0, y: 1, z: 0 }, 'colors:red');
    const a = findBlueprintAnchor(bp, { x: 0, y: 1, z: 0 }, { size: w.size, get: lookupFromWorld(w) });
    expect(a).not.toBeNull();
    const e = blueprintExtent(bp);
    expect(a!.x + e.x).toBeLessThanOrEqual(8);
    expect(a!.y).toBe(1);
    expect(a!.x === 0 && a!.z === 0).toBe(false);
  });

  it('never builds over the void and returns null when nothing fits', () => {
    const empty = createFakeWorld({ x: 8, y: 8, z: 8 });
    expect(findBlueprintAnchor(bp, origin, { size: empty.size, get: lookupFromWorld(empty) })).toBeNull();
    const low = createFakeWorld({ x: 8, y: 2, z: 8 });
    low.ground('nature:grass');
    expect(findBlueprintAnchor(bp, origin, { size: low.size, get: lookupFromWorld(low) })).toBeNull();
  });

  it('falls back to a slightly uneven spot, starting on the highest column', () => {
    const w = createFakeWorld({ x: 2, y: 8, z: 1 });
    w.ground('nature:grass');
    w.place({ x: 1, y: 1, z: 0 }, 'nature:grass');
    expect(findBlueprintAnchor(bp, origin, { size: w.size, get: lookupFromWorld(w) })).toEqual({ x: 0, y: 2, z: 0 });
  });
});

describe('blueprint controller', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function setup(mode: PlayMode = 'big', bp: Blueprint = tower(2)) {
    const world = createFakeWorld();
    world.ground('nature:grass');
    const ghosts: (readonly GhostBlock[] | null)[] = [];
    const view = {
      setGhosts: vi.fn((g: readonly GhostBlock[] | null) => ghosts.push(g)),
      confetti: vi.fn(),
      bounce: vi.fn(),
    } as unknown as GameView & Record<'setGhosts' | 'confetti' | 'bounce', ReturnType<typeof vi.fn>>;
    const audio = { sfx: vi.fn(), play: vi.fn(), speak: vi.fn(() => Promise.resolve()) } as unknown as
      AudioSystem & Record<'sfx' | 'play' | 'speak', ReturnType<typeof vi.fn>>;
    const scheduler = createSpeechScheduler({ delayMs: 10 });
    const ctl = createBlueprintController({ view, audio, getWorld: () => world, getMode: () => mode, scheduler, random: () => 0 });
    const progress: [number, number, boolean][] = [];
    ctl.onProgress((_bp, i, n, done) => progress.push([i, n, done]));
    const anchor = ctl.set(bp, { x: 10, y: 1, z: 10 });
    const at = (x: number, y: number, z: number) => ({ x: anchor!.x + x, y: anchor!.y + y, z: anchor!.z + z });
    const lastGhosts = () => ghosts[ghosts.length - 1];
    return { world, view, audio, ctl, progress, anchor, at, lastGhosts };
  }

  it('does nothing in little mode', () => {
    const { anchor, view } = setup('little');
    expect(anchor).toBeNull();
    expect(view.setGhosts).toHaveBeenLastCalledWith(null);
  });

  it('shows the first step, sparkles filled ghosts and suggests the next block', () => {
    const { world, view, audio, ctl, progress, at, lastGhosts } = setup();
    expect(progress).toEqual([[0, 2, false]]);
    expect(lastGhosts()?.map((g) => g.block)).toEqual(['colors:red', 'colors:blue']);
    expect(ctl.suggest()).toBe('colors:red');
    world.place(at(0, 0, 0), 'colors:red');
    expect(view.bounce).toHaveBeenCalledWith(at(0, 0, 0));
    expect(audio.play).toHaveBeenCalledWith(expect.objectContaining({ preset: 'chime' }));
    expect(lastGhosts()?.map((g) => g.block)).toEqual(['colors:blue']);
    expect(ctl.suggest()).toBe('colors:blue');
  });

  it('a non-matching block in a ghost cell gets no feedback and the ghost stays', () => {
    const { world, view, audio, lastGhosts, at } = setup();
    world.place(at(0, 0, 0), 'colors:green');
    expect(view.bounce).not.toHaveBeenCalled();
    expect(audio.play).not.toHaveBeenCalled();
    expect(audio.sfx).not.toHaveBeenCalled();
    expect(lastGhosts()).toHaveLength(2);
  });

  it('cheers a finished step, shows the next one, and undo brings the ghosts back', async () => {
    const { world, audio, progress, at, lastGhosts } = setup();
    world.place(at(0, 0, 0), 'colors:red');
    world.place(at(1, 0, 0), 'colors:blue');
    expect(audio.sfx).toHaveBeenCalledWith('celebrate');
    expect(progress[progress.length - 1]).toEqual([1, 2, false]);
    expect(lastGhosts()).toEqual([{ cell: at(0, 1, 0), block: 'parts:roof-red', rot: 2 }]);
    await vi.advanceTimersByTimeAsync(500);
    expect(audio.speak).toHaveBeenCalledWith('step.cheer.1');
    expect(audio.speak).toHaveBeenCalledWith('step.last');

    world.undo();
    expect(progress[progress.length - 1]).toEqual([0, 2, false]);
    expect(lastGhosts()?.map((g) => g.block)).toEqual(['colors:blue']);
    world.remove(at(0, 0, 0));
    expect(lastGhosts()?.map((g) => g.block)).toEqual(['colors:red', 'colors:blue']);
  });

  it('celebrates the whole build with confetti and "You built a ...!"', async () => {
    const { world, view, audio, progress, at, lastGhosts } = setup();
    world.place(at(0, 0, 0), 'colors:red');
    world.place(at(1, 0, 0), 'colors:blue');
    world.place(at(0, 1, 0), 'parts:roof-red');
    expect(view.confetti).toHaveBeenCalledTimes(1);
    expect(progress[progress.length - 1]).toEqual([2, 2, true]);
    expect(lastGhosts()).toBeNull();
    await vi.advanceTimersByTimeAsync(1000);
    expect(audio.speak).toHaveBeenCalledWith('built.tower', 'You built a tower!');
    // Finished: later smashes do not bring ghosts back.
    world.remove(at(0, 1, 0));
    expect(lastGhosts()).toBeNull();
  });

  it('difficulty 1 lets any same-pack block finish a step', () => {
    const { world, progress, at } = setup('big', tower(1));
    world.place(at(0, 0, 0), 'colors:yellow');
    world.place(at(1, 0, 0), 'colors:pink');
    expect(progress[progress.length - 1]).toEqual([1, 2, false]);
  });

  it('can be cleared at any time', () => {
    const { ctl, view, world, at } = setup();
    ctl.set(null);
    expect(view.setGhosts).toHaveBeenLastCalledWith(null);
    world.place(at(0, 0, 0), 'colors:red');
    expect(view.bounce).not.toHaveBeenCalled();
    expect(ctl.suggest()).toBeNull();
  });
});

describe('blueprint anchor hand-off', () => {
  const makeCtl = () => {
    const world = createFakeWorld();
    world.ground('nature:grass');
    const view = { setGhosts: vi.fn(), confetti: vi.fn(), bounce: vi.fn() } as unknown as GameView;
    const audio = { sfx: vi.fn(), play: vi.fn(), speak: vi.fn(() => Promise.resolve()) } as unknown as AudioSystem;
    const ctl = createBlueprintController({
      view, audio, getWorld: () => world, getMode: () => 'big', scheduler: createSpeechScheduler({ delayMs: 10 }),
    });
    return { world, ctl };
  };

  it('uses a valid anchor exactly as given (no search)', () => {
    const { ctl } = makeCtl();
    expect(ctl.set(tower(1), { x: 2, y: 1, z: 19 })).toEqual({ x: 2, y: 1, z: 19 });
  });

  it('searches only when the given anchor is invalid', () => {
    const { world, ctl } = makeCtl();
    world.place({ x: 5, y: 1, z: 5 }, 'nature:wood');
    const used = ctl.set(tower(2), { x: 5, y: 1, z: 5 });
    expect(used).not.toBeNull();
    expect(used).not.toEqual({ x: 5, y: 1, z: 5 });
  });

  it('isUsableAnchor: inside the world, and cells empty or already matching', () => {
    const w = createFakeWorld();
    w.ground('nature:grass');
    const aw = { size: w.size, get: lookupFromWorld(w) };
    expect(isUsableAnchor(tower(2), { x: 3, y: 1, z: 3 }, aw)).toBe(true);
    w.place({ x: 3, y: 1, z: 3 }, 'colors:red');
    expect(isUsableAnchor(tower(2), { x: 3, y: 1, z: 3 }, aw)).toBe(true);
    w.place({ x: 4, y: 1, z: 3 }, 'nature:wood');
    expect(isUsableAnchor(tower(2), { x: 3, y: 1, z: 3 }, aw)).toBe(false);
    expect(isUsableAnchor(tower(2), { x: w.size.x - 1, y: 1, z: 3 }, aw)).toBe(false);
  });
});

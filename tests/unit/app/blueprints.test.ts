// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Blueprint } from '../../../src/core/types';
import { createBlueprintController, type BlueprintLearning } from '../../../src/app/blueprints';
import { fakeBlueprint } from '../ui/helpers';
import { fakeWorld } from './fake-world';
import type { AnchorPlace } from '../../../src/app/blueprint-anchor';

type Progress = (bp: Blueprint, i: number, n: number, done: boolean) => void;

const setup = (place: AnchorPlace = { kind: 'island', center: { x: 12, z: 12 } }, world = fakeWorld()) => {
  let progress: Progress = () => undefined;
  const learning: BlueprintLearning = {
    setBlueprint: vi.fn((bp: Blueprint | null, anchor?: { x: number; y: number; z: number }) => (bp ? (anchor ?? null) : null)),
    onBlueprintProgress: vi.fn((l: Progress) => {
      progress = l;
      return () => undefined;
    }),
    suggestBlock: vi.fn(() => 'colors:red'),
  };
  const showProgress = vi.fn();
  const suggest = vi.fn();
  const onDone = vi.fn();
  const onNoRoom = vi.fn();
  const ctl = createBlueprintController({
    learning,
    world,
    picture: () => document.createElement('canvas'),
    place: () => place,
    showProgress,
    suggest,
    onDone,
    onNoRoom,
    clearDelayMs: 100,
  });
  return { ctl, learning, showProgress, suggest, onDone, onNoRoom, progress: (...a: Parameters<Progress>) => progress(...a) };
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('blueprint controller', () => {
  it('starts a build at an anchor near the child, shows dots and suggests a block', () => {
    const t = setup();
    const bp = fakeBlueprint('house');
    t.ctl.start(bp);
    expect(t.learning.setBlueprint).toHaveBeenCalledWith(bp, { x: 12, y: 1, z: 12 });
    expect(t.showProgress).toHaveBeenLastCalledWith(expect.objectContaining({ step: 0, count: 2 }));
    expect(t.suggest).toHaveBeenCalledWith('colors:red');
    expect(t.ctl.current()).toBe(bp);
  });

  it('follows progress and clears itself when done', () => {
    const t = setup();
    const bp = fakeBlueprint('house');
    t.ctl.start(bp);
    t.progress(bp, 1, 2, false);
    expect(t.showProgress).toHaveBeenLastCalledWith(expect.objectContaining({ step: 1, count: 2 }));
    t.progress(bp, 1, 2, true);
    expect(t.onDone).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(150);
    expect(t.learning.setBlueprint).toHaveBeenLastCalledWith(null);
    expect(t.showProgress).toHaveBeenLastCalledWith(null);
    expect(t.ctl.current()).toBeNull();
  });

  it('stop has no consequence besides hiding the build', () => {
    const t = setup();
    t.ctl.start(fakeBlueprint('house'));
    t.ctl.stop();
    expect(t.learning.setBlueprint).toHaveBeenLastCalledWith(null);
    expect(t.showProgress).toHaveBeenLastCalledWith(null);
    expect(t.onDone).not.toHaveBeenCalled();
  });

  it('no room: nothing starts, just a soft response', () => {
    const t = setup();
    (t.learning.setBlueprint as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => null);
    t.ctl.start(fakeBlueprint('house'));
    expect(t.ctl.current()).toBeNull();
    expect(t.showProgress).toHaveBeenLastCalledWith(null);
    expect(t.suggest).not.toHaveBeenCalled();
    expect(t.onNoRoom).toHaveBeenCalledTimes(1);
  });

  it('no spot anywhere: learning is not asked, the gentle cue runs once', () => {
    const t = setup({ kind: 'island', center: { x: 2, z: 2 } }, fakeWorld({ x: 4, y: 2, z: 4 }, 1));
    t.ctl.start(fakeBlueprint('house'));
    expect(t.learning.setBlueprint).not.toHaveBeenCalled();
    expect(t.onNoRoom).toHaveBeenCalledTimes(1);
    expect(t.ctl.current()).toBeNull();
  });

  it('explore: hands learning the anchor in front of the character', () => {
    const t = setup({ kind: 'explore', character: { x: 12, y: 1, z: 12 }, facing: 1 });
    t.ctl.start(fakeBlueprint('house'));
    const anchor = (t.learning.setBlueprint as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[1];
    expect(anchor).toEqual({ x: 14, y: 1, z: 12 });
  });

  it('ignores progress from another build', () => {
    const t = setup();
    t.ctl.start(fakeBlueprint('house'));
    t.showProgress.mockClear();
    t.progress(fakeBlueprint('truck'), 1, 2, false);
    expect(t.showProgress).not.toHaveBeenCalled();
  });
});

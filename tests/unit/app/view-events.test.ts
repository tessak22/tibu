// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameView, GameViewEvents, GhostBlock } from '../../../src/core/types';
import { trackGhosts } from '../../../src/app/tracked-view';
import { wireViewEvents } from '../../../src/app/view-events';
import { fakeAudio, fakeRegistry } from '../ui/helpers';
import { fakeWorld } from './fake-world';

type Listener = (payload: unknown) => void;

const fakeView = () => {
  const listeners = new Map<string, Listener[]>();
  const view = {
    on: (event: string, l: Listener) => {
      listeners.set(event, [...(listeners.get(event) ?? []), l]);
      return () => undefined;
    },
    setGhosts: vi.fn(),
    bounce: vi.fn(),
    setMode: vi.fn(),
  } as unknown as GameView;
  const emit = <K extends keyof GameViewEvents>(event: K, payload: GameViewEvents[K]): void =>
    (listeners.get(event) ?? []).forEach((l) => l(payload));
  return { view, emit };
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('view events', () => {
  it('a plain smash plays one smash sound', () => {
    const { view, emit } = fakeView();
    const audio = fakeAudio();
    wireViewEvents(view, fakeWorld(), audio, fakeRegistry());
    emit('smashed', { cell: { x: 1, y: 1, z: 1 }, block: 'colors:red', collapsed: 0 });
    vi.advanceTimersByTime(500);
    expect(audio.calls.filter((c) => c === 'sfx:smash')).toHaveLength(1);
  });

  it('a toppled tower gets a bigger, layered crash', () => {
    const { view, emit } = fakeView();
    const audio = fakeAudio();
    wireViewEvents(view, fakeWorld(), audio, fakeRegistry());
    emit('smashed', { cell: { x: 1, y: 1, z: 1 }, block: 'colors:red', collapsed: 2 });
    vi.advanceTimersByTime(500);
    expect(audio.calls.filter((c) => c === 'sfx:smash')).toHaveLength(2);
    expect(audio.calls).toContain('sfx:whoosh');
    expect(audio.calls.some((c) => c.startsWith('speak:'))).toBe(false); // Learning speaks crash lines.
  });

  it('applies a smash the view did not apply, with the topple setting', () => {
    const { view, emit } = fakeView();
    const world = fakeWorld();
    world.place({ x: 2, y: 1, z: 2 }, 'colors:red');
    const smash = vi.spyOn(world, 'smash');
    wireViewEvents(view, world, fakeAudio(), fakeRegistry(), { topple: () => true });
    emit('smashed', { cell: { x: 2, y: 1, z: 2 }, block: 'colors:red', collapsed: 0 });
    expect(smash).toHaveBeenCalledWith({ x: 2, y: 1, z: 2 }, { topple: true });
  });

  it('places with the rotation from the event', () => {
    const { view, emit } = fakeView();
    const world = fakeWorld();
    const place = vi.spyOn(world, 'place');
    wireViewEvents(view, world, fakeAudio(), fakeRegistry());
    emit('placed', { cell: { x: 3, y: 1, z: 3 }, block: 'parts:slope', tappedCell: null, rot: 2 });
    expect(place).toHaveBeenCalledWith({ x: 3, y: 1, z: 3 }, 'parts:slope', 2);
  });

  it('no crash layers fire after the session ends', () => {
    const { view, emit } = fakeView();
    const audio = fakeAudio();
    const off = wireViewEvents(view, fakeWorld(), audio, fakeRegistry());
    emit('smashed', { cell: { x: 1, y: 1, z: 1 }, block: 'colors:red', collapsed: 3 });
    off();
    vi.advanceTimersByTime(500);
    expect(audio.calls).not.toContain('sfx:whoosh');
  });
});

describe('ghost tracking', () => {
  it('remembers ghosts and still forwards to the view', () => {
    const { view } = fakeView();
    const tracked = trackGhosts(view);
    const ghosts: GhostBlock[] = [{ cell: { x: 1, y: 1, z: 1 }, block: 'colors:red' }];
    tracked.view.setGhosts(ghosts);
    expect(tracked.ghosts()).toEqual(ghosts);
    expect(view.setGhosts).toHaveBeenCalledWith(ghosts);
    tracked.view.setGhosts(null);
    expect(tracked.ghosts()).toEqual([]);
    tracked.view.setMode('walk');
    expect(view.setMode).toHaveBeenCalledWith('walk');
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSpeechScheduler, PRIORITY } from '../../../src/learning/scheduler';
import { createPlayTimer } from '../../../src/learning/sleep';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('speech scheduler', () => {
  it('debounces so the latest utterance wins', () => {
    const said: string[] = [];
    const s = createSpeechScheduler({ delayMs: 100 });
    s.submit({ priority: PRIORITY.naming, run: () => said.push('red') });
    vi.advanceTimersByTime(50);
    s.submit({ priority: PRIORITY.naming, run: () => said.push('blue') });
    vi.advanceTimersByTime(99);
    expect(said).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(said).toEqual(['blue']);
  });

  it('keeps a pending celebration over later naming', () => {
    const said: string[] = [];
    const s = createSpeechScheduler({ delayMs: 100, celebrationLockMs: 1000 });
    s.submit({ priority: PRIORITY.spelling, run: () => said.push('cat') });
    s.submit({ priority: PRIORITY.naming, run: () => said.push('red') });
    vi.advanceTimersByTime(100);
    expect(said).toEqual(['cat']);
    s.submit({ priority: PRIORITY.counting, run: () => said.push('two') });
    vi.advanceTimersByTime(500);
    expect(said).toEqual(['cat']);
    vi.advanceTimersByTime(600);
    s.submit({ priority: PRIORITY.naming, run: () => said.push('blue') });
    vi.advanceTimersByTime(100);
    expect(said).toEqual(['cat', 'blue']);
  });

  it('dispose drops pending speech', () => {
    const run = vi.fn();
    const s = createSpeechScheduler({ delayMs: 10 });
    s.submit({ priority: PRIORITY.naming, run });
    s.dispose();
    vi.advanceTimersByTime(100);
    expect(run).not.toHaveBeenCalled();
  });
});

describe('play timer', () => {
  it('fires once after the set minutes', () => {
    const onSleep = vi.fn();
    const t = createPlayTimer({ minutes: 2, onSleep });
    expect(t.remainingMs()).toBe(120_000);
    t.start();
    vi.advanceTimersByTime(60_000);
    expect(t.remainingMs()).toBe(60_000);
    expect(onSleep).not.toHaveBeenCalled();
    vi.advanceTimersByTime(60_000);
    expect(onSleep).toHaveBeenCalledTimes(1);
    expect(t.remainingMs()).toBe(0);
    t.start();
    vi.advanceTimersByTime(300_000);
    expect(onSleep).toHaveBeenCalledTimes(1);
  });

  it('pauses on stop and resumes on start', () => {
    const onSleep = vi.fn();
    const t = createPlayTimer({ minutes: 1, onSleep });
    t.start();
    vi.advanceTimersByTime(20_000);
    t.stop();
    vi.advanceTimersByTime(600_000);
    expect(onSleep).not.toHaveBeenCalled();
    expect(t.remainingMs()).toBe(40_000);
    t.start();
    t.start(); // idempotent
    vi.advanceTimersByTime(40_000);
    expect(onSleep).toHaveBeenCalledTimes(1);
  });

  it('treats bad minutes as zero', () => {
    const onSleep = vi.fn();
    const t = createPlayTimer({ minutes: Number.NaN, onSleep });
    t.start();
    vi.advanceTimersByTime(0);
    expect(onSleep).toHaveBeenCalledTimes(1);
  });
});

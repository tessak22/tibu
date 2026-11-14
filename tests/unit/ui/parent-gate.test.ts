// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { askParentSum, createParentCorner, HOLD_MS, makeSum } from '../../../src/ui/parent-gate';

const press = (root: HTMLElement, key: string): void => {
  root.querySelector<HTMLButtonElement>(`[data-key="${key}"]`)?.click();
};

describe('makeSum', () => {
  it('always gives a two-digit answer from small numbers', () => {
    for (let i = 0; i < 200; i++) {
      const s = makeSum();
      expect(s.answer).toBe(s.a + s.b);
      expect(s.answer).toBeGreaterThanOrEqual(10);
      expect(s.a).toBeGreaterThanOrEqual(3);
      expect(s.a).toBeLessThanOrEqual(9);
    }
  });
});

describe('askParentSum', () => {
  let root: HTMLElement;
  beforeEach(() => {
    root = document.createElement('div');
    document.body.append(root);
  });
  afterEach(() => root.remove());

  it('resolves true on the right answer', async () => {
    const promise = askParentSum(root, () => 0.5);
    const text = root.querySelector('.gate-question')?.textContent ?? '';
    const [a, b] = text.match(/\d+/g)!.map(Number);
    for (const d of String(a! + b!)) press(root, d);
    press(root, 'ok');
    await expect(promise).resolves.toBe(true);
    expect(root.querySelector('.gate')).toBeNull();
  });

  it('a wrong answer asks again; closing resolves false', async () => {
    const promise = askParentSum(root, () => 0.5);
    press(root, '1');
    press(root, 'ok');
    expect(root.querySelector('.gate')).not.toBeNull();
    expect(root.querySelector('.gate-display')?.textContent?.trim()).toBe('');
    root.querySelector<HTMLButtonElement>('.overlay-close')?.click();
    await expect(promise).resolves.toBe(false);
  });
});

describe('parent corner', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const setup = () => {
    const root = document.createElement('div');
    document.body.append(root);
    const onUnlock = vi.fn();
    const onPlainTap = vi.fn();
    const btn = createParentCorner({ overlayRoot: root, onUnlock, onPlainTap });
    root.append(btn);
    return { root, btn, onUnlock, onPlainTap };
  };

  it('a plain tap only wiggles', async () => {
    const { root, btn, onUnlock, onPlainTap } = setup();
    btn.dispatchEvent(new Event('pointerdown'));
    await vi.advanceTimersByTimeAsync(300);
    btn.dispatchEvent(new Event('pointerup'));
    btn.click();
    expect(onPlainTap).toHaveBeenCalledTimes(1);
    expect(onUnlock).not.toHaveBeenCalled();
    expect(root.querySelector('.gate')).toBeNull();
    root.remove();
  });

  it('holding for 3 seconds opens the sum question', async () => {
    const { root, btn, onUnlock } = setup();
    btn.dispatchEvent(new Event('pointerdown'));
    await vi.advanceTimersByTimeAsync(HOLD_MS / 2);
    expect(btn.classList.contains('holding')).toBe(true);
    await vi.advanceTimersByTimeAsync(HOLD_MS / 2 + 100);
    btn.dispatchEvent(new Event('pointerup'));
    const text = root.querySelector('.gate-question')?.textContent ?? '';
    const [a, b] = text.match(/\d+/g)!.map(Number);
    for (const d of String(a! + b!)) press(root, d);
    press(root, 'ok');
    await vi.advanceTimersByTimeAsync(0);
    expect(onUnlock).toHaveBeenCalledTimes(1);
    root.remove();
  });
});

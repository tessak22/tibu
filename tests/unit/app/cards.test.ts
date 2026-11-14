import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCardCycler } from '../../../src/app/cards';
import type { BuildCard } from '../../../src/core/types';

const card = (id: string): BuildCard => ({ id, name: id, voiceLine: `card.${id}`, blocks: [] });

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const setup = () => {
  let matched: ((c: BuildCard) => void) | null = null;
  const learning = {
    setActiveCard: vi.fn(),
    onCardMatched: vi.fn((cb: (c: BuildCard) => void) => {
      matched = cb;
      return () => undefined;
    }),
    cardPicture: vi.fn(() => ({}) as HTMLCanvasElement),
  };
  const show = vi.fn();
  const cycler = createCardCycler({
    cards: [card('a'), card('b')],
    learning,
    audio: { sfx: vi.fn(), speak: vi.fn(async () => undefined) },
    show,
  });
  return { learning, show, cycler, match: () => matched?.(card('a')) };
};

describe('card cycler', () => {
  it('shows, cycles, then dismisses', () => {
    const { learning, show, cycler } = setup();
    cycler.next();
    expect(learning.setActiveCard).toHaveBeenLastCalledWith(card('a'));
    cycler.next();
    expect(learning.setActiveCard).toHaveBeenLastCalledWith(card('b'));
    cycler.next();
    expect(learning.setActiveCard).toHaveBeenLastCalledWith(null);
    expect(show).toHaveBeenLastCalledWith(null);
    cycler.next();
    expect(learning.setActiveCard).toHaveBeenLastCalledWith(card('a'));
  });

  it('clears the card a moment after it is matched', async () => {
    const { learning, show, cycler, match } = setup();
    cycler.next();
    match();
    await vi.advanceTimersByTimeAsync(3000);
    expect(learning.setActiveCard).toHaveBeenLastCalledWith(null);
    expect(show).toHaveBeenLastCalledWith(null);
  });
});

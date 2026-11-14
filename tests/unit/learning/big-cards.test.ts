import { describe, expect, it } from 'vitest';
import { resolveCard } from '../../../src/content/cards';
import { cardsForMode, packsForMode } from '../../../src/content/modes';
import type { CardJson } from '../../../src/content/raw-types';
import { readContentFromDisk } from '../../../src/content/validate/disk';
import { cardMatchesAnywhere, cardMatchesAt, rotatePattern } from '../../../src/learning/cards';
import { lookupFromCells } from '../../../src/learning/grid';
import { findSpelledWord, buildWordSet } from '../../../src/learning/spelling';
import { BIG_WORDS, BUILTIN_WORDS, builtInWordsFor } from '../../../src/learning/words';
import { REPO_ROOT } from '../content/helpers';

const cards = readContentFromDisk(REPO_ROOT).bundle.cards.map((c) => resolveCard(c.data as CardJson));
const big = cardsForMode(cards, 'big');
const card = (id: string) => big.find((c) => c.id === id)!;
type Cells = { x: number; y: number; z: number; block: string }[];
const shift = (cells: Cells, dx: number, dy: number, dz: number): Cells => cells.map((c) => ({ ...c, x: c.x + dx, y: c.y + dy, z: c.z + dz }));
const matches = (id: string, world: Cells) => cardMatchesAnywhere(card(id), world.map((c) => [c, c.block] as const), lookupFromCells(world));

describe('big-mode cards', () => {
  it('ships 8+ big cards, kept apart from the little-mode cards', () => {
    expect(big.length).toBeGreaterThanOrEqual(8);
    expect(cardsForMode(cards, 'little').some((c) => c.mode === 'big')).toBe(false);
    expect(cardsForMode(cards, 'little').length).toBe(cards.length - big.length);
  });

  it.each(big.map((c) => [c.id] as const))('%s matches its own pattern anywhere, turned or not', (id) => {
    const c = card(id);
    for (const turns of [0, 1, 2, 3]) {
      const turned = shift(rotatePattern(c.blocks, turns), 10, 1, 10);
      expect(matches(id, turned)).toBe(true);
    }
  });

  it('alternating pattern needs the colours in order', () => {
    const row = (colors: string[]) => colors.map((col, x) => ({ x, y: 1, z: 0, block: `colors:${col}` }));
    expect(matches('big-pattern', row(['red', 'blue', 'red', 'blue', 'red', 'blue']))).toBe(true);
    expect(matches('big-pattern', row(['red', 'red', 'blue', 'blue', 'red', 'blue']))).toBe(false);
  });

  it('staircase of 4 needs every step', () => {
    const stairs: Cells = card('big-staircase').blocks.map((b) => ({ ...b }));
    expect(stairs).toHaveLength(10);
    expect(matches('big-staircase', stairs)).toBe(true);
    expect(matches('big-staircase', stairs.filter((c) => !(c.x === 3 && c.y === 3)))).toBe(false);
  });

  it('tower of five, word, bridge, rainbow and two-floor house', () => {
    const tower = (n: number): Cells => Array.from({ length: n }, (_, y) => ({ x: 0, y, z: 0, block: 'colors:green' }));
    expect(matches('big-tower-five', tower(4))).toBe(false);
    expect(matches('big-tower-five', tower(5))).toBe(true);
    expect(card('big-word-sun').blocks.map((b) => b.block)).toEqual(['letters:s', 'letters:u', 'letters:n']);
    const bridge = card('big-bridge').blocks;
    expect(bridge.filter((b) => b.block === 'nature:stone')).toHaveLength(6);
    const noDeck = bridge.filter((b) => !(b.block === 'building:planks' && b.x === 2));
    expect(matches('big-bridge', noDeck.map((b) => ({ ...b })))).toBe(false);
    expect(new Set(card('big-rainbow-wall').blocks.map((b) => b.block)).size).toBe(7);
    const house = card('big-two-floors').blocks;
    expect(Math.max(...house.map((b) => b.y))).toBe(4);
    expect(cardMatchesAt(card('big-two-floors'), lookupFromCells(house.map((b) => ({ ...b }))), house[0], house[0].block)).toBe(true);
  });
});

describe('long-word spelling', () => {
  const lettersAt = (word: string, y = 1): Cells => [...word].map((ch, x) => ({ x, y, z: 0, block: `letters:${ch.toLowerCase()}` }));
  const spell = (word: string, mode: 'big' | 'little', extra: Cells = []) => {
    const cells = [...lettersAt(word), ...extra];
    const get = lookupFromCells(cells);
    return findSpelledWord(get, { x: word.length - 1, y: 1, z: 0 }, buildWordSet(builtInWordsFor(mode), []))?.word ?? null;
  };

  it('big mode has 4 to 5 letter words that do not repeat the little list', () => {
    expect(BIG_WORDS).toEqual(expect.arrayContaining(['TRUCK', 'HOUSE', 'ROBOT', 'PLANT', 'HAPPY']));
    for (const w of BIG_WORDS) {
      expect(w).toMatch(/^[A-Z]{4,5}$/);
      expect(BUILTIN_WORDS).not.toContain(w);
    }
  });

  it.each(['TRUCK', 'HOUSE', 'ROBOT', 'PLANT', 'HAPPY'])('spells %s in big mode only', (word) => {
    expect(spell(word, 'big')).toBe(word);
    expect(spell(word, 'little')).not.toBe(word);
  });

  it('finds a long word inside a longer row, through the letter just placed', () => {
    // The word must include the placed letter: placing the S of "BOOKS" spells nothing.
    expect(spell('BOOKS', 'big')).toBeNull();
    const cells = lettersAt('XHOUSEX');
    expect(findSpelledWord(lookupFromCells(cells), { x: 3, y: 1, z: 0 }, buildWordSet(builtInWordsFor('big'), []))?.word).toBe('HOUSE');
  });
});

describe('mode filters', () => {
  it('packs without a mode show everywhere; big packs only in big mode', () => {
    const packs = [{ id: 'colors' }, { id: 'parts', mode: 'big' as const }];
    expect(packsForMode(packs, 'little').map((p) => p.id)).toEqual(['colors']);
    expect(packsForMode(packs, 'big').map((p) => p.id)).toEqual(['colors', 'parts']);
  });
});

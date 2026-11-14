import { describe, expect, it } from 'vitest';
import { letterOf, lookupFromCells } from '../../../src/learning/grid';
import { buildWordSet, findSpelledWord } from '../../../src/learning/spelling';
import { BUILTIN_WORDS, normalizeWord } from '../../../src/learning/words';

const words = buildWordSet(BUILTIN_WORDS, ['mia']);
const row = (text: string, axis: 'x' | 'z', start = { x: 5, y: 1, z: 5 }, step = 1) =>
  [...text].map((ch, i) => ({
    x: axis === 'x' ? start.x + i * step : start.x,
    y: start.y,
    z: axis === 'z' ? start.z + i * step : start.z,
    block: `letters:${ch.toLowerCase()}`,
  }));

describe('letterOf', () => {
  it('reads letter blocks only', () => {
    expect(letterOf('letters:a')).toBe('A');
    expect(letterOf('colors:red')).toBeNull();
    expect(letterOf('letters:ab')).toBeNull();
    expect(letterOf(null)).toBeNull();
  });
});

describe('findSpelledWord', () => {
  it('finds a word along x', () => {
    const cells = row('CAT', 'x');
    expect(findSpelledWord(lookupFromCells(cells), cells[2]!, words)?.word).toBe('CAT');
  });

  it('accepts a reversed reading along x', () => {
    const cells = row('TAC', 'x');
    expect(findSpelledWord(lookupFromCells(cells), cells[0]!, words)?.word).toBe('CAT');
  });

  it('finds words along z in both directions', () => {
    const forward = row('DOG', 'z', { x: 3, y: 1, z: 10 }, -1); // reads with decreasing z
    expect(findSpelledWord(lookupFromCells(forward), forward[1]!, words)?.word).toBe('DOG');
    const reversed = row('DOG', 'z', { x: 3, y: 1, z: 10 }, 1);
    expect(findSpelledWord(lookupFromCells(reversed), reversed[2]!, words)?.word).toBe('DOG');
  });

  it('supports custom words', () => {
    const cells = row('MIA', 'x');
    expect(findSpelledWord(lookupFromCells(cells), cells[1]!, words)?.word).toBe('MIA');
    expect(findSpelledWord(lookupFromCells(cells), cells[1]!, buildWordSet(BUILTIN_WORDS, []))).toBeNull();
  });

  it('prefers the longest word and allows extra letters around it', () => {
    const cells = row('XLOVEQ', 'x');
    const found = findSpelledWord(lookupFromCells(cells), cells[3]!, words);
    expect(found?.word).toBe('LOVE');
    expect(found?.cells.map((c) => c.x)).toEqual([6, 7, 8, 9]);
  });

  it('requires the placed letter to be part of the word', () => {
    const cells = row('CATX', 'x');
    expect(findSpelledWord(lookupFromCells(cells), cells[3]!, words)).toBeNull();
  });

  it('ignores gaps, other rows and non-letter blocks', () => {
    const gap = [...row('CA', 'x'), ...row('T', 'x', { x: 8, y: 1, z: 5 })];
    expect(findSpelledWord(lookupFromCells(gap), gap[2]!, words)).toBeNull();
    const stacked = row('CAT', 'x').map((c, i) => ({ ...c, y: i }));
    expect(findSpelledWord(lookupFromCells(stacked), stacked[2]!, words)).toBeNull();
    const red = [{ x: 0, y: 0, z: 0, block: 'colors:red' }];
    expect(findSpelledWord(lookupFromCells(red), red[0]!, words)).toBeNull();
  });

  it('handles rows at the world edge', () => {
    const cells = row('SUN', 'x', { x: 21, y: 0, z: 0 });
    expect(findSpelledWord(lookupFromCells(cells), cells[2]!, words)?.word).toBe('SUN');
  });
});

describe('words', () => {
  it('normalizes custom words', () => {
    expect(normalizeWord(' mia ')).toBe('MIA');
    expect(normalizeWord('a')).toBeNull();
    expect(normalizeWord('Zoë')).toBeNull();
  });
  it('has about 40 unique built-in words', () => {
    expect(new Set(BUILTIN_WORDS).size).toBe(BUILTIN_WORDS.length);
    expect(BUILTIN_WORDS.length).toBeGreaterThanOrEqual(40);
  });
});

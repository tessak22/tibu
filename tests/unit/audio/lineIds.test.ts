import { describe, expect, it } from 'vitest';
import {
  blockLine, cardLine, celebrateLine, CELEBRATE_COUNT, countLine, isValidLineId, packLine, randomCelebrateLine, themeLine, wordLine,
} from '../../../src/audio/lineIds';

describe('line id helpers', () => {
  it('builds content line ids', () => {
    expect(blockLine('colors', 'red')).toBe('block.colors.red');
    expect(packLine('animals')).toBe('pack.animals');
    expect(themeLine('meadow')).toBe('theme.meadow');
    expect(cardLine('red-tower')).toBe('card.red-tower');
  });

  it('builds word lines in lower case', () => {
    expect(wordLine('CAT')).toBe('word.cat');
    expect(wordLine(' Mia ')).toBe('word.mia');
  });

  it('limits count lines to 1..16', () => {
    expect(countLine(1)).toBe('count.1');
    expect(countLine(16)).toBe('count.16');
    expect(countLine(0)).toBeNull();
    expect(countLine(17)).toBeNull();
    expect(countLine(2.5)).toBeNull();
  });

  it('wraps celebrate lines into range', () => {
    expect(celebrateLine(1)).toBe('celebrate.1');
    expect(celebrateLine(CELEBRATE_COUNT + 1)).toBe('celebrate.1');
    expect(celebrateLine(0)).toBe(`celebrate.${CELEBRATE_COUNT}`);
    expect(randomCelebrateLine(() => 0)).toBe('celebrate.1');
    expect(randomCelebrateLine(() => 0.9999)).toBe(`celebrate.${CELEBRATE_COUNT}`);
  });

  it('validates line ids as safe file names', () => {
    expect(isValidLineId('block.numbers.10')).toBe(true);
    expect(isValidLineId('smash-mode')).toBe(true);
    expect(isValidLineId('../evil')).toBe(false);
    expect(isValidLineId('Block.X')).toBe(false);
    expect(isValidLineId('')).toBe(false);
  });
});

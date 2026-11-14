import { describe, expect, it } from 'vitest';
import { resolveCard } from '../../../src/content/cards';
import { boxVolume, expandCells } from '../../../src/content/cells';
import { contrastTone, lighten, mix, parseHex, toHex } from '../../../src/content/art/color';
import { hashString, seededRng } from '../../../src/content/art/random';
import { readParams } from '../../../src/content/art/params';
import { blockVoiceLine, cardVoiceLine, packVoiceLine, themeVoiceLine } from '../../../src/content/voice-lines';

describe('cells', () => {
  it('expands boxes inclusively and lets later entries replace earlier ones', () => {
    const cells = expandCells([
      { from: [0, 0, 0], to: [2, 1, 0], block: 'a:wall' },
      { x: 1, y: 0, z: 0, block: 'a:door' },
    ]);
    expect(cells).toHaveLength(6);
    expect(cells.find((c) => c.x === 1 && c.y === 0)?.block).toBe('a:door');
    expect(boxVolume({ from: [2, 0, 0], to: [0, 1, 1], block: 'a:x' })).toBe(12);
  });

  it('normalizes cards to their own origin and sets the voice line', () => {
    const card = resolveCard({ id: 'pair', name: 'pair', blocks: [{ x: 3, y: 2, z: 5, block: 'a:b' }, { x: 4, y: 2, z: 5, block: 'a:b' }] });
    expect(card.blocks.map((b) => [b.x, b.y, b.z])).toEqual([[0, 0, 0], [1, 0, 0]]);
    expect(card.voiceLine).toBe('card.pair');
  });
});

describe('voice line ids', () => {
  it('follow the shared naming scheme', () => {
    expect(blockVoiceLine('colors', 'red')).toBe('block.colors.red');
    expect(packVoiceLine('colors')).toBe('pack.colors');
    expect(themeVoiceLine('space')).toBe('theme.space');
    expect(cardVoiceLine('house')).toBe('card.house');
  });
});

describe('art helpers (pure)', () => {
  it('parses and mixes colors', () => {
    expect(parseHex('#f00')).toEqual({ r: 255, g: 0, b: 0 });
    expect(toHex(parseHex('#12abef'))).toBe('#12abef');
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(lighten('#000000', 1)).toBe('#ffffff');
    expect(contrastTone('#ffffff')).not.toBe('#ffffff');
  });

  it('falls back gracefully on bad colors', () => {
    expect(parseHex('red')).toEqual({ r: 200, g: 200, b: 208 });
  });

  it('produces deterministic random sequences', () => {
    const a = seededRng(hashString('colors:red'));
    const b = seededRng(hashString('colors:red'));
    const seqA = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(seqA);
    expect(seqA.every((v) => v >= 0 && v < 1)).toBe(true);
  });

  it('reads typed params with fallbacks', () => {
    const p = readParams({ count: 3, text: 'A', on: true });
    expect(p.num('count', 0)).toBe(3);
    expect(p.num('text', 7)).toBe(7);
    expect(p.str('text', '?')).toBe('A');
    expect(p.bool('on', false)).toBe(true);
    expect(readParams(undefined).str('x', 'y')).toBe('y');
  });
});

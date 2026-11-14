import { describe, expect, it } from 'vitest';
import { columnHeight, countToSay } from '../../../src/learning/counting';
import { lookupFromCells } from '../../../src/learning/grid';
import { shouldNameBlock } from '../../../src/learning/naming';
import { reactionsFor } from '../../../src/learning/react';
import { PRIORITY } from '../../../src/learning/scheduler';
import { buildWordSet } from '../../../src/learning/spelling';

const column = (block: string, h: number, x = 2, z = 2, y0 = 0) =>
  Array.from({ length: h }, (_, i) => ({ x, y: y0 + i, z, block }));

describe('column counting', () => {
  it('counts identical blocks in a column', () => {
    const cells = column('colors:red', 3);
    const get = lookupFromCells(cells);
    expect(columnHeight(get, { x: 2, y: 2, z: 2 })).toBe(3);
    expect(countToSay(get, { x: 2, y: 2, z: 2 })).toBe(3);
  });

  it('stops at a different block', () => {
    const cells = [...column('nature:grass', 1), ...column('colors:red', 2, 2, 2, 1)];
    expect(countToSay(lookupFromCells(cells), { x: 2, y: 2, z: 2 })).toBe(2);
  });

  it('says nothing for a single block or an empty cell', () => {
    const get = lookupFromCells(column('colors:red', 1));
    expect(countToSay(get, { x: 2, y: 0, z: 2 })).toBeNull();
    expect(columnHeight(get, { x: 9, y: 0, z: 9 })).toBe(0);
  });

  it('counts blocks above the placed one too, capped at 16', () => {
    const get = lookupFromCells(column('colors:blue', 16));
    expect(countToSay(get, { x: 2, y: 0, z: 2 })).toBe(16);
  });
});

describe('naming', () => {
  it('names learning packs and speak blocks only', () => {
    expect(shouldNameBlock({ packId: 'colors', behaviors: [] })).toBe(true);
    expect(shouldNameBlock({ packId: 'nature', behaviors: [] })).toBe(false);
    expect(shouldNameBlock({ packId: 'nature', behaviors: ['speak'] })).toBe(true);
  });
});

describe('reactionsFor', () => {
  const learning = { naming: true, counting: true, spelling: true, buildCards: true };
  const info = { packId: 'letters', behaviors: [], voiceLine: 'block.letters.t', name: 'T' } as const;
  const cat = ['c', 'a', 't'].map((ch, i) => ({ x: i, y: 0, z: 0, block: `letters:${ch}` }));

  it('orders spelling > card > counting > naming', () => {
    const cells = [...cat, { x: 2, y: 1, z: 0, block: 'letters:t' }];
    const card = { id: 'c', name: 'c', voiceLine: 'card.c', blocks: [{ x: 0, y: 0, z: 0, block: 'letters:t' }, { x: 0, y: 1, z: 0, block: 'letters:t' }] };
    const r = reactionsFor({
      get: lookupFromCells(cells), cell: { x: 2, y: 0, z: 0 }, block: 'letters:t', info, learning,
      words: buildWordSet(['CAT'], []), card,
    });
    expect(r.map((x) => x.kind)).toEqual(['spelling', 'card', 'counting', 'naming']);
    expect(r.map((x) => x.priority)).toEqual([PRIORITY.spelling, PRIORITY.card, PRIORITY.counting, PRIORITY.naming]);
  });

  it('respects learning toggles', () => {
    const r = reactionsFor({
      get: lookupFromCells(cat), cell: { x: 2, y: 0, z: 0 }, block: 'letters:t', info,
      learning: { naming: false, counting: true, spelling: false, buildCards: true }, words: buildWordSet(['CAT'], []), card: null,
    });
    expect(r).toEqual([]);
  });
});

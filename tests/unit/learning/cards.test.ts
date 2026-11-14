import { describe, expect, it } from 'vitest';
import { cardMatchesAnywhere, cardMatchesAt, orientations, rotatePattern, type PatternBlock } from '../../../src/learning/cards';
import { lookupFromCells } from '../../../src/learning/grid';
import { paintOrder } from '../../../src/learning/cardPicture';

const L: PatternBlock[] = [
  { x: 0, y: 0, z: 0, block: 'colors:red' },
  { x: 1, y: 0, z: 0, block: 'colors:blue' },
  { x: 1, y: 1, z: 0, block: 'colors:yellow' },
];
const card = { blocks: L };

const place = (pattern: readonly PatternBlock[], dx: number, dy: number, dz: number) =>
  pattern.map((b) => ({ ...b, x: b.x + dx, y: b.y + dy, z: b.z + dz }));

describe('rotatePattern', () => {
  it('four quarter turns return to the start', () => {
    expect(rotatePattern(L, 4)).toEqual(L);
    expect(rotatePattern(L, -1)).toEqual(rotatePattern(L, 3));
  });
  it('keeps y and block', () => {
    const r = rotatePattern(L, 1);
    expect(r.map((b) => [b.y, b.block])).toEqual(L.map((b) => [b.y, b.block]));
    expect(orientations(L)).toHaveLength(4);
  });
});

describe('card matching', () => {
  it('matches with translation', () => {
    const world = place(L, 7, 2, 9);
    const get = lookupFromCells(world);
    for (const b of world) expect(cardMatchesAt(card, get, b, b.block)).toBe(true);
  });

  it('matches every 90 degree rotation', () => {
    for (let t = 0; t < 4; t++) {
      const world = place(rotatePattern(L, t), 10, 1, 10);
      const get = lookupFromCells(world);
      expect(cardMatchesAt(card, get, world[2]!, world[2]!.block)).toBe(true);
      expect(cardMatchesAnywhere(card, world.map((b) => [b, b.block] as const), get)).toBe(true);
    }
  });

  it('does not match a mirror image or wrong blocks', () => {
    // A flat L mirrored equals a turn, so use a 3D chiral shape.
    const chiral: PatternBlock[] = [...L, { x: 1, y: 0, z: 1, block: 'colors:green' }];
    const mirroredChiral = place(chiral.map((b) => ({ ...b, z: -b.z })), 10, 0, 10);
    const getM = lookupFromCells(mirroredChiral);
    expect(cardMatchesAnywhere({ blocks: chiral }, mirroredChiral.map((b) => [b, b.block] as const), getM)).toBe(false);

    const wrong = place(L, 3, 0, 3).map((b, i) => (i === 2 ? { ...b, block: 'colors:green' } : b));
    expect(cardMatchesAt(card, lookupFromCells(wrong), wrong[0]!, wrong[0]!.block)).toBe(false);
  });

  it('ignores extra blocks around the pattern and incomplete builds', () => {
    const world = [...place(L, 4, 0, 4), { x: 0, y: 0, z: 0, block: 'nature:grass' }, { x: 4, y: 1, z: 4, block: 'colors:pink' }];
    const get = lookupFromCells(world);
    expect(cardMatchesAt(card, get, world[0]!, 'colors:red')).toBe(true);
    const partial = place(L, 4, 0, 4).slice(0, 2);
    expect(cardMatchesAt(card, lookupFromCells(partial), partial[0]!, 'colors:red')).toBe(false);
    expect(cardMatchesAt({ blocks: [] }, get, world[0]!, 'colors:red')).toBe(false);
  });

  it('only anchors on the placed block type', () => {
    const world = place(L, 0, 0, 0);
    expect(cardMatchesAt(card, lookupFromCells(world), world[0]!, 'colors:pink')).toBe(false);
  });
});

describe('paintOrder', () => {
  it('draws far and low blocks first', () => {
    const order = paintOrder([
      { x: 1, y: 0, z: 1, block: 'a' },
      { x: 0, y: 1, z: 0, block: 'b' },
      { x: 0, y: 0, z: 0, block: 'c' },
    ]).map((b) => b.block);
    expect(order[0]).toBe('c');
    expect(order.indexOf('b')).toBeLessThan(order.indexOf('a'));
  });
});

import { describe, expect, it } from 'vitest';
import { chooseSticker, placeChests } from '../../../src/explore/chests';
import { GOLD_STAR, STICKER_IDS, STICKERS } from '../../../src/explore/stickerIds';
import { fakeWorld } from './fakeWorld';

const spots = Array.from({ length: 10 }, (_, i) => ({ x: i, y: 1, z: i * 2 }));

describe('placeChests', () => {
  it('is deterministic for the same seed', () => {
    const a = placeChests(fakeWorld(), spots, STICKER_IDS, 99);
    const b = placeChests(fakeWorld(), spots, STICKER_IDS, 99);
    expect(a).toEqual(b);
    const c = placeChests(fakeWorld(), spots, STICKER_IDS, 100);
    expect(c.map((e) => e.sticker)).not.toEqual(a.map((e) => e.sticker));
  });

  it('saves closed chests through world.setEntity, with no duplicate stickers or spots', () => {
    const w = fakeWorld();
    const placed = placeChests(w, [...spots, spots[0]!], [...STICKER_IDS, 'star'], 5);
    expect(w.entities()).toEqual(placed);
    expect(placed).toHaveLength(10);
    expect(new Set(placed.map((e) => e.sticker)).size).toBe(10);
    expect(new Set(placed.map((e) => e.id)).size).toBe(10);
    expect(placed.every((e) => e.kind === 'chest' && !e.opened)).toBe(true);
  });

  it('places only as many chests as there are distinct stickers', () => {
    const placed = placeChests(fakeWorld(), spots, ['star', 'moon', 'star'], 1);
    expect(placed.map((e) => e.sticker).sort()).toEqual(['moon', 'star']);
  });

  it('fills chests with the gold star when no stickers are left', () => {
    const placed = placeChests(fakeWorld(), spots.slice(0, 3), [], 1);
    expect(placed.map((e) => e.sticker)).toEqual([GOLD_STAR, GOLD_STAR, GOLD_STAR]);
  });
});

describe('chooseSticker', () => {
  it("gives the chest's own sticker when it is new", () => {
    expect(chooseSticker('rocket', STICKER_IDS, () => false)).toBe('rocket');
  });

  it('never repeats a found sticker: swaps in the next unfound one', () => {
    const found = new Set(['rocket', 'rainbow']);
    expect(chooseSticker('rocket', STICKER_IDS, (id) => found.has(id))).toBe('star');
  });

  it('gives the gold star when every sticker is found', () => {
    expect(chooseSticker('rocket', STICKER_IDS, () => true)).toBe(GOLD_STAR);
    expect(chooseSticker(GOLD_STAR, STICKER_IDS, () => true)).toBe(GOLD_STAR);
  });

  it('a gold-star chest still gives a real sticker while some are missing', () => {
    expect(chooseSticker(GOLD_STAR, STICKER_IDS, (id) => id !== 'snail')).toBe('snail');
  });
});

describe('STICKERS', () => {
  it('has 24 unique ids with names', () => {
    expect(STICKERS).toHaveLength(24);
    expect(new Set(STICKER_IDS).size).toBe(24);
    expect(STICKER_IDS).not.toContain(GOLD_STAR);
    expect(STICKERS.every((s) => s.name.length > 0)).toBe(true);
  });
});

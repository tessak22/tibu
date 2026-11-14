import { describe, expect, it } from 'vitest';
import { themeChoices, worldKindFor, worldsForMode } from '../../../src/ui/theme-picker';
import type { ThemeDef } from '../../../src/core/types';

const theme = (id: string): ThemeDef => ({ id }) as unknown as ThemeDef;
const world = (id: string, kind?: 'island' | 'explore') => ({ id, data: kind ? { kind } : {} });

describe('theme picker world kinds', () => {
  it('little mode makes islands, big mode makes adventures', () => {
    expect(worldKindFor('little')).toBe('island');
    expect(worldKindFor('big')).toBe('explore');
  });
  it('every theme appears once, never doubled', () => {
    for (const mode of ['little', 'big'] as const) {
      const choices = themeChoices([theme('a'), theme('b')], mode);
      expect(choices.map((c) => c.theme.id)).toEqual(['a', 'b']);
      expect(new Set(choices.map((c) => c.kind))).toEqual(new Set([worldKindFor(mode)]));
    }
  });
});

describe('worldsForMode', () => {
  const worlds = [world('old'), world('isle', 'island'), world('adv', 'explore')];
  it('lists islands (including old worlds without a kind) under Little', () => {
    expect(worldsForMode(worlds, 'little').map((w) => w.id)).toEqual(['old', 'isle']);
  });
  it('lists adventures under Big', () => {
    expect(worldsForMode(worlds, 'big').map((w) => w.id)).toEqual(['adv']);
  });
  it('never drops a world: both lists together hold every world', () => {
    const both = [...worldsForMode(worlds, 'little'), ...worldsForMode(worlds, 'big')];
    expect(both).toHaveLength(worlds.length);
    expect(worlds).toHaveLength(3);
  });
});

import { describe, expect, it } from 'vitest';
import { nearestCells } from '../../../src/render/effects/glowLights';

describe('nearestCells', () => {
  it('returns the closest cell centers first, up to the limit', () => {
    const cells = [
      { x: 10, y: 0, z: 0, id: 'far' },
      { x: 0, y: 0, z: 0, id: 'near' },
      { x: 3, y: 0, z: 0, id: 'mid' },
    ];
    expect(nearestCells(cells, { x: 0.5, y: 0.5, z: 0.5 }, 2).map((c) => c.id)).toEqual(['near', 'mid']);
    expect(nearestCells(cells, { x: 0, y: 0, z: 0 }, 0)).toEqual([]);
    expect(cells.map((c) => c.id)).toEqual(['far', 'near', 'mid']); // Input untouched.
  });
});

import { describe, expect, it } from 'vitest';
import type { Rotation } from '../../../src/core/types';
import { SHAPES } from '../../../src/content/constants';
import { dot, shapeSolids, VIEW_DIR, visiblePolys } from '../../../src/content/art/shape-geometry';

const ROTS: Rotation[] = [0, 1, 2, 3];

describe('shape geometry for pictures and tray icons', () => {
  it.each(SHAPES.map((s) => [s] as const))('%s stays inside its cell at every rotation and shows faces', (shape) => {
    for (const rot of ROTS) {
      const pts = shapeSolids(shape, rot).flatMap((s) => s.polys.flatMap((p) => p.pts));
      for (const p of pts) for (const v of p) {
        expect(v).toBeGreaterThanOrEqual(-1e-9);
        expect(v).toBeLessThanOrEqual(1 + 1e-9);
      }
      const visible = visiblePolys(shape, rot, [0, 0, 0]);
      expect(visible.length).toBeGreaterThan(0);
      expect(visible.every((p) => dot(p.normal, VIEW_DIR) > 0)).toBe(true);
    }
  });

  it('a slope at rotation 0 is high on the north side and turns with the rotation', () => {
    const top = (rot: Rotation) => shapeSolids('slope', rot)[0].polys.find((p) => p.face === 'top')!;
    expect(top(0).normal[2]).toBeGreaterThan(0); // faces south: high edge north
    expect(top(1).normal[0]).toBeLessThan(0); // high edge east, slopes down to the west
    expect(top(2).normal[2]).toBeLessThan(0);
  });

  it('offsets polygons to the cell position', () => {
    const polys = visiblePolys('cube', 0, [3, 4, 5]);
    expect(polys.find((p) => p.face === 'top')!.pts[0]).toEqual([3, 5, 5]);
  });
});

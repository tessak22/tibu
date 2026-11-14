import { describe, expect, it } from 'vitest';
import { createWorld, findPath, isReachable, neighbors, standable } from '../../../src/world';
import type { WorldModel } from '../../../src/core/types';

const c = (x: number, y: number, z: number) => ({ x, y, z });

/** Flat 10x10 floor at y=0 (stand at y=1). */
function flat(): WorldModel {
  const w = createWorld('meadow');
  for (let x = 0; x < 10; x++) for (let z = 0; z < 10; z++) w.place(c(x, 0, z), 'nature:grass');
  return w;
}

describe('standable', () => {
  it('needs empty cell, headroom and ground below', () => {
    const w = flat();
    expect(standable(w, c(2, 1, 2))).toBe(true);
    expect(standable(w, c(2, 2, 2))).toBe(false); // nothing below
    expect(standable(w, c(2, 0, 2))).toBe(false); // occupied
    w.place(c(3, 2, 3), 'colors:red');
    expect(standable(w, c(3, 1, 3))).toBe(false); // no headroom
    expect(standable(w, c(20, 1, 2))).toBe(false); // out of the floor / world
  });
});

describe('neighbors', () => {
  it('steps up or down at most 1', () => {
    const w = flat();
    w.place(c(3, 1, 2), 'colors:red'); // step of 1
    w.place(c(2, 1, 3), 'colors:red');
    w.place(c(2, 2, 3), 'colors:red'); // wall of 2
    const n = neighbors(w, c(2, 1, 2));
    expect(n).toContainEqual(c(3, 2, 2));
    expect(n).toContainEqual(c(1, 1, 2));
    expect(n).toContainEqual(c(2, 1, 1));
    expect(n).toHaveLength(3);
    expect(neighbors(w, c(3, 2, 2))).toContainEqual(c(4, 1, 2)); // step down
  });

  it('never walks off an edge', () => {
    const w = flat();
    expect(neighbors(w, c(0, 1, 0))).toHaveLength(2);
  });
});

describe('findPath / isReachable', () => {
  it('finds a shortest path around a wall', () => {
    const w = flat();
    for (let z = 0; z < 9; z++) {
      w.place(c(5, 1, z), 'colors:red');
      w.place(c(5, 2, z), 'colors:red');
    }
    const path = findPath(w, c(0, 1, 0), c(9, 1, 0));
    expect(path?.[0]).toEqual(c(0, 1, 0));
    expect(path?.[path.length - 1]).toEqual(c(9, 1, 0));
    expect(path).toHaveLength(9 + 9 * 2 + 1);
    for (let i = 1; i < (path?.length ?? 0); i++) {
      const [a, b] = [path![i - 1], path![i]];
      expect(Math.abs(a.x - b.x) + Math.abs(a.z - b.z)).toBe(1);
      expect(Math.abs(a.y - b.y)).toBeLessThanOrEqual(1);
    }
    expect(isReachable(w, c(0, 1, 0), c(9, 1, 0))).toBe(true);
  });

  it('climbs a staircase but not a 2-high step', () => {
    const w = flat();
    w.place(c(5, 1, 5), 'colors:red');
    w.place(c(6, 1, 5), 'colors:red');
    w.place(c(6, 2, 5), 'colors:red');
    expect(isReachable(w, c(4, 1, 5), c(6, 3, 5))).toBe(true);
    w.remove(c(5, 1, 5));
    w.place(c(6, 3, 5), 'colors:red');
    w.place(c(6, 4, 5), 'colors:red');
    expect(findPath(w, c(4, 1, 5), c(6, 5, 5))).toBeNull();
  });

  it('respects the node budget and unreachable goals', () => {
    const w = flat();
    expect(findPath(w, c(0, 1, 0), c(9, 1, 9), 5)).toBeNull();
    expect(findPath(w, c(0, 1, 0), c(9, 5, 9))).toBeNull();
    expect(findPath(w, c(0, 1, 0), c(0, 1, 0))).toEqual([c(0, 1, 0)]);
  });
});

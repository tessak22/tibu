import { describe, expect, it } from 'vitest';
import { isAdjacent, nearestStandable, planRoute, sameCell } from '../../../src/explore/route';
import * as walk from '../../../src/world/walk';
import { fakeWorld, floor } from './fakeWorld';

describe('planRoute', () => {
  it('walks straight to a reachable cell without including the start', () => {
    const w = fakeWorld();
    floor(w);
    const r = planRoute(walk, w, { x: 1, y: 1, z: 1 }, { x: 4, y: 1, z: 1 }, 5000);
    expect(r.reached).toBe(true);
    expect(r.steps).toHaveLength(3);
    expect(sameCell(r.steps[2]!, { x: 4, y: 1, z: 1 })).toBe(true);
  });

  it('every step moves one cell horizontally and at most one level', () => {
    const w = fakeWorld();
    floor(w);
    w.place({ x: 3, y: 1, z: 1 }, 'b');
    w.place({ x: 4, y: 1, z: 1 }, 'b');
    w.place({ x: 4, y: 2, z: 1 }, 'b');
    const start = { x: 1, y: 1, z: 1 };
    const r = planRoute(walk, w, start, { x: 4, y: 3, z: 1 }, 5000);
    expect(r.reached).toBe(true);
    let prev = start;
    for (const s of r.steps) {
      expect(Math.abs(s.x - prev.x) + Math.abs(s.z - prev.z)).toBe(1);
      expect(Math.abs(s.y - prev.y)).toBeLessThanOrEqual(1);
      prev = s;
    }
  });

  it('walks to the nearest reachable cell when the target is cut off', () => {
    const w = fakeWorld();
    floor(w, 0, 0, 4, 11); // left island
    floor(w, 8, 0, 11, 11); // right island, no bridge
    const r = planRoute(walk, w, { x: 1, y: 1, z: 5 }, { x: 10, y: 1, z: 5 }, 5000);
    expect(r.reached).toBe(false);
    const last = r.steps[r.steps.length - 1]!;
    expect(last).toEqual({ x: 4, y: 1, z: 5 });
  });

  it('returns an empty route (shrug, no failure) when nothing gets closer', () => {
    const w = fakeWorld();
    floor(w, 0, 0, 0, 0);
    const r = planRoute(walk, w, { x: 0, y: 1, z: 0 }, { x: 9, y: 1, z: 9 }, 5000);
    expect(r).toEqual({ steps: [], reached: false });
  });
});

describe('nearestStandable (stuck recovery)', () => {
  it('keeps a valid cell', () => {
    const w = fakeWorld();
    floor(w);
    const ok = (c: { x: number; y: number; z: number }) => walk.standable(w, c);
    expect(nearestStandable(ok, { x: 2, y: 1, z: 2 }, 6, w.size.y, { x: 0, y: 1, z: 0 })).toEqual({ x: 2, y: 1, z: 2 });
  });

  it('hops on top when a block is placed on the actor', () => {
    const w = fakeWorld();
    floor(w);
    w.place({ x: 2, y: 1, z: 2 }, 'b');
    const ok = (c: { x: number; y: number; z: number }) => walk.standable(w, c);
    expect(nearestStandable(ok, { x: 2, y: 1, z: 2 }, 6, w.size.y, { x: 0, y: 1, z: 0 })).toEqual({ x: 2, y: 2, z: 2 });
  });

  it('steps sideways when the actor is buried in a tall stack', () => {
    const w = fakeWorld();
    floor(w);
    for (let y = 1; y < w.size.y; y++) w.place({ x: 5, y, z: 5 }, 'b');
    const ok = (c: { x: number; y: number; z: number }) => walk.standable(w, c);
    const c = nearestStandable(ok, { x: 5, y: 1, z: 5 }, 6, w.size.y, { x: 0, y: 1, z: 0 });
    expect(c.y).toBe(1);
    expect(Math.abs(c.x - 5) + Math.abs(c.z - 5)).toBe(1);
  });

  it('drops down when the floor under it is smashed', () => {
    const w = fakeWorld();
    floor(w);
    w.place({ x: 3, y: 1, z: 3 }, 'b');
    // Stood on top of (3,1,3) at y=2; now the block is removed.
    w.remove({ x: 3, y: 1, z: 3 });
    const ok = (c: { x: number; y: number; z: number }) => walk.standable(w, c);
    const c = nearestStandable(ok, { x: 3, y: 2, z: 3 }, 6, w.size.y, { x: 0, y: 1, z: 0 });
    expect(ok(c)).toBe(true);
    expect(c.y).toBe(1);
  });

  it('falls back to spawn when nothing is near', () => {
    const w = fakeWorld();
    const ok = (c: { x: number; y: number; z: number }) => walk.standable(w, c);
    expect(nearestStandable(ok, { x: 5, y: 3, z: 5 }, 2, w.size.y, { x: 1, y: 1, z: 1 })).toEqual({ x: 1, y: 1, z: 1 });
  });
});

describe('isAdjacent', () => {
  it('counts the 8 neighbours within one level, not the same cell', () => {
    expect(isAdjacent({ x: 1, y: 1, z: 1 }, { x: 2, y: 1, z: 2 })).toBe(true);
    expect(isAdjacent({ x: 1, y: 1, z: 1 }, { x: 1, y: 2, z: 2 })).toBe(true);
    expect(isAdjacent({ x: 1, y: 1, z: 1 }, { x: 3, y: 1, z: 1 })).toBe(false);
    expect(isAdjacent({ x: 1, y: 1, z: 1 }, { x: 1, y: 1, z: 1 })).toBe(false);
  });
});

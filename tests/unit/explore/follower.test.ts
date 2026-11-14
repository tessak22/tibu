import { describe, expect, it } from 'vitest';
import {
  advanceFollower,
  angleDelta,
  createFollower,
  createPose,
  facing,
  followerDone,
  stepPose,
  turnToward,
  type StepTiming,
} from '../../../src/explore/follower';

const T: StepTiming = { flat: 0.5, climb: 1 };

describe('stepPose', () => {
  it('interpolates flat steps without vertical movement', () => {
    const p = createPose({ x: 0, y: 1, z: 0 });
    stepPose({ x: 0, y: 1, z: 0 }, { x: 1, y: 1, z: 0 }, 0.5, 0.3, p);
    expect(p.x).toBeCloseTo(0.5);
    expect(p.y).toBe(1);
    expect(p.hop).toBe(0);
    expect(p.climb).toBe(0);
  });

  it('ends exactly on the target cell', () => {
    const p = createPose({ x: 0, y: 1, z: 0 });
    stepPose({ x: 0, y: 1, z: 0 }, { x: 0, y: 2, z: 1 }, 1, 0.3, p);
    expect([p.x, p.y, p.z]).toEqual([0, 2, 1]);
  });

  it('hops above both levels mid-climb so it clears the block edge', () => {
    const p = createPose({ x: 0, y: 1, z: 0 });
    stepPose({ x: 0, y: 1, z: 0 }, { x: 1, y: 2, z: 0 }, 0.5, 0.3, p);
    expect(p.y).toBeGreaterThan(2);
    expect(p.climb).toBe(1);
    stepPose({ x: 0, y: 2, z: 0 }, { x: 1, y: 1, z: 0 }, 0.5, 0.3, p);
    expect(p.climb).toBe(-1);
    expect(p.y).toBeGreaterThan(1);
  });

  it('clamps progress', () => {
    const p = createPose({ x: 0, y: 1, z: 0 });
    stepPose({ x: 0, y: 1, z: 0 }, { x: 1, y: 1, z: 0 }, 3, 0.3, p);
    expect(p.x).toBe(1);
  });
});

describe('follower', () => {
  it('arrives at each cell in order with flat and climb timings', () => {
    const steps = [
      { x: 1, y: 1, z: 0 },
      { x: 2, y: 2, z: 0 },
    ];
    const f = createFollower({ x: 0, y: 1, z: 0 }, steps);
    expect(advanceFollower(f, 0.25, T)).toBe(0);
    expect(advanceFollower(f, 0.25, T)).toBe(1);
    expect(f.from).toEqual(steps[0]);
    expect(advanceFollower(f, 0.5, T)).toBe(0); // climb takes 1s
    expect(advanceFollower(f, 0.5, T)).toBe(1);
    expect(followerDone(f)).toBe(true);
    expect(advanceFollower(f, 1, T)).toBe(0);
  });
});

describe('facing and turning', () => {
  it('faces the step direction (0 = +z)', () => {
    expect(facing({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, 9)).toBeCloseTo(0);
    expect(facing({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, 9)).toBeCloseTo(Math.PI / 2);
    expect(facing({ x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, 9)).toBe(9);
  });

  it('turns the short way round', () => {
    expect(angleDelta(3, -3)).toBeCloseTo(2 * Math.PI - 6);
    const y = turnToward(3, -3, 10, 0.016);
    expect(y).toBeGreaterThan(3);
  });
});

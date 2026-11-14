import { describe, expect, it } from 'vitest';
import { ACTOR_TAP_SLACK, actorWinsTap } from '../../../src/input/targeting';

describe('actorWinsTap', () => {
  it('an actor in front of the first block wins', () => {
    expect(actorWinsTap(4, 6)).toBe(true);
  });

  it('a buddy behind a wall does not steal the tap', () => {
    expect(actorWinsTap(9, 6)).toBe(false);
  });

  it('an actor standing right against the tapped block still wins', () => {
    expect(actorWinsTap(6 + ACTOR_TAP_SLACK / 2, 6)).toBe(true);
  });

  it('with no block on the ray the actor wins; with no actor it never does', () => {
    expect(actorWinsTap(12, null)).toBe(true);
    expect(actorWinsTap(null, 3)).toBe(false);
    expect(actorWinsTap(Number.NaN, 3)).toBe(false);
  });
});

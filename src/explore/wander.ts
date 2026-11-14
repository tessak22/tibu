/** Pure animal wander logic. */
import type { Cell } from '../core/types';
import { randInt, type Rng } from './rng';

/**
 * Picks a standable cell within `radius` (horizontally) of `home`, trying a few levels
 * around home.y. Returns null after `tries` misses (the animal just keeps resting).
 */
export function pickWanderTarget(
  rng: Rng,
  home: Cell,
  radius: number,
  isStandable: (cell: Cell) => boolean,
  tries = 12,
): Cell | null {
  const span = radius * 2 + 1;
  for (let i = 0; i < tries; i++) {
    const x = home.x - radius + randInt(rng, span);
    const z = home.z - radius + randInt(rng, span);
    for (const dy of [0, 1, -1, 2, -2]) {
      const c = { x, y: home.y + dy, z };
      if (isStandable(c)) return c;
    }
  }
  return null;
}

/** Keeps a route inside the animal's range, cutting it at the first cell outside. */
export function clampRoute(steps: readonly Cell[], home: Cell, radius: number): Cell[] {
  const out: Cell[] = [];
  for (const s of steps) {
    if (Math.abs(s.x - home.x) > radius || Math.abs(s.z - home.z) > radius) break;
    out.push(s);
  }
  return out;
}

/** Seconds to rest between wanders: 2..6 s, longer sometimes. */
export function restTime(rng: Rng): number {
  return 2 + rng() * 4 + (rng() < 0.2 ? 4 : 0);
}

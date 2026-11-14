/**
 * Topple fun: a cheerful "Timber!" now and then when a tower falls. Pure.
 * Never every time (it would get old) and never a failure sound.
 */
export const CRASH_MIN_COLLAPSED = 3;
export const CRASH_CHANCE = 0.5;
export const CRASH_COOLDOWN_MS = 8000;

export interface CrashGate {
  /** True when this topple should get a spoken reaction; remembers the time when it does. */
  shouldCheer(collapsed: number): boolean;
}

export function createCrashGate(opts: { random?: () => number; now?: () => number } = {}): CrashGate {
  const random = opts.random ?? Math.random;
  const now = opts.now ?? (() => Date.now());
  let last = -Infinity;
  return {
    shouldCheer(collapsed) {
      if (collapsed < CRASH_MIN_COLLAPSED) return false;
      const t = now();
      if (t - last < CRASH_COOLDOWN_MS) return false;
      if (random() >= CRASH_CHANCE) return false;
      last = t;
      return true;
    },
  };
}

/**
 * Play timer: calls onSleep once after `minutes` of play. Pure timing logic;
 * the UI does the dimming and the resting screen.
 */
export interface PlayTimer {
  /** Starts (or resumes) counting. Safe to call repeatedly. */
  start(): void;
  /** Pauses counting; remaining time is kept so start() resumes. */
  stop(): void;
  remainingMs(): number;
}

export function createPlayTimer(opts: { minutes: number; onSleep: () => void; now?: () => number }): PlayTimer {
  const now = opts.now ?? (() => Date.now());
  const total = Number.isFinite(opts.minutes) ? Math.max(0, opts.minutes) * 60_000 : 0;
  let remaining = total;
  let startedAt: number | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let fired = false;

  const elapsedSinceStart = (): number => (startedAt === null ? 0 : Math.max(0, now() - startedAt));

  const fire = (): void => {
    timer = null;
    startedAt = null;
    remaining = 0;
    if (fired) return;
    fired = true;
    opts.onSleep();
  };

  return {
    start() {
      if (timer !== null || fired) return;
      startedAt = now();
      timer = setTimeout(fire, remaining);
    },
    stop() {
      if (timer === null) return;
      clearTimeout(timer);
      timer = null;
      remaining = Math.max(0, remaining - elapsedSinceStart());
      startedAt = null;
    },
    remainingMs() {
      return Math.max(0, remaining - elapsedSinceStart());
    },
  };
}

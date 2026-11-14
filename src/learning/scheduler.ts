/**
 * Decides what Tibu says after rapid placements so it never talks over itself.
 *
 * - Speech is debounced: only the latest utterance in a short window runs.
 * - Within the window a lower-priority utterance never replaces a higher one
 *   (finished build > spelling > card > build step > topple crash > counting > naming),
 *   so a celebration is not lost to a block placed right after it.
 * - After a celebration starts, lower-priority speech is dropped for a while so
 *   the phrase is not cut off.
 */
export const PRIORITY = { naming: 0, counting: 1, crash: 2, step: 3, card: 4, spelling: 5, blueprint: 6 } as const;

/** Utterances at or above this priority briefly block lower ones so they are not cut off. */
const LOCKING = PRIORITY.step;
export type Priority = (typeof PRIORITY)[keyof typeof PRIORITY];

export interface Utterance {
  readonly priority: Priority;
  readonly run: () => void;
}

export interface SpeechScheduler {
  submit(u: Utterance): void;
  dispose(): void;
}

export interface SchedulerOptions {
  readonly delayMs?: number;
  /** How long a step/card/spelling/build celebration blocks lower-priority speech. */
  readonly celebrationLockMs?: number;
  readonly now?: () => number;
}

export function createSpeechScheduler(opts: SchedulerOptions = {}): SpeechScheduler {
  const delayMs = opts.delayMs ?? 220;
  const lockMs = opts.celebrationLockMs ?? 2800;
  const now = opts.now ?? (() => Date.now());
  let pending: Utterance | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lock: { priority: Priority; until: number } | null = null;

  const flush = (): void => {
    timer = null;
    const u = pending;
    pending = null;
    if (!u) return;
    if (u.priority >= LOCKING) lock = { priority: u.priority, until: now() + lockMs };
    u.run();
  };

  return {
    submit(u) {
      if (lock && now() < lock.until && u.priority < lock.priority) return;
      if (pending && u.priority < pending.priority) return;
      pending = u;
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(flush, delayMs);
    },
    dispose() {
      if (timer !== null) clearTimeout(timer);
      timer = null;
      pending = null;
    },
  };
}

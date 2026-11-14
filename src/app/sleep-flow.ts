import type { Settings } from '../core/types';
import { createPlayTimer, type PlayTimer } from '../learning/sleep';

export interface SleepController {
  /** Count play time (only while a world is open and the page is visible). */
  resume(): void;
  pause(): void;
  /** Re-reads the timer setting; a changed duration starts fresh. */
  configure(settings: Settings): void;
  /** After waking: start a fresh timer. */
  reset(): void;
  dispose(): void;
}

/** Owns the parent-set play timer. Calls onSleep once when it runs out. */
export function createSleepController(initial: Settings, onSleep: () => void): SleepController {
  let minutes = initial.playTimerMinutes;
  let timer: PlayTimer | null = null;
  let running = false;

  const build = (): void => {
    timer?.stop();
    timer = minutes === null ? null : createPlayTimer({ minutes, onSleep });
    if (running) timer?.start();
  };
  const onVisibility = (): void => {
    if (document.visibilityState === 'hidden') timer?.stop();
    else if (running) timer?.start();
  };
  document.addEventListener('visibilitychange', onVisibility);
  build();

  return {
    resume() {
      running = true;
      if (document.visibilityState !== 'hidden') timer?.start();
    },
    pause() {
      running = false;
      timer?.stop();
    },
    configure(settings) {
      if (settings.playTimerMinutes === minutes) return;
      minutes = settings.playTimerMinutes;
      build();
    },
    reset: build,
    dispose() {
      timer?.stop();
      document.removeEventListener('visibilitychange', onVisibility);
    },
  };
}

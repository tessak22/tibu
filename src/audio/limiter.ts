/**
 * Keeps spam-tapping pleasant (pure logic, time is passed in seconds).
 * - At most `maxVoices` sounds overlap; extra sounds are dropped.
 * - The same sound key cannot retrigger within `minGap` seconds.
 */
export interface VoiceLimiter {
  /** Returns true if a sound with this key may start now and reserves a slot until now+duration. */
  tryStart(key: string, now: number, duration: number): boolean;
  active(now: number): number;
}

export function createVoiceLimiter(maxVoices = 6, minGap = 0.045): VoiceLimiter {
  let ends: number[] = [];
  const lastStart = new Map<string, number>();
  return {
    tryStart(key, now, duration) {
      ends = ends.filter((t) => t > now);
      const last = lastStart.get(key);
      if (last !== undefined && now - last < minGap) return false;
      if (ends.length >= maxVoices) return false;
      ends = [...ends, now + Math.max(0, duration)];
      lastStart.set(key, now);
      return true;
    },
    active(now) {
      return ends.filter((t) => t > now).length;
    },
  };
}

/** Converts a MIDI note number to Hz, clamped to a pleasant range. */
export function midiToHz(note: number): number {
  const n = Math.min(108, Math.max(36, Number.isFinite(note) ? note : 60));
  return 440 * Math.pow(2, (n - 69) / 12);
}

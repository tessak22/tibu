import { DEFAULT_SETTINGS, type Settings } from '../core/types';

export const PLAY_TIMER_CHOICES: readonly (number | null)[] = [null, 10, 15, 20, 30, 45, 60];
export const MAX_CUSTOM_WORDS = 30;
export const MAX_WORD_LENGTH = 12;

const clamp01 = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback;

const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);

const stringList = (v: unknown, fallback: readonly string[]): readonly string[] =>
  Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string') : fallback;

/** Normalizes a custom spelling word. Returns null when it is not 2-12 letters A-Z. */
export function normalizeWord(raw: string): string | null {
  const word = raw.trim().toUpperCase();
  return new RegExp(`^[A-Z]{2,${MAX_WORD_LENGTH}}$`).test(word) ? word : null;
}

function mergeTimer(v: unknown): number | null {
  if (v === null || v === undefined) return DEFAULT_SETTINGS.playTimerMinutes;
  return typeof v === 'number' && PLAY_TIMER_CHOICES.includes(v) ? v : DEFAULT_SETTINGS.playTimerMinutes;
}

/**
 * Merges stored (possibly older, partial or corrupt) settings with DEFAULT_SETTINGS.
 * Unknown fields are dropped and every field is type-checked, so new settings added in
 * later versions get their defaults.
 */
export function mergeSettings(stored: unknown): Settings {
  const s = (stored && typeof stored === 'object' ? stored : {}) as Record<string, unknown>;
  const d = DEFAULT_SETTINGS;
  const learning = (s.learning && typeof s.learning === 'object' ? s.learning : {}) as Record<string, unknown>;
  const words = stringList(s.customWords, d.customWords)
    .map(normalizeWord)
    .filter((w): w is string => w !== null);
  return {
    sfxOn: bool(s.sfxOn, d.sfxOn),
    sfxVolume: clamp01(s.sfxVolume, d.sfxVolume),
    musicOn: bool(s.musicOn, d.musicOn),
    musicVolume: clamp01(s.musicVolume, d.musicVolume),
    voiceOn: bool(s.voiceOn, d.voiceOn),
    voiceVolume: clamp01(s.voiceVolume, d.voiceVolume),
    muted: bool(s.muted, d.muted),
    language: typeof s.language === 'string' && s.language.length > 0 ? s.language : d.language,
    enabledPacks: stringList(s.enabledPacks, d.enabledPacks),
    learning: {
      naming: bool(learning.naming, d.learning.naming),
      counting: bool(learning.counting, d.learning.counting),
      spelling: bool(learning.spelling, d.learning.spelling),
      buildCards: bool(learning.buildCards, d.learning.buildCards),
    },
    customWords: Array.from(new Set(words)).slice(0, MAX_CUSTOM_WORDS),
    playTimerMinutes: mergeTimer(s.playTimerMinutes),
    leftHanded: bool(s.leftHanded, d.leftHanded),
    reducedMotion: bool(s.reducedMotion, d.reducedMotion),
  };
}

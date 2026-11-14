import type { Settings } from '../core/types';

/** Effective bus gains derived from Settings (pure). 0 means silent. */
export interface Mix {
  readonly sfx: number;
  readonly music: number;
  readonly voice: number;
  /** Whether the generative music should be running. */
  readonly musicPlaying: boolean;
  readonly voiceEnabled: boolean;
}

const clamp01 = (v: number): number => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);

/** Headroom so sfx stay soft next to the voice. */
const SFX_TRIM = 0.6;
const MUSIC_TRIM = 0.25;

export function mixFromSettings(s: Settings): Mix {
  const sfx = s.muted || !s.sfxOn ? 0 : clamp01(s.sfxVolume) * SFX_TRIM;
  const music = s.muted || !s.musicOn ? 0 : clamp01(s.musicVolume) * MUSIC_TRIM;
  const voice = s.muted || !s.voiceOn ? 0 : clamp01(s.voiceVolume);
  return { sfx, music, voice, musicPlaying: music > 0, voiceEnabled: voice > 0 };
}

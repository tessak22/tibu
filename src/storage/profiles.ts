import type { PlayMode, Profile } from '../core/types';

export const DEFAULT_PROFILE_ANIMAL = 'cat';
export const PLAY_MODES: readonly PlayMode[] = ['little', 'big'];
/** Sticker ids are short slugs; anything else in storage is dropped. */
const STICKER_ID = /^[a-z0-9][a-z0-9-]{0,39}$/;
const MAX_STICKERS = 500;

export function isPlayMode(v: unknown): v is PlayMode {
  return v === 'little' || v === 'big';
}

export function profileMode(p: Pick<Profile, 'mode'>): PlayMode {
  return isPlayMode(p.mode) ? p.mode : 'little';
}

export function isStickerId(v: unknown): v is string {
  return typeof v === 'string' && STICKER_ID.test(v);
}

/**
 * Normalizes a stored profile (possibly written by an older Tibu, or damaged).
 * Profiles saved before big-kid mode get mode 'little' and no stickers. Returns null when
 * the record cannot be a profile at all.
 */
export function normalizeProfile(stored: unknown): Profile | null {
  if (!stored || typeof stored !== 'object') return null;
  const s = stored as Record<string, unknown>;
  if (typeof s.id !== 'string' || s.id.length === 0) return null;
  const stickers = Array.isArray(s.stickers) ? Array.from(new Set(s.stickers.filter(isStickerId))) : [];
  return {
    id: s.id,
    animal: typeof s.animal === 'string' && s.animal.length > 0 ? s.animal : DEFAULT_PROFILE_ANIMAL,
    mode: isPlayMode(s.mode) ? s.mode : 'little',
    stickers: stickers.slice(0, MAX_STICKERS),
    createdAt: typeof s.createdAt === 'number' && Number.isFinite(s.createdAt) ? s.createdAt : 0,
  };
}

/** Returns a copy with the sticker added (no duplicates). Same object when nothing changes. */
export function withSticker(p: Profile, stickerId: string): Profile {
  const current = p.stickers ?? [];
  if (!isStickerId(stickerId) || current.includes(stickerId) || current.length >= MAX_STICKERS) return p;
  return { ...p, stickers: [...current, stickerId] };
}

/** Switching mode never touches stickers or worlds. */
export function withMode(p: Profile, mode: PlayMode): Profile {
  return profileMode(p) === mode && p.mode === mode ? p : { ...p, mode };
}

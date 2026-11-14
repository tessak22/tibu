/** Single source for the public repository link (shown only in the parent area). */
export const DEFAULT_REPO_URL = 'https://github.com/tessak22/tibu';

const envRepo: unknown = import.meta.env?.VITE_REPO_URL;
export const REPO_URL: string = typeof envRepo === 'string' && /^https:\/\//.test(envRepo) ? envRepo : DEFAULT_REPO_URL;

const envVersion: unknown = import.meta.env?.VITE_APP_VERSION;
export const APP_VERSION: string = typeof envVersion === 'string' && envVersion ? envVersion : '1.0.0';

/** Gallery thumbnail size (4:3). */
export const THUMB_SIZE = { width: 480, height: 360 } as const;
/** Longest edge of a saved photo, in pixels. */
export const PHOTO_MAX_EDGE = 2048;
/** How long a matched build card stays up before it clears. */
export const CARD_CLEAR_MS = 2500;
/** Max wait for the sleep line before showing the resting screen. */
export const SLEEP_SCREEN_DELAY_MS = 6000;

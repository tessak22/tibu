/**
 * Voice line id conventions shared by every module. Ids map to entries in
 * voice/LINES.json and to clips at voice/<lang>/<lineId>.m4a.
 */

export const SLEEP_LINE = 'sleep';
export const HELLO_LINE = 'hello';
export const BUILD_MODE_LINE = 'build-mode';
export const SMASH_MODE_LINE = 'smash-mode';
export const CARD_SHOW_LINE = 'card-show';
export const CARD_DONE_LINE = 'card-done';

/** Number of `celebrate.<n>` phrases in LINES.json. */
export const CELEBRATE_COUNT = 8;
/** Highest `count.<n>` line (world is 16 blocks tall). */
export const MAX_COUNT = 16;

export const blockLine = (packId: string, blockId: string): string => `block.${packId}.${blockId}`;
export const packLine = (packId: string): string => `pack.${packId}`;
export const themeLine = (themeId: string): string => `theme.${themeId}`;
export const cardLine = (cardId: string): string => `card.${cardId}`;

/** `count.<n>` for 1..16, or null when out of range. */
export function countLine(n: number): string | null {
  return Number.isInteger(n) && n >= 1 && n <= MAX_COUNT ? `count.${n}` : null;
}

/** `word.<lowercase>` for a spelling word. */
export const wordLine = (word: string): string => `word.${word.trim().toLowerCase()}`;

/** `celebrate.<n>` for 1..CELEBRATE_COUNT (wraps around). */
export function celebrateLine(n: number): string {
  const idx = ((Math.floor(n) - 1) % CELEBRATE_COUNT + CELEBRATE_COUNT) % CELEBRATE_COUNT;
  return `celebrate.${idx + 1}`;
}

/** A random celebrate line. `random` is injectable for tests. */
export function randomCelebrateLine(random: () => number = Math.random): string {
  return celebrateLine(1 + Math.floor(random() * CELEBRATE_COUNT));
}

/** Line ids are lower-case and safe to use as file names. */
export function isValidLineId(id: string): boolean {
  return /^[a-z0-9][a-z0-9._-]*$/.test(id);
}

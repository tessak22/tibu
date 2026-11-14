/**
 * Built-in spelling words. Letter blocks placed in a row that spell one of these
 * (or a parent-added custom word) are spoken and celebrated.
 * Each word has a voice line `word.<lowercase>` in voice/LINES.json.
 */
export const BUILTIN_WORDS: readonly string[] = [
  'HI', 'MOM', 'DAD', 'CAT', 'DOG', 'SUN', 'BUS', 'COW', 'PIG', 'HEN',
  'FOX', 'OWL', 'BEE', 'ANT', 'BAT', 'HAT', 'BED', 'BOX', 'CAR', 'CUP',
  'EGG', 'MAP', 'TOP', 'RED', 'BIG', 'RUN', 'YES', 'NO', 'UP', 'GO',
  'LOVE', 'FISH', 'BALL', 'BOAT', 'CAKE', 'DUCK', 'FROG', 'HOME', 'MOON',
  'STAR', 'TREE', 'BABY', 'BEAR', 'BIRD', 'BLUE', 'HUG',
];

/** Normalizes a word to upper-case A-Z, or returns null if it has other characters. */
export function normalizeWord(word: string): string | null {
  const upper = word.trim().toUpperCase();
  return /^[A-Z]{2,16}$/.test(upper) ? upper : null;
}

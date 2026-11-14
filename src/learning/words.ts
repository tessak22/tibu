import type { PlayMode } from '../core/types';

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

/**
 * Longer words (4 to 5 letters) that big-kid mode also accepts, on top of
 * BUILTIN_WORDS. Each has a voice line `word.<lowercase>` too.
 */
export const BIG_WORDS: readonly string[] = [
  'BOOK', 'DOOR', 'FARM', 'JUMP', 'KITE', 'LION', 'MILK', 'NEST', 'PARK', 'RAIN', 'ROCK', 'SHIP',
  'SNOW', 'SOCK', 'BIKE', 'CAMP', 'GIFT', 'HAND', 'LAMP', 'ROOF', 'SAND', 'WIND', 'PLAY', 'BLOCK',
  'TRUCK', 'HOUSE', 'ROBOT', 'PLANT', 'HAPPY', 'TRAIN', 'HORSE', 'APPLE', 'BREAD', 'CLOUD', 'SMILE',
  'TIGER', 'ZEBRA', 'LEMON', 'MUSIC', 'PIZZA', 'BRICK', 'TOWER', 'WATER', 'GREEN', 'PLANE', 'SHEEP',
  'MOUSE', 'BUILD', 'CHAIR', 'TABLE', 'BEACH', 'SNAKE', 'WHEEL',
];

/** Built-in words for a play mode: big mode adds the longer words. */
export function builtInWordsFor(mode: PlayMode): readonly string[] {
  return mode === 'big' ? [...BUILTIN_WORDS, ...BIG_WORDS] : BUILTIN_WORDS;
}

/** Every built-in word in any mode (all have voice clips). */
export const ALL_BUILTIN_WORDS: readonly string[] = [...BUILTIN_WORDS, ...BIG_WORDS];

/** Normalizes a word to upper-case A-Z, or returns null if it has other characters. */
export function normalizeWord(word: string): string | null {
  const upper = word.trim().toUpperCase();
  return /^[A-Z]{2,16}$/.test(upper) ? upper : null;
}

/**
 * Voice line ids used by the learning features (big-kid mode additions).
 * Every id here has English text in voice/LINES.json; scripts/voice/sync.ts
 * re-adds any that go missing from LEARNING_LINES. Pure.
 */
import { MAX_COUNT } from '../audio/lineIds';
import type { PlayMode } from '../core/types';

/** Big worlds are 32 blocks tall, so big mode counts up to 32. */
export const BIG_MAX_COUNT = 32;

export const maxCountFor = (mode: PlayMode): number => (mode === 'big' ? BIG_MAX_COUNT : MAX_COUNT);

/** `count.<n>` for 1..max (max defaults to the big-mode limit), else null. */
export function countLineUpTo(n: number, max: number = BIG_MAX_COUNT): string | null {
  return Number.isInteger(n) && n >= 1 && n <= Math.min(max, BIG_MAX_COUNT) ? `count.${n}` : null;
}

export const STEP_CHEER_LINES = ['step.cheer.1', 'step.cheer.2', 'step.cheer.3'] as const;
export const STEP_NEXT_LINE = 'step.next';
export const STEP_LAST_LINE = 'step.last';
/** For the UI when a blueprint is picked. */
export const BLUEPRINT_START_LINE = 'blueprint.start';
export const CRASH_LINES = ['crash.1', 'crash.2', 'crash.3', 'crash.4'] as const;

/** Generic explore lines (sticker names come with the explore content). */
export const EXPLORE_LINES = {
  sticker: 'explore.sticker',
  /** Used by src/explore when a chest opens (same text as `sticker`). */
  stickerFound: 'explore.sticker-found',
  treasure: 'explore.treasure',
  go: 'explore.go',
  look: 'explore.look',
} as const;

const pick = <T>(list: readonly T[], random: () => number): T => list[Math.min(list.length - 1, Math.floor(random() * list.length))];

export const randomStepCheer = (random: () => number = Math.random): string => pick(STEP_CHEER_LINES, random);
export const randomCrashLine = (random: () => number = Math.random): string => pick(CRASH_LINES, random);

const NUMBER_WORDS = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
  'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen', 'Twenty',
];

function numberWord(n: number): string {
  if (n <= 20) return NUMBER_WORDS[n];
  const tens = Math.floor(n / 10) === 3 ? 'Thirty' : 'Twenty';
  const unit = n % 10;
  return unit === 0 ? tens : `${tens}-${NUMBER_WORDS[unit].toLowerCase()}`;
}

/** English text for every line above (counts 17..32 included). */
export const LEARNING_LINES: readonly { readonly id: string; readonly en: string }[] = [
  { id: 'step.cheer.1', en: 'Great job!' },
  { id: 'step.cheer.2', en: 'Well done!' },
  { id: 'step.cheer.3', en: 'Nice building!' },
  { id: STEP_NEXT_LINE, en: 'Next step!' },
  { id: STEP_LAST_LINE, en: 'Last step!' },
  { id: BLUEPRINT_START_LINE, en: "Let's build it, step by step!" },
  { id: 'crash.1', en: 'Timber!' },
  { id: 'crash.2', en: 'Crash!' },
  { id: 'crash.3', en: 'Ka-boom!' },
  { id: 'crash.4', en: 'Down it goes!' },
  { id: EXPLORE_LINES.sticker, en: 'You found a sticker!' },
  { id: EXPLORE_LINES.stickerFound, en: 'You found a sticker!' },
  { id: EXPLORE_LINES.treasure, en: 'Treasure!' },
  { id: EXPLORE_LINES.go, en: "Let's go exploring!" },
  { id: EXPLORE_LINES.look, en: 'Look at that!' },
  ...Array.from({ length: BIG_MAX_COUNT - MAX_COUNT }, (_, i) => {
    const n = MAX_COUNT + 1 + i;
    return { id: `count.${n}`, en: `${numberWord(n)}!` };
  }),
];

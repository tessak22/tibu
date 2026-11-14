import type { Cell } from '../core/types';
import { letterOf, type BlockLookup } from './grid';
import { normalizeWord } from './words';

export interface SpelledWord {
  readonly word: string;
  /** Cells of the word, in reading order. */
  readonly cells: readonly Cell[];
}

/**
 * Reading direction from the default camera: along x, increasing x reads
 * left-to-right; along z, decreasing z does. Reversed readings are accepted too,
 * so the exact camera orientation only matters for words that are both valid
 * forwards and backwards (the forward reading wins).
 */
const AXES: readonly { readonly dx: number; readonly dz: number }[] = [
  { dx: 1, dz: 0 },
  { dx: 0, dz: -1 },
];

const MAX_RUN = 24;

export function buildWordSet(builtIn: readonly string[], custom: readonly string[]): ReadonlySet<string> {
  const set = new Set<string>();
  for (const w of [...builtIn, ...custom]) {
    const n = normalizeWord(w);
    if (n) set.add(n);
  }
  return set;
}

/** Contiguous run of letter blocks through `cell` along one axis, in reading order. */
function letterRun(get: BlockLookup, cell: Cell, dx: number, dz: number): { letters: string; cells: Cell[]; index: number } {
  const at = (i: number): Cell => ({ x: cell.x + dx * i, y: cell.y, z: cell.z + dz * i });
  let start = 0;
  while (start > -MAX_RUN && letterOf(get(at(start - 1).x, cell.y, at(start - 1).z))) start--;
  let end = 0;
  while (end < MAX_RUN && letterOf(get(at(end + 1).x, cell.y, at(end + 1).z))) end++;
  const cells: Cell[] = [];
  let letters = '';
  for (let i = start; i <= end; i++) {
    const c = at(i);
    cells.push(c);
    letters += letterOf(get(c.x, c.y, c.z)) ?? '?';
  }
  return { letters, cells, index: -start };
}

/**
 * Finds the longest word (forward reading preferred over reversed) that runs
 * through the placed letter at `cell` along x or z. Extra letters on either
 * side are allowed, so "XCATS" still finds CAT (and CATS if it is a word).
 */
export function findSpelledWord(get: BlockLookup, cell: Cell, words: ReadonlySet<string>): SpelledWord | null {
  if (!letterOf(get(cell.x, cell.y, cell.z)) || words.size === 0) return null;
  let best: { word: string; cells: readonly Cell[]; score: number } | null = null;
  for (const { dx, dz } of AXES) {
    const run = letterRun(get, cell, dx, dz);
    for (let i = 0; i <= run.index; i++) {
      for (let j = Math.max(run.index, i + 1); j < run.letters.length; j++) {
        const forward = run.letters.slice(i, j + 1);
        const reversed = [...forward].reverse().join('');
        const cells = run.cells.slice(i, j + 1);
        const candidates = [
          { word: forward, cells, score: forward.length * 2 + 1 },
          { word: reversed, cells: [...cells].reverse(), score: reversed.length * 2 },
        ];
        for (const c of candidates) {
          if (words.has(c.word) && (!best || c.score > best.score)) best = c;
        }
      }
    }
  }
  return best ? { word: best.word, cells: best.cells } : null;
}

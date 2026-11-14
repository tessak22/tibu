/**
 * LINES.json sync: adds voice lines for content (packs, themes, cards, builds),
 * the built-in spelling words and the learning lines (step cheers, crash lines,
 * counts up to 32, explore lines). Never removes or rewrites existing lines.
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { blockLine, cardLine, isValidLineId, packLine, themeLine, wordLine } from '../../src/audio/lineIds';
import { blueprintVoiceLine, builtVoiceLine } from '../../src/content/voice-lines';
import { LEARNING_LINES } from '../../src/learning/lines';
import { BIG_WORDS } from '../../src/learning/words';

export interface LinesDoc {
  readonly $comment?: string;
  readonly languages: Readonly<Record<string, unknown>>;
  readonly lines: Readonly<Record<string, Readonly<Record<string, string>>>>;
}

export interface WantedLine {
  readonly id: string;
  readonly en: string;
}

export interface SyncResult {
  readonly doc: LinesDoc;
  readonly added: readonly string[];
}

type Json = Record<string, unknown>;

const isRecord = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);

/** English text from a `name` field that may be a string or `{ en: "..." }`. */
export function englishName(name: unknown): string | null {
  if (typeof name === 'string' && name.trim()) return name.trim();
  if (isRecord(name) && typeof name.en === 'string' && name.en.trim()) return name.en.trim();
  return null;
}

function idOf(json: Json, fallback: string): string {
  return typeof json.id === 'string' && json.id.trim() ? json.id.trim() : fallback;
}

/** Lines wanted for one pack.json document. */
export function packLines(json: unknown, dirName: string): WantedLine[] {
  if (!isRecord(json)) return [];
  const packId = idOf(json, dirName);
  const out: WantedLine[] = [];
  const packName = englishName(json.name);
  if (packName) out.push({ id: packLine(packId), en: packName });
  const blocks = Array.isArray(json.blocks) ? json.blocks : [];
  for (const block of blocks) {
    if (!isRecord(block) || typeof block.id !== 'string') continue;
    const name = englishName(block.name);
    if (!name) continue;
    const explicit = typeof block.voiceLine === 'string' ? block.voiceLine : null;
    out.push({ id: explicit ?? blockLine(packId, block.id), en: name });
  }
  return out;
}

export function themeLines(json: unknown, dirName: string): WantedLine[] {
  if (!isRecord(json)) return [];
  const name = englishName(json.name);
  return name ? [{ id: themeLine(idOf(json, dirName)), en: name }] : [];
}

export function cardLines(json: unknown, fileBase: string): WantedLine[] {
  if (!isRecord(json)) return [];
  const name = englishName(json.name);
  return name ? [{ id: cardLine(idOf(json, fileBase)), en: name }] : [];
}

/** "a" or "an" before a spoken name. */
function article(name: string): string {
  return /^[aeiou]/i.test(name) ? 'an' : 'a';
}

/** Blueprint name line plus its "You built a ...!" line. */
export function buildLines(json: unknown, fileBase: string): WantedLine[] {
  if (!isRecord(json)) return [];
  const name = englishName(json.name);
  if (!name) return [];
  const id = idOf(json, fileBase);
  return [
    { id: blueprintVoiceLine(id), en: name },
    { id: builtVoiceLine(id), en: `You built ${article(name)} ${name}!` },
  ];
}

/** Lines the learning features speak that do not come from content files. */
export function learningLines(): WantedLine[] {
  return [...wordLines(BIG_WORDS), ...LEARNING_LINES];
}

/** "CAT" -> "Cat!" for word lines. */
export function wordLines(words: readonly string[]): WantedLine[] {
  return words.map((w) => ({ id: wordLine(w), en: `${w.charAt(0).toUpperCase()}${w.slice(1).toLowerCase()}!` }));
}

/** Adds missing lines (or a missing English text) without touching existing text. */
export function mergeLines(doc: LinesDoc, wanted: readonly WantedLine[]): SyncResult {
  const lines: Record<string, Readonly<Record<string, string>>> = { ...doc.lines };
  const added: string[] = [];
  for (const w of wanted) {
    if (!isValidLineId(w.id)) continue;
    const existing = lines[w.id];
    if (existing && typeof existing.en === 'string' && existing.en.trim()) continue;
    lines[w.id] = { ...(existing ?? {}), en: w.en };
    if (!added.includes(w.id)) added.push(w.id);
  }
  return { doc: { ...doc, lines }, added };
}

function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as unknown;
  } catch (error) {
    process.stderr.write(`[voice] skipping unreadable ${path}: ${(error as Error).message}\n`);
    return null;
  }
}

function subdirs(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((d) => statSync(join(dir, d)).isDirectory()).sort();
}

/** Scans packs/, themes/, cards/ and builds/ under `root`, plus the learning lines. Missing folders are fine. */
export function scanContent(root: string): WantedLine[] {
  const out: WantedLine[] = [];
  for (const dir of subdirs(join(root, 'packs'))) {
    const file = join(root, 'packs', dir, 'pack.json');
    if (existsSync(file)) out.push(...packLines(readJson(file), dir));
  }
  for (const dir of subdirs(join(root, 'themes'))) {
    const file = join(root, 'themes', dir, 'theme.json');
    if (existsSync(file)) out.push(...themeLines(readJson(file), dir));
  }
  const cardsDir = join(root, 'cards');
  if (existsSync(cardsDir)) {
    for (const f of readdirSync(cardsDir).filter((n) => n.endsWith('.json')).sort()) {
      out.push(...cardLines(readJson(join(cardsDir, f)), basename(f, '.json')));
    }
  }
  const buildsDir = join(root, 'builds');
  if (existsSync(buildsDir)) {
    for (const f of readdirSync(buildsDir).filter((n) => n.endsWith('.json')).sort()) {
      out.push(...buildLines(readJson(join(buildsDir, f)), basename(f, '.json')));
    }
  }
  out.push(...learningLines());
  return out;
}

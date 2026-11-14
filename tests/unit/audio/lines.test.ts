import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildClipIndex, findClip, parseClipPath } from '../../../src/audio/clipIndex';
import { CELEBRATE_COUNT, countLine, celebrateLine, SLEEP_LINE, wordLine } from '../../../src/audio/lineIds';
import { hasLine, lineText, parseLinesFile, speechLangFor } from '../../../src/audio/lines';
import { planSpeech } from '../../../src/audio/voice';
import { BUILTIN_WORDS } from '../../../src/learning/words';

const linesUrl = new URL('../../../voice/LINES.json', import.meta.url);

describe('parseLinesFile', () => {
  it('drops malformed entries', () => {
    const f = parseLinesFile({ languages: { en: { name: 'English' }, bad: 3 }, lines: { a: { en: 'A', fr: 4 }, b: 'x' } });
    expect(Object.keys(f.languages)).toEqual(['en']);
    expect(speechLangFor(f, 'en')).toBe('en');
    expect(f.lines).toEqual({ a: { en: 'A' } });
    expect(parseLinesFile(null).lines).toEqual({});
  });

  it('shipped LINES.json has every conventional line', () => {
    const f = parseLinesFile(JSON.parse(readFileSync(linesUrl, 'utf8')));
    expect(f.languages.en?.speechLang).toBe('en-US');
    expect(lineText(f, SLEEP_LINE, 'en')).toMatch(/sleep/);
    for (let n = 1; n <= 16; n++) expect(hasLine(f, countLine(n)!)).toBe(true);
    for (let n = 1; n <= CELEBRATE_COUNT; n++) expect(hasLine(f, celebrateLine(n))).toBe(true);
    for (const w of BUILTIN_WORDS) expect(hasLine(f, wordLine(w))).toBe(true);
  });
});

describe('clip index', () => {
  it('parses glob paths', () => {
    expect(parseClipPath('/voice/en/block.colors.red.m4a')).toEqual({ lang: 'en', lineId: 'block.colors.red', ext: 'm4a' });
    expect(parseClipPath('/voice/en/manifest.json')).toBeNull();
    expect(parseClipPath('/other/en/x.m4a')).toBeNull();
  });

  it('prefers m4a over mp3', async () => {
    const index = buildClipIndex({
      '/voice/en/hello.mp3': () => Promise.resolve('mp3'),
      '/voice/en/hello.m4a': () => Promise.resolve('m4a'),
      '/voice/fr/hello.mp3': () => Promise.resolve('fr'),
    });
    expect(await findClip(index, 'en', 'hello')!()).toBe('m4a');
    expect(await findClip(index, 'fr', 'hello')!()).toBe('fr');
    expect(findClip(index, 'de', 'hello')).toBeNull();
  });
});

describe('planSpeech', () => {
  const lines = parseLinesFile({
    languages: { en: { name: 'English', speechLang: 'en-US' }, fr: { name: 'Français', speechLang: 'fr-FR' } },
    lines: { hello: { en: 'Hi', fr: 'Salut' }, cow: { en: 'cow' } },
  });
  const clips = buildClipIndex({ '/voice/en/hello.m4a': () => Promise.resolve('u'), '/voice/en/cow.m4a': () => Promise.resolve('c') });

  it('uses a clip when present', () => {
    expect(planSpeech(lines, clips, 'hello', 'en').kind).toBe('clip');
  });
  it('uses speech for the current language when its clip is missing', () => {
    expect(planSpeech(lines, clips, 'hello', 'fr')).toMatchObject({ kind: 'tts', text: 'Salut', lang: 'fr' });
  });
  it('falls back to the English clip when the language has no text', () => {
    expect(planSpeech(lines, clips, 'cow', 'fr')).toMatchObject({ kind: 'clip', lang: 'en' });
  });
  it('uses the fallback text for unknown lines', () => {
    expect(planSpeech(lines, clips, 'word.mia', 'en', 'mia')).toMatchObject({ kind: 'tts', text: 'mia' });
    expect(planSpeech(lines, clips, 'nope', 'en').kind).toBe('none');
  });
});

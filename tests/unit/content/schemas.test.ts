import { describe, expect, it } from 'vitest';
import { ANIMALS, BEHAVIORS, MARKS, PATTERNS, SYNTH_PRESETS } from '../../../src/content/constants';
import { readContentFromDisk } from '../../../src/content/validate/disk';
import { SCHEMAS, validateSchema } from '../../../src/content/validate/schema';
import { REPO_ROOT } from './helpers';

const shipped = readContentFromDisk(REPO_ROOT);

describe('shipped content matches its JSON Schemas', () => {
  it('reads every content file without errors', () => {
    expect(shipped.readIssues).toEqual([]);
  });

  it('ships the eight packs plus parts, five themes and at least eight cards', () => {
    const ids = shipped.bundle.packs.map((p) => p.expectedId).sort();
    expect(ids).toEqual(['animals', 'building', 'colors', 'letters', 'music', 'nature', 'numbers', 'parts', 'shapes']);
    expect(shipped.bundle.themes.map((t) => t.expectedId).sort()).toEqual(['beach', 'farm', 'meadow', 'snow', 'space']);
    expect(shipped.bundle.cards.length).toBeGreaterThanOrEqual(8);
  });

  it.each(shipped.bundle.packs.map((p) => [p.file, p.data] as const))('%s', (file, data) => {
    expect(validateSchema('pack', file, data)).toEqual([]);
  });

  it.each(shipped.bundle.themes.map((t) => [t.file, t.data] as const))('%s', (file, data) => {
    expect(validateSchema('theme', file, data)).toEqual([]);
  });

  it.each(shipped.bundle.cards.map((c) => [c.file, c.data] as const))('%s', (file, data) => {
    expect(validateSchema('card', file, data)).toEqual([]);
  });

  it.each((shipped.bundle.builds ?? []).map((b) => [b.file, b.data] as const))('%s', (file, data) => {
    expect(validateSchema('build', file, data)).toEqual([]);
  });
});

describe('schema enums stay in sync with src/content/constants.ts', () => {
  const defs = SCHEMAS.pack.definitions;
  it.each([
    ['synthPreset', defs.synthPreset.enum, SYNTH_PRESETS],
    ['pattern', defs.pattern.enum, PATTERNS],
    ['mark', defs.mark.enum, MARKS],
    ['behavior', defs.behavior.enum, BEHAVIORS],
    ['animal', defs.animal.enum, ANIMALS],
  ] as const)('%s', (_name, schemaList, codeList) => {
    expect([...schemaList].sort()).toEqual([...codeList].sort());
  });
});

describe('content requirements', () => {
  const pack = (id: string) => shipped.bundle.packs.find((p) => p.expectedId === id)?.data as {
    blocks: { id: string; art: Record<string, unknown>; sound?: Record<string, unknown> }[];
  };

  it('colors: ten colors, each with a distinct mark', () => {
    const blocks = pack('colors').blocks;
    expect(blocks).toHaveLength(10);
    const marks = blocks.map((b) => b.art.mark);
    expect(marks.every((m) => typeof m === 'string')).toBe(true);
    expect(new Set(marks).size).toBe(10);
  });

  it('letters A-Z and numbers 0-10', () => {
    expect(pack('letters').blocks.map((b) => b.id).join('')).toBe('abcdefghijklmnopqrstuvwxyz');
    expect(pack('numbers').blocks.map((b) => b.id)).toEqual(Array.from({ length: 11 }, (_, i) => String(i)));
  });

  it('every animal has a synth sound and a face', () => {
    for (const b of pack('animals').blocks) {
      expect(b.sound?.synth).toBeTypeOf('string');
      expect(b.art.pattern).toBe('animal-face');
    }
  });

  it('music blocks play distinct notes', () => {
    const notes = pack('music').blocks.map((b) => b.sound?.note);
    expect(new Set(notes).size).toBe(notes.length);
    expect(notes.length).toBeGreaterThanOrEqual(8);
  });
});

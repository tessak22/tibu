import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildLines, cardLines, englishName, learningLines, mergeLines, packLines, scanContent, themeLines, wordLines } from '../../../scripts/voice/sync';

describe('voice sync', () => {
  it('reads English names from strings or maps', () => {
    expect(englishName('Red')).toBe('Red');
    expect(englishName({ en: 'Cow', fr: 'Vache' })).toBe('Cow');
    expect(englishName(3)).toBeNull();
  });

  it('derives pack, block, theme and card lines', () => {
    expect(packLines({ id: 'colors', name: 'Colors', blocks: [{ id: 'red', name: 'red' }, { id: 'x' }] }, 'dir')).toEqual([
      { id: 'pack.colors', en: 'Colors' },
      { id: 'block.colors.red', en: 'red' },
    ]);
    expect(packLines({ name: 'Farm', blocks: [] }, 'farmdir')[0]?.id).toBe('pack.farmdir');
    expect(themeLines({ id: 'snow', name: 'Snow' }, 'snow')).toEqual([{ id: 'theme.snow', en: 'Snow' }]);
    expect(cardLines({ name: 'house' }, 'house')).toEqual([{ id: 'card.house', en: 'house' }]);
    expect(wordLines(['CAT'])).toEqual([{ id: 'word.cat', en: 'Cat!' }]);
    expect(packLines(null, 'x')).toEqual([]);
  });

  it('adds missing lines without removing or rewriting existing ones', () => {
    const doc = { languages: { en: {} }, lines: { hello: { en: 'Hi' }, 'block.colors.red': { en: 'Red!', fr: 'Rouge' }, odd: { fr: 'x' } } };
    const { doc: next, added } = mergeLines(doc, [
      { id: 'block.colors.red', en: 'red' },
      { id: 'block.colors.blue', en: 'blue' },
      { id: 'odd', en: 'Odd' },
      { id: '../bad', en: 'nope' },
    ]);
    expect(added).toEqual(['block.colors.blue', 'odd']);
    expect(next.lines['block.colors.red']).toEqual({ en: 'Red!', fr: 'Rouge' });
    expect(next.lines.odd).toEqual({ fr: 'x', en: 'Odd' });
    expect(next.lines.hello).toEqual({ en: 'Hi' });
    expect(doc.lines).not.toHaveProperty('block.colors.blue');
  });

  it('scans content folders and tolerates missing ones', () => {
    const root = mkdtempSync(join(tmpdir(), 'tibu-voice-'));
    const learning = learningLines();
    expect(scanContent(root)).toEqual(learning);
    mkdirSync(join(root, 'packs', 'animals'), { recursive: true });
    writeFileSync(join(root, 'packs', 'animals', 'pack.json'), JSON.stringify({ id: 'animals', name: 'Animals', blocks: [{ id: 'cow', name: 'cow' }] }));
    mkdirSync(join(root, 'cards'));
    writeFileSync(join(root, 'cards', 'tower.json'), JSON.stringify({ id: 'tower', name: 'tower' }));
    writeFileSync(join(root, 'cards', 'broken.json'), '{nope');
    mkdirSync(join(root, 'builds'));
    writeFileSync(join(root, 'builds', 'igloo.json'), JSON.stringify({ id: 'igloo', name: 'igloo' }));
    const ids = scanContent(root).map((l) => l.id);
    expect(ids.slice(0, ids.length - learning.length)).toEqual([
      'pack.animals', 'block.animals.cow', 'card.tower', 'build.igloo', 'built.igloo',
    ]);
  });

  it('derives blueprint lines with a friendly article', () => {
    expect(buildLines({ id: 'house', name: 'house' }, 'house')).toEqual([
      { id: 'build.house', en: 'house' },
      { id: 'built.house', en: 'You built a house!' },
    ]);
    expect(buildLines({ name: 'igloo' }, 'igloo')[1]?.en).toBe('You built an igloo!');
    expect(buildLines(null, 'x')).toEqual([]);
  });

  it('includes the learning lines: big words, counts to 32, cheers, crashes and explore', () => {
    const ids = learningLines().map((l) => l.id);
    for (const id of ['word.truck', 'word.happy', 'count.17', 'count.32', 'step.next', 'crash.1', 'explore.sticker']) {
      expect(ids).toContain(id);
    }
    expect(learningLines().find((l) => l.id === 'count.21')?.en).toBe('Twenty-one!');
    expect(new Set(ids).size).toBe(ids.length);
  });
});

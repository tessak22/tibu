import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cardLines, englishName, mergeLines, packLines, scanContent, themeLines, wordLines } from '../../../scripts/voice/sync';

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
    expect(scanContent(root)).toEqual([]);
    mkdirSync(join(root, 'packs', 'animals'), { recursive: true });
    writeFileSync(join(root, 'packs', 'animals', 'pack.json'), JSON.stringify({ id: 'animals', name: 'Animals', blocks: [{ id: 'cow', name: 'cow' }] }));
    mkdirSync(join(root, 'cards'));
    writeFileSync(join(root, 'cards', 'tower.json'), JSON.stringify({ id: 'tower', name: 'tower' }));
    writeFileSync(join(root, 'cards', 'broken.json'), '{nope');
    const ids = scanContent(root).map((l) => l.id);
    expect(ids).toEqual(['pack.animals', 'block.animals.cow', 'card.tower']);
  });
});

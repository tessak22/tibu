import { describe, expect, it } from 'vitest';
import type { PackJson, ThemeJson, CardJson } from '../../../src/content/raw-types';
import { checkCrossRefs } from '../../../src/content/validate/crossref';
import { readContentFromDisk } from '../../../src/content/validate/disk';
import { validateBundle } from '../../../src/content/validate/index';
import type { TypedBundle } from '../../../src/content/validate/types';
import { REPO_ROOT } from './helpers';

const pack: PackJson = {
  id: 'toys',
  name: 'Toys',
  blocks: [
    { id: 'ball', name: 'ball', art: { color: '#ff0000' } },
    { id: 'drum', name: 'drum', art: { image: 'icons/drum.png' }, sound: { file: 'audio/drum.ogg' }, behaviors: ['sound'] },
  ],
};
const theme: ThemeJson = {
  id: 'park',
  name: 'Park',
  sky: { top: '#000000', bottom: '#ffffff' },
  island: { shape: 'round', depth: 3 },
  ground: ['toys:ball'],
  scene: [{ x: 12, y: 1, z: 12, block: 'toys:drum' }],
};
const card: CardJson = { id: 'stack', name: 'stack', blocks: [{ from: [0, 0, 0], to: [0, 2, 0], block: 'toys:ball' }] };

const files = new Set(['packs/toys/icons/drum.png', 'packs/toys/audio/drum.ogg']);
const exists = (p: string): boolean => files.has(p);

function bundle(over: Partial<{ pack: PackJson; theme: ThemeJson; card: CardJson; packFolder: string }> = {}): TypedBundle {
  const p = over.pack ?? pack;
  const folder = over.packFolder ?? p.id;
  return {
    packs: [{ file: `packs/${folder}/pack.json`, expectedId: folder, data: p }],
    themes: [{ file: 'themes/park/theme.json', expectedId: 'park', data: over.theme ?? theme }],
    cards: [{ file: 'cards/stack.json', expectedId: 'stack', data: over.card ?? card }],
  };
}

const messages = (b: TypedBundle): string[] => checkCrossRefs(b, exists).map((i) => `${i.file}: ${i.message}`);

describe('cross-reference checks', () => {
  it('accepts consistent content', () => {
    expect(messages(bundle())).toEqual([]);
  });

  it('shipped content has no cross-reference problems', () => {
    const disk = readContentFromDisk(REPO_ROOT);
    expect(validateBundle(disk.bundle, disk.exists)).toEqual([]);
  });

  it('flags unknown block keys in themes and cards', () => {
    const out = messages(bundle({
      theme: { ...theme, ground: ['toys:nope'] },
      card: { ...card, blocks: [{ x: 0, y: 0, z: 0, block: 'gone:block' }] },
    }));
    expect(out).toContain('themes/park/theme.json: ground uses unknown block "toys:nope"');
    expect(out).toContain('cards/stack.json: card uses unknown block "gone:block"');
  });

  it('requires ids to match folder and file names', () => {
    const out = messages(bundle({ packFolder: 'toybox' }));
    expect(out).toContain('packs/toybox/pack.json: pack id "toys" must match its name "toybox"');
  });

  it('flags duplicate block ids', () => {
    const dup = { ...pack, blocks: [...pack.blocks, { id: 'ball', name: 'ball 2', art: { color: '#00ff00' } }] };
    expect(messages(bundle({ pack: dup }))).toContain('packs/toys/pack.json: duplicate block id "ball"');
  });

  it('flags missing image and audio files and parent paths', () => {
    const p: PackJson = {
      ...pack,
      blocks: [
        { id: 'ball', name: 'ball', art: { image: 'icons/ball.png' }, sound: { file: 'audio/../../x.ogg' } },
        pack.blocks[1],
      ],
    };
    const out = messages(bundle({ pack: p }));
    expect(out).toContain('packs/toys/pack.json: missing file "packs/toys/icons/ball.png"');
    expect(out).toContain('packs/toys/pack.json: path "audio/../../x.ogg" must stay inside its folder');
  });

  it('flags the sound behavior without a sound', () => {
    const p: PackJson = { ...pack, blocks: [{ id: 'ball', name: 'ball', art: { color: '#ff0000' }, behaviors: ['sound'] }, pack.blocks[1]] };
    expect(messages(bundle({ pack: p }))).toContain('packs/toys/pack.json: block "ball" has the "sound" behavior but no sound');
  });

  it('keeps theme scenes above the ground and away from the edge', () => {
    const out = messages(bundle({
      theme: { ...theme, scene: [{ x: 12, y: 0, z: 12, block: 'toys:ball' }, { x: 0, y: 3, z: 0, block: 'toys:ball' }] },
    }));
    expect(out.some((m) => m.includes('(12,0,12) is inside the ground'))).toBe(true);
    expect(out.some((m) => m.includes('(0,3,0) is too close to the island edge'))).toBe(true);
  });

  it('flags a pack icon that names a missing block', () => {
    expect(messages(bundle({ pack: { ...pack, icon: { block: 'kite' } } }))).toContain(
      'packs/toys/pack.json: icon refers to unknown block "kite"',
    );
  });
});

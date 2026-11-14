import { describe, expect, it } from 'vitest';
import { readContentFromDisk } from '../../../src/content/validate/disk';
import { validateBundle } from '../../../src/content/validate/index';
import { BROKEN_ROOT } from './helpers';

describe('a deliberately broken content folder', () => {
  const disk = readContentFromDisk(BROKEN_ROOT);
  const issues = validateBundle(disk.bundle, disk.exists);
  const forFile = (file: string): string[] => issues.filter((i) => i.file === file).map((i) => i.message);

  it('fails validation', () => {
    expect(issues.length).toBeGreaterThan(0);
  });

  it('reports schema problems with readable paths', () => {
    const out = forFile('packs/broken/pack.json').join('\n');
    expect(out).toContain('/blocks/0/id');
    expect(out).toContain('/blocks/1/art');
    expect(out).toMatch(/\/blocks\/2\/sound/);
    expect(out).toMatch(/\/blocks\/2\/behaviors\/0: must be one of: speak, sound, bounce, glow/);
    expect(out).toContain('/blocks/3/art');
    expect(out).toContain('unknown property "wobble"');
  });

  it('reports cross-reference problems for schema-valid files', () => {
    const out = forFile('packs/wrong-folder/pack.json');
    expect(out).toContain('pack id "not-the-folder" must match its name "wrong-folder"');
    expect(out).toContain('duplicate block id "a"');
    expect(out).toContain('missing file "packs/wrong-folder/icons/missing.png"');
    expect(out).toContain('missing file "packs/wrong-folder/audio/missing.ogg"');
    expect(out).toContain('icon refers to unknown block "nope"');
    expect(out).toContain('block "a" has the "sound" behavior but no sound');
    const theme = forFile('themes/bad/theme.json');
    expect(theme).toContain('ground uses unknown block "nature:grass"');
    expect(theme.some((m) => m.includes('is inside the ground'))).toBe(true);
    expect(forFile('cards/mismatch.json')).toContain('card id "other-name" must match its name "mismatch"');
  });
});

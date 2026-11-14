import { describe, expect, it } from 'vitest';

import {
  buildExportFile,
  exportFileName,
  IMPORT_ERRORS,
  parseImportText,
  readImportFile,
  serializeExport,
} from '../../../src/storage/export';
import { sampleWorld } from './fixtures';

describe('export', () => {
  it('builds a versioned export file', () => {
    const file = buildExportFile({ name: 'Castle', data: sampleWorld() }, new Date('2026-01-02T03:04:05Z'));
    expect(file).toEqual({
      format: 'tibu-export',
      version: 1,
      exportedAt: '2026-01-02T03:04:05.000Z',
      name: 'Castle',
      world: sampleWorld(),
    });
  });

  it('makes a safe file name', () => {
    expect(exportFileName('Big Red House!')).toBe('big-red-house.tibu.json');
    expect(exportFileName('***')).toBe('tibu-world.tibu.json');
  });

  it('round-trips through import', () => {
    const text = serializeExport(buildExportFile({ name: 'Farm', data: sampleWorld(2) }));
    const result = parseImportText(text);
    expect(result).toEqual({ ok: true, name: 'Farm', world: sampleWorld(2) });
  });
});

describe('import', () => {
  const err = (text: string): string | null => {
    const r = parseImportText(text);
    return r.ok ? null : r.error;
  };

  it('rejects non-JSON', () => expect(err('not json {')).toBe(IMPORT_ERRORS.notJson));
  it('rejects other JSON', () => expect(err('{"hello":1}')).toBe(IMPORT_ERRORS.notTibu));
  it('rejects null', () => expect(err('null')).toBe(IMPORT_ERRORS.notTibu));
  it('rejects newer versions', () =>
    expect(err(JSON.stringify({ format: 'tibu-export', version: 9, world: sampleWorld() }))).toBe(
      IMPORT_ERRORS.newerVersion,
    ));
  it('rejects a damaged world', () =>
    expect(err(JSON.stringify({ format: 'tibu-export', version: 1, name: 'x', world: { format: 'nope' } }))).toBe(
      IMPORT_ERRORS.badWorld,
    ));
  it('survives a validator that throws', () => {
    const r = parseImportText(serializeExport(buildExportFile({ name: 'x', data: sampleWorld() })), () => {
      throw new Error('boom');
    });
    expect(r).toEqual({ ok: false, error: IMPORT_ERRORS.badWorld });
  });
  it('accepts a bare saved world', () => {
    const r = parseImportText(JSON.stringify(sampleWorld()));
    expect(r.ok && r.name).toBe('Imported world');
  });
  it('reads a File-like blob', async () => {
    const blob = new Blob([serializeExport(buildExportFile({ name: 'Zoo', data: sampleWorld() }))]);
    expect((await readImportFile(blob)).ok).toBe(true);
  });
  it('rejects huge files', async () => {
    const blob = { size: 50 * 1024 * 1024, text: async () => '' } as unknown as Blob;
    expect(await readImportFile(blob)).toEqual({ ok: false, error: IMPORT_ERRORS.tooBig });
  });
});

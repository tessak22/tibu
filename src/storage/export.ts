import type { SavedWorld, WorldExportFile, WorldRecord } from '../core/types';
import { validateSavedWorld } from '../world/index';
import { cleanName } from './repository';

export const EXPORT_EXTENSION = '.tibu.json';
/** Generous upper bound: a packed 96x32x96 adventure world is well under this. */
export const MAX_IMPORT_BYTES = 24 * 1024 * 1024;

export type ImportResult =
  | { readonly ok: true; readonly name: string; readonly world: SavedWorld }
  | { readonly ok: false; readonly error: string };

export const IMPORT_ERRORS = {
  tooBig: 'That file is too big to be a Tibu world.',
  notJson: 'That file could not be read. Please choose a .tibu.json file exported from Tibu.',
  notTibu: 'That file is not a Tibu world export.',
  newerVersion: 'That world was saved by a newer version of Tibu. Please update Tibu and try again.',
  badWorld: 'That world file looks damaged, so it could not be opened.',
} as const;

export function buildExportFile(record: Pick<WorldRecord, 'name' | 'data'>, now: Date = new Date()): WorldExportFile {
  return {
    format: 'tibu-export',
    version: 1,
    exportedAt: now.toISOString(),
    name: record.name,
    world: record.data,
  };
}

export function exportFileName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return `${slug || 'tibu-world'}${EXPORT_EXTENSION}`;
}

export function serializeExport(file: WorldExportFile): string {
  return JSON.stringify(file);
}

/** Parses and validates an export file's text. Never throws. */
export function parseImportText(
  text: string,
  validate: (data: unknown) => SavedWorld | null = validateSavedWorld,
): ImportResult {
  if (text.length > MAX_IMPORT_BYTES) return { ok: false, error: IMPORT_ERRORS.tooBig };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: IMPORT_ERRORS.notJson };
  }
  if (!raw || typeof raw !== 'object') return { ok: false, error: IMPORT_ERRORS.notTibu };
  const obj = raw as Record<string, unknown>;
  // Also accept a bare SavedWorld for convenience.
  const isBare = obj.format === 'tibu-world';
  if (!isBare && obj.format !== 'tibu-export') return { ok: false, error: IMPORT_ERRORS.notTibu };
  if (!isBare && obj.version !== 1) {
    return {
      ok: false,
      error: typeof obj.version === 'number' && obj.version > 1 ? IMPORT_ERRORS.newerVersion : IMPORT_ERRORS.notTibu,
    };
  }
  let world: SavedWorld | null = null;
  try {
    world = validate(isBare ? obj : obj.world);
  } catch {
    world = null;
  }
  if (!world) return { ok: false, error: IMPORT_ERRORS.badWorld };
  const name = typeof obj.name === 'string' ? cleanName(obj.name, 'Imported world') : 'Imported world';
  return { ok: true, name, world };
}

/** Reads a user-chosen File and validates it. Never throws. */
export async function readImportFile(
  file: Blob,
  validate?: (data: unknown) => SavedWorld | null,
): Promise<ImportResult> {
  if (file.size > MAX_IMPORT_BYTES) return { ok: false, error: IMPORT_ERRORS.tooBig };
  try {
    return parseImportText(await file.text(), validate);
  } catch {
    return { ok: false, error: IMPORT_ERRORS.notJson };
  }
}

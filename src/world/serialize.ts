import type { BlockKey, Cell, SavedWorld } from '../core/types';
import { VOLUME } from './grid';

const MAX_KEY_LENGTH = 200;
const MAX_THEME_ID_LENGTH = 100;
const MAX_PALETTE = 4096;
/** Generous cap: a full world has VOLUME blocks; anything far beyond that is garbage. */
const MAX_BLOCK_ENTRIES = VOLUME * 4;

type BlockEntry = readonly [number, number, number, number];

export function serializeGrid(themeId: string, entries: Iterable<readonly [Cell, BlockKey]>): SavedWorld {
  const palette: BlockKey[] = [];
  const paletteIndex = new Map<BlockKey, number>();
  const blocks: BlockEntry[] = [];
  for (const [c, key] of entries) {
    let index = paletteIndex.get(key);
    if (index === undefined) {
      index = palette.length;
      palette.push(key);
      paletteIndex.set(key, index);
    }
    blocks.push([c.x, c.y, c.z, index]);
  }
  return { format: 'tibu-world', version: 1, themeId, palette, blocks };
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function isBlockEntry(v: unknown, paletteSize: number): v is BlockEntry {
  return (
    Array.isArray(v) &&
    v.length === 4 &&
    v.every((n) => Number.isInteger(n)) &&
    (v[3] as number) >= 0 &&
    (v[3] as number) < paletteSize
  );
}

/**
 * Validates untrusted data (storage, imported files). Returns a clean copy or null when the
 * structure is wrong. Individual malformed block entries are dropped rather than failing the
 * whole world; out-of-bounds (but well-formed) entries are kept and skipped at load time.
 */
export function validateSavedWorld(data: unknown): SavedWorld | null {
  if (!isRecord(data)) return null;
  if (data.format !== 'tibu-world' || data.version !== 1) return null;
  const { themeId, palette, blocks } = data;
  if (typeof themeId !== 'string' || themeId.length === 0 || themeId.length > MAX_THEME_ID_LENGTH) return null;
  if (!Array.isArray(palette) || palette.length > MAX_PALETTE) return null;
  if (!palette.every((k) => typeof k === 'string' && k.length > 0 && k.length <= MAX_KEY_LENGTH)) return null;
  if (!Array.isArray(blocks) || blocks.length > MAX_BLOCK_ENTRIES) return null;
  const cleanBlocks = blocks
    .filter((b): b is BlockEntry => isBlockEntry(b, palette.length))
    .map((b): BlockEntry => [b[0], b[1], b[2], b[3]]);
  return {
    format: 'tibu-world',
    version: 1,
    themeId,
    palette: [...(palette as string[])],
    blocks: cleanBlocks,
  };
}

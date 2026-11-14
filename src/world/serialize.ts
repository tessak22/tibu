import {
  WORLD_SIZE,
  type BlockKey,
  type Cell,
  type Rotation,
  type SavedWorld,
  type WorldEntity,
  type WorldSize,
} from '../core/types';
import { MAX_ENTITIES, cleanEntity } from './entities';
import { allowedSize, volumeOf } from './grid';

const MAX_KEY_LENGTH = 200;
const MAX_THEME_ID_LENGTH = 100;
const MAX_PALETTE = 4096;
/** v1 cap (unchanged): a full 24x16x24 world has VOLUME blocks; anything far beyond is garbage. */
const MAX_V1_BLOCK_ENTRIES = volumeOf(WORLD_SIZE) * 4;
/** v2 cap relative to the (allow-listed) world volume. */
const V2_BLOCK_ENTRY_FACTOR = 2;

type BlockEntry = readonly [number, number, number, number] | readonly [number, number, number, number, Rotation];

export interface SaveMeta {
  readonly themeId: string;
  readonly size: WorldSize;
  readonly kind: 'island' | 'explore';
  readonly seed?: number;
}

/** Writes a v2 save. 5-element block entries only for rotated blocks. */
export function serializeGrid(
  meta: SaveMeta,
  entries: Iterable<readonly [Cell, BlockKey, Rotation?]>,
  entities: readonly WorldEntity[] = [],
): SavedWorld {
  const palette: BlockKey[] = [];
  const paletteIndex = new Map<BlockKey, number>();
  const blocks: BlockEntry[] = [];
  for (const [c, key, rot] of entries) {
    let index = paletteIndex.get(key);
    if (index === undefined) {
      index = palette.length;
      palette.push(key);
      paletteIndex.set(key, index);
    }
    blocks.push(rot ? [c.x, c.y, c.z, index, rot] : [c.x, c.y, c.z, index]);
  }
  return {
    format: 'tibu-world',
    version: 2,
    themeId: meta.themeId,
    size: { x: meta.size.x, y: meta.size.y, z: meta.size.z },
    kind: meta.kind,
    ...(meta.seed !== undefined ? { seed: meta.seed } : {}),
    palette,
    blocks,
    entities: entities.map((e) => ({ ...e, cell: { ...e.cell } })),
  };
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function cleanBlockEntry(v: unknown, paletteSize: number, allowRotation: boolean): BlockEntry | null {
  if (!Array.isArray(v) || (v.length !== 4 && !(allowRotation && v.length === 5))) return null;
  if (!v.every((n) => Number.isInteger(n))) return null;
  const [x, y, z, p, rot] = v as number[];
  if (p < 0 || p >= paletteSize) return null;
  if (v.length === 4) return [x, y, z, p];
  if (rot < 0 || rot > 3) return null;
  return rot === 0 ? [x, y, z, p] : [x, y, z, p, rot as Rotation];
}

function cleanHeader(data: Record<string, unknown>): { themeId: string; palette: string[] } | null {
  const { themeId, palette } = data;
  if (typeof themeId !== 'string' || themeId.length === 0 || themeId.length > MAX_THEME_ID_LENGTH) return null;
  if (!Array.isArray(palette) || palette.length > MAX_PALETTE) return null;
  if (!palette.every((k) => typeof k === 'string' && k.length > 0 && k.length <= MAX_KEY_LENGTH)) return null;
  return { themeId, palette: [...(palette as string[])] };
}

function cleanBlocks(blocks: unknown, max: number, paletteSize: number, allowRotation: boolean): BlockEntry[] | null {
  if (!Array.isArray(blocks) || blocks.length > max) return null;
  const out: BlockEntry[] = [];
  for (const b of blocks) {
    const clean = cleanBlockEntry(b, paletteSize, allowRotation);
    if (clean) out.push(clean);
  }
  return out;
}

function cleanEntities(entities: unknown): WorldEntity[] {
  if (!Array.isArray(entities)) return [];
  const out: WorldEntity[] = [];
  const seen = new Set<string>();
  for (const e of entities.slice(0, MAX_ENTITIES)) {
    const clean = cleanEntity(e);
    if (clean && !seen.has(clean.id)) {
      seen.add(clean.id);
      out.push(clean);
    }
  }
  return out;
}

function validateV1(data: Record<string, unknown>): SavedWorld | null {
  const header = cleanHeader(data);
  if (!header) return null;
  const blocks = cleanBlocks(data.blocks, MAX_V1_BLOCK_ENTRIES, header.palette.length, false);
  if (!blocks) return null;
  return { format: 'tibu-world', version: 1, themeId: header.themeId, palette: header.palette, blocks };
}

function validateV2(data: Record<string, unknown>): SavedWorld | null {
  const header = cleanHeader(data);
  if (!header) return null;
  const size = data.size === undefined ? WORLD_SIZE : allowedSize(data.size);
  if (!size) return null;
  if (data.kind !== undefined && data.kind !== 'island' && data.kind !== 'explore') return null;
  const kind = data.kind === 'explore' ? 'explore' : 'island';
  const max = volumeOf(size) * V2_BLOCK_ENTRY_FACTOR;
  const blocks = cleanBlocks(data.blocks, max, header.palette.length, true);
  if (!blocks) return null;
  const seed = Number.isInteger(data.seed) && (data.seed as number) >= 0 && (data.seed as number) <= 0xffffffff;
  return {
    format: 'tibu-world',
    version: 2,
    themeId: header.themeId,
    size: { x: size.x, y: size.y, z: size.z },
    kind,
    ...(seed ? { seed: data.seed as number } : {}),
    palette: header.palette,
    blocks,
    entities: cleanEntities(data.entities),
  };
}

/**
 * Validates untrusted data (storage, imported files). Accepts v1 (a 24x16x24 island) and v2.
 * Returns a clean copy or null when the structure is wrong (unknown version, size not in the
 * allow-list, oversized arrays). Individual malformed block entries and entities are dropped
 * rather than failing the whole world; out-of-bounds (but well-formed) entries are kept and
 * skipped at load time. Work and allocation are bounded by the allow-listed size.
 */
export function validateSavedWorld(data: unknown): SavedWorld | null {
  if (!isRecord(data) || data.format !== 'tibu-world') return null;
  if (data.version === 1) return validateV1(data);
  if (data.version === 2) return validateV2(data);
  return null;
}

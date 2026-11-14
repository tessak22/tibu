/** Pure chest placement and sticker assignment. */
import type { Cell, WorldEntity, WorldModel } from '../core/types';
import { createRng, shuffled } from './rng';
import { cellKey } from './route';
import { GOLD_STAR } from './stickerIds';

/**
 * Places one closed chest per spot, each holding a different sticker (seeded shuffle, so the
 * same inputs always give the same chests). Duplicate spots and duplicate sticker ids are
 * ignored; with more spots than stickers the extra spots stay empty. With no stickers at
 * all, chests hold the gold-star bonus. Returns the entities it set.
 */
export function placeChests(
  world: Pick<WorldModel, 'setEntity'>,
  spots: readonly Cell[],
  stickerIds: readonly string[],
  seed: number,
): WorldEntity[] {
  const rng = createRng(seed);
  const uniqueSpots = dedupeBy(spots, cellKey);
  const uniqueStickers = dedupeBy(stickerIds, (s) => s);
  const pool = uniqueStickers.length > 0 ? shuffled(uniqueStickers, rng) : null;
  const count = pool ? Math.min(pool.length, uniqueSpots.length) : uniqueSpots.length;
  const placed: WorldEntity[] = [];
  for (let i = 0; i < count; i++) {
    const cell = uniqueSpots[i] as Cell;
    const entity: WorldEntity = {
      id: `chest-${cell.x}-${cell.y}-${cell.z}`,
      kind: 'chest',
      cell: { x: cell.x, y: cell.y, z: cell.z },
      sticker: pool ? (pool[i] as string) : GOLD_STAR,
      opened: false,
    };
    world.setEntity(entity);
    placed.push(entity);
  }
  return placed;
}

function dedupeBy<T>(items: readonly T[], keyOf: (item: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const k = keyOf(item);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}

/**
 * Which sticker a chest gives when opened. The chest's own sticker if it is still new;
 * otherwise the first not-yet-found sticker from `allIds`; when every sticker is found,
 * the gold-star bonus (which may repeat).
 */
export function chooseSticker(
  chestSticker: string,
  allIds: readonly string[],
  isFound: (id: string) => boolean,
): string {
  if (chestSticker !== GOLD_STAR && !isFound(chestSticker)) return chestSticker;
  for (const id of allIds) if (!isFound(id)) return id;
  return GOLD_STAR;
}

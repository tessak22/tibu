/**
 * Build card pictures: a small isometric picture of the card's blocks. The
 * drawer lives in src/content/art/picture.ts and also draws shaped parts.
 */
import type { ContentRegistry } from '../core/types';
import { drawBlocksPicture, paintOrder as order, type PictureBlock } from '../content/art/picture';
import type { PatternBlock } from './cards';

/** Sort far-to-near so nearer cubes paint over farther ones. */
export function paintOrder(blocks: readonly PatternBlock[]): PatternBlock[] {
  return order(blocks);
}

export function drawCardPicture(
  blocks: readonly PictureBlock[], registry: Pick<ContentRegistry, 'block'>, size: number,
): HTMLCanvasElement {
  return drawBlocksPicture(blocks, registry, size);
}

import type { UiContext } from './context';
import { h, pulse } from './dom';
import { openOverlay } from './overlay';

const STICKER_SIZE = 160;

export interface StickerBookOptions {
  /** Every sticker that exists, in book order. */
  readonly allIds: readonly string[];
  /** Stickers this child has found. */
  readonly found: readonly string[];
  readonly draw: (id: string, size: number) => HTMLCanvasElement;
}

/**
 * Big grid of stickers: found ones in full color, the rest as soft silhouettes (something to
 * look forward to, never a "missing" mark). Pictures only. Every cell answers a tap: a found
 * sticker pops and says its name, a hiding one wiggles with a soft sound.
 */
export function openStickerBook(ctx: UiContext, opts: StickerBookOptions): Promise<void> {
  return new Promise((resolve) => {
    const found = new Set(opts.found);
    const grid = h('div', { class: 'picture-grid sticker-grid', 'data-testid': 'sticker-grid' });
    for (const id of opts.allIds) {
      const have = found.has(id);
      let pic: HTMLCanvasElement;
      try {
        pic = opts.draw(id, STICKER_SIZE);
      } catch {
        pic = document.createElement('canvas');
      }
      pic.classList.add('pic');
      const cell = h(
        'button',
        {
          type: 'button',
          class: `sticker-cell ${have ? 'found' : 'not-yet'}`,
          'data-sticker': id,
          'aria-label': have ? `Sticker ${id}` : 'A sticker still hiding',
        },
        [pic],
      );
      cell.addEventListener('click', () => {
        if (have) {
          pulse(cell, 'pop');
          ctx.audio.sfx('tap');
          void ctx.audio.speak(`sticker.${id}`);
        } else {
          pulse(cell, 'wiggle');
          ctx.audio.sfx('tap');
        }
      });
      grid.append(cell);
    }
    openOverlay(ctx.overlayRoot, grid, { className: 'sticker-overlay', label: 'Sticker book', onClose: resolve });
  });
}

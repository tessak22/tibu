import type { ResolvedPack } from '../core/types';
import type { UiContext } from './context';
import { canvasCopy, h, pulse } from './dom';
import { openOverlay } from './overlay';

/** Picture grid of the enabled packs. Resolves the chosen pack, or null when closed. */
export function pickPack(
  ctx: UiContext,
  packs: readonly ResolvedPack[],
  current: string | null,
): Promise<ResolvedPack | null> {
  return new Promise((resolve) => {
    let picked: ResolvedPack | null = null;
    const grid = h('div', { class: 'picture-grid pack-grid' });
    for (const pack of packs) {
      const btn = h('button', {
        type: 'button',
        class: `picture-btn${pack.id === current ? ' selected' : ''}`,
        'aria-label': pack.name,
        'data-pack': pack.id,
      }, [canvasCopy(pack.icon, 192)]);
      btn.addEventListener('click', () => {
        pulse(btn);
        picked = pack;
        handle.close();
      });
      grid.append(btn);
    }
    const handle = openOverlay(ctx.overlayRoot, grid, {
      className: 'pack-overlay',
      label: 'Pick blocks',
      onClose: () => resolve(picked),
    });
  });
}

/** Packs the parent has enabled (empty list means all). Never empty when packs exist. */
export function enabledPacks(all: readonly ResolvedPack[], enabledIds: readonly string[]): readonly ResolvedPack[] {
  if (enabledIds.length === 0) return all;
  const filtered = all.filter((p) => enabledIds.includes(p.id));
  return filtered.length > 0 ? filtered : all;
}

// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { pickBlueprint, sortBlueprints } from '../../../src/ui/blueprint-picker';
import { openStickerBook } from '../../../src/ui/sticker-book';
import { fakeBlueprint, fakeCtx } from './helpers';

const draw = (): HTMLCanvasElement => document.createElement('canvas');

describe('blueprint picker', () => {
  it('lists easy builds first with star dots and resolves the choice', async () => {
    const ctx = fakeCtx();
    const bps = [fakeBlueprint('rocket', 3), fakeBlueprint('house', 1), fakeBlueprint('truck', 2)];
    expect(sortBlueprints(bps).map((b) => b.id)).toEqual(['house', 'truck', 'rocket']);
    const p = pickBlueprint(ctx, bps, draw, null);
    const buttons = [...ctx.overlayRoot.querySelectorAll<HTMLButtonElement>('.blueprint-btn')];
    expect(buttons.map((b) => b.dataset.blueprint)).toEqual(['house', 'truck', 'rocket']);
    expect(buttons[2]!.querySelectorAll('.bp-star.on')).toHaveLength(3);
    expect(buttons[0]!.textContent).toBe('');
    buttons[1]!.click();
    expect((await p)?.id).toBe('truck');
  });

  it('closing picks nothing', async () => {
    const ctx = fakeCtx();
    const p = pickBlueprint(ctx, [fakeBlueprint('house')], draw, null);
    ctx.overlayRoot.querySelector<HTMLButtonElement>('.overlay-close')!.click();
    expect(await p).toBeNull();
  });
});

describe('sticker book', () => {
  it('shows found stickers and gentle silhouettes for the rest', () => {
    const ctx = fakeCtx();
    void openStickerBook(ctx, { allIds: ['sun', 'moon', 'star'], found: ['moon'], draw });
    const cells = [...ctx.overlayRoot.querySelectorAll<HTMLElement>('.sticker-cell')];
    expect(cells.map((c) => c.dataset.sticker)).toEqual(['sun', 'moon', 'star']);
    expect(cells.filter((c) => c.classList.contains('found')).map((c) => c.dataset.sticker)).toEqual(['moon']);
    expect(cells.filter((c) => c.classList.contains('not-yet'))).toHaveLength(2);
    for (const c of cells) expect(c.textContent).toBe('');
  });
});

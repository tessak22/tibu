import type { Blueprint } from '../core/types';
import type { UiContext } from './context';
import { h, pulse } from './dom';
import { openOverlay } from './overlay';

const PICTURE_SIZE = 192;
const STAR =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 3 6.5 7 .9-5.1 4.8 1.3 7-6.2-3.4-6.2 3.4 1.3-7L2 9.4l7-.9Z"/></svg>';

/** Easy builds first, then by their order in the content. */
export function sortBlueprints(blueprints: readonly Blueprint[]): readonly Blueprint[] {
  return blueprints
    .map((bp, i) => ({ bp, i }))
    .sort((a, b) => a.bp.difficulty - b.bp.difficulty || a.i - b.i)
    .map(({ bp }) => bp);
}

/** Difficulty as 1-3 filled star dots (no numbers). */
export function difficultyStars(difficulty: number): HTMLElement {
  const level = Math.min(3, Math.max(1, Math.round(difficulty)));
  const row = h('span', { class: 'bp-stars', 'data-difficulty': level });
  for (let i = 1; i <= 3; i++) row.append(h('span', { class: `bp-star${i <= level ? ' on' : ''}`, html: STAR }));
  return row;
}

/**
 * Picture grid of step-by-step builds with star-dot difficulty. Resolves the chosen
 * blueprint, or null when closed. Never a dead end: closing just goes back to play.
 */
export function pickBlueprint(
  ctx: UiContext,
  blueprints: readonly Blueprint[],
  picture: (bp: Blueprint, size: number) => HTMLCanvasElement,
  current: string | null,
): Promise<Blueprint | null> {
  return new Promise((resolve) => {
    let picked: Blueprint | null = null;
    const grid = h('div', { class: 'picture-grid blueprint-grid' });
    for (const bp of sortBlueprints(blueprints)) {
      let pic: HTMLCanvasElement;
      try {
        pic = picture(bp, PICTURE_SIZE);
      } catch {
        pic = document.createElement('canvas');
      }
      pic.classList.add('pic');
      const btn = h(
        'button',
        {
          type: 'button',
          class: `picture-btn blueprint-btn${bp.id === current ? ' selected' : ''}`,
          'aria-label': bp.name,
          'data-blueprint': bp.id,
          'data-testid': `blueprint-${bp.id}`,
        },
        [pic, difficultyStars(bp.difficulty)],
      );
      btn.addEventListener('click', () => {
        pulse(btn);
        ctx.audio.sfx('ui');
        void ctx.audio.speak(bp.voiceLine, bp.name);
        picked = bp;
        handle.close();
      });
      grid.append(btn);
    }
    const handle = openOverlay(ctx.overlayRoot, grid, {
      className: 'blueprint-overlay',
      label: 'Pick something to build',
      onClose: () => resolve(picked),
    });
  });
}

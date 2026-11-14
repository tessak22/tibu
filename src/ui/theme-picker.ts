import type { ThemeDef } from '../core/types';
import type { UiContext } from './context';
import { canvasCopy, h, pulse } from './dom';
import { openOverlay } from './overlay';

/** Big theme pictures. Resolves the chosen theme (or null when closed). */
export function pickTheme(ctx: UiContext): Promise<ThemeDef | null> {
  return new Promise((resolve) => {
    let picked: ThemeDef | null = null;
    const grid = h('div', { class: 'picture-grid theme-grid' });
    for (const theme of ctx.registry.themes) {
      const btn = h('button', { type: 'button', class: 'picture-btn', 'aria-label': theme.name }, [
        canvasCopy(theme.icon, 256),
      ]);
      btn.addEventListener('click', () => {
        pulse(btn);
        ctx.audio.sfx('ui');
        void ctx.audio.speak(theme.voiceLine, theme.name);
        picked = theme;
        handle.close();
      });
      grid.append(btn);
    }
    const handle = openOverlay(ctx.overlayRoot, grid, {
      className: 'theme-overlay',
      label: 'Pick a world',
      onClose: () => resolve(picked),
    });
  });
}

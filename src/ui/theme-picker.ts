import type { PlayMode, ThemeDef } from '../core/types';
import { drawAdventurePicture } from './adventure-badge';
import type { UiContext } from './context';
import { canvasCopy, h, pulse } from './dom';
import { openOverlay } from './overlay';

export type WorldKind = 'island' | 'explore';

export interface ThemeChoice {
  readonly theme: ThemeDef;
  readonly kind: WorldKind;
}

const PICTURE_SIZE = 256;

/** Which world kinds a child in this mode can start. Little builders only get islands. */
export function worldKindsFor(mode: PlayMode): readonly WorldKind[] {
  return mode === 'big' ? ['island', 'explore'] : ['island'];
}

/** Theme-picker entries in display order: each theme as an island, then each as an adventure. */
export function themeChoices(themes: readonly ThemeDef[], mode: PlayMode): readonly ThemeChoice[] {
  return worldKindsFor(mode).flatMap((kind) => themes.map((theme) => ({ theme, kind })));
}

const testId = (c: ThemeChoice): string => (c.kind === 'island' ? `theme-${c.theme.id}` : `theme-${c.theme.id}-explore`);

/**
 * Big theme pictures. Little mode: one per theme (as before). Big mode: each theme twice,
 * as an island and as a big adventure (theme picture with a character-on-a-bridge badge).
 * Resolves the choice, or null when closed.
 */
export function pickTheme(ctx: UiContext, mode: PlayMode = 'little'): Promise<ThemeChoice | null> {
  return new Promise((resolve) => {
    let picked: ThemeChoice | null = null;
    const grid = h('div', { class: `picture-grid theme-grid${mode === 'big' ? ' theme-grid-big' : ''}` });
    for (const choice of themeChoices(ctx.registry.themes, mode)) {
      const { theme, kind } = choice;
      const picture =
        kind === 'explore' ? drawAdventurePicture(theme.icon, PICTURE_SIZE) : canvasCopy(theme.icon, PICTURE_SIZE);
      const btn = h(
        'button',
        {
          type: 'button',
          class: `picture-btn theme-${kind}`,
          'aria-label': kind === 'explore' ? `${theme.name} adventure` : theme.name,
          'data-testid': testId(choice),
          'data-kind': kind,
        },
        [picture],
      );
      btn.addEventListener('click', () => {
        pulse(btn);
        ctx.audio.sfx('ui');
        void ctx.audio.speak(theme.voiceLine, theme.name);
        picked = choice;
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

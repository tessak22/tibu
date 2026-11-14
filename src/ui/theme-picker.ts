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

/** The kind of world a mode makes: little builders get islands, big builders get adventures. */
export function worldKindFor(mode: PlayMode): WorldKind {
  return mode === 'big' ? 'explore' : 'island';
}

/** Worlds listed in a mode's gallery. The others are only hidden, never removed. */
export function worldsForMode<W extends { readonly data: { readonly kind?: WorldKind } }>(
  worlds: readonly W[],
  mode: PlayMode,
): W[] {
  const kind = worldKindFor(mode);
  return worlds.filter((w) => (w.data.kind ?? 'island') === kind);
}

/** Theme-picker entries in display order: each theme once, as the mode's world kind. */
export function themeChoices(themes: readonly ThemeDef[], mode: PlayMode): readonly ThemeChoice[] {
  const kind = worldKindFor(mode);
  return themes.map((theme) => ({ theme, kind }));
}

const testId = (c: ThemeChoice): string => (c.kind === 'island' ? `theme-${c.theme.id}` : `theme-${c.theme.id}-explore`);

/**
 * Big theme pictures, one per theme. Little mode: island pictures. Big mode: the same themes
 * as big adventures (theme picture with Pip on a bridge). Resolves the choice, or null when closed.
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

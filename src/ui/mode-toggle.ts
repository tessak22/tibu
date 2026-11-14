import type { PlayMode } from '../core/types';
import { drawPip } from './adventure-badge';
import type { UiContext } from './context';
import { canvasCopy, h, pulse } from './dom';

const PICTURE_SIZE = 192;

/** Short grown-up labels shown under the pictures (the pictures alone are enough to play). */
export const MODE_TOGGLE_LABELS: Readonly<Record<PlayMode, string>> = {
  little: 'Little',
  big: 'Big adventure',
};

const MODES: readonly PlayMode[] = ['little', 'big'];

/** Big mode: the island picture with Pip standing big in front of it. */
function bigPicture(icon: HTMLCanvasElement, size: number): HTMLCanvasElement {
  const c = canvasCopy(icon, size);
  const ctx = c.getContext('2d');
  if (!ctx) return c;
  ctx.fillStyle = 'rgb(255 255 255 / 0.55)';
  ctx.beginPath();
  ctx.ellipse(size * 0.68, size * 0.9, size * 0.24, size * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();
  drawPip(ctx, size * 0.68, size * 0.9, size * 0.66);
  return c;
}

function picture(ctx: UiContext, mode: PlayMode): HTMLCanvasElement {
  const icon = ctx.registry.themes[0]?.icon ?? document.createElement('canvas');
  return mode === 'big' ? bigPicture(icon, PICTURE_SIZE) : canvasCopy(icon, PICTURE_SIZE);
}

export interface ModeToggle {
  readonly el: HTMLElement;
  set(mode: PlayMode): void;
}

/**
 * Little / Big picture toggle for the gallery. Children may use it: it only changes which
 * worlds are shown and what "+" makes. Nothing is deleted.
 */
export function createModeToggle(ctx: UiContext, initial: PlayMode, onChange: (mode: PlayMode) => void): ModeToggle {
  let current = initial;
  const el = h('div', { class: 'mode-toggle', role: 'group', 'aria-label': 'Play mode', 'data-testid': 'mode-toggle' });
  const sides = MODES.map((mode) => {
    const btn = h(
      'button',
      {
        type: 'button',
        class: 'mode-toggle-btn',
        'aria-label': MODE_TOGGLE_LABELS[mode],
        'data-testid': `mode-toggle-${mode}`,
        'data-mode': mode,
      },
      [picture(ctx, mode)],
    );
    const side = h('div', { class: 'mode-toggle-side', 'data-mode': mode }, [
      btn,
      h('span', { class: 'mode-toggle-label', 'aria-hidden': 'true' }, [MODE_TOGGLE_LABELS[mode]]),
    ]);
    // The whole side (picture and label) is one target.
    side.addEventListener('click', () => {
      pulse(btn);
      if (mode === current) {
        ctx.audio.sfx('tap');
        return;
      }
      ctx.audio.sfx('ui');
      set(mode);
      onChange(mode);
    });
    el.append(side);
    return { mode, side, btn };
  });

  const set = (mode: PlayMode): void => {
    current = mode;
    el.dataset.mode = mode;
    for (const s of sides) {
      const on = s.mode === mode;
      s.side.classList.toggle('active', on);
      s.btn.setAttribute('aria-pressed', String(on));
    }
  };
  set(initial);
  return { el, set };
}

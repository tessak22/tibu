import type { PlayMode } from '../../core/types';
import { h } from '../dom';

export const MODE_LABELS: Readonly<Record<PlayMode, string>> = {
  little: 'Little builder (2–3)',
  big: 'Big builder (4+)',
};

const MODES: readonly PlayMode[] = ['little', 'big'];

export interface ModeSwitch {
  readonly el: HTMLElement;
  value(): PlayMode;
  set(mode: PlayMode): void;
  setDisabled(on: boolean): void;
}

/** Two-button segmented control for a player's mode (grown-up area, text is fine here). */
export function modeSwitch(initial: PlayMode, label: string, onChange: (mode: PlayMode) => void): ModeSwitch {
  let current = initial;
  const buttons = MODES.map((mode) => {
    const b = h('button', { type: 'button', class: 'mode-choice', 'data-mode': mode }, [MODE_LABELS[mode]]);
    b.addEventListener('click', () => {
      if (current === mode) return;
      set(mode);
      onChange(mode);
    });
    return b;
  });
  const set = (mode: PlayMode): void => {
    current = mode;
    for (const b of buttons) {
      const on = b.dataset.mode === mode;
      b.classList.toggle('selected', on);
      b.setAttribute('aria-pressed', String(on));
    }
  };
  set(initial);
  const el = h('div', { class: 'mode-switch', role: 'group', 'aria-label': label }, buttons);
  return {
    el,
    value: () => current,
    set,
    setDisabled(on) {
      for (const b of buttons) b.disabled = on;
    },
  };
}

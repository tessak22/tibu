import type { BlockKey, ResolvedPack } from '../core/types';
import { canvasCopy, clear, h, isolatePointer, pulse } from './dom';

export interface Tray {
  readonly el: HTMLElement;
  setPack(pack: ResolvedPack, selected: BlockKey | null): void;
  setSelected(key: BlockKey): void;
}

/**
 * Bottom row of big block pictures. Scrolls horizontally with a swipe; native scrolling
 * suppresses the click, so a swipe never selects. Pointer events never reach the canvas.
 */
export function createTray(onSelect: (key: BlockKey) => void): Tray {
  const row = h('div', { class: 'tray-row', role: 'listbox', 'aria-label': 'Blocks' });
  const el = h('div', { class: 'tray', 'data-testid': 'tray' }, [row]);
  isolatePointer(el);

  const setSelected = (key: BlockKey): void => {
    for (const btn of row.querySelectorAll<HTMLButtonElement>('.tray-item')) {
      const on = btn.dataset.key === key;
      btn.classList.toggle('selected', on);
      btn.setAttribute('aria-selected', String(on));
      if (on && typeof btn.scrollIntoView === 'function') {
        btn.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
    }
  };

  return {
    el,
    setSelected,
    setPack(pack, selected) {
      clear(row);
      for (const block of pack.blocks) {
        const btn = h('button', {
          type: 'button',
          class: 'tray-item',
          role: 'option',
          'aria-label': block.name,
          'data-key': block.key,
        }, [canvasCopy(block.icon, 128)]);
        btn.addEventListener('click', () => {
          pulse(btn);
          setSelected(block.key);
          onSelect(block.key);
        });
        row.append(btn);
      }
      row.scrollLeft = 0;
      if (selected) setSelected(selected);
    },
  };
}

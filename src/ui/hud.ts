import type { BlockKey, Mode, ResolvedPack } from '../core/types';
import { canvasCopy, clear, h, iconButton, isolatePointer } from './dom';
import { ICONS } from './icons';
import { createTray } from './tray';

export interface HudActions {
  onMode(mode: Mode): void;
  onSelectBlock(key: BlockKey): void;
  onPackButton(): void;
  onUndo(): void;
  onHome(): void;
  onBack(): void;
  onPhoto(): void;
  onToggleMute(): void;
  onCard(): void;
}

export interface Hud {
  readonly el: HTMLElement;
  setMode(mode: Mode): void;
  setPack(pack: ResolvedPack, selected: BlockKey | null): void;
  setMuted(muted: boolean): void;
  setLeftHanded(on: boolean): void;
  setCardEnabled(on: boolean): void;
  /** Shows the active build card picture on the card button, or the plain card icon. */
  setCardPicture(picture: HTMLCanvasElement | null): void;
  setUndoAvailable(on: boolean): void;
}

const group = (cls: string, children: Node[]): HTMLElement => {
  const el = h('div', { class: `hud-group ${cls}` }, children);
  isolatePointer(el);
  return el;
};

/** Play-screen controls: all pictures, all at least 64 px. Mirrors for left-handed play. */
export function createHud(actions: HudActions, corner: HTMLElement): Hud {
  const build = iconButton({ icon: ICONS.block, label: 'Build', className: 'mode-btn', onTap: () => actions.onMode('build') });
  const smash = iconButton({ icon: ICONS.hammer, label: 'Smash', className: 'mode-btn', onTap: () => actions.onMode('smash') });
  build.dataset.mode = 'build';
  smash.dataset.mode = 'smash';
  build.dataset.testid = 'mode-build';
  smash.dataset.testid = 'mode-smash';
  const undo = iconButton({ icon: ICONS.undo, label: 'Undo', className: 'undo-btn big', onTap: actions.onUndo });
  const back = iconButton({ icon: ICONS.gallery, label: 'My worlds', className: 'back-btn', onTap: actions.onBack });
  const home = iconButton({ icon: ICONS.home, label: 'Find my island', className: 'home-btn', onTap: actions.onHome });
  const photo = iconButton({ icon: ICONS.camera, label: 'Take a picture', className: 'photo-btn', onTap: actions.onPhoto });
  const mute = iconButton({ icon: ICONS.sound, label: 'Sound', className: 'mute-btn', onTap: actions.onToggleMute });
  const card = iconButton({ icon: ICONS.card, label: 'Build card', className: 'card-btn', onTap: actions.onCard });
  const packBtn = iconButton({ icon: ICONS.packs, label: 'Block packs', className: 'pack-btn', onTap: actions.onPackButton });
  undo.dataset.testid = 'undo';
  back.dataset.testid = 'back';
  const tray = createTray(actions.onSelectBlock);

  const el = h('div', { class: 'hud', dir: 'ltr', 'data-testid': 'hud' }, [
    group('hud-top-start', [back, home]),
    group('hud-top-end', [photo, mute, card]),
    group('hud-side-start', [build, smash]),
    group('hud-side-end', [undo]),
    group('hud-bottom', [packBtn, tray.el]),
    corner,
  ]);

  const setPackIcon = (pack: ResolvedPack): void => {
    clear(packBtn);
    packBtn.append(canvasCopy(pack.icon, 128));
  };

  return {
    el,
    setMode(mode) {
      for (const b of [build, smash]) {
        const on = b.dataset.mode === mode;
        b.classList.toggle('active', on);
        b.setAttribute('aria-pressed', String(on));
      }
      el.dataset.mode = mode;
    },
    setPack(pack, selected) {
      setPackIcon(pack);
      tray.setPack(pack, selected);
    },
    setMuted(muted) {
      mute.innerHTML = muted ? ICONS.muted : ICONS.sound;
      mute.setAttribute('aria-pressed', String(muted));
      mute.classList.toggle('off', muted);
    },
    setLeftHanded(on) {
      el.setAttribute('dir', on ? 'rtl' : 'ltr');
    },
    setCardEnabled(on) {
      card.hidden = !on;
    },
    setCardPicture(picture) {
      clear(card);
      if (picture) {
        picture.classList.add('pic');
        card.append(picture);
      } else {
        card.innerHTML = ICONS.card;
      }
      card.classList.toggle('showing', picture !== null);
    },
    setUndoAvailable(on) {
      undo.classList.toggle('dim', !on);
    },
  };
}

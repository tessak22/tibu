import { h, iconButton, isolatePointer } from './dom';
import { ICONS } from './icons';

export interface OverlayHandle {
  readonly el: HTMLElement;
  readonly panel: HTMLElement;
  close(): void;
}

export interface OverlayOptions {
  readonly className?: string;
  /** Show a big close (X) button. Default true. */
  readonly closable?: boolean;
  /** Close when tapping the dim backdrop. Default true. */
  readonly closeOnBackdrop?: boolean;
  readonly label?: string;
  readonly onClose?: () => void;
}

/** Full-screen modal layer with a centered panel. */
export function openOverlay(root: HTMLElement, content: Node, opts: OverlayOptions = {}): OverlayHandle {
  const panel = h('div', { class: 'overlay-panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': opts.label });
  const el = h('div', { class: `overlay ${opts.className ?? ''}`.trim() }, [panel]);
  isolatePointer(el);
  let closed = false;
  const close = (): void => {
    if (closed) return;
    closed = true;
    el.remove();
    opts.onClose?.();
  };
  if (opts.closable !== false) {
    panel.append(iconButton({ icon: ICONS.close, label: 'Close', className: 'overlay-close', onTap: close }));
  }
  panel.append(content);
  if (opts.closeOnBackdrop !== false) {
    // Only a press that started on the backdrop closes it. The finger that opened this overlay
    // (e.g. lifting after the 3 s grown-up hold) produces a click here that must not close it.
    let pressedBackdrop = false;
    el.addEventListener('pointerdown', (e) => {
      pressedBackdrop = e.target === el;
    });
    el.addEventListener('click', (e) => {
      if (e.target === el && pressedBackdrop) close();
      pressedBackdrop = false;
    });
  }
  root.append(el);
  return { el, panel, close };
}

/** Parent-facing confirmation dialog with text. Resolves true when confirmed. */
export function confirmDialog(
  root: HTMLElement,
  message: string,
  confirmLabel = 'Delete',
  danger = true,
): Promise<boolean> {
  return new Promise((resolve) => {
    let answered = false;
    const finish = (ok: boolean): void => {
      if (answered) return;
      answered = true;
      handle.close();
      resolve(ok);
    };
    const yes = h('button', { type: 'button', class: `text-btn ${danger ? 'danger' : 'primary'}` }, [confirmLabel]);
    const no = h('button', { type: 'button', class: 'text-btn' }, ['Cancel']);
    yes.addEventListener('click', () => finish(true));
    no.addEventListener('click', () => finish(false));
    const body = h('div', { class: 'confirm' }, [h('p', {}, [message]), h('div', { class: 'row' }, [no, yes])]);
    const handle = openOverlay(root, body, {
      className: 'confirm-overlay',
      closable: false,
      label: 'Confirm',
      onClose: () => finish(false),
    });
  });
}

/** Short, non-blocking message for parents (e.g. a save error). */
const SAVE_HINT_MS = 3000;

/**
 * Quiet, word-free hint that a save did not go through (children cannot read, and an error
 * message would only worry them). A small soft cloud fades in and out; one at a time.
 */
export function saveHint(root: HTMLElement): void {
  if (root.querySelector('.save-hint')) return;
  const el = h('div', { class: 'save-hint', role: 'img', 'aria-label': 'Not saved yet', html: ICONS.cloud });
  root.append(el);
  setTimeout(() => el.remove(), SAVE_HINT_MS);
}

export function toast(root: HTMLElement, message: string, ms = 4000): void {
  const el = h('div', { class: 'toast', role: 'status' }, [message]);
  root.append(el);
  setTimeout(() => el.remove(), ms);
}

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
    el.addEventListener('click', (e) => {
      if (e.target === el) close();
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
export function toast(root: HTMLElement, message: string, ms = 4000): void {
  const el = h('div', { class: 'toast', role: 'status' }, [message]);
  root.append(el);
  setTimeout(() => el.remove(), ms);
}

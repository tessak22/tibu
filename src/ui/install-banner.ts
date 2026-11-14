import { h, isolatePointer } from './dom';
import { installGuide } from './install-guide';
import { openOverlay } from './overlay';

export const INSTALL_DISMISSED_KEY = 'tibu.installHintDismissed';

export interface PlatformInfo {
  readonly isIosSafari: boolean;
  readonly isStandalone: boolean;
}

function readDismissed(storage: Storage | undefined): boolean {
  try {
    return storage?.getItem(INSTALL_DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Small, non-blocking hint for grown-ups on the gallery, only on iPad/iPhone Safari when not
 * installed. It is tucked to one edge so a child can keep playing around it.
 */
export function createInstallBanner(
  overlayRoot: HTMLElement,
  platform: PlatformInfo,
  storage: Storage | undefined = globalThis.localStorage,
): HTMLElement | null {
  if (!platform.isIosSafari || platform.isStandalone || readDismissed(storage)) return null;
  const how = h('button', { type: 'button', class: 'banner-link' }, ['Grown-ups: add Tibu to your Home Screen']);
  const dismiss = h('button', { type: 'button', class: 'banner-x', 'aria-label': 'Dismiss' }, ['×']);
  const el = h('div', { class: 'install-banner', role: 'note' }, [how, dismiss]);
  isolatePointer(el);
  how.addEventListener('click', () => {
    openOverlay(overlayRoot, installGuide(), { className: 'text-overlay', label: 'Add to Home Screen' });
  });
  dismiss.addEventListener('click', () => {
    try {
      storage?.setItem(INSTALL_DISMISSED_KEY, '1');
    } catch {
      // Private mode: the banner simply returns next time.
    }
    el.remove();
  });
  return el;
}

import { h } from '../ui/dom';

export interface AppShell {
  readonly stage: HTMLElement;
  readonly canvas: HTMLCanvasElement;
  readonly screenRoot: HTMLElement;
  readonly overlayRoot: HTMLElement;
}

/** Builds the persistent layers: the 3D stage, the screen layer and the overlay layer. */
export function buildShell(root: HTMLElement): AppShell {
  const canvas = h('canvas', { class: 'game-canvas', 'data-testid': 'game-canvas' });
  const stage = h('div', { class: 'stage' }, [canvas]);
  const screenRoot = h('div', { class: 'screens' });
  const overlayRoot = h('div', { class: 'overlays' });
  root.replaceChildren(stage, screenRoot, overlayRoot);
  return { stage, canvas, screenRoot, overlayRoot };
}

/** Friendly full-screen message when Tibu cannot start (e.g. storage blocked). */
export function showBootError(root: HTMLElement, detail: string): void {
  const reload = h('button', { type: 'button', class: 'text-btn primary' }, ['Try again']);
  reload.addEventListener('click', () => window.location.reload());
  root.replaceChildren(
    h('div', { class: 'boot-error', role: 'alert' }, [
      h('h1', {}, ['Tibu could not start']),
      h('p', {}, [detail]),
      reload,
    ]),
  );
}

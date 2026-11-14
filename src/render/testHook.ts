import type { BlockKey } from '../core/types';

export interface TibuTestHook {
  worldCount(): number;
  getBlock(x: number, y: number, z: number): BlockKey | null;
  /** CSS-pixel (viewport) point of the top-face center of a cell. */
  cellToScreen(x: number, y: number, z: number): { x: number; y: number } | null;
}

declare global {
  interface Window {
    __tibuTest?: TibuTestHook;
  }
}

export function testHookEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  if (import.meta.env.MODE !== 'production') return true;
  try {
    return new URLSearchParams(window.location.search).has('test');
  } catch {
    return false;
  }
}

/** Installs window.__tibuTest in dev/test builds or with ?test. Returns an uninstaller. */
export function installTestHook(hook: TibuTestHook): () => void {
  if (!testHookEnabled()) return () => undefined;
  window.__tibuTest = hook;
  return () => {
    if (window.__tibuTest === hook) delete window.__tibuTest;
  };
}

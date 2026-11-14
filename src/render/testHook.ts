import type { BlockKey } from '../core/types';

export interface TibuTestHook {
  worldCount(): number;
  getBlock(x: number, y: number, z: number): BlockKey | null;
  /** CSS-pixel (viewport) point of the top-face center of a cell, for any world size. */
  cellToScreen(x: number, y: number, z: number): { x: number; y: number } | null;
  /** Number of ghost (step-by-step preview) blocks currently shown. */
  ghostCount(): number;
  /** Size of the loaded world (24x16x24 little island, 96x32x96 explore world). */
  worldSize(): { x: number; y: number; z: number };
  /** Chunk columns still waiting for their lazy first build (0 once a big world is ready). */
  pendingChunks(): number;
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

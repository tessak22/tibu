import type { GameView, WorldModel, WorldRecord } from '../core/types';
import { createAutosaver, type Repository } from '../storage';
import { BIG_WORLD_AUTOSAVE, THUMB_SIZE } from './config';

export interface SessionSaverDeps {
  readonly view: GameView;
  readonly repo: Pick<Repository, 'updateWorld'>;
  readonly record: WorldRecord;
  readonly world: WorldModel;
  onSaveError(error: unknown): void;
  onThumbnailError(error: unknown): void;
}

export interface SessionSaver {
  markDirty(): void;
  /** Saves now (if needed) and refreshes the thumbnail. */
  finish(): Promise<void>;
  dispose(): void;
}

type IdleWindow = Window & {
  requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
};

/** Runs `task` when the browser is idle (between frames), or soon at the latest. */
export function whenIdle(timeoutMs: number): Promise<void> {
  const w = (typeof window !== 'undefined' ? window : undefined) as IdleWindow | undefined;
  return new Promise((resolve) => {
    if (w?.requestIdleCallback) w.requestIdleCallback(() => resolve(), { timeout: timeoutMs });
    else setTimeout(resolve, 0);
  });
}

/**
 * Autosave for one play session. Every change still saves (no save button), but big
 * adventure worlds (96x32x96) wait longer between saves and serialize when the browser is
 * idle, so building never hitches. Leaving, hiding the page or closing it always saves now.
 */
export function createSessionSaver(deps: SessionSaverDeps): SessionSaver {
  const { view, repo, record, world } = deps;
  const isBig = world.kind === 'explore' || world.size.x * world.size.z > 24 * 24;
  let finishing = false;

  const autosaver = createAutosaver({
    save: async () => {
      if (isBig && !finishing) await whenIdle(BIG_WORLD_AUTOSAVE.idleTimeoutMs);
      await repo.updateWorld(record.id, { data: world.serialize() });
    },
    saveThumbnail: async () => {
      const blob = await view.snapshot({ ...THUMB_SIZE, galleryAngle: true });
      await repo.updateWorld(record.id, { thumbnail: blob });
    },
    onError: deps.onSaveError,
    onThumbnailError: deps.onThumbnailError,
    ...(isBig ? { delayMs: BIG_WORLD_AUTOSAVE.delayMs, maxWaitMs: BIG_WORLD_AUTOSAVE.maxWaitMs } : {}),
  });

  const finish = async (): Promise<void> => {
    finishing = true;
    try {
      await autosaver.finish();
    } finally {
      finishing = false;
    }
  };

  // Data is enqueued first, so a slow or failing snapshot never holds back the save.
  const onHidden = (): void => {
    if (document.visibilityState === 'hidden') void finish();
  };
  const onPageHide = (): void => void finish();
  document.addEventListener('visibilitychange', onHidden);
  window.addEventListener('pagehide', onPageHide);

  return {
    markDirty: () => autosaver.markDirty(),
    finish,
    dispose() {
      document.removeEventListener('visibilitychange', onHidden);
      window.removeEventListener('pagehide', onPageHide);
    },
  };
}

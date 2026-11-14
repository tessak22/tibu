import type { GameView, SavedExploreState, SavedWorld, WorldModel, WorldRecord } from '../core/types';
import { createAutosaver, type Repository } from '../storage';
import { BIG_WORLD_AUTOSAVE, THUMB_SIZE } from './config';

export interface SessionSaverDeps {
  readonly view: Pick<GameView, 'snapshot'>;
  readonly repo: Pick<Repository, 'updateWorld'>;
  readonly record: WorldRecord;
  readonly world: WorldModel;
  /** Adventure worlds: spawn, animal spots and the character's current cell, saved with the record. */
  readonly exploreState?: () => SavedExploreState | null;
  onSaveError(error: unknown): void;
  onThumbnailError(error: unknown): void;
  /** Test seam: the page's visibility. */
  readonly isHidden?: () => boolean;
  /** Test seam: waits for an idle moment. */
  readonly idle?: (timeoutMs: number) => Promise<void>;
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

/** Resolves when the browser is idle (between frames), or soon at the latest. */
export function whenIdle(timeoutMs: number): Promise<void> {
  const w = (typeof window !== 'undefined' ? window : undefined) as IdleWindow | undefined;
  return new Promise((resolve) => {
    if (w?.requestIdleCallback) w.requestIdleCallback(() => resolve(), { timeout: timeoutMs });
    else setTimeout(resolve, 0);
  });
}

const sameCell = (a: SavedExploreState['lastCell'], b: SavedExploreState['lastCell']): boolean =>
  a === b || (!!a && !!b && a.x === b.x && a.y === b.y && a.z === b.z);

/**
 * Autosave for one play session. Every change still saves (no save button), but big
 * adventure worlds (96x32x96) wait longer between saves and serialize when the browser is
 * idle, so building never hitches. Leaving, hiding the page or closing it always saves now:
 * the newest state is serialized synchronously and any pending idle wait is skipped, so a save
 * can never get stuck behind an idle callback that a hidden page never runs.
 */
export function createSessionSaver(deps: SessionSaverDeps): SessionSaver {
  const { view, repo, record, world } = deps;
  const isBig = world.kind === 'explore' || world.size.x * world.size.z > 24 * 24;
  const isHidden = deps.isHidden ?? (() => typeof document !== 'undefined' && document.visibilityState === 'hidden');
  const idle = deps.idle ?? whenIdle;
  /** finish() calls in progress (hide and pagehide can overlap). */
  let urgent = 0;
  /** World data captured synchronously by finish(), used by the next save instead of re-serializing. */
  let captured: SavedWorld | null = null;
  /** Releases a save that is currently waiting for an idle moment. */
  let releaseIdle: (() => void) | null = null;
  /** The character cell already stored with the record. */
  let savedLastCell: SavedExploreState['lastCell'] = record.explore?.lastCell;

  const exploreState = (): SavedExploreState | null => {
    try {
      return deps.exploreState?.() ?? null;
    } catch {
      return null;
    }
  };

  const skipIdle = (): boolean => urgent > 0 || isHidden();

  const waitForIdle = (): Promise<void> =>
    new Promise((resolve) => {
      const done = (): void => {
        if (releaseIdle === done) releaseIdle = null;
        resolve();
      };
      releaseIdle = done;
      void idle(BIG_WORLD_AUTOSAVE.idleTimeoutMs).then(done, done);
    });

  const writeData = async (data: SavedWorld): Promise<void> => {
    const state = exploreState();
    await repo.updateWorld(record.id, { data, ...(state ? { explore: state } : {}) });
    if (state) savedLastCell = state.lastCell;
  };

  const autosaver = createAutosaver({
    save: async () => {
      if (isBig && !captured && !skipIdle()) await waitForIdle();
      const data = captured ?? world.serialize();
      captured = null;
      await writeData(data);
    },
    saveThumbnail: async () => {
      const blob = await view.snapshot({ ...THUMB_SIZE, galleryAngle: true });
      await repo.updateWorld(record.id, { thumbnail: blob });
    },
    onError: deps.onSaveError,
    onThumbnailError: deps.onThumbnailError,
    ...(isBig ? { delayMs: BIG_WORLD_AUTOSAVE.delayMs, maxWaitMs: BIG_WORLD_AUTOSAVE.maxWaitMs } : {}),
  });

  /** The character moved but no block changed: save just where it stands. */
  const saveLastCell = async (): Promise<void> => {
    const state = exploreState();
    if (!state || sameCell(state.lastCell, savedLastCell)) return;
    try {
      await repo.updateWorld(record.id, { explore: state });
      savedLastCell = state.lastCell;
    } catch (error) {
      deps.onSaveError(error);
    }
  };

  const finish = async (): Promise<void> => {
    urgent++;
    // Capture the newest state before any await, then let a save parked on idle run right away.
    if (autosaver.isDirty()) {
      try {
        captured = world.serialize();
      } catch {
        captured = null; // The save itself will serialize again and report any error.
      }
    }
    releaseIdle?.();
    try {
      await autosaver.finish();
      await saveLastCell();
    } finally {
      urgent--;
    }
  };

  // Data is enqueued first, so a slow or failing snapshot never holds back the save.
  const onHidden = (): void => {
    if (isHidden()) void finish();
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

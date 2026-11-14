export const AUTOSAVE_DELAY_MS = 300;
/** Continuous tapping keeps pushing the debounce back; never wait longer than this to save. */
export const AUTOSAVE_MAX_WAIT_MS = 2000;

export interface AutosaverOptions {
  /** Persist the latest world data. */
  readonly save: () => Promise<void>;
  /** Render and persist a gallery thumbnail. Best effort: never delays a data save. */
  readonly saveThumbnail: () => Promise<void>;
  /** A data save failed. */
  readonly onError?: (error: unknown) => void;
  /** A thumbnail failed (the world itself is still saved). */
  readonly onThumbnailError?: (error: unknown) => void;
  readonly delayMs?: number;
  readonly maxWaitMs?: number;
  readonly now?: () => number;
}

export interface Autosaver {
  /** Call after every world change. */
  markDirty(): void;
  /** Save immediately if anything is pending. */
  flush(): Promise<void>;
  /** Flush data, then refresh the thumbnail if the world changed (leaving, hiding the page). */
  finish(): Promise<void>;
  isDirty(): boolean;
}

/**
 * Debounced autosave. Data saves run ~300 ms after the last change, and at most ~2 s after the
 * first unsaved change even while changes keep coming. Thumbnails are only rendered by finish(),
 * never periodically during play. Saves never overlap.
 */
export function createAutosaver(opts: AutosaverOptions): Autosaver {
  const delay = opts.delayMs ?? AUTOSAVE_DELAY_MS;
  const maxWait = Math.max(delay, opts.maxWaitMs ?? AUTOSAVE_MAX_WAIT_MS);
  const now = opts.now ?? Date.now;

  let dirty = false;
  let thumbDirty = false;
  let dirtySince = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let chain: Promise<void> = Promise.resolve();

  const enqueue = (task: () => Promise<void>, onError?: (e: unknown) => void): Promise<void> => {
    chain = chain.then(task).catch((e: unknown) => onError?.(e));
    return chain;
  };

  const flush = (): Promise<void> => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    if (dirty) {
      dirty = false;
      void enqueue(opts.save, opts.onError);
    }
    return chain;
  };

  return {
    markDirty() {
      if (!dirty) dirtySince = now();
      dirty = true;
      thumbDirty = true;
      if (timer !== null) clearTimeout(timer);
      const untilMax = maxWait - (now() - dirtySince);
      timer = setTimeout(() => void flush(), Math.max(0, Math.min(delay, untilMax)));
    },
    flush,
    async finish() {
      await flush();
      if (!thumbDirty) return;
      thumbDirty = false;
      await enqueue(opts.saveThumbnail, opts.onThumbnailError);
    },
    isDirty: () => dirty,
  };
}

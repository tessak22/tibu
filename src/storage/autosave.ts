export const AUTOSAVE_DELAY_MS = 300;
export const THUMBNAIL_INTERVAL_MS = 4000;

export interface AutosaverOptions {
  /** Persist the latest world data. */
  readonly save: () => Promise<void>;
  /** Render and persist a gallery thumbnail. */
  readonly saveThumbnail: () => Promise<void>;
  readonly onError?: (error: unknown) => void;
  readonly delayMs?: number;
  readonly thumbnailIntervalMs?: number;
  readonly now?: () => number;
}

export interface Autosaver {
  /** Call after every world change. */
  markDirty(): void;
  /** Save immediately if anything is pending. */
  flush(): Promise<void>;
  /** Flush data and refresh the thumbnail (e.g. leaving the world). */
  finish(): Promise<void>;
  isDirty(): boolean;
}

/**
 * Debounced autosave. Data saves run ~300 ms after the last change; thumbnails refresh
 * at most every few seconds. Saves never overlap.
 */
export function createAutosaver(opts: AutosaverOptions): Autosaver {
  const delay = opts.delayMs ?? AUTOSAVE_DELAY_MS;
  const thumbEvery = opts.thumbnailIntervalMs ?? THUMBNAIL_INTERVAL_MS;
  const now = opts.now ?? Date.now;
  const report = (e: unknown): void => opts.onError?.(e);

  let dirty = false;
  let thumbDirty = false;
  let lastThumbAt = now();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let thumbTimer: ReturnType<typeof setTimeout> | null = null;
  let chain: Promise<void> = Promise.resolve();

  const enqueue = (task: () => Promise<void>): Promise<void> => {
    chain = chain.then(task).catch(report);
    return chain;
  };

  const runThumbnail = (): Promise<void> => {
    if (thumbTimer !== null) {
      clearTimeout(thumbTimer);
      thumbTimer = null;
    }
    thumbDirty = false;
    lastThumbAt = now();
    return enqueue(opts.saveThumbnail);
  };

  const flush = (): Promise<void> => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    if (dirty) {
      dirty = false;
      void enqueue(opts.save);
    }
    if (thumbDirty) {
      const wait = thumbEvery - (now() - lastThumbAt);
      if (wait <= 0) void runThumbnail();
      else if (thumbTimer === null) {
        thumbTimer = setTimeout(() => {
          thumbTimer = null;
          if (thumbDirty) void runThumbnail();
        }, wait);
      }
    }
    return chain;
  };

  return {
    markDirty() {
      dirty = true;
      thumbDirty = true;
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => void flush(), delay);
    },
    flush,
    async finish() {
      await flush();
      if (thumbDirty) await runThumbnail();
    },
    isDirty: () => dirty,
  };
}

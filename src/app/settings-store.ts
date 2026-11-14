import type { Settings } from '../core/types';
import type { Repository } from '../storage';

export interface SettingsStore {
  get(): Settings;
  /** Applies an immutable update, notifies listeners, then persists. */
  update(fn: (s: Settings) => Settings): Promise<void>;
  subscribe(listener: (next: Settings, prev: Settings) => void): () => void;
}

export function createSettingsStore(
  repo: Pick<Repository, 'saveSettings'>,
  initial: Settings,
  onSaveError: () => void,
): SettingsStore {
  let current = initial;
  const listeners = new Set<(next: Settings, prev: Settings) => void>();
  let saving: Promise<void> = Promise.resolve();
  return {
    get: () => current,
    async update(fn) {
      const prev = current;
      const next = fn(prev);
      if (next === prev) return;
      current = next;
      for (const l of listeners) l(next, prev);
      saving = saving
        .then(() => repo.saveSettings(next))
        .then(
          () => undefined,
          () => onSaveError(),
        );
      await saving;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

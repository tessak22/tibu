import type { Settings, WorldRecord } from '../../core/types';
import type { PersistStatus, Repository } from '../../storage';
import type { UiContext } from '../context';

export interface LanguageOption {
  readonly code: string;
  readonly name: string;
}

export interface ParentAreaDeps {
  readonly ctx: UiContext;
  readonly repo: Repository;
  readonly languages: readonly LanguageOption[];
  readonly currentProfileId: string;
  readonly repoUrl: string;
  readonly version: string;
  getSettings(): Settings;
  /** Applies an immutable settings update and persists it. */
  updateSettings(update: (s: Settings) => Settings): Promise<void>;
  persistStatus(): Promise<PersistStatus>;
  requestPersist(): Promise<PersistStatus>;
  exportWorld(record: WorldRecord): Promise<void>;
  /** Imports a file into the current profile. Resolves an error message, or null on success. */
  importWorld(file: File): Promise<string | null>;
  /** Called after profiles or worlds change so the app can refresh. */
  onDataChanged(): void;
}

import type { AudioSystem, ContentRegistry, Settings } from '../core/types';

/** What screens need from the app. Passed explicitly; no globals. */
export interface UiContext {
  readonly audio: AudioSystem;
  readonly registry: ContentRegistry;
  getSettings(): Settings;
  /** Root element that hosts overlays (dialogs, pickers). */
  readonly overlayRoot: HTMLElement;
}

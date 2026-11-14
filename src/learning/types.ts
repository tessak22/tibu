import type { BlockKey, Blueprint, BuildCard, Cell } from '../core/types';

export type BlueprintProgressListener = (bp: Blueprint, stepIndex: number, stepCount: number, done: boolean) => void;

export interface LearningSystem {
  /** Show a build card (or clear it). Matching only happens while a card is active. */
  setActiveCard(card: BuildCard | null): void;
  /** Called once each time the active card's pattern is completed. Returns unsubscribe. */
  onCardMatched(listener: (card: BuildCard) => void): () => void;
  /** Cute isometric picture of the card's blocks for non-readers. */
  cardPicture(card: BuildCard, size: number): HTMLCanvasElement;
  /**
   * Big mode only: start a step-by-step build (null stops it and clears the ghosts).
   * `anchor` is a cell to build near (camera target or character cell); the build is
   * placed on the nearest free, flat spot that fits inside the world. Returns the
   * anchor actually used (the build's (0,0,0) cell), or null when not started
   * (little mode, no world, or no room nearby).
   */
  setBlueprint(bp: Blueprint | null, anchor?: Cell): Cell | null;
  /**
   * Progress of the active build: stepIndex is 0-based (equals stepCount when done).
   * Fires when a build starts, on every step change (including undo going back) and once when done.
   */
  onBlueprintProgress(listener: BlueprintProgressListener): () => void;
  /** Block key the current ghosts need (to auto-select it in the tray), or null. */
  suggestBlock(): BlockKey | null;
  /** Isometric picture of the finished build, or of the build up to step `upToStep` (0-based). */
  blueprintPicture(bp: Blueprint, size: number, upToStep?: number): HTMLCanvasElement;
  dispose(): void;
}

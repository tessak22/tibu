import type { BuildCard } from '../core/types';

export interface LearningSystem {
  /** Show a build card (or clear it). Matching only happens while a card is active. */
  setActiveCard(card: BuildCard | null): void;
  /** Called once each time the active card's pattern is completed. Returns unsubscribe. */
  onCardMatched(listener: (card: BuildCard) => void): () => void;
  /** Cute isometric picture of the card's blocks for non-readers. */
  cardPicture(card: BuildCard, size: number): HTMLCanvasElement;
  dispose(): void;
}

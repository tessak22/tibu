import type { GameViewEvents } from '../core/types';

type Listener<K extends keyof GameViewEvents> = (payload: GameViewEvents[K]) => void;

/** Tiny typed event emitter for GameView events. */
export class ViewEmitter {
  private readonly listeners = new Map<keyof GameViewEvents, Set<Listener<never>>>();

  on<K extends keyof GameViewEvents>(event: K, listener: Listener<K>): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener as Listener<never>);
    return () => {
      set?.delete(listener as Listener<never>);
    };
  }

  emit<K extends keyof GameViewEvents>(event: K, payload: GameViewEvents[K]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const listener of [...set]) {
      try {
        (listener as Listener<K>)(payload);
      } catch (error) {
        queueMicrotask(() => {
          throw error;
        });
      }
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}

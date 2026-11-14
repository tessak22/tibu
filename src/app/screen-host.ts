import type { Screen } from '../ui/screen';

export interface ScreenHost {
  current(): Screen | null;
  /**
   * Disposes the mounted screen first, then builds and mounts the next one. The old screen
   * is fully gone (view deactivated, follow target cleared, shared resources released)
   * before `build` runs, so the new screen never has its view state torn down underneath it.
   */
  replace<T extends Screen>(build: () => T): T;
  /** Disposes the mounted screen, leaving nothing mounted. */
  clear(): void;
}

/** Holds the one full-screen view the app shows at a time. */
export function createScreenHost(root: HTMLElement): ScreenHost {
  let screen: Screen | null = null;

  const clear = (): void => {
    const old = screen;
    screen = null;
    old?.dispose();
  };

  return {
    current: () => screen,
    clear,
    replace(build) {
      clear();
      const next = build();
      screen = next;
      root.append(next.el);
      return next;
    },
  };
}

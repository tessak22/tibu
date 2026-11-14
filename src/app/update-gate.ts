/**
 * Decides when a downloaded app update may take over. Updates reload the page, so they only
 * apply while the app is on a calm screen (gallery or profile picker), never mid-play or while
 * the resting screen or grown-up area is showing. A waiting update found at cold start applies as
 * soon as the first calm screen mounts.
 */
export interface UpdateGate {
  /** The app moved to a screen where a reload is (or is not) acceptable. */
  setSafe(safe: boolean): void;
  /** A new version is installed and waiting. */
  updateWaiting(): void;
  /** The new version took control; the page must reload to use it. */
  reloadNeeded(): void;
}

export interface UpdateGateDeps {
  /** Tell the waiting worker to activate (it then takes control and asks for a reload). */
  activate(): void;
  reload(): void;
}

export function createUpdateGate(deps: UpdateGateDeps): UpdateGate {
  let safe = false;
  let waiting = false;
  let mustReload = false;

  const apply = (): void => {
    if (!safe) return;
    if (mustReload) {
      mustReload = false;
      deps.reload();
      return;
    }
    if (waiting) {
      waiting = false;
      deps.activate();
    }
  };

  return {
    setSafe(next) {
      safe = next;
      apply();
    },
    updateWaiting() {
      waiting = true;
      apply();
    },
    reloadNeeded() {
      mustReload = true;
      apply();
    },
  };
}

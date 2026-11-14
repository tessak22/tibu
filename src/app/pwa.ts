import { registerSW } from 'virtual:pwa-register';
import { createUpdateGate, type UpdateGate } from './update-gate';

/**
 * Registers the service worker so Tibu works offline after the first load. New versions wait
 * (registerType 'prompt') and only take over on the gallery or profile screen, or at the next
 * cold start, so a child is never interrupted by a reload while playing.
 */
export function registerServiceWorker(): UpdateGate | null {
  if (!('serviceWorker' in navigator)) return null;
  let activateUpdate: (() => Promise<void>) | null = null;
  const gate = createUpdateGate({
    activate: () => void activateUpdate?.().catch(() => undefined),
    reload: () => window.location.reload(),
  });
  try {
    activateUpdate = registerSW({
      immediate: true,
      onNeedRefresh: () => gate.updateWaiting(),
      onNeedReload: () => gate.reloadNeeded(),
    });
  } catch {
    // Offline support is a bonus: the app still runs online without it.
  }
  return gate;
}

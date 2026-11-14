import { registerSW } from 'virtual:pwa-register';

/** Registers the service worker so Tibu works offline after the first load. Updates apply silently. */
export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;
  try {
    registerSW({ immediate: true });
  } catch {
    // Offline support is a bonus: the app still runs online without it.
  }
}

import type { PlatformInfo } from '../ui/install-banner';

interface NavLike {
  readonly userAgent: string;
  readonly maxTouchPoints?: number;
  readonly standalone?: boolean;
}

/** iPad/iPhone Safari detection (iPadOS reports a Mac user agent with touch). */
export function detectPlatform(nav: NavLike, matchMedia?: (q: string) => { matches: boolean }): PlatformInfo {
  const ua = nav.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && (nav.maxTouchPoints ?? 0) > 1);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|Chrome|Android/.test(ua);
  let standalone = nav.standalone === true;
  try {
    standalone ||= Boolean(matchMedia?.('(display-mode: standalone)').matches || matchMedia?.('(display-mode: fullscreen)').matches);
  } catch {
    // matchMedia unsupported: assume not installed.
  }
  return { isIosSafari: isIos && isSafari, isStandalone: standalone };
}

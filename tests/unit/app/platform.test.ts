import { describe, expect, it } from 'vitest';
import { detectPlatform } from '../../../src/app/platform';

const IPAD_OS =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
const IPAD_CHROME =
  'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0 Mobile/15E148 Safari/604.1';
const MAC_DESKTOP = IPAD_OS;
const ANDROID = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

const noMedia = () => ({ matches: false });

describe('detectPlatform', () => {
  it('detects iPadOS Safari (reports as a Mac with touch)', () => {
    expect(detectPlatform({ userAgent: IPAD_OS, maxTouchPoints: 5 }, noMedia)).toEqual({
      isIosSafari: true,
      isStandalone: false,
    });
  });
  it('ignores desktop Mac, iPad Chrome and Android', () => {
    expect(detectPlatform({ userAgent: MAC_DESKTOP, maxTouchPoints: 0 }, noMedia).isIosSafari).toBe(false);
    expect(detectPlatform({ userAgent: IPAD_CHROME, maxTouchPoints: 5 }, noMedia).isIosSafari).toBe(false);
    expect(detectPlatform({ userAgent: ANDROID, maxTouchPoints: 5 }, noMedia).isIosSafari).toBe(false);
  });
  it('detects an installed app', () => {
    expect(detectPlatform({ userAgent: IPAD_OS, maxTouchPoints: 5, standalone: true }, noMedia).isStandalone).toBe(true);
    expect(detectPlatform({ userAgent: IPAD_OS }, () => ({ matches: true })).isStandalone).toBe(true);
  });
});

/**
 * Browser speechSynthesis fallback for lines without a clip (and custom words).
 * Friendly settings: slightly slower and higher than default.
 */

const RATE = 0.85;
const PITCH = 1.3;

export interface SpeechFallback {
  speak(text: string, lang: string, volume: number): Promise<void>;
  cancel(): void;
  /** Must run inside a user gesture on iOS to allow later speech. */
  prime(): void;
}

function synth(): SpeechSynthesis | null {
  return typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
}

function pickVoice(s: SpeechSynthesis, lang: string): SpeechSynthesisVoice | null {
  const voices = s.getVoices();
  const base = lang.toLowerCase().split('-')[0] ?? lang;
  const exact = voices.filter((v) => v.lang.toLowerCase() === lang.toLowerCase());
  const loose = exact.length ? exact : voices.filter((v) => v.lang.toLowerCase().startsWith(base));
  return loose.find((v) => v.localService) ?? loose[0] ?? null;
}

/** iOS drops a speak() issued in the same tick as cancel(); wait this long after cancelling. */
export const SPEAK_AFTER_CANCEL_MS = 60;

export function createSpeechFallback(): SpeechFallback {
  let primed = false;
  let finishCurrent: (() => void) | null = null;
  /** Bumped on every cancel so a deferred speak that was superseded stays quiet. */
  let request = 0;

  /** Stops speech and settles the pending promise. Returns true if the engine was busy. */
  const stop = (): boolean => {
    request += 1;
    const s = synth();
    const busy = !!s && (s.speaking || s.pending);
    if (busy) s.cancel();
    finishCurrent?.();
    finishCurrent = null;
    return busy;
  };

  return {
    cancel: () => void stop(),
    prime() {
      const s = synth();
      if (!s || primed) return;
      primed = true;
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      s.speak(u);
    },
    speak(text, lang, volume) {
      const s = synth();
      if (!s || !text.trim() || volume <= 0) return Promise.resolve();
      const cancelled = stop();
      const id = request;
      return new Promise<void>((resolve) => {
        let guard: ReturnType<typeof setTimeout> | null = null;
        let deferred: ReturnType<typeof setTimeout> | null = null;
        const done = (): void => {
          if (guard !== null) clearTimeout(guard);
          if (deferred !== null) clearTimeout(deferred);
          if (finishCurrent === done) finishCurrent = null;
          resolve();
        };
        finishCurrent = done;
        const start = (): void => {
          deferred = null;
          if (id !== request) return done(); // Superseded while waiting.
          const u = new SpeechSynthesisUtterance(text);
          u.lang = lang;
          u.rate = RATE;
          u.pitch = PITCH;
          u.volume = Math.min(1, Math.max(0, volume));
          const voice = pickVoice(s, lang);
          if (voice) u.voice = voice;
          // Some engines never fire onend; never leave a caller hanging.
          guard = setTimeout(done, 1500 + text.length * 150);
          u.onend = done;
          u.onerror = done;
          s.speak(u);
        };
        if (cancelled) deferred = setTimeout(start, SPEAK_AFTER_CANCEL_MS);
        else start();
      });
    },
  };
}

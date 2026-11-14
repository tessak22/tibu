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

export function createSpeechFallback(): SpeechFallback {
  let primed = false;
  let finishCurrent: (() => void) | null = null;

  const cancel = (): void => {
    const s = synth();
    if (s && (s.speaking || s.pending)) s.cancel();
    finishCurrent?.();
    finishCurrent = null;
  };

  return {
    cancel,
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
      cancel();
      return new Promise<void>((resolve) => {
        const u = new SpeechSynthesisUtterance(text);
        u.lang = lang;
        u.rate = RATE;
        u.pitch = PITCH;
        u.volume = Math.min(1, Math.max(0, volume));
        const voice = pickVoice(s, lang);
        if (voice) u.voice = voice;
        // Some engines never fire onend; never leave a caller hanging.
        const guard = setTimeout(() => done(), 1500 + text.length * 150);
        const done = (): void => {
          clearTimeout(guard);
          if (finishCurrent === done) finishCurrent = null;
          resolve();
        };
        finishCurrent = done;
        u.onend = done;
        u.onerror = done;
        s.speak(u);
      });
    },
  };
}

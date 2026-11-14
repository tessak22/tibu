import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSpeechFallback, SPEAK_AFTER_CANCEL_MS } from '../../../src/audio/speech';

class FakeUtterance {
  lang = '';
  rate = 1;
  pitch = 1;
  volume = 1;
  voice: unknown = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(readonly text: string) {}
}

const fakeSynth = () => {
  const spoken: FakeUtterance[] = [];
  const synth = {
    speaking: false,
    pending: false,
    getVoices: () => [],
    cancel: vi.fn(() => {
      synth.speaking = false;
    }),
    speak: vi.fn((u: FakeUtterance) => {
      spoken.push(u);
      synth.speaking = true;
    }),
  };
  return { synth, spoken };
};

let env: ReturnType<typeof fakeSynth>;

beforeEach(() => {
  vi.useFakeTimers();
  env = fakeSynth();
  vi.stubGlobal('window', { speechSynthesis: env.synth });
  vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('speech fallback', () => {
  it('speaks immediately when nothing was playing', () => {
    const speech = createSpeechFallback();
    void speech.speak('hello', 'en-US', 1);
    expect(env.spoken.map((u) => u.text)).toEqual(['hello']);
  });

  it('defers speaking after a cancel so iOS does not drop it', async () => {
    const speech = createSpeechFallback();
    void speech.speak('one', 'en-US', 1);
    void speech.speak('two', 'en-US', 1);
    expect(env.synth.cancel).toHaveBeenCalledTimes(1);
    expect(env.spoken.map((u) => u.text)).toEqual(['one']);
    await vi.advanceTimersByTimeAsync(SPEAK_AFTER_CANCEL_MS);
    expect(env.spoken.map((u) => u.text)).toEqual(['one', 'two']);
  });

  it('drops a deferred request that was superseded, and settles its promise', async () => {
    const speech = createSpeechFallback();
    void speech.speak('one', 'en-US', 1);
    const stale = speech.speak('two', 'en-US', 1);
    speech.cancel();
    await expect(stale).resolves.toBeUndefined();
    await vi.advanceTimersByTimeAsync(SPEAK_AFTER_CANCEL_MS * 2);
    expect(env.spoken.map((u) => u.text)).toEqual(['one']);
  });
});

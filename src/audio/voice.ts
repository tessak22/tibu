/**
 * Voice lines: plays generated clips from voice/<lang>/<lineId>.m4a, falling
 * back to speechSynthesis. New speech always interrupts older speech.
 */
import type { BufferCache } from './buffers';
import { findClip, type ClipIndex, type ClipLoader } from './clipIndex';
import { DEFAULT_LANGUAGE, lineText, speechLangFor, type LinesFile } from './lines';
import type { SpeechFallback } from './speech';
import { wordLine } from './lineIds';

export interface VoiceOutput {
  /** Null until the AudioContext is unlocked. */
  readonly ctx: AudioContext | null;
  readonly bus: AudioNode | null;
  readonly buffers: BufferCache | null;
}

export interface VoicePlayer {
  speak(lineId: string, fallbackText?: string): Promise<void>;
  speakText(text: string): Promise<void>;
  stop(): void;
  setLanguage(lang: string): void;
  setVolume(volume: number): void;
}

type Plan =
  | { readonly kind: 'clip'; readonly loader: ClipLoader; readonly text: string | null; readonly lang: string }
  | { readonly kind: 'tts'; readonly text: string; readonly lang: string }
  | { readonly kind: 'none' };

/** Decides how to voice a line (pure). */
export function planSpeech(
  lines: LinesFile, clips: ClipIndex, lineId: string, lang: string, fallbackText?: string,
): Plan {
  const text = lineText(lines, lineId, lang);
  const clip = findClip(clips, lang, lineId);
  if (clip) return { kind: 'clip', loader: clip, text, lang };
  if (text) return { kind: 'tts', text, lang };
  if (lang !== DEFAULT_LANGUAGE) {
    const enClip = findClip(clips, DEFAULT_LANGUAGE, lineId);
    const enText = lineText(lines, lineId, DEFAULT_LANGUAGE) ?? fallbackText ?? null;
    if (enClip) return { kind: 'clip', loader: enClip, text: enText, lang: DEFAULT_LANGUAGE };
    if (enText) return { kind: 'tts', text: enText, lang: DEFAULT_LANGUAGE };
  }
  if (fallbackText?.trim()) return { kind: 'tts', text: fallbackText, lang: DEFAULT_LANGUAGE };
  return { kind: 'none' };
}

export function createVoicePlayer(
  lines: LinesFile, clips: ClipIndex, output: () => VoiceOutput, speech: SpeechFallback,
): VoicePlayer {
  let lang = DEFAULT_LANGUAGE;
  let volume = 1;
  let generation = 0;
  let current: { source: AudioBufferSourceNode; finish: () => void } | null = null;

  const stop = (): void => {
    generation += 1;
    if (current) {
      try {
        current.source.stop();
      } catch {
        // Already stopped.
      }
      current.finish();
      current = null;
    }
    speech.cancel();
  };

  const playClip = async (loader: ClipLoader, gen: number): Promise<boolean> => {
    const { ctx, bus, buffers } = output();
    if (!ctx || !bus || !buffers) return false;
    try {
      const url = await loader();
      const buffer = await buffers.load(url);
      if (gen !== generation) return true; // Superseded while loading: stay quiet.
      await new Promise<void>((resolve) => {
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(bus);
        const finish = (): void => {
          if (current?.source === source) current = null;
          resolve();
        };
        source.onended = finish;
        current = { source, finish };
        source.start();
      });
      return true;
    } catch {
      return false; // Decode/fetch failure: caller falls back to speech.
    }
  };

  const speak = async (lineId: string, fallbackText?: string): Promise<void> => {
    stop();
    const gen = generation;
    if (volume <= 0 || !output().ctx) return;
    const plan = planSpeech(lines, clips, lineId, lang, fallbackText);
    if (plan.kind === 'none') return;
    if (plan.kind === 'clip') {
      const ok = await playClip(plan.loader, gen);
      if (ok || gen !== generation || !plan.text) return;
      await speech.speak(plan.text, speechLangFor(lines, plan.lang), volume);
      return;
    }
    await speech.speak(plan.text, speechLangFor(lines, plan.lang), volume);
  };

  return {
    speak,
    speakText(text) {
      const trimmed = text.trim();
      if (!trimmed) return Promise.resolve();
      return speak(wordLine(trimmed), trimmed);
    },
    stop,
    setLanguage(next) {
      lang = next || DEFAULT_LANGUAGE;
    },
    setVolume(next) {
      volume = next;
      if (volume <= 0) stop();
    },
  };
}

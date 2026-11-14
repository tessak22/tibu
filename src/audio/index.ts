/**
 * Tibu audio: synthesized SFX and block sounds, gentle generative music, and
 * voice lines (generated clips with speechSynthesis fallback).
 *
 * Nothing plays until unlock() is called from a user gesture. With sound off,
 * every method is a safe no-op.
 */
import { DEFAULT_SETTINGS, type AudioSystem, type Settings, type SfxName, type SoundRef } from '../core/types';
import linesJson from '../../voice/LINES.json';
import { createBufferCache, type BufferCache } from './buffers';
import { buildClipIndex, type ClipLoader } from './clipIndex';
import { createVoiceLimiter } from './limiter';
import { parseLinesFile } from './lines';
import { mixFromSettings, type Mix } from './mix';
import { createMusic, type Music } from './music';
import { presetFor } from './presets';
import { SFX, SFX_DURATION } from './sfx';
import { createSpeechFallback } from './speech';
import { createKit, type Kit } from './synth';
import { createVoicePlayer } from './voice';

export * from './lineIds';
export { PRESET_NAMES } from './presets';

const clipLoaders = import.meta.glob('/voice/*/*.{m4a,mp3}', { query: '?url', import: 'default' }) as Record<
  string,
  ClipLoader
>;

const PRESET_DURATION = 0.9;
const FILE_DURATION = 1.5;
const RAMP = 0.08;

interface Engine {
  readonly ctx: AudioContext;
  readonly kit: Kit;
  readonly sfxBus: GainNode;
  readonly musicBus: GainNode;
  readonly voiceBus: GainNode;
  readonly buffers: BufferCache;
  readonly music: Music;
}

type AudioContextCtor = new () => AudioContext;

function audioContextCtor(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

function createEngine(): Engine | null {
  const Ctor = audioContextCtor();
  if (!Ctor) return null;
  const ctx = new Ctor();
  // A gentle limiter so overlapping sounds never clip.
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -14;
  limiter.knee.value = 12;
  limiter.ratio.value = 6;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.2;
  limiter.connect(ctx.destination);
  const bus = (): GainNode => {
    const g = ctx.createGain();
    g.gain.value = 0;
    g.connect(limiter);
    return g;
  };
  const sfxBus = bus();
  const musicBus = bus();
  const voiceBus = bus();
  return {
    ctx, sfxBus, musicBus, voiceBus,
    kit: createKit(ctx, sfxBus),
    buffers: createBufferCache(ctx),
    music: createMusic(ctx, musicBus),
  };
}

/** iOS needs a sound started inside the gesture to fully unlock output. */
function playSilentTick(ctx: AudioContext): void {
  const source = ctx.createBufferSource();
  source.buffer = ctx.createBuffer(1, 1, 22050);
  source.connect(ctx.destination);
  source.start(0);
}

/** True when the current event grants user activation (or the browser cannot tell us). */
function hasUserActivation(): boolean {
  const activation = (navigator as Navigator & { userActivation?: { isActive: boolean } }).userActivation;
  return activation === undefined || activation.isActive;
}

export function createAudio(): AudioSystem {
  const lines = parseLinesFile(linesJson);
  const clips = buildClipIndex(clipLoaders);
  const speech = createSpeechFallback();
  const limiter = createVoiceLimiter();
  let engine: Engine | null = null;
  let mix: Mix = mixFromSettings(DEFAULT_SETTINGS);
  let musicSuspended = false;

  const voice = createVoicePlayer(
    lines,
    clips,
    () => ({ ctx: engine?.ctx ?? null, bus: engine?.voiceBus ?? null, buffers: engine?.buffers ?? null }),
    speech,
  );

  const setGain = (node: GainNode, value: number): void => {
    if (!engine) return;
    const now = engine.ctx.currentTime;
    node.gain.cancelScheduledValues(now);
    node.gain.setValueAtTime(node.gain.value, now);
    node.gain.linearRampToValueAtTime(value, now + RAMP);
  };

  const applyMix = (): void => {
    voice.setVolume(mix.voice);
    if (!engine) return;
    setGain(engine.sfxBus, mix.sfx);
    setGain(engine.musicBus, mix.music);
    setGain(engine.voiceBus, mix.voice);
    if (mix.musicPlaying && !musicSuspended) engine.music.start();
    else engine.music.stop();
  };

  /** Engine time if a sound may start now, else null. */
  const slot = (key: string, duration: number): number | null => {
    if (!engine || engine.ctx.state === 'closed' || mix.sfx <= 0) return null;
    const now = engine.ctx.currentTime;
    return limiter.tryStart(key, now, duration) ? now + 0.005 : null;
  };

  const playFile = (url: string): void => {
    const t = slot(`file:${url}`, FILE_DURATION);
    if (t === null || !engine) return;
    const { ctx, sfxBus, buffers } = engine;
    buffers
      .load(url)
      .then((buffer) => {
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(sfxBus);
        source.start();
      })
      .catch(() => {
        // Missing or undecodable file: fall back to a soft pop so the tap still answers.
        if (engine) presetFor('pop')(engine.kit, engine.ctx.currentTime);
      });
  };

  return {
    unlock() {
      if (!engine) {
        engine = createEngine();
        if (!engine) return;
        applyMix();
      }
      const { ctx } = engine;
      // Covers 'suspended' and iOS's non-standard 'interrupted' (after a call or Siri).
      // Repeated calls are harmless: resume() is idempotent and the tick is silent.
      if (ctx.state !== 'running' && ctx.state !== 'closed') {
        void ctx.resume().catch(() => undefined);
        playSilentTick(ctx);
      }
      // Speech priming only sticks inside real user activation (not iOS pointerdown).
      if (hasUserActivation()) speech.prime();
    },
    sfx(name: SfxName) {
      const t = slot(`sfx:${name}`, SFX_DURATION[name]);
      if (t === null || !engine) return;
      SFX[name](engine.kit, t);
    },
    play(sound: SoundRef) {
      if (sound.type === 'file') {
        playFile(sound.url);
        return;
      }
      const t = slot(`preset:${sound.preset}:${sound.note ?? ''}`, PRESET_DURATION);
      if (t === null || !engine) return;
      presetFor(sound.preset)(engine.kit, t, sound.note);
    },
    speak(lineId, fallbackText) {
      return voice.speak(lineId, fallbackText);
    },
    speakText(text) {
      return voice.speakText(text);
    },
    applySettings(settings: Settings) {
      mix = mixFromSettings(settings);
      voice.setLanguage(settings.language);
      applyMix();
    },
    setMusicSuspended(suspended: boolean) {
      if (musicSuspended === suspended) return;
      musicSuspended = suspended;
      applyMix();
    },
  };
}

/**
 * Block sound presets (SoundRef { type: 'synth', preset, note? }).
 * Animal sounds are soft cartoon approximations: rounded waveforms, gentle
 * filters, nothing loud or harsh.
 */
import type { Kit } from './synth';
import { midiToHz } from './limiter';

export type PresetRecipe = (kit: Kit, t: number, note?: number) => number;

const moo: PresetRecipe = (k, t) =>
  k.tone(t, {
    type: 'sawtooth', freq: 170, freqMid: 200, freqMidAt: 0.3, freqEnd: 150, dur: 0.9, gain: 0.22, attack: 0.12,
    filter: { type: 'lowpass', freq: 500, freqEnd: 1100, q: 3 },
  });

const baa: PresetRecipe = (k, t) =>
  k.tone(t, {
    type: 'sawtooth', freq: 360, freqEnd: 330, dur: 0.65, gain: 0.45, attack: 0.04, vibratoRate: 16, vibratoDepth: 22,
    filter: { type: 'bandpass', freq: 1300, freqEnd: 900, q: 2.5 },
  });

const oink: PresetRecipe = (k, t) => {
  for (let i = 0; i < 2; i++) {
    const at = t + i * 0.2;
    k.tone(at, { type: 'sawtooth', freq: 260, freqEnd: 170, dur: 0.13, gain: 0.22, filter: { type: 'lowpass', freq: 900, q: 4 } });
    k.noise(at, { dur: 0.1, gain: 0.05, filter: { type: 'bandpass', freq: 600, q: 3 } });
  }
  return t + 0.35;
};

const neigh: PresetRecipe = (k, t) =>
  k.tone(t, {
    type: 'triangle', freq: 520, freqMid: 980, freqMidAt: 0.25, freqEnd: 420, dur: 0.85, gain: 0.22, attack: 0.03,
    vibratoRate: 13, vibratoDepth: 45, filter: { type: 'lowpass', freq: 2600, q: 1 },
  });

const cluck: PresetRecipe = (k, t) => {
  [0, 0.11, 0.2].forEach((dt, i) =>
    k.tone(t + dt, { type: 'square', freq: 760 - i * 40, freqEnd: 520, dur: 0.06, gain: 0.35, attack: 0.003, filter: { type: 'bandpass', freq: 1400, q: 2 } }),
  );
  return t + 0.28;
};

const quack: PresetRecipe = (k, t) => {
  [0, 0.2].forEach((dt) =>
    k.tone(t + dt, { type: 'sawtooth', freq: 440, freqEnd: 360, dur: 0.15, gain: 0.8, attack: 0.01, filter: { type: 'bandpass', freq: 1100, freqEnd: 800, q: 5 } }),
  );
  return t + 0.36;
};

const meow: PresetRecipe = (k, t) =>
  k.tone(t, {
    type: 'triangle', freq: 520, freqMid: 820, freqMidAt: 0.35, freqEnd: 480, dur: 0.6, gain: 0.24, attack: 0.06,
    filter: { type: 'bandpass', freq: 700, freqEnd: 1600, q: 1.5 },
  });

const woof: PresetRecipe = (k, t) => {
  [0, 0.22].forEach((dt) => {
    k.tone(t + dt, { type: 'sawtooth', freq: 480, freqEnd: 260, dur: 0.13, gain: 0.2, attack: 0.008, filter: { type: 'lowpass', freq: 1300, q: 2 } });
    k.noise(t + dt, { dur: 0.08, gain: 0.05, filter: { type: 'bandpass', freq: 900, q: 2 } });
  });
  return t + 0.36;
};

const tweet: PresetRecipe = (k, t) => {
  [0, 0.11, 0.22].forEach((dt, i) =>
    k.tone(t + dt, { type: 'sine', freq: 2600 + i * 200, freqEnd: 3600 + i * 150, dur: 0.07, gain: 0.12, attack: 0.005 }),
  );
  return t + 0.3;
};

const ribbit: PresetRecipe = (k, t) => {
  [0, 0.2].forEach((dt) =>
    k.tone(t + dt, { type: 'square', freq: 190, freqEnd: 240, dur: 0.14, gain: 0.12, vibratoRate: 32, vibratoDepth: 40, filter: { type: 'lowpass', freq: 900, q: 3 } }),
  );
  return t + 0.36;
};

const squeak: PresetRecipe = (k, t) =>
  k.tone(t, { type: 'sine', freq: 1700, freqMid: 2600, freqMidAt: 0.4, freqEnd: 2100, dur: 0.14, gain: 0.16, attack: 0.005 });

const note: PresetRecipe = (k, t, n) => k.bell(t, midiToHz(n ?? 60), { dur: 0.9, gain: 0.3 });

const chime: PresetRecipe = (k, t, n) =>
  k.bell(t, midiToHz(n ?? 84), { dur: 1.6, gain: 0.18, partials: [[1, 1], [2.76, 0.3], [5.4, 0.1]] });

const pop: PresetRecipe = (k, t) => k.tone(t, { type: 'sine', freq: 700, freqEnd: 220, dur: 0.09, gain: 0.3, attack: 0.002 });

const splash: PresetRecipe = (k, t) => {
  k.noise(t, { dur: 0.5, gain: 0.3, attack: 0.01, filter: { type: 'bandpass', freq: 2400, freqEnd: 500, q: 0.8 } });
  for (let i = 0; i < 4; i++) {
    const at = t + 0.08 + i * 0.07 + Math.random() * 0.04;
    k.tone(at, { type: 'sine', freq: 900 + Math.random() * 700, freqEnd: 1500 + Math.random() * 600, dur: 0.06, gain: 0.07 });
  }
  return t + 0.55;
};

const rustle: PresetRecipe = (k, t) => {
  for (let i = 0; i < 4; i++) {
    k.noise(t + i * 0.08, { dur: 0.1, gain: 0.3, attack: 0.02, filter: { type: 'bandpass', freq: 3000 + Math.random() * 1500, q: 1.2 } });
  }
  return t + 0.42;
};

const knock: PresetRecipe = (k, t) => {
  [0, 0.14].forEach((dt) => {
    k.tone(t + dt, { type: 'triangle', freq: 200, freqEnd: 120, dur: 0.07, gain: 0.35, attack: 0.002 });
    k.noise(t + dt, { dur: 0.04, gain: 0.08, filter: { type: 'lowpass', freq: 1200 } });
  });
  return t + 0.22;
};

const ding: PresetRecipe = (k, t, n) =>
  k.bell(t, midiToHz(n ?? 88), { dur: 1.0, gain: 0.2, partials: [[1, 1], [2, 0.3], [3, 0.08]] });

export const PRESETS: Readonly<Record<string, PresetRecipe>> = {
  moo, baa, oink, neigh, cluck, quack, meow, woof, tweet, ribbit, squeak,
  note, chime, pop, splash, rustle, knock, ding,
};

export const PRESET_NAMES: readonly string[] = Object.keys(PRESETS);

/** Unknown presets play a soft pop so a tap is never silent. */
export function presetFor(name: string): PresetRecipe {
  return PRESETS[name] ?? pop;
}

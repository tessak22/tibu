import type { SfxName } from '../core/types';
import type { Kit } from './synth';
import { midiToHz } from './limiter';

/** Plays an SFX at time `t`; returns its approximate end time. */
export type SfxRecipe = (kit: Kit, t: number) => number;

/** Slight random detune so repeated sounds feel alive, not robotic. */
const wobble = (amount = 0.04): number => 1 + (Math.random() * 2 - 1) * amount;

const place: SfxRecipe = (k, t) => {
  const w = wobble();
  k.tone(t, { type: 'sine', freq: 420 * w, freqEnd: 190 * w, dur: 0.14, gain: 0.45, attack: 0.004 });
  return k.tone(t, { type: 'triangle', freq: 840 * w, freqEnd: 400 * w, dur: 0.06, gain: 0.08, attack: 0.002 });
};

const smash: SfxRecipe = (k, t) => {
  const w = wobble(0.06);
  k.tone(t, { type: 'sine', freq: 900 * w, freqEnd: 160 * w, dur: 0.12, gain: 0.4, attack: 0.002 });
  k.noise(t, { dur: 0.14, gain: 0.18, attack: 0.002, filter: { type: 'bandpass', freq: 2200, freqEnd: 700, q: 1.2 } });
  k.tone(t + 0.07, { type: 'sine', freq: 1900 * w, freqEnd: 2600 * w, dur: 0.08, gain: 0.06 });
  return t + 0.2;
};

const undo: SfxRecipe = (k, t) => {
  k.tone(t, { type: 'sine', freq: 520, freqEnd: 780, dur: 0.09, gain: 0.25 });
  return k.tone(t + 0.08, { type: 'sine', freq: 600, freqEnd: 360, dur: 0.16, gain: 0.25 });
};

const mode: SfxRecipe = (k, t) => {
  k.noise(t, { dur: 0.28, gain: 0.2, attack: 0.08, filter: { type: 'bandpass', freq: 500, freqEnd: 2400, q: 2 } });
  return k.tone(t + 0.05, { type: 'sine', freq: 500, freqEnd: 900, dur: 0.2, gain: 0.12, attack: 0.04 });
};

const celebrate: SfxRecipe = (k, t) => {
  const notes = [72, 76, 79, 84];
  notes.forEach((n, i) => k.bell(t + i * 0.09, midiToHz(n), { dur: 0.6, gain: 0.22 }));
  for (let i = 0; i < 6; i++) {
    const at = t + 0.3 + i * 0.06 + Math.random() * 0.03;
    k.tone(at, { type: 'sine', freq: 2400 + Math.random() * 2200, dur: 0.12, gain: 0.05, attack: 0.003 });
  }
  return t + 1.0;
};

const tap: SfxRecipe = (k, t) =>
  k.tone(t, { type: 'sine', freq: 1300 * wobble(0.02), freqEnd: 1100, dur: 0.035, gain: 0.15, attack: 0.002 });

const ui: SfxRecipe = (k, t) => k.tone(t, { type: 'sine', freq: 880, freqEnd: 1040, dur: 0.08, gain: 0.2, attack: 0.004 });

const whoosh: SfxRecipe = (k, t) =>
  k.noise(t, { dur: 0.4, gain: 0.3, attack: 0.12, filter: { type: 'bandpass', freq: 2200, freqEnd: 350, q: 1.5 } });

const sleep: SfxRecipe = (k, t) => {
  const notes = [79, 76, 72, 67, 60];
  notes.forEach((n, i) => k.bell(t + i * 0.42, midiToHz(n), { dur: 1.4, gain: 0.18, partials: [[1, 1], [2, 0.15], [3, 0.05]] }));
  return t + notes.length * 0.42 + 1.2;
};

export const SFX: Readonly<Record<SfxName, SfxRecipe>> = {
  place, smash, undo, mode, celebrate, tap, ui, whoosh, sleep,
};

/** Approximate durations used for voice limiting. */
export const SFX_DURATION: Readonly<Record<SfxName, number>> = {
  place: 0.15, smash: 0.2, undo: 0.25, mode: 0.3, celebrate: 1.0, tap: 0.04, ui: 0.08, whoosh: 0.4, sleep: 3.3,
};

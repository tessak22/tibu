/**
 * Gentle generative background music: slow pentatonic bell notes over a soft
 * sine pad. Off by default; runs on its own bus with its own volume.
 */
import { createKit } from './synth';
import { midiToHz } from './limiter';

export interface Music {
  start(): void;
  stop(): void;
  readonly playing: boolean;
}

const PENTATONIC = [60, 62, 64, 67, 69, 72, 74, 76];
const CHORDS: readonly (readonly number[])[] = [
  [48, 55, 64], [45, 52, 60], [41, 48, 57], [43, 50, 59],
];
const BEAT = 0.75; // seconds
const LOOKAHEAD = 1.5; // seconds scheduled ahead
const TICK_MS = 400;

export function createMusic(ctx: AudioContext, out: AudioNode): Music {
  const kit = createKit(ctx, out);
  let timer: ReturnType<typeof setInterval> | null = null;
  let nextBeat = 0;
  let beat = 0;
  let lastNote = 4;

  const pad = (t: number, chord: readonly number[]): void => {
    for (const n of chord) {
      kit.tone(t, { type: 'sine', freq: midiToHz(n), dur: BEAT * 8, gain: 0.05, attack: 1.2 });
    }
  };

  const schedule = (): void => {
    while (nextBeat < ctx.currentTime + LOOKAHEAD) {
      if (beat % 8 === 0) pad(nextBeat, CHORDS[(beat / 8) % CHORDS.length] ?? CHORDS[0]!);
      if (Math.random() < 0.55) {
        // Small melodic steps feel calm.
        const step = Math.floor(Math.random() * 3) - 1;
        lastNote = Math.min(PENTATONIC.length - 1, Math.max(0, lastNote + step));
        kit.bell(nextBeat, midiToHz(PENTATONIC[lastNote] ?? 67), { dur: 1.6, gain: 0.12, partials: [[1, 1], [2, 0.12]] });
      }
      nextBeat += BEAT;
      beat += 1;
    }
  };

  return {
    start() {
      if (timer !== null) return;
      nextBeat = ctx.currentTime + 0.2;
      beat = 0;
      schedule();
      timer = setInterval(schedule, TICK_MS);
    },
    stop() {
      if (timer === null) return;
      clearInterval(timer);
      timer = null;
    },
    get playing() {
      return timer !== null;
    },
  };
}

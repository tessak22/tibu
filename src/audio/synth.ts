/**
 * Tiny Web Audio synth toolkit used by the SFX and block-sound presets.
 * Every helper schedules nodes at absolute time `t` and returns its end time.
 */

export interface ToneOptions {
  readonly type?: OscillatorType;
  readonly freq: number;
  /** Glide target (exponential) reached at the end of the tone. */
  readonly freqEnd?: number;
  /** Optional mid-point frequency, reached at `freqMidAt` (0..1 of duration). */
  readonly freqMid?: number;
  readonly freqMidAt?: number;
  readonly dur: number;
  readonly gain?: number;
  readonly attack?: number;
  readonly vibratoRate?: number;
  readonly vibratoDepth?: number;
  /** Optional filter applied to this tone. */
  readonly filter?: FilterOptions;
}

export interface FilterOptions {
  readonly type: BiquadFilterType;
  readonly freq: number;
  readonly freqEnd?: number;
  readonly q?: number;
}

export interface NoiseOptions {
  readonly dur: number;
  readonly gain?: number;
  readonly attack?: number;
  readonly filter: FilterOptions;
}

export interface Kit {
  readonly ctx: AudioContext;
  tone(t: number, o: ToneOptions): number;
  noise(t: number, o: NoiseOptions): number;
  /** Bell/marimba-like additive note. */
  bell(t: number, freq: number, opts?: { dur?: number; gain?: number; partials?: readonly (readonly [number, number])[] }): number;
}

const MIN_GAIN = 0.0001;

function applyFilter(ctx: AudioContext, input: AudioNode, t: number, dur: number, f: FilterOptions): AudioNode {
  const filter = ctx.createBiquadFilter();
  filter.type = f.type;
  filter.Q.value = f.q ?? 1;
  filter.frequency.setValueAtTime(f.freq, t);
  if (f.freqEnd !== undefined) filter.frequency.exponentialRampToValueAtTime(Math.max(20, f.freqEnd), t + dur);
  input.connect(filter);
  return filter;
}

function envelope(ctx: AudioContext, t: number, dur: number, peak: number, attack: number): GainNode {
  const g = ctx.createGain();
  g.gain.setValueAtTime(MIN_GAIN, t);
  g.gain.exponentialRampToValueAtTime(Math.max(MIN_GAIN, peak), t + attack);
  g.gain.exponentialRampToValueAtTime(MIN_GAIN, t + dur);
  return g;
}

let noiseBuffer: AudioBuffer | null = null;
function getNoise(ctx: AudioContext): AudioBuffer {
  if (noiseBuffer && noiseBuffer.sampleRate === ctx.sampleRate) return noiseBuffer;
  const length = ctx.sampleRate; // 1 second, looped
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  noiseBuffer = buffer;
  return buffer;
}

export function createKit(ctx: AudioContext, out: AudioNode): Kit {
  const tone = (t: number, o: ToneOptions): number => {
    const dur = Math.max(0.02, o.dur);
    const osc = ctx.createOscillator();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(o.freq, t);
    if (o.freqMid !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(o.freqMid, t + dur * (o.freqMidAt ?? 0.5));
    }
    if (o.freqEnd !== undefined) osc.frequency.exponentialRampToValueAtTime(o.freqEnd, t + dur);
    if (o.vibratoRate && o.vibratoDepth) {
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      lfo.frequency.value = o.vibratoRate;
      depth.gain.value = o.vibratoDepth;
      lfo.connect(depth).connect(osc.frequency);
      lfo.start(t);
      lfo.stop(t + dur + 0.05);
    }
    const env = envelope(ctx, t, dur, o.gain ?? 0.3, o.attack ?? 0.01);
    const shaped = o.filter ? applyFilter(ctx, osc, t, dur, o.filter) : osc;
    shaped.connect(env).connect(out);
    osc.start(t);
    osc.stop(t + dur + 0.05);
    return t + dur;
  };

  const noise = (t: number, o: NoiseOptions): number => {
    const dur = Math.max(0.02, o.dur);
    const src = ctx.createBufferSource();
    src.buffer = getNoise(ctx);
    src.loop = true;
    const env = envelope(ctx, t, dur, o.gain ?? 0.2, o.attack ?? 0.01);
    applyFilter(ctx, src, t, dur, o.filter).connect(env).connect(out);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
    return t + dur;
  };

  const bell: Kit['bell'] = (t, freq, opts = {}) => {
    const dur = opts.dur ?? 0.7;
    const gain = opts.gain ?? 0.25;
    const partials = opts.partials ?? [[1, 1], [3.93, 0.25], [9.2, 0.06]];
    let end = t;
    for (const [ratio, amp] of partials) {
      const f = freq * ratio;
      if (f > 12000) continue;
      end = Math.max(end, tone(t, { freq: f, dur: dur / Math.sqrt(ratio), gain: gain * amp, attack: 0.004 }));
    }
    return end;
  };

  return { ctx, tone, noise, bell };
}

import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../../../src/core/types';
import { createVoiceLimiter, midiToHz } from '../../../src/audio/limiter';
import { mixFromSettings } from '../../../src/audio/mix';
import { PRESET_NAMES, presetFor, PRESETS } from '../../../src/audio/presets';

describe('mixFromSettings', () => {
  it('music is off by default, sfx and voice on', () => {
    const m = mixFromSettings(DEFAULT_SETTINGS);
    expect(m.musicPlaying).toBe(false);
    expect(m.sfx).toBeGreaterThan(0);
    expect(m.voice).toBe(1);
  });
  it('mute silences everything', () => {
    const m = mixFromSettings({ ...DEFAULT_SETTINGS, muted: true, musicOn: true });
    expect([m.sfx, m.music, m.voice]).toEqual([0, 0, 0]);
    expect(m.voiceEnabled).toBe(false);
  });
  it('clamps bad volumes', () => {
    const m = mixFromSettings({ ...DEFAULT_SETTINGS, voiceVolume: 3, sfxVolume: Number.NaN });
    expect(m.voice).toBe(1);
    expect(m.sfx).toBe(0);
  });
});

describe('voice limiter', () => {
  it('drops rapid repeats of the same sound', () => {
    const l = createVoiceLimiter(6, 0.05);
    expect(l.tryStart('place', 0, 0.1)).toBe(true);
    expect(l.tryStart('place', 0.01, 0.1)).toBe(false);
    expect(l.tryStart('place', 0.06, 0.1)).toBe(true);
  });
  it('caps simultaneous voices and frees them when finished', () => {
    const l = createVoiceLimiter(2, 0);
    expect(l.tryStart('a', 0, 1)).toBe(true);
    expect(l.tryStart('b', 0, 1)).toBe(true);
    expect(l.tryStart('c', 0, 1)).toBe(false);
    expect(l.active(0.5)).toBe(2);
    expect(l.tryStart('c', 1.1, 1)).toBe(true);
  });
});

describe('presets', () => {
  it('has every block sound preset', () => {
    for (const name of ['moo', 'baa', 'oink', 'neigh', 'cluck', 'quack', 'meow', 'woof', 'tweet', 'ribbit', 'squeak', 'note', 'chime', 'pop', 'splash', 'rustle', 'knock', 'ding']) {
      expect(PRESET_NAMES).toContain(name);
    }
    expect(presetFor('unknown')).toBe(PRESETS.pop);
  });
  it('midi conversion is tuned and clamped', () => {
    expect(midiToHz(69)).toBeCloseTo(440);
    expect(midiToHz(81)).toBeCloseTo(880);
    expect(midiToHz(500)).toBe(midiToHz(108));
  });
});

describe('pack schema', () => {
  it('synth preset enum matches the implemented presets exactly', async () => {
    const { readFileSync } = await import('node:fs');
    const schema = JSON.parse(readFileSync(new URL('../../../schemas/pack.schema.json', import.meta.url), 'utf8')) as {
      definitions: { synthPreset: { enum: string[] } };
    };
    expect([...schema.definitions.synthPreset.enum].sort()).toEqual([...PRESET_NAMES].sort());
  });
});

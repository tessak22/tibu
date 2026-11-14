import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../../../src/core/types';
import { mergeSettings, normalizeWord } from '../../../src/storage/settings';

describe('mergeSettings', () => {
  it('fills defaults for garbage input', () => {
    expect(mergeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(mergeSettings('nope')).toEqual(DEFAULT_SETTINGS);
  });

  it('rejects wrong types and clamps volumes', () => {
    const s = mergeSettings({ sfxVolume: 4, musicVolume: -1, voiceOn: 'yes', language: 7, playTimerMinutes: 13 });
    expect(s.sfxVolume).toBe(1);
    expect(s.musicVolume).toBe(0);
    expect(s.voiceOn).toBe(DEFAULT_SETTINGS.voiceOn);
    expect(s.language).toBe('en');
    expect(s.playTimerMinutes).toBeNull();
  });

  it('keeps valid timer values and cleans custom words', () => {
    const s = mergeSettings({ playTimerMinutes: 45, customWords: ['mia', 'MIA', 'a', 'b4d', 42] });
    expect(s.playTimerMinutes).toBe(45);
    expect(s.customWords).toEqual(['MIA']);
  });

  it('drops unknown keys', () => {
    expect(Object.keys(mergeSettings({ extra: 1 }))).not.toContain('extra');
  });
});

describe('normalizeWord', () => {
  it('accepts A-Z words of 2-12 letters', () => {
    expect(normalizeWord(' leo ')).toBe('LEO');
    expect(normalizeWord('a')).toBeNull();
    expect(normalizeWord('zoë')).toBeNull();
    expect(normalizeWord('two words')).toBeNull();
    expect(normalizeWord('abcdefghijklm')).toBeNull();
  });
});

import { describe, expect, it, vi } from 'vitest';
import { createSettingsStore } from '../../../src/app/settings-store';
import { languagesFrom } from '../../../src/app/languages';
import { DEFAULT_SETTINGS } from '../../../src/core/types';

describe('settings store', () => {
  it('updates immutably, notifies, and persists', async () => {
    const saveSettings = vi.fn(async (s) => s);
    const store = createSettingsStore({ saveSettings }, DEFAULT_SETTINGS, vi.fn());
    const listener = vi.fn();
    store.subscribe(listener);
    await store.update((s) => ({ ...s, muted: true }));
    expect(store.get().muted).toBe(true);
    expect(DEFAULT_SETTINGS.muted).toBe(false);
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ muted: true }), DEFAULT_SETTINGS);
    expect(saveSettings).toHaveBeenCalledTimes(1);
  });

  it('reports save failures without throwing', async () => {
    const onError = vi.fn();
    const store = createSettingsStore({ saveSettings: async () => Promise.reject(new Error('x')) }, DEFAULT_SETTINGS, onError);
    await store.update((s) => ({ ...s, leftHanded: true }));
    expect(onError).toHaveBeenCalled();
    expect(store.get().leftHanded).toBe(true);
  });
});

describe('languagesFrom', () => {
  it('reads language names from LINES.json', () => {
    expect(languagesFrom({ languages: { en: { name: 'English' }, es: { name: 'Español' } } })).toEqual([
      { code: 'en', name: 'English' },
      { code: 'es', name: 'Español' },
    ]);
  });
  it('falls back to English', () => {
    expect(languagesFrom(null)).toEqual([{ code: 'en', name: 'English' }]);
  });
});

// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import type { PlayMode, Profile } from '../../../src/core/types';
import { DEFAULT_SETTINGS } from '../../../src/core/types';
import { profilesSection } from '../../../src/ui/parent/profiles-section';
import { playSection } from '../../../src/ui/parent/settings-sections';
import type { ParentAreaDeps } from '../../../src/ui/parent/types';
import { fakeCtx } from './helpers';

const flush = () => new Promise((r) => setTimeout(r, 0));

function deps(profiles: Profile[]) {
  let list = profiles;
  const repo = {
    listProfiles: vi.fn(async () => list),
    createProfile: vi.fn(async (animal: string, mode: PlayMode = 'little') => {
      const p: Profile = { id: `p${list.length + 1}`, animal, mode, stickers: [], createdAt: list.length };
      list = [...list, p];
      return p;
    }),
    setProfileMode: vi.fn(async (id: string, mode: PlayMode) => {
      list = list.map((p) => (p.id === id ? { ...p, mode } : p));
      return list.find((p) => p.id === id) ?? null;
    }),
    deleteProfile: vi.fn(),
  };
  const d = {
    ctx: fakeCtx(),
    repo,
    currentProfileId: 'p1',
    onDataChanged: vi.fn(),
    updateSettings: vi.fn(async () => undefined),
  } as unknown as ParentAreaDeps;
  return { d, repo };
}

describe('parent area: player modes', () => {
  it('shows each player’s mode (old profiles as little) and switches it', async () => {
    const { d, repo } = deps([
      { id: 'p1', animal: 'cat', createdAt: 0 },
      { id: 'p2', animal: 'dog', mode: 'big', stickers: ['sun'], createdAt: 1 },
    ]);
    const el = profilesSection(d);
    await flush();
    const row = (id: string) => el.querySelector<HTMLElement>(`[data-profile="${id}"]`)!;
    const selected = (id: string) => row(id).querySelector<HTMLButtonElement>('.mode-choice.selected')!.dataset.mode;
    expect(selected('p1')).toBe('little');
    expect(selected('p2')).toBe('big');
    expect(row('p1').textContent).toContain('Little builder (2–3)');
    expect(row('p1').textContent).toContain('Big builder (4+)');

    row('p1').querySelector<HTMLButtonElement>('[data-mode="big"]')!.click();
    await flush();
    expect(repo.setProfileMode).toHaveBeenCalledWith('p1', 'big');
    expect(d.onDataChanged).toHaveBeenCalled();
  });

  it('creates a player with the chosen animal and mode', async () => {
    const { d, repo } = deps([{ id: 'p1', animal: 'cat', createdAt: 0 }]);
    const el = profilesSection(d);
    document.body.append(el);
    await flush();
    el.querySelector<HTMLButtonElement>('.animal-choice')!.click();
    const newMode = el.querySelector<HTMLElement>('.animal-picker ~ .mode-switch')!;
    newMode.querySelector<HTMLButtonElement>('[data-mode="big"]')!.click();
    [...el.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === 'Add player')!.click();
    await flush();
    expect(repo.createProfile).toHaveBeenCalledWith(expect.any(String), 'big');
  });
});

describe('parent area: topple setting', () => {
  it('has "Smash knocks down towers", on by default', () => {
    const { d } = deps([]);
    const el = playSection(d, DEFAULT_SETTINGS);
    const label = [...el.querySelectorAll('label')].find((l) => l.textContent?.includes('Smash knocks down towers'))!;
    const input = label.querySelector('input')!;
    expect(input.checked).toBe(true);
    input.checked = false;
    input.dispatchEvent(new Event('change'));
    expect(d.updateSettings).toHaveBeenCalled();
  });
});

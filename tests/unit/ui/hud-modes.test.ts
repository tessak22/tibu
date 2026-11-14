// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { createHud, type HudActions } from '../../../src/ui/hud';
import { playablePacks } from '../../../src/ui/pack-picker';
import { fakePack } from './helpers';

const actions = (): HudActions & Record<string, ReturnType<typeof vi.fn>> => ({
  onMode: vi.fn(),
  onSelectBlock: vi.fn(),
  onPackButton: vi.fn(),
  onUndo: vi.fn(),
  onHome: vi.fn(),
  onBack: vi.fn(),
  onPhoto: vi.fn(),
  onToggleMute: vi.fn(),
  onCard: vi.fn(),
  onBuilds: vi.fn(),
  onStickers: vi.fn(),
  onStopBlueprint: vi.fn(),
});

const setup = () => {
  const a = actions();
  const hud = createHud(a, document.createElement('button'));
  document.body.append(hud.el);
  const q = (sel: string) => hud.el.querySelector<HTMLButtonElement>(sel)!;
  const shown = (sel: string) => !q(sel).hidden;
  return { a, hud, q, shown };
};

describe('HUD per play mode', () => {
  it('little mode is the original HUD: build and smash only, no builds or stickers', () => {
    const { hud, shown } = setup();
    hud.setLayout({ playMode: 'little', explore: false });
    expect(shown('[data-mode="build"]')).toBe(true);
    expect(shown('[data-mode="smash"]')).toBe(true);
    expect(shown('[data-mode="walk"]')).toBe(false);
    expect(shown('.builds-btn')).toBe(false);
    expect(shown('.stickers-btn')).toBe(false);
    expect(hud.el.querySelector<HTMLElement>('[data-testid="blueprint-steps"]')!.hidden).toBe(true);
  });

  it('a little builder in an adventure world still gets no walk button', () => {
    const { hud, shown } = setup();
    hud.setLayout({ playMode: 'little', explore: true });
    expect(shown('[data-mode="walk"]')).toBe(false);
    expect(shown('.stickers-btn')).toBe(false);
  });

  it('big mode on an island: builds button, no walk or sticker book', () => {
    const { hud, shown } = setup();
    hud.setLayout({ playMode: 'big', explore: false });
    expect(shown('.builds-btn')).toBe(true);
    expect(shown('[data-mode="walk"]')).toBe(false);
    expect(shown('.stickers-btn')).toBe(false);
  });

  it('big mode in an explore world: walk, builds and sticker book', () => {
    const { a, hud, q, shown } = setup();
    hud.setLayout({ playMode: 'big', explore: true });
    expect(shown('[data-mode="walk"]')).toBe(true);
    expect(shown('.builds-btn')).toBe(true);
    expect(shown('.stickers-btn')).toBe(true);
    q('[data-mode="walk"]').click();
    q('.builds-btn').click();
    q('.stickers-btn').click();
    expect(a.onMode).toHaveBeenCalledWith('walk');
    expect(a.onBuilds).toHaveBeenCalledTimes(1);
    expect(a.onStickers).toHaveBeenCalledTimes(1);
    hud.setMode('walk');
    expect(q('[data-mode="walk"]').classList.contains('active')).toBe(true);
    expect(q('[data-mode="build"]').classList.contains('active')).toBe(false);
  });

  it('every big-mode button is a picture with a name and no text', () => {
    const { hud } = setup();
    hud.setLayout({ playMode: 'big', explore: true });
    hud.setBlueprintProgress({ picture: document.createElement('canvas'), step: 0, count: 2 });
    for (const b of hud.el.querySelectorAll<HTMLButtonElement>('.hud-group button')) {
      if (b.hidden) continue;
      expect(b.textContent?.trim() ?? '').toBe('');
      expect(b.querySelector('svg, canvas, img')).not.toBeNull();
      expect(b.getAttribute('aria-label')).toBeTruthy();
    }
  });

  it('shows step dots and stops a build from the small x', () => {
    const { a, hud, q } = setup();
    hud.setLayout({ playMode: 'big', explore: false });
    hud.setBlueprintProgress({ picture: document.createElement('canvas'), step: 1, count: 3 });
    const steps = hud.el.querySelector<HTMLElement>('[data-testid="blueprint-steps"]')!;
    expect(steps.hidden).toBe(false);
    expect(steps.querySelectorAll('.build-dot')).toHaveLength(3);
    expect(steps.querySelectorAll('.build-dot.done')).toHaveLength(1);
    expect(steps.querySelectorAll('.build-dot.current')).toHaveLength(1);
    q('[data-testid="blueprint-stop"]').click();
    expect(a.onStopBlueprint).toHaveBeenCalledTimes(1);
    hud.setBlueprintProgress(null);
    expect(steps.hidden).toBe(true);
  });

  it('switching back to little mode hides the step indicator', () => {
    const { hud } = setup();
    hud.setLayout({ playMode: 'big', explore: false });
    hud.setBlueprintProgress({ picture: null, step: 0, count: 2 });
    hud.setLayout({ playMode: 'little', explore: false });
    expect(hud.el.querySelector<HTMLElement>('[data-testid="blueprint-steps"]')!.hidden).toBe(true);
  });

  it('mirrors big-mode controls for left-handed play too', () => {
    const { hud } = setup();
    hud.setLayout({ playMode: 'big', explore: true });
    hud.setLeftHanded(true);
    expect(hud.el.getAttribute('dir')).toBe('rtl');
    expect(hud.el.querySelector('.hud-side-start [data-mode="walk"]')).not.toBeNull();
  });
});

describe('playablePacks', () => {
  const all = [fakePack('colors', ['red']), fakePack('parts', ['slope'], 'big')];
  it('hides big-only packs from little builders', () => {
    expect(playablePacks(all, [], 'little').map((p) => p.id)).toEqual(['colors']);
  });
  it('shows the parts pack to big builders', () => {
    expect(playablePacks(all, [], 'big').map((p) => p.id)).toEqual(['colors', 'parts']);
  });
  it('respects the grown-up pack choice', () => {
    expect(playablePacks(all, ['parts'], 'big').map((p) => p.id)).toEqual(['parts']);
    expect(playablePacks(all, ['parts'], 'little').map((p) => p.id)).toEqual(['colors']);
  });
});

// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { createHud, type HudActions } from '../../../src/ui/hud';
import { enabledPacks } from '../../../src/ui/pack-picker';
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
});

const setup = () => {
  const a = actions();
  const hud = createHud(a, document.createElement('button'));
  document.body.append(hud.el);
  return { a, hud, q: (sel: string) => hud.el.querySelector<HTMLButtonElement>(sel)! };
};

describe('HUD', () => {
  it('marks only the active mode', () => {
    const { hud, q } = setup();
    hud.setMode('smash');
    expect(q('[data-mode="smash"]').classList.contains('active')).toBe(true);
    expect(q('[data-mode="build"]').classList.contains('active')).toBe(false);
  });

  it('routes every picture button to its action', () => {
    const { a, q } = setup();
    q('[data-mode="build"]').click();
    q('.undo-btn').click();
    q('.home-btn').click();
    q('.back-btn').click();
    q('.photo-btn').click();
    q('.mute-btn').click();
    q('.pack-btn').click();
    expect(a.onMode).toHaveBeenCalledWith('build');
    for (const fn of [a.onUndo, a.onHome, a.onBack, a.onPhoto, a.onToggleMute, a.onPackButton]) {
      expect(fn).toHaveBeenCalledTimes(1);
    }
  });

  it('every button gives visible feedback', () => {
    const { q } = setup();
    const undo = q('.undo-btn');
    undo.click();
    expect(undo.classList.contains('pop')).toBe(true);
  });

  it('fills the tray and shows the selection', () => {
    const { a, hud, q } = setup();
    hud.setPack(fakePack('colors', ['red', 'blue', 'green']), 'colors:blue');
    expect(hud.el.querySelectorAll('.tray-item')).toHaveLength(3);
    expect(q('.tray-item.selected').dataset.key).toBe('colors:blue');
    q('[data-key="colors:green"]').click();
    expect(a.onSelectBlock).toHaveBeenCalledWith('colors:green');
    expect(q('.tray-item.selected').dataset.key).toBe('colors:green');
  });

  it('mirrors for left-handed play and toggles mute/card', () => {
    const { hud, q } = setup();
    hud.setLeftHanded(true);
    expect(hud.el.getAttribute('dir')).toBe('rtl');
    hud.setMuted(true);
    expect(q('.mute-btn').classList.contains('off')).toBe(true);
    hud.setCardEnabled(false);
    expect(q('.card-btn').hidden).toBe(true);
    hud.setCardPicture(document.createElement('canvas'));
    expect(q('.card-btn').classList.contains('showing')).toBe(true);
  });

  it('keeps tray touches away from the canvas', () => {
    const { hud } = setup();
    const outer = vi.fn();
    document.body.addEventListener('pointerdown', outer);
    hud.el.querySelector('.tray')!.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(outer).not.toHaveBeenCalled();
    document.body.removeEventListener('pointerdown', outer);
  });
});

describe('enabledPacks', () => {
  const all = [fakePack('a', ['x']), fakePack('b', ['y'])];
  it('treats an empty list as all packs', () => expect(enabledPacks(all, [])).toHaveLength(2));
  it('filters to enabled packs', () => expect(enabledPacks(all, ['b']).map((p) => p.id)).toEqual(['b']));
  it('never returns nothing', () => expect(enabledPacks(all, ['gone'])).toHaveLength(2));
});

import { h } from '../dom';
import { openOverlay } from '../overlay';
import { aboutSection, installSection } from './about-section';
import { profilesSection } from './profiles-section';
import {
  languageSection,
  learningSection,
  packsSection,
  playSection,
  soundSection,
} from './settings-sections';
import type { ParentAreaDeps } from './types';
import { worldsSection } from './worlds-section';

export type { ParentAreaDeps, LanguageOption } from './types';

/** Grown-up settings. Text is fine here. Resolves when closed. */
export function openParentArea(deps: ParentAreaDeps): Promise<void> {
  return new Promise((resolve) => {
    const s = deps.getSettings();
    const body = h('div', { class: 'parent-area', 'data-testid': 'parent-area' }, [
      h('h1', {}, ['Grown-ups']),
      soundSection(s, deps.updateSettings),
      languageSection(deps, s),
      packsSection(deps, s),
      learningSection(deps, s),
      playSection(deps, s),
      profilesSection(deps),
      worldsSection(deps),
      installSection(deps),
      aboutSection(deps),
    ]);
    openOverlay(deps.ctx.overlayRoot, body, {
      className: 'parent-overlay',
      closeOnBackdrop: false,
      label: 'Grown-up settings',
      onClose: resolve,
    });
  });
}

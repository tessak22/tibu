import { h } from '../dom';
import { installGuide } from '../install-guide';
import { section, textButton } from './controls';
import type { ParentAreaDeps } from './types';
import type { PersistStatus } from '../../storage';

const STATUS_TEXT: Record<PersistStatus, string> = {
  persisted: 'Saved worlds are protected: the browser will not clear them automatically.',
  'not-persisted':
    'The browser may clear saved worlds if the device runs low on space. Adding Tibu to the Home Screen helps.',
  unsupported: 'This browser does not report storage protection. Export important worlds to keep a copy.',
};

export function installSection(deps: ParentAreaDeps): HTMLElement {
  const status = h('p', { class: 'hint', 'data-testid': 'persist-status' }, ['Checking storage…']);
  const show = (s: PersistStatus): void => {
    status.textContent = STATUS_TEXT[s];
  };
  void deps.persistStatus().then(show, () => show('unsupported'));
  return section('Install and storage', [
    installGuide(),
    status,
    textButton('Ask the browser to keep worlds', () => void deps.requestPersist().then(show, () => show('unsupported'))),
  ]);
}

const link = (href: string, text: string): HTMLElement =>
  h('a', { href, target: '_blank', rel: 'noopener noreferrer' }, [text]);

export function aboutSection(deps: ParentAreaDeps): HTMLElement {
  const base = deps.repoUrl.replace(/\/+$/, '');
  return section('About', [
    h('p', {}, [`Tibu ${deps.version}: a block world for tiny builders.`]),
    h('p', { class: 'hint' }, [
      'No accounts, ads, analytics or network use after loading. Worlds stay on this device. ',
      'Not affiliated with Minecraft or Mojang.',
    ]),
    h('ul', { class: 'links' }, [
      h('li', {}, [link(base, 'Source code')]),
      h('li', {}, [link(`${base}/blob/main/LICENSE`, 'License (MIT)')]),
      h('li', {}, [link(`${base}/blob/main/ASSETS.md`, 'Art, sound and voice licenses (ASSETS.md)')]),
    ]),
  ]);
}

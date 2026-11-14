import { h } from './dom';

const SHARE_ICON = `<svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true"><rect x="9" y="15" width="22" height="20" rx="3" fill="none" stroke="#1976d2" stroke-width="3"/><path d="M20 4v20M13 11l7-7 7 7" fill="none" stroke="#1976d2" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const ILLUSTRATION = `<svg viewBox="0 0 320 170" class="install-art" role="img" aria-label="Safari toolbar with the Share button, then Add to Home Screen">
  <rect x="4" y="4" width="312" height="44" rx="10" fill="#eceff1" stroke="#90a4ae" stroke-width="2"/>
  <rect x="70" y="14" width="150" height="24" rx="8" fill="#fff" stroke="#cfd8dc"/>
  <g transform="translate(244 8)"><rect width="36" height="36" rx="8" fill="#e3f2fd" stroke="#1976d2" stroke-width="2"/>
    <rect x="10" y="14" width="16" height="14" rx="2" fill="none" stroke="#1976d2" stroke-width="2.5"/>
    <path d="M18 5v15M13 10l5-5 5 5" fill="none" stroke="#1976d2" stroke-width="2.5" stroke-linecap="round"/></g>
  <path d="M262 50v26" stroke="#ff7043" stroke-width="4" stroke-linecap="round" marker-end="url(#a)"/>
  <defs><marker id="a" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><path d="M0 0 8 4 0 8Z" fill="#ff7043"/></marker></defs>
  <rect x="120" y="84" width="196" height="80" rx="12" fill="#fff" stroke="#90a4ae" stroke-width="2"/>
  <text x="136" y="112" font-family="sans-serif" font-size="14" fill="#90a4ae">Copy</text>
  <rect x="128" y="124" width="180" height="32" rx="8" fill="#fff3e0" stroke="#ff7043" stroke-width="2"/>
  <rect x="138" y="131" width="18" height="18" rx="4" fill="none" stroke="#37474f" stroke-width="2"/>
  <path d="M147 135v10M142 140h10" stroke="#37474f" stroke-width="2"/>
  <text x="164" y="145" font-family="sans-serif" font-size="14" fill="#37474f">Add to Home Screen</text>
</svg>`;

/** Step-by-step guide for adding Tibu to the iPad home screen (for adults). */
export function installGuide(): HTMLElement {
  return h('div', { class: 'install-guide' }, [
    h('div', { html: ILLUSTRATION }),
    h('ol', {}, [
      h('li', { html: `Open Tibu in <b>Safari</b> and tap the <b>Share</b> button ${SHARE_ICON} at the top.` }),
      h('li', { html: 'Scroll down and tap <b>Add to Home Screen</b>, then <b>Add</b>.' }),
      h('li', {}, ['Open Tibu from its new Home Screen icon. It then works offline and keeps worlds safer.']),
    ]),
  ]);
}

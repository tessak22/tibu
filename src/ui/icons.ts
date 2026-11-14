/** Inline SVG icons for the HUD. Original, simple, rounded shapes. */
const svg = (body: string, view = '0 0 64 64'): string =>
  `<svg viewBox="${view}" aria-hidden="true" focusable="false" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const ICONS = {
  block: svg(
    `<path d="M32 8 54 20 32 32 10 20Z" fill="#ffd27a"/>
     <path d="M10 20 32 32v24L10 44Z" fill="#f59a1b"/>
     <path d="M54 20 32 32v24l22-12Z" fill="#ffb84d"/>
     <path d="M32 8 54 20v24L32 56 10 44V20Z M10 20 32 32 54 20 M32 32v24" fill="none" stroke="#8a4b00" stroke-width="3"/>`,
  ),
  hammer: svg(
    `<rect x="29" y="24" width="8" height="34" rx="4" transform="rotate(-30 33 41)" fill="#c98a4b" stroke="#6b3d12" stroke-width="3"/>
     <rect x="12" y="8" width="34" height="18" rx="6" transform="rotate(-30 29 17)" fill="#8fa3b8" stroke="#3a4a5c" stroke-width="3"/>`,
  ),
  undo: svg(
    `<path d="M22 18 10 30l12 12" fill="none" stroke="#1d5fa8" stroke-width="7"/>
     <path d="M12 30h24a14 14 0 0 1 0 28h-8" fill="none" stroke="#1d5fa8" stroke-width="7"/>`,
  ),
  home: svg(
    `<path d="M8 32 32 10l24 22" fill="none" stroke="#2f7d32" stroke-width="6"/>
     <path d="M16 28v24h32V28" fill="#a5e08f" stroke="#2f7d32" stroke-width="5"/>
     <rect x="27" y="38" width="10" height="14" rx="3" fill="#2f7d32"/>`,
  ),
  gallery: svg(
    `<rect x="8" y="8" width="21" height="21" rx="5" fill="#ff8fa3"/><rect x="35" y="8" width="21" height="21" rx="5" fill="#7cc8ff"/>
     <rect x="8" y="35" width="21" height="21" rx="5" fill="#ffd166"/><rect x="35" y="35" width="21" height="21" rx="5" fill="#9be38a"/>`,
  ),
  camera: svg(
    `<path d="M8 22a6 6 0 0 1 6-6h8l4-6h12l4 6h8a6 6 0 0 1 6 6v24a6 6 0 0 1-6 6H14a6 6 0 0 1-6-6Z" fill="#5c6bc0" stroke="#283593" stroke-width="3"/>
     <circle cx="32" cy="34" r="11" fill="#e8eaf6" stroke="#283593" stroke-width="3"/><circle cx="32" cy="34" r="5" fill="#283593"/>`,
  ),
  sound: svg(
    `<path d="M10 26h10l12-10v32L20 38H10Z" fill="#ffb84d" stroke="#8a4b00" stroke-width="3"/>
     <path d="M40 24a11 11 0 0 1 0 16M46 18a19 19 0 0 1 0 28" fill="none" stroke="#8a4b00" stroke-width="4"/>`,
  ),
  muted: svg(
    `<path d="M10 26h10l12-10v32L20 38H10Z" fill="#cfd8dc" stroke="#546e7a" stroke-width="3"/>
     <path d="m40 24 16 16M56 24 40 40" stroke="#e53935" stroke-width="5"/>`,
  ),
  card: svg(
    `<rect x="12" y="6" width="40" height="52" rx="7" fill="#fff8e1" stroke="#ff8f00" stroke-width="4"/>
     <rect x="24" y="36" width="9" height="9" fill="#e53935"/><rect x="33" y="36" width="9" height="9" fill="#e53935"/>
     <rect x="28.5" y="27" width="9" height="9" fill="#e53935"/><path d="M26 18h12" stroke="#ff8f00" stroke-width="4"/>`,
  ),
  plus: svg(`<path d="M32 12v40M12 32h40" stroke="#fff" stroke-width="10"/>`),
  close: svg(`<path d="m18 18 28 28M46 18 18 46" stroke="#5d4037" stroke-width="8"/>`),
  check: svg(`<path d="m14 34 12 12 24-26" fill="none" stroke="#fff" stroke-width="8"/>`),
  backspace: svg(
    `<path d="M22 14h30a4 4 0 0 1 4 4v28a4 4 0 0 1-4 4H22L8 32Z" fill="#ffccbc" stroke="#bf360c" stroke-width="3"/>
     <path d="m30 24 16 16M46 24 30 40" stroke="#bf360c" stroke-width="5"/>`,
  ),
  parent: svg(
    `<circle cx="32" cy="32" r="22" fill="#eceff1" stroke="#78909c" stroke-width="4"/>
     <circle cx="24" cy="30" r="4" fill="#78909c"/><circle cx="40" cy="30" r="4" fill="#78909c"/>
     <path d="M24 40q8 6 16 0" fill="none" stroke="#78909c" stroke-width="4"/>`,
  ),
  packs: svg(
    `<rect x="6" y="6" width="24" height="24" rx="6" fill="#ff7043"/><rect x="34" y="6" width="24" height="24" rx="6" fill="#42a5f5"/>
     <rect x="6" y="34" width="24" height="24" rx="6" fill="#66bb6a"/><rect x="34" y="34" width="24" height="24" rx="6" fill="#ffca28"/>`,
  ),
  moon: svg(
    `<path d="M40 8a24 24 0 1 0 16 40A20 20 0 0 1 40 8Z" fill="#fff59d" stroke="#f9a825" stroke-width="3"/>
     <path d="M20 30q3 3 6 0M30 38q3 3 6 0" fill="none" stroke="#f9a825" stroke-width="3"/>`,
  ),
  save: svg(
    `<path d="M32 8v32M20 28l12 12 12-12" fill="none" stroke="#fff" stroke-width="7"/><path d="M12 46v6h40v-6" fill="none" stroke="#fff" stroke-width="7"/>`,
  ),
} as const;

export type IconName = keyof typeof ICONS;

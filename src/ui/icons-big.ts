/** Inline SVG icons for big-kid mode controls. Original, simple, rounded shapes. */
const svg = (body: string): string =>
  `<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

const foot = (x: number, y: number, flip: boolean): string => {
  const s = flip ? -1 : 1;
  return `<g transform="translate(${x} ${y}) scale(${s} 1)">
     <ellipse cx="0" cy="8" rx="7" ry="10" fill="#8d6e63" stroke="#4e342e" stroke-width="2.5"/>
     <circle cx="-5" cy="-6" r="2.6" fill="#8d6e63"/><circle cx="0" cy="-8" r="2.8" fill="#8d6e63"/>
     <circle cx="5" cy="-6" r="2.6" fill="#8d6e63"/></g>`;
};

export const BIG_ICONS = {
  /** Walk mode: two footprints. */
  feet: svg(`${foot(22, 36, false)}${foot(42, 22, true)}`),
  /** Step-by-step builds: a blue instruction sheet with a little stacked house. */
  blueprint: svg(
    `<rect x="8" y="8" width="48" height="48" rx="7" fill="#64b5f6" stroke="#0d47a1" stroke-width="3"/>
     <path d="M14 18h36M14 46h36M18 14v36M46 14v36" stroke="#bbdefb" stroke-width="1.5"/>
     <path d="M20 34 32 22l12 12" fill="none" stroke="#fff" stroke-width="4"/>
     <rect x="23" y="34" width="18" height="12" fill="none" stroke="#fff" stroke-width="4"/>
     <circle cx="50" cy="50" r="7" fill="#ffca28" stroke="#ff8f00" stroke-width="2"/>`,
  ),
  /** Sticker book: a closed book with a star sticker on the cover. */
  stickerBook: svg(
    `<rect x="12" y="6" width="40" height="52" rx="6" fill="#ab47bc" stroke="#4a148c" stroke-width="3"/>
     <rect x="12" y="6" width="8" height="52" rx="3" fill="#7b1fa2"/>
     <path d="m36 18 3.5 7 7.5 1-5.5 5.2 1.4 7.6-6.9-3.7-6.9 3.7 1.4-7.6-5.5-5.2 7.5-1Z" fill="#ffeb3b" stroke="#f57f17" stroke-width="2"/>`,
  ),
  /** Small "stop following this build" cross. */
  stop: svg(`<circle cx="32" cy="32" r="24" fill="#fff" stroke="#90a4ae" stroke-width="4"/>
     <path d="m22 22 20 20M42 22 22 42" stroke="#78909c" stroke-width="7"/>`),
} as const;

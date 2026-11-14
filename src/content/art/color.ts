/** Pure color helpers for hex colors (#rgb or #rrggbb). */

export interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

const FALLBACK: Rgb = { r: 200, g: 200, b: 208 };

export function parseHex(hex: string): Rgb {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return FALLBACK;
  const h = m[1].length === 3 ? [...m[1]].map((ch) => ch + ch).join('') : m[1];
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}

const clamp = (v: number): number => Math.max(0, Math.min(255, Math.round(v)));

export function toHex({ r, g, b }: Rgb): string {
  return `#${[r, g, b].map((v) => clamp(v).toString(16).padStart(2, '0')).join('')}`;
}

/** Linear mix: t = 0 gives a, t = 1 gives b. */
export function mix(a: string, b: string, t: number): string {
  const x = parseHex(a);
  const y = parseHex(b);
  return toHex({ r: x.r + (y.r - x.r) * t, g: x.g + (y.g - x.g) * t, b: x.b + (y.b - x.b) * t });
}

export const lighten = (hex: string, t: number): string => mix(hex, '#ffffff', t);

/** Darkens toward a warm deep tone rather than pure black, which keeps art soft. */
export const darken = (hex: string, t: number): string => mix(hex, '#2a1f33', t);

export function rgba(hex: string, alpha: number): string {
  const { r, g, b } = parseHex(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Relative brightness 0..1 (simple perceptual weights). */
export function luma(hex: string): number {
  const { r, g, b } = parseHex(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** A gentle contrasting tone of the same hue, for marks on a colored face. */
export function contrastTone(hex: string): string {
  return luma(hex) > 0.62 ? darken(hex, 0.38) : lighten(hex, 0.55);
}

/** Palm / accidental-touch rejection. Pure so it is unit testable. */
export const PALM_EDGE_PX = 24;
/**
 * Contact sizes above this (CSS px) are treated as a palm or a flat hand, but only while another
 * finger is already down. iPad Safari reports adult and older-kid fingertips well above 60px, so a
 * low threshold silently ignored grown-ups' taps; a single touch is never rejected for its size.
 */
export const PALM_CONTACT_PX = 180;

export interface PointerSample {
  readonly x: number;
  readonly y: number;
  readonly width?: number;
  readonly height?: number;
  readonly pointerType: string;
}

export interface Viewport {
  readonly width: number;
  readonly height: number;
}

export function isNearEdge(p: PointerSample, view: Viewport, margin = PALM_EDGE_PX): boolean {
  return p.x < margin || p.y < margin || p.x > view.width - margin || p.y > view.height - margin;
}

export function isPalmContact(p: PointerSample): boolean {
  if (p.pointerType !== 'touch') return false;
  return Math.max(p.width ?? 0, p.height ?? 0) > PALM_CONTACT_PX;
}

/** Whether a new pointer should be ignored entirely. */
export function shouldRejectPointer(p: PointerSample, view: Viewport, activePointers: number): boolean {
  if (p.pointerType !== 'touch' || activePointers === 0) return false;
  return isPalmContact(p) || isNearEdge(p, view);
}

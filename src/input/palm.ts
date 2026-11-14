/** Palm / accidental-touch rejection. Pure so it is unit testable. */
export const PALM_EDGE_PX = 24;
/** Contact sizes above this (CSS px) are treated as a palm or a flat hand. */
export const PALM_CONTACT_PX = 60;

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
  if (isPalmContact(p)) return true;
  return p.pointerType === 'touch' && activePointers > 0 && isNearEdge(p, view);
}

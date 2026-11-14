import { shouldRejectPointer, type PointerSample, type Viewport } from './palm';

/**
 * Movement (CSS px) after which a touch becomes a drag. CSS px are already DPR independent.
 * Adult and older-kid taps wobble more than a toddler's, and a wobble past a small threshold
 * turned their taps into drags that place nothing, so this is generous.
 */
export const DRAG_THRESHOLD_PX = 20;
/** Mice are precise; use a smaller threshold. */
export const MOUSE_DRAG_THRESHOLD_PX = 5;

export interface TrackedPointer extends PointerSample {
  readonly id: number;
}

export type GestureEvent =
  | { readonly type: 'press'; readonly x: number; readonly y: number }
  | { readonly type: 'pressCancel' }
  | { readonly type: 'tap'; readonly x: number; readonly y: number }
  | { readonly type: 'orbit'; readonly dx: number; readonly dy: number }
  /** scale > 1 means fingers moved apart (zoom in). */
  | { readonly type: 'pinch'; readonly scale: number }
  /** Two-finger drag: movement of the finger centroid in CSS px. */
  | { readonly type: 'pan'; readonly dx: number; readonly dy: number };

type Phase = 'idle' | 'pending' | 'drag' | 'multi';

interface Point {
  readonly x: number;
  readonly y: number;
}

/**
 * Turns raw pointer samples into high level gestures:
 * - a single touch that stays within the threshold and lifts is a tap;
 * - moving beyond the threshold turns it into an orbit drag (never a tap);
 * - any second finger makes the whole gesture a pinch (never a tap, even after lifting); moving
 *   both fingers together also pans (the view decides whether panning is allowed).
 * Rejected pointers (palm, edge while another finger is down) are ignored for their lifetime.
 */
export class GestureTracker {
  private phase: Phase = 'idle';
  private readonly points = new Map<number, Point>();
  private readonly ignored = new Set<number>();
  private start: Point = { x: 0, y: 0 };
  private last: Point = { x: 0, y: 0 };
  private pinchDistance = 0;
  private centroid: Point = { x: 0, y: 0 };
  private threshold = DRAG_THRESHOLD_PX;

  constructor(private readonly viewport: () => Viewport) {}

  activeCount(): number {
    return this.points.size;
  }

  down(p: TrackedPointer): GestureEvent[] {
    if (shouldRejectPointer(p, this.viewport(), this.points.size)) {
      this.ignored.add(p.id);
      return [];
    }
    this.points.set(p.id, { x: p.x, y: p.y });
    if (this.points.size === 1) {
      this.phase = 'pending';
      this.threshold = p.pointerType === 'mouse' ? MOUSE_DRAG_THRESHOLD_PX : DRAG_THRESHOLD_PX;
      this.start = { x: p.x, y: p.y };
      this.last = this.start;
      return [{ type: 'press', x: p.x, y: p.y }];
    }
    const wasPending = this.phase === 'pending';
    this.phase = 'multi';
    this.resetMulti();
    return wasPending ? [{ type: 'pressCancel' }] : [];
  }

  move(p: TrackedPointer): GestureEvent[] {
    if (this.ignored.has(p.id) || !this.points.has(p.id)) return [];
    this.points.set(p.id, { x: p.x, y: p.y });
    if (this.phase === 'multi') return this.pinchMove();
    if (this.phase === 'pending') {
      if (Math.hypot(p.x - this.start.x, p.y - this.start.y) <= this.threshold) return [];
      this.phase = 'drag';
      const events: GestureEvent[] = [{ type: 'pressCancel' }, { type: 'orbit', dx: p.x - this.last.x, dy: p.y - this.last.y }];
      this.last = { x: p.x, y: p.y };
      return events;
    }
    if (this.phase === 'drag') {
      const event: GestureEvent = { type: 'orbit', dx: p.x - this.last.x, dy: p.y - this.last.y };
      this.last = { x: p.x, y: p.y };
      return [event];
    }
    return [];
  }

  up(p: TrackedPointer): GestureEvent[] {
    if (this.ignored.delete(p.id)) return [];
    if (!this.points.delete(p.id)) return [];
    if (this.points.size > 0) {
      if (this.phase === 'multi') this.resetMulti();
      return [];
    }
    const wasPending = this.phase === 'pending';
    this.phase = 'idle';
    return wasPending ? [{ type: 'tap', x: p.x, y: p.y }] : [];
  }

  /** pointercancel / lost capture: drop the pointer, never tap. */
  cancel(id: number): GestureEvent[] {
    if (this.ignored.delete(id)) return [];
    if (!this.points.delete(id)) return [];
    const wasPending = this.phase === 'pending';
    if (this.points.size === 0) this.phase = 'idle';
    return wasPending ? [{ type: 'pressCancel' }] : [];
  }

  reset(): void {
    this.points.clear();
    this.ignored.clear();
    this.phase = 'idle';
  }

  private resetMulti(): void {
    this.pinchDistance = this.currentPinchDistance();
    this.centroid = this.currentCentroid();
  }

  private currentCentroid(): Point {
    const [a, b] = [...this.points.values()];
    return a && b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : { x: 0, y: 0 };
  }

  private currentPinchDistance(): number {
    const [a, b] = [...this.points.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }

  private pinchMove(): GestureEvent[] {
    if (this.points.size < 2) return [];
    const distance = this.currentPinchDistance();
    const previous = this.pinchDistance;
    this.pinchDistance = distance;
    const center = this.currentCentroid();
    const dx = center.x - this.centroid.x;
    const dy = center.y - this.centroid.y;
    this.centroid = center;
    const events: GestureEvent[] = [];
    if (previous >= 1 && distance >= 1) events.push({ type: 'pinch', scale: distance / previous });
    if (dx !== 0 || dy !== 0) events.push({ type: 'pan', dx, dy });
    return events;
  }
}

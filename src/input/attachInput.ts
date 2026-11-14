import { GestureTracker, type GestureEvent, type TrackedPointer } from './gestures';

export interface InputHandlers {
  /** Finger/mouse went down: show the target highlight. Coordinates are canvas-relative CSS px. */
  onPress(x: number, y: number): void;
  /** The press became a drag, pinch, or was cancelled: hide the highlight. */
  onPressCancel(): void;
  onTap(x: number, y: number): void;
  onOrbit(dx: number, dy: number): void;
  /** scale > 1 means zoom in. */
  onPinch(scale: number): void;
  /** Mouse hover (no buttons) for desktop highlight. */
  onHover?(x: number, y: number): void;
  onHoverEnd?(): void;
}

const WHEEL_ZOOM_PER_PIXEL = 0.0015;

/**
 * Binds Pointer Events on the canvas and blocks browser gestures (scrolling, pinch-zoom of the
 * page, pull-to-refresh, long-press menus, selection). Returns a detach function.
 */
export function attachInput(canvas: HTMLCanvasElement, handlers: InputHandlers): () => void {
  const tracker = new GestureTracker(() => ({ width: canvas.clientWidth, height: canvas.clientHeight }));
  const previousStyle = {
    touchAction: canvas.style.touchAction,
    userSelect: canvas.style.userSelect,
    webkitUserSelect: canvas.style.webkitUserSelect,
  };
  canvas.style.touchAction = 'none';
  canvas.style.userSelect = 'none';
  canvas.style.webkitUserSelect = 'none';
  canvas.style.setProperty('-webkit-touch-callout', 'none');
  canvas.style.setProperty('-webkit-tap-highlight-color', 'transparent');

  const toTracked = (e: PointerEvent): TrackedPointer => {
    const rect = canvas.getBoundingClientRect();
    return {
      id: e.pointerId,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      width: e.width,
      height: e.height,
      pointerType: e.pointerType,
    };
  };

  const dispatch = (events: readonly GestureEvent[]): void => {
    for (const ev of events) {
      switch (ev.type) {
        case 'press':
          handlers.onPress(ev.x, ev.y);
          break;
        case 'pressCancel':
          handlers.onPressCancel();
          break;
        case 'tap':
          handlers.onTap(ev.x, ev.y);
          break;
        case 'orbit':
          handlers.onOrbit(ev.dx, ev.dy);
          break;
        case 'pinch':
          handlers.onPinch(ev.scale);
          break;
      }
    }
  };

  const onDown = (e: PointerEvent): void => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      // Capture can fail for synthetic events; tracking still works without it.
    }
    dispatch(tracker.down(toTracked(e)));
  };
  const onMove = (e: PointerEvent): void => {
    if (tracker.activeCount() === 0 && e.pointerType === 'mouse') {
      const p = toTracked(e);
      handlers.onHover?.(p.x, p.y);
      return;
    }
    dispatch(tracker.move(toTracked(e)));
  };
  const onUp = (e: PointerEvent): void => dispatch(tracker.up(toTracked(e)));
  const onCancel = (e: PointerEvent): void => dispatch(tracker.cancel(e.pointerId));
  const onLeave = (e: PointerEvent): void => {
    if (e.pointerType === 'mouse' && tracker.activeCount() === 0) handlers.onHoverEnd?.();
  };
  const onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const pixels = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
    handlers.onPinch(Math.exp(-pixels * WHEEL_ZOOM_PER_PIXEL));
  };
  const prevent = (e: Event): void => e.preventDefault();

  const passiveFalse: AddEventListenerOptions = { passive: false };
  canvas.addEventListener('pointerdown', onDown, passiveFalse);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onCancel);
  canvas.addEventListener('lostpointercapture', onCancel);
  canvas.addEventListener('pointerleave', onLeave);
  canvas.addEventListener('wheel', onWheel, passiveFalse);
  canvas.addEventListener('touchstart', prevent, passiveFalse);
  canvas.addEventListener('touchmove', prevent, passiveFalse);
  canvas.addEventListener('contextmenu', prevent);
  canvas.addEventListener('selectstart', prevent);
  canvas.addEventListener('dblclick', prevent);
  canvas.addEventListener('gesturestart', prevent, passiveFalse);

  return () => {
    canvas.removeEventListener('pointerdown', onDown);
    canvas.removeEventListener('pointermove', onMove);
    canvas.removeEventListener('pointerup', onUp);
    canvas.removeEventListener('pointercancel', onCancel);
    canvas.removeEventListener('lostpointercapture', onCancel);
    canvas.removeEventListener('pointerleave', onLeave);
    canvas.removeEventListener('wheel', onWheel);
    canvas.removeEventListener('touchstart', prevent);
    canvas.removeEventListener('touchmove', prevent);
    canvas.removeEventListener('contextmenu', prevent);
    canvas.removeEventListener('selectstart', prevent);
    canvas.removeEventListener('dblclick', prevent);
    canvas.removeEventListener('gesturestart', prevent);
    canvas.style.touchAction = previousStyle.touchAction;
    canvas.style.userSelect = previousStyle.userSelect;
    canvas.style.webkitUserSelect = previousStyle.webkitUserSelect;
    tracker.reset();
  };
}

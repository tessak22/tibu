import type { CDPSession, Page } from '@playwright/test';

export interface Point {
  readonly x: number;
  readonly y: number;
}

/**
 * One-finger and two-finger input in viewport CSS pixels. Each driver produces real Pointer
 * Events with pointerType "touch" (or "mouse" for the desktop driver), which is what the app's
 * input code listens to.
 */
export interface TouchDriver {
  readonly kind: 'cdp-touch' | 'synthetic-touch' | 'mouse';
  tap(p: Point): Promise<void>;
  /** Finger down at `from`, moves in `steps` to `to`, then lifts. */
  drag(from: Point, to: Point, steps?: number): Promise<void>;
  /** Two fingers on a horizontal line through `center`, spreading from `startGap` to `endGap`. */
  pinch(center: Point, startGap: number, endGap: number, steps?: number): Promise<void>;
  /** Finger down and held; resolve the returned function to lift it. */
  press(p: Point): Promise<() => Promise<void>>;
}

const lerp = (a: Point, b: Point, t: number): Point => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

const pinchPoints = (c: Point, gap: number): [Point, Point] => [
  { x: c.x - gap / 2, y: c.y },
  { x: c.x + gap / 2, y: c.y },
];

/** Chromium: CDP Input.dispatchTouchEvent goes through the real touch -> pointer event pipeline. */
export async function cdpTouchDriver(page: Page): Promise<TouchDriver> {
  const cdp: CDPSession = await page.context().newCDPSession(page);
  type TouchType = 'touchStart' | 'touchMove' | 'touchEnd';
  const send = async (type: TouchType, points: readonly Point[]): Promise<void> => {
    await cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: points.map((p, i) => ({ x: p.x, y: p.y, id: i + 1, radiusX: 4, radiusY: 4, force: 1 })),
    });
  };
  return {
    kind: 'cdp-touch',
    async tap(p) {
      await send('touchStart', [p]);
      await send('touchEnd', []);
    },
    async drag(from, to, steps = 12) {
      await send('touchStart', [from]);
      for (let i = 1; i <= steps; i++) await send('touchMove', [lerp(from, to, i / steps)]);
      await send('touchEnd', []);
    },
    async pinch(center, startGap, endGap, steps = 12) {
      const [a0, b0] = pinchPoints(center, startGap);
      // Fingers rarely land at the exact same instant: one first, then both.
      await send('touchStart', [a0]);
      await send('touchStart', [a0, b0]);
      for (let i = 1; i <= steps; i++) {
        await send('touchMove', pinchPoints(center, startGap + ((endGap - startGap) * i) / steps));
      }
      const [a1] = pinchPoints(center, endGap);
      await send('touchEnd', [a1]);
      await send('touchEnd', []);
    },
    async press(p) {
      await send('touchStart', [p]);
      return async () => send('touchEnd', []);
    },
  };
}

/**
 * WebKit: Playwright cannot drive multi-touch there, so dispatch the same sequence of
 * PointerEvents (pointerType "touch") and TouchEvents an iPad produces. Every event of a
 * gesture goes to the element under the first contact, like implicit touch capture.
 */
export function syntheticTouchDriver(page: Page): TouchDriver {
  type Phase = 'down' | 'move' | 'up';
  const fire = async (phase: Phase, contacts: readonly { id: number; p: Point }[]): Promise<void> => {
    await page.evaluate(
      ({ phase, contacts }) => {
        type Contact = { id: number; p: { x: number; y: number } };
        const w = window as unknown as { __tibuTouchTargets?: Map<number, Element> };
        const targets = (w.__tibuTouchTargets ??= new Map<number, Element>());
        const pointerType = { down: 'pointerdown', move: 'pointermove', up: 'pointerup' } as const;
        const touchType = { down: 'touchstart', move: 'touchmove', up: 'touchend' } as const;
        for (const c of contacts as Contact[]) {
          if (phase === 'down') {
            const hit = document.elementFromPoint(c.p.x, c.p.y);
            if (hit) targets.set(c.id, hit);
          }
          const target = targets.get(c.id);
          if (!target) continue;
          const init: PointerEventInit = {
            bubbles: true,
            cancelable: true,
            composed: true,
            pointerId: 100 + c.id,
            pointerType: 'touch',
            isPrimary: c.id === 1,
            clientX: c.p.x,
            clientY: c.p.y,
            width: 8,
            height: 8,
            pressure: phase === 'up' ? 0 : 0.5,
            button: phase === 'move' ? -1 : 0,
            buttons: phase === 'up' ? 0 : 1,
          };
          target.dispatchEvent(new PointerEvent(pointerType[phase], init));
          if (typeof Touch === 'function' && typeof TouchEvent === 'function') {
            try {
              const touch = new Touch({ identifier: c.id, target, clientX: c.p.x, clientY: c.p.y });
              const list = phase === 'up' ? [] : [touch];
              target.dispatchEvent(
                new TouchEvent(touchType[phase], {
                  bubbles: true,
                  cancelable: true,
                  composed: true,
                  touches: list,
                  targetTouches: list,
                  changedTouches: [touch],
                }),
              );
            } catch {
              // Touch constructors are optional; the app listens to Pointer Events.
            }
          }
          if (phase === 'up') {
            targets.delete(c.id);
            if (target instanceof HTMLElement && document.elementFromPoint(c.p.x, c.p.y) === target) target.click();
          }
        }
      },
      { phase, contacts },
    );
  };
  const one = (p: Point): { id: number; p: Point }[] => [{ id: 1, p }];
  return {
    kind: 'synthetic-touch',
    async tap(p) {
      await fire('down', one(p));
      await fire('up', one(p));
    },
    async drag(from, to, steps = 12) {
      await fire('down', one(from));
      for (let i = 1; i <= steps; i++) await fire('move', one(lerp(from, to, i / steps)));
      await fire('up', one(to));
    },
    async pinch(center, startGap, endGap, steps = 12) {
      const at = (gap: number): { id: number; p: Point }[] =>
        pinchPoints(center, gap).map((p, i) => ({ id: i + 1, p }));
      await fire('down', at(startGap));
      for (let i = 1; i <= steps; i++) await fire('move', at(startGap + ((endGap - startGap) * i) / steps));
      await fire('up', at(endGap));
    },
    async press(p) {
      await fire('down', one(p));
      return async () => fire('up', one(p));
    },
  };
}

/** Desktop: a real mouse. Pinch maps to nothing here; desktop zoom is the wheel. */
export function mouseDriver(page: Page): TouchDriver {
  return {
    kind: 'mouse',
    async tap(p) {
      await page.mouse.click(p.x, p.y);
    },
    async drag(from, to, steps = 12) {
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      await page.mouse.move(to.x, to.y, { steps });
      await page.mouse.up();
    },
    async pinch() {
      throw new Error('pinch needs a touch driver');
    },
    async press(p) {
      await page.mouse.move(p.x, p.y);
      await page.mouse.down();
      return async () => page.mouse.up();
    },
  };
}

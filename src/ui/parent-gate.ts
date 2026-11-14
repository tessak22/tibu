import { h, isolatePointer, pulse } from './dom';
import { ICONS } from './icons';
import { openOverlay } from './overlay';

export const HOLD_MS = 3000;
const TICK_MS = 50;
const RING_R = 26;
const RING_LEN = 2 * Math.PI * RING_R;

export interface Sum {
  readonly a: number;
  readonly b: number;
  readonly answer: number;
}

/** A simple addition with a two-digit answer (e.g. 7 + 5), hard for a 4-year-old. */
export function makeSum(rand: () => number = Math.random): Sum {
  const pick = (): number => 3 + Math.floor(rand() * 7); // 3..9
  let a = pick();
  let b = pick();
  if (a + b < 10) b = 10 - a + Math.floor(rand() * 3);
  return { a, b, answer: a + b };
}

/** Number-pad sum question. Resolves true when answered correctly, false when closed. */
export function askParentSum(root: HTMLElement, rand: () => number = Math.random): Promise<boolean> {
  return new Promise((resolve) => {
    let sum = makeSum(rand);
    let entry = '';
    let solved = false;
    const question = h('div', { class: 'gate-question', 'aria-live': 'polite' });
    const display = h('div', { class: 'gate-display', 'data-testid': 'gate-display' });
    const render = (): void => {
      question.textContent = `${sum.a} + ${sum.b} = ?`;
      display.textContent = entry || ' ';
    };
    const submit = (): void => {
      if (Number(entry) === sum.answer && entry !== '') {
        solved = true;
        handle.close();
        return;
      }
      pulse(panelBody, 'shake');
      sum = makeSum(rand);
      entry = '';
      render();
    };
    const key = (label: string, onTap: () => void, cls = '', html?: string): HTMLButtonElement => {
      const b = h('button', { type: 'button', class: `pad-key ${cls}`.trim(), 'aria-label': label, 'data-key': label });
      if (html) b.innerHTML = html;
      else b.textContent = label;
      b.addEventListener('click', () => {
        pulse(b);
        onTap();
      });
      return b;
    };
    const pad = h('div', { class: 'gate-pad' });
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
      pad.append(key(String(n), () => {
        if (entry.length < 2) entry += String(n);
        render();
      }));
    }
    pad.append(
      key('delete', () => {
        entry = entry.slice(0, -1);
        render();
      }, 'pad-del', ICONS.backspace),
      key('0', () => {
        if (entry.length < 2 && entry !== '') entry += '0';
        render();
      }),
      key('ok', submit, 'pad-ok', ICONS.check),
    );
    const panelBody = h('div', { class: 'gate' }, [
      h('p', { class: 'gate-hint' }, ['For grown-ups']),
      question,
      display,
      pad,
    ]);
    render();
    const handle = openOverlay(root, panelBody, {
      className: 'gate-overlay',
      label: 'Grown-up check',
      onClose: () => resolve(solved),
    });
  });
}

export interface ParentCornerOptions {
  readonly overlayRoot: HTMLElement;
  /** Called after a 3 s hold and a correct answer. */
  readonly onUnlock: () => void;
  /** Soft feedback for a plain tap (wiggle + sound). */
  readonly onPlainTap?: () => void;
  readonly holdMs?: number;
  readonly rand?: () => number;
}

/** Small corner button: press and hold 3 s (progress ring), then answer a sum. */
export function createParentCorner(opts: ParentCornerOptions): HTMLButtonElement {
  const holdMs = opts.holdMs ?? HOLD_MS;
  const btn = h('button', { type: 'button', class: 'parent-corner', 'aria-label': 'Grown-ups: press and hold' });
  btn.innerHTML = `${ICONS.parent}<svg class="hold-ring" viewBox="0 0 60 60" aria-hidden="true"><circle cx="30" cy="30" r="${RING_R}" fill="none" stroke-width="6" stroke-dasharray="${RING_LEN}" stroke-dashoffset="${RING_LEN}"/></svg>`;
  const ring = btn.querySelector<SVGCircleElement>('.hold-ring circle');
  isolatePointer(btn);
  let timer: ReturnType<typeof setInterval> | null = null;
  let startedAt = 0;
  let busy = false;

  const setProgress = (p: number): void => {
    ring?.setAttribute('stroke-dashoffset', String(RING_LEN * (1 - Math.min(1, Math.max(0, p)))));
    btn.classList.toggle('holding', p > 0 && p < 1);
  };
  const stop = (completed: boolean): void => {
    if (timer === null) return;
    clearInterval(timer);
    timer = null;
    setProgress(0);
    if (!completed) {
      pulse(btn, 'wiggle');
      opts.onPlainTap?.();
    }
  };
  const complete = async (): Promise<void> => {
    stop(true);
    busy = true;
    try {
      if (await askParentSum(opts.overlayRoot, opts.rand)) opts.onUnlock();
    } finally {
      busy = false;
    }
  };

  btn.addEventListener('pointerdown', (e) => {
    if (busy || timer !== null) return;
    e.preventDefault();
    startedAt = Date.now();
    setProgress(0.001);
    timer = setInterval(() => {
      const p = (Date.now() - startedAt) / holdMs;
      setProgress(p);
      if (p >= 1) void complete();
    }, TICK_MS);
  });
  for (const type of ['pointerup', 'pointercancel', 'pointerleave'] as const) {
    btn.addEventListener(type, () => stop(false));
  }
  btn.addEventListener('contextmenu', (e) => e.preventDefault());
  return btn;
}

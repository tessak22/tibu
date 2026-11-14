type Attrs = Record<string, string | number | boolean | undefined>;
type Child = Node | string | null | undefined | false;

/** Tiny element builder. Attributes starting with "data-"/"aria-" and others are set verbatim. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  children: readonly Child[] = [],
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue;
    if (key === 'class') el.className = String(value);
    else if (key === 'html') el.innerHTML = String(value);
    else el.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    el.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return el;
}

/** Restarts a CSS animation class (e.g. "pop", "wiggle") on an element. */
export function pulse(el: Element, className: 'pop' | 'wiggle' | 'shake' = 'pop'): void {
  el.classList.remove('pop', 'wiggle', 'shake');
  // Force reflow so the animation restarts.
  void (el as HTMLElement).offsetWidth;
  el.classList.add(className);
  const done = (): void => el.classList.remove(className);
  el.addEventListener('animationend', done, { once: true });
  setTimeout(done, 700);
}

export interface IconButtonOptions {
  readonly icon: string | Node;
  readonly label: string;
  readonly className?: string;
  readonly onTap: (button: HTMLButtonElement) => void;
}

/** Large picture button with a built-in visible "pop" response. */
export function iconButton(opts: IconButtonOptions): HTMLButtonElement {
  const btn = h('button', { type: 'button', class: `icon-btn ${opts.className ?? ''}`.trim(), 'aria-label': opts.label });
  if (typeof opts.icon === 'string') btn.innerHTML = opts.icon;
  else btn.append(opts.icon);
  btn.addEventListener('click', () => {
    pulse(btn);
    opts.onTap(btn);
  });
  return btn;
}

/** Copies a canvas (which can only live in the DOM once) to a fresh canvas element. */
export function canvasCopy(source: HTMLCanvasElement, size?: number): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = size ?? source.width;
  out.height = size ?? source.height;
  const ctx = out.getContext('2d');
  if (ctx && source.width > 0 && source.height > 0) ctx.drawImage(source, 0, 0, out.width, out.height);
  out.className = 'pic';
  return out;
}

const POINTER_EVENTS = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'touchstart', 'touchmove', 'touchend', 'wheel'];

/** Stops pointer/touch events from bubbling to the game canvas or window listeners. */
export function isolatePointer(el: HTMLElement): void {
  for (const type of POINTER_EVENTS) {
    el.addEventListener(type, (e) => e.stopPropagation(), { passive: true });
  }
}

export function clear(el: Element): void {
  while (el.firstChild) el.removeChild(el.firstChild);
}

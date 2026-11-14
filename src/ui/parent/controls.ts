import { h } from '../dom';

let uid = 0;
const nextId = (): string => `pc-${++uid}`;

export function section(title: string, children: Node[]): HTMLElement {
  return h('section', { class: 'parent-section' }, [h('h2', {}, [title]), ...children]);
}

export function toggle(label: string, checked: boolean, onChange: (on: boolean) => void): HTMLElement {
  const id = nextId();
  const input = h('input', { type: 'checkbox', id, role: 'switch', checked });
  input.addEventListener('change', () => onChange(input.checked));
  return h('label', { class: 'field toggle', for: id }, [h('span', {}, [label]), input]);
}

export function slider(label: string, value: number, onChange: (v: number) => void): HTMLElement {
  const id = nextId();
  const input = h('input', { type: 'range', id, min: 0, max: 100, step: 5, value: Math.round(value * 100) });
  input.addEventListener('change', () => onChange(Number(input.value) / 100));
  return h('label', { class: 'field slider', for: id }, [h('span', {}, [label]), input]);
}

export interface Option<T> {
  readonly value: T;
  readonly label: string;
}

export function select<T>(label: string, options: readonly Option<T>[], current: T, onChange: (v: T) => void): HTMLElement {
  const id = nextId();
  const sel = h('select', { id });
  options.forEach((o, i) => sel.append(h('option', { value: i, selected: o.value === current }, [o.label])));
  sel.addEventListener('change', () => {
    const picked = options[Number(sel.value)];
    if (picked) onChange(picked.value);
  });
  return h('label', { class: 'field', for: id }, [h('span', {}, [label]), sel]);
}

export function textButton(label: string, onClick: () => void, cls = ''): HTMLButtonElement {
  const b = h('button', { type: 'button', class: `text-btn ${cls}`.trim() }, [label]);
  b.addEventListener('click', onClick);
  return b;
}

export function message(): { el: HTMLElement; show(text: string, kind?: 'error' | 'ok'): void } {
  const el = h('p', { class: 'parent-msg', role: 'alert', hidden: true });
  return {
    el,
    show(text, kind = 'error') {
      el.textContent = text;
      el.className = `parent-msg ${kind}`;
      el.hidden = text.length === 0;
    },
  };
}

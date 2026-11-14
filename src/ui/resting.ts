import { h, isolatePointer } from './dom';
import type { Screen } from './screen';

const SLEEPY_MOON = `<svg viewBox="0 0 240 240" class="sleepy-moon" aria-hidden="true">
  <circle cx="120" cy="120" r="110" fill="#3949ab" opacity=".35"/>
  <path d="M150 30a90 90 0 1 0 60 150A76 76 0 0 1 150 30Z" fill="#fff59d" stroke="#fbc02d" stroke-width="5"/>
  <path d="M86 112q10 10 20 0M126 132q10 10 20 0" fill="none" stroke="#f9a825" stroke-width="5" stroke-linecap="round"/>
  <circle cx="98" cy="146" r="9" fill="#ffab91" opacity=".7"/>
  <text x="170" y="70" font-size="30" fill="#fff" font-family="sans-serif" font-weight="700">z</text>
  <text x="192" y="44" font-size="22" fill="#fff" font-family="sans-serif" font-weight="700">z</text>
  <circle cx="40" cy="50" r="4" fill="#fff"/><circle cx="210" cy="190" r="3" fill="#fff"/><circle cx="60" cy="200" r="3" fill="#fff"/>
</svg>`;

/**
 * Calm resting screen shown when the play timer ends. Only the parent corner
 * (hold + sum) leaves it, so a child cannot tap past it.
 */
export function createRestingScreen(corner: HTMLElement): Screen {
  const art = h('div', { class: 'resting-art', html: SLEEPY_MOON });
  const el = h('div', { class: 'screen resting-screen', 'data-testid': 'resting' }, [art, corner]);
  isolatePointer(el);
  el.addEventListener('click', () => {
    art.classList.remove('breathe');
    void art.offsetWidth;
    art.classList.add('breathe');
  });
  return { el, dispose: () => el.remove() };
}

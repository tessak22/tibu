import { clear, h, iconButton, isolatePointer } from './dom';
import { BIG_ICONS } from './icons-big';

export interface BuildSteps {
  readonly el: HTMLElement;
  /** Shows the build picture and one dot per step (done, current, to do). */
  show(picture: HTMLCanvasElement | null, stepIndex: number, stepCount: number): void;
  hide(): void;
}

/**
 * Step indicator for a step-by-step build: the build's picture, a row of dots and a small
 * "x" to stop following the build at any time (no consequence: built blocks stay).
 */
export function createBuildSteps(onStop: () => void): BuildSteps {
  const pic = h('div', { class: 'build-steps-pic' });
  const dots = h('div', { class: 'build-steps-dots', role: 'img' });
  const stop = iconButton({ icon: BIG_ICONS.stop, label: 'Stop this build', className: 'build-steps-stop', onTap: onStop });
  stop.dataset.testid = 'blueprint-stop';
  const el = h('div', { class: 'hud-group hud-top-center build-steps', 'data-testid': 'blueprint-steps', hidden: true }, [
    pic,
    dots,
    stop,
  ]);
  isolatePointer(el);
  let shownPicture: HTMLCanvasElement | null = null;

  return {
    el,
    show(picture, stepIndex, stepCount) {
      if (picture !== shownPicture) {
        clear(pic);
        if (picture) {
          picture.classList.add('pic');
          pic.append(picture);
        }
        shownPicture = picture;
      }
      clear(dots);
      const count = Math.max(0, Math.floor(stepCount));
      for (let i = 0; i < count; i++) {
        const state = i < stepIndex ? 'done' : i === stepIndex ? 'current' : 'todo';
        dots.append(h('span', { class: `build-dot ${state}` }));
      }
      dots.setAttribute('aria-label', `Step ${Math.min(stepIndex + 1, count)} of ${count}`);
      el.dataset.step = String(stepIndex);
      el.dataset.steps = String(count);
      el.hidden = false;
    },
    hide() {
      el.hidden = true;
      clear(pic);
      clear(dots);
      shownPicture = null;
    },
  };
}

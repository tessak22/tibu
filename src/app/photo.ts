import type { AudioSystem, GameView } from '../core/types';
import { h, iconButton } from '../ui/dom';
import { ICONS } from '../ui/icons';
import { openOverlay, toast } from '../ui/overlay';
import { PHOTO_MAX_EDGE } from './config';
import { photoFileName, shareOrDownload } from './share';

const SHUTTER_PRESET = 'knock';
const PHOTO_ERROR = 'The picture could not be saved on this device.';

function photoSize(): { width: number; height: number } {
  const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
  let width = Math.max(320, Math.round(window.innerWidth * dpr));
  let height = Math.max(240, Math.round(window.innerHeight * dpr));
  const scale = Math.min(1, PHOTO_MAX_EDGE / Math.max(width, height));
  width = Math.round(width * scale);
  height = Math.round(height * scale);
  return { width, height };
}

function flash(root: HTMLElement): void {
  const el = h('div', { class: 'flash', 'aria-hidden': 'true' });
  root.append(el);
  el.addEventListener('animationend', () => el.remove(), { once: true });
  setTimeout(() => el.remove(), 1000);
}

/** iOS can drop the tap "permission" while the snapshot renders: offer a second tap to save. */
function offerSave(root: HTMLElement, blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const img = h('img', { src: url, alt: '', class: 'photo-preview', draggable: 'false' });
  const save = iconButton({
    icon: ICONS.save,
    label: 'Save picture',
    className: 'photo-save',
    onTap: () => {
      void shareOrDownload(blob, name).then((outcome) => {
        if (outcome === 'needs-gesture') toast(root, PHOTO_ERROR);
        else handle.close();
      });
    },
  });
  const handle = openOverlay(root, h('div', { class: 'photo-offer' }, [img, save]), {
    className: 'photo-overlay',
    label: 'Your picture',
    onClose: () => URL.revokeObjectURL(url),
  });
}

/** Photo button: flash + shutter sound, then save the current view as a PNG. */
export async function takePhoto(view: GameView, audio: AudioSystem, root: HTMLElement): Promise<void> {
  flash(root);
  // Shutter: a short synthesized click.
  audio.play({ type: 'synth', preset: SHUTTER_PRESET });
  void audio.speak('photo');
  try {
    const blob = await view.snapshot(photoSize());
    const name = photoFileName();
    const outcome = await shareOrDownload(blob, name);
    if (outcome === 'needs-gesture') offerSave(root, blob, name);
  } catch {
    toast(root, PHOTO_ERROR);
  }
}

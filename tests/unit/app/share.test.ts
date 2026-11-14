// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { photoFileName, shareOrDownload } from '../../../src/app/share';

const blob = new Blob(['x'], { type: 'image/png' });

const named = (name: string): Error => Object.assign(new Error(name), { name });

describe('shareOrDownload', () => {
  it('uses the Web Share API with files when possible', async () => {
    const share = vi.fn(async () => undefined);
    const out = await shareOrDownload(blob, 'a.png', { canShare: () => true, share });
    expect(out).toBe('shared');
    expect(share).toHaveBeenCalledWith({ files: [expect.any(File)] });
  });

  it('treats a cancelled share sheet as cancelled', async () => {
    const share = vi.fn(async () => Promise.reject(named('AbortError')));
    expect(await shareOrDownload(blob, 'a.png', { canShare: () => true, share })).toBe('cancelled');
  });

  it('asks for another tap when the gesture expired', async () => {
    const share = vi.fn(async () => Promise.reject(named('NotAllowedError')));
    expect(await shareOrDownload(blob, 'a.png', { canShare: () => true, share })).toBe('needs-gesture');
  });

  it('falls back to a download link', async () => {
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    expect(await shareOrDownload(blob, 'a.png', {})).toBe('downloaded');
    expect(click).toHaveBeenCalled();
    click.mockRestore();
  });
});

describe('photoFileName', () => {
  it('is a dated png name', () => {
    expect(photoFileName(new Date(2026, 0, 2, 3, 4, 5))).toBe('tibu-2026-01-02-030405.png');
  });
});

export type ShareOutcome = 'shared' | 'downloaded' | 'cancelled' | 'needs-gesture';

interface ShareNav {
  canShare?: (data: ShareData) => boolean;
  share?: (data: ShareData) => Promise<void>;
}

/** Triggers a classic download link (fallback when Web Share with files is unavailable). */
export function downloadBlob(blob: Blob, fileName: string, doc: Document = document): void {
  const url = URL.createObjectURL(blob);
  const a = doc.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  a.style.display = 'none';
  doc.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Saves a file to the device: Web Share with files when available (iPad "Save Image"),
 * otherwise a download. Never throws.
 */
export async function shareOrDownload(
  blob: Blob,
  fileName: string,
  nav: ShareNav = navigator as ShareNav,
  doc: Document = document,
): Promise<ShareOutcome> {
  const file = new File([blob], fileName, { type: blob.type });
  const data: ShareData = { files: [file] };
  let canShare = false;
  try {
    canShare = typeof nav.share === 'function' && typeof nav.canShare === 'function' && nav.canShare(data);
  } catch {
    canShare = false;
  }
  if (canShare && nav.share) {
    try {
      await nav.share(data);
      return 'shared';
    } catch (e) {
      const name = e instanceof Error ? e.name : '';
      if (name === 'AbortError') return 'cancelled';
      if (name === 'NotAllowedError') return 'needs-gesture';
      // Any other share failure: fall back to a download.
    }
  }
  try {
    downloadBlob(blob, fileName, doc);
    return 'downloaded';
  } catch {
    return 'needs-gesture';
  }
}

export function photoFileName(date: Date = new Date()): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `tibu-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}.png`;
}

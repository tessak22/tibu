import type { WorldRecord } from '../core/types';
import { buildExportFile, exportFileName, serializeExport } from '../storage';
import { shareOrDownload } from './share';

/** Saves a world as a .tibu.json file (share sheet on iPad, download elsewhere). */
export async function exportWorldFile(record: WorldRecord): Promise<void> {
  const text = serializeExport(buildExportFile(record));
  const blob = new Blob([text], { type: 'application/json' });
  const outcome = await shareOrDownload(blob, exportFileName(record.name));
  if (outcome === 'needs-gesture') throw new Error('Export could not start');
}

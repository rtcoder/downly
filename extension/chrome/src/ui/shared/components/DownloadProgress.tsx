import type { ActiveDownloadMetrics } from '../../../application/active-download-sampler';
import type { DownloadRecord } from '../../../domain/downloads/types';
import { formatBytes, formatEta, formatSpeed } from '../formatters';
import { displayFilename, progressPercent } from './download-helpers';

export interface DownloadProgressProps {
  download: DownloadRecord;
  metrics?: ActiveDownloadMetrics | null;
}

export function DownloadProgress({ download, metrics }: DownloadProgressProps) {
  const matchingMetrics = metrics?.downloadId === download.id ? metrics : null;
  const percent = progressPercent(download);
  const totalLabel = download.totalBytes > 0 ? formatBytes(download.totalBytes) : formatBytes(download.fileSize);
  const progressText = `${formatBytes(download.bytesReceived)} of ${totalLabel}`;

  return <div>
    <div
      aria-label={`Download progress for ${displayFilename(download)}`}
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={percent ?? undefined}
      role="progressbar"
    />
    <span>{progressText}</span>
    {download.state === 'in_progress' ? <span>{formatSpeed(matchingMetrics?.bytesPerSecond)}</span> : null}
    {download.state === 'in_progress' ? <span>{formatEta(matchingMetrics?.etaSeconds)}</span> : null}
  </div>;
}

import type {ActiveDownloadMetrics} from '../../../application/active-download-sampler';
import type {DownloadRecord} from '../../../domain/downloads/types';
import {formatBytes, formatEta, formatSpeed} from '../formatters';
import {t} from '../i18n';
import {bestKnownDownloadSize, displayFilename, progressPercent} from './download-helpers';

export interface DownloadProgressProps {
  download: DownloadRecord;
  metrics?: ActiveDownloadMetrics | null;
}

export function DownloadProgress({download, metrics}: DownloadProgressProps) {
  const matchingMetrics = metrics?.downloadId === download.id ? metrics : null;
  const percent = progressPercent(download);
  const isActive = download.state === 'in_progress';
  const sizeText = formatBytes(bestKnownDownloadSize(download));

  return <div>
    {isActive ? <div
      aria-label={t('shared.downloadProgress.label', {filename: displayFilename(download)})}
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={percent ?? undefined}
      aria-valuetext={sizeText}
      role="progressbar"
    /> : null}
    <span>{sizeText}</span>
    {isActive ? <span>{formatSpeed(matchingMetrics?.bytesPerSecond)}</span> : null}
    {isActive ? <span>{formatEta(matchingMetrics?.etaSeconds)}</span> : null}
  </div>;
}

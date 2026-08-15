import type {ActiveDownloadMetrics} from '../../../application/active-download-sampler';
import type {DownloadRecord} from '../../../domain/downloads/types';
import {t} from '../i18n';

export interface DownloadComponentProps {
  download: DownloadRecord;
  metrics?: ActiveDownloadMetrics | null;
}

export function displayFilename(download: DownloadRecord): string {
  if (download.extension) {
    return `${download.basename}.${download.extension}`;
  }

  return download.basename || download.filename || t('shared.download.fallbackName', {id: download.id});
}

export function progressPercent(download: DownloadRecord): number | null {
  if (download.state === 'complete') {
    return 100;
  }

  if (download.totalBytes <= 0) {
    return null;
  }

  return Math.max(0, Math.min(100, Math.round((download.bytesReceived / download.totalBytes) * 100)));
}

export function bestKnownDownloadSize(download: DownloadRecord): number | null {
  if (download.fileSize > 0) {
    return download.fileSize;
  }

  if (download.totalBytes > 0) {
    return download.totalBytes;
  }

  if (download.bytesReceived > 0) {
    return download.bytesReceived;
  }

  return null;
}

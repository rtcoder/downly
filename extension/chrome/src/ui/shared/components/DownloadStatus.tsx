import type { DownloadRecord } from '../../../domain/downloads/types';
import { t } from '../i18n';

export interface DownloadStatusProps {
  download: DownloadRecord;
}

export function DownloadStatus({ download }: DownloadStatusProps) {
  const status = statusText(download);

  return <div aria-label={t('shared.downloadStatus.label', { status })}>
    <span>{status}</span>
    {download.paused ? <span>{t('shared.downloadStatus.paused')}</span> : null}
    {download.error ? <span>{download.error}</span> : null}
  </div>;
}

function statusText(download: DownloadRecord): string {
  if (!download.exists && download.state === 'complete') {
    return t('shared.downloadStatus.missingFile');
  }

  if (download.state === 'complete') {
    return t('shared.downloadStatus.complete');
  }

  if (download.state === 'interrupted') {
    return t('shared.downloadStatus.interrupted');
  }

  return t('shared.downloadStatus.inProgress');
}

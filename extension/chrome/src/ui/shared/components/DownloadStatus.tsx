import type { DownloadRecord } from '../../../domain/downloads/types';

export interface DownloadStatusProps {
  download: DownloadRecord;
}

export function DownloadStatus({ download }: DownloadStatusProps) {
  const status = statusText(download);

  return <div aria-label={`Status: ${status}`}>
    <span>{status}</span>
    {download.paused ? <span>Paused</span> : null}
    {download.error ? <span>{download.error}</span> : null}
  </div>;
}

function statusText(download: DownloadRecord): string {
  if (!download.exists && download.state === 'complete') {
    return 'Missing file';
  }

  if (download.state === 'complete') {
    return 'Complete';
  }

  if (download.state === 'interrupted') {
    return 'Interrupted';
  }

  return 'In progress';
}

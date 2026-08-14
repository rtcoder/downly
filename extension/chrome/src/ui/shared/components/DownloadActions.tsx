import type { DownloadRecord } from '../../../domain/downloads/types';
import { displayFilename } from './download-helpers';

export interface DownloadActionsProps {
  download: DownloadRecord;
  onCancel?: (downloadId: number) => void;
  onOpen?: (downloadId: number) => void;
  onRemove?: (downloadId: number) => void;
  onResume?: (downloadId: number) => void;
  onRetry?: (downloadId: number) => void;
  onShowInFolder?: (downloadId: number) => void;
}

export function DownloadActions({
  download,
  onCancel,
  onOpen,
  onRemove,
  onResume,
  onRetry,
  onShowInFolder,
}: DownloadActionsProps) {
  const filename = displayFilename(download);

  return <div aria-label={`Actions for ${filename}`}>
    {download.state === 'in_progress' && onCancel ? (
      <button type="button" onClick={() => onCancel(download.id)} aria-label={`Cancel ${filename}`}>Cancel</button>
    ) : null}
    {download.state === 'interrupted' && download.canResume && onResume ? (
      <button type="button" onClick={() => onResume(download.id)} aria-label={`Resume ${filename}`}>Resume</button>
    ) : null}
    {download.state === 'interrupted' && !download.canResume && onRetry ? (
      <button type="button" onClick={() => onRetry(download.id)} aria-label={`Retry ${filename}`}>Retry</button>
    ) : null}
    {download.state === 'complete' && download.exists && onOpen ? (
      <button type="button" onClick={() => onOpen(download.id)} aria-label={`Open ${filename}`}>Open</button>
    ) : null}
    {download.exists && onShowInFolder ? (
      <button type="button" onClick={() => onShowInFolder(download.id)} aria-label={`Show ${filename} in folder`}>
        Show in folder
      </button>
    ) : null}
    {onRemove ? (
      <button type="button" onClick={() => onRemove(download.id)} aria-label={`Remove ${filename}`}>Remove</button>
    ) : null}
  </div>;
}

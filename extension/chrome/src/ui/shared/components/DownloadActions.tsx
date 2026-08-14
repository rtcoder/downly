import { useState } from 'react';

import { getDownloadActionAvailability } from '../../../application/download-actions';
import type { DownloadRecord } from '../../../domain/downloads/types';
import { ConfirmDialog } from './ConfirmDialog';
import { displayFilename } from './download-helpers';

export interface DownloadActionsProps {
  download: DownloadRecord;
  onCancel?: (downloadId: number) => void;
  onCopyFinalUrl?: (downloadId: number) => void;
  onCopySourceUrl?: (downloadId: number) => void;
  onDownloadAgain?: (downloadId: number) => void;
  onEraseHistory?: (downloadId: number) => void;
  onOpen?: (downloadId: number) => void;
  onPause?: (downloadId: number) => void;
  onRemoveFile?: (downloadId: number) => void;
  onResume?: (downloadId: number) => void;
  onRetry?: (downloadId: number) => void;
  onShowInFolder?: (downloadId: number) => void;
}

type PendingConfirmation = 'erase-history' | 'remove-file' | null;

export function DownloadActions({
  download,
  onCancel,
  onCopyFinalUrl,
  onCopySourceUrl,
  onDownloadAgain,
  onEraseHistory,
  onOpen,
  onPause,
  onRemoveFile,
  onResume,
  onRetry,
  onShowInFolder,
}: DownloadActionsProps) {
  const filename = displayFilename(download);
  const availability = getDownloadActionAvailability(download);
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation>(null);

  const confirm = (): void => {
    if (pendingConfirmation === 'erase-history') {
      onEraseHistory?.(download.id);
    }

    if (pendingConfirmation === 'remove-file') {
      onRemoveFile?.(download.id);
    }

    setPendingConfirmation(null);
  };

  return <>
    <div aria-label={`Actions for ${filename}`}>
    {availability.canPause && onPause ? (
      <button type="button" onClick={() => onPause(download.id)} aria-label={`Pause ${filename}`}>Pause</button>
    ) : null}
    {availability.canResume && onResume ? (
      <button type="button" onClick={() => onResume(download.id)} aria-label={`Resume ${filename}`}>Resume</button>
    ) : null}
    {availability.canCancel && onCancel ? (
      <button type="button" onClick={() => onCancel(download.id)} aria-label={`Cancel ${filename}`}>Cancel</button>
    ) : null}
    {availability.canRetry && !download.canResume && onRetry ? (
      <button type="button" onClick={() => onRetry(download.id)} aria-label={`Retry ${filename}`}>Retry</button>
    ) : null}
    {availability.canDownloadAgain && onDownloadAgain ? (
      <button type="button" onClick={() => onDownloadAgain(download.id)} aria-label={`Download ${filename} again`}>
        Download again
      </button>
    ) : null}
    {availability.canOpen && onOpen ? (
      <button type="button" onClick={() => onOpen(download.id)} aria-label={`Open ${filename}`}>Open</button>
    ) : null}
    {availability.canShowInFolder && onShowInFolder ? (
      <button type="button" onClick={() => onShowInFolder(download.id)} aria-label={`Show ${filename} in folder`}>
        Show in folder
      </button>
    ) : null}
    {availability.canCopySourceUrl && onCopySourceUrl ? (
      <button type="button" onClick={() => onCopySourceUrl(download.id)} aria-label={`Copy source URL for ${filename}`}>
        Copy source URL
      </button>
    ) : null}
    {availability.canCopyFinalUrl && onCopyFinalUrl ? (
      <button type="button" onClick={() => onCopyFinalUrl(download.id)} aria-label={`Copy final URL for ${filename}`}>
        Copy final URL
      </button>
    ) : null}
    {availability.canEraseHistory && onEraseHistory ? (
      <button
        type="button"
        onClick={() => setPendingConfirmation('erase-history')}
        aria-label={`Remove ${filename} from history`}
      >
        Remove from history
      </button>
    ) : null}
    {availability.canRemoveFile && onRemoveFile ? (
      <button
        type="button"
        onClick={() => setPendingConfirmation('remove-file')}
        aria-label={`Delete file ${filename}`}
      >
        Delete file
      </button>
    ) : null}
    </div>
    <ConfirmDialog
      open={pendingConfirmation === 'erase-history'}
      title={`Remove ${filename} from history?`}
      description="This removes the entry from Chrome download history. The file stays on disk."
      confirmLabel="Remove from history"
      onConfirm={confirm}
      onCancel={() => setPendingConfirmation(null)}
    />
    <ConfirmDialog
      open={pendingConfirmation === 'remove-file'}
      title={`Delete ${filename} from disk?`}
      description="This deletes the downloaded file from disk. The history entry remains unless you remove it separately."
      confirmLabel="Delete file"
      onConfirm={confirm}
      onCancel={() => setPendingConfirmation(null)}
    />
  </>;
}

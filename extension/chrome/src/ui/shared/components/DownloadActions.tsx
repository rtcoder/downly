import { type ReactNode, useState } from 'react';

import { getDownloadActionAvailability } from '../../../application/download-actions';
import type { DownloadRecord } from '../../../domain/downloads/types';
import { t } from '../i18n';
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
type DownloadActionIconName =
  | 'cancel'
  | 'copy'
  | 'delete'
  | 'download'
  | 'folder'
  | 'history'
  | 'open'
  | 'pause'
  | 'resume'
  | 'retry';

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
    <div aria-label={t('shared.downloadActions.actionsFor', { filename })} className="download-actions" role="toolbar">
    {availability.canPause && onPause ? (
      <DownloadActionButton icon="pause" label={t('shared.downloadActions.pauseLabel', { filename })} onClick={() => onPause(download.id)} />
    ) : null}
    {availability.canResume && onResume ? (
      <DownloadActionButton icon="resume" label={t('shared.downloadActions.resumeLabel', { filename })} onClick={() => onResume(download.id)} />
    ) : null}
    {availability.canCancel && onCancel ? (
      <DownloadActionButton icon="cancel" label={t('shared.downloadActions.cancelLabel', { filename })} onClick={() => onCancel(download.id)} />
    ) : null}
    {availability.canRetry && !download.canResume && onRetry ? (
      <DownloadActionButton icon="retry" label={t('shared.downloadActions.retryLabel', { filename })} onClick={() => onRetry(download.id)} />
    ) : null}
    {availability.canDownloadAgain && onDownloadAgain ? (
      <DownloadActionButton icon="download" label={t('shared.downloadActions.downloadAgainLabel', { filename })} onClick={() => onDownloadAgain(download.id)} />
    ) : null}
    {availability.canOpen && onOpen ? (
      <DownloadActionButton icon="open" label={t('shared.downloadActions.openLabel', { filename })} onClick={() => onOpen(download.id)} />
    ) : null}
    {availability.canShowInFolder && onShowInFolder ? (
      <DownloadActionButton icon="folder" label={t('shared.downloadActions.showInFolderLabel', { filename })} onClick={() => onShowInFolder(download.id)} />
    ) : null}
    {availability.canCopySourceUrl && onCopySourceUrl ? (
      <DownloadActionButton icon="copy" label={t('shared.downloadActions.copySourceUrlLabel', { filename })} onClick={() => onCopySourceUrl(download.id)} />
    ) : null}
    {availability.canCopyFinalUrl && onCopyFinalUrl ? (
      <DownloadActionButton icon="copy" label={t('shared.downloadActions.copyFinalUrlLabel', { filename })} onClick={() => onCopyFinalUrl(download.id)} />
    ) : null}
    {availability.canEraseHistory && onEraseHistory ? (
      <DownloadActionButton icon="history" label={t('shared.downloadActions.removeFromHistoryLabel', { filename })} onClick={() => setPendingConfirmation('erase-history')} />
    ) : null}
    {availability.canRemoveFile && onRemoveFile ? (
      <DownloadActionButton icon="delete" label={t('shared.downloadActions.deleteFileLabel', { filename })} onClick={() => setPendingConfirmation('remove-file')} />
    ) : null}
    </div>
    <ConfirmDialog
      open={pendingConfirmation === 'erase-history'}
      title={t('shared.downloadActions.removeHistoryTitle', { filename })}
      description={t('shared.downloadActions.removeHistoryDescription')}
      confirmLabel={t('shared.downloadActions.removeFromHistory')}
      onConfirm={confirm}
      onCancel={() => setPendingConfirmation(null)}
    />
    <ConfirmDialog
      open={pendingConfirmation === 'remove-file'}
      title={t('shared.downloadActions.deleteFileTitle', { filename })}
      description={t('shared.downloadActions.deleteFileDescription')}
      confirmLabel={t('shared.downloadActions.deleteFile')}
      onConfirm={confirm}
      onCancel={() => setPendingConfirmation(null)}
    />
  </>;
}

function DownloadActionButton({
  icon,
  label,
  onClick,
}: {
  icon: DownloadActionIconName;
  label: string;
  onClick: () => void;
}) {
  return <button aria-label={label} className="download-action-button" onClick={onClick} title={label} type="button">
    <DownloadActionIcon name={icon} />
  </button>;
}

function DownloadActionIcon({ name }: { name: DownloadActionIconName }) {
  return <svg aria-hidden="true" focusable="false" role="img" viewBox="0 0 24 24">
    {iconPaths[name]}
  </svg>;
}

const iconPaths: Record<DownloadActionIconName, ReactNode> = {
  cancel: <path d="M6 6l12 12M18 6L6 18" />,
  copy: <>
    <rect x="8" y="8" width="10" height="10" rx="2" />
    <path d="M6 14H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v1" />
  </>,
  delete: <>
    <path d="M4 7h16" />
    <path d="M10 11v6M14 11v6" />
    <path d="M6 7l1 14h10l1-14" />
    <path d="M9 7V4h6v3" />
  </>,
  download: <>
    <path d="M12 4v10" />
    <path d="M8 10l4 4 4-4" />
    <path d="M5 20h14" />
  </>,
  folder: <>
    <path d="M3 7h7l2 2h9v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <path d="M3 7V5a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v2" />
  </>,
  history: <>
    <path d="M4 5h12a3 3 0 0 1 0 6H8" />
    <path d="M8 8l-4 3 4 3" />
    <path d="M15 15l5 5M20 15l-5 5" />
  </>,
  open: <>
    <path d="M14 4h6v6" />
    <path d="M20 4l-9 9" />
    <path d="M11 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-5" />
  </>,
  pause: <>
    <path d="M8 5v14" />
    <path d="M16 5v14" />
  </>,
  resume: <path d="M8 5v14l11-7z" />,
  retry: <>
    <path d="M20 12a8 8 0 1 1-2.35-5.65" />
    <path d="M20 4v6h-6" />
  </>,
};

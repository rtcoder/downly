import { useState } from 'react';

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
    <div aria-label={t('shared.downloadActions.actionsFor', { filename })}>
    {availability.canPause && onPause ? (
      <button type="button" onClick={() => onPause(download.id)} aria-label={t('shared.downloadActions.pauseLabel', { filename })}>{t('shared.downloadActions.pause')}</button>
    ) : null}
    {availability.canResume && onResume ? (
      <button type="button" onClick={() => onResume(download.id)} aria-label={t('shared.downloadActions.resumeLabel', { filename })}>{t('shared.downloadActions.resume')}</button>
    ) : null}
    {availability.canCancel && onCancel ? (
      <button type="button" onClick={() => onCancel(download.id)} aria-label={t('shared.downloadActions.cancelLabel', { filename })}>{t('shared.downloadActions.cancel')}</button>
    ) : null}
    {availability.canRetry && !download.canResume && onRetry ? (
      <button type="button" onClick={() => onRetry(download.id)} aria-label={t('shared.downloadActions.retryLabel', { filename })}>{t('shared.downloadActions.retry')}</button>
    ) : null}
    {availability.canDownloadAgain && onDownloadAgain ? (
      <button type="button" onClick={() => onDownloadAgain(download.id)} aria-label={t('shared.downloadActions.downloadAgainLabel', { filename })}>
        {t('shared.downloadActions.downloadAgain')}
      </button>
    ) : null}
    {availability.canOpen && onOpen ? (
      <button type="button" onClick={() => onOpen(download.id)} aria-label={t('shared.downloadActions.openLabel', { filename })}>{t('shared.downloadActions.open')}</button>
    ) : null}
    {availability.canShowInFolder && onShowInFolder ? (
      <button type="button" onClick={() => onShowInFolder(download.id)} aria-label={t('shared.downloadActions.showInFolderLabel', { filename })}>
        {t('shared.downloadActions.showInFolder')}
      </button>
    ) : null}
    {availability.canCopySourceUrl && onCopySourceUrl ? (
      <button type="button" onClick={() => onCopySourceUrl(download.id)} aria-label={t('shared.downloadActions.copySourceUrlLabel', { filename })}>
        {t('shared.downloadActions.copySourceUrl')}
      </button>
    ) : null}
    {availability.canCopyFinalUrl && onCopyFinalUrl ? (
      <button type="button" onClick={() => onCopyFinalUrl(download.id)} aria-label={t('shared.downloadActions.copyFinalUrlLabel', { filename })}>
        {t('shared.downloadActions.copyFinalUrl')}
      </button>
    ) : null}
    {availability.canEraseHistory && onEraseHistory ? (
      <button
        type="button"
        onClick={() => setPendingConfirmation('erase-history')}
        aria-label={t('shared.downloadActions.removeFromHistoryLabel', { filename })}
      >
        {t('shared.downloadActions.removeFromHistory')}
      </button>
    ) : null}
    {availability.canRemoveFile && onRemoveFile ? (
      <button
        type="button"
        onClick={() => setPendingConfirmation('remove-file')}
        aria-label={t('shared.downloadActions.deleteFileLabel', { filename })}
      >
        {t('shared.downloadActions.deleteFile')}
      </button>
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

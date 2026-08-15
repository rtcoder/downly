import { type ReactNode, useId, useState } from 'react';

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

type PendingConfirmation = 'remove-file' | null;
type DownloadActionIconName =
  | 'cancel'
  | 'copy'
  | 'delete'
  | 'download'
  | 'folder'
  | 'history'
  | 'more'
  | 'open'
  | 'pause'
  | 'resume'
  | 'retry';

interface DownloadActionDefinition {
  icon: DownloadActionIconName;
  label: string;
  onSelect: () => void;
}

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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();

  const confirm = (): void => {
    if (pendingConfirmation === 'remove-file') {
      onRemoveFile?.(download.id);
    }

    setPendingConfirmation(null);
  };
  const overflowActions: DownloadActionDefinition[] = [
    availability.canPause && onPause ? {
      icon: 'pause',
      label: t('shared.downloadActions.pauseLabel', { filename }),
      onSelect: () => onPause(download.id),
    } : null,
    availability.canCancel && onCancel ? {
      icon: 'cancel',
      label: t('shared.downloadActions.cancelLabel', { filename }),
      onSelect: () => onCancel(download.id),
    } : null,
    availability.canRetry && !download.canResume && onRetry ? {
      icon: 'retry',
      label: t('shared.downloadActions.retryLabel', { filename }),
      onSelect: () => onRetry(download.id),
    } : null,
    availability.canDownloadAgain && onDownloadAgain ? {
      icon: 'download',
      label: t('shared.downloadActions.downloadAgainLabel', { filename }),
      onSelect: () => onDownloadAgain(download.id),
    } : null,
    availability.canOpen && onOpen ? {
      icon: 'open',
      label: t('shared.downloadActions.openLabel', { filename }),
      onSelect: () => onOpen(download.id),
    } : null,
    availability.canCopySourceUrl && onCopySourceUrl ? {
      icon: 'copy',
      label: t('shared.downloadActions.copySourceUrlLabel', { filename }),
      onSelect: () => onCopySourceUrl(download.id),
    } : null,
    availability.canCopyFinalUrl && onCopyFinalUrl ? {
      icon: 'copy',
      label: t('shared.downloadActions.copyFinalUrlLabel', { filename }),
      onSelect: () => onCopyFinalUrl(download.id),
    } : null,
    availability.canRemoveFile && onRemoveFile ? {
      icon: 'delete',
      label: t('shared.downloadActions.deleteFileLabel', { filename }),
      onSelect: () => setPendingConfirmation('remove-file'),
    } : null,
  ].filter((action): action is DownloadActionDefinition => Boolean(action));

  const selectOverflowAction = (action: DownloadActionDefinition): void => {
    setMenuOpen(false);
    action.onSelect();
  };

  return <>
    <div aria-label={t('shared.downloadActions.actionsFor', { filename })} className="download-actions" role="toolbar">
    {availability.canResume && onResume ? (
      <DownloadActionButton icon="resume" label={t('shared.downloadActions.resumeLabel', { filename })} onClick={() => onResume(download.id)} />
    ) : null}
    {availability.canShowInFolder && onShowInFolder ? (
      <DownloadActionButton icon="folder" label={t('shared.downloadActions.showInFolderLabel', { filename })} onClick={() => onShowInFolder(download.id)} />
    ) : null}
    {availability.canEraseHistory && onEraseHistory ? (
      <DownloadActionButton icon="history" label={t('shared.downloadActions.removeFromHistoryLabel', { filename })} onClick={() => onEraseHistory(download.id)} />
    ) : null}
    {overflowActions.length > 0 ? (
      <div className="download-actions-menu">
        <DownloadActionButton
          ariaControls={menuId}
          ariaExpanded={menuOpen}
          icon="more"
          label={t('shared.downloadActions.moreActionsLabel', { filename })}
          onClick={() => setMenuOpen((open) => !open)}
        />
        {menuOpen ? (
          <div id={menuId} role="menu">
            {overflowActions.map((action) => (
              <button key={action.label} onClick={() => selectOverflowAction(action)} role="menuitem" type="button">
                <DownloadActionIcon name={action.icon} />
                <span>{action.label}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    ) : null}
    </div>
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
  ariaControls,
  ariaExpanded,
  icon,
  label,
  onClick,
}: {
  ariaControls?: string;
  ariaExpanded?: boolean;
  icon: DownloadActionIconName;
  label: string;
  onClick: () => void;
}) {
  return <button
    aria-controls={ariaControls}
    aria-expanded={ariaExpanded}
    aria-label={label}
    className="download-action-button"
    onClick={onClick}
    title={label}
    type="button"
  >
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
  more: <>
    <circle cx="5" cy="12" r="1" />
    <circle cx="12" cy="12" r="1" />
    <circle cx="19" cy="12" r="1" />
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

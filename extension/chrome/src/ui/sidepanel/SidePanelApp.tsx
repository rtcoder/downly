import {useCallback, useEffect, useMemo, useRef, useState} from 'react';

import {createDownloadActionService} from '../../application/download-actions';
import type {DownloadsPort} from '../../application/download-repository';
import type {DownloadRecord} from '../../domain/downloads/types';
import {ChromeDownloadsApi} from '../../platform/chrome/downloads-api';
import {ChromeRuntimeApi} from '../../platform/chrome/runtime-api';
import {
  DownloadRow,
  EmptyState,
  type RuntimeMessageSource,
  SearchInput,
  t,
  type ToastMessage,
  ToastRegion,
  useActiveDownloadPolling,
  useDownloads,
} from '../shared';

export type {RuntimeMessageSource};

export interface SidePanelAppProps {
  downloadsPort?: DownloadsPort;
  runtimeMessages?: RuntimeMessageSource;
  openManager?: () => void;
}

const HISTORY_REMOVAL_UNDO_MS = 5_000;

interface PendingHistoryRemoval {
  download: DownloadRecord;
  timeoutId: number;
}

export function SidePanelApp({
                               downloadsPort,
                               runtimeMessages = defaultRuntimeMessages(),
                               openManager = openFullManager,
                             }: SidePanelAppProps) {
  const defaultDownloadsPort = useMemo(() => new ChromeDownloadsApi(), []);
  const resolvedDownloadsPort = downloadsPort ?? defaultDownloadsPort;
  const [search, setSearch] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [historyRemovalToasts, setHistoryRemovalToasts] = useState<ToastMessage[]>([]);
  const pendingHistoryRemovalTimers = useRef(new Map<number, PendingHistoryRemoval>());
  const {
    downloads,
    loading,
    removeDownload,
    replaceActiveDownloads,
    restoreDownload,
  } = useDownloads(resolvedDownloadsPort, runtimeMessages);
  const downloadActions = useMemo(
    () => createDownloadActionService({downloadsPort: resolvedDownloadsPort}),
    [resolvedDownloadsPort],
  );
  const runAction = useCallback((action: () => Promise<unknown> | void) => {
    setActionError(null);
    void Promise.resolve(action()).catch((error: unknown) => {
      setActionError(messageFromError(error));
    });
  }, []);
  const dismissHistoryRemovalToast = useCallback((toastId: string) => {
    setHistoryRemovalToasts((current) => current.filter((toast) => toast.id !== toastId));
  }, []);
  const undoHistoryRemoval = useCallback((download: DownloadRecord, toastId: string) => {
    const pendingRemoval = pendingHistoryRemovalTimers.current.get(download.id);
    if (pendingRemoval) {
      window.clearTimeout(pendingRemoval.timeoutId);
      pendingHistoryRemovalTimers.current.delete(download.id);
    }

    restoreDownload(download);
    dismissHistoryRemovalToast(toastId);
  }, [dismissHistoryRemovalToast, restoreDownload]);
  const scheduleHistoryRemoval = useCallback((download: DownloadRecord) => {
    const existingRemoval = pendingHistoryRemovalTimers.current.get(download.id);
    if (existingRemoval) {
      window.clearTimeout(existingRemoval.timeoutId);
    }

    const toastId = `history-removal-${download.id}`;
    removeDownload(download.id);
    setActionError(null);

    const timeoutId = window.setTimeout(() => {
      pendingHistoryRemovalTimers.current.delete(download.id);
      dismissHistoryRemovalToast(toastId);
      void downloadActions.eraseHistory(download).catch((error: unknown) => {
        restoreDownload(download);
        setActionError(messageFromError(error));
      });
    }, HISTORY_REMOVAL_UNDO_MS);

    pendingHistoryRemovalTimers.current.set(download.id, {download, timeoutId});
    setHistoryRemovalToasts((current) => [
      ...current.filter((toast) => toast.id !== toastId),
      {
        actionLabel: t('shared.undo'),
        id: toastId,
        message: t('shared.downloadActions.removedFromHistory'),
        onAction: () => undoHistoryRemoval(download, toastId),
        tone: 'success',
      },
    ]);
  }, [dismissHistoryRemovalToast, downloadActions, removeDownload, restoreDownload, undoHistoryRemoval]);
  const dismissToast = useCallback((messageId: string) => {
    if (messageId === 'download-action-error') {
      setActionError(null);
      return;
    }

    dismissHistoryRemovalToast(messageId);
  }, [dismissHistoryRemovalToast]);
  useEffect(() => () => {
    for (const pendingRemoval of pendingHistoryRemovalTimers.current.values()) {
      window.clearTimeout(pendingRemoval.timeoutId);
      void downloadActions.eraseHistory(pendingRemoval.download);
    }
    pendingHistoryRemovalTimers.current.clear();
  }, [downloadActions]);
  const activeDownloads = useMemo(
    () => downloads.filter((download) => download.state === 'in_progress'),
    [downloads],
  );
  const {metrics} = useActiveDownloadPolling(resolvedDownloadsPort, activeDownloads, replaceActiveDownloads);
  const visibleDownloads = useMemo(
    () => filterDownloads(downloads, search),
    [downloads, search],
  );

  return <main className="downly-sidepanel-shell">
    <header>
      <h1>{t('sidePanel.title')}</h1>
      <p
        aria-label={t('sidePanel.activeDownloads')}>{t('sidePanel.activeDownloadsValue', {count: activeDownloads.length})}</p>
      <button type="button" onClick={openManager}>{t('sidePanel.openManager')}</button>
    </header>
    <SearchInput value={search} onChange={setSearch}/>
    {loading ? <p>{t('manager.downloads.loading')}</p> : null}
    {!loading && visibleDownloads.length === 0 ? (
      <EmptyState
        title={downloads.length === 0 ? t('sidePanel.noDownloadsTitle') : t('sidePanel.noMatchesTitle')}
        description={downloads.length === 0 ? t('sidePanel.noDownloadsDescription') : t('sidePanel.noMatchesDescription')}
      />
    ) : null}
    <section aria-label={t('manager.downloads.list')}>
      {visibleDownloads.map((download) => (
        <DownloadRow
          download={download}
          key={download.id}
          metrics={metrics.find((metric) => metric.downloadId === download.id)}
          onCancel={() => runAction(() => downloadActions.cancel(download))}
          onCopyFinalUrl={() => runAction(() => downloadActions.copyFinalUrl(download))}
          onCopySourceUrl={() => runAction(() => downloadActions.copySourceUrl(download))}
          onDownloadAgain={() => runAction(() => downloadActions.downloadAgain(download))}
          onEraseHistory={() => scheduleHistoryRemoval(download)}
          onOpen={() => runAction(() => downloadActions.open(download))}
          onPause={() => runAction(() => downloadActions.pause(download))}
          onRemoveFile={() => runAction(() => downloadActions.removeFile(download))}
          onResume={() => runAction(() => downloadActions.resume(download))}
          onRetry={() => runAction(() => downloadActions.retry(download))}
          onShowInFolder={() => runAction(() => downloadActions.showInFolder(download))}
        />
      ))}
    </section>
    <ToastRegion
      messages={[
        ...historyRemovalToasts,
        ...(actionError ? [{id: 'download-action-error', tone: 'error' as const, message: actionError}] : []),
      ]}
      onDismiss={dismissToast}
    />
  </main>;
}

function filterDownloads(downloads: DownloadRecord[], search: string): DownloadRecord[] {
  const normalizedSearch = search.trim().toLowerCase();

  if (!normalizedSearch) {
    return downloads;
  }

  return downloads.filter((download) => searchableText(download).includes(normalizedSearch));
}

function searchableText(download: DownloadRecord): string {
  return [
    download.filename,
    download.basename,
    download.sourceDomain,
    download.url,
    download.finalUrl,
    download.state,
    download.paused ? 'paused' : null,
    download.error,
  ]
    .filter((value): value is string => Boolean(value))
    .join(' ')
    .toLowerCase();
}

function defaultRuntimeMessages(): RuntimeMessageSource | undefined {
  const chromeApi = (globalThis as typeof globalThis & {
    chrome?: {
      runtime?: {
        onMessage?: {
          addListener(listener: (message: unknown) => void): void;
          removeListener(listener: (message: unknown) => void): void;
        };
      };
    };
  }).chrome;

  return chromeApi?.runtime?.onMessage;
}

export function openFullManager() {
  const chromeApi = (globalThis as typeof globalThis & {
    chrome?: {
      runtime?: {
        getURL(path: string): string;
        getManifest?: () => { version?: string };
      };
      tabs?: {
        create(options: { url: string }): void;
      };
    };
  }).chrome;

  if (chromeApi?.runtime?.getURL) {
    void new ChromeRuntimeApi(chromeApi as ConstructorParameters<typeof ChromeRuntimeApi>[0]).openManager();
    return;
  }

  window.open('manager.html');
}

function messageFromError(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return t('shared.downloadActions.failure');
}

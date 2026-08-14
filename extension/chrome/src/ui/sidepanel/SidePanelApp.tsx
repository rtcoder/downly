import { useCallback, useMemo, useState } from 'react';

import { createDownloadActionService } from '../../application/download-actions';
import type { DownloadsPort } from '../../application/download-repository';
import type { DownloadRecord } from '../../domain/downloads/types';
import { ChromeDownloadsApi } from '../../platform/chrome/downloads-api';
import { ChromeRuntimeApi } from '../../platform/chrome/runtime-api';
import { DownloadRow, EmptyState, SearchInput, ToastRegion } from '../shared';
import { useActiveDownloadPolling, useDownloads, type RuntimeMessageSource } from '../shared/hooks';
import { t } from '../shared/i18n';

export type { RuntimeMessageSource };

export interface SidePanelAppProps {
  downloadsPort?: DownloadsPort;
  runtimeMessages?: RuntimeMessageSource;
  openManager?: () => void;
}

export function SidePanelApp({
  downloadsPort = new ChromeDownloadsApi(),
  runtimeMessages = defaultRuntimeMessages(),
  openManager = openFullManager,
}: SidePanelAppProps) {
  const [search, setSearch] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const { downloads, loading, replaceActiveDownloads } = useDownloads(downloadsPort, runtimeMessages);
  const downloadActions = useMemo(
    () => createDownloadActionService({ downloadsPort }),
    [downloadsPort],
  );
  const runAction = useCallback((action: () => Promise<unknown> | void) => {
    setActionError(null);
    void Promise.resolve(action()).catch((error: unknown) => {
      setActionError(messageFromError(error));
    });
  }, []);
  const activeDownloads = useMemo(
    () => downloads.filter((download) => download.state === 'in_progress'),
    [downloads],
  );
  const { metrics } = useActiveDownloadPolling(downloadsPort, activeDownloads, replaceActiveDownloads);
  const visibleDownloads = useMemo(
    () => filterDownloads(downloads, search),
    [downloads, search],
  );

  return <main className="downly-sidepanel-shell">
    <header>
      <h1>{t('sidePanel.title')}</h1>
      <p aria-label={t('sidePanel.activeDownloads')}>{t('sidePanel.activeDownloadsValue', { count: activeDownloads.length })}</p>
      <button type="button" onClick={openManager}>{t('sidePanel.openManager')}</button>
    </header>
    <SearchInput value={search} onChange={setSearch} />
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
          onEraseHistory={() => runAction(() => downloadActions.eraseHistory(download))}
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
      messages={actionError ? [{ id: 'download-action-error', tone: 'error', message: actionError }] : []}
      onDismiss={() => setActionError(null)}
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

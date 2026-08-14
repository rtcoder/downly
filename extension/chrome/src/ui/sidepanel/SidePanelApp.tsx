import { useMemo, useState } from 'react';

import type { DownloadsPort } from '../../application/download-repository';
import type { DownloadRecord } from '../../domain/downloads/types';
import { ChromeDownloadsApi } from '../../platform/chrome/downloads-api';
import { DownloadRow, EmptyState, SearchInput } from '../shared';
import { useActiveDownloadPolling, useDownloads, type RuntimeMessageSource } from '../shared/hooks';

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
  const { downloads, loading, replaceActiveDownloads } = useDownloads(downloadsPort, runtimeMessages);
  const activeDownloads = useMemo(
    () => downloads.filter((download) => download.state === 'in_progress'),
    [downloads],
  );
  const { metrics } = useActiveDownloadPolling(downloadsPort, activeDownloads, replaceActiveDownloads);
  const visibleDownloads = useMemo(
    () => filterDownloads(downloads, search),
    [downloads, search],
  );

  return <main>
    <header>
      <h1>Downloads</h1>
      <p aria-label="Active downloads">{activeDownloads.length} active</p>
      <button type="button" onClick={openManager}>Open full manager</button>
    </header>
    <SearchInput value={search} onChange={setSearch} />
    {loading ? <p>Loading downloads...</p> : null}
    {!loading && visibleDownloads.length === 0 ? (
      <EmptyState
        title={downloads.length === 0 ? 'No downloads' : 'No matching downloads'}
        description={downloads.length === 0 ? 'Downloads you start will appear here.' : 'Try a different search.'}
      />
    ) : null}
    <section aria-label="Download list">
      {visibleDownloads.map((download) => (
        <DownloadRow
          download={download}
          key={download.id}
          metrics={metrics.find((metric) => metric.downloadId === download.id)}
          onCancel={(downloadId) => void downloadsPort.cancel(downloadId)}
          onOpen={(downloadId) => void downloadsPort.open(downloadId)}
          onPause={(downloadId) => void downloadsPort.pause(downloadId)}
          onResume={(downloadId) => void downloadsPort.resume(downloadId)}
          onShowInFolder={(downloadId) => downloadsPort.show(downloadId)}
        />
      ))}
    </section>
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
      };
      tabs?: {
        create(options: { url: string }): void;
      };
    };
  }).chrome;
  const managerUrl = chromeApi?.runtime?.getURL
    ? chromeApi.runtime.getURL('manager.html')
    : 'manager.html';

  if (chromeApi?.tabs?.create) {
    chromeApi.tabs.create({ url: managerUrl });
    return;
  }

  window.open(managerUrl);
}

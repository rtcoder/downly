import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { createDownloadActionService } from '../../application/download-actions';
import type { DownloadSearchQuery, DownloadsPort } from '../../application/download-repository';
import type { DownloadRecord } from '../../domain/downloads/types';
import { filterDownloads, type DownloadFilters } from '../../domain/downloads/filter-downloads';
import { searchDownloads } from '../../domain/downloads/search-downloads';
import { sortDownloads } from '../../domain/downloads/sort-downloads';
import { ChromeDownloadsApi } from '../../platform/chrome/downloads-api';
import { SearchInput, ToastRegion } from '../shared';
import { useActiveDownloadPolling } from '../shared/hooks';
import {
  EMPTY_MANAGER_FILTERS,
  ManagerFilters,
  type ManagerFilterState,
} from './components/ManagerFilters';
import { ManagerSidebar } from './components/ManagerSidebar';
import {
  sortOptionFor,
  type ManagerGroupKey,
  type ManagerSortKey,
  type ManagerView,
} from './components/manager-options';
import { DownloadsView } from './views/DownloadsView';
import { DuplicatesView } from './views/DuplicatesView';
import { OrganizerView } from './views/OrganizerView';
import { StatisticsView } from './views/StatisticsView';

export interface RuntimeMessageSource {
  addListener(listener: (message: unknown) => void): void;
  removeListener(listener: (message: unknown) => void): void;
}

export interface ManagerAppProps {
  downloadsPort?: DownloadsPort;
  runtimeMessages?: RuntimeMessageSource;
  now?: Date;
}

const ACTIVE_DOWNLOADS_QUERY: DownloadSearchQuery = { state: 'in_progress' };
const HISTORY_QUERY: DownloadSearchQuery = { limit: 500, orderBy: ['-startTime'] };
const STATISTICS_HISTORY_QUERY: DownloadSearchQuery = { orderBy: ['-startTime'] };
const SEARCH_DEBOUNCE_MS = 300;

export function ManagerApp({
  downloadsPort = new ChromeDownloadsApi(),
  runtimeMessages = defaultRuntimeMessages(),
  now = new Date(),
}: ManagerAppProps) {
  const [view, setView] = useState<ManagerView>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortBy, setSortBy] = useState<ManagerSortKey>('startTimeDesc');
  const [groupBy, setGroupBy] = useState<ManagerGroupKey>('none');
  const [filters, setFilters] = useState<ManagerFilterState>(EMPTY_MANAGER_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const {
    activeDownloads,
    downloads,
    canLoadOlder,
    loading,
    loadingOlder,
    loadOlder,
    refresh,
    replaceActiveDownloads,
    statisticsDownloads,
  } = useManagerDownloads(downloadsPort, runtimeMessages);
  const { metrics } = useActiveDownloadPolling(downloadsPort, activeDownloads, replaceActiveDownloads);
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

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedSearch(search), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timeoutId);
  }, [search]);

  const visibleDownloads = useMemo(() => {
    const viewFiltered = view === 'duplicates' || view === 'statistics' || view === 'organizer'
      ? downloads
      : filterDownloads(downloads, { predicate: view });
    const queryFiltered = filterDownloads(viewFiltered, toDownloadFilters(filters));
    const searched = searchDownloads(queryFiltered, debouncedSearch);
    return sortDownloads(searched, sortOptionFor(sortBy));
  }, [debouncedSearch, downloads, filters, sortBy, view]);

  const showMatchingDownload = useCallback((download: DownloadRecord) => {
    setView('all');
    setSearch(download.basename);
    setDebouncedSearch(download.basename);
  }, []);

  return <main>
    <header>
      <h1>Downly Download Manager</h1>
      <p aria-label="Loaded downloads">{downloads.length} loaded</p>
      <p aria-label="Active downloads">{activeDownloads.length} active</p>
      <button onClick={() => void refresh()} type="button">Refresh</button>
      <button
        aria-expanded={filtersOpen}
        aria-controls="manager-filters"
        onClick={() => setFiltersOpen((open) => !open)}
        type="button"
      >
        Filters
      </button>
    </header>

    <ManagerSidebar activeView={view} onViewChange={setView} />

    <section aria-label="Download manager controls">
      <SearchInput value={search} onChange={setSearch} />
      {filtersOpen ? (
        <aside aria-label="Download filters" id="manager-filters">
          <ManagerFilters
            filters={filters}
            groupBy={groupBy}
            onFiltersChange={setFilters}
            onGroupByChange={setGroupBy}
            onSortByChange={setSortBy}
            sortBy={sortBy}
          />
        </aside>
      ) : (
        <ManagerFilters
          filters={filters}
          groupBy={groupBy}
          onFiltersChange={setFilters}
          onGroupByChange={setGroupBy}
          onSortByChange={setSortBy}
          sortBy={sortBy}
        />
      )}
    </section>

    {view === 'statistics' ? (
      <StatisticsView downloads={statisticsDownloads} now={now} />
    ) : view === 'organizer' ? (
      <OrganizerView previewDownload={downloads[0] ?? activeDownloads[0] ?? null} />
    ) : view === 'duplicates' ? (
      <DuplicatesView
        downloads={visibleDownloads}
        loading={loading}
        onShowMatchingDownload={showMatchingDownload}
      />
    ) : (
      <DownloadsView
        downloadActions={downloadActions}
        downloads={visibleDownloads}
        groupBy={groupBy}
        loading={loading}
        metrics={metrics}
        now={now}
        onAction={runAction}
      />
    )}

    <footer>
      <button disabled={!canLoadOlder || loading || loadingOlder} onClick={() => void loadOlder()} type="button">
        Load older downloads
      </button>
    </footer>
    <ToastRegion
      messages={actionError ? [{ id: 'download-action-error', tone: 'error', message: actionError }] : []}
      onDismiss={() => setActionError(null)}
    />
  </main>;
}

function useManagerDownloads(
  downloadsPort: DownloadsPort,
  runtimeMessages?: RuntimeMessageSource,
) {
  const [activeDownloads, setActiveDownloads] = useState<DownloadRecord[]>([]);
  const [historyDownloads, setHistoryDownloads] = useState<DownloadRecord[]>([]);
  const [statisticsDownloads, setStatisticsDownloads] = useState<DownloadRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [canLoadOlder, setCanLoadOlder] = useState(false);
  const refreshSequence = useRef(0);
  const replaceActiveDownloads = useCallback((downloads: DownloadRecord[]) => {
    setActiveDownloads(downloads);
    setStatisticsDownloads((current) => mergeActiveFirst(downloads, current));
  }, []);

  const refresh = useCallback(async () => {
    const sequence = refreshSequence.current + 1;
    refreshSequence.current = sequence;
    setLoading(true);

    const [active, history, statisticsHistory] = await Promise.all([
      downloadsPort.search(ACTIVE_DOWNLOADS_QUERY),
      downloadsPort.search(HISTORY_QUERY),
      downloadsPort.search(STATISTICS_HISTORY_QUERY),
    ]);

    if (refreshSequence.current !== sequence) {
      return;
    }

    setActiveDownloads(active);
    setHistoryDownloads(history);
    setStatisticsDownloads(mergeActiveFirst(active, statisticsHistory));
    setCanLoadOlder(history.length > 0);
    setLoading(false);
  }, [downloadsPort]);

  const loadOlder = useCallback(async () => {
    if (loadingOlder) {
      return;
    }

    const oldestStartTime = oldestLoadedStartTime(historyDownloads);
    if (!oldestStartTime) {
      return;
    }

    setLoadingOlder(true);
    try {
      const older = await downloadsPort.search({
        ...HISTORY_QUERY,
        startedBefore: oldestStartTime,
      });

      const loadedIds = new Set(historyDownloads.map((download) => download.id));
      const newRows = older.filter((download) => !loadedIds.has(download.id));

      setHistoryDownloads((current) => dedupeById([...current, ...newRows]));
      setCanLoadOlder(newRows.length > 0);
    } finally {
      setLoadingOlder(false);
    }
  }, [downloadsPort, historyDownloads, loadingOlder]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!runtimeMessages) {
      return undefined;
    }

    const listener = (message: unknown) => {
      if (isDownloadsInvalidatedMessage(message)) {
        void refresh();
      }
    };

    runtimeMessages.addListener(listener);

    return () => runtimeMessages.removeListener(listener);
  }, [refresh, runtimeMessages]);

  const downloads = useMemo(
    () => mergeActiveFirst(activeDownloads, historyDownloads),
    [activeDownloads, historyDownloads],
  );

  return {
    activeDownloads,
    downloads,
    canLoadOlder,
    loading,
    loadingOlder,
    loadOlder,
    refresh,
    replaceActiveDownloads,
    statisticsDownloads,
  };
}

function mergeActiveFirst(activeDownloads: DownloadRecord[], historyDownloads: DownloadRecord[]): DownloadRecord[] {
  const activeIds = new Set(activeDownloads.map((download) => download.id));
  return [
    ...dedupeById(activeDownloads),
    ...historyDownloads.filter((download) => !activeIds.has(download.id)),
  ];
}

function dedupeById(downloads: DownloadRecord[]): DownloadRecord[] {
  const seen = new Set<number>();
  return downloads.filter((download) => {
    if (seen.has(download.id)) {
      return false;
    }

    seen.add(download.id);
    return true;
  });
}

function oldestLoadedStartTime(downloads: DownloadRecord[]): string | null {
  const oldest = downloads.reduce<DownloadRecord | null>((candidate, download) => {
    if (!candidate) {
      return download;
    }

    return new Date(download.startTime).getTime() < new Date(candidate.startTime).getTime()
      ? download
      : candidate;
  }, null);

  return oldest?.startTime ?? null;
}

function toDownloadFilters(filters: ManagerFilterState): DownloadFilters {
  return {
    state: filters.state || undefined,
    category: filters.category || undefined,
    extension: filters.extension.trim() || undefined,
    sourceDomain: filters.sourceDomain.trim() || undefined,
    startedAfter: filters.startedAfter || undefined,
    startedBefore: filters.startedBefore || undefined,
    minSize: toNumber(filters.minSize),
    maxSize: toNumber(filters.maxSize),
    exists: filters.availability === 'exists' ? true : undefined,
    missing: filters.availability === 'missing' ? true : undefined,
  };
}

function toNumber(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const number = Number(trimmed);
  return Number.isFinite(number) ? number : undefined;
}

function isDownloadsInvalidatedMessage(message: unknown): message is { type: 'downloads-invalidated' } {
  return (
    typeof message === 'object'
    && message !== null
    && 'type' in message
    && message.type === 'downloads-invalidated'
  );
}

function defaultRuntimeMessages(): RuntimeMessageSource | undefined {
  const chromeApi = (globalThis as typeof globalThis & {
    chrome?: {
      runtime?: {
        onMessage?: RuntimeMessageSource;
      };
    };
  }).chrome;

  return chromeApi?.runtime?.onMessage;
}

function messageFromError(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'Download action failed.';
}

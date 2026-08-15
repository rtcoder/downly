import {useCallback, useEffect, useMemo, useRef, useState} from 'react';

import {createDownloadActionService} from '../../application/download-actions';
import type {DownloadSearchQuery, DownloadsPort} from '../../application/download-repository';
import {type DownloadFilters, filterDownloads} from '../../domain/downloads/filter-downloads';
import {searchDownloads} from '../../domain/downloads/search-downloads';
import {sortDownloads} from '../../domain/downloads/sort-downloads';
import type {DownloadRecord} from '../../domain/downloads/types';
import {ChromeDownloadsApi} from '../../platform/chrome/downloads-api';
import {SearchInput, type ToastMessage, ToastRegion} from '../shared';
import {useActiveDownloadPolling} from '../shared';
import {t} from '../shared';
import {
  type ManagerGroupKey,
  type ManagerSortKey,
  type ManagerView,
  sortOptionFor,
} from './components/manager-options';
import {EMPTY_MANAGER_FILTERS, ManagerFilters, type ManagerFilterState} from './components/ManagerFilters';
import {ManagerSidebar} from './components/ManagerSidebar';
import {DownloadsView} from './views/DownloadsView';
import {DuplicatesView} from './views/DuplicatesView';
import {OrganizerView} from './views/OrganizerView';
import {SettingsView} from './views/SettingsView';
import {StatisticsView} from './views/StatisticsView';

export interface RuntimeMessageSource {
  addListener(listener: (message: unknown) => void): void;

  removeListener(listener: (message: unknown) => void): void;
}

export interface ManagerAppProps {
  downloadsPort?: DownloadsPort;
  runtimeMessages?: RuntimeMessageSource;
  now?: Date;
}

const ACTIVE_DOWNLOADS_QUERY: DownloadSearchQuery = {state: 'in_progress'};
const HISTORY_QUERY: DownloadSearchQuery = {limit: 500, orderBy: ['-startTime']};
const STATISTICS_HISTORY_QUERY: DownloadSearchQuery = {orderBy: ['-startTime']};
const SEARCH_DEBOUNCE_MS = 300;
const HISTORY_REMOVAL_UNDO_MS = 5_000;

interface PendingHistoryRemoval {
  download: DownloadRecord;
  timeoutId: number;
}

export function ManagerApp({
                             downloadsPort,
                             runtimeMessages = defaultRuntimeMessages(),
                             now = new Date(),
                           }: ManagerAppProps) {
  const defaultDownloadsPort = useMemo(() => new ChromeDownloadsApi(), []);
  const resolvedDownloadsPort = downloadsPort ?? defaultDownloadsPort;
  const [view, setView] = useState<ManagerView>(() => initialManagerView());
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortBy, setSortBy] = useState<ManagerSortKey>('startTimeDesc');
  const [groupBy, setGroupBy] = useState<ManagerGroupKey>('none');
  const [filters, setFilters] = useState<ManagerFilterState>(EMPTY_MANAGER_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [historyRemovalToasts, setHistoryRemovalToasts] = useState<ToastMessage[]>([]);
  const pendingHistoryRemovalTimers = useRef(new Map<number, PendingHistoryRemoval>());
  const {
    activeDownloads,
    downloads,
    canLoadOlder,
    loading,
    loadingOlder,
    loadOlder,
    removeDownload,
    refresh,
    replaceActiveDownloads,
    restoreDownload,
    statisticsDownloads,
  } = useManagerDownloads(resolvedDownloadsPort, runtimeMessages);
  const {metrics} = useActiveDownloadPolling(resolvedDownloadsPort, activeDownloads, replaceActiveDownloads);
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

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedSearch(search), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timeoutId);
  }, [search]);

  const visibleDownloads = useMemo(() => {
    const viewFiltered = view === 'duplicates' || view === 'statistics' || view === 'organizer' || view === 'settings'
      ? downloads
      : filterDownloads(downloads, {predicate: view});
    const queryFiltered = filterDownloads(viewFiltered, toDownloadFilters(filters));
    const searched = searchDownloads(queryFiltered, debouncedSearch);
    return sortDownloads(searched, sortOptionFor(sortBy));
  }, [debouncedSearch, downloads, filters, sortBy, view]);

  const showMatchingDownload = useCallback((download: DownloadRecord) => {
    setView('all');
    setSearch(download.basename);
    setDebouncedSearch(download.basename);
  }, []);

  return <main className="downly-manager-shell">
    <header>
      <h1>{t('manager.title')}</h1>
      <p aria-label={t('manager.loadedDownloads')}>{t('manager.loadedDownloadsValue', {count: downloads.length})}</p>
      <p
        aria-label={t('manager.activeDownloads')}>{t('manager.activeDownloadsValue', {count: activeDownloads.length})}</p>
      <button onClick={() => void refresh()} type="button">{t('manager.refresh')}</button>
      <button
        aria-expanded={filtersOpen}
        aria-controls="manager-filters"
        onClick={() => setFiltersOpen((open) => !open)}
        type="button"
      >
        {t('manager.filters.toggle')}
      </button>
    </header>

    <ManagerSidebar activeView={view} onViewChange={setView}/>

    <section aria-label={t('manager.controls')}>
      <SearchInput value={search} onChange={setSearch}/>
      {filtersOpen ? (
        <aside aria-label={t('manager.filters.region')} id="manager-filters">
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

    {view === 'settings' ? (
      <SettingsView/>
    ) : view === 'statistics' ? (
      <StatisticsView downloads={statisticsDownloads} now={now}/>
    ) : view === 'organizer' ? (
      <OrganizerView previewDownload={downloads[0] ?? activeDownloads[0] ?? null}/>
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
        onEraseHistory={scheduleHistoryRemoval}
      />
    )}

    <footer>
      <button disabled={!canLoadOlder || loading || loadingOlder} onClick={() => void loadOlder()} type="button">
        {t('manager.loadOlder')}
      </button>
    </footer>
    <ToastRegion
      messages={[
        ...historyRemovalToasts,
        ...(actionError ? [{id: 'download-action-error', tone: 'error' as const, message: actionError}] : []),
      ]}
      onDismiss={dismissToast}
    />
  </main>;
}

function initialManagerView(): ManagerView {
  const view = new URLSearchParams(window.location.search).get('view');
  return isManagerView(view) ? view : 'all';
}

function isManagerView(value: string | null): value is ManagerView {
  return value === 'all'
    || value === 'active'
    || value === 'completed'
    || value === 'failed'
    || value === 'duplicates'
    || value === 'statistics'
    || value === 'organizer'
    || value === 'settings';
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
  const removeDownload = useCallback((downloadId: number) => {
    setActiveDownloads((current) => current.filter((download) => download.id !== downloadId));
    setHistoryDownloads((current) => current.filter((download) => download.id !== downloadId));
    setStatisticsDownloads((current) => current.filter((download) => download.id !== downloadId));
  }, []);
  const restoreDownload = useCallback((download: DownloadRecord) => {
    if (download.state === 'in_progress') {
      setActiveDownloads((current) => dedupeById([download, ...current]));
    } else {
      setHistoryDownloads((current) => dedupeById([download, ...current]));
    }
    setStatisticsDownloads((current) => dedupeById([download, ...current]));
  }, []);

  const refresh = useCallback(async (options: { showLoading?: boolean } = {}) => {
    const showLoading = options.showLoading ?? true;
    const sequence = refreshSequence.current + 1;
    refreshSequence.current = sequence;
    if (showLoading) {
      setLoading(true);
    }

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
        void refresh({showLoading: false});
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
    removeDownload,
    refresh,
    replaceActiveDownloads,
    restoreDownload,
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

  return t('shared.downloadActions.failure');
}

import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DownloadSearchQuery, DownloadsPort } from '../../src/application/download-repository';
import type { DownloadRecord, DownloadState, FileCategory } from '../../src/domain/downloads/types';
import { createChromeMock } from '../../src/test/chrome-mock';
import { ManagerApp, type RuntimeMessageSource } from '../../src/ui/manager/ManagerApp';

function download(overrides: Partial<DownloadRecord> = {}): DownloadRecord {
  return {
    id: 1,
    filename: '/Users/test/Report.pdf',
    basename: 'Report',
    extension: 'pdf',
    mime: 'application/pdf',
    category: 'document',
    state: 'complete',
    paused: false,
    canResume: false,
    exists: true,
    danger: 'safe',
    error: null,
    url: 'https://example.com/report.pdf',
    finalUrl: null,
    referrer: null,
    sourceDomain: 'example.com',
    bytesReceived: 1_024,
    totalBytes: 1_024,
    fileSize: 1_024,
    startTime: '2026-08-14T10:00:00.000Z',
    endTime: '2026-08-14T10:01:00.000Z',
    estimatedEndTime: null,
    ...overrides,
  };
}

function createDownloads(count: number, offset = 0): DownloadRecord[] {
  return Array.from({ length: count }, (_, index) => {
    const id = offset + index + 1;
    return download({
      id,
      basename: `File ${id}`,
      filename: `/tmp/File ${id}.pdf`,
      startTime: new Date(Date.UTC(2026, 7, 14, 12, 0, 0) - id * 60_000).toISOString(),
      url: `https://files.example/file-${id}.pdf`,
    });
  });
}

function createPort(fixtures: {
  active?: DownloadRecord[];
  history?: DownloadRecord[];
  older?: DownloadRecord[];
  statistics?: DownloadRecord[];
} = {}) {
  const searches: DownloadSearchQuery[] = [];
  const port: DownloadsPort = {
    search: vi.fn(async (query: DownloadSearchQuery) => {
      searches.push(query);
      if (query.state === 'in_progress') {
        return fixtures.active ?? [];
      }
      if (query.startedBefore) {
        return fixtures.older ?? [];
      }
      if (query.limit === undefined && query.orderBy?.includes('-startTime')) {
        return fixtures.statistics ?? fixtures.history ?? [];
      }
      return fixtures.history ?? [];
    }),
    getById: vi.fn(async () => null),
    pause: vi.fn(async () => undefined),
    resume: vi.fn(async () => undefined),
    cancel: vi.fn(async () => undefined),
    open: vi.fn(async () => undefined),
    show: vi.fn(),
    showDefaultFolder: vi.fn(),
    removeFile: vi.fn(async () => undefined),
    eraseById: vi.fn(async () => []),
    downloadAgain: vi.fn(async () => 1),
  };

  return { port, searches };
}

function createRuntimeMessages(): RuntimeMessageSource & { send: (message: unknown) => void } {
  const listeners = new Set<(message: unknown) => void>();

  return {
    addListener(listener) {
      listeners.add(listener);
    },
    removeListener(listener) {
      listeners.delete(listener);
    },
    send(message) {
      for (const listener of listeners) {
        listener(message);
      }
    },
  };
}

function setVisibilityState(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: state,
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });

  return { promise, resolve };
}

async function renderManager(props: Parameters<typeof ManagerApp>[0]) {
  const rendered = render(<ManagerApp {...props} />);
  await act(async () => {
    await Promise.resolve();
  });
  screen.getByRole('heading', { name: 'Downly Download Manager' });
  return rendered;
}

function visibleRows() {
  return screen.queryAllByRole('article').map((row) => row.getAttribute('aria-label'));
}

function clickOverflowAction(rowName: string, actionName: string) {
  const row = screen.getByRole('article', { name: rowName });
  fireEvent.click(within(row).getByRole('button', { name: `More actions for ${rowName}` }));
  fireEvent.click(screen.getByRole('menuitem', { name: actionName }));
}

beforeEach(() => {
  setVisibilityState('visible');
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('download manager', () => {
  it('navigates between all, active, completed, and failed views', async () => {
    const active = download({ id: 1, basename: 'Active', extension: 'zip', filename: '/tmp/Active.zip', state: 'in_progress' });
    const completed = download({ id: 2, basename: 'Completed', filename: '/tmp/Completed.pdf', state: 'complete' });
    const failed = download({ id: 3, basename: 'Failed', extension: 'dmg', filename: '/tmp/Failed.dmg', state: 'interrupted', error: 'NETWORK_FAILED' });
    const { port } = createPort({ active: [active], history: [completed, failed] });

    await renderManager({ downloadsPort: port });
    expect(visibleRows()).toEqual(['Active.zip', 'Completed.pdf', 'Failed.dmg']);

    fireEvent.click(screen.getByRole('button', { name: 'Active' }));
    expect(visibleRows()).toEqual(['Active.zip']);

    fireEvent.click(screen.getByRole('button', { name: 'Completed' }));
    expect(visibleRows()).toEqual(['Completed.pdf']);

    fireEvent.click(screen.getByRole('button', { name: 'Failed' }));
    expect(visibleRows()).toEqual(['Failed.dmg']);

    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    expect(visibleRows()).toEqual(['Active.zip', 'Completed.pdf', 'Failed.dmg']);
  });

  it('shows statistics for available Chrome download history', async () => {
    const completed = download({
      id: 1,
      basename: 'Report',
      filename: '/tmp/Report.pdf',
      category: 'document',
      sourceDomain: 'docs.example',
      fileSize: 4_096,
      startTime: '2026-08-14T09:00:00.000Z',
    });
    const failed = download({
      id: 2,
      basename: 'Archive',
      filename: '/tmp/Archive.zip',
      category: 'archive',
      sourceDomain: 'files.example',
      state: 'interrupted',
      bytesReceived: 1_024,
      fileSize: 0,
      totalBytes: 0,
      startTime: '2026-08-13T09:00:00.000Z',
    });
    const { port } = createPort({ history: [completed, failed] });

    await renderManager({ downloadsPort: port, now: new Date('2026-08-14T12:00:00.000Z') });
    fireEvent.click(screen.getByRole('button', { name: 'Statistics' }));

    expect(screen.getByRole('heading', { name: 'Statistics' })).toBeTruthy();
    expect(screen.getByText(/Chrome download history available to Downly/i)).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Downloads today' }).textContent).toContain('1');
    expect(screen.getByRole('region', { name: 'Completed count' }).textContent).toContain('1');
    expect(screen.getByRole('region', { name: 'Interrupted count' }).textContent).toContain('1');
    expect(screen.getByRole('figure', { name: 'Downloaded bytes by period' })).toBeTruthy();
    expect(screen.getByRole('table', { name: 'Count by source domain' })).toBeTruthy();
  });

  it('calculates statistics from available history beyond the initial 500-item manager page', async () => {
    const visibleHistory = createDownloads(500);
    const hiddenLargest = download({
      id: 999,
      basename: 'Hidden archive',
      filename: '/tmp/Hidden archive.zip',
      category: 'archive',
      fileSize: 25_000,
      totalBytes: 25_000,
      startTime: '2026-08-10T12:00:00.000Z',
    });
    const { port, searches } = createPort({
      history: visibleHistory,
      statistics: [...visibleHistory, hiddenLargest],
    });

    await renderManager({ downloadsPort: port, now: new Date('2026-08-14T12:00:00.000Z') });
    fireEvent.click(screen.getByRole('button', { name: 'Statistics' }));

    expect(screen.getByRole('region', { name: 'Largest item' }).textContent).toContain('Hidden archive');
    expect(searches).toContainEqual({ orderBy: ['-startTime'] });
  });

  it('shows possible duplicate groups with confidence, reasons, and matching download action', async () => {
    const original = download({
      id: 1,
      basename: 'Report',
      filename: '/tmp/Report.pdf',
      url: 'https://docs.example/report.pdf',
      finalUrl: 'https://cdn.example/report.pdf',
      startTime: '2026-08-14T10:00:00.000Z',
    });
    const recentMatch = download({
      id: 2,
      basename: 'Report',
      filename: '/tmp/Report.pdf',
      url: 'https://Docs.Example/report.pdf?utm_source=mail#copy',
      finalUrl: 'https://cdn.example/report.pdf',
      startTime: '2026-08-14T12:00:00.000Z',
    });
    const unrelated = download({
      id: 3,
      basename: 'Budget',
      filename: '/tmp/Budget.xlsx',
      extension: 'xlsx',
      category: 'document',
      url: 'https://docs.example/budget.xlsx',
      finalUrl: 'https://cdn.example/budget.xlsx',
      startTime: '2026-08-14T11:00:00.000Z',
    });
    const { port } = createPort({ history: [recentMatch, unrelated, original] });

    await renderManager({ downloadsPort: port });
    fireEvent.click(screen.getByRole('button', { name: 'Possible duplicates' }));

    const duplicateRegion = screen.getByRole('region', { name: 'Possible duplicate Report.pdf' });
    expect(within(duplicateRegion).getByText('Possible duplicate')).toBeTruthy();
    expect(within(duplicateRegion).getByText('strong confidence')).toBeTruthy();
    expect(within(duplicateRegion).getByText('Same known size')).toBeTruthy();
    expect(within(duplicateRegion).getByText('Same normalized source URL')).toBeTruthy();
    expect(within(duplicateRegion).queryByText('Budget.xlsx')).toBeNull();

    fireEvent.click(within(duplicateRegion).getByRole('button', { name: 'Show matching download Report.pdf' }));
    expect(screen.getByRole('button', { name: 'All' }).getAttribute('aria-current')).toBe('page');
    expect(visibleRows()).toEqual(['Report.pdf', 'Report.pdf']);
  });

  it('loads active downloads plus the first 500 recent history items with active items deduped first', async () => {
    const active = download({ id: 10, basename: 'Active', extension: 'zip', filename: '/tmp/Active.zip', state: 'in_progress', startTime: '2026-08-14T12:30:00.000Z' });
    const history = createDownloads(500);
    const { port, searches } = createPort({ active: [active], history: [history[0], active, ...history.slice(1)] });

    await renderManager({ downloadsPort: port });

    expect(searches).toEqual([
      { state: 'in_progress' },
      { limit: 500, orderBy: ['-startTime'] },
      { orderBy: ['-startTime'] },
    ]);
    expect(screen.getByLabelText('Loaded downloads').textContent).toBe('500 loaded');
    expect(visibleRows()[0]).toBe('Active.zip');
    expect(visibleRows()).toHaveLength(500);
  });

  it('loads older history using the oldest loaded startTime', async () => {
    const newest = download({ id: 1, basename: 'Newest', filename: '/tmp/Newest.pdf', startTime: '2026-08-14T12:00:00.000Z' });
    const oldest = download({ id: 2, basename: 'Oldest', filename: '/tmp/Oldest.pdf', startTime: '2026-08-13T12:00:00.000Z' });
    const older = download({ id: 3, basename: 'Older', filename: '/tmp/Older.pdf', startTime: '2026-08-12T12:00:00.000Z' });
    const { port, searches } = createPort({ history: [newest, oldest], older: [older] });

    await renderManager({ downloadsPort: port });
    fireEvent.click(screen.getByRole('button', { name: 'Load older downloads' }));

    await waitFor(() => expect(visibleRows()).toEqual(['Newest.pdf', 'Oldest.pdf', 'Older.pdf']));
    expect(searches.at(-1)).toEqual({
      limit: 500,
      orderBy: ['-startTime'],
      startedBefore: '2026-08-13T12:00:00.000Z',
    });
  });

  it('stops offering older loading when Chrome returns only duplicate rows', async () => {
    const newest = download({ id: 1, basename: 'Newest', filename: '/tmp/Newest.pdf', startTime: '2026-08-14T12:00:00.000Z' });
    const oldest = download({ id: 2, basename: 'Oldest', filename: '/tmp/Oldest.pdf', startTime: '2026-08-13T12:00:00.000Z' });
    const { port } = createPort({ history: [newest, oldest], older: [oldest] });

    await renderManager({ downloadsPort: port });
    fireEvent.click(screen.getByRole('button', { name: 'Load older downloads' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Load older downloads' }).hasAttribute('disabled')).toBe(true));

    expect(visibleRows()).toEqual(['Newest.pdf', 'Oldest.pdf']);
    expect(port.search).toHaveBeenCalledTimes(4);
  });

  it('debounces search input before applying query results', async () => {
    vi.useFakeTimers();
    const report = download({ id: 1, basename: 'Résumé Report', filename: '/tmp/Résumé Report.pdf' });
    const archive = download({ id: 2, basename: 'Archive', extension: 'zip', filename: '/tmp/Archive.zip', sourceDomain: 'cdn.example' });
    const { port } = createPort({ history: [report, archive] });

    await renderManager({ downloadsPort: port });

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search downloads' }), { target: { value: 'resume' } });
    expect(visibleRows()).toEqual(['Résumé Report.pdf', 'Archive.zip']);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(299);
    });
    expect(visibleRows()).toEqual(['Résumé Report.pdf', 'Archive.zip']);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(visibleRows()).toEqual(['Résumé Report.pdf']);
  });

  it('filters by state, category, extension, domain, date, size, and file existence', async () => {
    const wanted = download({
      id: 1,
      basename: 'Wanted',
      filename: '/tmp/Wanted.pdf',
      category: 'document',
      extension: 'pdf',
      sourceDomain: 'docs.example',
      fileSize: 4_096,
      startTime: '2026-08-14T09:00:00.000Z',
      exists: true,
    });
    const wrongCategory = download({ id: 2, basename: 'Video', extension: 'mp4', filename: '/tmp/Video.mp4', category: 'video', sourceDomain: 'docs.example', fileSize: 4_096, startTime: '2026-08-14T09:00:00.000Z' });
    const wrongDomain = download({ id: 3, basename: 'Other', filename: '/tmp/Other.pdf', sourceDomain: 'other.example', fileSize: 4_096, startTime: '2026-08-14T09:00:00.000Z' });
    const tooSmall = download({ id: 4, basename: 'Small', filename: '/tmp/Small.pdf', sourceDomain: 'docs.example', fileSize: 128, startTime: '2026-08-14T09:00:00.000Z' });
    const missing = download({ id: 5, basename: 'Missing', filename: '/tmp/Missing.pdf', sourceDomain: 'docs.example', fileSize: 4_096, startTime: '2026-08-14T09:00:00.000Z', exists: false });
    const { port } = createPort({ history: [wanted, wrongCategory, wrongDomain, tooSmall, missing] });

    await renderManager({ downloadsPort: port });

    fireEvent.change(screen.getByLabelText('State filter'), { target: { value: 'complete' satisfies DownloadState } });
    fireEvent.change(screen.getByLabelText('Category filter'), { target: { value: 'document' satisfies FileCategory } });
    fireEvent.change(screen.getByLabelText('Extension filter'), { target: { value: 'pdf' } });
    fireEvent.change(screen.getByLabelText('Source domain filter'), { target: { value: 'docs.example' } });
    fireEvent.change(screen.getByLabelText('Started after filter'), { target: { value: '2026-08-14' } });
    fireEvent.change(screen.getByLabelText('Minimum size filter'), { target: { value: '1024' } });
    fireEvent.change(screen.getByLabelText('File availability filter'), { target: { value: 'exists' } });

    expect(visibleRows()).toEqual(['Wanted.pdf']);
  });

  it('sorts by selected option and groups visible downloads by time', async () => {
    const todaySmall = download({ id: 1, basename: 'Today small', filename: '/tmp/Today small.pdf', fileSize: 100, startTime: '2026-08-14T10:00:00.000Z' });
    const yesterdayLarge = download({ id: 2, basename: 'Yesterday large', filename: '/tmp/Yesterday large.zip', extension: 'zip', category: 'archive', fileSize: 9_000, startTime: '2026-08-13T10:00:00.000Z' });
    const olderMedium = download({ id: 3, basename: 'Older medium', filename: '/tmp/Older medium.pdf', fileSize: 500, startTime: '2026-07-20T10:00:00.000Z' });
    const { port } = createPort({ history: [todaySmall, yesterdayLarge, olderMedium] });

    await renderManager({ downloadsPort: port, now: new Date('2026-08-14T12:00:00.000Z') });

    fireEvent.change(screen.getByLabelText('Sort downloads'), { target: { value: 'sizeDesc' } });
    expect(visibleRows()).toEqual(['Yesterday large.zip', 'Older medium.pdf', 'Today small.pdf']);

    fireEvent.change(screen.getByLabelText('Group downloads'), { target: { value: 'time' } });

    const today = screen.getByRole('region', { name: 'Today' });
    const yesterday = screen.getByRole('region', { name: 'Yesterday' });
    const older = screen.getByRole('region', { name: 'Older' });
    expect(within(today).getByRole('article', { name: 'Today small.pdf' })).toBeTruthy();
    expect(within(yesterday).getByRole('article', { name: 'Yesterday large.zip' })).toBeTruthy();
    expect(within(older).getByRole('article', { name: 'Older medium.pdf' })).toBeTruthy();
  });

  it('toggles responsive filter drawer state', async () => {
    const { port } = createPort();

    await renderManager({ downloadsPort: port });

    const toggle = screen.getByRole('button', { name: 'Filters' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('complementary', { name: 'Download filters' })).toBeNull();

    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('complementary', { name: 'Download filters' })).toBeTruthy();
  });

  it('refreshes active and the first 500 history items on runtime invalidation without stale overwrites', async () => {
    const runtimeMessages = createRuntimeMessages();
    const firstActive = deferred<DownloadRecord[]>();
    const firstHistory = deferred<DownloadRecord[]>();
    const firstStatistics = deferred<DownloadRecord[]>();
    const secondActive = deferred<DownloadRecord[]>();
    const secondHistory = deferred<DownloadRecord[]>();
    const secondStatistics = deferred<DownloadRecord[]>();
    const stale = download({ id: 1, basename: 'Stale', filename: '/tmp/Stale.pdf' });
    const fresh = download({ id: 2, basename: 'Fresh', filename: '/tmp/Fresh.pdf' });
    const activeResponses = [firstActive, secondActive];
    const historyResponses = [firstHistory, secondHistory];
    const statisticsResponses = [firstStatistics, secondStatistics];
    const { port } = createPort();
    vi.mocked(port.search).mockImplementation((query: DownloadSearchQuery) => {
      if (query.state === 'in_progress') {
        return (activeResponses.shift() ?? deferred<DownloadRecord[]>()).promise;
      }
      if (query.limit === undefined && query.orderBy?.includes('-startTime')) {
        return (statisticsResponses.shift() ?? deferred<DownloadRecord[]>()).promise;
      }
      return (historyResponses.shift() ?? deferred<DownloadRecord[]>()).promise;
    });

    render(<ManagerApp downloadsPort={port} runtimeMessages={runtimeMessages} />);
    await waitFor(() => expect(port.search).toHaveBeenCalledTimes(3));

    act(() => runtimeMessages.send({ type: 'downloads-invalidated' }));
    await waitFor(() => expect(port.search).toHaveBeenCalledTimes(6));

    await act(async () => {
      secondActive.resolve([]);
      secondHistory.resolve([fresh]);
      secondStatistics.resolve([fresh]);
      await Promise.resolve();
    });
    await waitFor(() => expect(visibleRows()).toEqual(['Fresh.pdf']));

    await act(async () => {
      firstActive.resolve([]);
      firstHistory.resolve([stale]);
      firstStatistics.resolve([stale]);
      await Promise.resolve();
    });

    expect(visibleRows()).toEqual(['Fresh.pdf']);
    expect(vi.mocked(port.search).mock.calls[3][0]).toEqual({ state: 'in_progress' });
    expect(vi.mocked(port.search).mock.calls[4][0]).toEqual({ limit: 500, orderBy: ['-startTime'] });
    expect(vi.mocked(port.search).mock.calls[5][0]).toEqual({ orderBy: ['-startTime'] });
  });

  it('keeps rendered downloads visible during runtime invalidation refreshes', async () => {
    const runtimeMessages = createRuntimeMessages();
    const initial = download({ id: 1, basename: 'Initial', filename: '/tmp/Initial.pdf' });
    const refreshed = download({ id: 2, basename: 'Refreshed', filename: '/tmp/Refreshed.pdf' });
    const backgroundActive = deferred<DownloadRecord[]>();
    const backgroundHistory = deferred<DownloadRecord[]>();
    const backgroundStatistics = deferred<DownloadRecord[]>();
    const { port } = createPort({ history: [initial] });
    vi.mocked(port.search).mockImplementation((query: DownloadSearchQuery) => {
      if (vi.mocked(port.search).mock.calls.length <= 3) {
        if (query.state === 'in_progress') {
          return Promise.resolve([]);
        }
        return Promise.resolve([initial]);
      }
      if (query.state === 'in_progress') {
        return backgroundActive.promise;
      }
      if (query.limit === undefined && query.orderBy?.includes('-startTime')) {
        return backgroundStatistics.promise;
      }
      return backgroundHistory.promise;
    });

    await renderManager({ downloadsPort: port, runtimeMessages });
    expect(visibleRows()).toEqual(['Initial.pdf']);
    expect(screen.queryByText('Loading downloads...')).toBeNull();

    act(() => runtimeMessages.send({ type: 'downloads-invalidated' }));
    await waitFor(() => expect(port.search).toHaveBeenCalledTimes(6));

    expect(visibleRows()).toEqual(['Initial.pdf']);
    expect(screen.queryByText('Loading downloads...')).toBeNull();

    await act(async () => {
      backgroundActive.resolve([]);
      backgroundHistory.resolve([refreshed]);
      backgroundStatistics.resolve([refreshed]);
      await Promise.resolve();
    });

    await waitFor(() => expect(visibleRows()).toEqual(['Refreshed.pdf']));
  });

  it('does not restart the initial manager load after local renders when using the default Chrome port', async () => {
    const chrome = createChromeMock();
    chrome.results.search = [{
      id: 1,
      filename: '/tmp/Initial.pdf',
      url: 'https://example.com/initial.pdf',
      startTime: '2026-08-14T10:00:00.000Z',
      state: 'complete',
    }];
    vi.stubGlobal('chrome', chrome);

    render(<ManagerApp />);
    await waitFor(() => expect(visibleRows()).toEqual(['Initial.pdf']));
    expect(chrome.calls.filter((call) => call.method === 'search')).toHaveLength(3);

    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    await act(async () => {
      await Promise.resolve();
    });

    expect(chrome.calls.filter((call) => call.method === 'search')).toHaveLength(3);
    expect(screen.queryByText('Loading downloads...')).toBeNull();
  });

  it('wires manager row actions through the application action service', async () => {
    vi.useFakeTimers();
    const active = download({ id: 1, basename: 'Active', extension: 'zip', filename: '/tmp/Active.zip', state: 'in_progress', paused: false });
    const paused = download({ id: 2, basename: 'Paused', extension: 'zip', filename: '/tmp/Paused.zip', state: 'in_progress', paused: true });
    const failed = download({ id: 3, basename: 'Failed', extension: 'dmg', filename: '/tmp/Failed.dmg', state: 'interrupted', canResume: false, finalUrl: 'https://cdn.example/failed.dmg' });
    const completed = download({ id: 4, basename: 'Complete', filename: '/tmp/Complete.pdf', state: 'complete', finalUrl: 'https://cdn.example/complete.pdf' });
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const { port } = createPort({ active: [active, paused], history: [failed, completed] });

    await renderManager({ downloadsPort: port });

    clickOverflowAction('Active.zip', 'Pause Active.zip');
    fireEvent.click(screen.getByRole('button', { name: 'Resume Paused.zip' }));
    clickOverflowAction('Active.zip', 'Cancel Active.zip');
    clickOverflowAction('Failed.dmg', 'Retry Failed.dmg');
    clickOverflowAction('Complete.pdf', 'Download Complete.pdf again');
    clickOverflowAction('Complete.pdf', 'Open Complete.pdf');
    fireEvent.click(within(screen.getByRole('article', { name: 'Complete.pdf' })).getByRole('button', { name: 'Show Complete.pdf in folder' }));
    clickOverflowAction('Complete.pdf', 'Copy source URL for Complete.pdf');
    clickOverflowAction('Complete.pdf', 'Copy final URL for Complete.pdf');
    clickOverflowAction('Complete.pdf', 'Delete file Complete.pdf');
    fireEvent.click(screen.getByRole('button', { name: 'Delete file' }));
    fireEvent.click(within(screen.getByRole('article', { name: 'Complete.pdf' })).getByRole('button', { name: 'Remove Complete.pdf from history' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });

    expect(port.pause).toHaveBeenCalledWith(1);
    expect(port.resume).toHaveBeenCalledWith(2);
    expect(port.cancel).toHaveBeenCalledWith(1);
    expect(port.downloadAgain).toHaveBeenCalledWith(failed);
    expect(port.downloadAgain).toHaveBeenCalledWith(completed);
    expect(port.open).toHaveBeenCalledWith(4);
    expect(port.show).toHaveBeenCalledWith(4);
    expect(writeText).toHaveBeenCalledWith('https://example.com/report.pdf');
    expect(writeText).toHaveBeenCalledWith('https://cdn.example/complete.pdf');
    expect(port.eraseById).toHaveBeenCalledWith(4);
    expect(port.removeFile).toHaveBeenCalledWith(4);
  });

  it('removes a manager history row optimistically and restores it from the undo toast', async () => {
    vi.useFakeTimers();
    const completed = download({ id: 4, basename: 'Complete', filename: '/tmp/Complete.pdf', state: 'complete' });
    const { port } = createPort({ history: [completed] });

    await renderManager({ downloadsPort: port });

    fireEvent.click(within(screen.getByRole('article', { name: 'Complete.pdf' })).getByRole('button', { name: 'Remove Complete.pdf from history' }));

    expect(visibleRows()).toEqual([]);
    expect(screen.getByText('Removed from history.')).toBeTruthy();
    expect(port.eraseById).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));

    expect(visibleRows()).toEqual(['Complete.pdf']);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });

    expect(port.eraseById).not.toHaveBeenCalled();
    expect(screen.queryByText('Removed from history.')).toBeNull();
  });

  it('commits a pending manager history removal when the manager unmounts', async () => {
    vi.useFakeTimers();
    const completed = download({ id: 4, basename: 'Complete', filename: '/tmp/Complete.pdf', state: 'complete' });
    const { port } = createPort({ history: [completed] });

    const { unmount } = await renderManager({ downloadsPort: port });

    fireEvent.click(within(screen.getByRole('article', { name: 'Complete.pdf' })).getByRole('button', { name: 'Remove Complete.pdf from history' }));
    unmount();

    expect(port.eraseById).toHaveBeenCalledWith(4);
  });

  it('shows a controlled manager error when an action fails', async () => {
    const completed = download({ id: 4, basename: 'Complete', filename: '/tmp/Complete.pdf', state: 'complete' });
    const { port } = createPort({ history: [completed] });
    vi.mocked(port.open).mockRejectedValue(new Error('Chrome denied open.'));

    await renderManager({ downloadsPort: port });
    clickOverflowAction('Complete.pdf', 'Open Complete.pdf');

    expect(await screen.findByText('Chrome denied open.')).toBeTruthy();
  });

  it('polls active downloads only while the manager is visible and active downloads exist', async () => {
    vi.useFakeTimers();
    const active = download({ id: 5, basename: 'Movie', extension: 'mp4', filename: '/tmp/Movie.mp4', state: 'in_progress', bytesReceived: 100, totalBytes: 1_000 });
    const nextActive = download({ ...active, bytesReceived: 300 });
    const completed = download({ ...active, state: 'complete', bytesReceived: 1_000, endTime: '2026-08-14T10:02:00.000Z' });
    let activeResponses = [[active], [nextActive], [], [completed]];
    const { port } = createPort({ history: [] });
    vi.mocked(port.search).mockImplementation(async (query: DownloadSearchQuery) => {
      if (query.state === 'in_progress') {
        return activeResponses.shift() ?? [];
      }
      return [];
    });

    await renderManager({ downloadsPort: port });
    expect(port.search).toHaveBeenCalledTimes(3);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(port.search).toHaveBeenCalledTimes(4);
    expect(screen.getByText('200 B/s')).toBeTruthy();

    setVisibilityState('hidden');
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    activeResponses = [[completed]];

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(port.search).toHaveBeenCalledTimes(4);

    setVisibilityState('visible');
    act(() => document.dispatchEvent(new Event('visibilitychange')));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(port.search).toHaveBeenCalledTimes(5);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(port.search).toHaveBeenCalledTimes(5);
  });
});

import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DownloadSearchQuery, DownloadsPort } from '../../src/application/download-repository';
import type { DownloadRecord } from '../../src/domain/downloads/types';
import { openFullManager, SidePanelApp, type RuntimeMessageSource } from '../../src/ui/sidepanel/SidePanelApp';

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

function createPort(fixtures: {
  active?: DownloadRecord[];
  recent?: DownloadRecord[];
  byId?: Record<number, DownloadRecord | null>;
} = {}) {
  const searches: DownloadSearchQuery[] = [];
  const port: DownloadsPort = {
    search: vi.fn(async (query: DownloadSearchQuery) => {
      searches.push(query);
      if (query.state === 'in_progress') {
        return fixtures.active ?? [];
      }
      return fixtures.recent ?? [];
    }),
    getById: vi.fn(async (id: number) => fixtures.byId?.[id] ?? null),
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

async function renderPanel(props: Parameters<typeof SidePanelApp>[0]) {
  render(<SidePanelApp {...props} />);
  await act(async () => {
    await Promise.resolve();
  });
  screen.getByRole('heading', { name: 'Downloads' });
}

function visibleRows() {
  return screen.queryAllByRole('article').map((row) => row.getAttribute('aria-label'));
}

beforeEach(() => {
  setVisibilityState('visible');
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('side panel', () => {
  it('renders active downloads first and removes duplicates from the recent list', async () => {
    const active = download({ id: 7, basename: 'Active', extension: 'zip', filename: '/tmp/Active.zip', state: 'in_progress', bytesReceived: 20, totalBytes: 100, sourceDomain: 'active.test' });
    const recentDuplicate = download({ ...active });
    const completed = download({ id: 3, basename: 'Finished', filename: '/tmp/Finished.pdf', sourceDomain: 'recent.test' });
    const { port } = createPort({ active: [active], recent: [completed, recentDuplicate] });

    await renderPanel({ downloadsPort: port });

    expect(visibleRows()).toEqual(['Active.zip', 'Finished.pdf']);
    expect(screen.getByLabelText('Active downloads').textContent).toBe('1 active');
  });

  it('queries active downloads and the 50 most recent downloads', async () => {
    const { port, searches } = createPort();

    await renderPanel({ downloadsPort: port });

    expect(searches).toEqual([
      { state: 'in_progress' },
      { limit: 50, orderBy: ['-startTime'] },
    ]);
  });

  it('filters visible downloads by filename, domain, and url text', async () => {
    const report = download({ id: 1, basename: 'Quarterly Report', filename: '/tmp/Quarterly Report.pdf', sourceDomain: 'finance.example', url: 'https://finance.example/report.pdf' });
    const installer = download({ id: 2, basename: 'Setup', extension: 'dmg', filename: '/tmp/Setup.dmg', sourceDomain: 'tools.example', url: 'https://tools.example/download/setup.dmg' });
    const video = download({ id: 3, basename: 'Launch', extension: 'mp4', filename: '/tmp/Launch.mp4', sourceDomain: 'media.example', url: 'https://cdn.example/video/launch.mp4' });
    const { port } = createPort({ recent: [report, installer, video] });

    await renderPanel({ downloadsPort: port });

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search downloads' }), { target: { value: 'tools.example' } });
    expect(visibleRows()).toEqual(['Setup.dmg']);

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search downloads' }), { target: { value: 'launch.mp4' } });
    expect(visibleRows()).toEqual(['Launch.mp4']);

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search downloads' }), { target: { value: 'finance' } });
    expect(visibleRows()).toEqual(['Quarterly Report.pdf']);
  });

  it('shows an empty state when there are no downloads', async () => {
    const { port } = createPort();

    await renderPanel({ downloadsPort: port });

    expect(screen.getByRole('region', { name: 'No downloads' })).toBeTruthy();
    expect(screen.getByText('Downloads you start will appear here.')).toBeTruthy();
  });

  it('refreshes downloads when the runtime invalidation message arrives', async () => {
    const runtimeMessages = createRuntimeMessages();
    const first = download({ id: 1, basename: 'Initial', filename: '/tmp/Initial.pdf' });
    const refreshed = download({ id: 2, basename: 'Refreshed', extension: 'zip', filename: '/tmp/Refreshed.zip', category: 'archive' });
    let recent = [first];
    const { port } = createPort();
    vi.mocked(port.search).mockImplementation(async (query: DownloadSearchQuery) => {
      if (query.state === 'in_progress') {
        return [];
      }
      return recent;
    });

    await renderPanel({ downloadsPort: port, runtimeMessages });
    recent = [refreshed];

    act(() => runtimeMessages.send({ type: 'downloads-invalidated' }));

    await waitFor(() => expect(visibleRows()).toEqual(['Refreshed.zip']));
  });

  it('keeps newer refresh results when an older load resolves later', async () => {
    const runtimeMessages = createRuntimeMessages();
    const firstActive = deferred<DownloadRecord[]>();
    const firstRecent = deferred<DownloadRecord[]>();
    const secondActive = deferred<DownloadRecord[]>();
    const secondRecent = deferred<DownloadRecord[]>();
    const stale = download({ id: 1, basename: 'Stale', filename: '/tmp/Stale.pdf' });
    const fresh = download({ id: 2, basename: 'Fresh', extension: 'zip', filename: '/tmp/Fresh.zip', category: 'archive' });
    const activeResponses = [firstActive, secondActive];
    const recentResponses = [firstRecent, secondRecent];
    const { port } = createPort();
    vi.mocked(port.search).mockImplementation((query: DownloadSearchQuery) => {
      if (query.state === 'in_progress') {
        return (activeResponses.shift() ?? deferred<DownloadRecord[]>()).promise;
      }
      return (recentResponses.shift() ?? deferred<DownloadRecord[]>()).promise;
    });

    render(<SidePanelApp downloadsPort={port} runtimeMessages={runtimeMessages} />);
    await waitFor(() => expect(port.search).toHaveBeenCalledTimes(2));

    act(() => runtimeMessages.send({ type: 'downloads-invalidated' }));
    await waitFor(() => expect(port.search).toHaveBeenCalledTimes(4));

    await act(async () => {
      secondActive.resolve([]);
      secondRecent.resolve([fresh]);
      await Promise.resolve();
    });
    await waitFor(() => expect(visibleRows()).toEqual(['Fresh.zip']));

    await act(async () => {
      firstActive.resolve([]);
      firstRecent.resolve([stale]);
      await Promise.resolve();
    });

    expect(visibleRows()).toEqual(['Fresh.zip']);
  });

  it('polls active downloads every second only while the panel is visible and active downloads exist', async () => {
    vi.useFakeTimers();
    const active = download({ id: 5, basename: 'Movie', extension: 'mp4', filename: '/tmp/Movie.mp4', state: 'in_progress', bytesReceived: 100, totalBytes: 1_000 });
    const nextActive = download({ ...active, bytesReceived: 300 });
    const completed = download({ ...active, state: 'complete', bytesReceived: 1_000, endTime: '2026-08-14T10:02:00.000Z' });
    let activeResponses = [[active], [nextActive], [], [completed]];
    const { port } = createPort({ recent: [] });
    vi.mocked(port.search).mockImplementation(async (query: DownloadSearchQuery) => {
      if (query.state === 'in_progress') {
        return activeResponses.shift() ?? [];
      }
      return [];
    });

    await renderPanel({ downloadsPort: port });
    expect(port.search).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(port.search).toHaveBeenCalledTimes(3);
    expect(screen.getByText('200 B/s')).toBeTruthy();

    setVisibilityState('hidden');
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    activeResponses = [[completed]];

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(port.search).toHaveBeenCalledTimes(3);

    setVisibilityState('visible');
    act(() => document.dispatchEvent(new Event('visibilitychange')));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(port.search).toHaveBeenCalledTimes(4);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(port.search).toHaveBeenCalledTimes(4);
  });

  it('ignores an in-flight polling result after the panel becomes hidden', async () => {
    vi.useFakeTimers();
    const active = download({ id: 8, basename: 'Large', extension: 'zip', filename: '/tmp/Large.zip', state: 'in_progress', bytesReceived: 100, totalBytes: 1_000 });
    const pollResponse = deferred<DownloadRecord[]>();
    const { port } = createPort({ recent: [] });
    vi.mocked(port.search).mockImplementation((query: DownloadSearchQuery) => {
      if (query.state === 'in_progress' && vi.mocked(port.search).mock.calls.length > 1) {
        return pollResponse.promise;
      }
      if (query.state === 'in_progress') {
        return Promise.resolve([active]);
      }
      return Promise.resolve([]);
    });

    await renderPanel({ downloadsPort: port });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(port.search).toHaveBeenCalledTimes(3);

    setVisibilityState('hidden');
    act(() => document.dispatchEvent(new Event('visibilitychange')));

    await act(async () => {
      pollResponse.resolve([]);
      await Promise.resolve();
    });

    expect(visibleRows()).toEqual(['Large.zip']);
    expect(screen.getByLabelText('Active downloads').textContent).toBe('1 active');
  });

  it('wires pause, resume, cancel, open, and show in folder actions to the downloads port', async () => {
    const active = download({ id: 1, basename: 'Active', extension: 'zip', filename: '/tmp/Active.zip', state: 'in_progress', paused: false });
    const paused = download({ id: 2, basename: 'Paused', extension: 'zip', filename: '/tmp/Paused.zip', state: 'in_progress', paused: true });
    const completed = download({ id: 3, basename: 'Complete', filename: '/tmp/Complete.pdf', state: 'complete' });
    const { port } = createPort({ active: [active, paused], recent: [completed] });

    await renderPanel({ downloadsPort: port });

    fireEvent.click(screen.getByRole('button', { name: 'Pause Active.zip' }));
    fireEvent.click(screen.getByRole('button', { name: 'Resume Paused.zip' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel Active.zip' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open Complete.pdf' }));
    fireEvent.click(within(screen.getByRole('article', { name: 'Complete.pdf' })).getByRole('button', { name: 'Show Complete.pdf in folder' }));

    expect(port.pause).toHaveBeenCalledWith(1);
    expect(port.resume).toHaveBeenCalledWith(2);
    expect(port.cancel).toHaveBeenCalledWith(1);
    expect(port.open).toHaveBeenCalledWith(3);
    expect(port.show).toHaveBeenCalledWith(3);
  });

  it('opens the full manager with an injected adapter', async () => {
    const { port } = createPort();
    const openManager = vi.fn();

    await renderPanel({ downloadsPort: port, openManager });

    fireEvent.click(screen.getByRole('button', { name: 'Open full manager' }));

    expect(openManager).toHaveBeenCalledOnce();
  });

  it('opens the built manager html path by default', () => {
    const create = vi.fn();
    const getURL = vi.fn((path: string) => `chrome-extension://downly/${path}`);
    vi.stubGlobal('chrome', {
      runtime: { getURL },
      tabs: { create },
    });

    openFullManager();

    expect(getURL).toHaveBeenCalledWith('manager.html');
    expect(create).toHaveBeenCalledWith({ url: 'chrome-extension://downly/manager.html' });
  });
});

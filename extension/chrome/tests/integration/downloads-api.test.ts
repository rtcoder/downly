import { describe, expect, it } from 'vitest';

import type { DownloadRecord } from '../../src/domain/downloads/types';
import { ChromeDownloadsApi, DownlyError } from '../../src/platform/chrome/downloads-api';
import { createChromeMock } from '../../src/test/chrome-mock';

const rawDownload = {
  id: 41,
  filename: '/Users/example/Downloads/report.pdf',
  url: 'https://origin.example/report.pdf',
  finalUrl: 'https://cdn.example/report.pdf',
  state: 'complete' as const,
  exists: true,
  startTime: '2026-08-14T10:00:00.000Z',
};

const downloadRecord: DownloadRecord = {
  id: 41,
  filename: '/Users/example/Downloads/report.pdf',
  basename: 'report',
  extension: 'pdf',
  mime: null,
  category: 'document',
  state: 'complete',
  paused: false,
  canResume: false,
  exists: true,
  danger: 'safe',
  error: null,
  url: 'https://origin.example/report.pdf',
  finalUrl: 'https://cdn.example/report.pdf',
  referrer: null,
  sourceDomain: 'cdn.example',
  bytesReceived: 0,
  totalBytes: 0,
  fileSize: 0,
  startTime: '2026-08-14T10:00:00.000Z',
  endTime: null,
  estimatedEndTime: null,
};

describe('ChromeDownloadsApi', () => {
  it('searches Chrome and returns normalized download records', async () => {
    const chrome = createChromeMock();
    chrome.results.search = [rawDownload];

    const downloads = await new ChromeDownloadsApi(chrome).search({
      state: 'complete',
      startedAfter: '2026-08-01T00:00:00.000Z',
      startedBefore: '2026-08-15T00:00:00.000Z',
      limit: 25,
      orderBy: ['-startTime'],
    });

    expect(downloads).toMatchObject([
      {
        id: 41,
        basename: 'report',
        extension: 'pdf',
        state: 'complete',
        sourceDomain: 'cdn.example',
      },
    ]);
    expect(chrome.calls).toContainEqual({
      method: 'search',
      args: [{
        state: 'complete',
        startedAfter: '2026-08-01T00:00:00.000Z',
        startedBefore: '2026-08-15T00:00:00.000Z',
        limit: 25,
        orderBy: ['-startTime'],
      }],
    });
  });

  it('gets and normalizes the matching download or null', async () => {
    const chrome = createChromeMock();
    chrome.results.search = [rawDownload];
    const api = new ChromeDownloadsApi(chrome);

    await expect(api.getById(41)).resolves.toMatchObject({ id: 41, basename: 'report' });
    expect(chrome.calls).toContainEqual({ method: 'search', args: [{ id: 41 }] });

    chrome.results.search = [];
    await expect(api.getById(999)).resolves.toBeNull();
  });

  it.each(['pause', 'resume', 'cancel', 'open', 'removeFile'] as const)(
    'forwards %s to Chrome for the requested download',
    async (method) => {
      const chrome = createChromeMock();
      const api = new ChromeDownloadsApi(chrome);

      await api[method](41);

      expect(chrome.calls).toContainEqual({ method, args: [41] });
    },
  );

  it('shows a download and the default download folder', () => {
    const chrome = createChromeMock();
    const api = new ChromeDownloadsApi(chrome);

    api.show(41);
    api.showDefaultFolder();

    expect(chrome.calls).toContainEqual({ method: 'show', args: [41] });
    expect(chrome.calls).toContainEqual({ method: 'showDefaultFolder', args: [] });
  });

  it('erases a download by id and returns Chrome erased ids', async () => {
    const chrome = createChromeMock();
    chrome.results.erase = [41];

    await expect(new ChromeDownloadsApi(chrome).eraseById(41)).resolves.toEqual([41]);
    expect(chrome.calls).toContainEqual({ method: 'erase', args: [{ id: 41 }] });
  });

  it('downloads again from finalUrl and requests a unique filename', async () => {
    const chrome = createChromeMock();
    chrome.results.download = 82;

    await expect(new ChromeDownloadsApi(chrome).downloadAgain(downloadRecord)).resolves.toBe(82);

    expect(chrome.calls).toContainEqual({
      method: 'download',
      args: [{ url: 'https://cdn.example/report.pdf', conflictAction: 'uniquify' }],
    });
  });

  it('downloads again from url when finalUrl is unavailable', async () => {
    const chrome = createChromeMock();

    await new ChromeDownloadsApi(chrome).downloadAgain({
      ...downloadRecord,
      finalUrl: null,
    });

    expect(chrome.calls).toContainEqual({
      method: 'download',
      args: [{ url: 'https://origin.example/report.pdf', conflictAction: 'uniquify' }],
    });
  });

  it('converts Chrome lastError and rejected calls to typed errors', async () => {
    const chrome = createChromeMock();
    chrome.runtime.lastError = { message: 'Denied by Chrome' };

    await expect(new ChromeDownloadsApi(chrome).pause(41)).rejects.toMatchObject({
      name: 'DownlyError',
      code: 'chrome-api-error',
      message: 'Denied by Chrome',
    } satisfies Partial<DownlyError>);

    const rejectingChrome = createChromeMock();
    rejectingChrome.downloads.download = () => Promise.reject(new Error('Download rejected'));

    await expect(new ChromeDownloadsApi(rejectingChrome).downloadAgain(downloadRecord)).rejects.toMatchObject({
      name: 'DownlyError',
      code: 'download-retry-failed',
      message: 'Download rejected',
    } satisfies Partial<DownlyError>);
  });

  it('does not let callback lastError poison the next callback operation', async () => {
    const chrome = createChromeMock();
    const api = new ChromeDownloadsApi(chrome);
    chrome.runtime.lastError = { message: 'Denied by Chrome' };

    await expect(api.pause(41)).rejects.toMatchObject({ code: 'chrome-api-error' });
    await expect(api.resume(41)).resolves.toBeUndefined();
  });

  it('does not read stale callback lastError for synchronous Chrome APIs', () => {
    const chrome = createChromeMock();
    chrome.runtime.lastError = { message: 'Previous callback error' };

    expect(() => new ChromeDownloadsApi(chrome).show(41)).not.toThrow();
  });

  it('converts synchronous show exceptions to typed errors', () => {
    const chrome = createChromeMock();
    chrome.downloads.show = () => {
      throw new Error('Unable to show download');
    };

    let thrown: unknown;
    try {
      new ChromeDownloadsApi(chrome).show(41);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toMatchObject({
      name: 'DownlyError',
      code: 'chrome-api-error',
      message: 'Unable to show download',
    } satisfies Partial<DownlyError>);
  });

  it('rejects downloadAgain with a typed error when no URL is available', async () => {
    const chrome = createChromeMock();

    await expect(new ChromeDownloadsApi(chrome).downloadAgain({
      ...downloadRecord,
      url: '',
      finalUrl: null,
    })).rejects.toMatchObject({
      name: 'DownlyError',
      code: 'download-retry-failed',
    } satisfies Partial<DownlyError>);
  });
});

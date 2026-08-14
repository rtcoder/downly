import { describe, expect, it, vi } from 'vitest';

import {
  createDownloadActionService,
  DownloadActionError,
  getDownloadActionAvailability,
  type ClipboardPort,
} from '../../src/application/download-actions';
import type { DownloadsPort } from '../../src/application/download-repository';
import type { DownloadRecord } from '../../src/domain/downloads/types';

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
    finalUrl: 'https://cdn.example.com/report.pdf',
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

function createPort() {
  const port: DownloadsPort = {
    search: vi.fn(async () => []),
    getById: vi.fn(async () => null),
    pause: vi.fn(async () => undefined),
    resume: vi.fn(async () => undefined),
    cancel: vi.fn(async () => undefined),
    open: vi.fn(async () => undefined),
    show: vi.fn(),
    showDefaultFolder: vi.fn(),
    removeFile: vi.fn(async () => undefined),
    eraseById: vi.fn(async () => []),
    downloadAgain: vi.fn(async () => 42),
  };

  return port;
}

function createClipboard() {
  const clipboard: ClipboardPort = {
    writeText: vi.fn(async () => undefined),
  };

  return clipboard;
}

describe('download action service', () => {
  it('pauses active downloads that are not already paused', async () => {
    const port = createPort();
    const service = createDownloadActionService({ downloadsPort: port });

    await service.pause(download({ state: 'in_progress', paused: false }));

    expect(port.pause).toHaveBeenCalledWith(1);
  });

  it('resumes paused active downloads and resumable interrupted downloads', async () => {
    const port = createPort();
    const service = createDownloadActionService({ downloadsPort: port });

    await service.resume(download({ id: 2, state: 'in_progress', paused: true }));
    await service.resume(download({ id: 3, state: 'interrupted', canResume: true }));

    expect(port.resume).toHaveBeenCalledWith(2);
    expect(port.resume).toHaveBeenCalledWith(3);
  });

  it('cancels only active downloads', async () => {
    const port = createPort();
    const service = createDownloadActionService({ downloadsPort: port });

    await service.cancel(download({ state: 'in_progress' }));

    expect(port.cancel).toHaveBeenCalledWith(1);
  });

  it('retries interrupted downloads by resuming when possible and downloading again otherwise', async () => {
    const port = createPort();
    const service = createDownloadActionService({ downloadsPort: port });
    const resumable = download({ id: 4, state: 'interrupted', canResume: true });
    const notResumable = download({ id: 5, state: 'interrupted', canResume: false });

    await service.retry(resumable);
    await service.retry(notResumable);

    expect(port.resume).toHaveBeenCalledWith(4);
    expect(port.downloadAgain).toHaveBeenCalledWith(notResumable);
  });

  it('downloads any record again from the downloads port', async () => {
    const port = createPort();
    const service = createDownloadActionService({ downloadsPort: port });
    const record = download({ id: 6, state: 'complete' });

    await expect(service.downloadAgain(record)).resolves.toBe(42);

    expect(port.downloadAgain).toHaveBeenCalledWith(record);
  });

  it('opens and shows only records whose file still exists', async () => {
    const port = createPort();
    const service = createDownloadActionService({ downloadsPort: port });
    const record = download({ id: 7, state: 'complete', exists: true });

    await service.open(record);
    service.showInFolder(record);

    expect(port.open).toHaveBeenCalledWith(7);
    expect(port.show).toHaveBeenCalledWith(7);
  });

  it('erases history without deleting the file', async () => {
    const port = createPort();
    const service = createDownloadActionService({ downloadsPort: port });

    await service.eraseHistory(download({ id: 8, exists: true }));

    expect(port.eraseById).toHaveBeenCalledWith(8);
    expect(port.removeFile).not.toHaveBeenCalled();
  });

  it('removes a file from disk without erasing history', async () => {
    const port = createPort();
    const service = createDownloadActionService({ downloadsPort: port });

    await service.removeFile(download({ id: 9, state: 'complete', exists: true }));

    expect(port.removeFile).toHaveBeenCalledWith(9);
    expect(port.eraseById).not.toHaveBeenCalled();
  });

  it('copies source and final URLs through an injected clipboard port', async () => {
    const port = createPort();
    const clipboard = createClipboard();
    const service = createDownloadActionService({ downloadsPort: port, clipboard });
    const record = download({
      url: 'https://origin.example/report.pdf',
      finalUrl: 'https://cdn.example/report.pdf',
    });

    await service.copySourceUrl(record);
    await service.copyFinalUrl(record);

    expect(clipboard.writeText).toHaveBeenCalledWith('https://origin.example/report.pdf');
    expect(clipboard.writeText).toHaveBeenCalledWith('https://cdn.example/report.pdf');
  });

  it('reports unavailable clipboard as an action failure', async () => {
    const port = createPort();
    const service = createDownloadActionService({ downloadsPort: port });

    await expect(service.copySourceUrl(download())).rejects.toMatchObject({
      code: 'clipboard-unavailable',
      message: 'Clipboard is unavailable.',
    });
  });

  it('does not call the port for invalid actions', async () => {
    const port = createPort();
    const service = createDownloadActionService({ downloadsPort: port });

    await expect(service.pause(download({ state: 'complete' }))).rejects.toBeInstanceOf(DownloadActionError);
    await expect(service.open(download({ state: 'complete', exists: false }))).rejects.toMatchObject({
      code: 'action-unavailable',
    });

    expect(port.pause).not.toHaveBeenCalled();
    expect(port.open).not.toHaveBeenCalled();
  });

  it('propagates download port and clipboard failures', async () => {
    const port = createPort();
    const clipboard = createClipboard();
    const portError = new Error('Chrome denied the action.');
    const clipboardError = new Error('Clipboard denied write.');
    vi.mocked(port.removeFile).mockRejectedValue(portError);
    vi.mocked(clipboard.writeText).mockRejectedValue(clipboardError);
    const service = createDownloadActionService({ downloadsPort: port, clipboard });

    await expect(service.removeFile(download({ state: 'complete', exists: true }))).rejects.toBe(portError);
    await expect(service.copySourceUrl(download())).rejects.toBe(clipboardError);
  });

  it('describes action availability from download state and file existence', () => {
    expect(getDownloadActionAvailability(download({ state: 'in_progress', paused: false }))).toMatchObject({
      canPause: true,
      canResume: false,
      canCancel: true,
      canOpen: false,
      canShowInFolder: true,
      canRemoveFile: false,
    });
    expect(getDownloadActionAvailability(download({ state: 'interrupted', canResume: true }))).toMatchObject({
      canPause: false,
      canResume: true,
      canRetry: true,
      canDownloadAgain: true,
    });
    expect(getDownloadActionAvailability(download({ state: 'complete', exists: false }))).toMatchObject({
      canOpen: false,
      canShowInFolder: false,
      canEraseHistory: true,
      canRemoveFile: false,
      canCopySourceUrl: true,
      canCopyFinalUrl: true,
    });
  });
});

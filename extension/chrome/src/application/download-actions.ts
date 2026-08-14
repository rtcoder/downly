import type { DownloadRecord } from '../domain/downloads/types';
import type { DownloadsPort } from './download-repository';

export type DownloadActionErrorCode = 'action-unavailable' | 'clipboard-unavailable';

export class DownloadActionError extends Error {
  constructor(
    public readonly code: DownloadActionErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'DownloadActionError';
  }
}

export interface ClipboardPort {
  writeText(text: string): Promise<void>;
}

export interface DownloadActionAvailability {
  canPause: boolean;
  canResume: boolean;
  canCancel: boolean;
  canRetry: boolean;
  canDownloadAgain: boolean;
  canOpen: boolean;
  canShowInFolder: boolean;
  canEraseHistory: boolean;
  canRemoveFile: boolean;
  canCopySourceUrl: boolean;
  canCopyFinalUrl: boolean;
}

export interface DownloadActionService {
  pause(download: DownloadRecord): Promise<void>;
  resume(download: DownloadRecord): Promise<void>;
  cancel(download: DownloadRecord): Promise<void>;
  retry(download: DownloadRecord): Promise<number | void>;
  downloadAgain(download: DownloadRecord): Promise<number>;
  open(download: DownloadRecord): Promise<void>;
  showInFolder(download: DownloadRecord): void;
  showDefaultFolder(): void;
  eraseHistory(download: DownloadRecord): Promise<number[]>;
  removeFile(download: DownloadRecord): Promise<void>;
  copySourceUrl(download: DownloadRecord): Promise<void>;
  copyFinalUrl(download: DownloadRecord): Promise<void>;
}

export interface DownloadActionServiceOptions {
  downloadsPort: DownloadsPort;
  clipboard?: ClipboardPort;
}

export function createDownloadActionService({
  downloadsPort,
  clipboard = defaultClipboard(),
}: DownloadActionServiceOptions): DownloadActionService {
  return {
    async pause(download) {
      requireAvailable(getDownloadActionAvailability(download).canPause);
      await downloadsPort.pause(download.id);
    },
    async resume(download) {
      requireAvailable(getDownloadActionAvailability(download).canResume);
      await downloadsPort.resume(download.id);
    },
    async cancel(download) {
      requireAvailable(getDownloadActionAvailability(download).canCancel);
      await downloadsPort.cancel(download.id);
    },
    async retry(download) {
      requireAvailable(getDownloadActionAvailability(download).canRetry);

      if (download.canResume) {
        await downloadsPort.resume(download.id);
        return undefined;
      }

      return downloadsPort.downloadAgain(download);
    },
    async downloadAgain(download) {
      requireAvailable(getDownloadActionAvailability(download).canDownloadAgain);
      return downloadsPort.downloadAgain(download);
    },
    async open(download) {
      requireAvailable(getDownloadActionAvailability(download).canOpen);
      await downloadsPort.open(download.id);
    },
    showInFolder(download) {
      requireAvailable(getDownloadActionAvailability(download).canShowInFolder);
      downloadsPort.show(download.id);
    },
    showDefaultFolder() {
      downloadsPort.showDefaultFolder();
    },
    async eraseHistory(download) {
      requireAvailable(getDownloadActionAvailability(download).canEraseHistory);
      return downloadsPort.eraseById(download.id);
    },
    async removeFile(download) {
      requireAvailable(getDownloadActionAvailability(download).canRemoveFile);
      await downloadsPort.removeFile(download.id);
    },
    copySourceUrl(download) {
      requireAvailable(getDownloadActionAvailability(download).canCopySourceUrl);
      return writeToClipboard(clipboard, download.url);
    },
    copyFinalUrl(download) {
      requireAvailable(getDownloadActionAvailability(download).canCopyFinalUrl);
      return writeToClipboard(clipboard, download.finalUrl);
    },
  };
}

export function getDownloadActionAvailability(download: DownloadRecord): DownloadActionAvailability {
  const isActive = download.state === 'in_progress';
  const isInterrupted = download.state === 'interrupted';

  return {
    canPause: isActive && !download.paused,
    canResume: (isActive && download.paused) || (isInterrupted && download.canResume),
    canCancel: isActive,
    canRetry: isInterrupted,
    canDownloadAgain: Boolean(download.url || download.finalUrl),
    canOpen: download.state === 'complete' && download.exists,
    canShowInFolder: download.exists,
    canEraseHistory: true,
    canRemoveFile: download.state === 'complete' && download.exists,
    canCopySourceUrl: Boolean(download.url),
    canCopyFinalUrl: Boolean(download.finalUrl),
  };
}

function requireAvailable(available: boolean): void {
  if (!available) {
    throw new DownloadActionError('action-unavailable', 'Download action is unavailable.');
  }
}

async function writeToClipboard(clipboard: ClipboardPort | undefined, text: string | null): Promise<void> {
  if (!clipboard || !text) {
    throw new DownloadActionError('clipboard-unavailable', 'Clipboard is unavailable.');
  }

  await clipboard.writeText(text);
}

function defaultClipboard(): ClipboardPort | undefined {
  const clipboard = (globalThis as typeof globalThis & {
    navigator?: {
      clipboard?: {
        writeText?: (text: string) => Promise<void>;
      };
    };
  }).navigator?.clipboard;

  return clipboard?.writeText ? { writeText: (text: string) => clipboard.writeText!(text) } : undefined;
}

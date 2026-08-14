import type { DownloadSearchQuery, DownloadsPort } from '../../application/download-repository';
import { normalizeDownload, type RawChromeDownload } from '../../domain/downloads/normalize-download';
import type { DownloadRecord } from '../../domain/downloads/types';

export type DownlyErrorCode = 'download-not-found' | 'download-retry-failed' | 'chrome-api-error';

export class DownlyError extends Error {
  constructor(
    public readonly code: DownlyErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'DownlyError';
  }
}

type Callback<T> = (result: T) => void;

interface ChromeDownloadsApiLike {
  runtime?: { lastError?: { message?: string } };
  downloads: {
    search(query: DownloadSearchQuery & { id?: number }, callback: Callback<RawChromeDownload[]>): void | Promise<unknown>;
    pause(id: number, callback: Callback<void>): void | Promise<unknown>;
    resume(id: number, callback: Callback<void>): void | Promise<unknown>;
    cancel(id: number, callback: Callback<void>): void | Promise<unknown>;
    open(id: number, callback: Callback<void>): void | Promise<unknown>;
    show(id: number): void;
    showDefaultFolder(): void;
    removeFile(id: number, callback: Callback<void>): void | Promise<unknown>;
    erase(query: { id: number }, callback: Callback<number[]>): void | Promise<unknown>;
    download(
      options: { url: string; conflictAction: 'uniquify' },
      callback: Callback<number>,
    ): void | Promise<unknown>;
  };
}

export class ChromeDownloadsApi implements DownloadsPort {
  constructor(
    private readonly chromeApi: ChromeDownloadsApiLike = (
      globalThis as typeof globalThis & { chrome: ChromeDownloadsApiLike }
    ).chrome,
  ) {}

  async search(query: DownloadSearchQuery): Promise<DownloadRecord[]> {
    return (await this.searchRaw(query)).map(normalizeDownload);
  }

  async getById(id: number): Promise<DownloadRecord | null> {
    const records = await this.searchRaw({ id });
    const record = records[0];

    return record ? normalizeDownload(record) : null;
  }

  pause(id: number): Promise<void> {
    return this.call((callback) => this.chromeApi.downloads.pause(id, callback));
  }

  resume(id: number): Promise<void> {
    return this.call((callback) => this.chromeApi.downloads.resume(id, callback));
  }

  cancel(id: number): Promise<void> {
    return this.call((callback) => this.chromeApi.downloads.cancel(id, callback));
  }

  open(id: number): Promise<void> {
    return this.call((callback) => this.chromeApi.downloads.open(id, callback));
  }

  show(id: number): void {
    this.callSync(() => this.chromeApi.downloads.show(id));
  }

  showDefaultFolder(): void {
    this.callSync(() => this.chromeApi.downloads.showDefaultFolder());
  }

  removeFile(id: number): Promise<void> {
    return this.call((callback) => this.chromeApi.downloads.removeFile(id, callback));
  }

  eraseById(id: number): Promise<number[]> {
    return this.call((callback) => this.chromeApi.downloads.erase({ id }, callback));
  }

  downloadAgain(record: DownloadRecord): Promise<number> {
    const url = record.finalUrl ?? record.url;

    if (!url) {
      return Promise.reject(new DownlyError('download-retry-failed', 'No download URL is available.'));
    }

    return this.call(
      (callback) => this.chromeApi.downloads.download({ url, conflictAction: 'uniquify' }, callback),
      'download-retry-failed',
    );
  }

  private searchRaw(query: DownloadSearchQuery & { id?: number }): Promise<RawChromeDownload[]> {
    return this.call((callback) => this.chromeApi.downloads.search(query, callback));
  }

  private call<T>(
    operation: (callback: Callback<T>) => void | Promise<unknown>,
    code: DownlyErrorCode = 'chrome-api-error',
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const callback = (result: T): void => {
        const lastError = this.chromeApi.runtime?.lastError;
        if (lastError) {
          reject(this.toDownlyError(lastError, code));
          return;
        }

        resolve(result);
      };

      try {
        const outcome = operation(callback);
        if (outcome && typeof outcome.then === 'function') {
          void outcome.catch((error: unknown) => reject(this.toDownlyError(error, code)));
        }
      } catch (error) {
        reject(this.toDownlyError(error, code));
      }
    });
  }

  private callSync(operation: () => void): void {
    try {
      operation();
      const lastError = this.chromeApi.runtime?.lastError;
      if (lastError) {
        throw this.toDownlyError(lastError, 'chrome-api-error');
      }
    } catch (error) {
      throw this.toDownlyError(error, 'chrome-api-error');
    }
  }

  private toDownlyError(error: unknown, code: DownlyErrorCode): DownlyError {
    if (error instanceof DownlyError) {
      return error;
    }

    const message =
      typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string'
        ? error.message
        : 'Chrome API call failed.';

    return new DownlyError(code, message);
  }
}

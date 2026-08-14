export type ChromeStorageErrorCode = 'chrome-storage-error';

export class ChromeStorageError extends Error {
  constructor(
    public readonly code: ChromeStorageErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ChromeStorageError';
  }
}

type Callback<T> = (result: T) => void;

interface ChromeStorageApiLike {
  runtime?: { lastError?: { message?: string } };
  storage: {
    local: {
      get(key: string, callback: Callback<Record<string, unknown>>): void | Promise<Record<string, unknown>>;
      set(items: Record<string, unknown>, callback: Callback<void>): void | Promise<void>;
    };
  };
}

export class ChromeStorageApi {
  constructor(
    private readonly chromeApi: ChromeStorageApiLike = (
      globalThis as typeof globalThis & { chrome: ChromeStorageApiLike }
    ).chrome,
  ) {}

  get(key: string): Promise<unknown> {
    return this.call<Record<string, unknown>>((callback) => this.chromeApi.storage.local.get(key, callback)).then(
      (items) => items[key],
    );
  }

  set(items: Record<string, unknown>): Promise<void> {
    return this.call((callback) => this.chromeApi.storage.local.set(items, callback));
  }

  private call<T>(operation: (callback: Callback<T>) => void | Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      let completed = false;
      const finish = (result: T): void => {
        if (completed) return;
        completed = true;

        const lastError = this.chromeApi.runtime?.lastError;
        if (lastError) {
          reject(this.toStorageError(lastError));
          return;
        }

        resolve(result);
      };

      try {
        const outcome = operation(finish);
        if (outcome && typeof outcome.then === 'function') {
          void outcome.then(finish, (error: unknown) => reject(this.toStorageError(error)));
        }
      } catch (error) {
        reject(this.toStorageError(error));
      }
    });
  }

  private toStorageError(error: unknown): ChromeStorageError {
    if (error instanceof ChromeStorageError) return error;

    const message =
      typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string'
        ? error.message
        : 'Chrome storage API call failed.';

    return new ChromeStorageError('chrome-storage-error', message);
  }
}

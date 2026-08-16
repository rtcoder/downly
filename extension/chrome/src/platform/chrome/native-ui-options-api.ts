export interface NativeUiOptionsWarning {
  code: 'native-ui-conflict';
  message: string;
}

export interface NativeUiOptionsResult {
  warning?: NativeUiOptionsWarning;
}

interface ChromeNativeUiOptionsApiLike {
  runtime?: { lastError?: { message?: string } };
  downloads: {
    setUiOptions(options: { enabled: boolean }, callback?: () => void): void | Promise<unknown>;
  };
}

export class ChromeNativeUiOptionsApi {
  constructor(
    private readonly chromeApi: ChromeNativeUiOptionsApiLike = (
      globalThis as typeof globalThis & { chrome: ChromeNativeUiOptionsApiLike }
    ).chrome,
  ) {}

  apply(settings: { replaceNativeDownloadsUi: boolean }): Promise<NativeUiOptionsResult> {
    return new Promise((resolve) => {
      let settled = false;
      const complete = (error?: unknown): void => {
        if (settled) return;
        settled = true;

        const lastError = this.chromeApi.runtime?.lastError;
        const message = lastError?.message ?? this.errorMessage(error);
        resolve(message ? { warning: { code: 'native-ui-conflict', message } } : {});
      };

      try {
        const outcome = this.chromeApi.downloads.setUiOptions({ enabled: !settings.replaceNativeDownloadsUi }, complete);
        if (outcome && typeof outcome.then === 'function') {
          void outcome.then(() => complete(), complete);
        }
      } catch (error) {
        complete(error);
      }
    });
  }

  private errorMessage(error: unknown): string | undefined {
    return typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string'
      ? error.message
      : error === undefined
        ? undefined
        : 'Chrome could not update the download bubble setting.';
  }
}

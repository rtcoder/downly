export interface UiOptionsWarning {
  code: 'native-ui-conflict';
  message: string;
}

export interface UiOptionsResult {
  warning?: UiOptionsWarning;
}

interface ChromeUiOptionsApi {
  runtime?: { lastError?: { message?: string } };
  downloads: {
    setUiOptions(options: { enabled: boolean }, callback?: () => void): void | Promise<unknown>;
  };
}

interface RuntimeStartupApi {
  runtime: {
    onInstalled: { addListener(listener: () => void): void };
    onStartup: { addListener(listener: () => void): void };
  };
}

export type NativeUiSettings = Pick<{ replaceNativeDownloadsUi: boolean }, 'replaceNativeDownloadsUi'>;
export type NativeUiSettingsLoader = () => Promise<NativeUiSettings>;

export class UiOptionsController {
  constructor(private readonly chromeApi: ChromeUiOptionsApi) {}

  apply(settings: NativeUiSettings): Promise<UiOptionsResult> {
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
        : 'Chrome could not update the downloads UI setting.';
  }
}

export function registerUiOptionsListeners(
  chromeApi: RuntimeStartupApi,
  loadSettings: NativeUiSettingsLoader,
  controller: UiOptionsController,
): void {
  const applySavedSettings = (): void => {
    void Promise.resolve()
      .then(loadSettings)
      .then((settings) => controller.apply(settings))
      .catch(() => undefined);
  };

  chromeApi.runtime.onInstalled.addListener(applySavedSettings);
  chromeApi.runtime.onStartup.addListener(applySavedSettings);
}

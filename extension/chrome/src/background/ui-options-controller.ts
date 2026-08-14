import { ChromeNativeUiOptionsApi, type NativeUiOptionsResult } from '../platform/chrome/native-ui-options-api';

export interface UiOptionsWarning {
  code: 'native-ui-conflict';
  message: string;
}

export type UiOptionsResult = NativeUiOptionsResult;

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
  private readonly nativeUiOptions: ChromeNativeUiOptionsApi;

  constructor(chromeApi: ChromeUiOptionsApi) {
    this.nativeUiOptions = new ChromeNativeUiOptionsApi(chromeApi);
  }

  apply(settings: NativeUiSettings): Promise<UiOptionsResult> {
    return this.nativeUiOptions.apply(settings);
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

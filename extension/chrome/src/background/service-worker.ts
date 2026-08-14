import { getSettings } from '../application/settings-repository';
import { ChromeDownloadsApi } from '../platform/chrome/downloads-api';
import { ChromeActionApi } from '../platform/chrome/action-api';
import { ChromeRuntimeApi } from '../platform/chrome/runtime-api';
import { ChromeSidePanelApi } from '../platform/chrome/side-panel-api';
import { BadgeController } from './badge-controller';
import { registerDownloadEventListeners } from './download-events';
import { registerFilenameListener } from './filename-listener';
import { registerUiOptionsListeners, UiOptionsController } from './ui-options-controller';

if (import.meta.env.DEV) {
  console.info('Downly service worker started');
}

type ServiceWorkerChromeApi =
  & Parameters<typeof registerFilenameListener>[0]
  & Parameters<typeof registerDownloadEventListeners>[0]
  & Parameters<typeof registerUiOptionsListeners>[0]
  & ConstructorParameters<typeof ChromeDownloadsApi>[0]
  & ConstructorParameters<typeof ChromeActionApi>[0]
  & ConstructorParameters<typeof ChromeRuntimeApi>[0]
  & ConstructorParameters<typeof ChromeSidePanelApi>[0]
  & ConstructorParameters<typeof UiOptionsController>[0];

type ChromeIntegrationControlsApi =
  & ConstructorParameters<typeof ChromeRuntimeApi>[0]
  & ConstructorParameters<typeof ChromeSidePanelApi>[0]
  & {
  runtime: {
    getURL(path: string): string;
    getManifest?: () => { version?: string };
    sendMessage?: (message: { type: 'settings-updated' }) => void | Promise<unknown>;
    onMessage?: {
      addListener(listener: (message: unknown) => void): void;
    };
  };
  commands?: {
    onCommand?: {
      addListener(listener: (command: string) => void): void;
    };
  };
};

type SettingsUpdateDependencies = {
  refreshBadge: () => Promise<void> | void;
  applyNativeUiOptions: () => Promise<unknown> | unknown;
};

export function registerChromeIntegrationControls(chromeApi: ChromeIntegrationControlsApi): void {
  const runtimeApi = new ChromeRuntimeApi(chromeApi);
  void new ChromeSidePanelApi(chromeApi).configureActionClickOpening();

  chromeApi.commands?.onCommand?.addListener((command) => {
    if (command === 'open-downly-manager') {
      void runtimeApi.openManager();
    }
  });
}

export function registerSettingsUpdateListener(
  chromeApi: Pick<ChromeIntegrationControlsApi, 'runtime'>,
  dependencies: SettingsUpdateDependencies,
): void {
  chromeApi.runtime.onMessage?.addListener((message) => {
    if (!isSettingsUpdatedMessage(message)) return;

    void Promise.resolve(dependencies.applyNativeUiOptions())
      .catch(() => undefined)
      .then(() => Promise.resolve(dependencies.refreshBadge()).catch(() => undefined));
  });
}

function isSettingsUpdatedMessage(message: unknown): message is { type: 'settings-updated' } {
  return (
    typeof message === 'object'
    && message !== null
    && 'type' in message
    && message.type === 'settings-updated'
  );
}

const chromeApi = (globalThis as typeof globalThis & { chrome?: ServiceWorkerChromeApi & ChromeIntegrationControlsApi }).chrome;

if (chromeApi) {
  const downloadsApi = new ChromeDownloadsApi(chromeApi);
  const badgeController = new BadgeController(
    new ChromeActionApi(chromeApi),
    (query) => downloadsApi.search(query),
    getSettings,
  );

  registerChromeIntegrationControls(chromeApi);
  registerFilenameListener(chromeApi);
  registerDownloadEventListeners(chromeApi, () => badgeController.refresh());
  const uiOptionsController = new UiOptionsController(chromeApi);
  registerUiOptionsListeners(chromeApi, getSettings, uiOptionsController);
  registerSettingsUpdateListener(chromeApi, {
    applyNativeUiOptions: async () => uiOptionsController.apply(await getSettings()),
    refreshBadge: () => badgeController.refresh(),
  });
}

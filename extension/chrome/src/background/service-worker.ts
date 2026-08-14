import { getSettings } from '../application/settings-repository';
import { ChromeDownloadsApi } from '../platform/chrome/downloads-api';
import { ChromeActionApi } from '../platform/chrome/action-api';
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
  & ConstructorParameters<typeof UiOptionsController>[0];

const chromeApi = (globalThis as typeof globalThis & { chrome: ServiceWorkerChromeApi }).chrome;
const downloadsApi = new ChromeDownloadsApi(chromeApi);
const badgeController = new BadgeController(new ChromeActionApi(chromeApi), (query) => downloadsApi.search(query));

registerFilenameListener(chromeApi);
registerDownloadEventListeners(chromeApi, () => badgeController.refresh());
registerUiOptionsListeners(chromeApi, getSettings, new UiOptionsController(chromeApi));

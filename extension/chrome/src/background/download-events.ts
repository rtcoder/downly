type DownloadLifecycleEvent = { id: number };
type Listener<T> = (value: T) => void;

interface ChromeDownloadEventsApi {
  downloads: {
    onCreated: { addListener(listener: Listener<DownloadLifecycleEvent>): void };
    onChanged: { addListener(listener: Listener<DownloadLifecycleEvent>): void };
    onErased: { addListener(listener: Listener<number>): void };
  };
  runtime: {
    sendMessage(message: { type: 'downloads-invalidated'; downloadId?: number }): void | Promise<unknown>;
  };
}

export type BadgeRefresher = () => Promise<void> | void;

export function registerDownloadEventListeners(chromeApi: ChromeDownloadEventsApi, refreshBadge: BadgeRefresher): void {
  const handleEvent = (downloadId: number): void => {
    void Promise.resolve(chromeApi.runtime.sendMessage({ type: 'downloads-invalidated', downloadId }))
      .catch(() => undefined)
      .then(() => Promise.resolve(refreshBadge()).catch(() => undefined));
  };

  chromeApi.downloads.onCreated.addListener((download) => handleEvent(download.id));
  chromeApi.downloads.onChanged.addListener((change) => handleEvent(change.id));
  chromeApi.downloads.onErased.addListener(handleEvent);
}

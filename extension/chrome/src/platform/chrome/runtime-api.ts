export type ManagerRuntimeView = 'settings' | 'organizer';

interface ChromeRuntimeApiLike {
  runtime: {
    getURL(path: string): string;
    getManifest?: () => { version?: string };
    sendMessage?: (message: { type: 'settings-updated' }) => void | Promise<unknown>;
  };
  tabs?: {
    create(options: { url: string }): void | Promise<unknown>;
  };
}

export class ChromeRuntimeApi {
  constructor(
    private readonly chromeApi: ChromeRuntimeApiLike = (
      globalThis as typeof globalThis & { chrome: ChromeRuntimeApiLike }
    ).chrome,
  ) {}

  getManagerUrl(view?: ManagerRuntimeView): string {
    const path = view ? `manager.html?view=${encodeURIComponent(view)}` : 'manager.html';
    return this.chromeApi.runtime.getURL(path);
  }

  async openManager(view?: ManagerRuntimeView): Promise<void> {
    const url = this.getManagerUrl(view);

    if (this.chromeApi.tabs?.create) {
      await this.chromeApi.tabs.create({ url });
      return;
    }

    window.open(url);
  }

  getVersion(): string {
    return this.chromeApi.runtime.getManifest?.().version ?? 'unknown';
  }

  async sendSettingsUpdated(): Promise<void> {
    await this.chromeApi.runtime.sendMessage?.({ type: 'settings-updated' });
  }
}

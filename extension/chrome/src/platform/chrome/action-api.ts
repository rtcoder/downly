interface ChromeActionApiLike {
  action: {
    setBadgeText(details: { text: string }): void | Promise<unknown>;
  };
}

export class ChromeActionApi {
  constructor(
    private readonly chromeApi: ChromeActionApiLike = (
      globalThis as typeof globalThis & { chrome: ChromeActionApiLike }
    ).chrome,
  ) {}

  async setBadgeText(text: string): Promise<void> {
    await this.chromeApi.action.setBadgeText({ text });
  }
}

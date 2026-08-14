interface ChromeSidePanelApiLike {
  sidePanel?: {
    setPanelBehavior(options: { openPanelOnActionClick: boolean }): void | Promise<unknown>;
  };
}

export class ChromeSidePanelApi {
  constructor(
    private readonly chromeApi: ChromeSidePanelApiLike = (
      globalThis as typeof globalThis & { chrome: ChromeSidePanelApiLike }
    ).chrome,
  ) {}

  async configureActionClickOpening(): Promise<void> {
    await this.chromeApi.sidePanel?.setPanelBehavior({ openPanelOnActionClick: true });
  }
}

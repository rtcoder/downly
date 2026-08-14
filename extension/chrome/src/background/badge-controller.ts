type ActiveDownloadSearch = (query: { state: 'in_progress' }) => Promise<unknown[]>;
type BadgeSettingsLoader = () => Promise<{ showActiveCountBadge: boolean }>;

interface BadgeAction {
  setBadgeText(text: string): Promise<void> | void;
}

export class BadgeController {
  constructor(
    private readonly action: BadgeAction,
    private readonly searchActiveDownloads: ActiveDownloadSearch,
    private readonly loadSettings: BadgeSettingsLoader = async () => ({ showActiveCountBadge: true }),
  ) {}

  async refresh(): Promise<void> {
    const settings = await this.loadSettings();
    if (!settings.showActiveCountBadge) {
      await this.action.setBadgeText('');
      return;
    }

    const activeDownloads = await this.searchActiveDownloads({ state: 'in_progress' });
    const text = activeDownloads.length === 0 ? '' : activeDownloads.length >= 10 ? '9+' : String(activeDownloads.length);

    await this.action.setBadgeText(text);
  }
}

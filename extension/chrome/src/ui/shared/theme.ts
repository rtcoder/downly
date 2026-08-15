import {getSettings, type SettingsStoragePort} from '../../application/settings-repository';
import type {DownlySettings} from '../../domain/settings/types';

export function applyTheme(theme: DownlySettings['theme']): void {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme === 'system' ? 'light dark' : theme;
}

export async function initializeTheme(storage?: SettingsStoragePort): Promise<void> {
  try {
    const settings = await getSettings(storage);
    applyTheme(settings.theme);
  } catch {
    applyTheme('system');
  }
}

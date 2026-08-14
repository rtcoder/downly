import { migrateSettings } from '../domain/settings/migrations';
import type { DownloadRule, DownlySettings } from '../domain/settings/types';
import { ChromeStorageApi } from '../platform/chrome/storage-api';

// This single namespaced record keeps all Downly settings local to the browser profile.
export const DOWNLY_SETTINGS_STORAGE_KEY = 'downlySettings';

export interface SettingsStoragePort {
  get(key: string): Promise<unknown>;
  set(items: Record<string, unknown>): Promise<void>;
}

export type SettingsPatch = Partial<Omit<DownlySettings, 'schemaVersion'>>;

export function getSettings(storage: SettingsStoragePort = new ChromeStorageApi()): Promise<DownlySettings> {
  return storage.get(DOWNLY_SETTINGS_STORAGE_KEY).then(migrateSettings);
}

export async function updateSettings(
  patch: SettingsPatch,
  storage: SettingsStoragePort = new ChromeStorageApi(),
): Promise<DownlySettings> {
  const current = await getSettings(storage);
  const settings = migrateSettings({ ...current, ...patch });
  await storage.set({ [DOWNLY_SETTINGS_STORAGE_KEY]: settings });
  return settings;
}

export async function replaceRules(
  rules: DownloadRule[],
  storage: SettingsStoragePort = new ChromeStorageApi(),
): Promise<DownlySettings> {
  const current = await getSettings(storage);
  const settings = migrateSettings({ ...current, rules });
  await storage.set({ [DOWNLY_SETTINGS_STORAGE_KEY]: settings });
  return settings;
}

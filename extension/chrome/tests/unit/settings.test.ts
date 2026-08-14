import { describe, expect, it } from 'vitest';

import { getSettings, replaceRules, updateSettings, type SettingsStoragePort } from '../../src/application/settings-repository';
import { DEFAULT_SETTINGS } from '../../src/domain/settings/defaults';
import { migrateSettings } from '../../src/domain/settings/migrations';
import type { DownloadRule } from '../../src/domain/settings/types';
import { DownlyError } from '../../src/platform/chrome/downloads-api';
import { ChromeStorageApi } from '../../src/platform/chrome/storage-api';

const validRule: DownloadRule = {
  id: 'pdfs',
  name: 'PDF files',
  enabled: true,
  priority: 10,
  conditions: [{ field: 'extension', operator: 'equals', value: 'pdf' }],
  targetPathTemplate: 'Documents/PDFs/{filename}',
};

function createStorage(initialValue?: unknown): SettingsStoragePort & { value: unknown; writes: unknown[] } {
  return {
    value: initialValue,
    writes: [],
    async get() {
      return this.value;
    },
    async set(items) {
      this.writes.push(items);
      this.value = items.downlySettings;
    },
  };
}

describe('settings defaults and migration', () => {
  it('defines the conservative default settings contract', () => {
    expect(DEFAULT_SETTINGS).toEqual({
      schemaVersion: 1,
      theme: 'system',
      language: 'auto',
      replaceNativeDownloadsUi: false,
      showActiveCountBadge: true,
      organizerEnabled: false,
      conflictAction: 'uniquify',
      rules: [],
    });
  });

  it('returns defaults for missing persisted settings', () => {
    expect(migrateSettings(undefined)).toEqual(DEFAULT_SETTINGS);
  });

  it('merges partial persisted settings into defaults', () => {
    expect(migrateSettings({ theme: 'dark', organizerEnabled: true })).toEqual({
      ...DEFAULT_SETTINGS,
      theme: 'dark',
      organizerEnabled: true,
    });
  });

  it('falls back safely for invalid persisted values while keeping valid values', () => {
    expect(migrateSettings({
      theme: 'neon',
      language: 42,
      replaceNativeDownloadsUi: 'yes',
      showActiveCountBadge: false,
      organizerEnabled: null,
      conflictAction: 'replace',
      rules: [{ ...validRule, priority: 'first' }, validRule],
    })).toEqual({
      ...DEFAULT_SETTINGS,
      showActiveCountBadge: false,
      rules: [validRule],
    });
  });

  it('normalizes legacy settings without a schema version to v1', () => {
    expect(migrateSettings({ theme: 'light', rules: [validRule] })).toEqual({
      ...DEFAULT_SETTINGS,
      schemaVersion: 1,
      theme: 'light',
      rules: [validRule],
    });
  });
});

describe('settings repository', () => {
  it('returns defaults when storage is empty', async () => {
    await expect(getSettings(createStorage())).resolves.toEqual(DEFAULT_SETTINGS);
  });

  it('updates normalized current settings and persists the full object', async () => {
    const storage = createStorage({ theme: 'dark', organizerEnabled: 'yes' });

    await expect(updateSettings({ language: 'pl', organizerEnabled: true }, storage)).resolves.toEqual({
      ...DEFAULT_SETTINGS,
      theme: 'dark',
      language: 'pl',
      organizerEnabled: true,
    });
    expect(storage.writes).toEqual([{
      downlySettings: {
        ...DEFAULT_SETTINGS,
        theme: 'dark',
        language: 'pl',
        organizerEnabled: true,
      },
    }]);
  });

  it('replaces rules while preserving other normalized settings', async () => {
    const storage = createStorage({ theme: 'light', rules: [validRule] });
    const replacement = [{ ...validRule, id: 'images', name: 'Images' }];

    await expect(replaceRules(replacement, storage)).resolves.toEqual({
      ...DEFAULT_SETTINGS,
      theme: 'light',
      rules: replacement,
    });
    expect(storage.writes).toEqual([{
      downlySettings: {
        ...DEFAULT_SETTINGS,
        theme: 'light',
        rules: replacement,
      },
    }]);
  });
});

describe('ChromeStorageApi', () => {
  it('converts a Chrome storage lastError into a typed error', async () => {
    const chrome = {
      runtime: { lastError: { message: 'Storage unavailable' } },
      storage: {
        local: {
          get(_key: string, callback: (items: Record<string, unknown>) => void) {
            callback({});
          },
          set(_items: Record<string, unknown>, callback: () => void) {
            callback();
          },
        },
      },
    };

    await expect(new ChromeStorageApi(chrome).get('downlySettings')).rejects.toMatchObject({
      name: 'DownlyError',
      code: 'chrome-api-error',
      message: 'Storage unavailable',
    } satisfies Partial<DownlyError>);
  });

  it('does not let callback-scoped lastError affect the next storage operation', async () => {
    const runtime: { lastError?: { message?: string } } = { lastError: { message: 'Storage unavailable' } };
    const chrome = {
      runtime,
      storage: {
        local: {
          get(_key: string, callback: (items: Record<string, unknown>) => void) {
            try {
              callback({ downlySettings: { theme: 'dark' } });
            } finally {
              delete runtime.lastError;
            }
          },
          set(_items: Record<string, unknown>, callback: () => void) {
            callback();
          },
        },
      },
    };
    const storage = new ChromeStorageApi(chrome);

    await expect(storage.get('downlySettings')).rejects.toMatchObject({ code: 'chrome-api-error' });
    await expect(storage.get('downlySettings')).resolves.toEqual({ theme: 'dark' });
  });
});

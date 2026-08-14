import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  getSettings,
  type SettingsPatch,
  type SettingsStoragePort,
  updateSettings,
} from '../../../application/settings-repository';
import type { DownlySettings } from '../../../domain/settings/types';
import { ChromeNativeUiOptionsApi, type NativeUiOptionsResult } from '../../../platform/chrome/native-ui-options-api';
import { ChromeRuntimeApi } from '../../../platform/chrome/runtime-api';
import { ChromeStorageApi } from '../../../platform/chrome/storage-api';
import { applyTheme } from '../../shared/theme';

export interface SettingsViewProps {
  storage?: SettingsStoragePort;
  applyNativeUiOptions?: (settings: Pick<DownlySettings, 'replaceNativeDownloadsUi'>) => Promise<NativeUiOptionsResult>;
  version?: string;
}

export function SettingsView({
  storage: providedStorage,
  applyNativeUiOptions: providedApplyNativeUiOptions,
  version: providedVersion,
}: SettingsViewProps) {
  const storage = useMemo(() => providedStorage ?? new ChromeStorageApi(), [providedStorage]);
  const applyNativeUiOptions = useCallback((settings: Pick<DownlySettings, 'replaceNativeDownloadsUi'>) => {
    if (providedApplyNativeUiOptions) {
      return providedApplyNativeUiOptions(settings);
    }

    return new ChromeNativeUiOptionsApi().apply(settings);
  }, [providedApplyNativeUiOptions]);
  const version = useMemo(() => providedVersion ?? defaultVersion(), [providedVersion]);
  const [settings, setSettings] = useState<DownlySettings | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void getSettings(storage)
      .then((loadedSettings) => {
        if (!active) return;
        setSettings(loadedSettings);
        applyTheme(loadedSettings.theme);
      })
      .catch((loadError: unknown) => {
        if (active) setError(messageFromError(loadError, 'Settings could not be loaded.'));
      });

    return () => {
      active = false;
    };
  }, [storage]);

  const persist = useCallback(async (patch: SettingsPatch) => {
    setError(null);

    try {
      const nextSettings = await updateSettings(patch, storage);
      setSettings(nextSettings);

      if (patch.theme) {
        applyTheme(nextSettings.theme);
      }

      if (typeof patch.replaceNativeDownloadsUi === 'boolean') {
        const result = await applyNativeUiOptions(nextSettings);
        setWarning(result.warning?.message ?? null);
      }

      if (typeof patch.showActiveCountBadge === 'boolean') {
        await notifySettingsUpdated().catch(() => undefined);
      }
    } catch (saveError) {
      setError(messageFromError(saveError, 'Settings could not be saved.'));
    }
  }, [applyNativeUiOptions, storage]);

  const statusMessages = useMemo(() => [
    warning ? { id: 'native-ui-warning', role: 'alert' as const, message: warning } : null,
    error ? { id: 'settings-error', role: 'alert' as const, message: error } : null,
  ].filter((message): message is { id: string; role: 'alert'; message: string } => message !== null), [error, warning]);

  if (!settings) {
    return <section aria-label="Settings">
      <h2>Settings</h2>
      <p>Loading settings...</p>
    </section>;
  }

  return <section aria-label="Settings">
    <h2>Settings</h2>

    {statusMessages.map((message) => (
      <p key={message.id} role={message.role}>{message.message}</p>
    ))}

    <fieldset>
      <legend>Appearance</legend>
      <label>
        Theme
        <select
          aria-label="Theme"
          onChange={(event) => void persist({ theme: event.currentTarget.value as DownlySettings['theme'] })}
          value={settings.theme}
        >
          <option value="system">System</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </label>
    </fieldset>

    <fieldset>
      <legend>Chrome integration</legend>
      <label>
        <input
          checked={settings.replaceNativeDownloadsUi}
          onChange={(event) => void persist({ replaceNativeDownloadsUi: event.currentTarget.checked })}
          type="checkbox"
        />
        Replace Chrome downloads UI
      </label>
      <label>
        <input
          checked={settings.showActiveCountBadge}
          onChange={(event) => void persist({ showActiveCountBadge: event.currentTarget.checked })}
          type="checkbox"
        />
        Show active download count badge
      </label>
    </fieldset>

    <fieldset>
      <legend>Downloads</legend>
      <label>
        When a filename already exists
        <select
          aria-label="When a filename already exists"
          onChange={(event) => void persist({ conflictAction: event.currentTarget.value as DownlySettings['conflictAction'] })}
          value={settings.conflictAction}
        >
          <option value="uniquify">Keep both files</option>
          <option value="overwrite">Overwrite existing files</option>
          <option value="prompt">Ask each time</option>
        </select>
      </label>
    </fieldset>

    <section aria-label="Privacy">
      <h3>Privacy</h3>
      <p>Downly stores settings in your local browser profile.</p>
      <p>Downly uses Chrome download history to power search and organization, and does not upload your history or files.</p>
    </section>

    <p>Version {version}</p>
  </section>;
}

function defaultVersion(): string {
  const chromeApi = (globalThis as typeof globalThis & {
    chrome?: ConstructorParameters<typeof ChromeRuntimeApi>[0];
  }).chrome;

  return chromeApi?.runtime?.getManifest ? new ChromeRuntimeApi(chromeApi).getVersion() : 'unknown';
}

async function notifySettingsUpdated(): Promise<void> {
  const chromeApi = (globalThis as typeof globalThis & {
    chrome?: ConstructorParameters<typeof ChromeRuntimeApi>[0];
  }).chrome;

  if (!chromeApi?.runtime?.sendMessage) return;
  await new ChromeRuntimeApi(chromeApi).sendSettingsUpdated();
}

function messageFromError(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

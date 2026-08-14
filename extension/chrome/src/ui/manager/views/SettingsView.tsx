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
import { t } from '../../shared/i18n';
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
        if (active) setError(messageFromError(loadError, t('manager.settings.loadError')));
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
      setError(messageFromError(saveError, t('manager.settings.saveError')));
    }
  }, [applyNativeUiOptions, storage]);

  const statusMessages = useMemo(() => [
    warning ? { id: 'native-ui-warning', role: 'alert' as const, message: warning } : null,
    error ? { id: 'settings-error', role: 'alert' as const, message: error } : null,
  ].filter((message): message is { id: string; role: 'alert'; message: string } => message !== null), [error, warning]);

  if (!settings) {
    return <section aria-label={t('manager.settings.title')}>
      <h2>{t('manager.settings.title')}</h2>
      <p>{t('manager.settings.loading')}</p>
    </section>;
  }

  return <section aria-label={t('manager.settings.title')}>
    <h2>{t('manager.settings.title')}</h2>

    {statusMessages.map((message) => (
      <p key={message.id} role={message.role}>{message.message}</p>
    ))}

    <fieldset>
      <legend>{t('manager.settings.appearance')}</legend>
      <label>
        {t('manager.settings.theme')}
        <select
          aria-label={t('manager.settings.theme')}
          onChange={(event) => void persist({ theme: event.currentTarget.value as DownlySettings['theme'] })}
          value={settings.theme}
        >
          <option value="system">{t('manager.settings.theme.system')}</option>
          <option value="light">{t('manager.settings.theme.light')}</option>
          <option value="dark">{t('manager.settings.theme.dark')}</option>
        </select>
      </label>
    </fieldset>

    <fieldset>
      <legend>{t('manager.settings.chromeIntegration')}</legend>
      <label>
        <input
          checked={settings.replaceNativeDownloadsUi}
          onChange={(event) => void persist({ replaceNativeDownloadsUi: event.currentTarget.checked })}
          type="checkbox"
        />
        {t('manager.settings.replaceNativeUi')}
      </label>
      <label>
        <input
          checked={settings.showActiveCountBadge}
          onChange={(event) => void persist({ showActiveCountBadge: event.currentTarget.checked })}
          type="checkbox"
        />
        {t('manager.settings.showBadge')}
      </label>
    </fieldset>

    <fieldset>
      <legend>{t('manager.settings.downloads')}</legend>
      <label>
        {t('manager.settings.filenameConflict')}
        <select
          aria-label={t('manager.settings.filenameConflict')}
          onChange={(event) => void persist({ conflictAction: event.currentTarget.value as DownlySettings['conflictAction'] })}
          value={settings.conflictAction}
        >
          <option value="uniquify">{t('manager.settings.conflict.keepBoth')}</option>
          <option value="overwrite">{t('manager.settings.conflict.overwrite')}</option>
          <option value="prompt">{t('manager.settings.conflict.prompt')}</option>
        </select>
      </label>
    </fieldset>

    <section aria-label={t('manager.settings.privacy')}>
      <h3>{t('manager.settings.privacy')}</h3>
      <p>{t('manager.settings.localStorage')}</p>
      <p>{t('manager.settings.historyUse')}</p>
    </section>

    <p>{t('manager.settings.version', { version })}</p>
  </section>;
}

function defaultVersion(): string {
  const chromeApi = (globalThis as typeof globalThis & {
    chrome?: ConstructorParameters<typeof ChromeRuntimeApi>[0];
  }).chrome;

  return chromeApi?.runtime?.getManifest ? new ChromeRuntimeApi(chromeApi).getVersion() : t('manager.settings.unknownVersion');
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

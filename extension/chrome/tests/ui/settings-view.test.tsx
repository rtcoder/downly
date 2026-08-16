import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_SETTINGS } from '../../src/domain/settings/defaults';
import type { DownlySettings } from '../../src/domain/settings/types';
import { SettingsView } from '../../src/ui/manager/views/SettingsView';
import { initializeTheme } from '../../src/ui/shared/theme';

function installChrome(initial: Partial<DownlySettings> = {}, uiOptionsError?: string) {
  let stored: DownlySettings = { ...DEFAULT_SETTINGS, ...initial };
  const writes: DownlySettings[] = [];
  const setUiOptions = vi.fn((_options: { enabled: boolean }, callback?: () => void) => {
    if (uiOptionsError) {
      chrome.runtime.lastError = { message: uiOptionsError };
    }
    callback?.();
    delete chrome.runtime.lastError;
  });
  const chrome = {
    runtime: {
      lastError: undefined as { message?: string } | undefined,
      getManifest: () => ({ version: '0.1.0' }),
      getURL: (path: string) => `chrome-extension://downly/${path}`,
      sendMessage: vi.fn().mockResolvedValue(undefined),
    },
    downloads: { setUiOptions },
    storage: {
      local: {
        get(_key: string, callback: (items: Record<string, unknown>) => void) {
          callback({ downlySettings: stored });
        },
        set(items: Record<string, unknown>, callback: () => void) {
          stored = items.downlySettings as DownlySettings;
          writes.push(stored);
          callback();
        },
      },
    },
  };

  vi.stubGlobal('chrome', chrome);

  return {
    get stored() {
      return stored;
    },
    setUiOptions,
    sendMessage: chrome.runtime.sendMessage,
    writes,
  };
}

async function renderSettings(settings: Partial<DownlySettings> = {}, uiOptionsError?: string) {
  const chrome = installChrome(settings, uiOptionsError);

  render(<SettingsView />);
  await act(async () => {
    await Promise.resolve();
  });
  await screen.findByRole('heading', { name: 'Settings' });

  return chrome;
}

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute('data-theme');
  vi.unstubAllGlobals();
});

describe('SettingsView', () => {
  it('loads the saved theme, applies it to the document, and persists theme changes', async () => {
    const chrome = await renderSettings({ theme: 'system' });

    expect(screen.getByLabelText('Theme')).toHaveProperty('value', 'system');
    expect(document.documentElement.dataset.theme).toBe('system');

    fireEvent.change(screen.getByLabelText('Theme'), { target: { value: 'dark' } });

    await waitFor(() => expect(chrome.stored.theme).toBe('dark'));
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('persists Chrome download bubble visibility and shows a non-destructive warning when Chrome reports a conflict', async () => {
    const chrome = await renderSettings({ replaceNativeDownloadsUi: false }, 'Another extension controls downloads UI');

    fireEvent.click(screen.getByRole('checkbox', { name: 'Hide Chrome download bubble' }));

    await waitFor(() => expect(chrome.stored.replaceNativeDownloadsUi).toBe(true));
    expect(chrome.setUiOptions).toHaveBeenCalledWith({ enabled: false }, expect.any(Function));
    expect(screen.getByRole('alert').textContent).toContain('Another extension controls downloads UI');
    expect(screen.getByRole<HTMLInputElement>('checkbox', { name: 'Hide Chrome download bubble' }).checked).toBe(true);
  });

  it('persists active download badge visibility changes', async () => {
    const chrome = await renderSettings({ showActiveCountBadge: true });

    fireEvent.click(screen.getByRole('checkbox', { name: 'Show active download count badge' }));

    await waitFor(() => expect(chrome.stored.showActiveCountBadge).toBe(false));
    expect(chrome.sendMessage).toHaveBeenCalledWith({ type: 'settings-updated' });
  });

  it('persists the duplicate filename conflict action', async () => {
    const chrome = await renderSettings({ conflictAction: 'uniquify' });

    fireEvent.change(screen.getByLabelText('When a filename already exists'), { target: { value: 'overwrite' } });

    await waitFor(() => expect(chrome.stored.conflictAction).toBe('overwrite'));
  });

  it('shows privacy copy for local-only settings and Chrome download history access', async () => {
    await renderSettings();

    const privacy = screen.getByRole('region', { name: 'Privacy' });

    expect(within(privacy).getByText(/local browser profile/i)).toBeTruthy();
    expect(within(privacy).getByText(/does not upload/i)).toBeTruthy();
    expect(within(privacy).getByText(/Chrome download history/i)).toBeTruthy();
  });

  it('shows the extension version from the Chrome manifest', async () => {
    await renderSettings();

    expect(screen.getByText('Version 0.1.0')).toBeTruthy();
  });

  it('initializes the persisted theme outside the settings view', async () => {
    installChrome({ theme: 'dark' });

    await initializeTheme();

    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
  });
});

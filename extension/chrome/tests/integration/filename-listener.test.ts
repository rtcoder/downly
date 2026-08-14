import { describe, expect, it, vi } from 'vitest';

import { registerFilenameListener } from '../../src/background/filename-listener';
import { DEFAULT_SETTINGS } from '../../src/domain/settings/defaults';
import type { DownlySettings, DownloadRule } from '../../src/domain/settings/types';

type Suggestion = { filename: string; conflictAction: DownlySettings['conflictAction'] } | undefined;
type DeterminingFilenameListener = (download: RawDownload, suggest: (suggestion?: Suggestion) => void) => boolean;

interface RawDownload {
  id: number;
  filename: string;
  url: string;
  startTime: string;
  mime?: string;
}

function rule(overrides: Partial<DownloadRule> = {}): DownloadRule {
  return {
    id: 'documents',
    name: 'Documents',
    enabled: true,
    priority: 10,
    conditions: [{ field: 'extension', operator: 'equals', value: 'pdf' }],
    targetPathTemplate: 'Documents/{filename}',
    ...overrides,
  };
}

function settings(overrides: Partial<DownlySettings> = {}): DownlySettings {
  return { ...DEFAULT_SETTINGS, organizerEnabled: true, rules: [rule()], ...overrides };
}

function createChromeApi(): { chrome: { downloads: { onDeterminingFilename: { addListener: (listener: DeterminingFilenameListener) => void } } }; listener: () => DeterminingFilenameListener } {
  let registeredListener: DeterminingFilenameListener | undefined;

  return {
    chrome: {
      downloads: {
        onDeterminingFilename: {
          addListener(listener) {
            registeredListener = listener;
          },
        },
      },
    },
    listener() {
      if (!registeredListener) throw new Error('Expected listener registration');
      return registeredListener;
    },
  };
}

const rawDownload: RawDownload = {
  id: 41,
  filename: 'annual-report.pdf',
  url: 'https://cdn.example.com/annual-report.pdf',
  startTime: '2026-08-14T10:00:00.000Z',
  mime: 'application/pdf',
};

async function flushAsyncWork(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('registerFilenameListener', () => {
  it('registers exactly one listener when called once', () => {
    const { chrome } = createChromeApi();
    const addListener = vi.spyOn(chrome.downloads.onDeterminingFilename, 'addListener');

    registerFilenameListener(chrome, async () => settings());

    expect(addListener).toHaveBeenCalledTimes(1);
  });

  it('leaves filenames unchanged when the organizer is disabled', async () => {
    const { chrome, listener } = createChromeApi();
    const suggest = vi.fn();
    registerFilenameListener(chrome, async () => settings({ organizerEnabled: false }));

    expect(listener()(rawDownload, suggest)).toBe(true);
    await flushAsyncWork();

    expect(suggest).toHaveBeenCalledOnce();
    expect(suggest).toHaveBeenCalledWith();
  });

  it('leaves filenames unchanged when no rule matches', async () => {
    const { chrome, listener } = createChromeApi();
    const suggest = vi.fn();
    registerFilenameListener(chrome, async () => settings({ rules: [rule({ conditions: [{ field: 'extension', operator: 'equals', value: 'zip' }] })] }));

    listener()(rawDownload, suggest);
    await flushAsyncWork();

    expect(suggest).toHaveBeenCalledOnce();
    expect(suggest).toHaveBeenCalledWith();
  });

  it('suggests a matching rule path without its internal rule id', async () => {
    const { chrome, listener } = createChromeApi();
    const suggest = vi.fn();
    registerFilenameListener(chrome, async () => settings({ conflictAction: 'prompt' }));

    listener()(rawDownload, suggest);
    await flushAsyncWork();

    expect(suggest).toHaveBeenCalledOnce();
    expect(suggest).toHaveBeenCalledWith({ filename: 'Documents/annual-report.pdf', conflictAction: 'prompt' });
  });

  it('keeps the response channel open while settings load asynchronously', async () => {
    const { chrome, listener } = createChromeApi();
    const suggest = vi.fn();
    let resolveSettings: ((value: DownlySettings) => void) | undefined;
    const loadSettings = () => new Promise<DownlySettings>((resolve) => {
      resolveSettings = resolve;
    });
    registerFilenameListener(chrome, loadSettings);

    expect(listener()(rawDownload, suggest)).toBe(true);
    expect(suggest).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(resolveSettings).toBeTypeOf('function');
    resolveSettings?.(settings());
    await flushAsyncWork();

    expect(suggest).toHaveBeenCalledOnce();
    expect(suggest).toHaveBeenCalledWith({ filename: 'Documents/annual-report.pdf', conflictAction: 'uniquify' });
  });

  it('falls back to Chrome defaults for an invalid generated path', async () => {
    const { chrome, listener } = createChromeApi();
    const suggest = vi.fn();
    registerFilenameListener(chrome, async () => settings({ rules: [rule({ targetPathTemplate: '../outside/{filename}' })] }));

    listener()(rawDownload, suggest);
    await flushAsyncWork();

    expect(suggest).toHaveBeenCalledOnce();
    expect(suggest).toHaveBeenCalledWith();
  });

  it('falls back to Chrome defaults when loading settings fails', async () => {
    const { chrome, listener } = createChromeApi();
    const suggest = vi.fn();
    registerFilenameListener(chrome, async () => Promise.reject(new Error('Storage unavailable')));

    listener()(rawDownload, suggest);
    await flushAsyncWork();

    expect(suggest).toHaveBeenCalledOnce();
    expect(suggest).toHaveBeenCalledWith();
  });

  it('falls back to Chrome defaults when loading settings throws synchronously', async () => {
    const { chrome, listener } = createChromeApi();
    const suggest = vi.fn();
    registerFilenameListener(chrome, () => {
      throw new Error('Storage unavailable');
    });

    expect(listener()(rawDownload, suggest)).toBe(true);
    await flushAsyncWork();

    expect(suggest).toHaveBeenCalledOnce();
    expect(suggest).toHaveBeenCalledWith();
  });

  it('falls back to Chrome defaults when normalizing the download fails', async () => {
    const { chrome, listener } = createChromeApi();
    const suggest = vi.fn();
    const malformedDownload = { ...rawDownload };
    Object.defineProperty(malformedDownload, 'filename', {
      get() {
        throw new Error('Invalid filename');
      },
    });
    registerFilenameListener(chrome, async () => settings());

    expect(listener()(malformedDownload, suggest)).toBe(true);
    await flushAsyncWork();

    expect(suggest).toHaveBeenCalledOnce();
    expect(suggest).toHaveBeenCalledWith();
  });
});

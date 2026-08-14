import { describe, expect, it, vi } from 'vitest';

import { BadgeController } from '../../src/background/badge-controller';
import { registerDownloadEventListeners } from '../../src/background/download-events';
import { registerUiOptionsListeners, UiOptionsController } from '../../src/background/ui-options-controller';
import { ChromeActionApi } from '../../src/platform/chrome/action-api';

type Listener<T> = (value: T) => void;

function createEvent<T>(): {
  addListener: ReturnType<typeof vi.fn<(listener: Listener<T>) => void>>;
  emit: (value: T) => void;
} {
  const listeners: Listener<T>[] = [];
  const addListener = vi.fn((listener: Listener<T>) => {
    listeners.push(listener);
  });

  return {
    addListener,
    emit(value) {
      listeners.forEach((listener) => listener(value));
    },
  };
}

async function flushAsyncWork(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('background download events', () => {
  it('broadcasts download invalidations with ids and refreshes the badge after each lifecycle event', async () => {
    const onCreated = createEvent<{ id: number }>();
    const onChanged = createEvent<{ id: number }>();
    const onErased = createEvent<number>();
    const sendMessage = vi.fn().mockResolvedValue(undefined);
    const refreshBadge = vi.fn().mockResolvedValue(undefined);

    registerDownloadEventListeners({ downloads: { onCreated, onChanged, onErased }, runtime: { sendMessage } }, refreshBadge);

    expect(onCreated.addListener).toHaveBeenCalledTimes(1);
    expect(onChanged.addListener).toHaveBeenCalledTimes(1);
    expect(onErased.addListener).toHaveBeenCalledTimes(1);

    onCreated.emit({ id: 11 });
    onChanged.emit({ id: 12 });
    onErased.emit(13);
    await flushAsyncWork();

    expect(sendMessage).toHaveBeenCalledWith({ type: 'downloads-invalidated', downloadId: 11 });
    expect(sendMessage).toHaveBeenCalledWith({ type: 'downloads-invalidated', downloadId: 12 });
    expect(sendMessage).toHaveBeenCalledWith({ type: 'downloads-invalidated', downloadId: 13 });
    expect(refreshBadge).toHaveBeenCalledTimes(3);
  });

  it('refreshes the badge without an unhandled rejection when no message receiver exists', async () => {
    const onCreated = createEvent<{ id: number }>();
    const onChanged = createEvent<{ id: number }>();
    const onErased = createEvent<number>();
    const sendMessage = vi.fn().mockRejectedValue(new Error('Could not establish connection. Receiving end does not exist.'));
    const refreshBadge = vi.fn().mockResolvedValue(undefined);
    const unhandledRejections: PromiseRejectionEvent[] = [];
    const captureUnhandledRejection = (event: PromiseRejectionEvent): void => {
      unhandledRejections.push(event);
    };

    window.addEventListener('unhandledrejection', captureUnhandledRejection);
    try {
      registerDownloadEventListeners({ downloads: { onCreated, onChanged, onErased }, runtime: { sendMessage } }, refreshBadge);

      onCreated.emit({ id: 11 });
      await flushAsyncWork();
    } finally {
      window.removeEventListener('unhandledrejection', captureUnhandledRejection);
    }

    expect(refreshBadge).toHaveBeenCalledOnce();
    expect(unhandledRejections).toEqual([]);
  });
});

describe('BadgeController', () => {
  it.each([
    [0, ''],
    [1, '1'],
    [9, '9'],
    [10, '9+'],
  ])('shows %s active downloads as %s', async (activeCount, expectedText) => {
    const search = vi.fn().mockResolvedValue(Array.from({ length: activeCount }, (_, id) => ({ id })));
    const setBadgeText = vi.fn().mockResolvedValue(undefined);
    const badge = new BadgeController({ setBadgeText }, search);

    await badge.refresh();

    expect(search).toHaveBeenCalledWith({ state: 'in_progress' });
    expect(setBadgeText).toHaveBeenCalledWith(expectedText);
  });

  it('wraps Chrome action badge updates', async () => {
    const setBadgeText = vi.fn().mockResolvedValue(undefined);
    const action = new ChromeActionApi({ action: { setBadgeText } });

    await action.setBadgeText('9+');

    expect(setBadgeText).toHaveBeenCalledWith({ text: '9+' });
  });
});

describe('native UI options controller', () => {
  it('applies the saved native UI setting when Chrome starts or installs', async () => {
    const onInstalled = createEvent<void>();
    const onStartup = createEvent<void>();
    const setUiOptions = vi.fn((_options: { enabled: boolean }, callback?: () => void) => {
      callback?.();
      return Promise.resolve();
    });
    const controller = new UiOptionsController({ downloads: { setUiOptions } });
    const loadSettings = vi
      .fn()
      .mockResolvedValueOnce({ replaceNativeDownloadsUi: true })
      .mockResolvedValueOnce({ replaceNativeDownloadsUi: false });

    registerUiOptionsListeners({ runtime: { onInstalled, onStartup } }, loadSettings, controller);

    expect(onInstalled.addListener).toHaveBeenCalledTimes(1);
    expect(onStartup.addListener).toHaveBeenCalledTimes(1);

    onInstalled.emit();
    await flushAsyncWork();
    onStartup.emit();
    await flushAsyncWork();

    expect(setUiOptions.mock.calls.map(([options]) => options)).toEqual([{ enabled: false }, { enabled: true }]);
  });

  it.each([
    ['lastError', (runtime: { lastError?: { message?: string } }) => {
      runtime.lastError = { message: 'Another extension controls downloads UI' };
      return undefined;
    }],
    ['rejection', () => Promise.reject(new Error('Chrome rejected the UI option'))],
    ['synchronous throw', () => {
      throw new Error('Chrome synchronously rejected the UI option');
    }],
  ] as const)('returns a warning when setUiOptions reports a %s', async (_kind, failure) => {
    const runtime: { lastError?: { message?: string } } = {};
    const controller = new UiOptionsController({
      runtime,
      downloads: {
        setUiOptions: vi.fn().mockImplementation((_options, callback) => {
          const result = failure(runtime);
          if (result) return result;
          callback?.();
          return undefined;
        }),
      },
    });

    const result = await controller.apply({ replaceNativeDownloadsUi: true });

    expect(result).toMatchObject({
      warning: {
        code: 'native-ui-conflict',
      },
    });
  });
});

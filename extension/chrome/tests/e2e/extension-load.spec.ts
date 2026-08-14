import { test, expect, chromium, type BrowserContext, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const extensionPath = resolve(process.cwd(), 'dist');
const chromiumExecutable = chromium.executablePath();

test('loads the built extension and starts its service worker without errors', async () => {
  test.skip(!existsSync(chromiumExecutable), 'Playwright Chromium is not installed in this environment.');

  const context = await test.step('launch Chrome with the built extension', launchExtension);
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const watchedWorkers = new WeakSet<object>();

  context.on('page', (page) => {
    watchPage(page, consoleErrors, pageErrors);
  });
  context.on('serviceworker', (worker) => {
    watchWorker(worker, watchedWorkers, consoleErrors);
  });

  try {
    const setupPage = await context.newPage();
    watchPage(setupPage, consoleErrors, pageErrors);
    const session = await context.browser()!.newBrowserCDPSession();
    const { id: extensionId } = await session.send('Extensions.loadUnpacked', {
      path: extensionPath,
    });
    const manager = await context.newPage();
    watchPage(manager, consoleErrors, pageErrors);
    await manager.goto(`chrome-extension://${extensionId}/manager.html`);
    await expect(manager.locator('#root')).toHaveText('Downly Download Manager');

    await manager.evaluate(() => new Promise<void>((resolve) => {
      const chromeRuntime = (globalThis as typeof globalThis & {
        chrome: {
          runtime: {
            lastError?: unknown;
            sendMessage(message: unknown, callback: () => void): void;
          };
        };
      }).chrome.runtime;

      chromeRuntime.sendMessage({ type: 'downly-bootstrap-smoke' }, () => {
        void chromeRuntime.lastError;
        resolve();
      });
    }));

    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    watchWorker(worker, watchedWorkers, consoleErrors);

    expect(worker.url()).toBe(`chrome-extension://${extensionId}/service-worker.js`);
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  } finally {
    await context.close();
  }
});

async function launchExtension(): Promise<BrowserContext> {
  const { chromium } = await import('@playwright/test');

  return chromium.launchPersistentContext('', {
    headless: false,
    ignoreDefaultArgs: ['--disable-extensions'],
    args: [
      `--disable-extensions-except=${extensionPath}`,
      '--no-first-run',
      '--no-default-browser-check',
    ],
  });
}

function watchWorker(
  worker: object & { on(event: 'console', listener: (message: { type(): string; text(): string }) => void): void },
  watchedWorkers: WeakSet<object>,
  consoleErrors: string[],
): void {
  if (watchedWorkers.has(worker)) {
    return;
  }

  watchedWorkers.add(worker);
  worker.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });
}

function watchPage(page: Page, consoleErrors: string[], pageErrors: string[]): void {
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });
  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });
}
